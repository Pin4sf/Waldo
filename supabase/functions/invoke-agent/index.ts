/**
 * Waldo Agent v2 — Full Agent with Tool Execution, Quality Gates, Memory, Cross-Domain Synthesis
 *
 * 5 improvements over v1:
 * 1. Tool execution (ReAct loop — Claude calls tools, agent executes, 3 iterations max)
 * 2. Cross-domain narrative synthesis (not just data listing)
 * 3. Memory write (agent can save learnings via update_memory tool)
 * 4. Quality gates (emergency detection, banned phrases, confidence check)
 * 5. Dynamic token budgets per trigger type
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { assembleSoulPrompt, getZone } from '../_shared/soul-file.ts';
import type { MessageMode } from '../_shared/soul-file.ts';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const MAX_ITERATIONS = 3;

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'invoke-agent', level, event, ...data }));
}

// ─── Quality Gate 1: Emergency Detection ──────────────────────
const EMERGENCY_PATTERNS = /chest\s*pain|can'?t\s*breathe|suicid|kill\s*(my|him|her)self|heart\s*attack|overdos/i;
const BANNED_OUTPUT = /diagnos|you\s+have\s+(anxiety|depression|insomnia|sleep\s+apnea|afib|arrhythmia)/i;

function checkEmergency(text: string): string | null {
  if (EMERGENCY_PATTERNS.test(text)) {
    return "I'm not equipped to help with this. Please contact emergency services (112) or a medical professional immediately. Your safety matters more than any data.";
  }
  return null;
}

// ─── Quality Gate 2: Output Validation ────────────────────────
function validateOutput(text: string): string {
  if (BANNED_OUTPUT.test(text)) {
    return text.replace(BANNED_OUTPUT, '[medical assessment removed — consult a doctor]');
  }
  return text;
}

// ─── Tool Definitions ─────────────────────────────────────────
function getToolDefinitions(triggerType: MessageMode) {
  const readTools: Anthropic.Tool[] = [
    {
      name: 'get_crs',
      description: 'Get the Nap Score (CRS) for a specific date or the most recent date. Returns score 0-100, zone, component breakdown (sleep/HRV/circadian/activity), and summary.',
      input_schema: {
        type: 'object' as const,
        properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for most recent.' } },
        required: [],
      },
    },
    {
      name: 'get_health',
      description: 'Get detailed health data for a date: sleep hours/efficiency/stages, HRV, resting HR, steps, exercise, SpO2, weather, AQI.',
      input_schema: {
        type: 'object' as const,
        properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD. Omit for most recent.' } },
        required: [],
      },
    },
    {
      name: 'get_trends',
      description: 'Get 14-day trends: CRS week-over-week comparison, sleep/HRV/steps averages, email volume trends, calendar load trends, stress event counts. Use this for any comparison or progress question.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_schedule',
      description: 'Get calendar metrics for a date: meeting load score (0-15), event count, back-to-back meetings, focus gaps, boundary violations.',
      input_schema: {
        type: 'object' as const,
        properties: { date: { type: 'string' } },
        required: [],
      },
    },
    {
      name: 'get_communication',
      description: 'Get email metrics for a date: total volume, sent/received, after-hours ratio, thread count, volume spikes.',
      input_schema: {
        type: 'object' as const,
        properties: { date: { type: 'string' } },
        required: [],
      },
    },
    {
      name: 'read_memory',
      description: 'Read what Waldo remembers about this user: preferences, patterns learned, communication style, chronotype, goals, past observations.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_spots',
      description: 'Get recent observations (Spots) Waldo has made: health patterns, behavioral patterns, alerts, cross-source insights. Can filter by date or type.',
      input_schema: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: 'Optional date filter' },
          limit: { type: 'number', description: 'Max spots to return (default 10)' },
        },
        required: [],
      },
    },
    {
      name: 'get_patterns',
      description: 'Get discovered long-term patterns: weekly CRS cycles, sleep-performance correlations, exercise recovery dips, stress timing patterns.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];

  const writeTools: Anthropic.Tool[] = [
    {
      name: 'update_memory',
      description: 'Save a learning about this user. Use when you discover a preference, pattern, or important context. Key examples: "prefers_short_messages", "stress_trigger_monday_1pm", "goal_better_sleep".',
      input_schema: {
        type: 'object' as const,
        properties: {
          key: { type: 'string', description: 'Memory key (snake_case, descriptive)' },
          value: { type: 'string', description: 'What to remember (plain text, no instructions or code)' },
        },
        required: ['key', 'value'],
      },
    },
  ];

  // Per-trigger tool permissions
  if (triggerType === 'morning_wag') return [...readTools.filter(t => ['get_crs', 'get_health', 'get_schedule', 'get_trends', 'read_memory'].includes(t.name))];
  if (triggerType === 'fetch_alert') return [...readTools.filter(t => ['get_crs', 'get_health', 'read_memory', 'get_spots'].includes(t.name))];
  return [...readTools, ...writeTools]; // conversational gets everything
}

// ─── Tool Execution ───────────────────────────────────────────
async function executeTool(name: string, input: any, userId: string, targetDate: string, supabase: any): Promise<string> {
  const date = input?.date ?? targetDate;

  switch (name) {
    case 'get_crs': {
      const query = input?.date
        ? supabase.from('crs_scores').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
        : supabase.from('crs_scores').select('*').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(1).single();
      const { data } = await query;
      if (!data) return 'No CRS data available for this date.';
      return JSON.stringify({
        date: data.date, score: data.score, zone: data.zone, confidence: data.confidence,
        sleep: data.sleep_json?.score, hrv: data.hrv_json?.score,
        circadian: data.circadian_json?.score, activity: data.activity_json?.score,
        summary: data.summary,
      });
    }

    case 'get_health': {
      const { data } = await supabase.from('health_snapshots').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
      if (!data) return 'No health data for this date.';
      const { data: master } = await supabase.from('master_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
      return JSON.stringify({
        date: data.date,
        sleep: data.sleep_duration_hours ? { hours: data.sleep_duration_hours, efficiency: data.sleep_efficiency, deep: data.sleep_deep_pct, rem: data.sleep_rem_pct } : null,
        hrv: data.hrv_rmssd ? { avg_ms: Math.round(data.hrv_rmssd), readings: data.hrv_count } : null,
        resting_hr: data.resting_hr, steps: data.steps, exercise_min: data.exercise_minutes,
        strain: master?.strain ? { score: master.strain.score, level: master.strain.level } : null,
        sleep_debt: master?.sleep_debt ? { hours: master.sleep_debt.debtHours, direction: master.sleep_debt.direction } : null,
        cognitive_load: master?.cognitive_load ? { score: master.cognitive_load.score, level: master.cognitive_load.level } : null,
        weather: data.weather, aqi: data.aqi,
      });
    }

    case 'get_trends': {
      const [{ data: crs }, { data: health }, { data: email }, { data: cal }, { data: stress }] = await Promise.all([
        supabase.from('crs_scores').select('date, score').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(14),
        supabase.from('health_snapshots').select('date, sleep_duration_hours, hrv_rmssd, steps').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        supabase.from('email_metrics').select('date, total_emails, after_hours_ratio, volume_spike').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        supabase.from('calendar_metrics').select('date, meeting_load_score, event_count, back_to_back_count').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        supabase.from('stress_events').select('date, severity').eq('user_id', userId).order('date', { ascending: false }).limit(30),
      ]);
      const w1 = (crs ?? []).slice(0, 7); const w2 = (crs ?? []).slice(7, 14);
      const avg = (arr: any[], key: string) => arr.length > 0 ? arr.reduce((s, d) => s + (d[key] ?? 0), 0) / arr.length : null;
      const sleepDays = (health ?? []).filter((d: any) => d.sleep_duration_hours);
      const stressDays = new Set((stress ?? []).map((s: any) => s.date));
      return JSON.stringify({
        crs: {
          this_week: { avg: avg(w1, 'score')?.toFixed(0), days: w1.length, daily: w1.map((d: any) => `${d.date.slice(5)}:${d.score}`) },
          prior_week: w2.length > 0 ? { avg: avg(w2, 'score')?.toFixed(0), days: w2.length } : null,
          delta: w1.length > 0 && w2.length > 0 ? (avg(w1, 'score')! - avg(w2, 'score')!).toFixed(0) : null,
          best: [...(crs ?? [])].sort((a: any, b: any) => b.score - a.score)[0],
          worst: [...(crs ?? [])].sort((a: any, b: any) => a.score - b.score)[0],
        },
        health: {
          avg_sleep: sleepDays.length > 0 ? avg(sleepDays, 'sleep_duration_hours')?.toFixed(1) + 'h' : null,
          avg_hrv: avg((health ?? []).filter((d: any) => d.hrv_rmssd), 'hrv_rmssd')?.toFixed(0) + 'ms',
          avg_steps: avg((health ?? []).filter((d: any) => d.steps > 0), 'steps')?.toFixed(0),
        },
        email: { avg_daily: avg(email ?? [], 'total_emails')?.toFixed(0), avg_after_hours: (avg(email ?? [], 'after_hours_ratio')! * 100).toFixed(0) + '%' },
        calendar: { avg_mls: avg(cal ?? [], 'meeting_load_score')?.toFixed(1), avg_events: avg(cal ?? [], 'event_count')?.toFixed(1) },
        stress: { total_events: (stress ?? []).length, days_affected: stressDays.size, high_severity: (stress ?? []).filter((s: any) => s.severity === 'high').length },
      });
    }

    case 'get_schedule': {
      const { data } = await supabase.from('calendar_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
      if (!data) return 'No calendar data for this date.';
      return JSON.stringify({ mls: data.meeting_load_score, events: data.event_count, minutes: data.total_meeting_minutes, back_to_back: data.back_to_back_count, boundary_violations: data.boundary_violations, focus_gaps: data.focus_gaps });
    }

    case 'get_communication': {
      const { data } = await supabase.from('email_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
      if (!data) return 'No email data for this date.';
      return JSON.stringify({ total: data.total_emails, sent: data.sent_count, received: data.received_count, after_hours: (data.after_hours_ratio * 100).toFixed(0) + '%', threads: data.unique_threads, volume_spike: data.volume_spike.toFixed(1) + 'x' });
    }

    case 'read_memory': {
      const [{ data: memories }, { data: intel }, { data: patterns }] = await Promise.all([
        supabase.from('core_memory').select('key, value').eq('user_id', userId),
        supabase.from('user_intelligence').select('summary').eq('user_id', userId).maybeSingle(),
        supabase.from('patterns').select('summary, confidence, evidence_count').eq('user_id', userId),
      ]);
      return JSON.stringify({
        profile: intel?.summary ?? 'No profile yet.',
        memories: (memories ?? []).reduce((acc: any, m: any) => { acc[m.key] = m.value; return acc; }, {}),
        patterns: (patterns ?? []).map((p: any) => ({ summary: p.summary, confidence: p.confidence, evidence: p.evidence_count })),
      });
    }

    case 'get_spots': {
      const limit = input?.limit ?? 10;
      let query = supabase.from('spots').select('date, type, severity, title, detail').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
      if (input?.date) query = query.eq('date', input.date);
      const { data } = await query;
      return JSON.stringify((data ?? []).map((s: any) => ({ date: s.date, type: s.type, severity: s.severity, title: s.title, detail: s.detail?.slice(0, 100) })));
    }

    case 'get_patterns': {
      const { data } = await supabase.from('patterns').select('*').eq('user_id', userId);
      return JSON.stringify((data ?? []).map((p: any) => ({ type: p.type, confidence: p.confidence, summary: p.summary, evidence: p.evidence_count })));
    }

    case 'update_memory': {
      // Memory write validation — reject suspicious content
      const value = String(input?.value ?? '');
      if (/http|<script|ignore|system:|you are now/i.test(value)) {
        return 'Memory update rejected: contains blocked patterns.';
      }
      const { error } = await supabase.from('core_memory').upsert(
        { user_id: userId, key: input.key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
      if (error) return `Memory update failed: ${error.message}`;
      log('info', 'memory_updated', { key: input.key, valueLength: value.length });
      return `Remembered: ${input.key} = ${value.slice(0, 50)}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Cross-Domain Narrative Synthesis ─────────────────────────
function buildNarrativeContext(
  crs: any, health: any, calMetrics: any, emailMetrics: any,
  taskMetrics: any, masterMetrics: any, stress: any[], userIntel: any
): string {
  const parts: string[] = [];

  // Lead with the synthesized story, not raw numbers
  const score = crs?.score ?? -1;
  if (score >= 0) {
    parts.push(`=== TODAY'S PICTURE ===`);
    const factors: string[] = [];

    if (health?.sleep_duration_hours) {
      const sleep = health.sleep_duration_hours;
      factors.push(sleep < 6 ? `short sleep (${sleep}h)` : sleep >= 7.5 ? `solid sleep (${sleep}h)` : `adequate sleep (${sleep}h)`);
    }
    if (calMetrics?.meeting_load_score > 8) factors.push(`heavy meeting load (MLS ${calMetrics.meeting_load_score}/15)`);
    else if (calMetrics?.event_count) factors.push(`${calMetrics.event_count} meetings (MLS ${calMetrics.meeting_load_score}/15)`);
    if (emailMetrics?.after_hours_ratio > 0.3) factors.push(`${(emailMetrics.after_hours_ratio * 100).toFixed(0)}% emails after hours`);
    if (emailMetrics?.volume_spike > 1.5) factors.push(`email volume ${emailMetrics.volume_spike.toFixed(1)}x normal`);
    if (taskMetrics?.overdue_count > 3) factors.push(`${taskMetrics.overdue_count} overdue tasks`);
    if (stress.length > 0) factors.push(`${stress.length} stress events detected`);
    if (masterMetrics?.sleep_debt?.debtHours > 3) factors.push(`${masterMetrics.sleep_debt.debtHours.toFixed(1)}h sleep debt accumulated`);

    if (factors.length > 0) {
      parts.push(`Nap Score ${score}. Contributing factors: ${factors.join(', ')}.`);
    } else {
      parts.push(`Nap Score ${score}. Clean signal today.`);
    }

    // Cognitive load narrative
    if (masterMetrics?.cognitive_load?.score > 60) {
      const cl = masterMetrics.cognitive_load;
      parts.push(`Cognitive load is ${cl.level} (${cl.score}/100) — this is driven by ${factors.slice(0, 2).join(' + ')}.`);
    }
  }

  // User identity
  if (userIntel?.summary) {
    parts.push(`\n=== WHO THIS PERSON IS ===`);
    parts.push(userIntel.summary);
  }

  return parts.join('\n');
}

// ─── Token budgets per trigger type ───────────────────────────
function getMaxTokens(triggerType: MessageMode): number {
  if (triggerType === 'morning_wag') return 300;
  if (triggerType === 'fetch_alert') return 200;
  return 600; // conversational gets more room
}

// ─── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  const startMs = Date.now();
  const traceId = crypto.randomUUID();

  try {
    const body = await req.json();
    const userId = body.user_id ?? DEMO_USER_ID;
    const triggerType: MessageMode = body.trigger_type ?? 'conversational';
    const question: string | null = body.question ?? null;
    const targetDate: string = body.date ?? new Date().toISOString().slice(0, 10);

    log('info', 'invocation_start', { traceId, userId, triggerType, date: targetDate, hasQuestion: !!question });

    // ─── Quality Gate 1: Emergency Check ────────────────────
    if (question) {
      const emergency = checkEmergency(question);
      if (emergency) {
        log('warn', 'emergency_detected', { traceId, question: question.slice(0, 50) });
        return new Response(JSON.stringify({
          message: emergency, zone: 'crisis', mode: triggerType,
          emergency: true, date: targetDate,
        }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    // ─── Fetch base context for narrative synthesis ──────────
    const [{ data: crs }, { data: health }, { data: calMetrics }, { data: emailMetrics },
      { data: taskMetrics }, { data: masterMetrics }, { data: stress }, { data: userIntel }] = await Promise.all([
      supabase.from('crs_scores').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('health_snapshots').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('calendar_metrics').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('email_metrics').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('task_metrics').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('master_metrics').select('*').eq('user_id', userId).eq('date', targetDate).maybeSingle(),
      supabase.from('stress_events').select('*').eq('user_id', userId).eq('date', targetDate),
      supabase.from('user_intelligence').select('summary').eq('user_id', userId).maybeSingle(),
    ]);

    const score = crs?.score ?? -1;
    const zone = getZone(score);

    // ─── Build system prompt (cached) ───────────────────────
    const systemPrompt = assembleSoulPrompt(zone, triggerType);

    // ─── Build initial context (narrative synthesis) ─────────
    const narrative = buildNarrativeContext(crs, health, calMetrics, emailMetrics, taskMetrics, masterMetrics, stress ?? [], userIntel);
    const userContent = question
      ? `${narrative}\n\nDate context: ${targetDate}\n\n---\nUser asks: ${question}\n\nUse the tools to investigate what you need. Don't guess — look it up.`
      : `${narrative}\n\nDate context: ${targetDate}\n\nGenerate the ${triggerType.replace('_', ' ')} for this day. Use tools if you need more detail.`;

    // ─── Tool definitions (per-trigger permissions) ──────────
    const tools = getToolDefinitions(triggerType);

    // ─── ReAct Loop (max 3 iterations) ───────────────────────
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userContent }];
    const toolsCalled: string[] = [];
    let iterations = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let finalMessage = '';

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations++;
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: getMaxTokens(triggerType),
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });

      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;

      // If Claude is done (no more tool calls)
      if (response.stop_reason === 'end_turn') {
        finalMessage = response.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');
        break;
      }

      // If Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            toolsCalled.push(block.name);
            log('info', 'tool_call', { traceId, tool: block.name, input: JSON.stringify(block.input).slice(0, 100), iteration: i + 1 });

            try {
              const result = await executeTool(block.name, block.input, userId, targetDate, supabase);
              // Compress large results
              const compressed = result.length > 800 ? result.slice(0, 800) + '... [truncated, call with specific date for full detail]' : result;
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: compressed });
            } catch (err) {
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${err instanceof Error ? err.message : String(err)}`, is_error: true });
            }
          }
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Fallback: extract any text from the response
      finalMessage = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      break;
    }

    // ─── Quality Gate 2: Output Validation ──────────────────
    finalMessage = validateOutput(finalMessage);
    if (!finalMessage) finalMessage = "I looked at your data but couldn't form a clear read. Ask me something specific.";

    const latencyMs = Date.now() - startMs;
    const costUsd = (totalTokensIn * 1 + totalTokensOut * 5) / 1_000_000;

    log('info', 'agent_complete', {
      traceId, zone, mode: triggerType, iterations,
      tools_called: toolsCalled, tokens_in: totalTokensIn, tokens_out: totalTokensOut,
      latency_ms: latencyMs, cost_usd: costUsd.toFixed(5),
    });

    // ─── Save conversation + trace ──────────────────────────
    const savePromises = [];
    if (question) {
      savePromises.push(supabase.from('conversation_history').insert({
        user_id: userId, role: 'user', content: question,
        mode: triggerType, channel: body.channel ?? 'api',
      }));
    }
    savePromises.push(supabase.from('conversation_history').insert({
      user_id: userId, role: 'waldo', content: finalMessage,
      mode: triggerType, channel: body.channel ?? 'api',
      metadata: { tokens_in: totalTokensIn, tokens_out: totalTokensOut, latency_ms: latencyMs, tools: toolsCalled, iterations },
    }));
    savePromises.push(supabase.from('agent_logs').insert({
      trace_id: traceId, user_id: userId, trigger_type: triggerType,
      tools_called: toolsCalled, iterations,
      total_tokens: totalTokensIn + totalTokensOut,
      latency_ms: latencyMs, delivery_status: 'sent',
      llm_fallback_level: 1, estimated_cost_usd: costUsd,
    }));
    await Promise.all(savePromises);

    return new Response(JSON.stringify({
      message: finalMessage, zone, mode: triggerType, date: targetDate,
      tokens_in: totalTokensIn, tokens_out: totalTokensOut, latency_ms: latencyMs,
      crs_score: score, iterations, tools_called: toolsCalled,
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    log('error', 'agent_error', { traceId, error: err instanceof Error ? err.message : String(err) });

    // ─── Fallback: template response ────────────────────────
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
      message: "I'm having trouble connecting right now. Your data is safe — I'll check in again soon.",
      zone: 'crisis', mode: 'conversational', fallback: true,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

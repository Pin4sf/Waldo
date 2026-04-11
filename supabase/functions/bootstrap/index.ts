/**
 * Waldo — bootstrap Edge Function
 *
 * ONE-TIME historical intelligence analysis run at onboarding.
 * Reads ALL available data (health, calendar, email, tasks, spots),
 * calls Claude to produce structured workspace files, then sends
 * them to the CF Worker DO for storage in R2.
 *
 * Produces:
 *   - profile.md      — compressed user identity + habits
 *   - baselines.md    — rolling baselines + trend directions
 *   - patterns.md     — cross-domain correlations discovered
 *   - constellation.md — relationship map between dimensions
 *   - bootstrap.jsonl  — raw analysis (archived)
 *
 * POST /bootstrap
 *   Body: { user_id: string, source?: string }
 *   → { status, files_written, spots_generated, latency_ms }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'bootstrap', level, event, ...data }));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Data compression helpers ────────────────────────────────────

function avg(arr: any[], key: string): number | null {
  const vals = arr.map(r => r[key]).filter((v: any) => v != null && typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
}

function summarizeHealthData(snapshots: any[]): string {
  if (snapshots.length === 0) return 'No health data available.';

  const days = snapshots.length;
  const sleepDays = snapshots.filter((s: any) => s.sleep_duration_hours != null);
  const hrvDays = snapshots.filter((s: any) => s.hrv_rmssd != null);
  const stepDays = snapshots.filter((s: any) => s.steps != null && s.steps > 0);

  const avgSleep = avg(sleepDays, 'sleep_duration_hours');
  const avgHrv = avg(hrvDays, 'hrv_rmssd');
  const avgSteps = avg(stepDays, 'steps');
  const avgRhr = avg(snapshots.filter((s: any) => s.resting_hr), 'resting_hr');

  // Find patterns in sleep
  const sleepByDow = new Map<number, number[]>();
  for (const s of sleepDays) {
    const dow = new Date(s.date).getDay();
    if (!sleepByDow.has(dow)) sleepByDow.set(dow, []);
    sleepByDow.get(dow)!.push(s.sleep_duration_hours);
  }

  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowAvgs = [...sleepByDow.entries()].map(([dow, vals]) => ({
    day: dowNames[dow]!,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));
  const bestSleepDay = dowAvgs.sort((a, b) => b.avg - a.avg)[0];
  const worstSleepDay = dowAvgs.sort((a, b) => a.avg - b.avg)[0];

  return [
    `${days} days of health data.`,
    avgSleep != null ? `Sleep: avg ${avgSleep.toFixed(1)}h/night (${sleepDays.length} nights tracked).` : 'No sleep data.',
    avgHrv != null ? `HRV: avg ${avgHrv.toFixed(0)}ms RMSSD (${hrvDays.length} readings).` : 'No HRV data.',
    avgSteps != null ? `Steps: avg ${Math.round(avgSteps!)}/day (${stepDays.length} days).` : 'No step data.',
    avgRhr != null ? `Resting HR: avg ${avgRhr.toFixed(0)} bpm.` : '',
    bestSleepDay ? `Best sleep day: ${bestSleepDay.day} (${bestSleepDay.avg.toFixed(1)}h avg).` : '',
    worstSleepDay ? `Worst sleep day: ${worstSleepDay.day} (${worstSleepDay.avg.toFixed(1)}h avg).` : '',
  ].filter(Boolean).join(' ');
}

function summarizeCrsData(scores: any[]): string {
  if (scores.length === 0) return 'No CRS/Form data.';
  const vals = scores.map((s: any) => s.score).filter((v: number) => v > 0);
  if (vals.length === 0) return 'No valid CRS scores.';

  const avgScore = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  const peakDays = scores.filter((s: any) => s.zone === 'peak').length;
  const lowDays = scores.filter((s: any) => s.zone === 'low').length;

  // Trend: compare last 7d vs previous 7d
  const recent7 = vals.slice(-7);
  const prev7 = vals.slice(-14, -7);
  const recentAvg = recent7.reduce((a: number, b: number) => a + b, 0) / (recent7.length || 1);
  const prevAvg = prev7.length > 0 ? prev7.reduce((a: number, b: number) => a + b, 0) / prev7.length : recentAvg;
  const trendDir = recentAvg > prevAvg + 3 ? 'improving' : recentAvg < prevAvg - 3 ? 'declining' : 'stable';

  return `CRS/Form: avg ${avgScore}, range ${Math.min(...vals)}-${Math.max(...vals)}. ${peakDays} peak days, ${lowDays} low days. Trend: ${trendDir}. ${vals.length} scored days.`;
}

function summarizeCalendar(metrics: any[]): string {
  if (metrics.length === 0) return 'No calendar data.';
  const avgLoad = avg(metrics, 'meeting_load_score');
  const avgEvents = avg(metrics, 'event_count');
  const totalB2b = metrics.reduce((s: number, m: any) => s + (m.back_to_back_count ?? 0), 0);
  return `Calendar: ${metrics.length} days. Avg ${avgEvents?.toFixed(1)} meetings/day, load ${avgLoad?.toFixed(1)}/15. ${totalB2b} back-to-back meetings total.`;
}

function summarizeEmail(metrics: any[]): string {
  if (metrics.length === 0) return 'No email data.';
  const avgVol = avg(metrics, 'total_emails');
  const avgAH = avg(metrics, 'after_hours_ratio');
  return `Email: ${metrics.length} days. Avg ${avgVol?.toFixed(0)} emails/day. After-hours ratio: ${((avgAH ?? 0) * 100).toFixed(0)}%.`;
}

function summarizeTasks(metrics: any[]): string {
  if (metrics.length === 0) return 'No task data.';
  const latestPending = metrics[0]?.pending_count ?? 0;
  const latestOverdue = metrics[0]?.overdue_count ?? 0;
  return `Tasks: ${latestPending} pending, ${latestOverdue} overdue.`;
}

function summarizeSpots(spots: any[]): string {
  if (spots.length === 0) return 'No observations yet.';
  const byType = new Map<string, number>();
  for (const s of spots) byType.set(s.category, (byType.get(s.category) ?? 0) + 1);
  const typeStr = [...byType.entries()].map(([t, c]) => `${t}: ${c}`).join(', ');
  return `${spots.length} observations. Breakdown: ${typeStr}.`;
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const startMs = Date.now();

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const userId = (body as any).user_id;
  if (!userId) return json({ error: 'user_id required' }, 400);

  log('info', 'bootstrap_start', { userId });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ─── Load ALL historical data ──────────────────────────────────
  const [
    { data: user },
    { data: healthSnapshots },
    { data: crsScores },
    { data: calMetrics },
    { data: emailMetrics },
    { data: taskMetrics },
    { data: spots },
    { data: patterns },
    { data: coreMemory },
    { data: moodMetrics },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('health_snapshots').select('*').eq('user_id', userId).order('date'),
    supabase.from('crs_scores').select('*').eq('user_id', userId).order('date'),
    supabase.from('calendar_metrics').select('*').eq('user_id', userId).order('date'),
    supabase.from('email_metrics').select('*').eq('user_id', userId).order('date'),
    supabase.from('task_metrics').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('spots').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100),
    supabase.from('patterns').select('*').eq('user_id', userId),
    supabase.from('core_memory').select('key, value').eq('user_id', userId),
    supabase.from('mood_metrics').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
  ]);

  if (!user) return json({ error: 'User not found' }, 404);

  const health = healthSnapshots ?? [];
  const crs = crsScores ?? [];
  const cal = calMetrics ?? [];
  const email = emailMetrics ?? [];
  const tasks = taskMetrics ?? [];
  const spotsList = spots ?? [];
  const patternsList = patterns ?? [];
  const memory = coreMemory ?? [];
  const mood = moodMetrics ?? [];

  // ─── Build compressed data summary for Claude ──────────────────

  const dataSummary = [
    summarizeHealthData(health),
    summarizeCrsData(crs),
    summarizeCalendar(cal),
    summarizeEmail(email),
    summarizeTasks(tasks),
    summarizeSpots(spotsList),
    mood.length > 0 ? `Mood: ${mood.length} days tracked. Latest: ${mood[0]?.dominant_mood ?? 'unknown'}.` : '',
    memory.length > 0 ? `Memory: ${memory.length} entries. Baselines: ${memory.filter((m: any) => m.key.includes('baseline')).map((m: any) => `${m.key}=${m.value}`).join(', ')}.` : '',
  ].filter(Boolean).join('\n');

  const connectedSources: string[] = ['Apple Health'];
  if (cal.length > 0) connectedSources.push('Google Calendar');
  if (email.length > 0) connectedSources.push('Gmail');
  if (tasks.length > 0) connectedSources.push('Google Tasks');
  if (mood.length > 0) connectedSources.push(mood[0]?.provider === 'spotify' ? 'Spotify' : 'YouTube Music');

  log('info', 'data_loaded', {
    userId,
    healthDays: health.length,
    crsDays: crs.length,
    calDays: cal.length,
    emailDays: email.length,
    spots: spotsList.length,
    patterns: patternsList.length,
  });

  // ─── Call Claude to produce workspace files ────────────────────

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

  const bootstrapPrompt = `You are Waldo's intelligence bootstrap system. Analyze this user's historical data and produce structured workspace files.

USER: ${user.name} (${user.timezone}, wakes ~${user.wake_time_estimate ?? '07:00'}, wearable: ${user.wearable_type ?? 'unknown'})

HISTORICAL DATA SUMMARY:
${dataSummary}

${patternsList.length > 0 ? `DETECTED PATTERNS:\n${patternsList.map((p: any) => `- [${p.type}] ${p.summary} (${p.evidence_count} evidence, ${(p.confidence * 100).toFixed(0)}% confidence)`).join('\n')}` : ''}

${spotsList.length > 0 ? `RECENT OBSERVATIONS (last ${Math.min(spotsList.length, 20)}):\n${spotsList.slice(0, 20).map((s: any) => `- [${s.date}] ${s.category}: ${s.observation}`).join('\n')}` : ''}

Produce exactly 4 sections in this format. Be specific and data-driven. Use the actual numbers from the data above. Keep each section concise.

===PROFILE===
Write a compressed user profile (~200 tokens). Include: identity, chronotype evidence, device, data coverage, top 3-5 insights about this specific person. Format as markdown with bullets.

===BASELINES===
Write current baselines with trend directions (~150 tokens). Include: sleep avg, HRV avg, resting HR, steps avg, CRS avg, meeting load avg, email volume. For each, note if trending up/down/stable based on recent vs historical. Format as markdown list.

===PATTERNS===
Write detected patterns and cross-domain correlations (~300 tokens). If no patterns exist yet, note what data is available and what patterns COULD emerge with more data. Be specific about the numbers. Format as markdown with headers per pattern.

===CONSTELLATION===
Write a cross-domain connection map. Link health metrics to productivity/communication/tasks. Example: "High meeting days → HRV drops 15% next morning". Only include connections supported by data. If insufficient data, note what connections to watch for.`;

  let profileMd = '';
  let baselinesMd = '';
  let patternsMd = '';
  let constellationMd = '';

  try {
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: bootstrapPrompt }],
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      log('error', 'llm_failed', { status: llmRes.status, error: err });
      return json({ error: `LLM call failed: ${llmRes.status}` }, 500);
    }

    const llmData = await llmRes.json() as { content: Array<{ text: string }> };
    const fullText = llmData.content[0]?.text ?? '';

    // Parse sections
    const sections = fullText.split(/===(\w+)===/);
    for (let i = 1; i < sections.length; i += 2) {
      const sectionName = sections[i]?.trim().toUpperCase();
      const sectionContent = sections[i + 1]?.trim() ?? '';
      if (sectionName === 'PROFILE') profileMd = sectionContent;
      else if (sectionName === 'BASELINES') baselinesMd = sectionContent;
      else if (sectionName === 'PATTERNS') patternsMd = sectionContent;
      else if (sectionName === 'CONSTELLATION') constellationMd = sectionContent;
    }

    log('info', 'llm_analysis_complete', {
      profileLen: profileMd.length,
      baselinesLen: baselinesMd.length,
      patternsLen: patternsMd.length,
      constellationLen: constellationMd.length,
      inputTokens: (llmData as any).usage?.input_tokens,
      outputTokens: (llmData as any).usage?.output_tokens,
    });

  } catch (err) {
    log('error', 'llm_error', { error: String(err) });
    // Fallback: generate from data without LLM
    profileMd = [
      `# ${user.name}`,
      `- Timezone: ${user.timezone}`,
      `- Wearable: ${user.wearable_type ?? 'unknown'}`,
      `- Data: ${health.length} days observed`,
      `- Sources: ${connectedSources.join(', ')}`,
    ].join('\n');
    baselinesMd = memory.map((m: any) => `- **${m.key}**: ${m.value}`).join('\n') || 'No baselines yet.';
    patternsMd = patternsList.length > 0
      ? patternsList.map((p: any) => `- ${p.type}: ${p.summary}`).join('\n')
      : 'No patterns detected yet.';
    constellationMd = 'Insufficient cross-domain data for connections yet.';
  }

  // ─── Write workspace files via CF Worker DO ────────────────────

  const WALDO_WORKER_URL = Deno.env.get('WALDO_WORKER_URL') ?? '';
  const WALDO_WORKER_SECRET = Deno.env.get('WALDO_WORKER_SECRET') ?? '';

  const filesWritten: string[] = [];

  // Write files to DO (which stores them in R2)
  if (WALDO_WORKER_URL) {
    const writeFile = async (filename: string, content: string) => {
      try {
        await fetch(`${WALDO_WORKER_URL}/workspace/${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-waldo-secret': WALDO_WORKER_SECRET,
          },
          body: JSON.stringify({ file: filename, content }),
        });
        filesWritten.push(filename);
      } catch (err) {
        log('warn', 'workspace_write_failed', { filename, error: String(err) });
      }
    };

    await Promise.all([
      writeFile('profile.md', profileMd),
      writeFile('baselines.md', baselinesMd),
      writeFile('patterns.md', patternsMd),
      writeFile('constellation.md', constellationMd),
      writeFile('bootstrap.jsonl', JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        source: (body as any).source ?? 'manual',
        healthDays: health.length,
        crsDays: crs.length,
        calDays: cal.length,
        emailDays: email.length,
        spots: spotsList.length,
        patterns: patternsList.length,
        connectedSources,
      })),
    ]);
  }

  // ─── Also update user_intelligence in Supabase ─────────────────

  const intelligenceSummary = [
    profileMd.slice(0, 500),
    '',
    '## Baselines',
    baselinesMd.slice(0, 300),
    '',
    '## Patterns',
    patternsMd.slice(0, 300),
  ].join('\n');

  await supabase.from('user_intelligence').upsert({
    user_id: userId,
    summary: intelligenceSummary,
    baselines: memory.map((m: any) => ({ key: m.key, value: m.value })),
    crs_patterns: {
      avg: avg(crs.map((c: any) => c.score).filter((s: number) => s > 0).map(s => ({ s })), 's'),
      days: crs.length,
    },
    sleep_patterns: { avg_7d: avg(health.slice(-7), 'sleep_duration_hours') },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // ─── Also trigger build-intelligence for spots if needed ───────

  let spotsGenerated = 0;
  if (spotsList.length === 0 && health.length > 0) {
    try {
      const biRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/build-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ user_id: userId, source: 'bootstrap' }),
      });
      const biData = await biRes.json() as { spots_generated?: number };
      spotsGenerated = biData.spots_generated ?? 0;
    } catch { /* fire and forget */ }
  }

  const latencyMs = Date.now() - startMs;
  log('info', 'bootstrap_complete', {
    userId,
    filesWritten,
    spotsGenerated,
    latency_ms: latencyMs,
  });

  return json({
    status: 'ok',
    user: user.name,
    files_written: filesWritten,
    spots_generated: spotsGenerated,
    data_summary: {
      health_days: health.length,
      crs_days: crs.length,
      calendar_days: cal.length,
      email_days: email.length,
      task_days: tasks.length,
      spots: spotsList.length + spotsGenerated,
      patterns: patternsList.length,
      connected_sources: connectedSources,
    },
    latency_ms: latencyMs,
  });
});

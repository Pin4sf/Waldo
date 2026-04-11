/**
 * Waldo — bootstrap Edge Function
 *
 * ONE-TIME onboarding intelligence run. Does TWO things:
 *   1. GATHER: Pulls historical Google data (30 days calendar, 30 days email, all tasks)
 *      directly from Google APIs — not relying on sync functions
 *   2. ANALYZE: Reads ALL data from Supabase, calls Claude to produce workspace files
 *
 * Also triggers build-intelligence for spots/baselines if needed.
 * Writes workspace files to R2 via CF Worker DO.
 *
 * POST /bootstrap
 *   Body: { user_id: string, source?: string }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, googleFetch, recordSync } from '../_shared/google-auth.ts';

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
    status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function avg(arr: any[], key: string): number | null {
  const vals = arr.map(r => r[key]).filter((v: any) => v != null && typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
}

// ─── PHASE 1: Pull historical Google data ────────────────────────

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GMAIL_API = 'https://www.googleapis.com/gmail/v1';
const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
const LOOKBACK_DAYS = 30;

async function pullHistoricalCalendar(
  supabase: ReturnType<typeof createClient>, userId: string, token: string, timezone: string,
): Promise<number> {
  const timeMin = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 7 * 86400000).toISOString();

  const result = await googleFetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, token, {
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
    fields: 'items(id,summary,start,end,attendees,recurrence,status)',
  });
  if (!result.ok) { log('warn', 'calendar_pull_failed', { status: result.status }); return 0; }

  const events = ((result.data as any)?.items ?? []).filter((e: any) => e.status !== 'cancelled');
  if (events.length === 0) return 0;

  // Group by date and compute metrics
  const byDate = new Map<string, any[]>();
  for (const e of events) {
    const start = e.start?.dateTime ?? e.start?.date;
    if (!start) continue;
    const date = start.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(e);
  }

  const rows: any[] = [];
  for (const [date, dayEvents] of byDate) {
    let totalMin = 0, b2b = 0, violations = 0;
    const sorted = dayEvents.sort((a: any, b: any) => (a.start?.dateTime ?? '').localeCompare(b.start?.dateTime ?? ''));

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const startDt = e.start?.dateTime;
      const endDt = e.end?.dateTime;
      if (!startDt || !endDt) continue;
      const durMin = (new Date(endDt).getTime() - new Date(startDt).getTime()) / 60000;
      totalMin += durMin;
      const hour = new Date(startDt).getHours();
      if (hour < 7 || hour >= 19) violations++;
      if (i > 0) {
        const prevEnd = sorted[i-1]?.end?.dateTime;
        if (prevEnd && new Date(startDt).getTime() - new Date(prevEnd).getTime() < 15 * 60000) b2b++;
      }
    }

    const attendees = dayEvents.reduce((s: number, e: any) => s + (e.attendees?.length ?? 1), 0);
    const mls = Math.min(15, (totalMin / 60) * 2.5 + b2b * 1.5 + (attendees > 5 ? 2 : 0));

    rows.push({
      user_id: userId, date,
      meeting_load_score: Math.round(mls * 10) / 10,
      total_meeting_minutes: Math.round(totalMin),
      event_count: dayEvents.length,
      back_to_back_count: b2b,
      boundary_violations: violations,
      focus_gaps: [],
    });
  }

  if (rows.length > 0) {
    await supabase.from('calendar_metrics').upsert(rows, { onConflict: 'user_id,date' });
  }
  await recordSync(supabase, userId, 'google_calendar', 'ok', rows.length);
  log('info', 'calendar_historical_pulled', { userId, days: rows.length, events: events.length });
  return rows.length;
}

async function pullHistoricalGmail(
  supabase: ReturnType<typeof createClient>, userId: string, token: string, timezone: string,
): Promise<number> {
  const after = Math.floor((Date.now() - LOOKBACK_DAYS * 86400000) / 1000);

  const listResult = await googleFetch(`${GMAIL_API}/users/me/messages`, token, {
    q: `after:${after}`, maxResults: '500', fields: 'messages(id)',
  });
  if (!listResult.ok) { log('warn', 'gmail_pull_failed', { status: listResult.status }); return 0; }

  const messageIds: string[] = ((listResult.data as any)?.messages ?? []).map((m: any) => m.id);
  if (messageIds.length === 0) return 0;

  // Fetch metadata in batches (NO body, NO subject, NO sender — privacy rules)
  const metadataByDay = new Map<string, Array<{ timestampMs: number; labelIds: string[] }>>();

  for (let i = 0; i < Math.min(messageIds.length, 300); i += 50) {
    const batch = messageIds.slice(i, i + 50);
    await Promise.allSettled(batch.map(async (id) => {
      const r = await googleFetch(`${GMAIL_API}/users/me/messages/${id}`, token, {
        format: 'metadata', fields: 'internalDate,labelIds',
      });
      if (!r.ok) return;
      const msg = r.data as { internalDate?: string; labelIds?: string[] };
      const ts = parseInt(msg.internalDate ?? '0', 10);
      if (ts === 0) return;
      const dateKey = new Date(ts).toISOString().slice(0, 10);
      if (!metadataByDay.has(dateKey)) metadataByDay.set(dateKey, []);
      metadataByDay.get(dateKey)!.push({ timestampMs: ts, labelIds: msg.labelIds ?? [] });
    }));
  }

  const rows: any[] = [];
  for (const [date, messages] of metadataByDay) {
    const total = messages.length;
    const sent = messages.filter(m => m.labelIds.includes('SENT')).length;
    const afterHours = messages.filter(m => {
      const h = new Date(m.timestampMs).getHours(); // UTC, close enough for aggregate
      return h >= 19 || h < 7;
    }).length;

    rows.push({
      user_id: userId, date,
      total_emails: total, sent_count: sent,
      received_count: total - sent,
      after_hours_count: afterHours,
      after_hours_ratio: total > 0 ? Math.round((afterHours / total) * 100) / 100 : 0,
    });
  }

  if (rows.length > 0) {
    await supabase.from('email_metrics').upsert(rows, { onConflict: 'user_id,date' });
  }
  await recordSync(supabase, userId, 'gmail', 'ok', rows.length);
  log('info', 'gmail_historical_pulled', { userId, days: rows.length, messages: messageIds.length });
  return rows.length;
}

async function pullHistoricalTasks(
  supabase: ReturnType<typeof createClient>, userId: string, token: string,
): Promise<number> {
  // Get all task lists
  const listResult = await googleFetch(`${TASKS_API}/users/@me/lists`, token, { maxResults: '100' });
  if (!listResult.ok) return 0;

  const taskLists = ((listResult.data as any)?.items ?? []) as Array<{ id: string }>;
  let pending = 0, overdue = 0, completed = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const list of taskLists.slice(0, 5)) {
    const tasksResult = await googleFetch(`${TASKS_API}/lists/${list.id}/tasks`, token, {
      maxResults: '100', showCompleted: 'true', showHidden: 'true',
    });
    if (!tasksResult.ok) continue;
    const tasks = ((tasksResult.data as any)?.items ?? []) as any[];
    for (const t of tasks) {
      if (t.status === 'completed') { completed++; continue; }
      pending++;
      if (t.due && t.due.slice(0, 10) < today) overdue++;
    }
  }

  const row = {
    user_id: userId, date: today,
    pending_count: pending, overdue_count: overdue,
    completed_today: completed,
  };
  await supabase.from('task_metrics').upsert(row, { onConflict: 'user_id,date' });
  await recordSync(supabase, userId, 'google_tasks', 'ok', pending + completed);
  log('info', 'tasks_historical_pulled', { userId, pending, overdue, completed });
  return pending + completed;
}

// ─── PHASE 2: Summarize + Claude analysis ────────────────────────

function summarizeHealth(health: any[]): string {
  if (health.length === 0) return 'No health data.';
  const sleepDays = health.filter((h: any) => h.sleep_duration_hours);
  const avgSleep = sleepDays.length > 0 ? sleepDays.reduce((s: number, h: any) => s + h.sleep_duration_hours, 0) / sleepDays.length : null;
  const hrvDays = health.filter((h: any) => h.hrv_rmssd);
  const avgHrv = hrvDays.length > 0 ? hrvDays.reduce((s: number, h: any) => s + h.hrv_rmssd, 0) / hrvDays.length : null;
  const avgSteps = avg(health.filter((h: any) => h.steps > 0), 'steps');
  const avgRhr = avg(health.filter((h: any) => h.resting_hr), 'resting_hr');

  return [
    `${health.length} days of health data.`,
    avgSleep != null ? `Sleep: avg ${avgSleep.toFixed(1)}h/night (${sleepDays.length} nights).` : '',
    avgHrv != null ? `HRV: avg ${avgHrv.toFixed(0)}ms (${hrvDays.length} readings).` : '',
    avgSteps != null ? `Steps: avg ${Math.round(avgSteps)}/day.` : '',
    avgRhr != null ? `Resting HR: avg ${avgRhr.toFixed(0)}bpm.` : '',
  ].filter(Boolean).join(' ');
}

function summarizeCrs(crs: any[]): string {
  const vals = crs.map((c: any) => c.score).filter((s: number) => s > 0);
  if (vals.length === 0) return 'No CRS data.';
  const a = Math.round(vals.reduce((x: number, y: number) => x + y, 0) / vals.length);
  const peak = crs.filter((c: any) => c.zone === 'peak').length;
  const low = crs.filter((c: any) => c.zone === 'low').length;
  return `CRS avg ${a}, range ${Math.min(...vals)}-${Math.max(...vals)}. ${peak} peak, ${low} low days. ${vals.length} scored.`;
}

function summarizeCal(cal: any[]): string {
  if (cal.length === 0) return 'No calendar data.';
  const avgLoad = avg(cal, 'meeting_load_score');
  const avgEvents = avg(cal, 'event_count');
  return `Calendar: ${cal.length} days synced. Avg ${avgEvents?.toFixed(1)} meetings/day, load ${avgLoad?.toFixed(1)}/15.`;
}

function summarizeEmail(email: any[]): string {
  if (email.length === 0) return 'No email data.';
  const avgVol = avg(email, 'total_emails');
  const avgAH = avg(email, 'after_hours_ratio');
  return `Email: ${email.length} days. Avg ${avgVol?.toFixed(0)}/day. After-hours: ${((avgAH ?? 0) * 100).toFixed(0)}%.`;
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

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (!user) return json({ error: 'User not found' }, 404);

  // ═══ PHASE 1: GATHER — Pull historical Google data ═════════════
  const gathered: Record<string, number> = {};

  const token = await getValidGoogleToken(supabase, userId);
  if (token) {
    log('info', 'pulling_google_history', { userId, lookbackDays: LOOKBACK_DAYS });
    const [calDays, emailDays, taskCount] = await Promise.all([
      pullHistoricalCalendar(supabase, userId, token, user.timezone ?? 'UTC'),
      pullHistoricalGmail(supabase, userId, token, user.timezone ?? 'UTC'),
      pullHistoricalTasks(supabase, userId, token),
    ]);
    gathered.calendar_days = calDays;
    gathered.email_days = emailDays;
    gathered.tasks = taskCount;
    log('info', 'google_history_gathered', { userId, ...gathered });
  } else {
    log('info', 'no_google_token', { userId });
  }

  // ═══ PHASE 1b: Generate spots + baselines if needed ════════════
  let spotsGenerated = 0;
  const { count: existingSpots } = await supabase
    .from('spots').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if ((existingSpots ?? 0) === 0) {
    try {
      const biRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/build-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ user_id: userId, source: 'bootstrap' }),
      });
      const biData = await biRes.json() as { spots_generated?: number };
      spotsGenerated = biData.spots_generated ?? 0;
    } catch { /* continue */ }
  }

  // ═══ PHASE 2: READ — Load all data from Supabase ═══════════════
  const [
    { data: health }, { data: crs }, { data: cal }, { data: email },
    { data: tasks }, { data: spots }, { data: patterns }, { data: memory }, { data: mood },
  ] = await Promise.all([
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

  const connectedSources: string[] = [];
  if ((health ?? []).length > 0) connectedSources.push('Apple Health');
  if ((cal ?? []).length > 0) connectedSources.push('Google Calendar');
  if ((email ?? []).length > 0) connectedSources.push('Gmail');
  if ((tasks ?? []).length > 0) connectedSources.push('Google Tasks');
  if ((mood ?? []).length > 0) connectedSources.push(mood![0]?.provider === 'spotify' ? 'Spotify' : 'YouTube Music');

  const dataSummary = [
    summarizeHealth(health ?? []),
    summarizeCrs(crs ?? []),
    summarizeCal(cal ?? []),
    summarizeEmail(email ?? []),
    (tasks ?? []).length > 0 ? `Tasks: ${tasks![0]?.pending_count ?? 0} pending, ${tasks![0]?.overdue_count ?? 0} overdue.` : '',
    (spots ?? []).length > 0 ? `${(spots ?? []).length} observations generated.` : '',
    (mood ?? []).length > 0 ? `Mood: ${(mood ?? []).length} days. Latest: ${mood![0]?.dominant_mood ?? 'unknown'}.` : '',
    (memory ?? []).length > 0 ? `Baselines: ${(memory ?? []).filter((m: any) => m.key.includes('baseline') || m.key.includes('avg')).map((m: any) => `${m.key}=${m.value}`).join(', ')}` : '',
    (patterns ?? []).length > 0 ? `Patterns: ${(patterns ?? []).map((p: any) => p.summary).join('; ')}` : '',
  ].filter(Boolean).join('\n');

  log('info', 'data_loaded', {
    userId, health: (health ?? []).length, crs: (crs ?? []).length,
    cal: (cal ?? []).length, email: (email ?? []).length, spots: (spots ?? []).length,
  });

  // ═══ PHASE 3: ANALYZE — Claude produces workspace files ════════

  let profileMd = '', baselinesMd = '', patternsMd = '', constellationMd = '';

  try {
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: `You are Waldo's intelligence bootstrap system. Analyze this user's complete historical data and produce structured workspace files.

USER: ${user.name} (${user.timezone}, wakes ~${user.wake_time_estimate ?? '07:00'}, wearable: ${user.wearable_type ?? 'unknown'})
CONNECTED SOURCES: ${connectedSources.join(', ')}

ALL HISTORICAL DATA:
${dataSummary}

${(spots ?? []).length > 0 ? `RECENT OBSERVATIONS:\n${(spots ?? []).slice(0, 15).map((s: any) => `- [${s.date}] ${s.type}: ${s.title}`).join('\n')}` : ''}

Produce exactly 4 sections. Be specific — use actual numbers from the data. Keep each section concise.

===PROFILE===
User profile (~200 tokens). Identity, chronotype evidence, data coverage, top 5 insights. Markdown bullets.

===BASELINES===
Current baselines with trend directions (~150 tokens). Sleep, HRV, HR, steps, CRS, meeting load, email volume. Note up/down/stable.

===PATTERNS===
Patterns and cross-domain correlations (~300 tokens). Link health to schedule/communication/tasks. If data is thin, note what patterns to WATCH FOR.

===CONSTELLATION===
Cross-domain connection map. Health ↔ productivity ↔ communication. Only connections supported by data.` }],
      }),
    });

    if (llmRes.ok) {
      const llmData = await llmRes.json() as { content: Array<{ text: string }>; usage?: any };
      const fullText = llmData.content[0]?.text ?? '';
      const sections = fullText.split(/===(\w+)===/);
      for (let i = 1; i < sections.length; i += 2) {
        const name = sections[i]?.trim().toUpperCase();
        const content = sections[i + 1]?.trim() ?? '';
        if (name === 'PROFILE') profileMd = content;
        else if (name === 'BASELINES') baselinesMd = content;
        else if (name === 'PATTERNS') patternsMd = content;
        else if (name === 'CONSTELLATION') constellationMd = content;
      }
      log('info', 'llm_complete', { tokens_in: llmData.usage?.input_tokens, tokens_out: llmData.usage?.output_tokens });
    }
  } catch (err) {
    log('error', 'llm_failed', { error: String(err) });
    // Fallback without LLM
    profileMd = `# ${user.name}\n- ${connectedSources.join(', ')}\n- ${(health ?? []).length} days health data`;
    baselinesMd = (memory ?? []).map((m: any) => `- ${m.key}: ${m.value}`).join('\n') || 'No baselines.';
    patternsMd = 'Insufficient data for patterns yet.';
    constellationMd = 'Insufficient cross-domain data for connections.';
  }

  // ═══ PHASE 4: STORE — Write workspace files to R2 via DO ═══════

  const WALDO_WORKER_URL = Deno.env.get('WALDO_WORKER_URL') ?? '';
  const WALDO_WORKER_SECRET = Deno.env.get('WALDO_WORKER_SECRET') ?? '';
  const filesWritten: string[] = [];

  if (WALDO_WORKER_URL && WALDO_WORKER_SECRET) {
    const writeFile = async (filename: string, content: string) => {
      try {
        const res = await fetch(`${WALDO_WORKER_URL}/workspace/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-waldo-secret': WALDO_WORKER_SECRET },
          body: JSON.stringify({ file: filename, content }),
        });
        if (res.ok) filesWritten.push(filename);
        else log('warn', 'workspace_write_failed', { filename, status: res.status });
      } catch (err) { log('warn', 'workspace_write_error', { filename, error: String(err) }); }
    };

    await Promise.all([
      writeFile('profile.md', profileMd),
      writeFile('baselines.md', baselinesMd),
      writeFile('patterns.md', patternsMd),
      writeFile('constellation.md', constellationMd),
      writeFile('bootstrap.jsonl', JSON.stringify({
        timestamp: new Date().toISOString(), userId,
        source: (body as any).source ?? 'manual',
        healthDays: (health ?? []).length, crsDays: (crs ?? []).length,
        calDays: (cal ?? []).length, emailDays: (email ?? []).length,
        spots: (spots ?? []).length, connectedSources,
        gathered,
      })),
    ]);
  } else {
    log('warn', 'no_worker_config', { hasUrl: !!WALDO_WORKER_URL, hasSecret: !!WALDO_WORKER_SECRET });
  }

  // Update user_intelligence in Supabase
  await supabase.from('user_intelligence').upsert({
    user_id: userId,
    summary: [profileMd.slice(0, 500), '\n## Baselines\n', baselinesMd.slice(0, 300), '\n## Patterns\n', patternsMd.slice(0, 300)].join(''),
    baselines: (memory ?? []).map((m: any) => ({ key: m.key, value: m.value })),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  const latencyMs = Date.now() - startMs;
  log('info', 'bootstrap_complete', { userId, filesWritten, spotsGenerated, gathered, latency_ms: latencyMs });

  return json({
    status: 'ok',
    user: user.name,
    files_written: filesWritten,
    spots_generated: spotsGenerated,
    google_data_gathered: gathered,
    data_summary: {
      health_days: (health ?? []).length, crs_days: (crs ?? []).length,
      calendar_days: (cal ?? []).length, email_days: (email ?? []).length,
      task_count: (tasks ?? []).length > 0 ? (tasks![0]?.pending_count ?? 0) + (tasks![0]?.completed_today ?? 0) : 0,
      spots: (spots ?? []).length + spotsGenerated,
      connected_sources: connectedSources,
    },
    latency_ms: latencyMs,
  });
});

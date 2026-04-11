/**
 * Waldo — sync-rescuetime Edge Function
 *
 * Runs nightly at 3:00 AM UTC (pg_cron). Syncs RescueTime data for users
 * who have stored their API key in core_memory (key='rescuetime_api_key').
 *
 * No OAuth needed — RescueTime uses a simple API key per user.
 * Computes: productive hours, distracted hours, productivity score, late-night screen.
 * Writes to: screen_time_metrics table.
 *
 * RescueTime API: https://www.rescuetime.com/apidoc
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESCUETIME_API = 'https://www.rescuetime.com/anapi/data';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-rescuetime', level, event, ...data }));
}

interface RescueTimeRow {
  Date: string;
  'Time Spent (seconds)': number;
  'Number of People': number;
  'Productivity': number; // -2 to 2 (very distracting to very productive)
  'Category': string;
}

async function syncUserRescueTime(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Fetch yesterday's data (complete day)
  const params = new URLSearchParams({
    key: apiKey,
    format: 'json',
    perspective: 'interval',
    restrict_kind: 'productivity',
    restrict_begin: yesterday,
    restrict_end: yesterday,
    resolution_time: 'day',
  });

  const resp = await fetch(`${RESCUETIME_API}?${params}`);
  if (!resp.ok) {
    log('error', 'api_failed', { userId, status: resp.status });
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'rescuetime',
      last_sync_status: 'error', last_error: `HTTP ${resp.status}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, error: `HTTP ${resp.status}` };
  }

  const data = await resp.json() as { rows: number[][]; row_headers: string[] };
  const rows = data.rows ?? [];

  if (rows.length === 0) {
    log('info', 'no_data', { userId, date: yesterday });
    return { ok: true };
  }

  // RescueTime productivity levels:
  //  2 = Very Productive, 1 = Productive, 0 = Neutral, -1 = Distracting, -2 = Very Distracting
  let productiveSecs = 0;
  let distractedSecs = 0;
  let neutralSecs = 0;
  let topCategory = '';
  let topCategorySecs = 0;

  for (const row of rows) {
    const secs = row[1] ?? 0;      // Time Spent (seconds)
    const prod = row[3] ?? 0;       // Productivity level
    // row[4] is unused (number of people)

    if (prod >= 1) productiveSecs += secs;
    else if (prod <= -1) distractedSecs += secs;
    else neutralSecs += secs;

    // Track top category (row[3] is productivity, but we need the category)
    // In the 'productivity' view, categories aren't directly available
    // We track by productivity level instead
  }

  const totalSecs = productiveSecs + distractedSecs + neutralSecs;
  const productiveHours = +(productiveSecs / 3600).toFixed(2);
  const distractedHours = +(distractedSecs / 3600).toFixed(2);
  const neutralHours = +(neutralSecs / 3600).toFixed(2);
  const totalHours = +(totalSecs / 3600).toFixed(2);
  const productivityScore = totalSecs > 0 ? +((productiveSecs / totalSecs) * 100).toFixed(1) : 0;

  // Check for late-night activity (fetch hourly data)
  let lateNight = false;
  try {
    const hourlyParams = new URLSearchParams({
      key: apiKey,
      format: 'json',
      perspective: 'interval',
      restrict_kind: 'productivity',
      restrict_begin: yesterday,
      restrict_end: yesterday,
      resolution_time: 'hour',
    });
    const hourlyResp = await fetch(`${RESCUETIME_API}?${hourlyParams}`);
    if (hourlyResp.ok) {
      const hourlyData = await hourlyResp.json() as { rows: (string | number)[][] };
      for (const row of hourlyData.rows ?? []) {
        const dateStr = String(row[0] ?? '');
        const hour = parseInt(dateStr.split('T')[1]?.split(':')[0] ?? '0');
        if (hour >= 22 || hour < 5) {
          const secs = Number(row[1] ?? 0);
          if (secs > 300) { // More than 5 min of late-night activity
            lateNight = true;
            break;
          }
        }
      }
    }
  } catch {
    // Non-critical — late-night detection is optional
  }

  // Upsert screen_time_metrics
  await supabase.from('screen_time_metrics').upsert({
    user_id: userId,
    date: yesterday,
    provider: 'rescuetime',
    productive_hours: productiveHours,
    distracted_hours: distractedHours,
    neutral_hours: neutralHours,
    total_hours: totalHours,
    productivity_score: productivityScore,
    late_night_screen: lateNight,
    raw_summary: { rows: rows.length, productiveSecs, distractedSecs, neutralSecs },
  }, { onConflict: 'user_id,date,provider' });

  // Record sync
  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'rescuetime',
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced: rows.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('info', 'sync_complete', { userId, date: yesterday, productiveHours, distractedHours, productivityScore });
  return { ok: true };
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Check if specific user requested
  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    targetUserId = (body['user_id'] as string) ?? null;
  } catch { /* no body */ }

  // Get users with RescueTime API key stored in core_memory
  let query = supabase
    .from('core_memory')
    .select('user_id, value')
    .eq('key', 'rescuetime_api_key');

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data: apiKeyRows } = await query;
  if (!apiKeyRows || apiKeyRows.length === 0) {
    log('info', 'no_rescuetime_users');
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  log('info', 'sync_start', { users: apiKeyRows.length });

  let synced = 0;
  let errors = 0;

  for (const row of apiKeyRows.slice(0, 10)) {
    const result = await syncUserRescueTime(supabase, row.user_id, row.value);
    if (result.ok) synced++;
    else errors++;
  }

  log('info', 'sync_batch_complete', { synced, errors });
  return new Response(JSON.stringify({ synced, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

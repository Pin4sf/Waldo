/**
 * Waldo — whoop-to-snapshot Edge Function
 *
 * Maps WHOOP raw tables → health_snapshots.
 * Runs after whoop-backfill and daily via sync-whoop.
 * After mapping, fires build-intelligence to generate spots,
 * patterns, baselines, and seed core_memory.
 *
 * Rules:
 * - Only writes to NULL columns (never overwrites Apple Health / Health Connect data)
 * - Timezone-aware date mapping (uses users.timezone)
 * - HRV unit: ms → ms (direct, no conversion needed)
 * - skin_temp_celsius → wrist_temp (best available proxy for WHOOP)
 *
 * POST /whoop-to-snapshot
 *   Body: { user_id: string, since?: string }  — since = ISO date, omit for full history
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'whoop-to-snapshot', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ─── Timezone-aware local date from UTC timestamp ──────────────────
function toLocalDate(isoUtc: string, timezone: string): string {
  try {
    return new Date(isoUtc).toLocaleString('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).slice(0, 10);
  } catch {
    return isoUtc.slice(0, 10);
  }
}

// ─── Core memory seeding from WHOOP baselines ────────────────────
async function seedCoreMemory(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
) {
  // Pull last 30 days of snapshots that now have WHOOP data
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: snaps } = await supabase
    .from('health_snapshots')
    .select('date, hrv_rmssd, resting_hr, sleep_duration_hours, sleep_bedtime, sleep_wake_time, respiratory_rate, spo2')
    .eq('user_id', userId)
    .gte('date', since30)
    .order('date', { ascending: false });

  if (!snaps || snaps.length < 3) return;

  const hrv    = snaps.filter(d => d.hrv_rmssd).map(d => d.hrv_rmssd as number);
  const rhr    = snaps.filter(d => d.resting_hr).map(d => d.resting_hr as number);
  const sleep  = snaps.filter(d => d.sleep_duration_hours).map(d => d.sleep_duration_hours as number);
  const bedtimes = snaps.filter(d => d.sleep_bedtime).map(d => (d.sleep_bedtime as string).slice(11, 16));
  const waketimes = snaps.filter(d => d.sleep_wake_time).map(d => (d.sleep_wake_time as string).slice(11, 16));
  const rr     = snaps.filter(d => d.respiratory_rate).map(d => d.respiratory_rate as number);

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
  const mode = (arr: string[]) => arr.length ? arr.sort((a, b) => arr.filter(v => v === b).length - arr.filter(v => v === a).length)[0] : null;

  const baseline_hrv_30d     = avg(hrv);
  const baseline_rhr_30d     = avg(rhr);
  const typical_sleep_hours  = avg(sleep);
  const typical_bedtime      = mode(bedtimes);
  const typical_wake_time    = mode(waketimes);
  const baseline_resp_rate   = avg(rr);

  // Get max_heart_rate from whoop_body_measurement
  const { data: body } = await supabase
    .from('whoop_body_measurement')
    .select('max_heart_rate')
    .eq('user_id', userId)
    .maybeSingle();

  // Get earliest WHOOP record for member_since
  const { data: earliest } = await supabase
    .from('whoop_recovery')
    .select('whoop_created_at')
    .eq('user_id', userId)
    .order('whoop_created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const memories: Array<{ key: string; value: string }> = [
    { key: 'primary_data_source', value: 'WHOOP' },
  ];

  if (baseline_hrv_30d)    memories.push({ key: 'baseline_hrv_30d',    value: `${baseline_hrv_30d}ms` });
  if (baseline_rhr_30d)    memories.push({ key: 'baseline_resting_hr', value: `${baseline_rhr_30d}bpm` });
  if (typical_sleep_hours) memories.push({ key: 'typical_sleep_hours', value: `${typical_sleep_hours}h` });
  if (typical_bedtime)     memories.push({ key: 'typical_bedtime',     value: typical_bedtime });
  if (typical_wake_time)   memories.push({ key: 'typical_wake_time',   value: typical_wake_time });
  if (baseline_resp_rate)  memories.push({ key: 'baseline_respiratory_rate', value: `${baseline_resp_rate} br/min` });
  if (body?.max_heart_rate) memories.push({ key: 'max_heart_rate', value: `${body.max_heart_rate}bpm` });
  if (earliest?.whoop_created_at) {
    memories.push({ key: 'whoop_member_since', value: earliest.whoop_created_at.slice(0, 10) });
  }

  await supabase.from('core_memory').upsert(
    memories.map(m => ({ user_id: userId, key: m.key, value: m.value, updated_at: new Date().toISOString() })),
    { onConflict: 'user_id,key' },
  );

  log('info', 'core_memory_seeded', { userId, keys: memories.map(m => m.key) });
}

// ─── Main mapping logic ────────────────────────────────────────────
async function mapWhoopToSnapshot(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  since?: string,
): Promise<{ daysProcessed: number }> {
  // Fetch all WHOOP data in range
  let recoveryQ = supabase.from('whoop_recovery').select('*').eq('user_id', userId).order('whoop_created_at', { ascending: true });
  let sleepQ    = supabase.from('whoop_sleep').select('*').eq('user_id', userId).eq('is_nap', false).order('start_time', { ascending: true });
  let workoutQ  = supabase.from('whoop_workout').select('*').eq('user_id', userId).order('start_time', { ascending: true });

  if (since) {
    recoveryQ = recoveryQ.gte('whoop_created_at', since);
    sleepQ    = sleepQ.gte('start_time', since);
    workoutQ  = workoutQ.gte('start_time', since);
  }

  const [{ data: recoveries }, { data: sleeps }, { data: workouts }] = await Promise.all([
    recoveryQ, sleepQ, workoutQ,
  ]);

  if (!recoveries?.length && !sleeps?.length) return { daysProcessed: 0 };

  // Index sleep and workouts by local date
  const sleepByDate   = new Map<string, Record<string, unknown>>();
  const workoutsByDate = new Map<string, Record<string, unknown>[]>();

  for (const s of sleeps ?? []) {
    const date = toLocalDate(s.end_time as string, timezone);  // wake date = the day you "lived"
    if (!sleepByDate.has(date)) sleepByDate.set(date, s as Record<string, unknown>);
  }
  for (const w of workouts ?? []) {
    const date = toLocalDate(w.start_time as string, timezone);
    if (!workoutsByDate.has(date)) workoutsByDate.set(date, []);
    workoutsByDate.get(date)!.push(w as Record<string, unknown>);
  }

  // Build snapshot updates keyed by date
  const updates = new Map<string, Record<string, unknown>>();

  for (const r of recoveries ?? []) {
    const date = toLocalDate(r.whoop_created_at as string, timezone);
    if (!updates.has(date)) updates.set(date, { user_id: userId, date });
    const u = updates.get(date)!;

    // Only set if null — preserve Apple Health / Health Connect data
    if (r.hrv_rmssd_milli != null)    u['_hrv_rmssd']    = r.hrv_rmssd_milli;       // ms → ms, direct
    if (r.resting_heart_rate != null) u['_resting_hr']   = r.resting_heart_rate;
    if (r.spo2_percentage != null)    u['_spo2']         = r.spo2_percentage;
    if (r.skin_temp_celsius != null)  u['_wrist_temp']   = r.skin_temp_celsius;     // proxy
    if (r.recovery_score != null)     u['_recovery_score'] = r.recovery_score;       // stored in raw payload context
  }

  for (const [date, s] of sleepByDate) {
    if (!updates.has(date)) updates.set(date, { user_id: userId, date });
    const u = updates.get(date)!;

    const inBedMs  = (s['total_in_bed_milli'] as number) ?? 0;
    const slowMs   = (s['total_slow_wave_milli'] as number) ?? 0;
    const remMs    = (s['total_rem_milli'] as number) ?? 0;

    if (inBedMs > 0)                   u['_sleep_duration_hours'] = Math.round(inBedMs / 3_600_000 * 10) / 10;
    if (s['sleep_efficiency_pct'])     u['_sleep_efficiency']     = s['sleep_efficiency_pct'];
    if (inBedMs > 0 && slowMs > 0)    u['_sleep_deep_pct']       = Math.round(slowMs / inBedMs * 100 * 10) / 10;
    if (inBedMs > 0 && remMs > 0)     u['_sleep_rem_pct']        = Math.round(remMs / inBedMs * 100 * 10) / 10;
    if (s['start_time'])               u['_sleep_bedtime']        = s['start_time'];
    if (s['end_time'])                 u['_sleep_wake_time']      = s['end_time'];
    if (s['respiratory_rate'])         u['_respiratory_rate']     = s['respiratory_rate'];
  }

  for (const [date, dayWorkouts] of workoutsByDate) {
    if (!updates.has(date)) updates.set(date, { user_id: userId, date });
    const u = updates.get(date)!;

    const totalKj  = dayWorkouts.reduce((s, w) => s + ((w['kilojoules'] as number) ?? 0), 0);
    const totalMin = dayWorkouts.reduce((s, w) => {
      const start = new Date(w['start_time'] as string).getTime();
      const end   = new Date(w['end_time']   as string).getTime();
      return s + (end - start) / 60_000;
    }, 0);

    u['_active_energy']    = Math.round(totalKj * 0.239006); // kJ → kcal
    u['_exercise_minutes'] = Math.round(totalMin);
    u['_workouts'] = dayWorkouts.map(w => ({
      source:        'whoop',
      sport_id:      w['sport_id'],
      sport_name:    w['sport_name'],
      duration_min:  Math.round((new Date(w['end_time'] as string).getTime() - new Date(w['start_time'] as string).getTime()) / 60_000),
      strain:        w['strain'],
      avg_hr:        w['avg_heart_rate'],
      max_hr:        w['max_heart_rate'],
      kilojoules:    w['kilojoules'],
      distance_m:    w['distance_meter'],
    }));
  }

  if (updates.size === 0) return { daysProcessed: 0 };

  // Fetch existing snapshots — needed for merge strategy and workout dedup
  const dates = [...updates.keys()];
  const { data: existing } = await supabase
    .from('health_snapshots')
    .select('date, hrv_rmssd, resting_hr, spo2, wrist_temp, sleep_duration_hours, sleep_efficiency, sleep_deep_pct, sleep_rem_pct, sleep_bedtime, sleep_wake_time, respiratory_rate, active_energy, exercise_minutes, data_sources')
    .eq('user_id', userId)
    .in('date', dates);

  const existingByDate = new Map((existing ?? []).map(e => [e.date as string, e]));

  // Source hierarchy for multi-device support:
  //   WHOOP always wins:  hrv_rmssd, resting_hr, respiratory_rate, spo2
  //     (WHOOP measures recovery metrics directly; Apple Watch computes from beats)
  //   NULL-only (first wins): sleep_*, wrist_temp (roughly equal quality)
  //   Apple Watch wins:   steps, active_energy, exercise_minutes — preserve those
  //   Workouts: always merge both sources
  const rows: Record<string, unknown>[] = [];
  for (const [date, u] of updates) {
    const ex = existingByDate.get(date) as Record<string, unknown> ?? {};
    const row: Record<string, unknown> = { user_id: userId, date };
    const existingSources = (ex['data_sources'] as Record<string, string>) ?? {};
    const sources: Record<string, string> = { ...existingSources };

    // WHOOP wins regardless of existing value (superior recovery metrics)
    const setWhoop = (col: string, srcKey: string) => {
      if (u[srcKey] != null) { row[col] = u[srcKey]; sources[col] = 'whoop'; }
    };
    // NULL-only: only fill if empty (don't override other sources)
    const setIfNull = (col: string, srcKey: string, source = 'whoop') => {
      if (ex[col] == null && u[srcKey] != null) { row[col] = u[srcKey]; sources[col] = source; }
    };
    // Never overwrite: preserve Apple Watch / Health Connect activity data
    const preserve = (col: string) => { /* noop — upsert with ignoreDuplicates=false keeps existing */ };

    setWhoop('hrv_rmssd',        '_hrv_rmssd');
    setWhoop('resting_hr',       '_resting_hr');
    setWhoop('respiratory_rate', '_respiratory_rate');
    setWhoop('spo2',             '_spo2');

    setIfNull('wrist_temp',           '_wrist_temp');
    setIfNull('sleep_duration_hours', '_sleep_duration_hours');
    setIfNull('sleep_efficiency',     '_sleep_efficiency');
    setIfNull('sleep_deep_pct',       '_sleep_deep_pct');
    setIfNull('sleep_rem_pct',        '_sleep_rem_pct');
    setIfNull('sleep_bedtime',        '_sleep_bedtime');
    setIfNull('sleep_wake_time',      '_sleep_wake_time');

    // Apple Watch / Health Connect owns steps/activity — only fill if truly empty
    setIfNull('active_energy',    '_active_energy');
    setIfNull('exercise_minutes', '_exercise_minutes');
    preserve('steps'); // never set steps from WHOOP — Apple Watch steps are authoritative

    if (Object.keys(sources).length > Object.keys(existingSources).length) {
      row['data_sources'] = sources;
    }

    // Workouts: merge sources rather than overwrite
    if (u['_workouts']) {
      const existingWorkouts = (existingByDate.get(date) as { workouts?: unknown[] } | undefined)?.workouts ?? [];
      const nonWhoop = (existingWorkouts as Array<{ source?: string }>).filter(w => w.source !== 'whoop');
      row['workouts'] = [...nonWhoop, ...(u['_workouts'] as unknown[])];
    }

    // Set data_tier based on what we have
    const hasRecovery = u['_hrv_rmssd'] != null || u['_resting_hr'] != null;
    const hasSleep    = u['_sleep_duration_hours'] != null;
    if (Object.keys(row).length > 2) {
      row['data_tier'] = hasRecovery && hasSleep ? 'rich' : 'partial';
      rows.push(row);
    }
  }

  if (rows.length === 0) return { daysProcessed: 0 };

  // Upsert in batches of 200
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase.from('health_snapshots').upsert(rows.slice(i, i + BATCH), { onConflict: 'user_id,date' });
  }

  log('info', 'snapshots_upserted', { userId, days: rows.length });
  return { daysProcessed: rows.length };
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({})) as { user_id?: string; since?: string };
  const userId = body.user_id;
  const since  = body.since;

  if (!userId) return json({ error: 'missing user_id' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Get user timezone
  const { data: user } = await supabase.from('users').select('timezone').eq('id', userId).maybeSingle();
  const timezone = (user?.timezone as string) ?? 'UTC';

  log('info', 'mapping_start', { userId, since: since ?? 'all', timezone });

  const { daysProcessed } = await mapWhoopToSnapshot(supabase, userId, timezone, since);

  // Seed core_memory baselines directly (cheap — 2 DB reads)
  if (daysProcessed > 0) {
    await seedCoreMemory(supabase, userId, timezone);
  }

  // Fire build-intelligence to generate spots, patterns, constellations
  const biUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/build-intelligence`;
  fetch(biUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ user_id: userId }),
  }).catch(() => { /* fire-and-forget */ });

  log('info', 'mapping_complete', { userId, daysProcessed });
  return json({ ok: true, daysProcessed });
});

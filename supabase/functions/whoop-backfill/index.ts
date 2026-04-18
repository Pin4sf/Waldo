/**
 * Waldo — whoop-backfill Edge Function
 *
 * Ingests WHOOP history for a given user via WHOOP API v2 pagination.
 *
 * Two modes:
 *   mode=recent  → last 30 days (foreground, triggered right after OAuth connect, ~1 min)
 *   mode=full    → full membership history (background job, ~5–10 min, rate-limit aware)
 *
 * POST /whoop-backfill
 *   Body: { user_id: string, mode: 'recent' | 'full' }
 *   Auth: Service-role Bearer token (called server-to-server only)
 *
 * Rate limits: 100 req/60s, 10K/day. Budget: ~30–50 calls/day ongoing.
 * Backfill for 2-year user ≈ 150 calls total.
 *
 * Required env vars:
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshWhoopToken } from '../_shared/whoop-auth.ts';

const WHOOP_API  = 'https://api.prod.whoop.com/developer/v1';
const PAGE_LIMIT = 25;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'whoop-backfill', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ─── WHOOP paginated fetch helper ─────────────────────────────────
async function whoopFetchAll<T>(
  endpoint: string,
  token: string,
  startDate?: string,
): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL(`${WHOOP_API}${endpoint}`);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    if (nextToken)  url.searchParams.set('nextToken', nextToken);
    if (startDate)  url.searchParams.set('start',     startDate);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 429) {
      // Rate limit hit — abort and return partial results rather than blocking for 62s
      // Daily sync-whoop will catch any missed records
      log('warn', 'rate_limited_abort', { endpoint, records_so_far: results.length });
      break;
    }

    if (!resp.ok) {
      log('error', 'api_error', { endpoint, status: resp.status });
      break;
    }

    const body = await resp.json() as { records?: T[]; next_token?: string };
    const records = body.records ?? [];
    results.push(...records);
    nextToken = body.next_token ?? null;
  } while (nextToken);

  return results;
}

// ─── Upsert helpers (identical to webhook upserts) ────────────────

function upsertRecoveries(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  recoveries: Record<string, unknown>[],
) {
  return supabase.from('whoop_recovery').upsert(
    recoveries.map(r => {
      const score = r['score'] as Record<string, unknown> | null;
      return {
        user_id:            userId,
        whoop_recovery_id:  r['id'] as number,
        cycle_id:           r['cycle_id'] as number,
        recovery_score:     score?.['recovery_score']    ?? null,
        resting_heart_rate: score?.['resting_heart_rate'] ?? null,
        hrv_rmssd_milli:    score?.['hrv_rmssd_milli']   ?? null,
        spo2_percentage:    score?.['spo2_percentage']   ?? null,
        skin_temp_celsius:  score?.['skin_temp_celsius'] ?? null,
        user_calibrating:   score?.['user_calibrating']  ?? false,
        whoop_created_at:   r['created_at'] as string,
        raw_payload:        r,
      };
    }),
    { onConflict: 'user_id,whoop_recovery_id', ignoreDuplicates: true },
  );
}

function upsertSleeps(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sleeps: Record<string, unknown>[],
) {
  return supabase.from('whoop_sleep').upsert(
    sleeps.filter(s => s['start'] && s['end']).map(s => {
      const score  = s['score']        as Record<string, unknown> | null;
      const stages = score?.['stage_summary'] as Record<string, unknown> | null;
      const needed = score?.['sleep_needed']  as Record<string, unknown> | null;
      return {
        user_id:                       userId,
        whoop_sleep_id:                s['id'] as number,
        is_nap:                        s['nap'] ?? false,
        start_time:                    s['start'] as string,
        end_time:                      s['end'] as string,
        total_in_bed_milli:            stages?.['total_in_bed_time_milli']          ?? null,
        total_light_sleep_milli:       stages?.['total_light_sleep_time_milli']     ?? null,
        total_slow_wave_milli:         stages?.['total_slow_wave_sleep_time_milli'] ?? null,
        total_rem_milli:               stages?.['total_rem_sleep_time_milli']       ?? null,
        disturbance_count:             stages?.['disturbance_count']                ?? null,
        baseline_need_milli:           needed?.['baseline_milli']                   ?? null,
        need_from_sleep_debt_milli:    needed?.['need_from_sleep_debt_milli']       ?? null,
        need_from_recent_strain_milli: needed?.['need_from_recent_strain_milli']    ?? null,
        sleep_performance_pct:         score?.['sleep_performance_percentage']      ?? null,
        sleep_consistency_pct:         score?.['sleep_consistency_percentage']      ?? null,
        sleep_efficiency_pct:          score?.['sleep_efficiency_percentage']       ?? null,
        respiratory_rate:              score?.['respiratory_rate']                  ?? null,
        whoop_created_at:              s['created_at'] as string,
        raw_payload:                   s,
      };
    }),
    { onConflict: 'user_id,whoop_sleep_id', ignoreDuplicates: true },
  );
}

function upsertWorkouts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  workouts: Record<string, unknown>[],
) {
  return supabase.from('whoop_workout').upsert(
    workouts.filter(w => w['start'] && w['end']).map(w => {
      const score = w['score'] as Record<string, unknown> | null;
      const zones = score?.['zone_duration'] as Record<string, unknown> | null;
      return {
        user_id:              userId,
        whoop_workout_id:     w['id'] as number,
        sport_id:             w['sport_id'] as number,
        sport_name:           w['sport_name'] ?? null,
        start_time:           w['start'] as string,
        end_time:             w['end'] as string,
        strain:               score?.['strain']             ?? null,
        avg_heart_rate:       score?.['average_heart_rate'] ?? null,
        max_heart_rate:       score?.['max_heart_rate']     ?? null,
        kilojoules:           score?.['kilojoules']         ?? null,
        distance_meter:       score?.['distance_meter']     ?? null,
        altitude_gain_meter:  score?.['altitude_gain_meter'] ?? null,
        zone_zero_milli:      zones?.['zone_zero_milli']    ?? null,
        zone_one_milli:       zones?.['zone_one_milli']     ?? null,
        zone_two_milli:       zones?.['zone_two_milli']     ?? null,
        zone_three_milli:     zones?.['zone_three_milli']   ?? null,
        zone_four_milli:      zones?.['zone_four_milli']    ?? null,
        zone_five_milli:      zones?.['zone_five_milli']    ?? null,
        whoop_created_at:     w['created_at'] as string,
        raw_payload:          w,
      };
    }),
    { onConflict: 'user_id,whoop_workout_id', ignoreDuplicates: true },
  );
}

function upsertCycles(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cycles: Record<string, unknown>[],
) {
  return supabase.from('whoop_cycle').upsert(
    cycles.map(c => {
      const score = c['score'] as Record<string, unknown> | null;
      return {
        user_id:         userId,
        whoop_cycle_id:  c['id'] as number,
        start_time:      c['start'] as string,
        end_time:        (c['end'] as string) || null,
        strain:          score?.['strain']             ?? null,
        kilojoules:      score?.['kilojoules']         ?? null,
        avg_heart_rate:  score?.['average_heart_rate'] ?? null,
        max_heart_rate:  score?.['max_heart_rate']     ?? null,
        whoop_created_at: c['created_at'] as string,
        raw_payload:     c,
      };
    }),
    { onConflict: 'user_id,whoop_cycle_id', ignoreDuplicates: true },
  );
}

async function upsertBodyMeasurement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  token: string,
) {
  const resp = await fetch(`${WHOOP_API}/body_measurement`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return;
  const body = await resp.json() as Record<string, unknown>;
  await supabase.from('whoop_body_measurement').upsert({
    user_id:         userId,
    height_meter:    body['height_meter']    ?? null,
    weight_kilogram: body['weight_kilogram'] ?? null,
    max_heart_rate:  body['max_heart_rate']  ?? null,
    raw_payload:     body,
  }, { onConflict: 'user_id' });
}

// ─── Map WHOOP user_id → Waldo user_id ────────────────────────────
async function storeWhoopUserId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  token: string,
) {
  const resp = await fetch(`${WHOOP_API}/user/profile/basic`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return;
  const profile = await resp.json() as { user_id: number };
  await supabase.from('users').update({ whoop_user_id: String(profile.user_id) })
    .eq('id', userId);
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({})) as { user_id?: string; mode?: string };
  const userId = body.user_id;
  const mode   = body.mode ?? 'recent';  // 'recent' | 'full'

  if (!userId) return json({ error: 'missing user_id' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = await refreshWhoopToken(supabase, userId);
  if (!token) {
    log('error', 'no_token', { userId });
    return json({ error: 'no WHOOP token for user' }, 400);
  }

  log('info', 'backfill_start', { userId, mode });

  // Store WHOOP user_id for webhook routing (first time only)
  await storeWhoopUserId(supabase, userId, token);

  // Body measurement (single call)
  await upsertBodyMeasurement(supabase, userId, token);

  // Date range for 'recent' mode: last 30 days
  const startDate = mode === 'recent'
    ? new Date(Date.now() - 30 * 86400_000).toISOString()
    : undefined;  // undefined = full history

  // Fetch all entities concurrently (cycles/sleeps/workouts/recoveries)
  const [cycles, sleeps, workouts, recoveries] = await Promise.all([
    whoopFetchAll<Record<string, unknown>>('/cycle',    token, startDate),
    whoopFetchAll<Record<string, unknown>>('/sleep',    token, startDate),
    whoopFetchAll<Record<string, unknown>>('/workout',  token, startDate),
    whoopFetchAll<Record<string, unknown>>('/recovery', token, startDate),
  ]);

  log('info', 'fetched', { userId, cycles: cycles.length, sleeps: sleeps.length, workouts: workouts.length, recoveries: recoveries.length });

  // Upsert in parallel
  await Promise.allSettled([
    upsertCycles(supabase,    userId, cycles),
    upsertSleeps(supabase,    userId, sleeps),
    upsertWorkouts(supabase,  userId, workouts),
    upsertRecoveries(supabase, userId, recoveries),
  ]);

  // Update sync log
  await supabase.from('sync_log').upsert({
    user_id:          userId,
    provider:         'whoop',
    last_sync_at:     new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced:   cycles.length + sleeps.length + workouts.length + recoveries.length,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  // Fire whoop-to-snapshot to map raw data → health_snapshots → build-intelligence
  const snapshotUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whoop-to-snapshot`;
  fetch(snapshotUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ user_id: userId }),
  }).catch(() => { /* fire-and-forget */ });

  log('info', 'backfill_complete', { userId, mode, total: cycles.length + sleeps.length + workouts.length + recoveries.length });

  return json({
    ok:          true,
    mode,
    cycles:      cycles.length,
    sleeps:      sleeps.length,
    workouts:    workouts.length,
    recoveries:  recoveries.length,
  });
});

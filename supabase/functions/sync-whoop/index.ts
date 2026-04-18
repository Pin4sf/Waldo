/**
 * Waldo — sync-whoop Edge Function
 *
 * Daily reconciliation sync — backup to real-time webhooks.
 * Fetches the last 2 days from WHOOP API and upserts any missing/updated records.
 *
 * Runs nightly at 04:30 UTC via pg_cron (see 20260418000001_whoop_tables.sql).
 * Can also be triggered manually: POST /sync-whoop?user_id=<id>
 *
 * Handles token refresh via refreshWhoopToken from oauth-whoop.
 * Rate-limit aware: 100 req/60s, 10K/day. This function uses ~8 calls per user.
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { refreshWhoopToken } from '../_shared/whoop-auth.ts';

const WHOOP_API  = 'https://api.prod.whoop.com/developer/v1';
const PAGE_LIMIT = 25;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-whoop', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function whoopGet<T>(endpoint: string, token: string, startDate: string): Promise<T[]> {
  const url = new URL(`${WHOOP_API}${endpoint}`);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('start', startDate);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    log('error', 'api_error', { endpoint, status: resp.status });
    return [];
  }

  const body = await resp.json() as { records?: T[] };
  return body.records ?? [];
}

async function syncUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; records: number; error?: string }> {
  const token = await refreshWhoopToken(supabase, userId);
  if (!token) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'whoop',
      last_sync_status: 'no_token', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, records: 0, error: 'no_token' };
  }

  // Last 2 days to catch any webhook misses
  const startDate = new Date(Date.now() - 2 * 86400_000).toISOString();

  const [cycles, sleeps, workouts, recoveries] = await Promise.all([
    whoopGet<Record<string, unknown>>('/cycle',    token, startDate),
    whoopGet<Record<string, unknown>>('/sleep',    token, startDate),
    whoopGet<Record<string, unknown>>('/workout',  token, startDate),
    whoopGet<Record<string, unknown>>('/recovery', token, startDate),
  ]);

  const upserts: Promise<{ error: { message: string } | null }>[] = [];

  if (cycles.length) {
    upserts.push(
      supabase.from('whoop_cycle').upsert(
        cycles.map(c => {
          const score = c['score'] as Record<string, unknown> | null;
          return {
            user_id: userId, whoop_cycle_id: c['id'] as number,
            start_time: c['start'] as string, end_time: (c['end'] as string) || null,
            strain: score?.['strain'] ?? null, kilojoules: score?.['kilojoules'] ?? null,
            avg_heart_rate: score?.['average_heart_rate'] ?? null,
            max_heart_rate: score?.['max_heart_rate'] ?? null,
            whoop_created_at: c['created_at'] as string, raw_payload: c,
          };
        }),
        { onConflict: 'user_id,whoop_cycle_id', ignoreDuplicates: false },
      ),
    );
  }

  if (sleeps.length) {
    upserts.push(
      supabase.from('whoop_sleep').upsert(
        sleeps.filter(s => s['start'] && s['end']).map(s => {
          const score  = s['score'] as Record<string, unknown> | null;
          const stages = score?.['stage_summary'] as Record<string, unknown> | null;
          const needed = score?.['sleep_needed']  as Record<string, unknown> | null;
          return {
            user_id: userId, whoop_sleep_id: s['id'] as number,
            is_nap: s['nap'] ?? false,
            start_time: s['start'] as string, end_time: s['end'] as string,
            total_in_bed_milli:           stages?.['total_in_bed_time_milli']          ?? null,
            total_light_sleep_milli:      stages?.['total_light_sleep_time_milli']     ?? null,
            total_slow_wave_milli:        stages?.['total_slow_wave_sleep_time_milli'] ?? null,
            total_rem_milli:              stages?.['total_rem_sleep_time_milli']       ?? null,
            disturbance_count:            stages?.['disturbance_count']                ?? null,
            baseline_need_milli:          needed?.['baseline_milli']                   ?? null,
            need_from_sleep_debt_milli:   needed?.['need_from_sleep_debt_milli']       ?? null,
            need_from_recent_strain_milli: needed?.['need_from_recent_strain_milli']   ?? null,
            sleep_performance_pct:        score?.['sleep_performance_percentage']      ?? null,
            sleep_consistency_pct:        score?.['sleep_consistency_percentage']      ?? null,
            sleep_efficiency_pct:         score?.['sleep_efficiency_percentage']       ?? null,
            respiratory_rate:             score?.['respiratory_rate']                  ?? null,
            whoop_created_at: s['created_at'] as string, raw_payload: s,
          };
        }),
        { onConflict: 'user_id,whoop_sleep_id', ignoreDuplicates: false },
      ),
    );
  }

  if (workouts.length) {
    upserts.push(
      supabase.from('whoop_workout').upsert(
        workouts.filter(w => w['start'] && w['end']).map(w => {
          const score = w['score'] as Record<string, unknown> | null;
          const zones = score?.['zone_duration'] as Record<string, unknown> | null;
          return {
            user_id: userId, whoop_workout_id: w['id'] as number,
            sport_id: w['sport_id'] as number, sport_name: w['sport_name'] ?? null,
            start_time: w['start'] as string, end_time: w['end'] as string,
            strain: score?.['strain'] ?? null,
            avg_heart_rate: score?.['average_heart_rate'] ?? null,
            max_heart_rate: score?.['max_heart_rate'] ?? null,
            kilojoules: score?.['kilojoules'] ?? null,
            distance_meter: score?.['distance_meter'] ?? null,
            altitude_gain_meter: score?.['altitude_gain_meter'] ?? null,
            zone_zero_milli:  zones?.['zone_zero_milli']  ?? null,
            zone_one_milli:   zones?.['zone_one_milli']   ?? null,
            zone_two_milli:   zones?.['zone_two_milli']   ?? null,
            zone_three_milli: zones?.['zone_three_milli'] ?? null,
            zone_four_milli:  zones?.['zone_four_milli']  ?? null,
            zone_five_milli:  zones?.['zone_five_milli']  ?? null,
            whoop_created_at: w['created_at'] as string, raw_payload: w,
          };
        }),
        { onConflict: 'user_id,whoop_workout_id', ignoreDuplicates: false },
      ),
    );
  }

  if (recoveries.length) {
    upserts.push(
      supabase.from('whoop_recovery').upsert(
        recoveries.map(r => {
          const score = r['score'] as Record<string, unknown> | null;
          return {
            user_id: userId, whoop_recovery_id: r['id'] as number,
            cycle_id: r['cycle_id'] as number,
            recovery_score:     score?.['recovery_score']     ?? null,
            resting_heart_rate: score?.['resting_heart_rate'] ?? null,
            hrv_rmssd_milli:    score?.['hrv_rmssd_milli']    ?? null,
            spo2_percentage:    score?.['spo2_percentage']    ?? null,
            skin_temp_celsius:  score?.['skin_temp_celsius']  ?? null,
            user_calibrating:   score?.['user_calibrating']   ?? false,
            whoop_created_at: r['created_at'] as string, raw_payload: r,
          };
        }),
        { onConflict: 'user_id,whoop_recovery_id', ignoreDuplicates: false },
      ),
    );
  }

  const results = await Promise.allSettled(upserts);
  const errors  = results.filter(r => r.status === 'rejected').length;
  const total   = cycles.length + sleeps.length + workouts.length + recoveries.length;

  await supabase.from('sync_log').upsert({
    user_id:          userId,
    provider:         'whoop',
    last_sync_at:     new Date().toISOString(),
    last_sync_status: errors > 0 ? 'partial' : 'ok',
    records_synced:   total,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('info', 'user_synced', { userId, total, errors });

  // Map last 2 days from WHOOP raw tables → health_snapshots → build-intelligence
  const since2d = new Date(Date.now() - 2 * 86400_000).toISOString();
  const snapshotUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whoop-to-snapshot`;
  fetch(snapshotUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ user_id: userId, since: since2d }),
  }).catch(() => { /* fire-and-forget */ });

  return { ok: true, records: total };
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Support single-user trigger: POST { user_id }
  let targetUserId: string | null = null;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    targetUserId = (body['user_id'] as string) ?? null;
  } else {
    const url = new URL(req.url);
    targetUserId = url.searchParams.get('user_id');
  }

  let query = supabase.from('oauth_tokens').select('user_id').eq('provider', 'whoop');
  if (targetUserId) query = query.eq('user_id', targetUserId);

  const { data: tokenUsers } = await query;
  if (!tokenUsers || tokenUsers.length === 0) {
    log('info', 'no_whoop_users');
    return json({ synced: 0 });
  }

  log('info', 'sync_start', { users: tokenUsers.length });

  const results = await Promise.allSettled(
    tokenUsers.slice(0, 20).map(u => syncUser(supabase, u.user_id as string)),
  );

  let synced = 0, errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) synced++;
    else errors++;
  }

  return json({ synced, errors });
});

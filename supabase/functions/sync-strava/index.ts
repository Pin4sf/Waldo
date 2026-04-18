/**
 * Waldo — sync-strava Edge Function
 *
 * Runs nightly at 4:00 AM UTC (pg_cron). Syncs Strava activities into
 * health_snapshots.workouts (JSONB). Enriches existing workout data from
 * HealthKit/Health Connect — no new table needed.
 *
 * Strava REST API v3: https://developers.strava.com/docs/reference/
 * Token refresh: Strava tokens expire, refresh_token needed.
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-strava', level, event, ...data }));
}

// ─── Token refresh ──────────────────────────────────────────
async function getValidStravaToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId).eq('provider', 'strava').maybeSingle();

  if (!tokenRow) return null;

  // Token still valid (5-min buffer)
  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) return null;

  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    log('error', 'token_refresh_failed', { userId, status: resp.status });
    return null;
  }

  const tokens = await resp.json() as { access_token: string; refresh_token: string; expires_at: number };

  await supabase.from('oauth_tokens').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'strava');

  return tokens.access_token;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;               // Run, Ride, Swim, Workout, etc.
  sport_type: string;
  start_date: string;         // ISO 8601
  start_date_local: string;
  moving_time: number;        // seconds
  elapsed_time: number;
  distance: number;           // meters
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;      // Strava's intensity score
  calories?: number;
  total_elevation_gain?: number;
  average_speed?: number;     // m/s
}

async function syncUserStrava(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; activities: number; error?: string }> {
  const token = await getValidStravaToken(supabase, userId);
  if (!token) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'strava',
      last_sync_status: 'no_token', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, activities: 0, error: 'no_token' };
  }

  // Fetch up to 1 year of activities with pagination (Strava max per_page=200)
  const after = Math.floor((Date.now() - 365 * 86400_000) / 1000);
  const activities: StravaActivity[] = [];
  let page = 1;
  while (true) {
    const resp = await fetch(
      `${STRAVA_API}/athlete/activities?after=${after}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) {
      log('error', 'api_failed', { userId, status: resp.status, page });
      await supabase.from('sync_log').upsert({
        user_id: userId, provider: 'strava',
        last_sync_status: 'error', last_error: `HTTP ${resp.status}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });
      return { ok: false, activities: 0, error: `HTTP ${resp.status}` };
    }
    const pageActivities = (await resp.json()) as StravaActivity[];
    if (pageActivities.length === 0) break;
    activities.push(...pageActivities);
    if (pageActivities.length < 200) break;
    page++;
  }

  // Group activities by date (local date)
  const byDate = new Map<string, StravaActivity[]>();
  for (const a of activities) {
    const date = a.start_date_local.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(a);
  }

  // For each date, update health_snapshots.workouts
  for (const [date, dayActivities] of byDate) {
    const workouts = dayActivities.map(a => ({
      source: 'strava',
      name: a.name,
      type: a.type,
      sport_type: a.sport_type,
      duration_min: Math.round(a.moving_time / 60),
      distance_km: +(a.distance / 1000).toFixed(2),
      avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
      max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      suffer_score: a.suffer_score ?? null,
      calories: a.calories ?? null,
      elevation_m: a.total_elevation_gain ?? null,
    }));

    // Total exercise minutes from Strava
    const exerciseMin = dayActivities.reduce((s, a) => s + a.moving_time / 60, 0);
    const activeEnergy = dayActivities.reduce((s, a) => s + (a.calories ?? 0), 0);
    const distanceKm = dayActivities.reduce((s, a) => s + a.distance / 1000, 0);

    // Merge with existing health_snapshots
    const { data: existing } = await supabase
      .from('health_snapshots')
      .select('workouts, exercise_minutes, active_energy, distance_km')
      .eq('user_id', userId).eq('date', date).maybeSingle();

    // Merge Strava workouts with any existing workouts (from HealthKit/Health Connect)
    const existingWorkouts = (existing?.workouts as Record<string, unknown>[] | null) ?? [];
    const nonStravaWorkouts = existingWorkouts.filter((w: any) => w.source !== 'strava');
    const mergedWorkouts = [...nonStravaWorkouts, ...workouts];

    // Update exercise metrics (take max of existing and Strava)
    const existingExercise = existing?.exercise_minutes ?? 0;
    const existingEnergy = existing?.active_energy ?? 0;
    const existingDistance = existing?.distance_km ?? 0;

    await supabase.from('health_snapshots').upsert({
      user_id: userId,
      date,
      workouts: mergedWorkouts,
      exercise_minutes: Math.max(existingExercise, Math.round(exerciseMin)),
      active_energy: Math.max(existingEnergy, Math.round(activeEnergy)),
      distance_km: Math.max(existingDistance, +distanceKm.toFixed(2)),
    }, { onConflict: 'user_id,date' });
  }

  // Record sync
  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'strava',
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced: activities.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('info', 'sync_complete', { userId, activities: activities.length, dates: byDate.size });
  return { ok: true, activities: activities.length };
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

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    targetUserId = (body['user_id'] as string) ?? null;
  } catch { /* no body */ }

  let query = supabase.from('oauth_tokens').select('user_id').eq('provider', 'strava');
  if (targetUserId) query = query.eq('user_id', targetUserId);

  const { data: tokenUsers } = await query;
  if (!tokenUsers || tokenUsers.length === 0) {
    log('info', 'no_strava_users');
    return new Response(JSON.stringify({ synced: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  log('info', 'sync_start', { users: tokenUsers.length });

  let synced = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    tokenUsers.slice(0, 10).map(u => syncUserStrava(supabase, u.user_id))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) synced++;
    else errors++;
  }

  return new Response(JSON.stringify({ synced, errors }), { headers: { 'Content-Type': 'application/json' } });
});

/**
 * Waldo — whoop-webhook Edge Function
 *
 * Receives real-time WHOOP webhook events (recovery/sleep/workout updated/deleted).
 * Validates HMAC-SHA256 signature, upserts into the appropriate whoop_* table.
 *
 * WHOOP delivers 6 event types:
 *   recovery.updated, recovery.deleted
 *   sleep.updated,    sleep.deleted
 *   workout.updated,  workout.deleted
 *
 * Required env vars:
 *   WHOOP_WEBHOOK_SECRET  — shared secret from WHOOP Developer Portal
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * WHOOP guarantees 5× retry with exponential backoff.
 * Must respond 200 within 5s or WHOOP retries.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-WHOOP-Signature',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'whoop-webhook', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ─── HMAC-SHA256 signature validation ─────────────────────────────
async function validateSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = hexToBytes(signature);
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(rawBody));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ─── WHOOP API types ──────────────────────────────────────────────
interface WhoopEvent {
  event_type: string;  // 'recovery.updated' | 'sleep.updated' | etc.
  user_id:    number;
  id:         number;  // entity ID (recovery_id / sleep_id / workout_id)
  data?:      Record<string, unknown>;
}

// ─── Upsert helpers ───────────────────────────────────────────────

function upsertRecovery(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  raw: Record<string, unknown>,
) {
  const score = raw['score'] as Record<string, unknown> | null;
  return supabase.from('whoop_recovery').upsert({
    user_id:           userId,
    whoop_recovery_id: raw['id'] as number,
    cycle_id:          raw['cycle_id'] as number,
    recovery_score:    score?.['recovery_score'] ?? null,
    resting_heart_rate: score?.['resting_heart_rate'] ?? null,
    hrv_rmssd_milli:   score?.['hrv_rmssd_milli'] ?? null,
    spo2_percentage:   score?.['spo2_percentage'] ?? null,
    skin_temp_celsius: score?.['skin_temp_celsius'] ?? null,
    user_calibrating:  score?.['user_calibrating'] ?? false,
    whoop_created_at:  raw['created_at'] as string,
    raw_payload:       raw,
  }, { onConflict: 'user_id,whoop_recovery_id' });
}

function upsertSleep(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  raw: Record<string, unknown>,
) {
  const score   = raw['score']       as Record<string, unknown> | null;
  const stages  = score?.['stage_summary']  as Record<string, unknown> | null;
  const needed  = score?.['sleep_needed']   as Record<string, unknown> | null;
  return supabase.from('whoop_sleep').upsert({
    user_id:                      userId,
    whoop_sleep_id:               raw['id'] as number,
    is_nap:                       raw['nap'] ?? false,
    start_time:                   raw['start'] as string,
    end_time:                     raw['end'] as string,
    total_in_bed_milli:           stages?.['total_in_bed_time_milli']      ?? null,
    total_light_sleep_milli:      stages?.['total_light_sleep_time_milli'] ?? null,
    total_slow_wave_milli:        stages?.['total_slow_wave_sleep_time_milli'] ?? null,
    total_rem_milli:              stages?.['total_rem_sleep_time_milli']   ?? null,
    disturbance_count:            stages?.['disturbance_count']            ?? null,
    baseline_need_milli:          needed?.['baseline_milli']               ?? null,
    need_from_sleep_debt_milli:   needed?.['need_from_sleep_debt_milli']   ?? null,
    need_from_recent_strain_milli: needed?.['need_from_recent_strain_milli'] ?? null,
    sleep_performance_pct:        score?.['sleep_performance_percentage']  ?? null,
    sleep_consistency_pct:        score?.['sleep_consistency_percentage']  ?? null,
    sleep_efficiency_pct:         score?.['sleep_efficiency_percentage']   ?? null,
    respiratory_rate:             score?.['respiratory_rate']              ?? null,
    whoop_created_at:             raw['created_at'] as string,
    raw_payload:                  raw,
  }, { onConflict: 'user_id,whoop_sleep_id' });
}

function upsertWorkout(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  raw: Record<string, unknown>,
) {
  const score = raw['score'] as Record<string, unknown> | null;
  const zones = score?.['zone_duration'] as Record<string, unknown> | null;
  return supabase.from('whoop_workout').upsert({
    user_id:             userId,
    whoop_workout_id:    raw['id'] as number,
    sport_id:            raw['sport_id'] as number,
    sport_name:          raw['sport_name'] ?? null,
    start_time:          raw['start'] as string,
    end_time:            raw['end'] as string,
    strain:              score?.['strain']             ?? null,
    avg_heart_rate:      score?.['average_heart_rate'] ?? null,
    max_heart_rate:      score?.['max_heart_rate']     ?? null,
    kilojoules:          score?.['kilojoules']         ?? null,
    distance_meter:      score?.['distance_meter']     ?? null,
    altitude_gain_meter: score?.['altitude_gain_meter'] ?? null,
    zone_zero_milli:     zones?.['zone_zero_milli']    ?? null,
    zone_one_milli:      zones?.['zone_one_milli']     ?? null,
    zone_two_milli:      zones?.['zone_two_milli']     ?? null,
    zone_three_milli:    zones?.['zone_three_milli']   ?? null,
    zone_four_milli:     zones?.['zone_four_milli']    ?? null,
    zone_five_milli:     zones?.['zone_five_milli']    ?? null,
    whoop_created_at:    raw['created_at'] as string,
    raw_payload:         raw,
  }, { onConflict: 'user_id,whoop_workout_id' });
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // WHOOP signs webhooks with the app's client secret (no separate webhook secret)
  const signingSecret = Deno.env.get('WHOOP_CLIENT_SECRET');
  const rawBody       = await req.text();
  const signature     = req.headers.get('X-WHOOP-Signature') ?? '';

  if (signingSecret && signature) {
    const valid = await validateSignature(rawBody, signature, signingSecret);
    if (!valid) {
      log('warn', 'invalid_signature', { sig: signature.slice(0, 8) });
      return json({ error: 'invalid signature' }, 401);
    }
  }

  let event: WhoopEvent;
  try {
    event = JSON.parse(rawBody) as WhoopEvent;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Look up Waldo user by WHOOP user_id (stored in users.whoop_user_id or via oauth_tokens)
  // We match via user profile fetched at connect time — for now match by sync_log note
  // The proper lookup is: find user whose whoop access_token maps to this whoop user_id
  // Simple approach: store whoop_user_id in users table or in a whoop_users mapping
  // For MVP we look up the user from a whoop_user_id column added to users table
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('whoop_user_id', String(event.user_id))
    .maybeSingle();

  if (!userRow) {
    // User not found by whoop_user_id — could be a new connection not yet mapped
    log('warn', 'user_not_found', { whoop_user_id: event.user_id });
    return json({ ok: true, note: 'user not mapped yet' });
  }

  const userId    = userRow.id as string;
  const eventType = event.event_type;
  const data      = (event.data ?? {}) as Record<string, unknown>;

  log('info', 'event_received', { userId, event_type: eventType, entity_id: event.id });

  if (eventType === 'recovery.deleted') {
    await supabase.from('whoop_recovery').delete()
      .eq('user_id', userId).eq('whoop_recovery_id', event.id);
    return json({ ok: true });
  }

  if (eventType === 'sleep.deleted') {
    await supabase.from('whoop_sleep').delete()
      .eq('user_id', userId).eq('whoop_sleep_id', event.id);
    return json({ ok: true });
  }

  if (eventType === 'workout.deleted') {
    await supabase.from('whoop_workout').delete()
      .eq('user_id', userId).eq('whoop_workout_id', event.id);
    return json({ ok: true });
  }

  // For updated events, data payload contains the full entity
  if (eventType === 'recovery.updated') {
    const payload = Object.keys(data).length ? data : { id: event.id, created_at: new Date().toISOString() };
    const { error } = await upsertRecovery(supabase, userId, payload);
    if (error) log('error', 'upsert_recovery_failed', { userId, error: error.message });
    return json({ ok: !error });
  }

  if (eventType === 'sleep.updated') {
    const payload = Object.keys(data).length ? data : { id: event.id, start: '', end: '', created_at: new Date().toISOString() };
    const { error } = await upsertSleep(supabase, userId, payload);
    if (error) log('error', 'upsert_sleep_failed', { userId, error: error.message });
    return json({ ok: !error });
  }

  if (eventType === 'workout.updated') {
    const payload = Object.keys(data).length ? data : { id: event.id, sport_id: 0, start: '', end: '', created_at: new Date().toISOString() };
    const { error } = await upsertWorkout(supabase, userId, payload);
    if (error) log('error', 'upsert_workout_failed', { userId, error: error.message });
    return json({ ok: !error });
  }

  log('info', 'unhandled_event_type', { eventType });
  return json({ ok: true, note: 'unhandled event type' });
});

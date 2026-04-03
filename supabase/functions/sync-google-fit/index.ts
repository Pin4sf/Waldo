/**
 * Waldo — sync-google-fit Edge Function
 *
 * Syncs health data from Google Fit API (which aggregates data from:
 * - Android Health Connect (Samsung, Pixel, etc.)
 * - Connected wearables (Galaxy Watch, Garmin, Fitbit, WHOOP, etc.)
 * - Google Fit app manually logged data)
 *
 * This is the web-accessible path to Android health data.
 * Users connect Google with fit_heart + fit_sleep + fit_steps scopes
 * and Waldo reads their wearable data without needing a native Android app.
 *
 * Reads: Heart Rate, Sleep Sessions, Steps
 * Writes to: health_snapshots (device_type = 'google_fit', data_sources tracked)
 *
 * Runs nightly at 4:30 AM UTC (pg_cron).
 * Can also be triggered manually via POST /sync-google-fit?user_id=<id>
 *
 * Required additional Google OAuth scopes (add to connect URL):
 *   fit_heart, fit_sleep, fit_steps
 * Full URL: /oauth-google/connect?user_id=<id>&scopes=calendar,gmail,tasks,youtube,fit_heart,fit_sleep,fit_steps
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, recordSync, googleFetch } from '../_shared/google-auth.ts';

const FIT_API = 'https://www.googleapis.com/fitness/v1/users/me';

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-google-fit', event, ...data }));
}

function dayBoundsMs(dateStr: string, tzOffsetMs: number): { startMs: number; endMs: number } {
  // Convert YYYY-MM-DD in user's local timezone to UTC milliseconds
  const localMidnight = new Date(`${dateStr}T00:00:00Z`).getTime() - tzOffsetMs;
  return { startMs: localMidnight, endMs: localMidnight + 86400000 };
}

function getTzOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
    const local = now.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const [lH, lM] = local.split(':').map(Number);
    return ((lH! - utcH) * 60 + (lM! - utcM)) * 60 * 1000;
  } catch { return 0; }
}

async function syncUserGoogleFit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<{ ok: boolean; daysProcessed: number; error?: string }> {
  const token = await getValidGoogleToken(supabase, userId);
  if (!token) {
    await recordSync(supabase, userId, 'google_fit', 'no_token');
    return { ok: false, daysProcessed: 0, error: 'no_token' };
  }

  // Check if user has fitness scopes
  const { data: tokenRow } = await supabase
    .from('oauth_tokens').select('scopes').eq('user_id', userId).eq('provider', 'google').maybeSingle();
  const scopes: string[] = tokenRow?.scopes ?? [];
  const hasFitScopes = scopes.some(s => s.includes('fitness'));
  if (!hasFitScopes) {
    await recordSync(supabase, userId, 'google_fit', 'no_token', 0, 'missing fitness scopes — reconnect Google with fit_heart,fit_sleep,fit_steps');
    return { ok: true, daysProcessed: 0 };
  }

  const tzOffset = getTzOffsetMs(timezone);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let totalDays = 0;

  for (const dateStr of [yesterday, today]) {
    const { startMs, endMs } = dayBoundsMs(dateStr, tzOffset);

    // ─── Heart Rate ──────────────────────────────────────────────
    const hrResult = await googleFetch(`${FIT_API}/dataset:aggregate`, token, undefined);
    // Google Fit requires POST for aggregation — use a direct fetch
    const hrResp = await fetch(`${FIT_API}/dataset:aggregate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    // ─── Steps ───────────────────────────────────────────────────
    const stepsResp = await fetch(`${FIT_API}/dataset:aggregate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    // ─── Sleep ───────────────────────────────────────────────────
    const sleepResp = await fetch(`${FIT_API}/sessions?startTime=${new Date(startMs).toISOString()}&endTime=${new Date(endMs).toISOString()}&activityType=72`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!hrResp.ok && !stepsResp.ok) {
      if (hrResp.status === 401) {
        await recordSync(supabase, userId, 'google_fit', 'token_expired');
        return { ok: false, daysProcessed: 0, error: 'token_expired' };
      }
      continue;
    }

    let restingHR: number | null = null;
    let avgHR: number | null = null;
    let steps: number | null = null;
    let sleepHours: number | null = null;

    if (hrResp.ok) {
      const hrData = await hrResp.json() as { bucket?: Array<{ dataset: Array<{ point: Array<{ value: Array<{ fpVal: number }> }> }> }> };
      const points = hrData.bucket?.[0]?.dataset?.[0]?.point ?? [];
      if (points.length > 0) {
        const vals = points.map(p => p.value[0]?.fpVal ?? 0).filter(v => v > 30 && v < 220);
        if (vals.length > 0) {
          avgHR = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          const sorted = [...vals].sort((a, b) => a - b);
          restingHR = Math.round(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(sorted.length * 0.1)));
        }
      }
    }

    if (stepsResp.ok) {
      const stepsData = await stepsResp.json() as { bucket?: Array<{ dataset: Array<{ point: Array<{ value: Array<{ intVal: number }> }> }> }> };
      const points = stepsData.bucket?.[0]?.dataset?.[0]?.point ?? [];
      steps = points.reduce((sum, p) => sum + (p.value[0]?.intVal ?? 0), 0) || null;
    }

    if (sleepResp.ok) {
      const sleepData = await sleepResp.json() as { session?: Array<{ startTimeMillis: string; endTimeMillis: string }> };
      const sessions = sleepData.session ?? [];
      if (sessions.length > 0) {
        const longest = sessions.reduce((best, s) => {
          const dur = parseInt(s.endTimeMillis) - parseInt(s.startTimeMillis);
          const bestDur = parseInt(best.endTimeMillis) - parseInt(best.startTimeMillis);
          return dur > bestDur ? s : best;
        });
        sleepHours = Math.round(((parseInt(longest.endTimeMillis) - parseInt(longest.startTimeMillis)) / 3600000) * 10) / 10;
      }
    }

    // Upsert into health_snapshots — merge with existing data (don't overwrite if Apple Watch already has better data)
    const { data: existing } = await supabase.from('health_snapshots').select('resting_hr, steps, sleep_duration_hours, data_sources')
      .eq('user_id', userId).eq('date', dateStr).maybeSingle();

    const existingSources: any[] = existing?.data_sources ?? [];
    const newSource = { device_type: 'google_fit', synced_at: new Date().toISOString(), metrics: [] as string[] };

    const updatePayload: Record<string, unknown> = {
      user_id: userId,
      date: dateStr,
      device_type: 'google_fit',
    };

    // Only fill in Google Fit data if we don't have better data already
    if (restingHR && !existing?.resting_hr) { updatePayload.resting_hr = restingHR; newSource.metrics.push('resting_hr'); }
    if (steps && (!existing?.steps || existing.steps === 0)) { updatePayload.steps = steps; newSource.metrics.push('steps'); }
    if (sleepHours && !existing?.sleep_duration_hours) { updatePayload.sleep_duration_hours = sleepHours; newSource.metrics.push('sleep'); }

    updatePayload.data_sources = [...existingSources.filter(s => s.device_type !== 'google_fit'), newSource];
    updatePayload.hr_avg = avgHR;

    await supabase.from('health_snapshots').upsert(updatePayload, { onConflict: 'user_id,date' });
    totalDays++;

    log('day_synced', { userId, date: dateStr, restingHR, steps, sleepHours });
  }

  await recordSync(supabase, userId, 'google_fit', 'ok', totalDays);
  return { ok: true, daysProcessed: totalDays };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetUserId: string | null = body.user_id ?? null;

  const query = supabase.from('oauth_tokens').select('user_id, users!inner(timezone, active)').eq('provider', 'google').eq('users.active', true);
  if (targetUserId) query.eq('user_id', targetUserId);

  const { data: rows } = await query;
  if (!rows?.length) return new Response(JSON.stringify({ synced: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const results = await Promise.allSettled(rows.map(r => syncUserGoogleFit(supabase, r.user_id, (r.users as any).timezone ?? 'UTC')));
  const synced = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length;

  return new Response(JSON.stringify({ synced, total: rows.length }), { headers: { 'Content-Type': 'application/json' } });
});

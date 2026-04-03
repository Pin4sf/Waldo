/**
 * Waldo — baseline-updater Edge Function
 *
 * Runs nightly at 4 AM UTC (pg_cron scheduled in 20260402000002_additional_pg_cron.sql).
 * NO LLM — pure computation. Zero Claude cost.
 *
 * Per user:
 *   - HRV: 7d EMA, 30d SMA, trend direction
 *   - Sleep: 7d avg duration, avg bedtime (circular mean), avg wake time, 14d debt
 *   - Resting HR: 30d average, trend flag
 *   - Activity: 7d avg steps
 *   - Days of data count (used by pre-filter for new user detection)
 *
 * Writes to: core_memory table (key-value, user-scoped)
 * Does NOT write health values to logs (health data privacy rule).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'baseline-updater', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── EMA helper ────────────────────────────────────────────────
// alpha = 0.3 for 7-day feel (matches HEARTBEAT_BASELINE spec)
function computeEMA(values: number[], alpha = 0.3): number | null {
  if (values.length === 0) return null;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return Math.round(ema * 10) / 10;
}

function computeSMA(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// ─── Circular mean for bedtime/wake times (minutes from midnight) ─
// Handles midnight wrap-around (e.g. 23:30 and 00:30 average to 00:00, not 12:00)
function circularMeanMinutes(minuteValues: number[]): number | null {
  if (minuteValues.length === 0) return null;
  const TWO_PI = 2 * Math.PI;
  const MINUTES_IN_DAY = 1440;

  let sinSum = 0, cosSum = 0;
  for (const m of minuteValues) {
    const angle = (m / MINUTES_IN_DAY) * TWO_PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }

  const meanAngle = Math.atan2(sinSum / minuteValues.length, cosSum / minuteValues.length);
  const meanMinutes = ((meanAngle / TWO_PI) * MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return Math.round(meanMinutes);
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── 14-day weighted sleep debt ───────────────────────────────
// More recent nights count more (weight = day index, newest = 14)
function computeSleepDebt(
  sleepHoursChronological: number[], // oldest first, up to 14 values
  targetHours = 7.5,
): number {
  if (sleepHoursChronological.length === 0) return 0;
  const n = sleepHoursChronological.length;
  let weightedDebt = 0;
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const weight = i + 1; // older = lower weight
    const debt = Math.max(0, targetHours - sleepHoursChronological[i]);
    weightedDebt += debt * weight;
    totalWeight += weight;
  }
  return Math.round((weightedDebt / totalWeight) * 10) / 10;
}

// ─── Chronotype from sleep midpoint ──────────────────────────
function inferChronotype(avgBedtimeMin: number, avgWakeMin: number): 'early' | 'normal' | 'late' {
  // Normalize bedtime: if > 720 (12:00), treat as negative (e.g. 23:00 = -60)
  const adj = (m: number) => m > 720 ? m - 1440 : m;
  const midpoint = (adj(avgBedtimeMin) + adj(avgWakeMin)) / 2;
  // midpoint in adjusted minutes (negative = pre-midnight, positive = post-midnight)
  // early: midpoint < 1:30 (90 min into next day, i.e. < 90 adjusted)
  // late: midpoint > 3:30 (210 min into next day)
  const normalizedMid = ((midpoint + 1440) % 1440); // back to 0-1440
  const midHour = normalizedMid / 60;
  if (midHour >= 0 && midHour < 1.5) return 'early';
  if (midHour >= 3.5) return 'late';
  return 'normal';
}

// ─── Write core_memory entries for a user ─────────────────────
async function upsertMemoryKeys(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entries: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(entries).map(([key, value]) => ({
    user_id: userId,
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  await supabase
    .from('core_memory')
    .upsert(rows, { onConflict: 'user_id,key' });
}

// ─── Compute + store baselines for one user ────────────────────
async function updateBaselinesForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ userId: string; ok: boolean; daysOfData: number; error?: string }> {
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from('health_snapshots')
    .select('date, hrv_rmssd, resting_hr, sleep_duration_hours, sleep_bedtime, sleep_wake_time, steps')
    .eq('user_id', userId)
    .gte('date', cutoff30)
    .order('date', { ascending: true });

  if (error) {
    return { userId, ok: false, daysOfData: 0, error: error.message };
  }

  if (!rows || rows.length === 0) {
    return { userId, ok: true, daysOfData: 0 };
  }

  const daysOfData = rows.length;

  // ─── HRV ──────────────────────────────────────────────────
  const hrv7 = rows.slice(-7).map(r => r.hrv_rmssd).filter((v): v is number => v != null);
  const hrv30 = rows.map(r => r.hrv_rmssd).filter((v): v is number => v != null);
  const hrvEma7d = computeEMA(hrv7);
  const hrvSma30d = computeSMA(hrv30);
  let hrvTrend: 'up' | 'down' | 'stable' = 'stable';
  if (hrvEma7d != null && hrvSma30d != null) {
    const diff = hrvEma7d - hrvSma30d;
    if (diff > 2) hrvTrend = 'up';
    else if (diff < -2) hrvTrend = 'down';
  }

  // ─── Sleep ────────────────────────────────────────────────
  const sleep7 = rows.slice(-7).map(r => r.sleep_duration_hours).filter((v): v is number => v != null);
  const sleep14 = rows.slice(-14).map(r => r.sleep_duration_hours).filter((v): v is number => v != null);
  const sleepAvg7d = computeSMA(sleep7);
  const sleepDebt = computeSleepDebt(sleep14);

  // Bedtime circular mean
  const bedtimeMins: number[] = [];
  const wakeMins: number[] = [];
  for (const row of rows.slice(-14)) {
    if (row.sleep_bedtime) {
      const t = new Date(row.sleep_bedtime);
      bedtimeMins.push(t.getHours() * 60 + t.getMinutes());
    }
    if (row.sleep_wake_time) {
      const t = new Date(row.sleep_wake_time);
      wakeMins.push(t.getHours() * 60 + t.getMinutes());
    }
  }
  const avgBedtimeMin = circularMeanMinutes(bedtimeMins);
  const avgWakeMin = circularMeanMinutes(wakeMins);

  // ─── Resting HR ───────────────────────────────────────────
  const hr30 = rows.map(r => r.resting_hr).filter((v): v is number => v != null);
  const hrSma30d = computeSMA(hr30);
  const hrRecent5 = hr30.slice(-5);
  const hrOlder5 = hr30.slice(-10, -5);
  let hrTrend: 'elevated' | 'stable' = 'stable';
  if (hrRecent5.length >= 5 && hrOlder5.length >= 5) {
    const recentAvg = hrRecent5.reduce((a, b) => a + b, 0) / hrRecent5.length;
    const olderAvg = hrOlder5.reduce((a, b) => a + b, 0) / hrOlder5.length;
    if (recentAvg - olderAvg > 3) hrTrend = 'elevated';
  }

  // ─── Activity ─────────────────────────────────────────────
  const steps7 = rows.slice(-7).map(r => r.steps).filter((v): v is number => v != null);
  const stepsAvg7d = computeSMA(steps7);

  // ─── Chronotype (14-day, only update if enough data) ──────
  let chronotype: 'early' | 'normal' | 'late' | null = null;
  if (avgBedtimeMin != null && avgWakeMin != null && bedtimeMins.length >= 7) {
    chronotype = inferChronotype(avgBedtimeMin, avgWakeMin);
  }

  // ─── Build memory entries (no raw health values in text) ──
  const memEntries: Record<string, string> = {
    days_of_data: String(daysOfData),
    baselines_established: daysOfData >= 7 ? 'true' : 'false',
  };

  if (hrvEma7d != null) memEntries['hrv_baseline'] = `${Math.round(hrvEma7d)}ms`;
  if (hrvSma30d != null) memEntries['hrv_baseline_30d'] = `${Math.round(hrvSma30d)}ms`;
  if (hrv30.length >= 3) memEntries['hrv_trend'] = hrvTrend;
  if (sleepAvg7d != null) memEntries['sleep_avg_7d'] = `${sleepAvg7d}h`;
  if (sleepDebt > 0) memEntries['sleep_debt'] = `${sleepDebt}h`;
  if (avgBedtimeMin != null) memEntries['avg_bedtime'] = minutesToHHMM(avgBedtimeMin);
  if (avgWakeMin != null) memEntries['avg_wake_time'] = minutesToHHMM(avgWakeMin);
  if (hrSma30d != null) memEntries['resting_hr_baseline'] = `${Math.round(hrSma30d)}bpm`;
  if (hrTrend === 'elevated') memEntries['hr_trend'] = 'elevated_5d';
  if (stepsAvg7d != null) memEntries['steps_avg_7d'] = `${Math.round(stepsAvg7d)}`;
  if (chronotype) memEntries['chronotype'] = chronotype;

  await upsertMemoryKeys(supabase, userId, memEntries);

  // ─── Update users table chronotype if changed ──────────────
  if (chronotype) {
    await supabase
      .from('users')
      .update({ chronotype })
      .eq('id', userId);
  }

  return { userId, ok: true, daysOfData };
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const startMs = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Target specific user (for manual triggers) or all active users
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetUserId: string | null = body.user_id ?? null;

    const query = supabase
      .from('users')
      .select('id')
      .eq('active', true);

    if (targetUserId) query.eq('id', targetUserId);

    const { data: users, error: usersError } = await query;

    if (usersError) {
      log('error', 'users_fetch_failed', { error: usersError.message });
      return json({ error: usersError.message }, 500);
    }

    if (!users || users.length === 0) {
      return json({ updated: 0, reason: 'No active users' });
    }

    log('info', 'baseline_update_start', { user_count: users.length });

    const results = await Promise.allSettled(
      users.map(u => updateBaselinesForUser(supabase, u.id)),
    );

    let updatedCount = 0;
    let errorCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) updatedCount++;
      else errorCount++;
    }

    const latencyMs = Date.now() - startMs;
    log('info', 'baseline_update_complete', { updated: updatedCount, errors: errorCount, latency_ms: latencyMs });

    // Log to agent_logs (no health values — just counts)
    await supabase.from('agent_logs').insert({
      trace_id: crypto.randomUUID(),
      user_id: users[0].id, // system log — use first user as proxy
      trigger_type: 'baseline_update',
      tools_called: [],
      iterations: 0,
      total_tokens: 0,
      delivery_status: errorCount === 0 ? 'sent' : 'failed',
      estimated_cost_usd: 0,
      latency_ms: latencyMs,
    }).maybeSingle();

    return json({ updated: updatedCount, errors: errorCount, latency_ms: latencyMs });
  } catch (err) {
    log('error', 'run_failed', { error: err instanceof Error ? err.message : String(err) });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

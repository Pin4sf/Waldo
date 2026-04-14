/**
 * Supabase API layer — multi-user, all backends wired.
 * Replaces the local health-parser API server.
 */
/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type {
  DateEntry, DayResponse, WaldoResponse, WaldoError, MessageMode,
  SpotData, UserProfile, SyncStatus, ConversationMessage, AgentLogEntry, CoreMemoryEntry,
} from './types.js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc';

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
export const AGENT_URL = `${SUPABASE_URL}/functions/v1/invoke-agent`;
export const SUPABASE_FN_URL = `${SUPABASE_URL}/functions/v1`;

// CF Worker URL — set via env var or localStorage. When set, chat routes to DO instead of invoke-agent EF.
export const WALDO_WORKER_URL = (import.meta as any).env?.VITE_WALDO_WORKER_URL ?? localStorage.getItem('waldo_worker_url') ?? '';
export const WALDO_WORKER_SECRET = (import.meta as any).env?.VITE_WALDO_WORKER_SECRET ?? localStorage.getItem('waldo_worker_secret') ?? '';

// ─── Admin API (requires ADMIN_API_KEY) ─────────────────────────

function getAdminKey(): string {
  return (import.meta as any).env?.VITE_ADMIN_KEY ?? localStorage.getItem('waldo_admin_key') ?? '';
}

function adminHeaders() {
  return { 'Content-Type': 'application/json', 'x-admin-key': getAdminKey() };
}

export interface AdminCreateUserParams {
  name: string;
  timezone: string;
  wake_time_estimate: string;
  preferred_evening_time: string;
  wearable_type: string;
  is_admin?: boolean;
}

export async function adminCreateUser(params: AdminCreateUserParams) {
  const res = await fetch(`${SUPABASE_FN_URL}/admin/users`, {
    method: 'POST', headers: adminHeaders(), body: JSON.stringify(params),
  });
  return res.json();
}

export async function adminGenerateLinkingCode(userId: string) {
  const res = await fetch(`${SUPABASE_FN_URL}/admin/users/${userId}/link`, {
    method: 'POST', headers: adminHeaders(),
  });
  return res.json();
}

export async function adminToggleUserActive(userId: string) {
  const res = await fetch(`${SUPABASE_FN_URL}/admin/users/${userId}/toggle-active`, {
    method: 'POST', headers: adminHeaders(),
  });
  return res.json();
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Accept: 'application/json' } },
});

// ─── Users ──────────────────────────────────────────────────────

/** Fetch all active users (for multi-user switcher). */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const { data } = await supabase
    .from('users')
    .select(`
      id, name, age, timezone, chronotype, wearable_type,
      telegram_chat_id, onboarding_complete, active, is_admin,
      last_health_sync, wake_time_estimate, preferred_evening_time, created_at
    `)
    .eq('active', true)
    .order('name');

  return (data ?? []).map((u: any) => ({
    id: u.id,
    name: u.name ?? 'Unknown',
    age: u.age,
    timezone: u.timezone ?? 'UTC',
    chronotype: u.chronotype ?? 'normal',
    wearableType: u.wearable_type ?? 'unknown',
    telegramLinked: u.telegram_chat_id !== null,
    onboardingComplete: u.onboarding_complete ?? false,
    lastHealthSync: u.last_health_sync,
    wakeTimeEstimate: u.wake_time_estimate ?? '07:00',
    preferredEveningTime: u.preferred_evening_time ?? '21:00',
    createdAt: u.created_at,
  }));
}

/** Fetch single user profile + integration status. */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: u } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!u) return null;

  return {
    id: u.id,
    name: u.name ?? 'Unknown',
    age: u.age,
    timezone: u.timezone ?? 'UTC',
    chronotype: u.chronotype ?? 'normal',
    wearableType: u.wearable_type ?? 'unknown',
    telegramLinked: u.telegram_chat_id !== null,
    onboardingComplete: u.onboarding_complete ?? false,
    lastHealthSync: u.last_health_sync,
    wakeTimeEstimate: u.wake_time_estimate ?? '07:00',
    preferredEveningTime: u.preferred_evening_time ?? '21:00',
    createdAt: u.created_at,
  };
}

// ─── Dates & Day Data ───────────────────────────────────────────

/** Lightweight date list for timeline — includes time-series values for client-side historical charts. */
export async function fetchDates(userId = DEFAULT_USER_ID): Promise<DateEntry[]> {
  const [{ data: crsData }, { data: healthData }, { data: activityData }, { data: masterData }] = await Promise.all([
    supabase.from('crs_scores').select('date, score, zone').eq('user_id', userId).order('date'),
    supabase.from('health_snapshots')
      .select('date, data_tier, sleep_duration_hours, hrv_count, hrv_rmssd, resting_hr, spo2, steps')
      .eq('user_id', userId).order('date'),
    supabase.from('day_activity').select('date, morning_wag, spots_json').eq('user_id', userId),
    supabase.from('master_metrics').select('date, sleep_debt, strain').eq('user_id', userId),
  ]);

  const crsMap = new Map((crsData ?? []).map((c: any) => [c.date, c]));
  const activityMap = new Map((activityData ?? []).map((a: any) => [a.date, a]));
  const masterMap = new Map((masterData ?? []).map((m: any) => [m.date, m]));

  return (healthData ?? []).map((h: any) => {
    const crs = crsMap.get(h.date);
    const act = activityMap.get(h.date);
    const master = masterMap.get(h.date);
    return {
      date: h.date,
      crs: crs?.score ?? -1,
      zone: crs?.zone ?? 'nodata',
      tier: h.data_tier ?? 'sparse',
      signals: [],
      hasSleep: h.sleep_duration_hours !== null,
      hasHrv: (h.hrv_count ?? 0) > 0,
      hasSteps: (h.steps ?? 0) > 0,
      hasStress: false,
      fetchAlert: false,
      spotCount: (act?.spots_json ?? []).length,
      headline: '',
      morningWag: act?.morning_wag ?? null,
      // Time-series values for historical charts
      hrvAvg: h.hrv_rmssd ?? null,
      restingHR: h.resting_hr ?? null,
      sleepHours: h.sleep_duration_hours ?? null,
      sleepDebtHours: (master?.sleep_debt as any)?.debtHours ?? null,
      strainScore: (master?.strain as any)?.score ?? null,
      spO2: h.spo2 ?? null,
    };
  });
}

/** Full day data for selected date — includes baselines + yesterday comparison. */
export async function fetchDay(date: string, userId = DEFAULT_USER_ID): Promise<DayResponse> {
  // Compute yesterday's date for comparison chips
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterdayDate = d.toISOString().slice(0, 10);

  const [
    { data: crs }, { data: health }, { data: stress },
    { data: calMetrics }, { data: calEvents }, { data: emailMetrics }, { data: taskMetrics },
    { data: masterMetrics }, { data: activity }, { data: patterns },
    { data: waldoActionsRaw },
    { data: intelligence },
    { data: yCrs }, { data: yHealth }, { data: yMaster },
  ] = await Promise.all([
    supabase.from('crs_scores').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('health_snapshots').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('stress_events').select('*').eq('user_id', userId).eq('date', date),
    supabase.from('calendar_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('calendar_events').select('summary, start_time, end_time, duration_minutes, attendee_count, is_recurring, location')
      .eq('user_id', userId).eq('date', date).order('start_time', { ascending: true }),
    supabase.from('email_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('task_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('master_metrics').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('day_activity').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('patterns').select('*').eq('user_id', userId),
    supabase.from('waldo_actions').select('time, action, reason, type, trace_id')
      .eq('user_id', userId).eq('date', date).order('created_at', { ascending: true }),
    // Baselines from user_intelligence (for % comparisons + HRV badge)
    supabase.from('user_intelligence')
      .select('baselines, crs_patterns, sleep_patterns')
      .eq('user_id', userId).maybeSingle(),
    // Yesterday — for "yesterday · X" comparison chips
    supabase.from('crs_scores').select('score').eq('user_id', userId).eq('date', yesterdayDate).maybeSingle(),
    supabase.from('health_snapshots').select('sleep_duration_hours').eq('user_id', userId).eq('date', yesterdayDate).maybeSingle(),
    supabase.from('master_metrics').select('strain').eq('user_id', userId).eq('date', yesterdayDate).maybeSingle(),
  ]);

  const stressEvents = (stress ?? []).map((s: any) => ({
    startTime: s.start_time, endTime: s.end_time,
    durationMinutes: s.duration_minutes, confidence: s.confidence,
    severity: s.severity, explanation: s.explanation, components: s.components,
  }));

  // ── Compute baselines from user_intelligence ──────────────────
  const bl = intelligence?.baselines as Record<string, number> | null ?? null;
  const crsPatterns = intelligence?.crs_patterns as Record<string, number> | null ?? null;
  const sleepPatterns = intelligence?.sleep_patterns as Record<string, any> | null ?? null;

  const hrv30d: number | null = bl?.hrv30d ?? null;
  const hrv7d: number | null  = bl?.hrv7d ?? null;
  const sleep7d: number | null = bl?.sleepDuration7d ?? null;
  const rhr7d: number | null   = bl?.restingHR7d ?? null;
  const bedtime7d: number | null = bl?.bedtime7d ?? null;
  const crs30dAvg: number | null = crsPatterns?.avgScore ?? null;

  // HRV % vs 30d baseline + badge
  const todayHrv: number | null = health?.hrv_rmssd ?? null;
  const hrvPct = (todayHrv !== null && hrv30d !== null && hrv30d > 0)
    ? Math.round(((todayHrv - hrv30d) / hrv30d) * 100)
    : null;
  const hrvBadge: 'strong' | 'normal' | 'dipping' | 'low' =
    hrvPct === null ? 'normal'
    : hrvPct > 10  ? 'strong'
    : hrvPct > -5  ? 'normal'
    : hrvPct > -15 ? 'dipping'
    : 'low';

  // CRS % vs 30d baseline
  const todayCrs: number = crs?.score ?? -1;
  const crsPct = (todayCrs >= 0 && crs30dAvg !== null && crs30dAvg > 0)
    ? Math.round(((todayCrs - crs30dAvg) / crs30dAvg) * 100)
    : null;

  // Sleep minutes vs usual
  const todaySleepH: number | null = health?.sleep_duration_hours ?? null;
  const sleepMinutesVsUsual = (todaySleepH !== null && sleep7d !== null)
    ? Math.round((todaySleepH - sleep7d) * 60)
    : null;

  const baselines = bl ? {
    hrv7d, hrv30d, sleepDuration7d: sleep7d, restingHR7d: rhr7d,
    bedtime7d, crs30dAvg,
    chronotype: (bl.chronotype as unknown as string) ?? sleepPatterns?.chronotype ?? null,
    daysOfData: Number(bl.daysOfData ?? 0),
  } : null;

  return {
    date,
    crs: {
      score: crs?.score ?? -1, zone: crs?.zone ?? 'nodata',
      confidence: crs?.confidence ?? 0, componentsWithData: crs?.components_with_data ?? 0,
      // Normalize ComponentScore — old DB rows may have missing/null fields
      sleep: { score: crs?.sleep_json?.score ?? 0, factors: crs?.sleep_json?.factors ?? [], dataAvailable: crs?.sleep_json?.dataAvailable ?? false },
      hrv: { score: crs?.hrv_json?.score ?? 0, factors: crs?.hrv_json?.factors ?? [], dataAvailable: crs?.hrv_json?.dataAvailable ?? false },
      circadian: { score: crs?.circadian_json?.score ?? 0, factors: crs?.circadian_json?.factors ?? [], dataAvailable: crs?.circadian_json?.dataAvailable ?? false },
      activity: { score: crs?.activity_json?.score ?? 0, factors: crs?.activity_json?.factors ?? [], dataAvailable: crs?.activity_json?.dataAvailable ?? false },
      pillars: crs?.pillars_json ?? null,
      pillarDrag: crs?.pillar_drag_json ?? null,
      summary: crs?.summary ?? '',
      pctVsBaseline: crsPct,
      baseline30d: crs30dAvg,
    },
    stress: {
      events: stressEvents,
      peakConfidence: stressEvents.length > 0 ? Math.max(...stressEvents.map((e: any) => e.confidence)) : null,
      peakSeverity: stressEvents.length > 0 ? stressEvents.sort((a: any, b: any) => b.confidence - a.confidence)[0]?.severity : null,
      totalStressMinutes: stressEvents.reduce((s: number, e: any) => s + e.durationMinutes, 0),
      fetchAlertTriggered: stressEvents.some((e: any) => e.confidence >= 0.6),
    },
    sleep: health?.sleep_duration_hours ? {
      durationHours: health.sleep_duration_hours,
      efficiency: health.sleep_efficiency ?? 0, deepPercent: health.sleep_deep_pct ?? 0,
      remPercent: health.sleep_rem_pct ?? 0, stages: health.sleep_stages ?? { core: 0, deep: 0, rem: 0, awake: 0 },
      bedtime: health.sleep_bedtime ?? '', wakeTime: health.sleep_wake_time ?? '',
      minutesVsUsual: sleepMinutesVsUsual,
      avgHours7d: sleep7d,
    } : null,
    hrv: health?.hrv_rmssd ? {
      avg: health.hrv_rmssd, min: health.hrv_rmssd * 0.7,
      max: health.hrv_rmssd * 1.3, count: health.hrv_count,
      avg30d: hrv30d,
      pctVsBaseline: hrvPct,
      badge: hrvBadge,
    } : null,
    activity: {
      steps: health?.steps ?? 0, exerciseMinutes: health?.exercise_minutes ?? 0,
      workouts: health?.workouts ?? [], standHours: health?.stand_hours ?? 0,
      activeEnergy: health?.active_energy ?? 0,
    },
    restingHR: health?.resting_hr ?? null,
    wristTemp: health?.wrist_temp ?? null,
    spO2: health?.spo2 ?? null,
    respiratoryRate: health?.respiratory_rate ?? null,
    avgNoiseDb: health?.avg_noise_db ?? null,
    daylightMinutes: health?.daylight_minutes ?? null,
    weather: health?.weather ?? null, aqi: health?.aqi ?? null,
    aqiLabel: health?.aqi_label ?? null, pm25: health?.pm25 ?? null,
    sleepDebt: masterMetrics?.sleep_debt ?? null,
    strain: masterMetrics?.strain ?? null,
    calendar: calMetrics ? {
      meetingLoadScore: calMetrics.meeting_load_score,
      totalMeetingMinutes: calMetrics.total_meeting_minutes,
      eventCount: calMetrics.event_count, backToBackCount: calMetrics.back_to_back_count,
      focusGaps: calMetrics.focus_gaps ?? [],
      events: (calEvents ?? []).map((e: any) => ({
        name: e.summary ?? 'Untitled',
        startTime: e.start_time,
        endTime: e.end_time,
        durationMinutes: e.duration_minutes ?? 0,
        attendeeCount: e.attendee_count ?? 0,
        isRecurring: e.is_recurring ?? false,
        location: e.location ?? null,
      })),
      boundaryViolations: calMetrics.boundary_violations ?? 0,
    } : null,
    email: emailMetrics ? {
      totalEmails: emailMetrics.total_emails,
      sentCount: emailMetrics.sent_count ?? 0,
      receivedCount: emailMetrics.received_count ?? 0,
      afterHoursCount: emailMetrics.after_hours_count ?? 0,
      afterHoursRatio: emailMetrics.after_hours_ratio ?? 0,
      uniqueThreads: emailMetrics.unique_threads ?? 0,
      volumeSpike: emailMetrics.volume_spike ?? 0,
    } : null,
    tasks: taskMetrics ? {
      summary: '',
      pendingCount: taskMetrics.pending_count ?? 0,
      overdueCount: taskMetrics.overdue_count ?? 0,
      recentVelocity: taskMetrics.velocity ?? 0,
      completionRate: taskMetrics.completion_rate ?? 0,
      urgencyQueue: taskMetrics.pending_titles ?? [],
    } : null,
    cognitiveLoad: masterMetrics?.cognitive_load ? (() => {
      const cl = masterMetrics.cognitive_load;
      const components = cl.components ?? {};
      const vals = [components.sleepDebtImpact, components.meetingLoad, components.communicationLoad, components.taskLoad]
        .filter((v: any) => v !== null && v !== undefined && !isNaN(Number(v)));
      const computedScore = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + Number(b), 0) / vals.length) : null;
      const rawScore = Number(cl.score);
      return {
        ...cl,
        score: (!isNaN(rawScore) && rawScore !== null) ? rawScore : computedScore,
        // Sanitize summary to remove NaN artifacts from old DB rows
        summary: cl.summary ? String(cl.summary).replace(/NaN\/\d+/g, '--/100').replace(/NaN/g, '--') : cl.summary,
        components: {
          sleepDebtImpact: Number(components.sleepDebtImpact) || 0,
          meetingLoad: Number(components.meetingLoad) || 0,
          communicationLoad: Number(components.communicationLoad) || 0,
          taskLoad: Number(components.taskLoad) || 0,
        },
      };
    })() : null,
    burnoutTrajectory: masterMetrics?.burnout_trajectory ?? null,
    resilience: masterMetrics?.resilience ?? null,
    crossSourceInsights: masterMetrics?.cross_source_insights ?? [],
    patterns: (patterns ?? []).map((p: any) => ({
      id: p.id, type: p.type, confidence: p.confidence,
      summary: p.summary, evidenceCount: p.evidence_count,
    })),
    waldoActions: (waldoActionsRaw ?? []).map((a: any) => ({
      time: a.time, action: a.action, reason: a.reason,
      type: a.type as 'proactive' | 'reactive' | 'learning',
    })),
    dayActivity: activity ? {
      date: activity.date ?? date, headline: activity.headline ?? '',
      morningWag: activity.morning_wag ?? null, spots: activity.spots_json ?? [],
      eveningReview: activity.evening_review ?? null,
      fetchAlertFired: activity.fetch_alert_fired ?? false, tier: activity.tier ?? 'sparse',
    } : null,
    yesterday: {
      crs: (yCrs as any)?.score ?? null,
      sleepHours: (yHealth as any)?.sleep_duration_hours ?? null,
      strain: (yMaster as any)?.strain?.score ?? null,
    },
    baselines,
  } as DayResponse;
}

// ─── Trend / Slope ───────────────────────────────────────────────

import type { TrendData, TrendDimension, TrendDirection } from './types.js';

/**
 * fetchTrend — The Slope card data.
 *
 * Queries 56 days (8 weeks) across all 6 dimensions.
 * Compares week 1 (oldest 7 days) vs week 8 (most recent 7 days).
 * Returns per-dimension direction: improving | stable | declining.
 *
 * Significance threshold: >5% change = directional, else stable.
 * Higher-is-better: Body, Mood, Screen.
 * Lower-is-better: Schedule (MLS), Communication (after-hours %), Tasks (overdue).
 */
export async function fetchTrend(userId = DEFAULT_USER_ID): Promise<TrendData> {
  const now = new Date();
  const date56ago = new Date(now.getTime() - 56 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Week 1 = 56–49 days ago (oldest)   Week 8 = 7–0 days ago (most recent)
  const w1Start = new Date(now.getTime() - 56 * 86400000).toISOString().slice(0, 10);
  const w1End   = new Date(now.getTime() - 49 * 86400000).toISOString().slice(0, 10);
  const w8Start = new Date(now.getTime() -  7 * 86400000).toISOString().slice(0, 10);
  const w8End   = today;

  const [
    { data: crsAll }, { data: calAll }, { data: emailAll },
    { data: taskAll }, { data: moodAll }, { data: screenAll },
    { data: masterAll },
  ] = await Promise.all([
    supabase.from('crs_scores').select('date, score')
      .eq('user_id', userId).gte('score', 0)
      .gte('date', date56ago).lte('date', today),
    supabase.from('calendar_metrics').select('date, meeting_load_score')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
    supabase.from('email_metrics').select('date, after_hours_ratio, total_emails')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
    supabase.from('task_metrics').select('date, overdue_count, pending_count')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
    supabase.from('mood_metrics').select('date, mood_score, avg_valence, avg_energy')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
    supabase.from('screen_time_metrics').select('date, productivity_score')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
    supabase.from('master_metrics').select('date, cognitive_load')
      .eq('user_id', userId)
      .gte('date', date56ago).lte('date', today),
  ]);

  // ── Helpers ────────────────────────────────────────────────────
  function weekAvg(rows: Array<Record<string, unknown>> | null, key: string, start: string, end: string): number | null {
    if (!rows?.length) return null;
    const vals = rows
      .filter((r: any) => r.date >= start && r.date <= end)
      .map((r: any) => Number(r[key]))
      .filter(v => !isNaN(v) && v >= 0);
    return vals.length > 0 ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  }

  function direction(w1: number | null, w8: number | null, higherIsBetter: boolean, threshold = 0.05): TrendDirection {
    if (w1 === null || w8 === null || w1 === 0) return 'stable';
    const pct = (w8 - w1) / Math.abs(w1);
    if (Math.abs(pct) < threshold) return 'stable';
    const up = pct > 0;
    return (higherIsBetter ? up : !up) ? 'improving' : 'declining';
  }

  // ── Body (CRS score — higher = better) ────────────────────────
  const bodyW1  = weekAvg(crsAll as any, 'score', w1Start, w1End);
  const bodyW8  = weekAvg(crsAll as any, 'score', w8Start, w8End);

  // ── Schedule (Meeting Load Score — lower = better) ─────────────
  const schedW1 = weekAvg(calAll as any, 'meeting_load_score', w1Start, w1End);
  const schedW8 = weekAvg(calAll as any, 'meeting_load_score', w8Start, w8End);

  // ── Communication (after-hours ratio % — lower = better) ───────
  const commsW1Raw = weekAvg(emailAll as any, 'after_hours_ratio', w1Start, w1End);
  const commsW8Raw = weekAvg(emailAll as any, 'after_hours_ratio', w8Start, w8End);
  const commsW1 = commsW1Raw !== null ? +(commsW1Raw * 100).toFixed(1) : null;
  const commsW8 = commsW8Raw !== null ? +(commsW8Raw * 100).toFixed(1) : null;

  // ── Tasks (overdue count — lower = better) ─────────────────────
  const tasksW1 = weekAvg(taskAll as any, 'overdue_count', w1Start, w1End);
  const tasksW8 = weekAvg(taskAll as any, 'overdue_count', w8Start, w8End);

  // ── Mood (mood_score 0-100 — higher = better) ──────────────────
  // Compute from avg_valence × 0.6 + avg_energy × 0.4 if mood_score absent
  const moodRows = (moodAll ?? []) as Array<Record<string, any>>;
  const moodScore = (row: Record<string, any>) => {
    if (row.mood_score != null) return Number(row.mood_score);
    const v = Number(row.avg_valence ?? 0), e = Number(row.avg_energy ?? 0);
    return v > 0 || e > 0 ? Math.round(v * 60 + e * 40) : null;
  };
  const moodW1 = moodRows.filter(r => r.date >= w1Start && r.date <= w1End).length > 0
    ? +(moodRows.filter(r => r.date >= w1Start && r.date <= w1End)
        .map(moodScore).filter((v): v is number => v !== null)
        .reduce((s, v, _, a) => s + v / a.length, 0)).toFixed(1)
    : null;
  const moodW8 = moodRows.filter(r => r.date >= w8Start && r.date <= w8End).length > 0
    ? +(moodRows.filter(r => r.date >= w8Start && r.date <= w8End)
        .map(moodScore).filter((v): v is number => v !== null)
        .reduce((s, v, _, a) => s + v / a.length, 0)).toFixed(1)
    : null;

  // ── Screen (productivity_score 0-100 — higher = better) ────────
  const screenW1 = weekAvg(screenAll as any, 'productivity_score', w1Start, w1End);
  const screenW8 = weekAvg(screenAll as any, 'productivity_score', w8Start, w8End);

  const dimensions: TrendDimension[] = [
    {
      key: 'body', label: 'Body',
      weekOneValue: bodyW1, weekFourValue: bodyW8,
      direction: direction(bodyW1, bodyW8, true),
      unit: 'pts', higherIsBetter: true,
      available: (crsAll?.length ?? 0) > 0,
    },
    {
      key: 'schedule', label: 'Schedule',
      weekOneValue: schedW1, weekFourValue: schedW8,
      direction: direction(schedW1, schedW8, false),
      unit: 'MLS', higherIsBetter: false,
      available: (calAll?.length ?? 0) > 0,
    },
    {
      key: 'communication', label: 'Communication',
      weekOneValue: commsW1, weekFourValue: commsW8,
      direction: direction(commsW1, commsW8, false),
      unit: '%', higherIsBetter: false,
      available: (emailAll?.length ?? 0) > 0,
    },
    {
      key: 'tasks', label: 'Tasks',
      weekOneValue: tasksW1, weekFourValue: tasksW8,
      direction: direction(tasksW1, tasksW8, false),
      unit: 'overdue', higherIsBetter: false,
      available: (taskAll?.length ?? 0) > 0,
    },
    {
      key: 'mood', label: 'Mood',
      weekOneValue: moodW1, weekFourValue: moodW8,
      direction: direction(moodW1, moodW8, true),
      unit: 'score', higherIsBetter: true,
      available: (moodAll?.length ?? 0) > 0,
    },
    {
      key: 'screen', label: 'Screen',
      weekOneValue: screenW1, weekFourValue: screenW8,
      direction: direction(screenW1, screenW8, true),
      unit: '%', higherIsBetter: true,
      available: (screenAll?.length ?? 0) > 0,
    },
  ];

  // Overall direction: majority vote among available dimensions
  const available = dimensions.filter(d => d.available);
  const improving = available.filter(d => d.direction === 'improving').length;
  const declining = available.filter(d => d.direction === 'declining').length;
  const overallDirection: TrendDirection = improving > declining ? 'improving'
    : declining > improving ? 'declining'
    : 'stable';

  const allDates = [...new Set([
    ...(crsAll ?? []).map((r: any) => r.date),
    ...(calAll ?? []).map((r: any) => r.date),
    ...(emailAll ?? []).map((r: any) => r.date),
  ])];

  return {
    dimensions,
    rangeLabel: '4-week direction',
    daysAnalysed: allDates.length,
    overallDirection,
  };
}

// ─── Agent ───────────────────────────────────────────────────────

/**
 * Call Waldo agent — smart routing across 3 compute layers:
 *   L1: invoke-agent EF (simple chat — fast, stateless, cheap)
 *   L2: CF Worker DO (complex queries, proactive triggers — persistent memory, ReAct)
 *
 * Routing: proactive triggers + complex queries → L2, simple chat → L1.
 * If CF Worker not deployed, everything goes to L1 gracefully.
 */
const COMPLEX_PATTERNS = [
  /pattern|constellation|trend|over time|this week|last week|compare/i,
  /remember|you told me|last time|previously|you said/i,
  /why.*(score|crs|nap|sleep|stress|hrv)/i,
  /what should|suggest|recommend|plan|schedule/i,
  /correlation|connect|relationship between/i,
  /update.*memory|learn|note that|remember this/i,
];

function needsL2(question: string | undefined, mode: MessageMode): boolean {
  if (['morning_wag', 'fetch_alert', 'evening_review', 'onboarding'].includes(mode)) return true;
  if (!question) return false;
  if (COMPLEX_PATTERNS.some(p => p.test(question))) return true;
  if (question.length > 200) return true;
  return false;
}

export async function callWaldo(
  date: string,
  mode: MessageMode,
  question?: string,
  userId = DEFAULT_USER_ID,
): Promise<WaldoResponse | WaldoError> {
  const useL2 = WALDO_WORKER_URL && needsL2(question, mode);

  // L2: CF Worker DO (complex queries, triggers)
  if (useL2) {
    try {
      const endpoint = question
        ? `${WALDO_WORKER_URL}/chat/${userId}`
        : `${WALDO_WORKER_URL}/trigger/${userId}`;
      const body = question
        ? { message: question, channel: 'web' }
        : { trigger_type: mode };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WALDO_WORKER_SECRET ? { 'x-waldo-secret': WALDO_WORKER_SECRET } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          message: data.reply ?? 'No response.',
          zone: data.zone ?? 'moderate',
          mode: data.mode ?? mode,
          tokensIn: data.tokens_in ?? 0,
          tokensOut: data.tokens_out ?? 0,
          responseTimeMs: data.latencyMs ?? 0,
          crsScore: data.crs_score,
          iterations: data.iterations ?? 0,
          toolsCalled: data.tools_called ?? [],
          method: `L2:${data.provider ?? 'claude'}`,
          fallback: false,
        } as WaldoResponse;
      }
      console.warn(`[Waldo] L2 returned ${res.status}, falling to L1`);
    } catch (err) {
      console.warn('[Waldo] L2 unreachable, falling to L1:', err);
    }
  }

  // L1: invoke-agent Edge Function (simple chat, or L2 fallback)
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ user_id: userId, trigger_type: mode, date, question, channel: 'web' }),
  });

  const data = await res.json();
  if (data.error && !data.message) return { error: data.error } as WaldoError;

  return {
    message: data.message ?? 'No response.',
    zone: data.zone ?? 'moderate',
    mode: data.mode ?? mode,
    tokensIn: data.tokens_in ?? 0,
    tokensOut: data.tokens_out ?? 0,
    responseTimeMs: data.latency_ms ?? 0,
    crsScore: data.crs_score,
    iterations: data.iterations ?? 0,
    toolsCalled: data.tools_called ?? [],
    method: `L1:${data.method ?? 'claude'}`,
    fallback: data.method === 'template' || !!data.fallback,
  } as WaldoResponse;
}

// ─── Spots & Constellation ──────────────────────────────────────

/** Fetch spots (scoped to user, last 90 days). */
export async function fetchSpots(userId = DEFAULT_USER_ID, days = 90): Promise<SpotData[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('spots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false });

  return (data ?? []).map((s: any) => ({
    id: s.id, date: s.date, time: s.time, type: s.type,
    severity: s.severity, title: s.title, detail: s.detail, signals: s.signals ?? [],
  }));
}

/** Fetch learning timeline. */
export async function fetchLearningTimeline(userId = DEFAULT_USER_ID) {
  const { data } = await supabase.from('learning_timeline').select('*').eq('user_id', userId).maybeSingle();
  return {
    intelligenceScore: data?.intelligence_score ?? 0,
    totalDaysObserved: data?.total_days ?? 0,
    totalSpotsGenerated: data?.total_observations ?? 0,
    dataSources: data?.connected_sources ?? [],
    connectedSources: data?.connected_sources ?? [],
    milestones: data?.milestones ?? [],
    summary: '',
  };
}

/** Fetch patterns (scoped to user). */
export async function fetchPatterns(userId = DEFAULT_USER_ID) {
  const { data } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)
    .order('evidence_count', { ascending: false });
  return (data ?? []).map((p: any) => ({
    id: p.id, type: p.type, confidence: p.confidence,
    summary: p.summary, evidenceCount: p.evidence_count,
    firstSeen: p.first_seen, lastSeen: p.last_seen,
  }));
}

/** Fetch summary. */
export async function fetchSummary(userId = DEFAULT_USER_ID) {
  const [{ data: user }, { data: intel }, { data: timeline }, { count: totalDays }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_intelligence').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('learning_timeline').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('health_snapshots').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  const [{ count: richDays }] = await Promise.all([
    supabase.from('health_snapshots').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('data_tier', 'rich'),
  ]);

  return {
    profile: {
      name: user?.name ?? 'User',
      age: user?.age ?? null,
      biologicalSex: 'Unknown',
    },
    recordCounts: { hr: 0, hrv: 0, sleep: 0, spo2: 0, steps: 0, workouts: 0, activityDays: 0 },
    dateRange: { start: '', end: '' },
    richDayCount: richDays ?? 0,
    totalDays: totalDays ?? 0,
    exportDate: '',
    userIntelligence: intel?.summary ?? '',
    intelligenceScore: timeline?.intelligence_score ?? 0,
    connectedSources: timeline?.connected_sources ?? [],
  };
}

// ─── Integrations ────────────────────────────────────────────────

/** Fetch ALL integration statuses + sync logs for a user. */
export async function fetchSyncStatus(userId = DEFAULT_USER_ID): Promise<SyncStatus[]> {
  const [
    { data: tokens }, { data: logs },
    { data: healthRow }, { data: userRow }, { data: weatherRow },
  ] = await Promise.all([
    supabase.from('oauth_tokens').select('provider, scopes, expires_at, updated_at').eq('user_id', userId),
    supabase.from('sync_log').select('provider, last_sync_at, last_sync_status, records_synced, last_error').eq('user_id', userId),
    // Health data: connected if any snapshot has real biometric data
    supabase.from('health_snapshots').select('date').eq('user_id', userId)
      .not('hrv_rmssd', 'is', null).limit(1).maybeSingle(),
    // Telegram: connected if user has a chat ID linked
    supabase.from('users').select('telegram_chat_id').eq('id', userId).maybeSingle(),
    // Weather: connected if any snapshot has weather enrichment
    supabase.from('health_snapshots').select('date').eq('user_id', userId)
      .not('weather', 'is', null).limit(1).maybeSingle(),
  ]);

  const googleToken  = tokens?.find((t: any) => t.provider === 'google') ?? null;
  const spotifyToken = tokens?.find((t: any) => t.provider === 'spotify') ?? null;
  const todoistToken = tokens?.find((t: any) => t.provider === 'todoist') ?? null;
  const stravaToken  = tokens?.find((t: any) => t.provider === 'strava') ?? null;

  const hasHealthData = healthRow !== null;
  const hasTelegram   = userRow?.telegram_chat_id !== null && userRow?.telegram_chat_id !== undefined;
  const hasWeather    = weatherRow !== null;

  const log = (provider: string) => (logs ?? []).find((l: any) => l.provider === provider) ?? null;

  const makeStatus = (
    provider: string, label: string, connected: boolean, syncLog: any = null, tokenExpiry: string | null = null,
  ): SyncStatus => ({
    provider, label, connected,
    status: !connected ? 'not_connected'
      : syncLog?.last_sync_status === 'ok' ? 'ok'
      : syncLog?.last_sync_status ?? 'active',
    lastSyncAt: syncLog?.last_sync_at ?? null,
    recordsSynced: syncLog?.records_synced ?? 0,
    lastError: syncLog?.last_error ?? null,
    tokenExpiry,
  });

  return [
    // ── Health ─────────────────────────────────────────────────────
    makeStatus('apple_health', 'Apple Health / XML', hasHealthData),
    makeStatus('google_fit',   'Google Fit (Android)', !!googleToken, log('google_fit'), googleToken?.expires_at),
    // ── Google Workspace ───────────────────────────────────────────
    makeStatus('google_calendar', 'Google Calendar', !!googleToken, log('google_calendar'), googleToken?.expires_at),
    makeStatus('gmail',           'Gmail',            !!googleToken, log('gmail'),           googleToken?.expires_at),
    makeStatus('google_tasks',    'Google Tasks',     !!googleToken, log('google_tasks'),    googleToken?.expires_at),
    // ── 3rd Party ──────────────────────────────────────────────────
    makeStatus('spotify', 'Spotify',  !!spotifyToken, log('spotify')),
    makeStatus('todoist', 'Todoist',  !!todoistToken, log('todoist')),
    makeStatus('strava',  'Strava',   !!stravaToken,  log('strava')),
    // ── Always-on infrastructure ───────────────────────────────────
    makeStatus('telegram', 'Telegram Bot', hasTelegram),
    makeStatus('weather',  'Weather + AQI', hasWeather),
  ];
}

/** Get the Google OAuth connect URL for a user. */
/** Google Workspace + Fit connect URL. Includes fitness scopes for Android health data. */
export function getGoogleConnectUrl(userId: string, includeFit = false): string {
  // Always include write scopes so The Adjustment (calendar.events + tasks write) works
  const scopes = includeFit
    ? 'calendar,calendar_write,gmail,tasks,tasks_write,youtube,fit_heart,fit_sleep,fit_steps'
    : 'calendar,calendar_write,gmail,tasks,tasks_write,youtube';
  return `${SUPABASE_FN_URL}/oauth-google/connect?user_id=${userId}&scopes=${scopes}`;
}

/** Spotify connect URL. */
export function getSpotifyConnectUrl(userId: string): string {
  return `${SUPABASE_FN_URL}/oauth-spotify/connect?user_id=${userId}`;
}

/** Todoist connect URL. */
export function getTodoistConnectUrl(userId: string): string {
  return `${SUPABASE_FN_URL}/oauth-todoist/connect?user_id=${userId}`;
}

/** Strava connect URL. */
export function getStravaConnectUrl(userId: string): string {
  return `${SUPABASE_FN_URL}/oauth-strava/connect?user_id=${userId}`;
}

/** Notion connect URL. */
export function getNotionConnectUrl(userId: string): string {
  return `${SUPABASE_FN_URL}/oauth-notion/connect?user_id=${userId}`;
}

/** Check Spotify connection status for a user. */
export async function fetchSpotifyStatus(userId: string): Promise<{ connected: boolean; lastSyncAt: string | null; status: string }> {
  const { data } = await supabase
    .from('sync_log')
    .select('last_sync_at, last_sync_status')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .maybeSingle();
  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .maybeSingle();
  return {
    connected: token !== null,
    lastSyncAt: data?.last_sync_at ?? null,
    status: !token ? 'not_connected' : (data?.last_sync_status ?? 'pending'),
  };
}

/**
 * Disconnect a provider — calls the disconnect-provider Edge Function (service_role).
 * Direct Supabase client deletes won't work here because oauth_tokens RLS
 * only allows service_role deletes — not the anon key the frontend uses.
 */
export async function disconnectProvider(provider: 'google' | 'spotify' | 'todoist' | 'strava' | 'notion', userId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_FN_URL}/disconnect-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ user_id: userId, provider }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Disconnect failed');
  }
}

/** Manually trigger a sync for a provider. */
export async function triggerSync(provider: string, userId: string): Promise<void> {
  const fnMap: Record<string, string> = {
    google_calendar: 'sync-google-calendar',
    gmail: 'sync-gmail',
    google_tasks: 'sync-tasks',
    spotify: 'sync-spotify',
    youtube_music: 'sync-youtube-music',
    google_fit: 'sync-google-fit',
    todoist: 'sync-todoist',
    strava: 'sync-strava',
    notion: 'sync-notion',
    rescuetime: 'sync-rescuetime',
  };
  const fn = fnMap[provider];
  if (!fn) return;
  await fetch(`${SUPABASE_FN_URL}/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ user_id: userId }),
  }).catch(() => {});
}

// ─── Conversation History ────────────────────────────────────────

/** Fetch recent conversation history for a user. */
export async function fetchConversationHistory(
  userId = DEFAULT_USER_ID,
  limit = 50,
): Promise<ConversationMessage[]> {
  const { data } = await supabase
    .from('conversation_history')
    .select('id, role, content, mode, channel, created_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse().map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    mode: m.mode,
    channel: m.channel,
    createdAt: m.created_at,
    metadata: m.metadata,
  }));
}

// ─── Core Memory ─────────────────────────────────────────────────

/** Fetch all core memory entries for a user. */
export async function fetchCoreMemory(userId = DEFAULT_USER_ID): Promise<CoreMemoryEntry[]> {
  const { data } = await supabase
    .from('core_memory')
    .select('id, key, value, updated_at')
    .eq('user_id', userId)
    .order('key');

  return (data ?? []).map((m: any) => ({
    id: m.id, key: m.key, value: m.value, updatedAt: m.updated_at,
  }));
}

// ─── Agent Logs ──────────────────────────────────────────────────

/** Fetch recent agent invocation logs. */
export async function fetchAgentLogs(
  userId = DEFAULT_USER_ID,
  limit = 20,
): Promise<AgentLogEntry[]> {
  const { data } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((l: any) => ({
    id: l.id,
    traceId: l.trace_id,
    triggerType: l.trigger_type,
    toolsCalled: l.tools_called ?? [],
    iterations: l.iterations ?? 0,
    totalTokens: l.total_tokens ?? 0,
    latencyMs: l.latency_ms ?? 0,
    deliveryStatus: l.delivery_status,
    llmFallbackLevel: l.llm_fallback_level ?? 1,
    estimatedCostUsd: l.estimated_cost_usd ?? 0,
    createdAt: l.created_at,
  }));
}

/** Trigger bootstrap — one-time historical intelligence analysis. Produces workspace files. */
export async function triggerBootstrap(userId: string): Promise<{
  status: string;
  files_written: string[];
  spots_generated: number;
  data_summary: Record<string, unknown>;
  latency_ms: number;
  error?: string;
}> {
  const res = await fetch(`${SUPABASE_FN_URL}/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ user_id: userId, source: 'dashboard_trigger' }),
  });
  return res.json();
}

/** Trigger build-intelligence pipeline to generate spots, baselines, patterns from historical data. */
export async function triggerBuildIntelligence(userId: string): Promise<{
  spots_generated: number;
  baselines_computed: number;
  patterns_promoted: number;
  user_intelligence_built: boolean;
  latency_ms: number;
  message: string;
  error?: string;
}> {
  const res = await fetch(`${SUPABASE_FN_URL}/build-intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ user_id: userId, source: 'dashboard_trigger' }),
  });
  return res.json();
}

// ─── Proposals (The Adjustment / TheHandoff) ─────────────────────

/** Fetch pending proposals for the user — shown in TheHandoff card. */
export async function fetchProposals(userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('waldo_proposals')
    .select('id, type, title, description, impact, status, expires_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return null;
  const p = data?.[0];
  if (!p) return null;
  return {
    id: p.id, type: p.type, title: p.title,
    description: p.description ?? null, impact: p.impact ?? null,
    status: p.status, expiresAt: p.expires_at, createdAt: p.created_at,
  };
}

/** Approve or reject a proposal — calls execute-proposal Edge Function. */
export async function resolveProposal(
  proposalId: string,
  action: 'approve' | 'reject',
): Promise<{ status: string; executed?: number; errors?: string[] }> {
  const res = await fetch(`${SUPABASE_FN_URL}/execute-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ proposal_id: proposalId, action }),
  });
  return res.json();
}

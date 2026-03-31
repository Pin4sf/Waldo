/**
 * Supabase API layer — replaces the local health-parser API server.
 * Maps the same endpoints (dates, day, waldo, spots) to Supabase queries.
 */
/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { DateEntry, DayResponse, WaldoResponse, WaldoError, MessageMode, SpotData } from './types.js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: { 'Accept': 'application/json' },
  },
});

export const AGENT_URL = `${SUPABASE_URL}/functions/v1/invoke-agent`;

/** Fetch all dates with CRS scores — lightweight, no spots payload */
export async function fetchDates(): Promise<DateEntry[]> {
  // Only fetch lightweight columns — NO spots_json (which is 619KB for 856 days)
  const [{ data: crsData }, { data: healthData }] = await Promise.all([
    supabase.from('crs_scores').select('date, score, zone').eq('user_id', DEMO_USER_ID).order('date'),
    supabase.from('health_snapshots').select('date, data_tier, sleep_duration_hours, hrv_count, steps').eq('user_id', DEMO_USER_ID).order('date'),
  ]);

  const crsMap = new Map((crsData ?? []).map(c => [c.date, c]));

  return (healthData ?? []).map(h => {
    const crs = crsMap.get(h.date);
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
      spotCount: 0, // loaded on day select, not on initial load
      headline: '',
      morningWag: null, // loaded on day select
    };
  });
}

/** Fetch full day data for a specific date */
export async function fetchDay(date: string): Promise<DayResponse> {
  const [
    { data: crs },
    { data: health },
    { data: stress },
    { data: calMetrics },
    { data: emailMetrics },
    { data: taskMetrics },
    { data: masterMetrics },
    { data: activity },
    { data: patterns },
  ] = await Promise.all([
    supabase.from('crs_scores').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('health_snapshots').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('stress_events').select('*').eq('user_id', DEMO_USER_ID).eq('date', date),
    supabase.from('calendar_metrics').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('email_metrics').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('task_metrics').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('master_metrics').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('day_activity').select('*').eq('user_id', DEMO_USER_ID).eq('date', date).maybeSingle(),
    supabase.from('patterns').select('*').eq('user_id', DEMO_USER_ID),
  ]);

  const stressEvents = (stress ?? []).map((s: any) => ({
    startTime: s.start_time,
    endTime: s.end_time,
    durationMinutes: s.duration_minutes,
    confidence: s.confidence,
    severity: s.severity,
    explanation: s.explanation,
    components: s.components,
  }));

  return {
    date,
    crs: {
      score: crs?.score ?? -1,
      zone: crs?.zone ?? 'nodata',
      confidence: crs?.confidence ?? 0,
      componentsWithData: crs?.components_with_data ?? 0,
      sleep: crs?.sleep_json ?? { score: 0, factors: [], dataAvailable: false },
      hrv: crs?.hrv_json ?? { score: 0, factors: [], dataAvailable: false },
      circadian: crs?.circadian_json ?? { score: 0, factors: [], dataAvailable: false },
      activity: crs?.activity_json ?? { score: 0, factors: [], dataAvailable: false },
      summary: crs?.summary ?? '',
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
      efficiency: health.sleep_efficiency ?? 0,
      deepPercent: health.sleep_deep_pct ?? 0,
      remPercent: health.sleep_rem_pct ?? 0,
      stages: health.sleep_stages ?? { core: 0, deep: 0, rem: 0, awake: 0 },
      bedtime: health.sleep_bedtime ?? '',
      wakeTime: health.sleep_wake_time ?? '',
    } : null,
    hrv: health?.hrv_rmssd ? {
      avg: health.hrv_rmssd,
      min: health.hrv_rmssd * 0.7,
      max: health.hrv_rmssd * 1.3,
      count: health.hrv_count,
    } : null,
    activity: {
      steps: health?.steps ?? 0,
      exerciseMinutes: health?.exercise_minutes ?? 0,
      workouts: health?.workouts ?? [],
      standHours: health?.stand_hours ?? 0,
      activeEnergy: health?.active_energy ?? 0,
    },
    restingHR: health?.resting_hr ?? null,
    wristTemp: health?.wrist_temp ?? null,
    avgNoiseDb: health?.avg_noise_db ?? null,
    daylightMinutes: health?.daylight_minutes ?? null,
    weather: health?.weather ?? null,
    aqi: health?.aqi ?? null,
    aqiLabel: health?.aqi_label ?? null,
    pm25: health?.pm25 ?? null,
    sleepDebt: masterMetrics?.sleep_debt ?? null,
    strain: masterMetrics?.strain ?? null,
    calendar: calMetrics ? {
      meetingLoadScore: calMetrics.meeting_load_score,
      totalMeetingMinutes: calMetrics.total_meeting_minutes,
      eventCount: calMetrics.event_count,
      backToBackCount: calMetrics.back_to_back_count,
      focusGaps: calMetrics.focus_gaps ?? [],
      events: [],
    } : null,
    email: emailMetrics ? {
      totalEmails: emailMetrics.total_emails,
      sentCount: emailMetrics.sent_count,
      receivedCount: emailMetrics.received_count,
      afterHoursCount: emailMetrics.after_hours_count,
      afterHoursRatio: emailMetrics.after_hours_ratio,
      uniqueThreads: emailMetrics.unique_threads,
      volumeSpike: emailMetrics.volume_spike,
    } : null,
    tasks: taskMetrics ? {
      summary: '',
      pendingCount: taskMetrics.pending_count,
      overdueCount: taskMetrics.overdue_count,
      recentVelocity: taskMetrics.velocity,
      completionRate: taskMetrics.completion_rate,
    } : null,
    cognitiveLoad: masterMetrics?.cognitive_load ? (() => {
      const cl = masterMetrics.cognitive_load;
      // Fix NaN/null score — recompute from available components
      const components = cl.components ?? {};
      const vals = [components.sleepDebtImpact, components.meetingLoad, components.communicationLoad, components.taskLoad].filter((v: any) => v !== null && v !== undefined && !isNaN(v));
      const computedScore = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
      return {
        ...cl,
        score: (cl.score !== null && cl.score !== undefined && !isNaN(cl.score)) ? cl.score : computedScore,
        components: {
          sleepDebtImpact: components.sleepDebtImpact ?? 0,
          meetingLoad: components.meetingLoad ?? 0,
          communicationLoad: components.communicationLoad ?? 0,
          taskLoad: components.taskLoad ?? 0,
        },
      };
    })() : null,
    burnoutTrajectory: masterMetrics?.burnout_trajectory ?? null,
    resilience: masterMetrics?.resilience ?? null,
    crossSourceInsights: masterMetrics?.cross_source_insights ?? [],
    patterns: (patterns ?? []).map((p: any) => ({
      id: p.id,
      type: p.type,
      confidence: p.confidence,
      summary: p.summary,
      evidenceCount: p.evidence_count,
    })),
    waldoActions: activity?.actions_json ?? [],
    dayActivity: activity ? {
      date: activity.date ?? date,
      headline: activity.headline ?? '',
      morningWag: activity.morning_wag ?? null,
      spots: activity.spots_json ?? [],
      eveningReview: activity.evening_review ?? null,
      fetchAlertFired: activity.fetch_alert_fired ?? false,
      tier: activity.tier ?? 'sparse',
    } : null,
  } as DayResponse;
}

/** Call invoke-agent Edge Function */
export async function callWaldo(date: string, mode: MessageMode, question?: string): Promise<WaldoResponse | WaldoError> {
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: DEMO_USER_ID,
      trigger_type: mode,
      date,
      question,
      channel: 'web',
    }),
  });

  const data = await res.json();

  if (data.fallback || data.error) {
    return { error: data.error ?? data.message } as WaldoError;
  }

  return {
    message: data.message,
    zone: data.zone,
    mode: data.mode,
    tokensIn: data.tokens_in,
    tokensOut: data.tokens_out,
    responseTimeMs: data.latency_ms,
  } as WaldoResponse;
}

/** Fetch all spots for constellation view */
export async function fetchSpots(): Promise<SpotData[]> {
  const { data } = await supabase
    .from('spots')
    .select('*')
    .eq('user_id', DEMO_USER_ID)
    .order('date', { ascending: false });

  return (data ?? []).map((s: any) => ({
    id: s.id,
    date: s.date,
    time: s.time,
    type: s.type,
    severity: s.severity,
    title: s.title,
    detail: s.detail,
    signals: s.signals ?? [],
  }));
}

/** Fetch learning timeline (milestones, intelligence score) */
export async function fetchLearningTimeline() {
  const { data } = await supabase.from('learning_timeline').select('*').eq('user_id', DEMO_USER_ID).maybeSingle();
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

/** Fetch patterns for constellation */
export async function fetchPatterns() {
  const { data } = await supabase.from('patterns').select('*').eq('user_id', DEMO_USER_ID);
  return (data ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    confidence: p.confidence,
    summary: p.summary,
    evidenceCount: p.evidence_count,
  }));
}

/** Fetch summary data — matches SummaryResponse shape expected by App.tsx */
export async function fetchSummary() {
  const { data: user } = await supabase.from('users').select('*').eq('id', DEMO_USER_ID).maybeSingle();
  const { data: intel } = await supabase.from('user_intelligence').select('*').eq('user_id', DEMO_USER_ID).maybeSingle();
  const { data: timeline } = await supabase.from('learning_timeline').select('*').eq('user_id', DEMO_USER_ID).maybeSingle();
  const { count: totalDays } = await supabase.from('health_snapshots').select('*', { count: 'exact', head: true }).eq('user_id', DEMO_USER_ID);

  return {
    // Match the shape App.tsx expects (same as local API's /api/summary)
    profile: {
      name: user?.name ?? 'Ark',
      age: user?.age ?? 22,
      biologicalSex: 'Male', // Ark is male
    },
    recordCounts: { hr: 0, hrv: 0, sleep: 0, spo2: 0, steps: 0, workouts: 0, activityDays: 0 },
    dateRange: { start: '2023-09-08', end: '2026-03-28' },
    richDayCount: 85,
    totalDays: totalDays ?? 856,
    exportDate: '2026-03-28',
    userIntelligence: intel?.summary ?? '',
    intelligenceScore: timeline?.intelligence_score ?? 0,
    connectedSources: timeline?.connected_sources ?? [],
  };
}

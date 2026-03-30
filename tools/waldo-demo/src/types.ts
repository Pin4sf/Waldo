/** API response types for the Waldo demo frontend */

export interface DateEntry {
  date: string;
  crs: number;
  zone: 'peak' | 'moderate' | 'low' | 'nodata';
  tier: 'rich' | 'partial' | 'sparse' | 'empty';
  signals: string[];
  hasSleep: boolean;
  hasHrv: boolean;
  hasSteps: boolean;
  hasStress: boolean;
  fetchAlert: boolean;
  spotCount: number;
  headline: string;
  morningWag: string | null;
}

export interface ComponentScore {
  score: number;
  factors: string[];
  dataAvailable: boolean;
}

export interface DayResponse {
  date: string;
  crs: {
    score: number;
    zone: 'peak' | 'moderate' | 'low';
    confidence: number;
    componentsWithData: number;
    sleep: ComponentScore;
    hrv: ComponentScore;
    circadian: ComponentScore;
    activity: ComponentScore;
    summary: string;
  };
  stress: {
    events: StressEventData[];
    peakConfidence: number | null;
    peakSeverity: string | null;
    totalStressMinutes: number;
    fetchAlertTriggered: boolean;
  };
  sleep: {
    durationHours: number;
    efficiency: number;
    deepPercent: number;
    remPercent: number;
    stages: { core: number; deep: number; rem: number; awake: number };
    bedtime: string;
    wakeTime: string;
  } | null;
  hrv: {
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  activity: {
    steps: number;
    exerciseMinutes: number;
    workouts: string[];
    standHours: number;
    activeEnergy: number;
  };
  restingHR: number | null;
  wristTemp: number | null;
  avgNoiseDb: number | null;
  daylightMinutes: number;
  weather: { temperatureF: number; humidity: number; source: 'workout' | 'api' } | null;
  aqi: number | null;
  aqiLabel: string | null;
  pm25: number | null;
  sleepDebt: { debtHours: number; direction: string; shortNights: number; avgSleepHours: number; summary: string } | null;
  strain: { score: number; level: string; zoneMinutes: number[]; zoneNames: string[]; totalActiveMinutes: number; peakHR: number; summary: string } | null;
  calendar: { meetingLoadScore: number; totalMeetingMinutes: number; eventCount: number; backToBackCount: number; focusGaps: Array<{ durationMinutes: number }>; events: Array<{ summary: string; startTime: string; durationMinutes: number; attendeeCount: number }> } | null;
  tasks: { summary: string; pendingCount: number; overdueCount: number; recentVelocity: number; completionRate: number } | null;
  email: { totalEmails: number; sentCount: number; receivedCount: number; afterHoursCount: number; afterHoursRatio: number; uniqueThreads: number; volumeSpike: number } | null;
  cognitiveLoad: { score: number; level: string; components: { meetingLoad: number; communicationLoad: number; taskLoad: number; sleepDebtImpact: number }; summary: string } | null;
  burnoutTrajectory: { score: number; status: string; components: { hrvSlope: number; sleepDebtTrend: number; afterHoursTrend: number; mlsTrend: number }; summary: string } | null;
  resilience: { score: number; level: string; components: { crsStability: number; hrvTrend: number; stressRecovery: number }; summary: string } | null;
  crossSourceInsights: Array<{ type: string; summary: string; confidence: string; evidenceCount: number }>;
  patterns: PatternData[];
  waldoActions: WaldoActionData[];
  dayActivity: DayActivityData | null;
}

export interface PatternData {
  id: string;
  type: string;
  confidence: string;
  summary: string;
  evidenceCount: number;
}

export interface WaldoActionData {
  time: string;
  action: string;
  reason: string;
  type: 'proactive' | 'reactive' | 'learning';
}

export interface SpotData {
  id: string;
  date: string;
  time: string;
  type: 'health' | 'behavior' | 'environment' | 'insight' | 'alert' | 'learning';
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
  title: string;
  detail: string;
  signals: string[];
}

export interface DayActivityData {
  date: string;
  headline: string;
  spots: SpotData[];
  morningWag: string | null;
  eveningReview: string | null;
  fetchAlertFired: boolean;
  tier: 'rich' | 'partial' | 'sparse' | 'empty';
}

export interface StressEventData {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  confidence: number;
  severity: 'high' | 'moderate' | 'log';
  explanation: string;
  components: {
    hrvDropScore: number;
    hrElevationScore: number;
    durationScore: number;
    activityInvertedScore: number;
  };
}

export interface WaldoResponse {
  message: string;
  zone: string;
  mode: string;
  tokensIn: number;
  tokensOut: number;
  responseTimeMs: number;
  debug: {
    systemPrompt: string;
    userMessage: string;
    model: string;
  };
}

export interface WaldoError {
  error: string;
  debug?: {
    systemPrompt: string;
    userMessage: string;
  };
}

export type MessageMode = 'morning_wag' | 'fetch_alert' | 'conversational';

export interface SummaryResponse {
  profile: { dateOfBirth: string; biologicalSex: string; age: number };
  recordCounts: Record<string, number>;
  dateRange: { start: string; end: string };
  richDayCount: number;
  totalDays: number;
}

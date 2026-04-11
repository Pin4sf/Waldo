/** API response types for the Waldo console */

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
  // Time-series fields — enables client-side historical charts without extra API calls
  hrvAvg: number | null;        // avg RMSSD for the day (from health_snapshots.hrv_rmssd)
  restingHR: number | null;     // resting HR bpm (from health_snapshots.resting_hr)
  sleepHours: number | null;    // total sleep hours (from health_snapshots.sleep_duration_hours)
  sleepDebtHours: number | null;// cumulative debt on this day (from master_metrics.sleep_debt.debtHours)
  strainScore: number | null;   // Load score 0–21 (from master_metrics.strain.score)
  spO2: number | null;          // SpO2 % (from health_snapshots.spo2)
}

export interface ComponentScore {
  score: number;
  factors: string[];
  dataAvailable: boolean;
}

export interface CrsPillars {
  recovery: number;  // Sleep/Recovery Score (0–100)
  cass: number;      // Autonomic State Score (0–100)
  ilas: number;      // Inverse Load Score (0–100)
}

export interface PillarDrag {
  sleep: number;
  hrv: number;
  circadian: number;
  activity: number;
  primary: 'sleep' | 'hrv' | 'circadian' | 'activity' | 'none';
}

export interface DayResponse {
  date: string;
  crs: {
    score: number;
    zone: 'peak' | 'moderate' | 'low' | 'nodata';
    confidence: number;
    componentsWithData: number;
    sleep: ComponentScore;
    hrv: ComponentScore;
    circadian: ComponentScore;
    activity: ComponentScore;
    /** 3-pillar rollup: recovery=sleep, cass=hrv, ilas=avg(circadian+activity) */
    pillars: CrsPillars | null;
    /** Which component is dragging CRS — drives The Brief attribution */
    pillarDrag: PillarDrag | null;
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
  hrv: { avg: number; min: number; max: number; count: number } | null;
  activity: {
    steps: number;
    exerciseMinutes: number;
    workouts: string[];
    standHours: number;
    activeEnergy: number;
  };
  restingHR: number | null;
  wristTemp: number | null;
  spO2: number | null;              // surfaced only when <95% in BodyReadings card
  respiratoryRate: number | null;   // 7-day sparkline in BodyReadings card
  avgNoiseDb: number | null;
  daylightMinutes: number;
  weather: { temperatureF: number; humidity: number; source: string } | null;
  aqi: number | null;
  aqiLabel: string | null;
  pm25: number | null;
  sleepDebt: { debtHours: number; direction: string; shortNights: number; avgSleepHours: number; summary: string } | null;
  strain: { score: number; level: string; zoneMinutes: number[]; zoneNames: string[]; totalActiveMinutes: number; peakHR: number; summary: string } | null;
  calendar: {
    meetingLoadScore: number;
    totalMeetingMinutes: number;
    eventCount: number;
    backToBackCount: number;
    boundaryViolations: number;
    focusGaps: Array<{ durationMinutes: number; quality?: number }>;
    events: Array<{ summary: string; startTime: string; durationMinutes: number; attendeeCount: number }>;
  } | null;
  tasks: {
    summary: string;
    pendingCount: number;
    overdueCount: number;
    recentVelocity: number;
    completionRate: number;
    urgencyQueue?: Array<{ title: string; due: string }>;
  } | null;
  email: {
    totalEmails: number;
    sentCount: number;
    receivedCount: number;
    afterHoursCount: number;
    afterHoursRatio: number;
    uniqueThreads: number;
    volumeSpike: number;
  } | null;
  cognitiveLoad: {
    score: number;
    level: string;
    components: { meetingLoad: number; communicationLoad: number; taskLoad: number; sleepDebtImpact: number };
    summary: string;
  } | null;
  burnoutTrajectory: { score: number; status: string; components: any; summary: string } | null;
  resilience: { score: number; level: string; components: any; summary: string } | null;
  crossSourceInsights: Array<{ type: string; summary: string; confidence: string; evidenceCount: number }>;
  patterns: PatternData[];
  waldoActions: WaldoActionData[];
  dayActivity: DayActivityData | null;
}

export interface PatternData {
  id: string;
  type: string;
  confidence: number | string;
  summary: string;
  evidenceCount: number;
  firstSeen?: string;
  lastSeen?: string;
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
  crsScore?: number;
  iterations?: number;
  toolsCalled?: string[];
  method?: string;  // 'claude' | 'template' | 'L1:claude' | 'L2:claude' | 'L2:deepseek'
  fallback?: boolean;
  debug?: { systemPrompt: string; userMessage: string; model: string };
}

export interface WaldoError {
  error: string;
  debug?: { systemPrompt: string; userMessage: string };
}

export type MessageMode = 'morning_wag' | 'fetch_alert' | 'conversational' | 'evening_review';

export interface SummaryResponse {
  profile: { name?: string; dateOfBirth?: string; biologicalSex: string; age: number | null };
  recordCounts: Record<string, number>;
  dateRange: { start: string; end: string };
  richDayCount: number;
  totalDays: number;
  exportDate?: string;
  userIntelligence?: string;
  intelligenceScore?: number;
  connectedSources?: string[];
}

// ─── New types for multi-user console ──────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  age: number | null;
  timezone: string;
  chronotype: 'early' | 'normal' | 'late';
  wearableType: string;
  telegramLinked: boolean;
  onboardingComplete: boolean;
  lastHealthSync: string | null;
  wakeTimeEstimate: string;
  preferredEveningTime: string;
  createdAt: string;
}

export interface SyncStatus {
  provider: string;
  label: string;
  connected: boolean;
  status: 'ok' | 'error' | 'no_token' | 'token_expired' | 'pending' | 'not_connected';
  lastSyncAt: string | null;
  recordsSynced: number;
  lastError: string | null;
  tokenExpiry: string | null;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'waldo';
  content: string;
  mode: string | null;
  channel: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface CoreMemoryEntry {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface AgentLogEntry {
  id: string;
  traceId: string;
  triggerType: string;
  toolsCalled: string[];
  iterations: number;
  totalTokens: number;
  latencyMs: number;
  deliveryStatus: string;
  llmFallbackLevel: number;
  estimatedCostUsd: number;
  createdAt: string;
}

/**
 * Pre-computed history arrays derived from allDates in Dashboard.
 * Pass to Tier2Cards (HRVCard, RestingHRCard, SleepDebtCard) and LoadCard
 * to replace seeded-random fake historical charts with real data.
 * All arrays are ordered oldest→newest. Null entries mean no data for that day.
 */
export interface HealthHistory {
  hrv30d: (number | null)[];       // 30-day HRV avg — for HRVCard baseline chart
  rhr7d: (number | null)[];        // 7-day resting HR — for RestingHRCard sparkline
  sleepDebt7d: (number | null)[];  // 7-day debt accumulation — for SleepDebtCard
  strain7d: (number | null)[];     // 7-day strain scores — for LoadCard 7-day avg
  sleepHours7d: (number | null)[]; // 7-day sleep hours — for SleepDebtCard context
}

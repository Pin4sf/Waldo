/**
 * Prompt builder — assembles biometric context for Claude.
 *
 * Takes a day's health data, CRS, stress events, and builds
 * the user message that Claude reasons over. Separate from
 * the system prompt (soul file) for cache isolation.
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';
import type { DailyStressSummary } from '../types/stress.js';
import type { Pattern } from '../computed/pattern-detector.js';
import type { Spot } from '../computed/spots-engine.js';
import type { UserProfile as OnboardingProfile } from './onboarding.js';
import type { AgentContext, MessageMode } from '../types/agent.js';
import { getPersonalityZone } from '../types/agent.js';

/** Build a human-readable sleep summary */
function buildSleepSummary(day: DailyHealthData): string {
  if (!day.sleep) return 'No sleep data recorded.';

  const s = day.sleep;
  const hours = (s.totalDurationMinutes / 60).toFixed(1);
  const eff = (s.efficiency * 100).toFixed(0);
  const deep = (s.deepPercent * 100).toFixed(0);
  const rem = (s.remPercent * 100).toFixed(0);

  const bedHour = s.bedtime.getHours();
  const bedMin = s.bedtime.getMinutes().toString().padStart(2, '0');
  const wakeHour = s.wakeTime.getHours();
  const wakeMin = s.wakeTime.getMinutes().toString().padStart(2, '0');

  return [
    `Sleep: ${hours}h (${bedHour}:${bedMin} → ${wakeHour}:${wakeMin})`,
    `Efficiency: ${eff}% | Deep: ${deep}% | REM: ${rem}%`,
    `Core: ${s.stages.core.toFixed(0)}min | Deep: ${s.stages.deep.toFixed(0)}min | REM: ${s.stages.rem.toFixed(0)}min | Awake: ${s.stages.awake.toFixed(0)}min`,
  ].join('\n');
}

/** Build a human-readable biometric summary */
function buildBiometricSummary(day: DailyHealthData, crs: CrsResult): string {
  const parts: string[] = [];

  parts.push(`CRS: ${crs.score} (${crs.zone}) ±${crs.confidence}`);
  parts.push(`Components: Sleep ${crs.sleep.score} | HRV ${crs.hrv.score} | Circadian ${crs.circadian.score} | Activity ${crs.activity.score}`);

  if (day.hrvReadings.length > 0) {
    const rmssdValues = day.hrvReadings.map(r => r.rmssd ?? r.sdnn);
    const avg = rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length;
    parts.push(`HRV: ${avg.toFixed(1)}ms avg (${day.hrvReadings.length} readings)`);
  }

  if (day.restingHR !== null) {
    parts.push(`Resting HR: ${day.restingHR} BPM`);
  }

  if (day.spo2Readings.length > 0) {
    const avg = day.spo2Readings.reduce((s, r) => s + r.percentage, 0) / day.spo2Readings.length;
    parts.push(`SpO2: ${avg.toFixed(1)}% avg`);
  }

  if (day.wristTemp !== null) {
    parts.push(`Wrist temp (sleep): ${day.wristTemp.toFixed(1)}°C`);
  }

  if (day.vo2max !== null) {
    parts.push(`VO2Max: ${day.vo2max.toFixed(1)} mL/min/kg`);
  }

  return parts.join('\n');
}

/** Build stress summary for prompt */
function buildStressSummary(stress: DailyStressSummary): string {
  if (stress.events.length === 0) {
    return 'No significant stress events detected today.';
  }

  const parts: string[] = [];
  parts.push(`${stress.events.length} stress event(s) detected:`);

  for (const event of stress.events) {
    const timeStr = event.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    parts.push(`- ${timeStr}: confidence ${(event.confidence * 100).toFixed(0)}% (${event.severity}) — ${event.explanation}`);
  }

  if (stress.totalStressMinutes > 0) {
    parts.push(`Total elevated stress: ${stress.totalStressMinutes.toFixed(0)} minutes`);
  }

  return parts.join('\n');
}

/** Build activity summary */
function buildActivitySummary(day: DailyHealthData): string {
  const parts: string[] = [];

  if (day.totalSteps > 0) parts.push(`Steps: ${day.totalSteps.toLocaleString()}`);
  if (day.exerciseMinutes > 0) parts.push(`Exercise: ${day.exerciseMinutes} min`);
  if (day.workouts.length > 0) {
    const workoutNames = day.workouts.map(w => w.activityType).join(', ');
    parts.push(`Workouts: ${workoutNames}`);
  }
  if (day.activitySummary) {
    parts.push(`Stand hours: ${day.activitySummary.appleStandHours}`);
    parts.push(`Active energy: ${day.activitySummary.activeEnergyBurned.toFixed(0)} kcal`);
  }

  // New metrics
  if (day.distanceKm > 0) parts.push(`Distance: ${day.distanceKm.toFixed(1)} km`);
  if (day.avgWalkingSpeed !== null) parts.push(`Walking speed: ${day.avgWalkingSpeed.toFixed(1)} km/h`);
  if (day.flightsClimbed > 0) parts.push(`Flights climbed: ${day.flightsClimbed}`);
  if (day.activeEnergyBurned > 0 && !day.activitySummary) parts.push(`Active energy: ${Math.round(day.activeEnergyBurned)} kcal`);

  return parts.length > 0 ? parts.join('\n') : 'No activity data.';
}

/** Build environment context (weather, noise, daylight, wrist temp) */
function buildEnvironmentSummary(day: DailyHealthData): string {
  const parts: string[] = [];

  if (day.weather) {
    const tempC = Math.round((day.weather.temperatureF - 32) * 5 / 9);
    parts.push(`Weather: ${tempC}°C (${Math.round(day.weather.temperatureF)}°F), ${Math.round(day.weather.humidity)}% humidity`);
  }

  if (day.avgNoiseDb !== null) {
    const level = day.avgNoiseDb > 80 ? 'loud' : day.avgNoiseDb > 70 ? 'moderate' : day.avgNoiseDb > 60 ? 'normal' : 'quiet';
    parts.push(`Noise environment: ${day.avgNoiseDb.toFixed(0)} dB avg (${level})`);
  }

  if (day.daylightMinutes > 0) {
    parts.push(`Time in daylight: ${day.daylightMinutes} min`);
  }

  if (day.wristTemp !== null) {
    parts.push(`Sleeping wrist temp: ${day.wristTemp.toFixed(1)}°C`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No environmental data.';
}

/** Build data confidence tier */
function buildDataConfidence(day: DailyHealthData): string {
  const signals: string[] = [];
  if (day.sleep) signals.push('sleep');
  if (day.hrvReadings.length > 0) signals.push('HRV');
  if (day.hrReadings.length > 0) signals.push('HR');
  if (day.totalSteps > 0) signals.push('steps');
  if (day.spo2Readings.length > 0) signals.push('SpO2');

  const hasWatch = day.hrReadings.some(r => r.motionContext !== 0);
  const tier = signals.length >= 4 ? 'HIGH' : signals.length >= 2 ? 'MODERATE' : signals.length >= 1 ? 'LOW' : 'NONE';
  const device = hasWatch ? 'Apple Watch (full biometrics)' : 'iPhone only (steps/activity)';

  return `Data confidence: ${tier} — ${device}, ${signals.length} signals (${signals.join(', ')})`;
}

/** Build today vs history comparison */
function buildTrendComparison(
  day: DailyHealthData,
  crs: CrsResult,
  allDays: Map<string, DailyHealthData>,
  allCrs: Map<string, CrsResult>,
): string {
  const parts: string[] = [];
  const sortedDates = [...allDays.keys()].sort();
  const todayIdx = sortedDates.indexOf(day.date);
  if (todayIdx < 0) return '';

  // Yesterday
  const yesterday = todayIdx > 0 ? sortedDates[todayIdx - 1] : undefined;
  const yesterdayCrs = yesterday ? allCrs.get(yesterday) : undefined;
  if (yesterdayCrs && yesterdayCrs.score >= 0 && crs.score >= 0) {
    const delta = crs.score - yesterdayCrs.score;
    parts.push(`vs yesterday: CRS ${delta >= 0 ? '+' : ''}${delta} (${yesterdayCrs.score}→${crs.score})`);
  }

  // 7-day averages
  const last7 = sortedDates.slice(Math.max(0, todayIdx - 7), todayIdx);
  const last7Crs = last7.map(d => allCrs.get(d)?.score).filter((s): s is number => s !== undefined && s >= 0);
  const last7Steps = last7.map(d => allDays.get(d)!.totalSteps).filter(s => s > 0);
  const last7Sleep = last7.map(d => allDays.get(d)!.sleep?.totalDurationMinutes).filter((s): s is number => s !== undefined);

  if (last7Crs.length > 0) {
    const avg = Math.round(last7Crs.reduce((s, v) => s + v, 0) / last7Crs.length);
    parts.push(`7-day avg CRS: ${avg}`);
  }
  if (last7Steps.length > 0 && day.totalSteps > 0) {
    const avg = Math.round(last7Steps.reduce((s, v) => s + v, 0) / last7Steps.length);
    const pct = Math.round(((day.totalSteps - avg) / avg) * 100);
    parts.push(`steps vs 7d avg: ${pct >= 0 ? '+' : ''}${pct}% (${avg.toLocaleString()} avg)`);
  }
  if (last7Sleep.length > 0 && day.sleep) {
    const avg = last7Sleep.reduce((s, v) => s + v, 0) / last7Sleep.length / 60;
    parts.push(`sleep vs 7d avg: ${(day.sleep.totalDurationMinutes / 60).toFixed(1)}h vs ${avg.toFixed(1)}h`);
  }

  // 30-day averages
  const last30 = sortedDates.slice(Math.max(0, todayIdx - 30), todayIdx);
  const last30Crs = last30.map(d => allCrs.get(d)?.score).filter((s): s is number => s !== undefined && s >= 0);
  if (last30Crs.length > 0) {
    const avg = Math.round(last30Crs.reduce((s, v) => s + v, 0) / last30Crs.length);
    parts.push(`30-day avg CRS: ${avg}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/** Build spots summary for prompt */
function buildSpotsSummary(spots: Spot[]): string {
  if (spots.length === 0) return '';
  const important = spots.filter(s => s.severity !== 'neutral').slice(0, 5);
  if (important.length === 0) return '';
  return important.map(s => `- [${s.severity}] ${s.title}: ${s.detail}`).join('\n');
}

/** Build onboarding profile summary */
function buildOnboardingProfile(profile: OnboardingProfile | null): string {
  if (!profile || !profile.completed) return '';
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.role && profile.role !== 'unknown') parts.push(`Role: ${profile.role}`);
  if (profile.workStyle && profile.workStyle !== 'unknown') parts.push(`Work style: ${profile.workStyle}`);
  if (profile.wakeTime && profile.wakeTime !== 'unknown') parts.push(`Usual wake: ${profile.wakeTime}`);
  if (profile.stressors && profile.stressors !== 'unknown') parts.push(`Main stressors: ${profile.stressors}`);
  if (profile.goals && profile.goals !== 'understand my body better') parts.push(`Goals: ${profile.goals}`);
  if (profile.communicationStyle && profile.communicationStyle !== 'direct') parts.push(`Prefers: ${profile.communicationStyle} communication`);
  return parts.length > 0 ? parts.join('\n') : '';
}

/** Build patterns summary for prompt */
function buildPatternsSummary(patterns: Pattern[]): string {
  if (patterns.length === 0) return 'No patterns detected yet.';

  // Only include high/moderate confidence patterns
  const relevant = patterns.filter(p => p.confidence !== 'low');
  if (relevant.length === 0) return 'No strong patterns yet.';

  return relevant
    .slice(0, 3) // Max 3 patterns in prompt to save tokens
    .map(p => `- ${p.summary}`)
    .join('\n');
}

/**
 * Build the full agent context for a given day and mode.
 */
export interface AgentContextParams {
  day: DailyHealthData;
  crs: CrsResult;
  stress: DailyStressSummary;
  mode: MessageMode;
  userName: string;
  age: number;
  userQuestion?: string;
  patterns?: Pattern[];
  userIntelligenceSummary?: string;
  onboardingProfile?: OnboardingProfile | null;
  allDays?: Map<string, DailyHealthData>;
  allCrs?: Map<string, CrsResult>;
  spots?: Spot[];
}

export function buildAgentContext(params: AgentContextParams): AgentContext;
export function buildAgentContext(
  day: DailyHealthData,
  crs: CrsResult,
  stress: DailyStressSummary,
  mode: MessageMode,
  userName: string,
  age: number,
  userQuestion?: string,
  patterns?: Pattern[],
  userIntelligenceSummary?: string,
): AgentContext;
export function buildAgentContext(
  dayOrParams: DailyHealthData | AgentContextParams,
  crs?: CrsResult,
  stress?: DailyStressSummary,
  mode?: MessageMode,
  userName?: string,
  age?: number,
  userQuestion?: string,
  patterns?: Pattern[],
  userIntelligenceSummary?: string,
): AgentContext {
  // Handle both call signatures
  let p: AgentContextParams;
  if ('day' in dayOrParams && 'crs' in dayOrParams && 'mode' in dayOrParams) {
    p = dayOrParams as AgentContextParams;
  } else {
    p = {
      day: dayOrParams as DailyHealthData,
      crs: crs!,
      stress: stress!,
      mode: mode!,
      userName: userName!,
      age: age!,
      userQuestion,
      patterns,
      userIntelligenceSummary,
    };
  }

  const trendComparison = (p.allDays && p.allCrs)
    ? buildTrendComparison(p.day, p.crs, p.allDays, p.allCrs)
    : '';

  return {
    userName: p.userName,
    age: p.age,
    crs: p.crs.score,
    zone: getPersonalityZone(p.crs.score),
    biometricSummary: buildBiometricSummary(p.day, p.crs),
    sleepSummary: buildSleepSummary(p.day),
    stressSummary: buildStressSummary(p.stress),
    activitySummary: buildActivitySummary(p.day),
    environmentSummary: buildEnvironmentSummary(p.day),
    patternsSummary: buildPatternsSummary(p.patterns ?? []),
    userIntelligenceSummary: p.userIntelligenceSummary ?? '',
    onboardingProfile: buildOnboardingProfile(p.onboardingProfile ?? null),
    dataConfidence: buildDataConfidence(p.day),
    trendComparison,
    spotsSummary: buildSpotsSummary(p.spots ?? []),
    date: p.day.date,
    mode: p.mode,
    userQuestion: p.userQuestion,
  };
}

/**
 * Build the user message for Claude (separate from system prompt for cache isolation).
 */
export function buildUserMessage(ctx: AgentContext): string {
  const header = ctx.mode === 'morning_wag'
    ? `Generate a Morning Wag briefing for ${ctx.userName} on ${ctx.date}.`
    : ctx.mode === 'fetch_alert'
      ? `Generate a Fetch Alert for ${ctx.userName}. Stress was just detected.`
      : `${ctx.userName} asks: "${ctx.userQuestion ?? 'How am I doing today?'}"`;

  const sections = [
    header,
    '',
    '--- BODY ---',
    ctx.biometricSummary,
    '',
    '--- SLEEP ---',
    ctx.sleepSummary,
    '',
    '--- ACTIVITY ---',
    ctx.activitySummary,
  ];

  // Only include non-empty sections
  if (ctx.stressSummary !== 'No significant stress events detected today.') {
    sections.push('', '--- STRESS ---', ctx.stressSummary);
  }

  if (ctx.environmentSummary !== 'No environmental data.') {
    sections.push('', '--- ENVIRONMENT ---', ctx.environmentSummary);
  }

  // Trend comparison (today vs yesterday, 7d, 30d)
  if (ctx.trendComparison) {
    sections.push('', '--- TRENDS (today vs history) ---', ctx.trendComparison);
  }

  // Data confidence
  if (ctx.dataConfidence) {
    sections.push('', ctx.dataConfidence);
  }

  // What Waldo already noticed today (Spots)
  if (ctx.spotsSummary) {
    sections.push('', '--- WHAT WALDO ALREADY NOTICED TODAY ---', ctx.spotsSummary);
  }

  if (ctx.patternsSummary !== 'No patterns detected yet.' && ctx.patternsSummary !== 'No strong patterns yet.') {
    sections.push('', '--- PATTERNS WALDO KNOWS ---', ctx.patternsSummary);
  }

  // Onboarding profile (who this person is)
  if (ctx.onboardingProfile) {
    sections.push('', '--- WHO THIS PERSON IS ---', ctx.onboardingProfile);
  }

  // Full user intelligence profile (cross-day analysis)
  if (ctx.userIntelligenceSummary) {
    sections.push('', '--- USER PROFILE (full history analysis) ---', ctx.userIntelligenceSummary);
  }

  sections.push('', `Date: ${ctx.date} | User: ${ctx.userName}, age ${ctx.age}`);

  return sections.join('\n');
}

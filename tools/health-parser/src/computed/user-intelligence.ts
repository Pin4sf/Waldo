/**
 * User Intelligence Profile — cross-day analysis of the entire timeline.
 *
 * This is what makes Waldo SMART. Instead of answering questions day-by-day,
 * Waldo knows the user's routines, habits, and long-term patterns.
 *
 * Fed into every Claude prompt so Waldo can answer questions like:
 * "When does Ark usually work out?"
 * "What's his sleep pattern like on weekdays vs weekends?"
 * "Is his fitness improving?"
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';

export interface UserIntelligence {
  /** One-paragraph natural language summary for prompt injection */
  summary: string;
  /** Workout patterns */
  workout: {
    avgPerWeek: number;
    preferredTimes: string[];
    commonTypes: string[];
    avgDurationMin: number;
    weekdayVsWeekend: string;
  };
  /** Sleep patterns */
  sleep: {
    avgDurationHours: number;
    avgBedtime: string;
    avgWakeTime: string;
    weekdayVsWeekend: string;
    bestDayOfWeek: string;
    worstDayOfWeek: string;
  };
  /** Activity patterns */
  activity: {
    avgDailySteps: number;
    avgDailyDistanceKm: number;
    mostActiveDay: string;
    leastActiveDay: string;
    avgActiveEnergy: number;
  };
  /** CRS patterns */
  crs: {
    avgScore: number;
    bestDayOfWeek: string;
    worstDayOfWeek: string;
    trend: 'improving' | 'stable' | 'declining';
    peakDaysPercent: number;
  };
  /** Health baselines */
  baselines: {
    avgRestingHR: number | null;
    avgHRV: number | null;
    avgVO2Max: number | null;
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourToTimeStr(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function buildUserIntelligence(
  days: Map<string, DailyHealthData>,
  crsScores: Map<string, CrsResult>,
): UserIntelligence {
  const sortedDates = [...days.keys()].sort();

  // ─── Workout Analysis ──────────────────────────────────
  const allWorkouts: Array<{ hour: number; dayOfWeek: number; type: string; duration: number }> = [];
  for (const day of days.values()) {
    for (const w of day.workouts) {
      allWorkouts.push({
        hour: w.startDate.getHours() + w.startDate.getMinutes() / 60,
        dayOfWeek: w.startDate.getDay(),
        type: w.activityType,
        duration: w.durationMinutes,
      });
    }
  }

  // Preferred workout times
  const workoutHours = allWorkouts.map(w => w.hour);
  const morningWorkouts = workoutHours.filter(h => h < 10).length;
  const afternoonWorkouts = workoutHours.filter(h => h >= 10 && h < 16).length;
  const eveningWorkouts = workoutHours.filter(h => h >= 16).length;
  const preferredTimes: string[] = [];
  if (morningWorkouts > 0) preferredTimes.push(`morning (${morningWorkouts}x, ~${hourToTimeStr(workoutHours.filter(h => h < 10).reduce((s, v) => s + v, 0) / morningWorkouts || 6)})`);
  if (afternoonWorkouts > 0) preferredTimes.push(`afternoon (${afternoonWorkouts}x)`);
  if (eveningWorkouts > 0) preferredTimes.push(`evening (${eveningWorkouts}x, ~${hourToTimeStr(workoutHours.filter(h => h >= 16).reduce((s, v) => s + v, 0) / eveningWorkouts || 18)})`);

  // Common workout types
  const typeCounts = new Map<string, number>();
  for (const w of allWorkouts) {
    typeCounts.set(w.type, (typeCounts.get(w.type) ?? 0) + 1);
  }
  const commonTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, c]) => `${t} (${c}x)`);

  // Weeks with data
  const weekSet = new Set<string>();
  for (const date of sortedDates) { weekSet.add(date.slice(0, 7)); }
  const months = weekSet.size || 1;
  const weeksApprox = months * 4.3;

  const weekdayWorkouts = allWorkouts.filter(w => w.dayOfWeek >= 1 && w.dayOfWeek <= 5).length;
  const weekendWorkouts = allWorkouts.filter(w => w.dayOfWeek === 0 || w.dayOfWeek === 6).length;

  // ─── Sleep Analysis ────────────────────────────────────
  const sleepData: Array<{ hours: number; bedtimeHour: number; wakeHour: number; dow: number }> = [];
  for (const day of days.values()) {
    if (!day.sleep) continue;
    const bedH = day.sleep.bedtime.getHours() + day.sleep.bedtime.getMinutes() / 60;
    const wakeH = day.sleep.wakeTime.getHours() + day.sleep.wakeTime.getMinutes() / 60;
    sleepData.push({
      hours: day.sleep.totalDurationMinutes / 60,
      bedtimeHour: bedH > 12 ? bedH : bedH + 24, // Normalize: 11PM=23, 1AM=25
      wakeHour: wakeH,
      dow: day.sleep.wakeTime.getDay(),
    });
  }

  const avgSleepHours = sleepData.length > 0 ? sleepData.reduce((s, d) => s + d.hours, 0) / sleepData.length : 0;
  const avgBedtimeH = sleepData.length > 0 ? sleepData.reduce((s, d) => s + d.bedtimeHour, 0) / sleepData.length : 23;
  const avgWakeH = sleepData.length > 0 ? sleepData.reduce((s, d) => s + d.wakeHour, 0) / sleepData.length : 7;

  // Sleep by day of week
  const sleepByDow = new Map<number, number[]>();
  for (const s of sleepData) {
    if (!sleepByDow.has(s.dow)) sleepByDow.set(s.dow, []);
    sleepByDow.get(s.dow)!.push(s.hours);
  }
  let bestSleepDay = 'unknown', worstSleepDay = 'unknown';
  let bestSleepAvg = 0, worstSleepAvg = 24;
  for (const [dow, hours] of sleepByDow) {
    const avg = hours.reduce((s, v) => s + v, 0) / hours.length;
    if (avg > bestSleepAvg) { bestSleepAvg = avg; bestSleepDay = DAY_NAMES[dow]!; }
    if (avg < worstSleepAvg) { worstSleepAvg = avg; worstSleepDay = DAY_NAMES[dow]!; }
  }

  const weekdaySleep = sleepData.filter(s => s.dow >= 1 && s.dow <= 5);
  const weekendSleep = sleepData.filter(s => s.dow === 0 || s.dow === 6);
  const weekdaySleepAvg = weekdaySleep.length > 0 ? weekdaySleep.reduce((s, d) => s + d.hours, 0) / weekdaySleep.length : 0;
  const weekendSleepAvg = weekendSleep.length > 0 ? weekendSleep.reduce((s, d) => s + d.hours, 0) / weekendSleep.length : 0;

  // ─── Activity Analysis ─────────────────────────────────
  const daysWithSteps = [...days.values()].filter(d => d.totalSteps > 0);
  const avgSteps = daysWithSteps.length > 0 ? daysWithSteps.reduce((s, d) => s + d.totalSteps, 0) / daysWithSteps.length : 0;
  const avgDistance = daysWithSteps.length > 0 ? daysWithSteps.reduce((s, d) => s + d.distanceKm, 0) / daysWithSteps.length : 0;
  const avgEnergy = daysWithSteps.length > 0 ? daysWithSteps.reduce((s, d) => s + d.activeEnergyBurned, 0) / daysWithSteps.length : 0;

  const stepsByDow = new Map<number, number[]>();
  for (const day of daysWithSteps) {
    const dow = new Date(day.date + 'T00:00:00').getDay();
    if (!stepsByDow.has(dow)) stepsByDow.set(dow, []);
    stepsByDow.get(dow)!.push(day.totalSteps);
  }
  let mostActiveDay = 'unknown', leastActiveDay = 'unknown';
  let mostSteps = 0, leastSteps = Infinity;
  for (const [dow, steps] of stepsByDow) {
    const avg = steps.reduce((s, v) => s + v, 0) / steps.length;
    if (avg > mostSteps) { mostSteps = avg; mostActiveDay = DAY_NAMES[dow]!; }
    if (avg < leastSteps) { leastSteps = avg; leastActiveDay = DAY_NAMES[dow]!; }
  }

  // ─── CRS Analysis ─────────────────────────────────────
  const validCrs = [...crsScores.values()].filter(c => c.score >= 0);
  const avgCrs = validCrs.length > 0 ? validCrs.reduce((s, c) => s + c.score, 0) / validCrs.length : 0;
  const peakCount = validCrs.filter(c => c.score >= 80).length;
  const peakPct = validCrs.length > 0 ? (peakCount / validCrs.length) * 100 : 0;

  const crsByDow = new Map<number, number[]>();
  for (const [date, crs] of crsScores) {
    if (crs.score < 0) continue;
    const dow = new Date(date + 'T00:00:00').getDay();
    if (!crsByDow.has(dow)) crsByDow.set(dow, []);
    crsByDow.get(dow)!.push(crs.score);
  }
  let bestCrsDay = 'unknown', worstCrsDay = 'unknown';
  let bestCrsAvg = 0, worstCrsAvg = 100;
  for (const [dow, scores] of crsByDow) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    if (avg > bestCrsAvg) { bestCrsAvg = avg; bestCrsDay = DAY_NAMES[dow]!; }
    if (avg < worstCrsAvg) { worstCrsAvg = avg; worstCrsDay = DAY_NAMES[dow]!; }
  }

  // CRS trend: compare first half vs second half
  const halfIdx = Math.floor(validCrs.length / 2);
  const firstHalf = validCrs.slice(0, halfIdx);
  const secondHalf = validCrs.slice(halfIdx);
  const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, c) => s + c.score, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, c) => s + c.score, 0) / secondHalf.length : 0;
  const trend = secondAvg - firstAvg > 3 ? 'improving' : secondAvg - firstAvg < -3 ? 'declining' : 'stable';

  // ─── Health Baselines ──────────────────────────────────
  const allRestingHR = [...days.values()].map(d => d.restingHR).filter((v): v is number => v !== null);
  const allHRV = [...days.values()].flatMap(d => d.hrvReadings.map(r => r.rmssd ?? r.sdnn));
  const allVO2 = [...days.values()].map(d => d.vo2max).filter((v): v is number => v !== null);

  // ─── Build natural language summary ────────────────────
  const parts: string[] = [];
  parts.push(`Ark is a ${days.values().next().value ? 'male' : 'unknown'}, age 21, tracked for ${sortedDates.length} days.`);

  if (allWorkouts.length > 0) {
    const mainTime = morningWorkouts >= eveningWorkouts ? 'morning' : 'evening';
    parts.push(`Works out ${(allWorkouts.length / weeksApprox).toFixed(1)}x/week, primarily ${commonTypes[0] ?? 'mixed'}, usually in the ${mainTime}.`);
    parts.push(`Average workout: ${Math.round(allWorkouts.reduce((s, w) => s + w.duration, 0) / allWorkouts.length)} minutes.`);
  }

  if (sleepData.length > 0) {
    parts.push(`Sleeps ${avgSleepHours.toFixed(1)}h on average. Bedtime ~${hourToTimeStr(avgBedtimeH > 24 ? avgBedtimeH - 24 : avgBedtimeH)}, wake ~${hourToTimeStr(avgWakeH)}.`);
    if (Math.abs(weekendSleepAvg - weekdaySleepAvg) > 0.5) {
      parts.push(`Weekends: ${weekendSleepAvg.toFixed(1)}h vs weekdays: ${weekdaySleepAvg.toFixed(1)}h.`);
    }
    parts.push(`Best sleep: ${bestSleepDay}s. Worst: ${worstSleepDay}s.`);
  }

  parts.push(`Average ${Math.round(avgSteps).toLocaleString()} steps/day, ${avgDistance.toFixed(1)} km.`);
  parts.push(`Most active: ${mostActiveDay}s. Least active: ${leastActiveDay}s.`);

  if (validCrs.length > 0) {
    parts.push(`CRS averages ${Math.round(avgCrs)}, peaks on ${bestCrsDay}s (${Math.round(bestCrsAvg)}), dips on ${worstCrsDay}s (${Math.round(worstCrsAvg)}). ${Math.round(peakPct)}% of days are peak (80+). Trend: ${trend}.`);
  }

  if (allRestingHR.length > 0) {
    parts.push(`Resting HR: ${Math.round(allRestingHR.reduce((s, v) => s + v, 0) / allRestingHR.length)} bpm.`);
  }

  return {
    summary: parts.join(' '),
    workout: {
      avgPerWeek: allWorkouts.length / weeksApprox,
      preferredTimes,
      commonTypes,
      avgDurationMin: allWorkouts.length > 0 ? allWorkouts.reduce((s, w) => s + w.duration, 0) / allWorkouts.length : 0,
      weekdayVsWeekend: `Weekday: ${weekdayWorkouts}, Weekend: ${weekendWorkouts}`,
    },
    sleep: {
      avgDurationHours: avgSleepHours,
      avgBedtime: hourToTimeStr(avgBedtimeH > 24 ? avgBedtimeH - 24 : avgBedtimeH),
      avgWakeTime: hourToTimeStr(avgWakeH),
      weekdayVsWeekend: `Weekday: ${weekdaySleepAvg.toFixed(1)}h, Weekend: ${weekendSleepAvg.toFixed(1)}h`,
      bestDayOfWeek: bestSleepDay,
      worstDayOfWeek: worstSleepDay,
    },
    activity: {
      avgDailySteps: Math.round(avgSteps),
      avgDailyDistanceKm: avgDistance,
      mostActiveDay,
      leastActiveDay,
      avgActiveEnergy: Math.round(avgEnergy),
    },
    crs: {
      avgScore: Math.round(avgCrs),
      bestDayOfWeek: bestCrsDay,
      worstDayOfWeek: worstCrsDay,
      trend,
      peakDaysPercent: Math.round(peakPct),
    },
    baselines: {
      avgRestingHR: allRestingHR.length > 0 ? Math.round(allRestingHR.reduce((s, v) => s + v, 0) / allRestingHR.length) : null,
      avgHRV: allHRV.length > 0 ? Math.round(allHRV.reduce((s, v) => s + v, 0) / allHRV.length) : null,
      avgVO2Max: allVO2.length > 0 ? Math.round(allVO2.reduce((s, v) => s + v, 0) / allVO2.length * 10) / 10 : null,
    },
  };
}

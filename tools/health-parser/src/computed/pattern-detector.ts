/**
 * Pattern detector — "The Constellation"
 *
 * Finds recurring patterns across days of health data.
 * This is what makes Waldo an intelligence layer, not a dashboard.
 *
 * Patterns: day-of-week trends, sleep→CRS correlations,
 * exercise recovery, bedtime consistency effects, stress timing.
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';
import type { DailyStressSummary } from '../types/stress.js';

export interface Pattern {
  id: string;
  type: 'weekly' | 'correlation' | 'streak' | 'anomaly' | 'recovery';
  confidence: 'high' | 'moderate' | 'low';
  /** Short description for Waldo to reference */
  summary: string;
  /** How many data points back this up */
  evidenceCount: number;
  /** When this pattern was first detected */
  firstSeen: string;
}

/** Simulated actions Waldo would take for a given day */
export interface WaldoAction {
  time: string;
  action: string;
  reason: string;
  type: 'proactive' | 'reactive' | 'learning';
}

/**
 * Detect patterns across the full timeline.
 */
export function detectPatterns(
  days: Map<string, DailyHealthData>,
  crsScores: Map<string, CrsResult>,
  stressData: Map<string, DailyStressSummary>,
): Pattern[] {
  const patterns: Pattern[] = [];
  const sortedDates = [...days.keys()].sort();
  const richDates = sortedDates.filter(d => {
    const crs = crsScores.get(d);
    return crs && crs.score >= 0;
  });

  if (richDates.length < 7) return patterns;

  // ─── Day-of-week CRS patterns ──────────────────────────
  const dayOfWeekScores: Map<number, number[]> = new Map();
  for (const date of richDates) {
    const dow = new Date(date + 'T00:00:00').getDay();
    const crs = crsScores.get(date)!.score;
    if (!dayOfWeekScores.has(dow)) dayOfWeekScores.set(dow, []);
    dayOfWeekScores.get(dow)!.push(crs);
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const overallAvg = richDates.reduce((s, d) => s + crsScores.get(d)!.score, 0) / richDates.length;

  for (const [dow, scores] of dayOfWeekScores) {
    if (scores.length < 3) continue;
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const diff = avg - overallAvg;

    if (diff < -8 && scores.length >= 3) {
      patterns.push({
        id: `weekly-low-${dow}`,
        type: 'weekly',
        confidence: scores.length >= 5 ? 'high' : 'moderate',
        summary: `${dayNames[dow]}s average CRS ${Math.round(avg)} — ${Math.abs(Math.round(diff))} points below your norm. Happens ${scores.length} out of ${scores.length} ${dayNames[dow]}s tracked.`,
        evidenceCount: scores.length,
        firstSeen: richDates[0]!,
      });
    } else if (diff > 8 && scores.length >= 3) {
      patterns.push({
        id: `weekly-high-${dow}`,
        type: 'weekly',
        confidence: scores.length >= 5 ? 'high' : 'moderate',
        summary: `${dayNames[dow]}s average CRS ${Math.round(avg)} — your strongest day of the week.`,
        evidenceCount: scores.length,
        firstSeen: richDates[0]!,
      });
    }
  }

  // ─── Sleep duration → CRS correlation ──────────────────
  const sleepCrsPairs: { sleep: number; crs: number }[] = [];
  for (const date of richDates) {
    const day = days.get(date)!;
    const crs = crsScores.get(date)!.score;
    if (day.sleep) {
      sleepCrsPairs.push({ sleep: day.sleep.totalDurationMinutes / 60, crs });
    }
  }

  if (sleepCrsPairs.length >= 10) {
    const shortSleep = sleepCrsPairs.filter(p => p.sleep < 6.5);
    const goodSleep = sleepCrsPairs.filter(p => p.sleep >= 7 && p.sleep <= 8.5);

    if (shortSleep.length >= 3 && goodSleep.length >= 3) {
      const shortAvgCrs = shortSleep.reduce((s, p) => s + p.crs, 0) / shortSleep.length;
      const goodAvgCrs = goodSleep.reduce((s, p) => s + p.crs, 0) / goodSleep.length;
      const delta = goodAvgCrs - shortAvgCrs;

      if (delta > 10) {
        patterns.push({
          id: 'sleep-crs-correlation',
          type: 'correlation',
          confidence: 'high',
          summary: `When you sleep 7+ hours, your CRS averages ${Math.round(goodAvgCrs)}. Under 6.5h, it drops to ${Math.round(shortAvgCrs)}. That's a ${Math.round(delta)}-point swing.`,
          evidenceCount: sleepCrsPairs.length,
          firstSeen: richDates[0]!,
        });
      }
    }
  }

  // ─── Bedtime consistency → sleep quality ───────────────
  const bedtimeSleepPairs: { deviation: number; efficiency: number }[] = [];
  const bedtimes: number[] = [];
  for (const date of richDates) {
    const day = days.get(date)!;
    if (day.sleep) {
      const bedMin = day.sleep.bedtime.getHours() * 60 + day.sleep.bedtime.getMinutes();
      const adjusted = bedMin > 720 ? bedMin - 1440 : bedMin;
      bedtimes.push(adjusted);
    }
  }
  if (bedtimes.length >= 7) {
    const avgBedtime = bedtimes.reduce((s, v) => s + v, 0) / bedtimes.length;
    for (let i = 0; i < richDates.length; i++) {
      const day = days.get(richDates[i]!)!;
      if (day.sleep && bedtimes[i] !== undefined) {
        bedtimeSleepPairs.push({
          deviation: Math.abs(bedtimes[i]! - avgBedtime),
          efficiency: day.sleep.efficiency,
        });
      }
    }

    const consistent = bedtimeSleepPairs.filter(p => p.deviation < 30);
    const irregular = bedtimeSleepPairs.filter(p => p.deviation > 90);

    if (consistent.length >= 3 && irregular.length >= 3) {
      const consistentEff = consistent.reduce((s, p) => s + p.efficiency, 0) / consistent.length;
      const irregularEff = irregular.reduce((s, p) => s + p.efficiency, 0) / irregular.length;

      if (consistentEff - irregularEff > 0.05) {
        patterns.push({
          id: 'bedtime-consistency',
          type: 'correlation',
          confidence: 'moderate',
          summary: `Consistent bedtime (±30min) gives you ${Math.round(consistentEff * 100)}% sleep efficiency. Irregular nights drop to ${Math.round(irregularEff * 100)}%.`,
          evidenceCount: bedtimeSleepPairs.length,
          firstSeen: richDates[0]!,
        });
      }
    }
  }

  // ─── Exercise → next-day recovery ──────────────────────
  for (let i = 1; i < richDates.length; i++) {
    const prevDate = richDates[i - 1]!;
    const prevDay = days.get(prevDate)!;
    if (prevDay.exerciseMinutes > 60) {
      // Check if there's a next-day CRS pattern after heavy exercise
      const nextCrs = crsScores.get(richDates[i]!)!.score;
      const prevCrs = crsScores.get(prevDate)!.score;
      if (nextCrs < prevCrs - 15) {
        // Found a recovery dip — check if this is a pattern
        const heavyExDays = richDates.filter((d, idx) => {
          const day = days.get(d)!;
          return day.exerciseMinutes > 60 && idx < richDates.length - 1;
        });
        if (heavyExDays.length >= 3) {
          const dips = heavyExDays.filter(d => {
            const nextIdx = richDates.indexOf(d) + 1;
            if (nextIdx >= richDates.length) return false;
            const next = crsScores.get(richDates[nextIdx]!)!.score;
            const curr = crsScores.get(d)!.score;
            return next < curr - 10;
          });
          if (dips.length >= 2) {
            patterns.push({
              id: 'exercise-recovery-dip',
              type: 'recovery',
              confidence: dips.length >= 3 ? 'high' : 'moderate',
              summary: `Heavy exercise (60+ min) drops your next-day CRS. Happened ${dips.length} of ${heavyExDays.length} times.`,
              evidenceCount: heavyExDays.length,
              firstSeen: richDates[0]!,
            });
          }
        }
        break; // Only detect this pattern once
      }
    }
  }

  // ─── Stress timing patterns ────────────────────────────
  const stressHours: number[] = [];
  for (const [, stress] of stressData) {
    for (const event of stress.events) {
      stressHours.push(event.startTime.getHours());
    }
  }
  if (stressHours.length >= 5) {
    const afternoonStress = stressHours.filter(h => h >= 13 && h <= 17).length;
    const morningStress = stressHours.filter(h => h >= 8 && h <= 12).length;
    if (afternoonStress > morningStress * 2 && afternoonStress >= 3) {
      patterns.push({
        id: 'afternoon-stress',
        type: 'weekly',
        confidence: 'moderate',
        summary: `${afternoonStress} of ${stressHours.length} stress events happen between 1-5pm. Your afternoons are your vulnerability window.`,
        evidenceCount: stressHours.length,
        firstSeen: richDates[0]!,
      });
    }
  }

  return patterns;
}

/**
 * Generate simulated Waldo actions for a given day.
 * These represent what a fully autonomous Waldo would have done.
 */
export function simulateWaldoActions(
  date: string,
  day: DailyHealthData,
  crs: CrsResult,
  stress: DailyStressSummary,
  patterns: Pattern[],
): WaldoAction[] {
  const actions: WaldoAction[] = [];

  // Morning: CRS-based actions
  if (crs.score >= 0) {
    if (crs.score >= 80) {
      actions.push({
        time: day.sleep ? formatTime(day.sleep.wakeTime) : '07:00',
        action: 'Flagged today as a deep work day',
        reason: `CRS ${crs.score} — peak cognitive window`,
        type: 'proactive',
      });
    } else if (crs.score < 50) {
      actions.push({
        time: day.sleep ? formatTime(day.sleep.wakeTime) : '07:00',
        action: 'Would suggest pushing first meeting by 1 hour',
        reason: `CRS ${crs.score} — recovery needed`,
        type: 'proactive',
      });
    }
  }

  // Sleep quality actions
  if (day.sleep) {
    const hours = day.sleep.totalDurationMinutes / 60;
    if (hours < 6) {
      actions.push({
        time: formatTime(day.sleep.wakeTime),
        action: `Logged short sleep night (${hours.toFixed(1)}h)`,
        reason: 'Tracking for weekly pattern',
        type: 'learning',
      });
    }
    if (day.sleep.deepPercent < 0.10) {
      actions.push({
        time: formatTime(day.sleep.wakeTime),
        action: 'Noted low deep sleep — checking if late screen time or caffeine',
        reason: `Deep sleep only ${Math.round(day.sleep.deepPercent * 100)}%`,
        type: 'learning',
      });
    }
  }

  // Stress-based actions
  for (const event of stress.events) {
    if (event.confidence >= 0.60) {
      actions.push({
        time: formatTime(event.startTime),
        action: 'Sent a Fetch Alert',
        reason: `Stress confidence ${(event.confidence * 100).toFixed(0)}% — ${event.explanation}`,
        type: 'reactive',
      });
    } else if (event.confidence >= 0.40) {
      actions.push({
        time: formatTime(event.startTime),
        action: 'Logged stress signal (below alert threshold)',
        reason: event.explanation,
        type: 'learning',
      });
    }
  }

  // Pattern-based actions
  const dow = new Date(date + 'T00:00:00').getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyLow = patterns.find(p => p.id === `weekly-low-${dow}`);
  if (weeklyLow) {
    actions.push({
      time: '08:00',
      action: `Flagged: ${dayNames[dow]}s are historically low for you`,
      reason: weeklyLow.summary,
      type: 'proactive',
    });
  }

  return actions;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Spots Engine — generates individual observations ("Spots") for every day.
 * A Spot is a single thing Waldo noticed: "Waldo spotted something."
 *
 * Spots accumulate into Constellations (multi-day patterns).
 * This is the intelligence layer that makes every day useful,
 * even sparse-data days.
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';
import type { DailyStressSummary } from '../types/stress.js';
import type { Pattern } from './pattern-detector.js';

export interface Spot {
  id: string;
  date: string;
  time: string;
  type: 'health' | 'behavior' | 'environment' | 'insight' | 'alert' | 'learning';
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
  title: string;
  detail: string;
  /** Which data signals contributed to this spot */
  signals: string[];
}

export interface DayActivity {
  date: string;
  /** Waldo's one-liner for this day */
  headline: string;
  /** All spots for this day */
  spots: Spot[];
  /** Morning Wag text (pre-generated, not Claude — rule-based) */
  morningWag: string | null;
  /** Evening review text */
  eveningReview: string | null;
  /** Would Waldo have sent a Fetch Alert? */
  fetchAlertFired: boolean;
  /** Data tier for this day */
  tier: 'rich' | 'partial' | 'sparse' | 'empty';
}

/**
 * Generate Spots and activity for every day in the dataset.
 * This runs at startup — no Claude calls, pure rule-based.
 */
export function generateAllDayActivity(
  days: Map<string, DailyHealthData>,
  crsScores: Map<string, CrsResult>,
  stressData: Map<string, DailyStressSummary>,
  _patterns: Pattern[],
): Map<string, DayActivity> {
  const result = new Map<string, DayActivity>();
  const sortedDates = [...days.keys()].sort();

  // Track running state for multi-day observations
  let consecutiveLowSleep = 0;
  let consecutiveHighCrs = 0;
  let prevCrs: number | null = null;

  for (const date of sortedDates) {
    const day = days.get(date)!;
    const crs = crsScores.get(date);
    const stress = stressData.get(date);
    const spots: Spot[] = [];

    const healthSignals = [
      day.sleep ? 'sleep' : null,
      day.hrvReadings.length > 0 ? 'hrv' : null,
      day.hrReadings.length > 0 ? 'hr' : null,
    ].filter(Boolean).length;
    const tier = healthSignals >= 2 ? 'rich' : healthSignals >= 1 ? 'partial' : day.totalSteps > 0 ? 'sparse' : 'empty';

    // ─── Sleep spots ──────────────────────────────────
    if (day.sleep) {
      const hours = day.sleep.totalDurationMinutes / 60;

      if (hours >= 7.5 && day.sleep.efficiency > 0.90) {
        spots.push({
          id: `${date}-sleep-good`, date, time: formatTime(day.sleep.wakeTime),
          type: 'health', severity: 'positive',
          title: `Solid ${hours.toFixed(1)}h sleep`,
          detail: `${Math.round(day.sleep.efficiency * 100)}% efficiency, ${Math.round(day.sleep.deepPercent * 100)}% deep`,
          signals: ['sleep'],
        });
        consecutiveLowSleep = 0;
      } else if (hours < 6) {
        consecutiveLowSleep++;
        spots.push({
          id: `${date}-sleep-short`, date, time: formatTime(day.sleep.wakeTime),
          type: 'health', severity: 'warning',
          title: `Short night — ${hours.toFixed(1)}h`,
          detail: consecutiveLowSleep > 1 ? `${consecutiveLowSleep} short nights in a row` : 'Below your 7h target',
          signals: ['sleep'],
        });
      } else {
        consecutiveLowSleep = 0;
      }

      if (day.sleep.deepPercent < 0.10) {
        spots.push({
          id: `${date}-sleep-deep`, date, time: formatTime(day.sleep.wakeTime),
          type: 'health', severity: 'warning',
          title: `Low deep sleep (${Math.round(day.sleep.deepPercent * 100)}%)`,
          detail: 'Recovery may be incomplete',
          signals: ['sleep'],
        });
      }
    }

    // ─── HRV spots ────────────────────────────────────
    if (day.hrvReadings.length > 0) {
      const avgHrv = day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
      if (avgHrv > 80) {
        spots.push({
          id: `${date}-hrv-high`, date, time: '06:00',
          type: 'health', severity: 'positive',
          title: `HRV running high (${Math.round(avgHrv)}ms)`,
          detail: 'Strong recovery signal',
          signals: ['hrv'],
        });
      } else if (avgHrv < 30) {
        spots.push({
          id: `${date}-hrv-low`, date, time: '06:00',
          type: 'health', severity: 'warning',
          title: `HRV low (${Math.round(avgHrv)}ms)`,
          detail: 'Body under load — take it easy',
          signals: ['hrv'],
        });
      }
    }

    // ─── CRS spots ────────────────────────────────────
    if (crs && crs.score >= 0) {
      if (crs.score >= 85) {
        consecutiveHighCrs++;
        if (consecutiveHighCrs >= 3) {
          spots.push({
            id: `${date}-crs-streak`, date, time: '07:00',
            type: 'insight', severity: 'positive',
            title: `${consecutiveHighCrs}-day peak streak`,
            detail: 'Your body is in a strong rhythm',
            signals: ['crs'],
          });
        }
      } else {
        consecutiveHighCrs = 0;
      }

      // CRS swing from previous day
      if (prevCrs !== null && Math.abs(crs.score - prevCrs) > 20) {
        const direction = crs.score > prevCrs ? 'up' : 'down';
        spots.push({
          id: `${date}-crs-swing`, date, time: '07:00',
          type: 'insight', severity: direction === 'up' ? 'positive' : 'warning',
          title: `CRS swung ${Math.abs(crs.score - prevCrs)} points ${direction}`,
          detail: `${prevCrs} → ${crs.score}`,
          signals: ['crs'],
        });
      }
      prevCrs = crs.score;
    }

    // ─── Stress spots ─────────────────────────────────
    if (stress) {
      for (const event of stress.events) {
        if (event.confidence >= 0.60) {
          spots.push({
            id: `${date}-stress-${formatTime(event.startTime)}`, date, time: formatTime(event.startTime),
            type: 'alert', severity: 'critical',
            title: `Fetch Alert fired`,
            detail: `${event.explanation} (${Math.round(event.confidence * 100)}% confidence)`,
            signals: ['hr', 'hrv'],
          });
        } else if (event.confidence >= 0.40) {
          spots.push({
            id: `${date}-stress-log-${formatTime(event.startTime)}`, date, time: formatTime(event.startTime),
            type: 'learning', severity: 'neutral',
            title: `Stress signal logged`,
            detail: event.explanation,
            signals: ['hr'],
          });
        }
      }
    }

    // ─── Activity spots ───────────────────────────────
    if (day.totalSteps > 12000) {
      spots.push({
        id: `${date}-steps-high`, date, time: '18:00',
        type: 'behavior', severity: 'positive',
        title: `Big day — ${day.totalSteps.toLocaleString()} steps`,
        detail: 'Well above your baseline',
        signals: ['steps'],
      });
    } else if (day.totalSteps > 0 && day.totalSteps < 2000) {
      spots.push({
        id: `${date}-steps-low`, date, time: '18:00',
        type: 'behavior', severity: 'warning',
        title: `Very low movement (${day.totalSteps.toLocaleString()} steps)`,
        detail: 'Sedentary day',
        signals: ['steps'],
      });
    }

    if (day.workouts.length > 0) {
      for (const w of day.workouts) {
        spots.push({
          id: `${date}-workout-${w.activityType}`, date, time: formatTime(w.startDate),
          type: 'behavior', severity: 'positive',
          title: `${w.activityType} workout`,
          detail: `${Math.round(w.durationMinutes)}min, ${Math.round(w.totalEnergyBurned)} kcal`,
          signals: ['workout'],
        });
      }
    }

    // ─── Environment spots ────────────────────────────
    if (day.weather) {
      const tempC = Math.round((day.weather.temperatureF - 32) * 5 / 9);
      if (tempC > 38) {
        spots.push({
          id: `${date}-heat`, date, time: '12:00',
          type: 'environment', severity: 'warning',
          title: `Extreme heat (${tempC}°C)`,
          detail: 'Heat impacts HRV and recovery',
          signals: ['weather'],
        });
      }
    }

    if (day.daylightMinutes > 60) {
      spots.push({
        id: `${date}-daylight`, date, time: '10:00',
        type: 'environment', severity: 'positive',
        title: `Good sunlight (${day.daylightMinutes}min)`,
        detail: 'Supports circadian rhythm',
        signals: ['daylight'],
      });
    }

    // ─── Missing data spots ───────────────────────────
    if (!day.sleep && day.hrReadings.length > 0) {
      spots.push({
        id: `${date}-no-sleep`, date, time: '08:00',
        type: 'learning', severity: 'neutral',
        title: 'No sleep tracked',
        detail: 'Watch not worn to bed? Waldo needs overnight data for a full score.',
        signals: [],
      });
    }

    if (tier === 'sparse') {
      spots.push({
        id: `${date}-sparse`, date, time: '12:00',
        type: 'learning', severity: 'neutral',
        title: `Steps only (${day.totalSteps.toLocaleString()})`,
        detail: 'Waldo is watching what it can. Wear the watch for a full picture.',
        signals: ['steps'],
      });
    }

    // ─── Build day headline ───────────────────────────
    let headline: string;
    if (crs && crs.score >= 0) {
      if (crs.score >= 80) headline = `Peak day. CRS ${crs.score}.`;
      else if (crs.score >= 60) headline = `Solid ${crs.score}. Steady day.`;
      else if (crs.score >= 40) headline = `CRS ${crs.score}. Flagging.`;
      else headline = `Rough day. CRS ${crs.score}.`;
    } else if (day.totalSteps > 0) {
      headline = `${day.totalSteps.toLocaleString()} steps tracked. Limited data.`;
    } else {
      headline = 'No data this day.';
    }

    // ─── Rule-based Morning Wag (no Claude) ───────────
    let morningWag: string | null = null;
    if (day.sleep && crs && crs.score >= 0) {
      const hours = day.sleep.totalDurationMinutes / 60;
      if (crs.score >= 80) {
        morningWag = `${crs.score} today. ${hours.toFixed(1)}h sleep, recovery looks strong. This is your deep work window.`;
      } else if (crs.score >= 60) {
        morningWag = `${crs.score} this morning. ${hours.toFixed(1)}h sleep. Decent, not great — front-load the important stuff.`;
      } else if (crs.score >= 40) {
        morningWag = `${crs.score}. ${hours < 6 ? 'Short night.' : 'Rough night.'} One thing: take it slower today.`;
      } else {
        morningWag = `${crs.score}. Rest. That's the only priority.`;
      }
    }

    // ─── Rule-based Evening Review ────────────────────
    let eveningReview: string | null = null;
    if (crs && crs.score >= 0 && spots.length > 0) {
      const positives = spots.filter(s => s.severity === 'positive').length;
      const warnings = spots.filter(s => s.severity === 'warning').length;
      if (positives > warnings) {
        eveningReview = `Good day overall. ${positives} positive signals. ${day.totalSteps > 0 ? day.totalSteps.toLocaleString() + ' steps.' : ''}`;
      } else if (warnings > 0) {
        eveningReview = `${warnings} thing${warnings > 1 ? 's' : ''} to watch. ${spots.find(s => s.severity === 'warning')?.title ?? ''}. Tomorrow's a reset.`;
      } else {
        eveningReview = `Quiet day. Waldo is still learning your patterns.`;
      }
    }

    result.set(date, {
      date,
      headline,
      spots,
      morningWag,
      eveningReview,
      fetchAlertFired: stress?.fetchAlertTriggered ?? false,
      tier: tier as DayActivity['tier'],
    });
  }

  return result;
}

/** Count total spots across all days */
export function countSpots(activities: Map<string, DayActivity>): { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } {
  let total = 0;
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const activity of activities.values()) {
    for (const spot of activity.spots) {
      total++;
      byType[spot.type] = (byType[spot.type] ?? 0) + 1;
      bySeverity[spot.severity] = (bySeverity[spot.severity] ?? 0) + 1;
    }
  }
  return { total, byType, bySeverity };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

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
import type { DayMeetingData } from '../extractors/calendar-parser.js';
import type { DailyEmailMetrics } from '../extractors/gmail-parser.js';
import type { TaskMetrics } from '../extractors/tasks-parser.js';
import { computeDailyCognitiveLoad, computeBurnoutTrajectory, computeResilience } from './master-metrics.js';
import { computeSleepDebt } from './sleep-debt.js';
import { computeDayStrain } from './strain-engine.js';

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
export interface ProductivityContext {
  calendarData: Map<string, DayMeetingData> | null;
  emailMetrics: Map<string, DailyEmailMetrics> | null;
  taskMetrics: TaskMetrics | null;
}

export function generateAllDayActivity(
  days: Map<string, DailyHealthData>,
  crsScores: Map<string, CrsResult>,
  stressData: Map<string, DailyStressSummary>,
  _patterns: Pattern[],
  productivity?: ProductivityContext,
  userAge?: number,
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

    // ─── Calendar spots ──────────────────────────────
    const dayCal = productivity?.calendarData?.get(date);
    if (dayCal) {
      if (dayCal.meetingLoadScore >= 8) {
        spots.push({
          id: `${date}-mls-heavy`, date, time: '09:00',
          type: 'behavior', severity: 'warning',
          title: `Heavy meeting day (MLS ${dayCal.meetingLoadScore})`,
          detail: `${dayCal.events.length} events, ${dayCal.totalMeetingMinutes}min in meetings`,
          signals: ['calendar'],
        });
      } else if (dayCal.meetingLoadScore >= 4) {
        spots.push({
          id: `${date}-mls-moderate`, date, time: '09:00',
          type: 'behavior', severity: 'neutral',
          title: `${dayCal.events.length} meetings today (MLS ${dayCal.meetingLoadScore})`,
          detail: `${dayCal.totalMeetingMinutes}min scheduled`,
          signals: ['calendar'],
        });
      }
      if (dayCal.backToBackCount >= 2) {
        spots.push({
          id: `${date}-b2b`, date, time: '10:00',
          type: 'alert', severity: 'warning',
          title: `${dayCal.backToBackCount} back-to-back meetings`,
          detail: 'No recovery gaps between meetings',
          signals: ['calendar'],
        });
      }
      if (dayCal.boundaryViolations > 0) {
        spots.push({
          id: `${date}-boundary`, date, time: '19:00',
          type: 'insight', severity: 'warning',
          title: `${dayCal.boundaryViolations} meetings outside work hours`,
          detail: 'Evening or weekend meetings erode recovery',
          signals: ['calendar'],
        });
      }
    }

    // ─── Email spots ───────────────────────────────────
    const dayEmail = productivity?.emailMetrics?.get(date);
    if (dayEmail) {
      if (dayEmail.volumeSpike > 2.0) {
        spots.push({
          id: `${date}-email-spike`, date, time: '12:00',
          type: 'alert', severity: 'warning',
          title: `Email surge: ${dayEmail.totalEmails} (${dayEmail.volumeSpike.toFixed(1)}x normal)`,
          detail: 'Something is happening — reactive load is high',
          signals: ['email'],
        });
      }
      if (dayEmail.afterHoursRatio > 0.4) {
        spots.push({
          id: `${date}-email-afterhours`, date, time: '21:00',
          type: 'behavior', severity: 'warning',
          title: `${Math.round(dayEmail.afterHoursRatio * 100)}% of emails after hours`,
          detail: `${dayEmail.afterHoursCount} emails outside 8am-7pm`,
          signals: ['email'],
        });
      }
      if (dayEmail.totalEmails > 0 && dayEmail.totalEmails < 5) {
        spots.push({
          id: `${date}-email-quiet`, date, time: '17:00',
          type: 'environment', severity: 'positive',
          title: `Quiet email day (${dayEmail.totalEmails})`,
          detail: 'Low reactive load — good for deep work',
          signals: ['email'],
        });
      }
    }

    // ─── Cross-source spots (health + work) ────────────
    if (crs && crs.score >= 0 && dayCal) {
      // High meeting load on low CRS day
      if (crs.score < 50 && dayCal.meetingLoadScore >= 5) {
        spots.push({
          id: `${date}-overloaded`, date, time: '08:00',
          type: 'alert', severity: 'critical',
          title: `Overloaded: CRS ${crs.score} + heavy meetings`,
          detail: `Body is depleted but schedule is demanding. Waldo would reschedule if it could.`,
          signals: ['crs', 'calendar'],
        });
      }
      // Peak CRS with light schedule
      if (crs.score >= 80 && dayCal.meetingLoadScore <= 2) {
        spots.push({
          id: `${date}-peak-window`, date, time: '09:00',
          type: 'insight', severity: 'positive',
          title: `Peak + light schedule = deep work window`,
          detail: `CRS ${crs.score} and few meetings. Rare opportunity.`,
          signals: ['crs', 'calendar'],
        });
      }
    }
    if (crs && crs.score >= 0 && dayEmail) {
      // High email + stress
      if (dayEmail.volumeSpike > 1.5 && stress && stress.events.length > 0) {
        spots.push({
          id: `${date}-email-stress`, date, time: '14:00',
          type: 'insight', severity: 'warning',
          title: 'Email overload correlating with stress',
          detail: `${dayEmail.totalEmails} emails + ${stress.events.length} stress events on the same day`,
          signals: ['email', 'hr'],
        });
      }
    }

    // ─── Compute master metrics for this day ──────────
    const sleepDebt = computeSleepDebt(date, days);
    const strain = computeDayStrain(day, userAge ?? 21);
    const cogLoad = computeDailyCognitiveLoad(
      dayCal ?? null, dayEmail ?? null,
      productivity?.taskMetrics?.overdueTasks ?? 0, sleepDebt,
    );
    const resilience = computeResilience(date, crsScores, days);

    // ─── Master metric spots ─────────────────────────
    if (cogLoad.score >= 70) {
      spots.push({
        id: `${date}-cogload-high`, date, time: '12:00',
        type: 'alert', severity: 'warning',
        title: `Cognitive load ${cogLoad.score}/100 (${cogLoad.level})`,
        detail: cogLoad.summary,
        signals: ['crs', 'calendar', 'email', 'tasks'],
      });
    }
    if (sleepDebt.debtHours >= 4) {
      spots.push({
        id: `${date}-debt-high`, date, time: '07:00',
        type: 'health', severity: 'warning',
        title: `Sleep debt ${sleepDebt.debtHours}h (${sleepDebt.direction})`,
        detail: sleepDebt.summary,
        signals: ['sleep'],
      });
    }
    if (strain.score >= 16) {
      spots.push({
        id: `${date}-strain-high`, date, time: '18:00',
        type: 'behavior', severity: 'warning',
        title: `High strain day (${strain.score}/21)`,
        detail: `Peak HR ${strain.peakHR}. ${strain.totalActiveMinutes}min active. Recovery needed tomorrow.`,
        signals: ['hr', 'workout'],
      });
    }
    if (resilience.score < 35 && resilience.score > 0) {
      spots.push({
        id: `${date}-resilience-low`, date, time: '20:00',
        type: 'insight', severity: 'critical',
        title: `Resilience fragile (${resilience.score}/100)`,
        detail: resilience.summary,
        signals: ['crs', 'hrv'],
      });
    }

    // ─── Build day headline ───────────────────────────
    let headline: string;
    const calSuffix = dayCal ? ` ${dayCal.events.length} meetings.` : '';
    const emailSuffix = dayEmail && dayEmail.totalEmails > 30 ? ` ${dayEmail.totalEmails} emails.` : '';
    const loadSuffix = cogLoad.score >= 50 ? ` Load: ${cogLoad.level}.` : '';
    if (crs && crs.score >= 0) {
      if (crs.score >= 80) headline = `Peak day. CRS ${crs.score}.${calSuffix}${loadSuffix}`;
      else if (crs.score >= 60) headline = `Solid ${crs.score}.${calSuffix}${emailSuffix}${loadSuffix}`;
      else if (crs.score >= 40) headline = `CRS ${crs.score}. Flagging.${calSuffix}${loadSuffix}`;
      else headline = `Rough day. CRS ${crs.score}.${calSuffix}`;
    } else if (dayEmail && dayEmail.totalEmails > 0) {
      headline = `${dayEmail.totalEmails} emails.${calSuffix} Limited health data.`;
    } else if (day.totalSteps > 0) {
      headline = `${day.totalSteps.toLocaleString()} steps.${calSuffix} Limited data.`;
    } else {
      headline = calSuffix ? `${calSuffix.trim()} No health data.` : 'No data this day.';
    }

    // ─── Rule-based Morning Wag (no Claude) ───────────
    let morningWag: string | null = null;
    if (crs && crs.score >= 0) {
      const parts: string[] = [];

      // Lead with score
      parts.push(`${crs.score} today.`);

      // Sleep context
      if (day.sleep) {
        const hours = day.sleep.totalDurationMinutes / 60;
        if (hours < 6) parts.push(`Short night — ${hours.toFixed(1)}h.`);
        else if (hours >= 7.5) parts.push(`Good sleep — ${hours.toFixed(1)}h.`);
        else parts.push(`${hours.toFixed(1)}h sleep.`);
      }

      // Sleep debt
      if (sleepDebt.debtHours >= 3) parts.push(`${sleepDebt.debtHours}h sleep debt dragging.`);

      // Strain from yesterday
      if (strain.score >= 15) parts.push(`Body's still recovering from yesterday's strain.`);

      // Schedule
      if (dayCal && dayCal.events.length > 0) {
        const firstEvent = dayCal.events[0];
        if (firstEvent) {
          const time = new Date(firstEvent.startDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16);
          parts.push(`First up: ${firstEvent.summary.substring(0, 40)} at ${time}.`);
        }
        if (dayCal.meetingLoadScore >= 6) parts.push(`Heavy meeting load (${dayCal.events.length} events).`);
        else if (dayCal.events.length > 1) parts.push(`${dayCal.events.length} meetings today.`);
      }

      // Tasks
      if (productivity?.taskMetrics && productivity.taskMetrics.overdueTasks > 5) {
        parts.push(`${productivity.taskMetrics.overdueTasks} overdue tasks piling up.`);
      }

      // Cognitive load
      if (cogLoad.score >= 60) {
        parts.push(`Cognitive load is ${cogLoad.level}. Protect your focus.`);
      }

      // Action
      if (crs.score >= 80 && cogLoad.score < 50) {
        parts.push(`Deep work window — use it.`);
      } else if (crs.score >= 80 && cogLoad.score >= 50) {
        parts.push(`Good energy but heavy load. Prioritize ruthlessly.`);
      } else if (crs.score >= 60) {
        parts.push(`Front-load the important stuff.`);
      } else if (crs.score >= 40) {
        parts.push(`One thing only. Take it slower.`);
      } else {
        parts.push(`Rest. That's the only priority.`);
      }

      morningWag = parts.join(' ');
    } else if (dayCal && dayCal.events.length > 0) {
      // No health data but have calendar
      const firstEvent = dayCal.events[0];
      const time = firstEvent ? new Date(firstEvent.startDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16) : '';
      morningWag = `No health data today. ${dayCal.events.length} meetings scheduled.${firstEvent ? ` First: ${firstEvent.summary.substring(0, 30)} at ${time}.` : ''}`;
    }

    // ─── Rule-based Evening Review ────────────────────
    let eveningReview: string | null = null;
    if (spots.length > 0) {
      const positives = spots.filter(s => s.severity === 'positive').length;
      const warnings = spots.filter(s => s.severity === 'warning').length;
      const criticals = spots.filter(s => s.severity === 'critical').length;

      const parts: string[] = [];

      // Lead with the day's character
      if (crs && crs.score >= 80 && cogLoad.score < 40) {
        parts.push('Strong day.');
      } else if (criticals > 0 || cogLoad.score >= 70) {
        parts.push('Heavy day.');
      } else if (warnings > positives) {
        parts.push('Mixed day.');
      } else {
        parts.push('Decent day.');
      }

      // Key metrics summary
      if (crs && crs.score >= 0) parts.push(`CRS ${crs.score}.`);
      if (strain.score > 5) parts.push(`Strain ${strain.score}/21.`);
      if (day.totalSteps > 0) parts.push(`${day.totalSteps.toLocaleString()} steps.`);

      // Work summary
      if (dayCal) parts.push(`${dayCal.events.length} meetings done.`);
      if (dayEmail) parts.push(`${dayEmail.totalEmails} emails handled.`);

      // Cognitive load closing
      if (cogLoad.score >= 60) {
        parts.push(`Cognitive load was ${cogLoad.level}. Give yourself a real break tonight.`);
      }

      // Sleep debt reminder
      if (sleepDebt.debtHours >= 2) {
        parts.push(`Sleep debt at ${sleepDebt.debtHours}h. Early bedtime tonight.`);
      }

      // Resilience check
      if (resilience.score < 40) {
        parts.push(`Resilience is ${resilience.level}. Tomorrow needs to be lighter.`);
      }

      // Burnout hint
      const burnout = computeBurnoutTrajectory(date, days, crsScores, productivity?.calendarData ?? null, productivity?.emailMetrics ?? null);
      if (burnout.status === 'burnout_trajectory') {
        parts.push(`Burnout signals building. This can't continue.`);
      } else if (burnout.status === 'warning') {
        parts.push(`Watch the trend this week.`);
      }

      eveningReview = parts.join(' ');
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

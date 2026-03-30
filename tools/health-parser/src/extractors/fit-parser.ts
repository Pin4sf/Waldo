/**
 * Google Fit data parser.
 * Parses daily activity metrics CSVs and session JSONs.
 * Fills the pre-Apple Watch gap (Dec 2022 → Oct 2023).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FitDailyMetrics {
  date: string;
  steps: number;
  calories: number;
  distanceMeters: number;
  moveMinutes: number;
  walkingDurationMs: number;
  runningDurationMs: number;
  heartPoints: number;
  avgSpeedMs: number;
}

export interface FitSession {
  activity: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  steps: number;
  calories: number;
  distanceMeters: number;
}

export interface FitData {
  dailyMetrics: Map<string, FitDailyMetrics>;
  sessions: FitSession[];
  dateRange: { start: string; end: string };
}

/**
 * Parse all daily activity metric CSVs from a directory.
 * Each file is one day, named YYYY-MM-DD.csv.
 */
export function parseFitData(fitDir: string): FitData {
  const dailyMetrics = new Map<string, FitDailyMetrics>();
  const sessions: FitSession[] = [];

  // Parse daily metrics
  const dailyDir = path.join(fitDir, 'Daily activity metrics');
  if (fs.existsSync(dailyDir)) {
    const files = fs.readdirSync(dailyDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.csv$/));

    for (const file of files) {
      const date = file.replace('.csv', '');
      const content = fs.readFileSync(path.join(dailyDir, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      if (lines.length < 2) continue;

      // Aggregate all rows for this day (15-min intervals)
      let steps = 0, calories = 0, distance = 0, moveMin = 0;
      let walkMs = 0, runMs = 0, heartPts = 0;
      let speedSum = 0, speedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(',');
        if (cols.length < 16) continue;

        const moveMinVal = parseFloat(cols[2] ?? '') || 0;
        const cal = parseFloat(cols[3] ?? '') || 0;
        const dist = parseFloat(cols[4] ?? '') || 0;
        const hp = parseFloat(cols[5] ?? '') || 0;
        const avgSpd = parseFloat(cols[7] ?? '') || 0;
        const stepVal = parseFloat(cols[10] ?? '') || 0;
        const walkDur = parseFloat(cols[14] ?? '') || 0;
        const runDur = parseFloat(cols[15] ?? '') || 0;

        steps += stepVal;
        calories += cal;
        distance += dist;
        moveMin += moveMinVal;
        heartPts += hp;
        walkMs += walkDur;
        runMs += runDur;
        if (avgSpd > 0) { speedSum += avgSpd; speedCount++; }
      }

      dailyMetrics.set(date, {
        date,
        steps: Math.round(steps),
        calories: Math.round(calories),
        distanceMeters: Math.round(distance),
        moveMinutes: Math.round(moveMin),
        walkingDurationMs: Math.round(walkMs),
        runningDurationMs: Math.round(runMs),
        heartPoints: Math.round(heartPts),
        avgSpeedMs: speedCount > 0 ? speedSum / speedCount : 0,
      });
    }
  }

  // Parse session JSONs
  const sessionsDir = path.join(fitDir, 'All sessions');
  if (fs.existsSync(sessionsDir)) {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8')) as {
          fitnessActivity: string;
          startTime: string;
          endTime: string;
          duration: string;
          aggregate?: Array<{ metricName: string; intValue?: number; floatValue?: number }>;
        };

        const durationMatch = content.duration?.match(/(\d+\.?\d*)/);
        const durationSec = durationMatch ? parseFloat(durationMatch[1]!) : 0;

        let sessionSteps = 0, sessionCal = 0, sessionDist = 0;
        if (content.aggregate) {
          for (const agg of content.aggregate) {
            const val = agg.intValue ?? agg.floatValue ?? 0;
            if (agg.metricName.includes('step_count')) sessionSteps = val;
            if (agg.metricName.includes('calories')) sessionCal = val;
            if (agg.metricName.includes('distance')) sessionDist = val;
          }
        }

        sessions.push({
          activity: content.fitnessActivity,
          startTime: new Date(content.startTime),
          endTime: new Date(content.endTime),
          durationSeconds: durationSec,
          steps: Math.round(sessionSteps),
          calories: Math.round(sessionCal),
          distanceMeters: Math.round(sessionDist),
        });
      } catch {
        // Skip malformed JSON
      }
    }
  }

  const dates = [...dailyMetrics.keys()].sort();

  return {
    dailyMetrics,
    sessions: sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    dateRange: { start: dates[0] ?? '', end: dates[dates.length - 1] ?? '' },
  };
}

/** Build a summary for the user intelligence profile */
export function buildFitSummary(fit: FitData): string {
  const days = [...fit.dailyMetrics.values()];
  if (days.length === 0) return '';

  const avgSteps = Math.round(days.reduce((s, d) => s + d.steps, 0) / days.length);
  const avgCal = Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length);
  const avgMove = Math.round(days.reduce((s, d) => s + d.moveMinutes, 0) / days.length);
  const totalSessions = fit.sessions.length;
  const activityTypes = new Map<string, number>();
  for (const s of fit.sessions) {
    activityTypes.set(s.activity, (activityTypes.get(s.activity) ?? 0) + 1);
  }
  const topActivities = [...activityTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return [
    `Google Fit (pre-Apple Watch): ${days.length} days, ${fit.dateRange.start} → ${fit.dateRange.end}.`,
    `Avg ${avgSteps} steps/day, ${avgCal} kcal, ${avgMove}min active.`,
    `${totalSessions} activity sessions. Top: ${topActivities.map(([a, c]) => `${a} (${c}x)`).join(', ')}.`,
  ].join(' ');
}

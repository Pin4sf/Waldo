/**
 * Day Strain — WHOOP-style cardiovascular load score (0-21).
 *
 * Based on TRIMP (Training Impulse): time in each HR zone × exponential weight.
 * Uses a log scale — easy to hit 10, exponentially harder to reach 21.
 *
 * HR zones based on % of max HR (220 - age):
 *   Zone 1 (50-60%): light — weight 1.0
 *   Zone 2 (60-70%): moderate — weight 1.5
 *   Zone 3 (70-80%): vigorous — weight 2.5
 *   Zone 4 (80-90%): hard — weight 4.0
 *   Zone 5 (90-100%): max — weight 8.0
 *
 * Final: log10(trimp) scaled to 0-21.
 */
import type { DailyHealthData } from '../types/health.js';

const ZONE_WEIGHTS = [1.0, 1.5, 2.5, 4.0, 8.0];
const ZONE_NAMES = ['Rest/Light', 'Moderate', 'Vigorous', 'Hard', 'Max'];

export interface StrainResult {
  /** 0-21 score */
  score: number;
  /** Label */
  level: 'rest' | 'low' | 'medium' | 'high' | 'overreaching';
  /** Minutes in each HR zone */
  zoneMinutes: number[];
  /** Zone names for display */
  zoneNames: string[];
  /** Total active minutes */
  totalActiveMinutes: number;
  /** Peak HR recorded */
  peakHR: number;
  /** Raw TRIMP value */
  trimp: number;
  /** Summary */
  summary: string;
}

export function computeDayStrain(day: DailyHealthData, age: number): StrainResult {
  if (day.hrReadings.length < 5) {
    return emptyResult();
  }

  const maxHR = 220 - age;
  const zones = [0, 0, 0, 0, 0]; // minutes in each zone

  // Sort HR readings by time and estimate time in each zone
  const sorted = [...day.hrReadings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let peakHR = 0;

  for (let i = 0; i < sorted.length; i++) {
    const hr = sorted[i]!.bpm;
    if (hr > peakHR) peakHR = hr;

    // Estimate minutes for this reading (gap to next reading, capped at 15 min)
    let minutes = 1; // default 1 minute
    if (i < sorted.length - 1) {
      const gap = (sorted[i + 1]!.timestamp.getTime() - sorted[i]!.timestamp.getTime()) / 60000;
      minutes = Math.min(gap, 15); // Cap at 15 min per reading
    }

    // Determine zone
    const pctMax = hr / maxHR;
    if (pctMax >= 0.90) zones[4]! += minutes;
    else if (pctMax >= 0.80) zones[3]! += minutes;
    else if (pctMax >= 0.70) zones[2]! += minutes;
    else if (pctMax >= 0.60) zones[1]! += minutes;
    else if (pctMax >= 0.50) zones[0]! += minutes;
    // Below 50% = rest, not counted
  }

  // Compute TRIMP
  let trimp = 0;
  for (let z = 0; z < 5; z++) {
    trimp += zones[z]! * ZONE_WEIGHTS[z]!;
  }

  // Scale to 0-21 using log
  // WHOOP's scale: ~0 at rest, ~10 for moderate day, ~15 for hard workout, ~21 for extreme
  // log10(1) = 0, log10(10) = 1, log10(100) = 2, log10(1000) = 3
  // We scale: strain = min(21, log10(trimp + 1) * 7)
  const score = Math.min(21, Math.round(Math.log10(trimp + 1) * 7 * 10) / 10);

  const totalActive = zones.reduce((s, z) => s + z, 0);

  const level = score >= 18 ? 'overreaching'
    : score >= 14 ? 'high'
    : score >= 10 ? 'medium'
    : score >= 4 ? 'low'
    : 'rest';

  const levelLabels: Record<string, string> = {
    rest: 'Rest day',
    low: 'Light day',
    medium: 'Moderate strain',
    high: 'Hard day — recovery needed',
    overreaching: 'Extreme — watch for overtraining',
  };

  return {
    score,
    level,
    zoneMinutes: zones.map(z => Math.round(z)),
    zoneNames: ZONE_NAMES,
    totalActiveMinutes: Math.round(totalActive),
    peakHR,
    trimp: Math.round(trimp),
    summary: `Strain ${score}/21 (${levelLabels[level]}). Peak HR ${peakHR}. ${Math.round(totalActive)}min active.`,
  };
}

function emptyResult(): StrainResult {
  return {
    score: 0, level: 'rest', zoneMinutes: [0, 0, 0, 0, 0], zoneNames: ZONE_NAMES,
    totalActiveMinutes: 0, peakHR: 0, trimp: 0, summary: 'No HR data for strain calculation.',
  };
}

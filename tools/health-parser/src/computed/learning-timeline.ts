/**
 * Learning Timeline — shows WHEN Waldo learned things and HOW intelligence grew.
 * This is the "story of learning" — proof that Waldo gets smarter over time.
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';
import type { Pattern } from './pattern-detector.js';
import type { CrossSourceInsight } from './master-metrics.js';

export interface LearningMilestone {
  date: string;
  type: 'baseline' | 'pattern' | 'insight' | 'adaptation' | 'cross_source' | 'data_source';
  title: string;
  detail: string;
  /** How many data points led to this learning */
  dataPoints: number;
  /** Confidence at time of learning */
  confidence: number;
}

export interface LearningTimeline {
  milestones: LearningMilestone[];
  /** Summary stats */
  totalDaysObserved: number;
  totalSpotsGenerated: number;
  dataSources: string[];
  intelligenceScore: number;
  summary: string;
}

export function buildLearningTimeline(
  days: Map<string, DailyHealthData>,
  allCrs: Map<string, CrsResult>,
  patterns: Pattern[],
  crossSourceInsights: CrossSourceInsight[],
  spotsCount: number,
  connectedSources: string[],
): LearningTimeline {
  const milestones: LearningMilestone[] = [];
  const sortedDates = [...days.keys()].sort();

  // ─── Data source milestones ──────────────────────────
  // Find first day of each data type
  let firstHR: string | null = null;
  let firstSleep: string | null = null;
  let firstHRV: string | null = null;
  let firstCRS: string | null = null;
  for (const date of sortedDates) {
    const day = days.get(date)!;
    if (!firstHR && day.hrReadings.length > 0) firstHR = date;
    if (!firstSleep && day.sleep) firstSleep = date;
    if (!firstHRV && day.hrvReadings.length > 0) firstHRV = date;
    if (!firstCRS) {
      const crs = allCrs.get(date);
      if (crs && crs.score >= 0) firstCRS = date;
    }
    if (firstHR && firstSleep && firstHRV && firstCRS) break;
  }

  if (firstHR) {
    milestones.push({
      date: firstHR, type: 'data_source',
      title: 'First heart rate data',
      detail: 'Waldo started watching your heart. The foundation of everything.',
      dataPoints: 1, confidence: 0.3,
    });
  }

  if (firstSleep) {
    milestones.push({
      date: firstSleep, type: 'data_source',
      title: 'First sleep tracked',
      detail: 'Overnight data unlocked. Sleep is 35% of your readiness score.',
      dataPoints: 1, confidence: 0.4,
    });
  }

  if (firstHRV) {
    milestones.push({
      date: firstHRV, type: 'data_source',
      title: 'First HRV reading',
      detail: 'Beat-to-beat variability. The deepest signal of your nervous system.',
      dataPoints: 1, confidence: 0.5,
    });
  }

  if (firstCRS) {
    milestones.push({
      date: firstCRS, type: 'baseline',
      title: 'First Nap Score computed',
      detail: 'Enough data for a full readiness score. Waldo can now predict your day.',
      dataPoints: 3, confidence: 0.5,
    });
  }

  // ─── Baseline milestones ────────────────────────────
  // 7-day baseline established
  const richDates = sortedDates.filter(d => {
    const crs = allCrs.get(d);
    return crs && crs.score >= 0;
  });

  if (richDates.length >= 7) {
    milestones.push({
      date: richDates[6]!, type: 'baseline',
      title: '7-day baseline established',
      detail: 'Personal baselines locked. All comparisons are now against YOUR normal, not population averages.',
      dataPoints: 7, confidence: 0.7,
    });
  }

  if (richDates.length >= 14) {
    milestones.push({
      date: richDates[13]!, type: 'baseline',
      title: 'Chronotype identified',
      detail: 'Waldo knows your natural rhythm — when you peak, when you crash, when to protect focus time.',
      dataPoints: 14, confidence: 0.8,
    });
  }

  if (richDates.length >= 30) {
    milestones.push({
      date: richDates[29]!, type: 'baseline',
      title: '30-day profile complete',
      detail: 'Long-term baselines stable. Waldo can now detect trends, not just daily snapshots.',
      dataPoints: 30, confidence: 0.9,
    });
  }

  // ─── Pattern milestones ────────────────────────────
  for (const pattern of patterns) {
    milestones.push({
      date: pattern.firstSeen,
      type: 'pattern',
      title: `Pattern discovered: ${pattern.type}`,
      detail: pattern.summary,
      dataPoints: pattern.evidenceCount,
      confidence: pattern.confidence === 'high' ? 0.9 : pattern.confidence === 'moderate' ? 0.7 : 0.5,
    });
  }

  // ─── Cross-source milestones ───────────────────────
  for (const insight of crossSourceInsights) {
    milestones.push({
      date: sortedDates[Math.floor(sortedDates.length * 0.7)] ?? sortedDates[sortedDates.length - 1]!,
      type: 'cross_source',
      title: `Cross-source insight: ${insight.type.replace('_', ' ')}`,
      detail: insight.summary,
      dataPoints: insight.evidenceCount,
      confidence: insight.confidence === 'high' ? 0.9 : 0.7,
    });
  }

  // ─── Adaptation milestones ─────────────────────────
  // Find weeks where CRS prediction accuracy improved
  if (richDates.length >= 21) {
    // First 7 days vs days 14-21: check if CRS variance decreased (more stable predictions)
    const earlyScores = richDates.slice(0, 7).map(d => allCrs.get(d)!.score);
    const laterScores = richDates.slice(14, 21).map(d => allCrs.get(d)?.score ?? 0);
    const earlyVar = variance(earlyScores);
    const laterVar = variance(laterScores);

    if (laterVar < earlyVar * 0.7) {
      milestones.push({
        date: richDates[20]!,
        type: 'adaptation',
        title: 'Predictions getting sharper',
        detail: `CRS variability dropped ${Math.round((1 - laterVar / earlyVar) * 100)}%. Waldo is calibrating to your rhythms.`,
        dataPoints: 21,
        confidence: 0.75,
      });
    }
  }

  // Connected data sources milestone
  if (connectedSources.length >= 3) {
    milestones.push({
      date: sortedDates[sortedDates.length - 1]!,
      type: 'data_source',
      title: `${connectedSources.length} data sources connected`,
      detail: `Waldo sees: ${connectedSources.join(', ')}. Each new source multiplies intelligence.`,
      dataPoints: connectedSources.length,
      confidence: 0.8,
    });
  }

  // Sort by date
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  // Intelligence score: rough measure of how much Waldo knows
  const intelligenceScore = Math.min(100, Math.round(
    (connectedSources.length / 10) * 30 + // Sources: max 30
    (Math.min(richDates.length, 90) / 90) * 30 + // Days: max 30 (90 days = full)
    (patterns.length / 5) * 20 + // Patterns: max 20 (5 patterns = full)
    (crossSourceInsights.length / 3) * 20 // Cross-source: max 20 (3 insights = full)
  ));

  const summary = [
    `Waldo has observed ${days.size} days of data across ${connectedSources.length} sources.`,
    `${spotsCount.toLocaleString()} individual observations made.`,
    `${patterns.length} recurring patterns discovered.`,
    `${crossSourceInsights.length} cross-source correlations found.`,
    `Intelligence score: ${intelligenceScore}/100.`,
  ].join(' ');

  return {
    milestones,
    totalDaysObserved: days.size,
    totalSpotsGenerated: spotsCount,
    dataSources: connectedSources,
    intelligenceScore,
    summary,
  };
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

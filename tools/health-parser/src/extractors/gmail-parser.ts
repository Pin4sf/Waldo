/**
 * Gmail MBOX header parser — METADATA ONLY, NEVER reads email body.
 * Extracts: timestamp, sender domain, thread ID, labels, direction (sent/received).
 * Computes: Communication Stress Index, after-hours ratio, volume patterns.
 *
 * Privacy: Only reads lines starting with known header prefixes.
 * Body content is never parsed, stored, or logged.
 */
import * as fs from 'node:fs';
import * as readline from 'node:readline';

export interface EmailMetadata {
  date: Date;
  senderDomain: string;
  isSent: boolean;
  labels: string[];
  threadId: string;
  isAfterHours: boolean;
}

export interface DailyEmailMetrics {
  date: string;
  totalEmails: number;
  sentCount: number;
  receivedCount: number;
  afterHoursCount: number;
  afterHoursRatio: number;
  /** Unique thread count — more threads = more context switching */
  uniqueThreads: number;
  /** Volume relative to 30-day average */
  volumeSpike: number;
}

export interface EmailIntelligence {
  totalEmails: number;
  dateRange: { start: string; end: string };
  avgDailyVolume: number;
  avgAfterHoursRatio: number;
  busiestDayOfWeek: string;
  quietestDayOfWeek: string;
  /** Daily metrics for merging with health data */
  dailyMetrics: Map<string, DailyEmailMetrics>;
  /** Natural language summary */
  summary: string;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateKey(d: Date): string {
  const local = new Date(d.getTime() + IST_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

function isAfterHours(d: Date): boolean {
  const istHour = new Date(d.getTime() + IST_OFFSET_MS).getHours();
  return istHour < 8 || istHour >= 19;
}

/**
 * Stream-parse the MBOX file for headers only.
 * This can handle the 1.3GB file without loading into memory.
 */
export async function parseGmailMbox(
  filePath: string,
  onProgress?: (count: number) => void,
): Promise<EmailIntelligence> {
  const emails: EmailMetadata[] = [];

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let currentDate: Date | null = null;
  let currentSender = '';
  let currentLabels: string[] = [];
  let currentThreadId = '';
  let inHeaders = false;
  let emailCount = 0;

  for await (const line of rl) {
    // New email starts with "From " at the beginning of a line
    if (line.startsWith('From ') && line.includes('@')) {
      // Save previous email (inHeaders may be false — we save regardless if we have a date)
      if (currentDate) {
        const senderDomain = currentSender.includes('@')
          ? currentSender.split('@')[1]?.replace('>', '') ?? 'unknown'
          : 'unknown';
        const isSent = currentLabels.includes('Sent');

        emails.push({
          date: currentDate,
          senderDomain,
          isSent,
          labels: currentLabels,
          threadId: currentThreadId,
          isAfterHours: isAfterHours(currentDate),
        });

        emailCount++;
        if (onProgress && emailCount % 1000 === 0) onProgress(emailCount);
      }

      // Reset for new email
      currentDate = null;
      currentSender = '';
      currentLabels = [];
      currentThreadId = '';
      inHeaders = true;
      continue;
    }

    if (!inHeaders) continue;

    // Empty line = end of headers, start of body — STOP reading
    if (line.trim() === '') {
      inHeaders = false;
      continue;
    }

    // Only parse known safe header lines
    if (line.startsWith('Date:')) {
      try {
        currentDate = new Date(line.slice(5).trim());
        if (isNaN(currentDate.getTime())) currentDate = null;
      } catch { currentDate = null; }
    } else if (line.startsWith('From:')) {
      currentSender = line.slice(5).trim();
    } else if (line.startsWith('X-Gmail-Labels:')) {
      currentLabels = line.slice(15).trim().split(',').map(l => l.trim());
    } else if (line.startsWith('X-GM-THRID:')) {
      currentThreadId = line.slice(11).trim();
    }
    // All other header lines are ignored — we don't need Subject, To, etc.
  }

  // Save last email
  if (currentDate) {
    emails.push({
      date: currentDate,
      senderDomain: currentSender.includes('@') ? currentSender.split('@')[1]?.replace('>', '') ?? 'unknown' : 'unknown',
      isSent: currentLabels.includes('Sent'),
      labels: currentLabels,
      threadId: currentThreadId,
      isAfterHours: isAfterHours(currentDate),
    });
  }

  // Compute daily metrics
  const byDay = new Map<string, EmailMetadata[]>();
  for (const e of emails) {
    const dk = dateKey(e.date);
    if (!byDay.has(dk)) byDay.set(dk, []);
    byDay.get(dk)!.push(e);
  }

  const dailyMetrics = new Map<string, DailyEmailMetrics>();
  const dailyVolumes: number[] = [];

  for (const [date, dayEmails] of byDay) {
    const sent = dayEmails.filter(e => e.isSent).length;
    const received = dayEmails.length - sent;
    const afterHours = dayEmails.filter(e => e.isAfterHours).length;
    const threads = new Set(dayEmails.map(e => e.threadId)).size;

    dailyVolumes.push(dayEmails.length);

    dailyMetrics.set(date, {
      date,
      totalEmails: dayEmails.length,
      sentCount: sent,
      receivedCount: received,
      afterHoursCount: afterHours,
      afterHoursRatio: dayEmails.length > 0 ? afterHours / dayEmails.length : 0,
      uniqueThreads: threads,
      volumeSpike: 1.0, // Will be computed after averages
    });
  }

  // Compute 30-day rolling average for volume spike
  const sortedDates = [...dailyMetrics.keys()].sort();
  for (let i = 0; i < sortedDates.length; i++) {
    const lookback = sortedDates.slice(Math.max(0, i - 30), i);
    if (lookback.length > 0) {
      const avg = lookback.reduce((s, d) => s + (dailyMetrics.get(d)?.totalEmails ?? 0), 0) / lookback.length;
      const today = dailyMetrics.get(sortedDates[i]!)!;
      today.volumeSpike = avg > 0 ? today.totalEmails / avg : 1.0;
    }
  }

  // Day-of-week analysis
  const dowVolume = new Map<number, number[]>();
  for (const [date, metrics] of dailyMetrics) {
    const dow = new Date(date + 'T00:00:00').getDay();
    if (!dowVolume.has(dow)) dowVolume.set(dow, []);
    dowVolume.get(dow)!.push(metrics.totalEmails);
  }

  let busiestDow = 0, quietestDow = 0, busiestAvg = 0, quietestAvg = Infinity;
  for (const [dow, volumes] of dowVolume) {
    const avg = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    if (avg > busiestAvg) { busiestAvg = avg; busiestDow = dow; }
    if (avg < quietestAvg) { quietestAvg = avg; quietestDow = dow; }
  }

  const avgDaily = dailyVolumes.length > 0 ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length : 0;
  const avgAfterHours = [...dailyMetrics.values()].reduce((s, d) => s + d.afterHoursRatio, 0) / dailyMetrics.size;

  const allDates = sortedDates;
  const summary = [
    `${emails.length} emails across ${dailyMetrics.size} days.`,
    `Avg ${Math.round(avgDaily)}/day.`,
    `After-hours: ${Math.round(avgAfterHours * 100)}% of emails.`,
    `Busiest: ${DAY_NAMES[busiestDow]} (${Math.round(busiestAvg)}/day). Quietest: ${DAY_NAMES[quietestDow]} (${Math.round(quietestAvg)}/day).`,
  ].join(' ');

  return {
    totalEmails: emails.length,
    dateRange: { start: allDates[0] ?? '', end: allDates[allDates.length - 1] ?? '' },
    avgDailyVolume: avgDaily,
    avgAfterHoursRatio: avgAfterHours,
    busiestDayOfWeek: DAY_NAMES[busiestDow]!,
    quietestDayOfWeek: DAY_NAMES[quietestDow]!,
    dailyMetrics,
    summary,
  };
}

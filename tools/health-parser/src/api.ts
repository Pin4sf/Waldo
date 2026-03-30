/**
 * Waldo Health Parser — HTTP API Server
 *
 * Parses health data on startup, precomputes CRS and stress,
 * then serves REST endpoints for the demo frontend.
 *
 * Usage: npx tsx src/api.ts [path-to-export.xml]
 * Runs on http://localhost:3737
 */
import * as http from 'node:http';
import { parseAppleHealthExport } from './xml-stream-parser.js';
import { organizeDailyData, getSortedDates } from './extractors/daily-organizer.js';
import { computeCrs, computeAllCrs } from './computed/crs-engine.js';
import { detectDailyStress } from './computed/stress-detector.js';
import { detectPatterns, simulateWaldoActions } from './computed/pattern-detector.js';
import { generateAllDayActivity, countSpots } from './computed/spots-engine.js';
import { buildUserIntelligence } from './computed/user-intelligence.js';
import type { UserIntelligence } from './computed/user-intelligence.js';
import type { DayActivity } from './computed/spots-engine.js';
import { enrichWeather } from './enrichment/weather.js';
import { enrichAirQuality, aqiToLabel } from './enrichment/air-quality.js';
import { computeSleepDebt } from './computed/sleep-debt.js';
import { computeDayStrain } from './computed/strain-engine.js';
import { parseICS, organizeCalendarByDay } from './extractors/calendar-parser.js';
import type { DayMeetingData } from './extractors/calendar-parser.js';
import { parseGoogleTasks, buildTasksSummary } from './extractors/tasks-parser.js';
import type { TaskMetrics } from './extractors/tasks-parser.js';
import { parseGmailMbox } from './extractors/gmail-parser.js';
import type { EmailIntelligence } from './extractors/gmail-parser.js';
import { parseFitData, buildFitSummary } from './extractors/fit-parser.js';
import type { FitData } from './extractors/fit-parser.js';
import { computeDailyCognitiveLoad, computeBurnoutTrajectory, computeResilience, detectCrossSourcePatterns } from './computed/master-metrics.js';
import { buildLearningTimeline } from './computed/learning-timeline.js';
import type { LearningTimeline } from './computed/learning-timeline.js';
import type { CrossSourceInsight } from './computed/master-metrics.js';
import type { Pattern } from './computed/pattern-detector.js';
import { buildAgentContext, buildUserMessage } from './simulation/prompt-builder.js';
import { assembleSoulPrompt } from './simulation/soul-file.js';
import { continueOnboarding } from './simulation/onboarding.js';
import type { UserProfile, OnboardingMessage } from './simulation/onboarding.js';
import { generateWaldoResponse } from './simulation/agent.js';
import { getPersonalityZone } from './types/agent.js';
import type { ExtractedHealthData, DailyHealthData } from './types/health.js';
import type { CrsResult } from './types/crs.js';
import type { DailyStressSummary } from './types/stress.js';
import type { MessageMode } from './types/agent.js';

const PORT = 3737;
const EXPORT_PATH = process.argv[2] ?? '../../AppleHealthExport/apple_health_export_ark/export.xml';

// ─── Precomputed State ────────────────────────────────────────────────

let extracted: ExtractedHealthData;
let days: Map<string, DailyHealthData>;
let allCrs: Map<string, CrsResult>;
let allStress: Map<string, DailyStressSummary>;
let allPatterns: Pattern[];
let allDayActivity: Map<string, DayActivity>;
let userIntelligence: UserIntelligence;

// Productivity data (from Google Takeout)
let calendarData: Map<string, DayMeetingData> | null = null;
let taskMetrics: TaskMetrics | null = null;
let emailIntelligence: EmailIntelligence | null = null;
let fitData: FitData | null = null;
let crossSourceInsights: CrossSourceInsight[] = [];
let learningTimeline: LearningTimeline | null = null;

// Onboarding state (in-memory for demo)
let userProfile: UserProfile | null = null;
let onboardingHistory: OnboardingMessage[] = [];

async function init(): Promise<void> {
  console.log(`Parsing: ${EXPORT_PATH}`);
  const t0 = Date.now();

  extracted = await parseAppleHealthExport(EXPORT_PATH);
  days = organizeDailyData(extracted);
  allCrs = computeAllCrs(days);

  // Precompute stress for days with cardiac data
  allStress = new Map();
  for (const [date, day] of days) {
    if (day.hrReadings.length >= 5) {
      allStress.set(date, detectDailyStress(day, days));
    }
  }

  // Enrich weather for days without workout weather data (Open-Meteo, free)
  console.log('  Enriching weather data from Open-Meteo...');
  const weatherEnriched = await enrichWeather(days);
  console.log(`  ${weatherEnriched} days enriched with weather`);

  // Enrich air quality
  console.log('  Enriching air quality from Open-Meteo...');
  const aqEnriched = await enrichAirQuality(days);
  console.log(`  ${aqEnriched} days enriched with air quality`);

  // Parse Google Takeout data (if available)
  const takeoutBase = '../../takeoutexport_ark';
  const calendarPath = `${takeoutBase}/Takeout 5/Calendar/arkpatil2717@gmail.com.ics`;
  const tasksPath = `${takeoutBase}/Takeout 5/Tasks/Tasks.json`;
  const gmailPath = `${takeoutBase}/Takeout 4/Mail/All mail Including Spam and Trash.mbox`;

  try {
    const fs = await import('node:fs');
    if (fs.existsSync(calendarPath)) {
      console.log('  Parsing Google Calendar...');
      const events = parseICS(calendarPath);
      calendarData = organizeCalendarByDay(events);
      console.log(`  ${events.length} calendar events across ${calendarData.size} days`);
    }
    if (fs.existsSync(tasksPath)) {
      console.log('  Parsing Google Tasks...');
      taskMetrics = parseGoogleTasks(tasksPath);
      console.log(`  ${taskMetrics.totalTasks} tasks (${taskMetrics.completedTasks} done, ${taskMetrics.pendingTasks} pending)`);
    }
    if (fs.existsSync(gmailPath)) {
      console.log('  Parsing Gmail headers (metadata only)...');
      emailIntelligence = await parseGmailMbox(gmailPath, (count) => {
        if (count % 5000 === 0) process.stdout.write(`\r  Gmail: ${count.toLocaleString()} emails parsed...`);
      });
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      console.log(`  ${emailIntelligence.totalEmails} emails across ${emailIntelligence.dailyMetrics.size} days`);
    }
    const fitPath = `${takeoutBase}/Takeout 5/Fit`;
    if (fs.existsSync(fitPath)) {
      console.log('  Parsing Google Fit...');
      fitData = parseFitData(fitPath);
      console.log(`  ${fitData.dailyMetrics.size} Fit days, ${fitData.sessions.length} sessions (${fitData.dateRange.start} → ${fitData.dateRange.end})`);
    }
  } catch (err) {
    console.log(`  Takeout data not found or parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Detect patterns across the full timeline
  allPatterns = detectPatterns(days, allCrs, allStress);

  // Cross-source pattern detection
  crossSourceInsights = detectCrossSourcePatterns(
    days, allCrs,
    calendarData,
    emailIntelligence?.dailyMetrics ?? null,
  );
  if (crossSourceInsights.length > 0) {
    console.log(`  ${crossSourceInsights.length} cross-source insights discovered`);
    for (const insight of crossSourceInsights) {
      console.log(`    [${insight.confidence}] ${insight.summary}`);
    }
  }

  // Build learning timeline
  const connectedSources: string[] = ['Apple Health'];
  if (calendarData) connectedSources.push('Google Calendar');
  if (taskMetrics) connectedSources.push('Google Tasks');
  if (emailIntelligence) connectedSources.push('Gmail');
  if (fitData) connectedSources.push('Google Fit');
  connectedSources.push('Open-Meteo Weather');

  // Generate Spots + day activity for EVERY day (rule-based, no Claude)
  allDayActivity = generateAllDayActivity(days, allCrs, allStress, allPatterns, {
    calendarData,
    emailMetrics: emailIntelligence?.dailyMetrics ?? null,
    taskMetrics,
  }, extracted.profile.age);
  const spotStats = countSpots(allDayActivity);
  console.log(`  ${spotStats.total} Spots generated across ${allDayActivity.size} days`);

  // Build cross-day user intelligence profile
  userIntelligence = buildUserIntelligence(days, allCrs);
  console.log(`  User intelligence profile built (${userIntelligence.summary.length} chars)`);

  // Build learning timeline
  learningTimeline = buildLearningTimeline(days, allCrs, allPatterns, crossSourceInsights, spotStats.total, connectedSources);
  console.log(`  Learning timeline: ${learningTimeline.milestones.length} milestones, intelligence score ${learningTimeline.intelligenceScore}/100`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Data quality summary
  const sortedDates = [...days.keys()].sort();
  const richDays = sortedDates.filter(d => {
    const day = days.get(d)!;
    return day.sleep !== null && day.hrvReadings.length > 0 && day.hrReadings.length > 0;
  });
  const validCrs = [...allCrs.values()].filter(c => c.score >= 0);
  const crsScores = validCrs.map(c => c.score);
  const avgCrs = crsScores.length > 0 ? Math.round(crsScores.reduce((a, b) => a + b, 0) / crsScores.length) : 0;

  console.log(`\n  Parsed in ${elapsed}s`);
  console.log(`  ┌─ DATA SUMMARY ${'─'.repeat(41)}┐`);
  console.log(`  │  Profile              ${extracted.profile.biologicalSex}, age ${extracted.profile.age}${' '.repeat(20)}│`);
  console.log(`  │  Total records         ${String(extracted.recordCount).padEnd(30)}│`);
  console.log(`  │  HR readings           ${String(extracted.heartRate.length).padEnd(30)}│`);
  console.log(`  │  HRV readings          ${String(extracted.hrv.length).padEnd(30)}│`);
  console.log(`  │  Sleep stage records   ${String(extracted.sleepStages.length).padEnd(30)}│`);
  console.log(`  │  Total days            ${String(days.size).padEnd(30)}│`);
  console.log(`  │  Rich days (sleep+HRV) ${String(richDays.length).padEnd(30)}│`);
  console.log(`  │  Date range            ${(richDays[0] ?? '?') + ' → ' + (richDays[richDays.length - 1] ?? '?')}${' '.repeat(Math.max(0, 14 - (richDays[0]?.length ?? 0)))}│`);
  console.log(`  │  CRS range             ${crsScores.length > 0 ? `${Math.min(...crsScores)}-${Math.max(...crsScores)} (avg ${avgCrs})` : 'n/a'}${' '.repeat(16)}│`);
  console.log(`  │  Stress analyses       ${String(allStress.size).padEnd(30)}│`);
  console.log(`  │  ANTHROPIC_API_KEY     ${process.env['ANTHROPIC_API_KEY'] ? 'set ✓' : 'NOT SET — Claude responses disabled'}${' '.repeat(process.env['ANTHROPIC_API_KEY'] ? 24 : 1)}│`);
  console.log(`  └${'─'.repeat(55)}┘`);
}

// ─── Route Helpers ────────────────────────────────────────────────────

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const MAX_BODY_SIZE = 10240; // 10KB

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Route Handlers ───────────────────────────────────────────────────

function handleSummary(res: http.ServerResponse): void {
  const dates = getSortedDates(days);
  const richDays = dates.filter(d => {
    const day = days.get(d)!;
    return day.sleep !== null && day.hrvReadings.length > 0;
  });

  json(res, {
    profile: extracted.profile,
    recordCounts: {
      hr: extracted.heartRate.length,
      hrv: extracted.hrv.length,
      sleep: extracted.sleepStages.length,
      spo2: extracted.spo2.length,
      steps: extracted.steps.length,
      workouts: extracted.workouts.length,
      activityDays: extracted.activitySummaries.length,
    },
    dateRange: { start: dates[0], end: dates[dates.length - 1] },
    richDayCount: richDays.length,
    totalDays: days.size,
    exportDate: extracted.exportDate,
  });
}

function handleDates(res: http.ServerResponse): void {
  const dates = getSortedDates(days);
  const result = dates.map(date => {
    const day = days.get(date)!;
    const crs = allCrs.get(date);
    const stress = allStress.get(date);

    // Data richness: what signals we have for this day
    const signals: string[] = [];
    if (day.sleep) signals.push('sleep');
    if (day.hrvReadings.length > 0) signals.push('hrv');
    if (day.hrReadings.length > 0) signals.push('hr');
    if (day.totalSteps > 0) signals.push('steps');
    if (day.spo2Readings.length > 0) signals.push('spo2');
    if (day.workouts.length > 0) signals.push('workout');
    if (day.activitySummary) signals.push('activity');

    // Tier: rich (3+ health signals), partial (1-2), sparse (steps/activity only)
    const healthSignals = ['sleep', 'hrv', 'hr'].filter(s => signals.includes(s)).length;
    const tier = healthSignals >= 2 ? 'rich' : healthSignals >= 1 ? 'partial' : signals.length > 0 ? 'sparse' : 'empty';

    return {
      date,
      crs: crs?.score ?? -1,
      zone: crs?.score !== undefined && crs.score >= 0 ? crs.zone : 'nodata',
      tier,
      signals,
      hasSleep: day.sleep !== null,
      hasHrv: day.hrvReadings.length > 0,
      hasSteps: day.totalSteps > 0,
      hasStress: (stress?.events.length ?? 0) > 0,
      fetchAlert: stress?.fetchAlertTriggered ?? false,
      spotCount: allDayActivity.get(date)?.spots.length ?? 0,
      headline: allDayActivity.get(date)?.headline ?? '',
      morningWag: allDayActivity.get(date)?.morningWag ?? null,
    };
  });

  json(res, result);
}

function handleDay(res: http.ServerResponse, date: string): void {
  const day = days.get(date);
  if (!day) { json(res, { error: `No data for ${date}` }, 404); return; }

  const crs = allCrs.get(date) ?? computeCrs(day, days);
  const stress = allStress.get(date) ?? { date, events: [], peakStress: null, totalStressMinutes: 0, fetchAlertTriggered: false, fetchAlertTime: null };

  // Build HRV summary
  let hrvSummary = null;
  if (day.hrvReadings.length > 0) {
    const vals = day.hrvReadings.map(r => r.rmssd ?? r.sdnn);
    hrvSummary = {
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    };
  }

  // Build sleep summary
  let sleepSummary = null;
  if (day.sleep) {
    const s = day.sleep;
    sleepSummary = {
      durationHours: +(s.totalDurationMinutes / 60).toFixed(1),
      efficiency: Math.round(s.efficiency * 100),
      deepPercent: Math.round(s.deepPercent * 100),
      remPercent: Math.round(s.remPercent * 100),
      stages: {
        core: Math.round(s.stages.core),
        deep: Math.round(s.stages.deep),
        rem: Math.round(s.stages.rem),
        awake: Math.round(s.stages.awake),
      },
      bedtime: s.bedtime.toISOString(),
      wakeTime: s.wakeTime.toISOString(),
    };
  }

  json(res, {
    date,
    crs: {
      score: crs.score,
      zone: crs.zone,
      confidence: crs.confidence,
      componentsWithData: crs.componentsWithData,
      sleep: crs.sleep,
      hrv: crs.hrv,
      circadian: crs.circadian,
      activity: crs.activity,
      summary: crs.summary,
    },
    stress: {
      events: stress.events.map(e => ({
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        durationMinutes: Math.round(e.durationMinutes),
        confidence: e.confidence,
        severity: e.severity,
        explanation: e.explanation,
        components: e.components,
      })),
      peakConfidence: stress.peakStress?.confidence ?? null,
      peakSeverity: stress.peakStress?.severity ?? null,
      totalStressMinutes: Math.round(stress.totalStressMinutes),
      fetchAlertTriggered: stress.fetchAlertTriggered,
    },
    sleep: sleepSummary,
    hrv: hrvSummary,
    activity: {
      steps: day.totalSteps,
      exerciseMinutes: Math.round(day.exerciseMinutes),
      workouts: day.workouts.map(w => w.activityType),
      standHours: day.activitySummary?.appleStandHours ?? 0,
      activeEnergy: Math.round(day.activitySummary?.activeEnergyBurned ?? 0),
    },
    restingHR: day.restingHR,
    // New environmental signals
    wristTemp: day.wristTemp,
    avgNoiseDb: day.avgNoiseDb ? Math.round(day.avgNoiseDb * 10) / 10 : null,
    daylightMinutes: day.daylightMinutes,
    weather: day.weather,
    aqi: day.aqi,
    aqiLabel: day.aqi !== null ? aqiToLabel(day.aqi) : null,
    pm25: day.pm25,
    // New metrics
    sleepDebt: computeSleepDebt(date, days),
    strain: computeDayStrain(day, extracted.profile.age),
    // Productivity data (from Takeout)
    calendar: calendarData?.get(date) ? {
      meetingLoadScore: calendarData.get(date)!.meetingLoadScore,
      totalMeetingMinutes: calendarData.get(date)!.totalMeetingMinutes,
      eventCount: calendarData.get(date)!.events.length,
      backToBackCount: calendarData.get(date)!.backToBackCount,
      focusGaps: calendarData.get(date)!.focusGaps,
      events: calendarData.get(date)!.events.map(e => ({
        summary: e.summary,
        startTime: e.startDate.toISOString(),
        endTime: e.endDate.toISOString(),
        durationMinutes: Math.round(e.durationMinutes),
        attendeeCount: e.attendeeCount,
      })),
    } : null,
    tasks: taskMetrics ? {
      summary: buildTasksSummary(taskMetrics),
      pendingCount: taskMetrics.pendingTasks,
      overdueCount: taskMetrics.overdueTasks,
      recentVelocity: taskMetrics.recentVelocity,
      completionRate: Math.round(taskMetrics.completionRate * 100),
    } : null,
    email: emailIntelligence?.dailyMetrics.get(date) ?? null,
    // Google Fit (pre-Apple Watch)
    fit: fitData?.dailyMetrics.get(date) ?? null,
    // Master metrics
    cognitiveLoad: computeDailyCognitiveLoad(
      calendarData?.get(date) ?? null,
      emailIntelligence?.dailyMetrics.get(date) ?? null,
      taskMetrics?.overdueTasks ?? 0,
      computeSleepDebt(date, days),
    ),
    burnoutTrajectory: computeBurnoutTrajectory(date, days, allCrs, calendarData, emailIntelligence?.dailyMetrics ?? null),
    resilience: computeResilience(date, allCrs, days),
    crossSourceInsights,
    // Waldo intelligence layer
    patterns: allPatterns,
    waldoActions: simulateWaldoActions(date, day, crs, stress, allPatterns),
    dayActivity: allDayActivity.get(date) ?? null,
  });
}

// ─── Logging ──────────────────────────────────────────────────────────

let requestCounter = 0;

function timestamp(): string {
  return new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function log(icon: string, message: string): void {
  console.log(`  ${icon}  ${timestamp()}  ${message}`);
}

function logSection(reqId: number, title: string): void {
  console.log(`\n  ┌─ #${reqId} ${title} ─${'─'.repeat(Math.max(0, 50 - title.length))}┐`);
}

function logDetail(label: string, value: string | number): void {
  console.log(`  │  ${label.padEnd(20)} ${value}`);
}

function logEnd(): void {
  console.log(`  └${'─'.repeat(55)}┘`);
}

function logRaw(reqId: number, label: string, content: string): void {
  const divider = '='.repeat(70);
  console.log(`\n  [RAW #${reqId}] ${label}`);
  console.log(`  ${divider}`);
  // Print with indentation, preserving newlines
  for (const line of content.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log(`  ${divider}`);
}

// ─── Server ───────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight — silent
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/health' && req.method === 'GET') {
      json(res, { status: 'ok', days: days.size, crsScores: allCrs.size, hasApiKey: !!process.env['ANTHROPIC_API_KEY'] });
    } else if (path === '/api/profile' && req.method === 'GET') {
      json(res, { profile: userProfile, onboardingComplete: userProfile?.completed ?? false });
    } else if (path === '/api/onboarding' && req.method === 'POST') {
      let body: { message?: string };
      try { body = JSON.parse(await readBody(req)); } catch { json(res, { error: 'Invalid JSON' }, 400); return; }

      const reqId = ++requestCounter;
      logSection(reqId, 'ONBOARDING');

      try {
        const result = await continueOnboarding(onboardingHistory, body.message);
        // Update history (capped at 20 messages)
        if (body.message) {
          onboardingHistory.push({ role: 'user', content: body.message });
        }
        onboardingHistory.push({ role: 'assistant', content: result.reply });
        if (onboardingHistory.length > 20) {
          onboardingHistory = onboardingHistory.slice(-20);
        }

        if (result.profile) {
          result.profile.age = extracted.profile.age;
          userProfile = result.profile;
          onboardingHistory = []; // Clear after profile built
          logDetail('Profile built', userProfile.name + ' / ' + userProfile.role);
        }

        logDetail('Tokens', `${result.tokensIn}→${result.tokensOut}`);
        logDetail('Waldo', `"${result.reply.substring(0, 80)}${result.reply.length > 80 ? '...' : ''}"`);
        logEnd();

        json(res, {
          reply: result.reply,
          profile: result.profile,
          onboardingComplete: result.profile?.completed ?? false,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDetail('ERROR', msg.substring(0, 80));
        logEnd();
        json(res, { error: msg }, 500);
      }
      return;
    } else if (path === '/api/intelligence' && req.method === 'GET') {
      json(res, userIntelligence);
    } else if (path === '/api/spots' && req.method === 'GET') {
      // All spots across all days — for visualization
      const allSpots: Array<{ date: string; spots: unknown[] }> = [];
      for (const [date, activity] of allDayActivity) {
        if (activity.spots.length > 0) {
          allSpots.push({ date, spots: activity.spots });
        }
      }
      const stats = countSpots(allDayActivity);
      json(res, { spots: allSpots, stats, patterns: allPatterns, learning: learningTimeline });
    } else if (path === '/api/summary' && req.method === 'GET') {
      handleSummary(res);
      log('📋', `summary — ${days.size} days, ${extracted.heartRate.length} HR records`);
    } else if (path === '/api/dates' && req.method === 'GET') {
      handleDates(res);
    } else if (path.startsWith('/api/day/') && req.method === 'GET') {
      const date = path.replace('/api/day/', '');
      if (!DATE_REGEX.test(date)) { json(res, { error: 'Invalid date format. Use YYYY-MM-DD.' }, 400); return; }
      handleDay(res, date);
      const day = days.get(date);
      const crs = allCrs.get(date);
      if (day && crs) {
        const reqId = ++requestCounter;
        const stress = allStress.get(date);
        logSection(reqId, `DAY ${date}`);
        logDetail('CRS score', `${crs.score} (${crs.zone}) ±${crs.confidence}`);
        logDetail('Components', `sleep ${Math.round(crs.sleep.score)}${crs.sleep.dataAvailable ? '' : '*'} | hrv ${Math.round(crs.hrv.score)}${crs.hrv.dataAvailable ? '' : '*'} | circadian ${Math.round(crs.circadian.score)}${crs.circadian.dataAvailable ? '' : '*'} | activity ${Math.round(crs.activity.score)}${crs.activity.dataAvailable ? '' : '*'}`);
        logDetail('Data available', `${crs.componentsWithData}/4 components (* = no real data, using neutral)`);
        console.log('  │');
        if (day.sleep) {
          logDetail('Sleep', `${(day.sleep.totalDurationMinutes / 60).toFixed(1)}h | eff: ${Math.round(day.sleep.efficiency * 100)}% | deep: ${Math.round(day.sleep.deepPercent * 100)}% | rem: ${Math.round(day.sleep.remPercent * 100)}%`);
        } else {
          logDetail('Sleep', 'no data');
        }
        logDetail('HRV', day.hrvReadings.length > 0 ? `${day.hrvReadings.length} readings | avg RMSSD: ${(day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length).toFixed(1)}ms` : 'no data');
        logDetail('HR', `${day.hrReadings.length} readings | resting: ${day.restingHR ?? 'n/a'} bpm`);
        logDetail('Activity', `${day.totalSteps.toLocaleString()} steps | ${Math.round(day.exerciseMinutes)}min exercise | ${day.workouts.length} workouts`);
        if (day.distanceKm > 0) logDetail('', `  distance: ${day.distanceKm.toFixed(1)}km | speed: ${day.avgWalkingSpeed?.toFixed(1) ?? 'n/a'}km/h | flights: ${day.flightsClimbed}`);
        console.log('  │');

        // Derived metrics
        const daySleepDebt = computeSleepDebt(date, days);
        const dayStrain = computeDayStrain(day, extracted.profile.age);
        const dayCogLoad = computeDailyCognitiveLoad(
          calendarData?.get(date) ?? null,
          emailIntelligence?.dailyMetrics.get(date) ?? null,
          taskMetrics?.overdueTasks ?? 0, daySleepDebt,
        );
        const dayResilience = computeResilience(date, allCrs, days);
        const dayBurnout = computeBurnoutTrajectory(date, days, allCrs, calendarData, emailIntelligence?.dailyMetrics ?? null);

        logDetail('DERIVED METRICS', '');
        logDetail('  Strain', `${dayStrain.score}/21 (${dayStrain.level}) | peak HR ${dayStrain.peakHR} | ${dayStrain.totalActiveMinutes}min active`);
        logDetail('  Sleep debt', `${daySleepDebt.debtHours}h (${daySleepDebt.direction}) | ${daySleepDebt.shortNights} short nights`);
        logDetail('  Cognitive load', `${dayCogLoad.score}/100 (${dayCogLoad.level}) | mtg:${dayCogLoad.components.meetingLoad} email:${dayCogLoad.components.communicationLoad} task:${dayCogLoad.components.taskLoad} debt:${dayCogLoad.components.sleepDebtImpact}`);
        logDetail('  Resilience', `${dayResilience.score}/100 (${dayResilience.level}) | stability:${dayResilience.components.crsStability} hrv:${dayResilience.components.hrvTrend} recovery:${dayResilience.components.stressRecovery}`);
        logDetail('  Burnout', `${dayBurnout.score.toFixed(2)} (${dayBurnout.status}) | hrv:${dayBurnout.components.hrvSlope > 0 ? '↓' : '↑'} sleep:${dayBurnout.components.sleepDebtTrend > 0 ? '↓' : '↑'} email:${dayBurnout.components.afterHoursTrend > 0 ? '↑' : '↓'}`);
        console.log('  │');

        // Environment
        const envParts: string[] = [];
        if (day.weather) envParts.push(`${Math.round((day.weather.temperatureF - 32) * 5 / 9)}°C (${day.weather.source})`);
        if (day.avgNoiseDb !== null) envParts.push(`${day.avgNoiseDb.toFixed(0)}dB`);
        if (day.daylightMinutes > 0) envParts.push(`${day.daylightMinutes}min daylight`);
        if (day.wristTemp !== null) envParts.push(`wrist ${day.wristTemp.toFixed(1)}°C`);
        if (day.aqi !== null) envParts.push(`AQI ${day.aqi}`);
        if (envParts.length > 0) logDetail('Environment', envParts.join(' | '));

        // Schedule
        const dayCal = calendarData?.get(date);
        if (dayCal) {
          logDetail('Schedule', `MLS ${dayCal.meetingLoadScore}/15 | ${dayCal.events.length} events | ${dayCal.totalMeetingMinutes}min | b2b:${dayCal.backToBackCount} | focus gaps:${dayCal.focusGaps.length}`);
          for (const ev of dayCal.events.slice(0, 3)) {
            const time = new Date(ev.startDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16);
            logDetail('', `  ${time} ${ev.summary.substring(0, 40)} (${Math.round(ev.durationMinutes)}min${ev.attendeeCount > 1 ? ', ' + ev.attendeeCount + 'p' : ''})`);
          }
        }

        // Email
        const dayEmail = emailIntelligence?.dailyMetrics.get(date);
        if (dayEmail) {
          logDetail('Email', `${dayEmail.totalEmails} emails | sent:${dayEmail.sentCount} recv:${dayEmail.receivedCount} | after-hrs:${Math.round(dayEmail.afterHoursRatio * 100)}% | threads:${dayEmail.uniqueThreads} | vol:${dayEmail.volumeSpike.toFixed(1)}x`);
        }

        // Tasks
        if (taskMetrics) {
          logDetail('Tasks', `${taskMetrics.pendingTasks} pending | ${taskMetrics.overdueTasks} overdue | velocity:${taskMetrics.recentVelocity.toFixed(1)}/day | done:${Math.round(taskMetrics.completionRate * 100)}%`);
        }
        console.log('  │');

        // Stress
        logDetail('Stress events', `${stress?.events.length ?? 0} detected`);
        if (stress && stress.events.length > 0) {
          for (const ev of stress.events) {
            const evTime = ev.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            logDetail(`  ${evTime} (${ev.severity})`, `${(ev.confidence * 100).toFixed(0)}% | ${Math.round(ev.durationMinutes)}min | hrv:${ev.components.hrvDropScore.toFixed(2)} hr:${ev.components.hrElevationScore.toFixed(2)} dur:${ev.components.durationScore.toFixed(2)} sed:${ev.components.activityInvertedScore.toFixed(2)}`);
          }
          logDetail('Fetch alert?', stress.fetchAlertTriggered ? 'YES' : 'no');
        }
        console.log('  │');

        // Spots summary
        const dayActivity = allDayActivity.get(date);
        if (dayActivity) {
          logDetail('Spots', `${dayActivity.spots.length} observations`);
          const bySeverity: Record<string, number> = {};
          for (const s of dayActivity.spots) { bySeverity[s.severity] = (bySeverity[s.severity] ?? 0) + 1; }
          logDetail('', `  ${Object.entries(bySeverity).map(([k, v]) => `${k}:${v}`).join(' | ')}`);
          if (dayActivity.morningWag) logDetail('Morning Wag', `"${dayActivity.morningWag.substring(0, 80)}..."`);
        }
        console.log('  │');

        // Agent reasoning trace
        const zone = getPersonalityZone(crs.score);
        logDetail('AGENT REASONING', '');
        logDetail('  1. Zone select', `CRS ${crs.score} → ${zone} voice`);
        logDetail('  2. Pre-filter', crs.score > 60 && (stress?.peakStress?.confidence ?? 0) < 0.3
          ? 'SKIP Claude (CRS > 60, stress < 30%) → template'
          : 'CALL Claude');
        logDetail('  3. Morning Wag', day.sleep ? `fire at ${day.sleep.wakeTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'skip (no sleep)');
        logDetail('  4. Fetch Alert', stress?.fetchAlertTriggered
          ? `fire at ${stress.fetchAlertTime?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '?'}`
          : 'no (below threshold)');
        logDetail('  5. Cog Load', `${dayCogLoad.level} → ${dayCogLoad.score >= 60 ? 'suggest protecting focus' : 'normal load'}`);
        logDetail('  6. Burnout', `${dayBurnout.status}${dayBurnout.status === 'warning' || dayBurnout.status === 'burnout_trajectory' ? ' → ALERT' : ''}`);
        logDetail('  7. Patterns', `${allPatterns.length} health + ${crossSourceInsights.length} cross-source`);
        logEnd();
      }
    } else if (path === '/api/waldo' && req.method === 'POST') {
      // Log before the call (which can take seconds)
      const bodyStr = await readBody(req);
      let body: { date: string; mode: MessageMode; question?: string };
      try {
        body = JSON.parse(bodyStr);
      } catch {
        json(res, { error: 'Invalid JSON body' }, 400);
        log('❌', `waldo — invalid JSON`);
        return;
      }

      if (!body.date || !body.mode) {
        json(res, { error: 'Missing required fields: date, mode' }, 400);
        log('❌', `waldo — missing fields`);
        return;
      }

      const day = days.get(body.date);
      if (!day) { json(res, { error: `No data for ${body.date}` }, 404); return; }

      const crs = allCrs.get(body.date) ?? computeCrs(day, days);
      const stress = allStress.get(body.date) ?? { date: body.date, events: [], peakStress: null, totalStressMinutes: 0, fetchAlertTriggered: false, fetchAlertTime: null };

      const userName = extracted.profile.biologicalSex === 'Male' ? 'Ark' : 'User';
      const dayActivity = allDayActivity.get(body.date);
      const sleepDebt = computeSleepDebt(body.date, days);
      const strain = computeDayStrain(day, extracted.profile.age);
      const aqi = day.aqi;

      // Enrich the intelligence summary with today's derived metrics + productivity
      let enrichedIntelligence = userIntelligence.summary;
      enrichedIntelligence += `\n\nToday's derived metrics:`;
      enrichedIntelligence += `\n- Sleep debt: ${sleepDebt.summary}`;
      enrichedIntelligence += `\n- Day strain: ${strain.summary}`;
      if (aqi) enrichedIntelligence += `\n- Air quality: AQI ${aqi} (${aqiToLabel(aqi)})${aqi > 150 ? ' — impacts HRV and recovery' : ''}`;

      // Master metrics
      const cogLoad = computeDailyCognitiveLoad(
        calendarData?.get(body.date) ?? null,
        emailIntelligence?.dailyMetrics.get(body.date) ?? null,
        taskMetrics?.overdueTasks ?? 0,
        sleepDebt,
      );
      enrichedIntelligence += `\n- Cognitive Load: ${cogLoad.summary}`;

      const burnout = computeBurnoutTrajectory(body.date, days, allCrs, calendarData, emailIntelligence?.dailyMetrics ?? null);
      enrichedIntelligence += `\n- ${burnout.summary}`;

      const resilience = computeResilience(body.date, allCrs, days);
      enrichedIntelligence += `\n- ${resilience.summary}`;

      // Cross-source insights
      if (crossSourceInsights.length > 0) {
        enrichedIntelligence += '\n\nCross-source patterns Waldo discovered:';
        for (const insight of crossSourceInsights) {
          enrichedIntelligence += `\n- ${insight.summary}`;
        }
      }

      // Google Fit history (if available)
      if (fitData) {
        enrichedIntelligence += `\n\nPre-Apple Watch history: ${buildFitSummary(fitData)}`;
      }

      // Calendar context
      const dayCalendar = calendarData?.get(body.date);
      if (dayCalendar) {
        enrichedIntelligence += `\n\nSchedule today: ${dayCalendar.events.length} events, Meeting Load ${dayCalendar.meetingLoadScore}/15, ${dayCalendar.totalMeetingMinutes}min in meetings.`;
        if (dayCalendar.backToBackCount > 0) enrichedIntelligence += ` ${dayCalendar.backToBackCount} back-to-back.`;
        if (dayCalendar.focusGaps.length > 0) {
          const bestGap = dayCalendar.focusGaps.sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
          if (bestGap) enrichedIntelligence += ` Best focus window: ${bestGap.durationMinutes}min.`;
        }
        // List events
        const eventList = dayCalendar.events.slice(0, 5).map(e => {
          const time = new Date(e.startDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16);
          return `${time} ${e.summary} (${Math.round(e.durationMinutes)}min${e.attendeeCount > 1 ? ', ' + e.attendeeCount + ' people' : ''})`;
        });
        enrichedIntelligence += `\nEvents: ${eventList.join('; ')}`;
      }

      // Tasks context
      if (taskMetrics) {
        enrichedIntelligence += `\n\nTasks: ${buildTasksSummary(taskMetrics)}`;
      }

      // Email context for this day
      const dayEmail = emailIntelligence?.dailyMetrics.get(body.date);
      if (dayEmail) {
        enrichedIntelligence += `\n\nEmail today: ${dayEmail.totalEmails} emails (${dayEmail.sentCount} sent, ${dayEmail.receivedCount} received). ${dayEmail.uniqueThreads} threads.`;
        if (dayEmail.afterHoursRatio > 0.2) enrichedIntelligence += ` After-hours: ${Math.round(dayEmail.afterHoursRatio * 100)}%.`;
        if (dayEmail.volumeSpike > 1.5) enrichedIntelligence += ` Volume ${dayEmail.volumeSpike.toFixed(1)}x above normal.`;
      }

      const ctx = buildAgentContext({
        day, crs, stress,
        mode: body.mode,
        userName,
        age: extracted.profile.age,
        userQuestion: body.question,
        patterns: allPatterns,
        userIntelligenceSummary: enrichedIntelligence,
        onboardingProfile: userProfile,
        allDays: days,
        allCrs,
        spots: dayActivity?.spots,
      });
      const zone = getPersonalityZone(crs.score);
      const systemPrompt = assembleSoulPrompt(zone, body.mode);
      const userMessage = buildUserMessage(ctx);

      const reqId = ++requestCounter;
      logSection(reqId, `WALDO ${body.mode.toUpperCase()} — ${body.date}`);
      logDetail('CRS / Zone', `${crs.score} → ${zone}`);
      logDetail('Mode', body.mode);
      if (body.question) logDetail('Question', `"${body.question}"`);
      console.log('  │');
      logDetail('System prompt', `${systemPrompt.length} chars`);
      logDetail('User message', `${userMessage.length} chars`);
      logDetail('Model', 'claude-haiku-4-5-20251001');
      logDetail('Status', 'calling Claude...');

      // Raw dump: full system prompt
      logRaw(reqId, 'SYSTEM PROMPT (sent as system message to Claude)', systemPrompt);

      // Raw dump: full user message
      logRaw(reqId, 'USER MESSAGE (sent as user message to Claude)', userMessage);

      try {
        const resp = await generateWaldoResponse(ctx);
        console.log('');
        logSection(reqId, `RESPONSE — ${body.mode.toUpperCase()}`);
        logDetail('Tokens in', resp.tokensIn);
        logDetail('Tokens out', resp.tokensOut);
        logDetail('Latency', `${resp.responseTimeMs}ms`);
        logDetail('Est. cost', `$${((resp.tokensIn * 0.8 + resp.tokensOut * 4) / 1_000_000).toFixed(5)}`);
        logEnd();

        // Raw dump: full Claude response
        logRaw(reqId, 'WALDO FULL RESPONSE', resp.message);
        json(res, {
          message: resp.message,
          zone: resp.zone,
          mode: resp.mode,
          tokensIn: resp.tokensIn,
          tokensOut: resp.tokensOut,
          responseTimeMs: resp.responseTimeMs,
          debug: { systemPrompt, userMessage, model: 'claude-haiku-4-5-20251001' },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isAuthError = msg.includes('authentication') || msg.includes('apiKey') || msg.includes('api_key');
        console.log('  │');
        if (isAuthError) {
          logDetail('ERROR', 'No ANTHROPIC_API_KEY set');
          logDetail('', 'Set it to enable Claude responses:');
          logDetail('', 'export ANTHROPIC_API_KEY=sk-ant-...');
        } else {
          logDetail('ERROR', msg.substring(0, 100));
        }
        logEnd();
        json(res, { error: msg, debug: { systemPrompt, userMessage } }, 500);
      }
      return; // Already handled
    } else {
      json(res, { error: 'Not found' }, 404);
    }
  } catch (err) {
    console.error('Request error:', err);
    json(res, { error: 'Internal server error' }, 500);
  }
});

init().then(() => {
  server.listen(PORT, () => {
    console.log(`\nWaldo API running at http://localhost:${PORT}`);
    console.log(`  GET  /api/summary     — Data overview`);
    console.log(`  GET  /api/dates       — All dates with CRS scores`);
    console.log(`  GET  /api/day/:date   — Full day detail`);
    console.log(`  POST /api/waldo       — Generate Waldo response\n`);
  });
}).catch(console.error);

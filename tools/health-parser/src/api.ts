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

  // Detect patterns across the full timeline
  allPatterns = detectPatterns(days, allCrs, allStress);

  // Generate Spots + day activity for EVERY day (rule-based, no Claude)
  allDayActivity = generateAllDayActivity(days, allCrs, allStress, allPatterns);
  const spotStats = countSpots(allDayActivity);
  console.log(`  ${spotStats.total} Spots generated across ${allDayActivity.size} days`);

  // Build cross-day user intelligence profile
  userIntelligence = buildUserIntelligence(days, allCrs);
  console.log(`  User intelligence profile built (${userIntelligence.summary.length} chars)`);

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
      json(res, { spots: allSpots, stats, patterns: allPatterns });
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
        console.log('  │');
        // Environment
        if (day.weather || day.avgNoiseDb !== null || day.daylightMinutes > 0) {
          const envParts: string[] = [];
          if (day.weather) envParts.push(`${Math.round((day.weather.temperatureF - 32) * 5 / 9)}°C (${day.weather.source})`);
          if (day.avgNoiseDb !== null) envParts.push(`${day.avgNoiseDb.toFixed(0)}dB noise`);
          if (day.daylightMinutes > 0) envParts.push(`${day.daylightMinutes}min daylight`);
          if (day.wristTemp !== null) envParts.push(`wrist ${day.wristTemp.toFixed(1)}°C`);
          logDetail('Environment', envParts.join(' | '));
        }
        console.log('  │');

        // Stress
        logDetail('Stress events', `${stress?.events.length ?? 0} detected`);
        if (stress && stress.events.length > 0) {
          for (const ev of stress.events) {
            const evTime = ev.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            logDetail(`  ${evTime} (${ev.severity})`, `${(ev.confidence * 100).toFixed(0)}% confidence | ${Math.round(ev.durationMinutes)}min`);
            logDetail('', `  hrv_drop=${ev.components.hrvDropScore.toFixed(2)} hr_elev=${ev.components.hrElevationScore.toFixed(2)} duration=${ev.components.durationScore.toFixed(2)} sedentary=${ev.components.activityInvertedScore.toFixed(2)}`);
          }
          logDetail('Fetch alert?', stress.fetchAlertTriggered ? 'YES (confidence >= 60%)' : 'no (all below 60% threshold)');
        }
        console.log('  │');

        // Agent reasoning trace
        const zone = getPersonalityZone(crs.score);
        logDetail('AGENT REASONING', '');
        logDetail('  1. Zone select', `CRS ${crs.score} → ${zone} voice`);
        logDetail('  2. Pre-filter', crs.score > 60 && (stress?.peakStress?.confidence ?? 0) < 0.3
          ? 'SKIP Claude (CRS > 60, stress < 30%) → use template'
          : 'CALL Claude (needs reasoning)');
        logDetail('  3. Morning Wag', day.sleep ? `Would fire at ${day.sleep.wakeTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Would skip (no sleep data)');
        logDetail('  4. Fetch Alert', stress?.fetchAlertTriggered
          ? `Would fire at ${stress.fetchAlertTime?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '?'}`
          : 'Would not fire (no event >= 60%)');
        logDetail('  5. Patterns', `${allPatterns.length} known patterns`);
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

      // Enrich the intelligence summary with today's derived metrics
      let enrichedIntelligence = userIntelligence.summary;
      enrichedIntelligence += `\n\nToday's derived metrics:`;
      enrichedIntelligence += `\n- Sleep debt: ${sleepDebt.summary}`;
      enrichedIntelligence += `\n- Day strain: ${strain.summary}`;
      if (aqi) enrichedIntelligence += `\n- Air quality: AQI ${aqi} (${aqiToLabel(aqi)})${aqi > 150 ? ' — impacts HRV and recovery' : ''}`;

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

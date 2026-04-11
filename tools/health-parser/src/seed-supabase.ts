/**
 * Waldo — Seed Supabase with precomputed health + productivity data.
 *
 * Runs the full health-parser pipeline, then inserts everything into Supabase.
 * Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx src/seed-supabase.ts [path-to-export.xml]
 */
import { createClient } from '@supabase/supabase-js';
import { parseAppleHealthExport } from './xml-stream-parser.js';
import { organizeDailyData, getSortedDates } from './extractors/daily-organizer.js';
import { computeAllCrs } from './computed/crs-engine.js';
import { detectDailyStress } from './computed/stress-detector.js';
import { detectPatterns, simulateWaldoActions } from './computed/pattern-detector.js';
import { generateAllDayActivity, countSpots } from './computed/spots-engine.js';
import { buildUserIntelligence } from './computed/user-intelligence.js';
import { enrichWeather } from './enrichment/weather.js';
import { enrichAirQuality, aqiToLabel } from './enrichment/air-quality.js';
import { computeSleepDebt } from './computed/sleep-debt.js';
import { computeDayStrain } from './computed/strain-engine.js';
import { parseICS, organizeCalendarByDay } from './extractors/calendar-parser.js';
import { parseGoogleTasks, buildTasksSummary } from './extractors/tasks-parser.js';
import { parseGmailMbox } from './extractors/gmail-parser.js';
import { parseFitData } from './extractors/fit-parser.js';
import { computeDailyCognitiveLoad, computeBurnoutTrajectory, computeResilience, detectCrossSourcePatterns } from './computed/master-metrics.js';
import { buildLearningTimeline } from './computed/learning-timeline.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from 'dotenv';

// Load .env from project root (Waldo/.env)
config({ path: path.resolve(import.meta.dirname, '../../../.env') });
// Also check local .env
config();

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SECRET_KEY'];

console.log(`  ENV check: SUPABASE_URL=${SUPABASE_URL ? 'set' : 'MISSING'}, KEY=${SUPABASE_KEY ? 'set' : 'MISSING'}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXPORT_PATH = process.argv[2] ?? '../../AppleHealthExport/apple_health_export_ark/export.xml';
const TAKEOUT_BASE = '../../takeoutexport_ark';
const BATCH_SIZE = 500;

async function upsertBatch(table: string, rows: Record<string, unknown>[], onConflict?: string): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const query = onConflict
      ? supabase.from(table).upsert(batch, { onConflict })
      : supabase.from(table).insert(batch);
    const { error } = await query;
    if (error) {
      console.error(`  Error inserting into ${table} (batch ${i}):`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

async function main() {
  console.log('\n  ╔═══════════════════════════════════════════════╗');
  console.log('  ║  Waldo — Seeding Supabase with full context   ║');
  console.log('  ╚═══════════════════════════════════════════════╝\n');

  // ─── Step 1: Parse Apple Health ────────────────────────────
  console.log('  [1/8] Parsing Apple Health export...');
  const extracted = await parseAppleHealthExport(EXPORT_PATH);
  const days = organizeDailyData(extracted);
  console.log(`    ${extracted.recordCount} records → ${days.size} days`);

  // ─── Step 2: Compute CRS + Stress ──────────────────────────
  console.log('  [2/8] Computing CRS + stress for all days...');
  const allCrs = computeAllCrs(days);
  const allStress = new Map<string, ReturnType<typeof detectDailyStress>>();
  for (const [date, day] of days) {
    if (day.hrReadings.length >= 5) {
      allStress.set(date, detectDailyStress(day, days));
    }
  }
  const validCrs = [...allCrs.values()].filter(c => c.score >= 0);
  console.log(`    ${validCrs.length} CRS scores, ${allStress.size} stress analyses`);

  // ─── Step 3: Enrich + Parse Takeout ────────────────────────
  console.log('  [3/8] Enriching weather + parsing Takeout...');
  await enrichWeather(days);
  await enrichAirQuality(days);

  let calendarData = null;
  let taskMetrics = null;
  let emailIntelligence = null;
  let fitData = null;

  const calPath = `${TAKEOUT_BASE}/Takeout 5/Calendar/arkpatil2717@gmail.com.ics`;
  const taskPath = `${TAKEOUT_BASE}/Takeout 5/Tasks/Tasks.json`;
  const gmailPath = `${TAKEOUT_BASE}/Takeout 4/Mail/All mail Including Spam and Trash.mbox`;
  const fitPath = `${TAKEOUT_BASE}/Takeout 5/Fit`;

  if (fs.existsSync(calPath)) {
    const events = parseICS(calPath);
    calendarData = organizeCalendarByDay(events);
    console.log(`    Calendar: ${events.length} events → ${calendarData.size} days`);
  }
  if (fs.existsSync(taskPath)) {
    taskMetrics = parseGoogleTasks(taskPath);
    console.log(`    Tasks: ${taskMetrics.totalTasks} total (${taskMetrics.completedTasks} done)`);
  }
  if (fs.existsSync(gmailPath)) {
    console.log('    Gmail: parsing headers (this takes ~30s for 1.3GB)...');
    emailIntelligence = await parseGmailMbox(gmailPath, (c) => {
      if (c % 10000 === 0) process.stdout.write(`\r    Gmail: ${c.toLocaleString()} emails...`);
    });
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    console.log(`    Gmail: ${emailIntelligence.totalEmails} emails → ${emailIntelligence.dailyMetrics.size} days`);
  }
  if (fs.existsSync(fitPath)) {
    fitData = parseFitData(fitPath);
    console.log(`    Google Fit: ${fitData.dailyMetrics.size} days`);
  }

  // ─── Step 4: Patterns + Spots + Intelligence ───────────────
  console.log('  [4/8] Detecting patterns, spots, intelligence...');
  const allPatterns = detectPatterns(days, allCrs, allStress);
  const crossSourceInsights = detectCrossSourcePatterns(days, allCrs, calendarData, emailIntelligence?.dailyMetrics ?? null);
  const allDayActivity = generateAllDayActivity(days, allCrs, allStress, allPatterns, {
    calendarData,
    emailMetrics: emailIntelligence?.dailyMetrics ?? null,
    taskMetrics,
  }, extracted.profile.age);
  const userIntel = buildUserIntelligence(days, allCrs);
  const spotStats = countSpots(allDayActivity);
  const connectedSources = ['Apple Health'];
  if (calendarData) connectedSources.push('Google Calendar');
  if (taskMetrics) connectedSources.push('Google Tasks');
  if (emailIntelligence) connectedSources.push('Gmail');
  if (fitData) connectedSources.push('Google Fit');
  connectedSources.push('Open-Meteo Weather');
  const timeline = buildLearningTimeline(days, allCrs, allPatterns, crossSourceInsights, spotStats.total, connectedSources);
  console.log(`    ${spotStats.total} spots, ${allPatterns.length} patterns, ${crossSourceInsights.length} cross-source insights`);

  // ─── Step 5: Create user ───────────────────────────────────
  console.log('  [5/8] Creating user in Supabase...');
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001', // fixed ID for demo
      name: extracted.profile.name || 'Ark',
      age: extracted.profile.age,
      timezone: 'Asia/Kolkata',
      chronotype: userIntel.sleepPatterns?.chronotype ?? 'normal',
      wake_time_estimate: '07:00',
      onboarding_profile: {},
    }, { onConflict: 'id' })
    .select()
    .single();

  if (userErr) {
    console.error('  Failed to create user:', userErr.message);
    process.exit(1);
  }
  const userId = user.id;
  console.log(`    User: ${user.name} (${userId})`);

  // ─── Step 6: Seed all tables ───────────────────────────────
  console.log('  [6/8] Seeding health snapshots...');
  const sortedDates = getSortedDates(days);
  const healthRows = sortedDates.map(date => {
    const day = days.get(date)!;
    const hrvVals = day.hrvReadings.map(r => r.rmssd ?? r.sdnn);
    const hrVals = day.hrReadings.map(r => r.bpm);
    const healthSignals = [day.sleep ? 1 : 0, day.hrvReadings.length > 0 ? 1 : 0, day.hrReadings.length > 0 ? 1 : 0].reduce((a, b) => a + b, 0);
    return {
      user_id: userId,
      date,
      hr_avg: hrVals.length > 0 ? hrVals.reduce((a, b) => a + b, 0) / hrVals.length : null,
      hr_min: hrVals.length > 0 ? Math.min(...hrVals) : null,
      hr_max: hrVals.length > 0 ? Math.max(...hrVals) : null,
      hr_count: hrVals.length,
      hrv_rmssd: hrvVals.length > 0 ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length : null,
      hrv_count: hrvVals.length,
      resting_hr: day.restingHR,
      sleep_duration_hours: day.sleep ? +(day.sleep.totalDurationMinutes / 60).toFixed(1) : null,
      sleep_efficiency: day.sleep ? Math.round(day.sleep.efficiency * 100) : null,
      sleep_deep_pct: day.sleep ? Math.round(day.sleep.deepPercent * 100) : null,
      sleep_rem_pct: day.sleep ? Math.round(day.sleep.remPercent * 100) : null,
      sleep_bedtime: day.sleep?.bedtime.toISOString() ?? null,
      sleep_wake_time: day.sleep?.wakeTime.toISOString() ?? null,
      sleep_stages: day.sleep ? { core: day.sleep.stages.core, deep: day.sleep.stages.deep, rem: day.sleep.stages.rem, awake: day.sleep.stages.awake } : null,
      steps: day.totalSteps,
      exercise_minutes: Math.round(day.exerciseMinutes),
      stand_hours: day.activitySummary?.appleStandHours ?? null,
      active_energy: day.activitySummary?.activeEnergyBurned ? Math.round(day.activitySummary.activeEnergyBurned) : null,
      distance_km: day.distanceKm ? +day.distanceKm.toFixed(1) : null,
      spo2: day.spo2Readings.length > 0 ? day.spo2Readings.reduce((a, b) => a + b.percentage, 0) / day.spo2Readings.length : null,
      wrist_temp: day.wristTemp,
      vo2max: day.vo2Max,
      weather: day.weather,
      aqi: day.aqi,
      aqi_label: day.aqi !== null ? aqiToLabel(day.aqi) : null,
      pm25: day.pm25,
      avg_noise_db: day.avgNoiseDb ? Math.round(day.avgNoiseDb * 10) / 10 : null,
      daylight_minutes: day.daylightMinutes,
      walking_heart_rate: day.walkingHR ? Math.round(day.walkingHR) : null,
      physical_effort: day.physicalEffortAvg ? Math.round(day.physicalEffortAvg * 100) / 100 : null,
      sleep_timezone_offset: day.sleepTimezoneOffsetHours,
      data_tier: healthSignals >= 2 ? 'rich' : healthSignals >= 1 ? 'partial' : day.totalSteps > 0 ? 'sparse' : 'empty',
    };
  });
  let n = await upsertBatch('health_snapshots', healthRows, 'user_id,date');
  console.log(`    ${n} health snapshots`);

  console.log('  [6/8] Seeding CRS scores...');
  const crsRows = sortedDates.filter(d => allCrs.has(d)).map(date => {
    const c = allCrs.get(date)!;
    return {
      user_id: userId, date, score: c.score, zone: c.zone, confidence: c.confidence,
      components_with_data: c.componentsWithData,
      sleep_json: c.sleep, hrv_json: c.hrv, circadian_json: c.circadian, activity_json: c.activity,
      pillars_json: c.pillars,
      pillar_drag_json: c.pillarDrag,
      summary: c.summary,
    };
  });
  n = await upsertBatch('crs_scores', crsRows, 'user_id,date');
  console.log(`    ${n} CRS scores`);

  console.log('  [6/8] Seeding stress events...');
  const stressRows: Record<string, unknown>[] = [];
  for (const [date, stress] of allStress) {
    for (const ev of stress.events) {
      stressRows.push({
        user_id: userId, date,
        start_time: ev.startTime.toISOString(), end_time: ev.endTime.toISOString(),
        duration_minutes: Math.round(ev.durationMinutes), confidence: ev.confidence,
        severity: ev.severity, components: ev.components, explanation: ev.explanation,
        during_workout: ev.duringWorkout,
      });
    }
  }
  n = await upsertBatch('stress_events', stressRows);
  console.log(`    ${n} stress events`);

  console.log('  [6/8] Seeding spots...');
  const spotRows: Record<string, unknown>[] = [];
  for (const [date, activity] of allDayActivity) {
    for (const spot of activity.spots) {
      spotRows.push({
        user_id: userId, date, time: spot.time, type: spot.type,
        severity: spot.severity, title: spot.title, detail: spot.detail,
        signals: spot.signals ?? [],
      });
    }
  }
  n = await upsertBatch('spots', spotRows);
  console.log(`    ${n} spots`);

  console.log('  [6/8] Seeding day activity...');
  const activityRows = sortedDates.filter(d => allDayActivity.has(d)).map(date => {
    const a = allDayActivity.get(date)!;
    return {
      user_id: userId, date, morning_wag: a.morningWag, evening_review: a.eveningReview,
      spots_json: a.spots, actions_json: a.actions ?? [],
    };
  });
  n = await upsertBatch('day_activity', activityRows, 'user_id,date');
  console.log(`    ${n} day activities`);

  console.log('  [6/8] Seeding patterns...');
  const patternRows = allPatterns.map(p => ({
    user_id: userId, type: p.type, confidence: p.confidence,
    summary: p.summary, evidence_count: p.evidenceCount,
  }));
  n = await upsertBatch('patterns', patternRows);
  console.log(`    ${n} patterns`);

  // Calendar events + metrics
  if (calendarData) {
    console.log('  [6/8] Seeding calendar...');
    const calEventRows: Record<string, unknown>[] = [];
    const calMetricRows: Record<string, unknown>[] = [];
    for (const [date, dayMeeting] of calendarData) {
      calMetricRows.push({
        user_id: userId, date,
        meeting_load_score: dayMeeting.meetingLoadScore,
        total_meeting_minutes: dayMeeting.totalMeetingMinutes,
        event_count: dayMeeting.events.length,
        back_to_back_count: dayMeeting.backToBackCount,
        boundary_violations: dayMeeting.boundaryViolations,
        focus_gaps: dayMeeting.focusGaps,
      });
      for (const ev of dayMeeting.events) {
        calEventRows.push({
          user_id: userId, date, summary: ev.summary,
          start_time: ev.startDate.toISOString(), end_time: ev.endDate.toISOString(),
          duration_minutes: ev.durationMinutes, attendee_count: ev.attendeeCount,
          is_recurring: ev.isRecurring, location: ev.location,
        });
      }
    }
    n = await upsertBatch('calendar_metrics', calMetricRows, 'user_id,date');
    console.log(`    ${n} calendar day metrics`);
    n = await upsertBatch('calendar_events', calEventRows);
    console.log(`    ${n} calendar events`);
  }

  // Email metrics
  if (emailIntelligence) {
    console.log('  [6/8] Seeding email metrics...');
    const emailRows: Record<string, unknown>[] = [];
    for (const [date, m] of emailIntelligence.dailyMetrics) {
      emailRows.push({
        user_id: userId, date, total_emails: m.totalEmails,
        sent_count: m.sentCount, received_count: m.receivedCount,
        after_hours_count: m.afterHoursCount, after_hours_ratio: +m.afterHoursRatio.toFixed(2),
        unique_threads: m.uniqueThreads, volume_spike: +m.volumeSpike.toFixed(2),
      });
    }
    n = await upsertBatch('email_metrics', emailRows, 'user_id,date');
    console.log(`    ${n} email daily metrics`);
  }

  // Task metrics (per-day snapshot based on task completion dates)
  if (taskMetrics) {
    console.log('  [6/8] Seeding task metrics...');
    // Build a per-day view from task completion/creation dates
    const taskDays = new Map<string, { pending: number; overdue: number; completed: number }>();
    for (const task of taskMetrics.allTasks) {
      if (task.completedDate) {
        const dk = task.completedDate.toISOString().slice(0, 10);
        if (!taskDays.has(dk)) taskDays.set(dk, { pending: 0, overdue: 0, completed: 0 });
        taskDays.get(dk)!.completed++;
      }
    }
    const taskRows = [...taskDays.entries()].map(([date, d]) => ({
      user_id: userId, date,
      pending_count: taskMetrics!.pendingTasks,
      overdue_count: taskMetrics!.overdueTasks,
      completed_today: d.completed,
      velocity: taskMetrics!.recentVelocity,
      completion_rate: taskMetrics!.completionRate,
    }));
    n = await upsertBatch('task_metrics', taskRows, 'user_id,date');
    console.log(`    ${n} task daily metrics`);
  }

  // Master metrics (cognitive load, burnout, resilience)
  console.log('  [6/8] Seeding master metrics...');
  const masterRows: Record<string, unknown>[] = [];
  for (const date of sortedDates) {
    const day = days.get(date)!;
    const calDay = calendarData?.get(date);
    const emailDay = emailIntelligence?.dailyMetrics.get(date);
    const debt = computeSleepDebt(date, days);
    const strain = computeDayStrain(day, extracted.profile.age);

    const cogLoad = computeDailyCognitiveLoad(
      calDay ? { meetingLoadScore: calDay.meetingLoadScore, totalMeetingMinutes: calDay.totalMeetingMinutes, eventCount: calDay.events.length, backToBackCount: calDay.backToBackCount } : null,
      emailDay ? { totalEmails: emailDay.totalEmails, afterHoursRatio: emailDay.afterHoursRatio, volumeSpike: emailDay.volumeSpike } : null,
      taskMetrics ? { pendingCount: taskMetrics.pendingTasks, overdueCount: taskMetrics.overdueTasks } : null,
      debt,
    );

    // Fix cognitive load NaN score
    if (cogLoad && (cogLoad.score === null || isNaN(cogLoad.score as number))) {
      const comps = cogLoad.components as Record<string, number | null>;
      const vals = Object.values(comps).filter((v): v is number => v !== null && !isNaN(v));
      (cogLoad as any).score = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    }

    // Compute burnout trajectory (needs 14+ days of data)
    const burnout = computeBurnoutTrajectory(
      date, days, allCrs,
      calendarData,
      emailIntelligence?.dailyMetrics ?? null,
    );

    // Compute resilience (needs 14+ days of CRS data)
    const resilience = computeResilience(date, allCrs, days);

    masterRows.push({
      user_id: userId, date,
      cognitive_load: cogLoad,
      strain: strain,
      sleep_debt: debt,
      burnout_trajectory: burnout,
      resilience: resilience,
    });
  }
  n = await upsertBatch('master_metrics', masterRows, 'user_id,date');
  console.log(`    ${n} master metrics`);

  // User intelligence
  console.log('  [7/8] Seeding user intelligence + learning timeline...');
  await supabase.from('user_intelligence').upsert({
    user_id: userId,
    summary: userIntel.summary,
    workout_patterns: userIntel.workoutAnalysis,
    sleep_patterns: userIntel.sleepPatterns,
    activity_patterns: userIntel.activityPatterns,
    crs_patterns: userIntel.crsPatterns,
    baselines: userIntel.baselines,
  }, { onConflict: 'user_id' });

  await supabase.from('learning_timeline').upsert({
    user_id: userId,
    intelligence_score: timeline.intelligenceScore,
    total_days: timeline.totalDays,
    total_observations: timeline.totalObservations,
    connected_sources: timeline.connectedSources,
    milestones: timeline.milestones,
  }, { onConflict: 'user_id' });

  // Core memory seeds
  console.log('  [7/8] Seeding core memory...');
  const memorySeeds = [
    { key: 'user_intelligence', value: userIntel.summary },
    { key: 'chronotype', value: userIntel.sleepPatterns?.chronotype ?? 'unknown' },
    { key: 'avg_crs', value: String(userIntel.crsPatterns?.avgScore ?? 'unknown') },
    { key: 'connected_sources', value: connectedSources.join(', ') },
    { key: 'data_range', value: `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` },
    { key: 'total_spots', value: String(spotStats.total) },
    { key: 'total_patterns', value: String(allPatterns.length) },
  ];
  for (const m of memorySeeds) {
    await supabase.from('core_memory').upsert({ user_id: userId, ...m }, { onConflict: 'user_id,key' });
  }

  // ─── Summary ───────────────────────────────────────────────
  console.log('\n  [8/8] Seed complete!\n');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log(`  │  User:              ${user.name.padEnd(27)}│`);
  console.log(`  │  Health days:       ${String(healthRows.length).padEnd(27)}│`);
  console.log(`  │  CRS scores:        ${String(crsRows.length).padEnd(27)}│`);
  console.log(`  │  Stress events:     ${String(stressRows.length).padEnd(27)}│`);
  console.log(`  │  Spots:             ${String(spotRows.length).padEnd(27)}│`);
  console.log(`  │  Patterns:          ${String(patternRows.length).padEnd(27)}│`);
  console.log(`  │  Calendar days:     ${String(calendarData?.size ?? 0).padEnd(27)}│`);
  console.log(`  │  Email days:        ${String(emailIntelligence?.dailyMetrics.size ?? 0).padEnd(27)}│`);
  console.log(`  │  Master metrics:    ${String(masterRows.length).padEnd(27)}│`);
  console.log(`  │  Connected sources: ${String(connectedSources.length).padEnd(27)}│`);
  console.log(`  │  Intelligence:      ${String(timeline.intelligenceScore).padEnd(27)}│`);
  console.log('  └───────────────────────────────────────────────┘');
  console.log(`\n  Supabase: ${SUPABASE_URL}`);
  console.log('  Ready for Edge Functions + Telegram bot.\n');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

/**
 * Data coverage analysis — understand what we're working with.
 */
import { parseAppleHealthExport } from './xml-stream-parser.js';
import { organizeDailyData } from './extractors/daily-organizer.js';
import { computeCrs } from './computed/crs-engine.js';

async function main() {
  const data = await parseAppleHealthExport('../../AppleHealthExport/apple_health_export_ark/export.xml');
  const days = organizeDailyData(data);

  // ─── DATA SOURCES ─────────────────────────────────────
  const watchHR = data.heartRate.filter(r => r.source.includes('Apple Watch'));
  const huaweiHR = data.heartRate.filter(r => r.source.includes('HUAWEI'));

  console.log('=== DATA SOURCES ===');
  console.log('HR from Apple Watch:', watchHR.length, '| starts:', watchHR[0]?.timestamp.toISOString().slice(0, 10));
  console.log('HR from Huawei:', huaweiHR.length, '| range:', huaweiHR[0]?.timestamp.toISOString().slice(0, 10), '→', huaweiHR[huaweiHR.length - 1]?.timestamp.toISOString().slice(0, 10));
  console.log('HRV (Apple Watch only):', data.hrv.length, '| starts:', data.hrv[0]?.timestamp.toISOString().slice(0, 10));
  console.log('Sleep stages:', data.sleepStages.length, '| starts:', data.sleepStages[0]?.startDate.toISOString().slice(0, 10));
  console.log('SpO2:', data.spo2.length, '| starts:', data.spo2[0]?.timestamp.toISOString().slice(0, 10));
  console.log('Respiratory:', data.respiratoryRate.length);
  console.log('Steps:', data.steps.length);
  console.log('Workouts:', data.workouts.length, '| first:', data.workouts[0]?.startDate.toISOString().slice(0, 10));

  // ─── COVERAGE ─────────────────────────────────────────
  let sleepDays = 0, hrvDays = 0, hrDays = 0, stepDays = 0, richDays = 0;
  for (const day of days.values()) {
    if (day.sleep) sleepDays++;
    if (day.hrvReadings.length > 0) hrvDays++;
    if (day.hrReadings.length > 0) hrDays++;
    if (day.totalSteps > 0) stepDays++;
    if (day.sleep && day.hrvReadings.length > 0 && day.hrReadings.length > 0) richDays++;
  }

  console.log('\n=== DATA COVERAGE (' + days.size + ' total days) ===');
  console.log('Days with sleep:', sleepDays);
  console.log('Days with HRV:', hrvDays);
  console.log('Days with HR:', hrDays);
  console.log('Days with steps:', stepDays);
  console.log('Days with sleep+HRV+HR (rich):', richDays);

  // ─── MONTHLY BREAKDOWN ────────────────────────────────
  console.log('\n=== MONTHLY BREAKDOWN ===');
  const months = new Map<string, { total: number; rich: number; sleep: number; hrv: number }>();
  for (const [date, day] of days) {
    const m = date.slice(0, 7);
    if (!months.has(m)) months.set(m, { total: 0, rich: 0, sleep: 0, hrv: 0 });
    const mm = months.get(m)!;
    mm.total++;
    if (day.sleep && day.hrvReadings.length > 0 && day.hrReadings.length > 0) mm.rich++;
    if (day.sleep) mm.sleep++;
    if (day.hrvReadings.length > 0) mm.hrv++;
  }
  for (const [m, v] of [...months.entries()].sort()) {
    if (v.rich > 0 || v.sleep > 0) {
      console.log(`  ${m}: ${String(v.rich).padStart(2)}/${v.total} rich | sleep: ${v.sleep} | hrv: ${v.hrv}`);
    }
  }

  // ─── HRV RMSSD ────────────────────────────────────────
  const rmssdOk = data.hrv.filter(r => r.rmssd !== null).length;
  const rmssdFail = data.hrv.filter(r => r.rmssd === null).length;
  const beatCounts = data.hrv.map(r => r.beats.length);

  console.log('\n=== HRV QUALITY ===');
  console.log('Total records:', data.hrv.length);
  console.log('RMSSD computed:', rmssdOk, `(${(rmssdOk / data.hrv.length * 100).toFixed(1)}%)`);
  console.log('RMSSD failed:', rmssdFail, '(too few beats or >20% artifacts)');
  console.log('Beats per record: min', Math.min(...beatCounts), '| max', Math.max(...beatCounts), '| avg', Math.round(beatCounts.reduce((a, b) => a + b, 0) / beatCounts.length));

  // ─── HR MOTION CONTEXT ────────────────────────────────
  const mc0 = data.heartRate.filter(r => r.motionContext === 0).length;
  const mc1 = data.heartRate.filter(r => r.motionContext === 1).length;
  const mc2 = data.heartRate.filter(r => r.motionContext === 2).length;

  console.log('\n=== HR MOTION CONTEXT ===');
  console.log(`Not set (0): ${mc0} (${(mc0 / data.heartRate.length * 100).toFixed(1)}%) — Huawei data, no context`);
  console.log(`Sedentary (1): ${mc1} (${(mc1 / data.heartRate.length * 100).toFixed(1)}%) — used for resting HR + stress`);
  console.log(`Active (2): ${mc2} (${(mc2 / data.heartRate.length * 100).toFixed(1)}%) — exercise, filtered from stress`);

  // ─── CRS DISTRIBUTION ─────────────────────────────────
  console.log('\n=== CRS DISTRIBUTION (rich days only) ===');
  const scores: number[] = [];
  const sortedDates = [...days.keys()].sort();
  for (const date of sortedDates) {
    const day = days.get(date)!;
    if (day.sleep && day.hrvReadings.length > 0 && day.hrReadings.length > 0) {
      const crs = computeCrs(day, days);
      if (crs.score >= 0) scores.push(crs.score);
    }
  }
  const buckets = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, '<50': 0 };
  for (const s of scores) {
    if (s >= 90) buckets['90-100']++;
    else if (s >= 80) buckets['80-89']++;
    else if (s >= 70) buckets['70-79']++;
    else if (s >= 60) buckets['60-69']++;
    else if (s >= 50) buckets['50-59']++;
    else buckets['<50']++;
  }
  for (const [range, count] of Object.entries(buckets)) {
    const bar = '█'.repeat(count);
    console.log(`  ${range.padStart(6)}: ${String(count).padStart(2)} ${bar}`);
  }
  console.log(`  avg: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)} | min: ${Math.min(...scores)} | max: ${Math.max(...scores)}`);
}

main().catch(console.error);

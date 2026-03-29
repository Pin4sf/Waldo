#!/usr/bin/env node
/**
 * Waldo Health Parser — Phase A0 CLI
 *
 * Commands:
 *   parse   — Parse Apple Health XML and show data summary
 *   demo    — Interactive demo: pick a date, see Waldo's response
 *   crs     — Show CRS scores for a date range
 *
 * Usage:
 *   npx tsx src/index.ts parse [path-to-export.xml]
 *   npx tsx src/index.ts demo [path-to-export.xml]
 *   npx tsx src/index.ts crs [path-to-export.xml] [start-date] [end-date]
 */
import * as readline from 'node:readline';
import chalk from 'chalk';
import { parseAppleHealthExport } from './xml-stream-parser.js';
import { organizeDailyData, getSortedDates } from './extractors/daily-organizer.js';
import { computeCrs, computeAllCrs } from './computed/crs-engine.js';
import { detectDailyStress } from './computed/stress-detector.js';
import { buildAgentContext } from './simulation/prompt-builder.js';
import { generateWaldoResponse } from './simulation/agent.js';
import type { DailyHealthData } from './types/health.js';
import type { CrsResult } from './types/crs.js';
import type { MessageMode } from './types/agent.js';

const DEFAULT_EXPORT = '../../AppleHealthExport/apple_health_export_ark/export.xml';

// ─── FORMATTING HELPERS ───────────────────────────────────────────────

function crsColor(score: number): ((...text: unknown[]) => string) {
  if (score >= 80) return chalk.greenBright;
  if (score >= 50) return chalk.yellow;
  if (score < 0) return chalk.gray;
  return chalk.redBright;
}

function zoneBadge(zone: string): string {
  switch (zone) {
    case 'peak': return chalk.bgGreen.black(' PEAK ');
    case 'moderate': return chalk.bgYellow.black(' MODERATE ');
    case 'low': return chalk.bgRed.white(' LOW ');
    default: return chalk.bgGray.white(` ${zone.toUpperCase()} `);
  }
}

function printCrsCard(date: string, crs: CrsResult): void {
  const scoreStr = crs.score >= 0 ? crs.score.toString() : '—';
  console.log(
    `  ${chalk.dim(date)}  ${chalk.bold(crsColor(crs.score)(scoreStr.padStart(3)))} ${zoneBadge(crs.zone)}  ` +
    chalk.dim(`Sleep ${Math.round(crs.sleep.score)} | HRV ${Math.round(crs.hrv.score)} | Circadian ${Math.round(crs.circadian.score)} | Activity ${Math.round(crs.activity.score)}`),
  );
}

function printDayDetail(date: string, day: DailyHealthData, crs: CrsResult): void {
  console.log();
  console.log(chalk.bold.white(`═══ ${date} ═══`));
  console.log();

  // CRS
  const scoreStr = crs.score >= 0 ? `${crs.score} ±${crs.confidence}` : 'Insufficient data';
  console.log(`  ${chalk.bold('Nap Score:')} ${chalk.bold(crsColor(crs.score)(scoreStr))} ${zoneBadge(crs.zone)}`);
  console.log();

  // Component breakdown
  console.log(chalk.dim('  Components:'));
  for (const [name, comp] of [
    ['Sleep (35%)', crs.sleep],
    ['HRV (25%)', crs.hrv],
    ['Circadian (25%)', crs.circadian],
    ['Activity (15%)', crs.activity],
  ] as const) {
    const available = comp.dataAvailable ? chalk.green('●') : chalk.red('○');
    console.log(`    ${available} ${name.padEnd(16)} ${chalk.bold(crsColor(comp.score)(comp.score.toString().padStart(3)))}`);
    for (const f of comp.factors) {
      console.log(`      ${chalk.dim('→ ' + f)}`);
    }
  }

  // Sleep
  if (day.sleep) {
    console.log();
    console.log(chalk.dim('  Sleep:'));
    const s = day.sleep;
    console.log(`    Duration: ${(s.totalDurationMinutes / 60).toFixed(1)}h | Efficiency: ${(s.efficiency * 100).toFixed(0)}%`);
    console.log(`    Deep: ${(s.deepPercent * 100).toFixed(0)}% | REM: ${(s.remPercent * 100).toFixed(0)}%`);
    const bed = s.bedtime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const wake = s.wakeTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    console.log(`    ${bed} → ${wake}`);
  }

  // HRV
  if (day.hrvReadings.length > 0) {
    console.log();
    console.log(chalk.dim('  HRV:'));
    const values = day.hrvReadings.map(r => r.rmssd ?? r.sdnn);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    console.log(`    Avg: ${avg.toFixed(1)}ms | Min: ${min.toFixed(1)}ms | Max: ${max.toFixed(1)}ms | Readings: ${day.hrvReadings.length}`);
  }

  // Activity
  if (day.totalSteps > 0 || day.exerciseMinutes > 0) {
    console.log();
    console.log(chalk.dim('  Activity:'));
    console.log(`    Steps: ${day.totalSteps.toLocaleString()} | Exercise: ${Math.round(day.exerciseMinutes)}min`);
    if (day.workouts.length > 0) {
      console.log(`    Workouts: ${day.workouts.map(w => w.activityType).join(', ')}`);
    }
  }
}

// ─── COMMANDS ─────────────────────────────────────────────────────────

async function loadData(exportPath: string) {
  console.log(chalk.cyan.bold('\n🐾 Waldo Health Parser — Phase A0\n'));
  console.log(chalk.dim(`Parsing: ${exportPath}`));

  const startTime = Date.now();
  let lastProgress = 0;

  const extracted = await parseAppleHealthExport(exportPath, (p) => {
    const pct = Math.floor((p.bytesRead / p.totalBytes) * 100);
    if (pct > lastProgress + 4) {
      process.stdout.write(`\r  ${chalk.dim(`Parsing... ${pct}% (${p.recordsProcessed.toLocaleString()} records)`)}`);
      lastProgress = pct;
    }
  });

  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.green(`  Parsed ${extracted.recordCount.toLocaleString()} records in ${elapsed}s`));
  console.log(chalk.dim(`  Profile: ${extracted.profile.biologicalSex}, age ${extracted.profile.age}, DOB ${extracted.profile.dateOfBirth}`));
  console.log(chalk.dim(`  HR: ${extracted.heartRate.length} | HRV: ${extracted.hrv.length} | Sleep: ${extracted.sleepStages.length} | SpO2: ${extracted.spo2.length}`));
  console.log(chalk.dim(`  Steps: ${extracted.steps.length} | Workouts: ${extracted.workouts.length} | Activity days: ${extracted.activitySummaries.length}`));

  console.log(chalk.dim('\n  Organizing by day...'));
  const days = organizeDailyData(extracted);
  console.log(chalk.green(`  ${days.size} days of data organized`));

  return { extracted, days };
}

async function commandParse(exportPath: string): Promise<void> {
  const { days } = await loadData(exportPath);

  // Show sample of days with data richness
  const dates = getSortedDates(days);
  const richDays = dates.filter(d => {
    const day = days.get(d)!;
    return day.sleep !== null && day.hrvReadings.length > 0 && day.totalSteps > 0;
  });

  console.log(chalk.dim(`\n  ${richDays.length} days with sleep + HRV + activity data`));
  console.log(chalk.dim(`  Date range: ${dates[0]} → ${dates[dates.length - 1]}`));
  console.log(chalk.dim(`  Rich data range: ${richDays[0]} → ${richDays[richDays.length - 1]}\n`));

  // Compute CRS for rich days and show a sample
  console.log(chalk.bold('  CRS scores (last 14 rich days):\n'));
  const last14 = richDays.slice(-14);
  for (const date of last14) {
    const day = days.get(date)!;
    const crs = computeCrs(day, days);
    printCrsCard(date, crs);
  }
  console.log();
}

async function commandDemo(exportPath: string): Promise<void> {
  const { extracted, days } = await loadData(exportPath);

  const dates = getSortedDates(days);
  const richDays = dates.filter(d => {
    const day = days.get(d)!;
    return day.sleep !== null && day.hrvReadings.length > 0;
  });

  console.log(chalk.bold(`\n  ${richDays.length} days available for demo`));
  console.log(chalk.dim(`  Range: ${richDays[0]} → ${richDays[richDays.length - 1]}`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

  const userName = extracted.profile.biologicalSex === 'Male' ? 'Ark' : 'User';
  const age = extracted.profile.age;

  while (true) {
    console.log();
    const dateInput = await ask(chalk.cyan('  Enter date (YYYY-MM-DD) or "q" to quit: '));

    if (dateInput.trim().toLowerCase() === 'q') {
      rl.close();
      console.log(chalk.dim('\n  Waldo out. 🐾\n'));
      break;
    }

    const date = dateInput.trim();
    const day = days.get(date);

    if (!day) {
      console.log(chalk.red(`  No data for ${date}. Try one of: ${richDays.slice(-5).join(', ')}`));
      continue;
    }

    // Compute CRS and stress
    const crs = computeCrs(day, days);
    const stress = detectDailyStress(day, days);

    // Show the data card
    printDayDetail(date, day, crs);

    // Show stress events
    if (stress.events.length > 0) {
      console.log();
      console.log(chalk.dim('  Stress Events:'));
      for (const event of stress.events) {
        const time = event.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const conf = (event.confidence * 100).toFixed(0);
        const sev = event.severity === 'high' ? chalk.red(event.severity) :
          event.severity === 'moderate' ? chalk.yellow(event.severity) : chalk.dim(event.severity);
        console.log(`    ${time} — ${sev} (${conf}% confidence) — ${event.explanation}`);
      }
    }

    // Now ask what Waldo should say
    console.log(chalk.bold.cyan('\n  ─── Waldo Response ───\n'));

    const modeInput = await ask(
      chalk.dim('  Mode: (1) Morning Wag  (2) Fetch Alert  (3) Ask a question  (4) All three\n') +
      chalk.cyan('  Choose [1-4]: '),
    );

    const mode = modeInput.trim();

    const baseCtx = buildAgentContext(day, crs, stress, 'morning_wag', userName, age);

    try {
      if (mode === '1' || mode === '4') {
        console.log(chalk.bold.green('\n  🌅 Morning Wag:\n'));
        const ctx = { ...baseCtx, mode: 'morning_wag' as MessageMode };
        const resp = await generateWaldoResponse(ctx);
        console.log(chalk.white(`  ${resp.message.split('\n').join('\n  ')}`));
        console.log(chalk.dim(`\n  [${resp.tokensIn}→${resp.tokensOut} tokens, ${resp.responseTimeMs}ms]`));
      }

      if (mode === '2' || mode === '4') {
        if (stress.events.length > 0 || mode === '2') {
          console.log(chalk.bold.yellow('\n  ⚡ Fetch Alert:\n'));
          const ctx = { ...baseCtx, mode: 'fetch_alert' as MessageMode };
          const resp = await generateWaldoResponse(ctx);
          console.log(chalk.white(`  ${resp.message.split('\n').join('\n  ')}`));
          console.log(chalk.dim(`\n  [${resp.tokensIn}→${resp.tokensOut} tokens, ${resp.responseTimeMs}ms]`));
        } else {
          console.log(chalk.dim('\n  No stress events — Fetch Alert would not fire.'));
        }
      }

      if (mode === '3') {
        const question = await ask(chalk.cyan('\n  Your question: '));
        console.log(chalk.bold.blue('\n  💬 Waldo:\n'));
        const ctx = buildAgentContext(day, crs, stress, 'conversational', userName, age, question);
        const resp = await generateWaldoResponse(ctx);
        console.log(chalk.white(`  ${resp.message.split('\n').join('\n  ')}`));
        console.log(chalk.dim(`\n  [${resp.tokensIn}→${resp.tokensOut} tokens, ${resp.responseTimeMs}ms]`));
      }

      if (mode === '4') {
        console.log(chalk.bold.blue('\n  💬 Conversational ("How am I doing?"):\n'));
        const ctx = buildAgentContext(day, crs, stress, 'conversational', userName, age, 'How am I doing today? Give me the real picture.');
        const resp = await generateWaldoResponse(ctx);
        console.log(chalk.white(`  ${resp.message.split('\n').join('\n  ')}`));
        console.log(chalk.dim(`\n  [${resp.tokensIn}→${resp.tokensOut} tokens, ${resp.responseTimeMs}ms]`));
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) {
        console.log(chalk.red('\n  Set ANTHROPIC_API_KEY to enable Claude responses.'));
        console.log(chalk.dim('  export ANTHROPIC_API_KEY=sk-ant-...'));
      } else {
        console.log(chalk.red(`\n  Claude error: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  }
}

async function commandCrs(exportPath: string, startDate?: string, endDate?: string): Promise<void> {
  const { days } = await loadData(exportPath);
  const allCrs = computeAllCrs(days);

  const dates = [...allCrs.keys()].sort();
  const filtered = dates.filter(d => {
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  console.log(chalk.bold(`\n  CRS scores: ${filtered[0]} → ${filtered[filtered.length - 1]}\n`));

  for (const date of filtered) {
    const crs = allCrs.get(date)!;
    if (crs.score >= 0) {
      printCrsCard(date, crs);
    }
  }

  // Stats
  const validScores = filtered.map(d => allCrs.get(d)!.score).filter(s => s >= 0);
  if (validScores.length > 0) {
    const avg = validScores.reduce((s, v) => s + v, 0) / validScores.length;
    const min = Math.min(...validScores);
    const max = Math.max(...validScores);
    console.log(chalk.dim(`\n  Avg: ${avg.toFixed(0)} | Min: ${min} | Max: ${max} | Days: ${validScores.length}`));
  }
  console.log();
}

/**
 * Non-interactive quick demo: show data card + generate Waldo response for a single date.
 * Usage: quick <date> [morning_wag|fetch_alert|conversational] [export.xml]
 */
async function commandQuick(date: string, mode: MessageMode, exportPath: string): Promise<void> {
  const { extracted, days } = await loadData(exportPath);

  const day = days.get(date);
  if (!day) {
    const richDays = getSortedDates(days).filter(d => {
      const dd = days.get(d)!;
      return dd.sleep !== null && dd.hrvReadings.length > 0;
    });
    console.log(chalk.red(`\n  No data for ${date}.`));
    console.log(chalk.dim(`  Try: ${richDays.slice(-5).join(', ')}\n`));
    return;
  }

  const userName = extracted.profile.biologicalSex === 'Male' ? 'Ark' : 'User';
  const age = extracted.profile.age;

  const crs = computeCrs(day, days);
  const stress = detectDailyStress(day, days);

  printDayDetail(date, day, crs);

  if (stress.events.length > 0) {
    console.log();
    console.log(chalk.dim('  Stress Events:'));
    for (const event of stress.events) {
      const time = event.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const conf = (event.confidence * 100).toFixed(0);
      const sev = event.severity === 'high' ? chalk.red(event.severity) :
        event.severity === 'moderate' ? chalk.yellow(event.severity) : chalk.dim(event.severity);
      console.log(`    ${time} — ${sev} (${conf}% confidence) — ${event.explanation}`);
    }
  }

  console.log(chalk.bold.cyan(`\n  ─── Waldo ${mode.replace('_', ' ').toUpperCase()} ───\n`));

  try {
    const ctx = buildAgentContext(day, crs, stress, mode, userName, age,
      mode === 'conversational' ? 'How am I doing today? Give me the real picture.' : undefined);
    const resp = await generateWaldoResponse(ctx);
    console.log(chalk.white(`  ${resp.message.split('\n').join('\n  ')}`));
    console.log(chalk.dim(`\n  [${resp.tokensIn}→${resp.tokensOut} tokens, ${resp.responseTimeMs}ms, zone: ${resp.zone}]\n`));
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ANTHROPIC_API_KEY') || err.message.includes('api_key') || err.message.includes('apiKey') || err.message.includes('authentication'))) {
      console.log(chalk.red('  Set ANTHROPIC_API_KEY to enable Claude responses.'));
      console.log(chalk.dim('  export ANTHROPIC_API_KEY=sk-ant-...\n'));
    } else {
      console.log(chalk.red(`  Claude error: ${err instanceof Error ? err.message : String(err)}\n`));
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] ?? 'demo';
const exportPath = args[1] ?? DEFAULT_EXPORT;

switch (command) {
  case 'parse':
    commandParse(exportPath).catch(console.error);
    break;
  case 'demo':
    commandDemo(exportPath).catch(console.error);
    break;
  case 'crs':
    commandCrs(exportPath, args[2], args[3]).catch(console.error);
    break;
  case 'quick':
    commandQuick(
      args[1] ?? '2026-03-07',
      (args[2] ?? 'morning_wag') as MessageMode,
      args[3] ?? DEFAULT_EXPORT,
    ).catch(console.error);
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log('Usage:');
    console.log('  npx tsx src/index.ts parse [export.xml]');
    console.log('  npx tsx src/index.ts demo [export.xml]');
    console.log('  npx tsx src/index.ts crs [export.xml] [start] [end]');
    console.log('  npx tsx src/index.ts quick <date> [morning_wag|fetch_alert|conversational] [export.xml]');
    process.exit(1);
}

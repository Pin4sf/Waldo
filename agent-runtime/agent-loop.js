#!/usr/bin/env node
/**
 * Waldo Persistent Agent Loop
 *
 * Run one instance per user. Keeps running, checks for work, acts, sleeps.
 * This is the "Phase D preview" — same architecture as Cloudflare Durable Objects
 * but running locally on your Windows laptop (WSL2) until DO migration.
 *
 * Usage:
 *   node agent-loop.js --user-id=<uuid> --name=Ark
 *
 * What it does every 15 minutes:
 *   1. Loads user's health data from Supabase
 *   2. Checks what's needed (morning wag, fetch alert, evening review, patrol)
 *   3. Calls LLM (Claude or DeepSeek based on task)
 *   4. Sends message via Telegram
 *   5. Writes memory/patterns back to Supabase
 *   6. Sleeps until next check
 *
 * On startup:
 *   - Reads user profile from Supabase
 *   - Loads core_memory into in-process cache
 *   - Establishes SQLite local memory file (per-user workspace)
 *
 * Memory architecture:
 *   - SQLite: agent_memory.db (local, fast, survives restarts)
 *   - Supabase: health_snapshots, crs_scores (source of truth for health)
 *   - core_memory table: synced bidirectionally
 *
 * SETUP on Windows (WSL2):
 *   1. Install WSL2: wsl --install -d Ubuntu-24.04
 *   2. Inside WSL2: sudo apt install nodejs npm sqlite3
 *   3. cd ~/waldo-agents && npm install
 *   4. node agent-loop.js --user-id=<uuid> &
 *
 * Or use the start-all-agents.sh script to launch all 5 users at once.
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Config ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    'user-id': { type: 'string' },
    'name':    { type: 'string', default: 'User' },
    'interval-minutes': { type: 'string', default: '15' },
  },
  allowPositionals: false,
});

const USER_ID    = args['user-id'];
const USER_NAME  = args['name'];
const INTERVAL   = parseInt(args['interval-minutes'] ?? '15') * 60 * 1000;

if (!USER_ID) { console.error('--user-id is required'); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;   // service_role key for agent
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!SUPABASE_KEY) { console.error('SUPABASE_KEY env var required'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY env var required'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Per-user SQLite workspace ─────────────────────────────────────
// This is the agent's local memory — persists across restarts
// Mirrors the Cloudflare DO SQLite schema

const workspaceDir = path.join(process.env.HOME ?? '.', 'waldo-workspaces', USER_ID);
fs.mkdirSync(workspaceDir, { recursive: true });
const db = new Database(path.join(workspaceDir, 'memory.db'));

// Init tables
db.exec(`
  CREATE TABLE IF NOT EXISTS memory_blocks (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    archived BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS agent_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── Logging ───────────────────────────────────────────────────────

function log(event, data = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    agent: USER_NAME,
    user_id: USER_ID.slice(0, 8),
    event,
    ...data,
  }));
}

// ─── LLM calls ────────────────────────────────────────────────────

async function callLLM(messages, systemPrompt, triggerType, maxTokens = 500) {
  const needsTools = ['fetch_alert', 'conversational'].includes(triggerType);
  const useDeepSeek = !needsTools && DEEPSEEK_KEY;

  if (useDeepSeek) {
    // DeepSeek V3 — 82% cheaper for simple generation tasks
    const oaiMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages: oaiMessages, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    return { text: data.choices[0].message.content, provider: 'deepseek', tokens: data.usage };
  }

  // Anthropic Claude Haiku — for tool-use tasks and fallback
  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages,
    ...(systemPrompt ? {
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    } : {}),
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { text, provider: 'anthropic', tokens: data.usage };
}

// ─── Supabase helpers ─────────────────────────────────────────────

async function loadCoreMemory() {
  const { data } = await supabase.from('core_memory').select('key, value').eq('user_id', USER_ID);
  for (const row of data ?? []) {
    db.prepare('INSERT OR REPLACE INTO memory_blocks (key, value) VALUES (?, ?)').run(row.key, row.value);
  }
  log('memory_loaded', { entries: data?.length ?? 0 });
}

function readMemory(key) {
  const row = db.prepare('SELECT value FROM memory_blocks WHERE key = ?').get(key);
  return row?.value ?? null;
}

function writeMemory(key, value) {
  db.prepare('INSERT OR REPLACE INTO memory_blocks (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, value);
  // Sync back to Supabase (fire-and-forget)
  supabase.from('core_memory').upsert({ user_id: USER_ID, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' }).then(() => {});
}

async function getLatestCRS() {
  const { data } = await supabase.from('crs_scores').select('score, zone, date').eq('user_id', USER_ID).gte('score', 0).order('date', { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function getHealthSnapshot(date) {
  const { data } = await supabase.from('health_snapshots').select('*').eq('user_id', USER_ID).eq('date', date).maybeSingle();
  return data;
}

async function getUserProfile() {
  const { data } = await supabase.from('users').select('*').eq('id', USER_ID).maybeSingle();
  return data;
}

async function getTelegramChatId() {
  const { data } = await supabase.from('users').select('telegram_chat_id').eq('id', USER_ID).maybeSingle();
  return data?.telegram_chat_id;
}

async function checkIdempotency(triggerType, bucketMs = 15 * 60 * 1000) {
  const bucket = Math.floor(Date.now() / bucketMs);
  const key = `${USER_ID}:${triggerType}:${bucket}`;
  const { data } = await supabase.from('sent_messages').select('id').eq('idempotency_key', key).maybeSingle();
  return data !== null;
}

async function recordSent(triggerType, message, chatId) {
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = `${USER_ID}:${triggerType}:${bucket}`;
  await supabase.from('sent_messages').upsert({ user_id: USER_ID, idempotency_key: key, trigger_type: triggerType, channel: 'telegram', message_preview: message.slice(0, 100) }, { onConflict: 'idempotency_key' });
}

// ─── Telegram delivery ────────────────────────────────────────────

async function sendTelegram(chatId, message) {
  if (!TELEGRAM_TOKEN || !chatId) { log('no_telegram', { chatId }); return false; }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  return res.ok;
}

// ─── Agent actions ────────────────────────────────────────────────

async function morningWag(profile, crs, health) {
  const already = await checkIdempotency('morning_wag');
  if (already) { log('morning_wag_skip', { reason: 'already_sent' }); return; }

  const memory = readMemory('last_weekly_summary') ?? 'No prior week context.';
  const sleepHours = health?.sleep_duration_hours ?? null;
  const hrv = health?.hrv_rmssd ?? null;

  const systemPrompt = `You are Waldo, a personal AI agent. Voice: warm, specific, already acted. 2-3 lines MAX. Never clinical. Never list metrics unless asked. Already on it.

User: ${profile.name}
Chronotype: ${profile.chronotype ?? 'normal'}
Weekly context: ${memory}`;

  const context = [
    `Nap Score: ${crs.score} (${crs.zone})`,
    sleepHours ? `Sleep: ${sleepHours}h` : 'No sleep data',
    hrv ? `HRV: ${Math.round(hrv)}ms` : null,
  ].filter(Boolean).join('. ');

  const { text, provider, tokens } = await callLLM(
    [{ role: 'user', content: `Generate Morning Wag. Context: ${context}` }],
    systemPrompt,
    'morning_wag',
    300,
  );

  log('morning_wag_generated', { provider, tokens_in: tokens.input_tokens, tokens_out: tokens.output_tokens });

  const chatId = await getTelegramChatId();
  if (chatId) {
    await sendTelegram(chatId, text);
    await recordSent('morning_wag', text, chatId);
  }

  // Write episode to local SQLite
  db.prepare('INSERT INTO episodes (type, content) VALUES (?, ?)').run('morning_wag', text);
  writeMemory('last_morning_wag', text);
  writeMemory('last_morning_wag_date', new Date().toISOString().slice(0, 10));
}

async function fetchAlert(profile, crs, health) {
  const stress = health?.stress_confidence ?? 0;
  if (crs.score > 60 && stress < 0.6) return; // Pre-filter: no alert needed

  // Check 2h cooldown
  const already = await checkIdempotency('fetch_alert', 2 * 60 * 60 * 1000);
  if (already) return;

  // Check daily cap (max 3)
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase.from('sent_messages').select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID).eq('trigger_type', 'fetch_alert')
    .gte('created_at', `${today}T00:00:00Z`);
  if ((count ?? 0) >= 3) { log('fetch_alert_cap_reached'); return; }

  const systemPrompt = `You are Waldo. One sentence. Calm. Protective. Already handled it.`;
  const { text, provider } = await callLLM(
    [{ role: 'user', content: `Nap Score ${crs.score}. ${crs.score <= 60 ? 'Score is low.' : 'Stress signal detected.'} Write a brief Fetch Alert.` }],
    systemPrompt,
    'fetch_alert',
    150,
  );

  log('fetch_alert_sent', { provider, score: crs.score });
  const chatId = await getTelegramChatId();
  if (chatId) {
    await sendTelegram(chatId, text);
    await recordSent('fetch_alert', text, chatId);
  }
}

// ─── Main patrol loop ─────────────────────────────────────────────

function localTimeHour(timezone) {
  try {
    const s = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false }).format(new Date());
    return parseInt(s, 10);
  } catch { return new Date().getUTCHours(); }
}

async function patrol() {
  try {
    const profile = await getUserProfile();
    if (!profile) { log('user_not_found'); return; }

    const crs = await getLatestCRS();
    if (!crs) { log('no_crs_data'); return; }

    const health = await getHealthSnapshot(crs.date);
    const timezone = profile.timezone ?? 'UTC';
    const hour = localTimeHour(timezone);
    const [wakeH] = (profile.wake_time_estimate ?? '07:00').split(':').map(Number);
    const [eveningH] = (profile.preferred_evening_time ?? '21:00').split(':').map(Number);

    log('patrol_tick', { hour, score: crs.score, zone: crs.zone });

    // Morning Wag window (wake time ± 15 min)
    if (hour === wakeH) {
      await morningWag(profile, crs, health);
    }

    // Fetch Alert (stress patrol — any hour except quiet hours)
    if (hour >= 6 && hour < 22) {
      await fetchAlert(profile, crs, health);
    }
  } catch (err) {
    log('patrol_error', { error: err.message });
  }
}

// ─── Startup ───────────────────────────────────────────────────────

async function start() {
  log('agent_starting', { interval_ms: INTERVAL });

  // Load memory from Supabase into local SQLite
  await loadCoreMemory();

  log('agent_ready');

  // First patrol immediately
  await patrol();

  // Then every INTERVAL
  while (true) {
    await sleep(INTERVAL);
    await patrol();
  }
}

start().catch(err => { console.error('Agent crashed:', err); process.exit(1); });

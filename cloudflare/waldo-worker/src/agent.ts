/**
 * WaldoAgent — Cloudflare Durable Object
 *
 * One instance per user. Persists indefinitely, hibernates when idle (zero cost).
 * Each user's entire Waldo brain lives here:
 *   - SQLite memory (Tiers 1-3: identity, episodes, procedures)
 *   - DO alarms (Morning Wag at wake time, Patrol every 15 min, Weekly compaction)
 *   - LLM calls (Claude Haiku + DeepSeek routing)
 *   - Telegram delivery
 *   - Bidirectional sync with Supabase (health data reads, memory writes)
 *
 * Health data NEVER stored in DO SQLite.
 * Only derived insights: "HRV declining" — not "HRV was 42ms".
 *
 * HTTP routes (called from Router Worker):
 *   POST /provision   — initialize a new user's DO (called once on signup)
 *   POST /chat        — user sends a message via Telegram/web/app
 *   POST /trigger     — pg_cron or external trigger (morning_wag, fetch_alert)
 *   GET  /status      — current agent state (for web console)
 *   DELETE /reset     — full memory wipe (admin only)
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, UserProfile, TriggerType } from './types';
import {
  initSchema, readMemory, writeMemory, loadCoreMemory,
  addEpisode, getRecentEpisodes, getConversationHistory,
  getState, setState, wasRecentlySent, markSent, countTodaySent,
} from './memory';
import { callLLM } from './llm';
import {
  fetchUserProfile, fetchLatestCRS, fetchHealthSnapshot,
  fetchCoreMemoryFromSupabase, syncMemoryToSupabase,
  saveConversationToSupabase, saveAgentLog, sendTelegramMessage,
} from './supabase';

// ─── Constants ────────────────────────────────────────────────────

const ALARM_PATROL_MS = 15 * 60 * 1000;         // 15 minutes
const MORNING_WAG_WINDOW_MS = 15 * 60 * 1000;   // 15-min window after wake time
const MAX_FETCH_ALERTS_PER_DAY = 3;
const FETCH_ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const DAILY_COST_CAP_USD = 0.10;

// Emergency patterns — bypass all gates
const EMERGENCY_REGEX = /chest\s*pain|can'?t\s*breathe|suicid|kill\s*(my|him|her)self|heart\s*attack|overdos/i;
const BANNED_OUTPUT_REGEX = /diagnos|you\s+have\s+(anxiety|depression|insomnia|sleep\s+apnea|afib|arrhythmia)/i;

// ─── WaldoAgent DO ────────────────────────────────────────────────

export class WaldoAgent extends DurableObject<Env> {
  private sql: DurableObjectStorage['sql'];
  private userId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    initSchema(this.sql);
  }

  // ─── HTTP handler ───────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '');

    // Load userId from memory on every request
    this.userId = readMemory(this.sql, 'user_id');

    try {
      if (request.method === 'POST' && path === 'provision') return this.handleProvision(request);
      if (request.method === 'POST' && path === 'chat') return this.handleChat(request);
      if (request.method === 'POST' && path === 'trigger') return this.handleTrigger(request);
      if (request.method === 'GET' && path === 'status') return this.handleStatus();
      if (request.method === 'DELETE' && path === 'reset') return this.handleReset(request);
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('[WaldoAgent] Request error:', err);
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
    }
  }

  // ─── Alarm handler (scheduled patrol) ──────────────────────────

  async alarm(): Promise<void> {
    const userId = readMemory(this.sql, 'user_id');
    if (!userId) return;
    this.userId = userId;

    console.log(`[WaldoAgent] Alarm fired for user ${userId.slice(0, 8)}`);

    try {
      await this.runPatrol();
    } catch (err) {
      console.error('[WaldoAgent] Alarm patrol error:', err);
    }

    // Schedule next patrol in 15 minutes
    await this.ctx.storage.setAlarm(Date.now() + ALARM_PATROL_MS);
  }

  // ─── Provision: initialize a new user's DO ──────────────────────

  private async handleProvision(request: Request): Promise<Response> {
    const body = await request.json() as { user_id: string };
    const { user_id } = body;
    if (!user_id) return json({ error: 'user_id required' }, 400);

    this.userId = user_id;

    // 1. Load user profile from Supabase
    const profile = await fetchUserProfile(user_id, this.env);
    if (!profile) return json({ error: 'User not found in Supabase' }, 404);

    // 2. Initialize SQLite with user identity (Tier 1 memory)
    writeMemory(this.sql, 'user_id', user_id, 'identity');
    writeMemory(this.sql, 'user_name', profile.name, 'identity');
    writeMemory(this.sql, 'timezone', profile.timezone, 'identity');
    writeMemory(this.sql, 'wake_time', profile.wakeTimeEstimate, 'identity');
    writeMemory(this.sql, 'evening_time', profile.preferredEveningTime, 'identity');
    writeMemory(this.sql, 'wearable_type', profile.wearableType, 'identity');
    writeMemory(this.sql, 'baselines_established', 'false', 'health');
    writeMemory(this.sql, 'days_of_data', '0', 'health');

    // 3. Load existing core_memory from Supabase (if any)
    const existingMemory = await fetchCoreMemoryFromSupabase(user_id, this.env);
    for (const [key, value] of Object.entries(existingMemory)) {
      writeMemory(this.sql, key, value);
    }

    // 4. Add episode: provisioned
    addEpisode(this.sql, 'system', `Waldo provisioned for ${profile.name}. Timezone: ${profile.timezone}. Wake time: ${profile.wakeTimeEstimate}.`);

    // 5. Schedule first alarm (patrol starts now, Morning Wag at next wake time)
    await this.ctx.storage.setAlarm(Date.now() + ALARM_PATROL_MS);

    console.log(`[WaldoAgent] Provisioned for user ${user_id.slice(0, 8)} (${profile.name})`);

    return json({
      status: 'provisioned',
      userId: user_id,
      name: profile.name,
      timezone: profile.timezone,
      firstPatrol: new Date(Date.now() + ALARM_PATROL_MS).toISOString(),
      message: `Waldo is live for ${profile.name}. First Morning Wag at ${profile.wakeTimeEstimate} ${profile.timezone}.`,
    });
  }

  // ─── Chat: user sends a message ────────────────────────────────

  private async handleChat(request: Request): Promise<Response> {
    const body = await request.json() as { message: string; channel?: string };
    const { message, channel = 'web' } = body;
    if (!message?.trim()) return json({ error: 'message required' }, 400);
    if (!this.userId) return json({ error: 'DO not provisioned' }, 400);

    // Emergency gate
    if (EMERGENCY_REGEX.test(message)) {
      const emergency = "I'm not equipped to help with this. Please contact emergency services (112) or a medical professional immediately. Your safety matters more than any data.";
      return json({ reply: emergency, emergency: true });
    }

    const startMs = Date.now();

    // Load context
    const [crs, profile] = await Promise.all([
      fetchLatestCRS(this.userId, this.env),
      fetchUserProfile(this.userId, this.env),
    ]);

    const memory = loadCoreMemory(this.sql);
    const history = getConversationHistory(this.sql, 8);

    // Build system prompt
    const system = buildSystemPrompt('conversational', memory, profile?.name ?? 'User');

    // Build messages with history
    const messages = [
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      {
        role: 'user' as const,
        content: buildUserContext(crs, null, memory) + '\n\n---BEGIN USER MESSAGE---\n' + message.slice(0, 1000) + '\n---END USER MESSAGE---',
      },
    ];

    // Call LLM
    const result = await callLLM(messages, {
      system,
      maxTokens: 600,
      triggerType: 'conversational',
      cacheSystem: true,
    }, this.env);

    // Validate output
    let reply = result.text;
    if (BANNED_OUTPUT_REGEX.test(reply)) {
      reply = reply.replace(BANNED_OUTPUT_REGEX, '[medical assessment removed — consult a doctor]');
    }

    const latencyMs = Date.now() - startMs;

    // Store in DO episodes (Tier 2)
    addEpisode(this.sql, 'conversation', message, 'user', { channel });
    addEpisode(this.sql, 'conversation', reply, 'waldo', { channel, tokens: result.tokensIn + result.tokensOut });

    // Sync to Supabase (fire-and-forget)
    void saveConversationToSupabase(this.userId, 'user', message, 'conversational', this.env);
    void saveConversationToSupabase(this.userId, 'waldo', reply, 'conversational', this.env);
    void saveAgentLog(this.userId, 'conversational', result.tokensIn, result.tokensOut, latencyMs, 'sent', result.costUsd, this.env);

    return json({ reply, zone: crs?.zone, latencyMs, provider: result.provider });
  }

  // ─── Trigger: external trigger (from pg_cron webhook or check-triggers) ─────

  private async handleTrigger(request: Request): Promise<Response> {
    const body = await request.json() as { trigger_type: TriggerType };
    const { trigger_type } = body;
    if (!this.userId) return json({ error: 'DO not provisioned' }, 400);

    const result = await this.executeTrigger(trigger_type);
    return json(result);
  }

  // ─── Status: current DO state ──────────────────────────────────

  private async handleStatus(): Promise<Response> {
    if (!this.userId) return json({ provisioned: false });

    const memory = loadCoreMemory(this.sql);
    const recentEpisodes = getRecentEpisodes(this.sql, 5);
    const nextAlarm = await this.ctx.storage.getAlarm();

    return json({
      provisioned: true,
      userId: this.userId,
      name: memory['user_name'],
      timezone: memory['timezone'],
      wakeTime: memory['wake_time'],
      currentZone: memory['current_zone'] ?? 'unknown',
      currentScore: parseInt(memory['current_score'] ?? '0'),
      lastMorningWag: memory['last_morning_wag_date'],
      lastEveningReview: memory['last_evening_date'],
      baselines: memory['baselines_established'] === 'true',
      nextAlarm: nextAlarm ? new Date(nextAlarm).toISOString() : null,
      recentActivity: recentEpisodes.slice(0, 3).map(e => ({ type: e.type, at: e.created_at })),
      memoryKeys: Object.keys(memory).length,
    });
  }

  // ─── Reset: wipe all memory (admin) ───────────────────────────

  private async handleReset(request: Request): Promise<Response> {
    const adminKey = request.headers.get('x-admin-key');
    // Simple validation — in production add proper admin auth
    if (!adminKey) return json({ error: 'Unauthorized' }, 401);

    this.sql.exec('DELETE FROM memory_blocks');
    this.sql.exec('DELETE FROM episodes');
    this.sql.exec('DELETE FROM procedures');
    this.sql.exec('DELETE FROM agent_state');
    await this.ctx.storage.deleteAlarm();
    this.userId = null;

    return json({ reset: true });
  }

  // ─── Core patrol loop ──────────────────────────────────────────

  private async runPatrol(): Promise<void> {
    const userId = this.userId!;
    const memory = loadCoreMemory(this.sql);
    const timezone = memory['timezone'] ?? 'UTC';
    const wakeTime = memory['wake_time'] ?? '07:00';
    const eveningTime = memory['evening_time'] ?? '21:00';

    const [crs, profile] = await Promise.all([
      fetchLatestCRS(userId, this.env),
      fetchUserProfile(userId, this.env),
    ]);

    if (!crs || !profile) return;

    // Update current state in memory
    writeMemory(this.sql, 'current_score', String(crs.score));
    writeMemory(this.sql, 'current_zone', crs.zone);

    const localHour = getLocalHour(timezone);
    const localMinute = getLocalMinute(timezone);
    const today = getLocalDate(timezone);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);
    const [eveningH, eveningM] = eveningTime.split(':').map(Number);

    // Quiet hours: no messages 22:00-06:00
    if (localHour >= 22 || localHour < 6) return;

    // ─── Morning Wag ────────────────────────────────────────
    const inWakeWindow = localHour === wakeH && localMinute >= (wakeM ?? 0) && localMinute < (wakeM ?? 0) + 15;
    const morningAlreadySent = wasRecentlySent(this.sql, 'morning_wag', 23 * 60 * 60 * 1000);
    const morningLastDate = getState(this.sql, 'morning_wag_date');

    if (inWakeWindow && !morningAlreadySent && morningLastDate !== today) {
      await this.sendMorningWag(profile, crs, memory);
      markSent(this.sql, 'morning_wag', 23 * 60 * 60 * 1000);
      setState(this.sql, 'morning_wag_date', today);
    }

    // ─── Evening Review ─────────────────────────────────────
    const inEveningWindow = localHour === eveningH && localMinute >= (eveningM ?? 0) && localMinute < (eveningM ?? 0) + 15;
    const eveningLastDate = getState(this.sql, 'evening_date');

    if (inEveningWindow && eveningLastDate !== today) {
      await this.sendEveningReview(profile, crs, memory);
      setState(this.sql, 'evening_date', today);
    }

    // ─── Fetch Alert ────────────────────────────────────────
    const alertable = crs.score <= 60;
    const cooldownPassed = !wasRecentlySent(this.sql, 'fetch_alert', FETCH_ALERT_COOLDOWN_MS);
    const dailyCount = countTodaySent(this.sql, 'fetch_alert');

    if (alertable && cooldownPassed && dailyCount < MAX_FETCH_ALERTS_PER_DAY) {
      await this.sendFetchAlert(profile, crs, memory);
      markSent(this.sql, 'fetch_alert', FETCH_ALERT_COOLDOWN_MS);
    }
  }

  // ─── Morning Wag ───────────────────────────────────────────────

  private async sendMorningWag(profile: UserProfile, crs: { score: number; zone: string; sleepJson: Record<string, unknown> | null }, memory: Record<string, string>): Promise<void> {
    const startMs = Date.now();
    const userId = this.userId!;

    const health = await fetchHealthSnapshot(userId, crs.date ?? new Date().toISOString().slice(0, 10), this.env);

    const system = buildSystemPrompt('morning_wag', memory, profile.name);
    const context = buildUserContext(crs, health, memory);

    const result = await callLLM(
      [{ role: 'user', content: `Generate the Morning Wag for today. Context:\n${context}` }],
      { system, maxTokens: 300, triggerType: 'morning_wag', cacheSystem: true },
      this.env,
    );

    const message = result.text;
    writeMemory(this.sql, 'last_morning_wag', message);
    writeMemory(this.sql, 'last_morning_wag_date', new Date().toISOString().slice(0, 10));
    addEpisode(this.sql, 'morning_wag', message, 'waldo', { score: crs.score, provider: result.provider });

    // Deliver
    if (profile.telegramChatId) {
      await sendTelegramMessage(profile.telegramChatId, message, this.env);
    }

    const latencyMs = Date.now() - startMs;
    void saveConversationToSupabase(userId, 'waldo', message, 'morning_wag', this.env);
    void saveAgentLog(userId, 'morning_wag', result.tokensIn, result.tokensOut, latencyMs, 'sent', result.costUsd, this.env);

    console.log(`[WaldoAgent] Morning Wag sent to ${profile.name} (${result.provider}, ${result.tokensIn + result.tokensOut} tokens)`);
  }

  // ─── Evening Review ────────────────────────────────────────────

  private async sendEveningReview(profile: UserProfile, crs: { score: number; zone: string }, memory: Record<string, string>): Promise<void> {
    const startMs = Date.now();
    const userId = this.userId!;

    const system = buildSystemPrompt('evening_review', memory, profile.name);
    const result = await callLLM(
      [{ role: 'user', content: `Generate the Evening Review. Nap Score today: ${crs.score} (${crs.zone}).` }],
      { system, maxTokens: 200, triggerType: 'evening_review', cacheSystem: true },
      this.env,
    );

    if (profile.telegramChatId) {
      await sendTelegramMessage(profile.telegramChatId, result.text, this.env);
    }

    addEpisode(this.sql, 'evening_review', result.text, 'waldo');
    writeMemory(this.sql, 'last_evening_date', new Date().toISOString().slice(0, 10));
    void saveAgentLog(userId, 'evening_review', result.tokensIn, result.tokensOut, Date.now() - startMs, 'sent', result.costUsd, this.env);
  }

  // ─── Fetch Alert ───────────────────────────────────────────────

  private async sendFetchAlert(profile: UserProfile, crs: { score: number; zone: string }, memory: Record<string, string>): Promise<void> {
    const startMs = Date.now();
    const userId = this.userId!;

    const system = buildSystemPrompt('fetch_alert', memory, profile.name);
    const result = await callLLM(
      [{ role: 'user', content: `Nap Score ${crs.score} (${crs.zone}). Write a brief Fetch Alert. One sentence.` }],
      { system, maxTokens: 150, triggerType: 'fetch_alert', cacheSystem: true },
      this.env,
    );

    if (profile.telegramChatId) {
      await sendTelegramMessage(profile.telegramChatId, result.text, this.env);
    }

    addEpisode(this.sql, 'fetch_alert', result.text, 'waldo', { score: crs.score });
    void saveAgentLog(userId, 'fetch_alert', result.tokensIn, result.tokensOut, Date.now() - startMs, 'sent', result.costUsd, this.env);
  }

  // ─── External trigger dispatch ─────────────────────────────────

  private async executeTrigger(triggerType: TriggerType): Promise<{ sent: boolean; message?: string }> {
    const userId = this.userId!;
    const [crs, profile] = await Promise.all([
      fetchLatestCRS(userId, this.env),
      fetchUserProfile(userId, this.env),
    ]);
    if (!crs || !profile) return { sent: false };

    const memory = loadCoreMemory(this.sql);

    if (triggerType === 'morning_wag') {
      await this.sendMorningWag(profile, crs, memory);
      return { sent: true };
    }
    if (triggerType === 'fetch_alert') {
      await this.sendFetchAlert(profile, crs, memory);
      return { sent: true };
    }
    if (triggerType === 'evening_review') {
      await this.sendEveningReview(profile, crs, memory);
      return { sent: true };
    }
    return { sent: false };
  }
}

// ─── Soul prompt builder ──────────────────────────────────────────

function buildSystemPrompt(mode: TriggerType | 'conversational', memory: Record<string, string>, name: string): string {
  const base = `You are Waldo. A dalmatian. You watch, you learn, you act.

Rules:
- 2-3 lines MAX for any message. Usually 2.
- Lead with what you DID or what to DO. Not what you observed.
- Never list metrics unless asked. The score speaks for itself.
- Compare to THEIR baseline only. Never population norms.
- Sound like a friend who already handled it. Not a health app.
- "Already on it" energy. Quiet confidence. No filler words.

Safety:
- Never diagnose medical conditions.
- Never recommend medications.
- Never say "you are stressed" — say "your body is showing stress signals."
- Not a medical device.`;

  const modeInstructions: Record<string, string> = {
    morning_wag: `\nMode: Morning Wag. Warm, specific, actionable. What changed overnight. One thing to watch. Never start with "Good morning".`,
    fetch_alert:  `\nMode: Fetch Alert. Calm, protective. One sentence. Already handled it.`,
    evening_review: `\nMode: Evening Review. Reflective, forward-looking. What the day told you. What tomorrow needs.`,
    conversational: `\nMode: Chat. Answer the question with their data. Be direct. Wit is permitted but never forced.`,
  };

  const memoryContext = Object.entries(memory)
    .filter(([k]) => ['hrv_baseline', 'sleep_avg_7d', 'resting_hr_baseline', 'chronotype', 'sleep_debt', 'last_weekly_summary'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  return `${base}${modeInstructions[mode] ?? ''}\n\nUser: ${name}${memoryContext ? '\n\nWhat Waldo knows:\n' + memoryContext : ''}`;
}

function buildUserContext(
  crs: { score: number; zone: string } | null,
  health: { hrv_rmssd?: number | null; resting_hr?: number | null; sleep_duration_hours?: number | null; steps?: number | null } | null,
  memory: Record<string, string>,
): string {
  const parts: string[] = [];
  if (crs) parts.push(`Nap Score: ${crs.score} (${crs.zone})`);
  if (health?.sleep_duration_hours) parts.push(`Sleep: ${health.sleep_duration_hours}h`);
  if (health?.hrv_rmssd) parts.push(`HRV: ${Math.round(health.hrv_rmssd)}ms`);
  if (health?.resting_hr) parts.push(`Resting HR: ${Math.round(health.resting_hr)}bpm`);
  if (health?.steps) parts.push(`Steps: ${health.steps.toLocaleString()}`);
  if (memory['sleep_debt']) parts.push(`Sleep debt: ${memory['sleep_debt']}`);
  return parts.join(' · ');
}

// ─── Timezone helpers ─────────────────────────────────────────────

function getLocalHour(timezone: string): number {
  try {
    return parseInt(new Date().toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false }), 10);
  } catch { return new Date().getUTCHours(); }
}

function getLocalMinute(timezone: string): number {
  try {
    return parseInt(new Date().toLocaleString('en-CA', { timeZone: timezone, minute: '2-digit' }), 10);
  } catch { return new Date().getUTCMinutes(); }
}

function getLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}

// ─── Response helper ──────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

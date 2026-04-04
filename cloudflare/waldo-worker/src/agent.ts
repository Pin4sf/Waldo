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
  initSchema, readMemory, writeMemory, loadCoreMemory, loadCompactMemory,
  loadProfileMemory, loadRecentDiaries, sanitizeMemoryValue,
  addEpisode, getRecentEpisodes, getConversationHistory,
  getUnconsolidatedEpisodes, markEpisodesConsolidated,
  getState, setState, wasRecentlySent, markSent, countTodaySent,
} from './memory';
import { callLLM } from './llm';
import {
  fetchUserProfile, fetchLatestCRS, fetchHealthSnapshot,
  fetchCoreMemoryFromSupabase, syncMemoryToSupabase,
  saveConversationToSupabase, saveAgentLog, sendTelegramMessage,
} from './supabase';

// ─── Constants ────────────────────────────────────────────────────

const ALARM_PATROL_MS       = 15 * 60 * 1000;   // 15 minutes
const MORNING_WAG_WINDOW_MS = 15 * 60 * 1000;   // 15-min window after wake time
const MAX_FETCH_ALERTS_PER_DAY = 3;
const FETCH_ALERT_COOLDOWN_MS  = 2 * 60 * 60 * 1000; // 2 hours
const DAILY_COST_CAP_USD = 0.10;
const MIN_EPISODES_FOR_COMPACTION = 2;           // Don't compact nearly-empty days

// ─── Interview questions ──────────────────────────────────────────
const INTERVIEW_QUESTIONS = [
  { key: 'user_role',           question: "What do you do? I'll use this to understand your day." },
  { key: 'stress_triggers',     question: "What tends to wear you out or stress you most?" },
  { key: 'daily_pattern',       question: "Walk me through a typical day — when do you start, peak, wind down?" },
  { key: 'communication_pref',  question: "How do you want me to talk to you? Quick and direct, or more detail?" },
  { key: 'primary_goal',        question: "One thing you'd want me to help you stay on top of?" },
] as const;

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

    const timezone = readMemory(this.sql, 'timezone') ?? 'UTC';
    const localHour = getLocalHour(timezone);

    console.log(`[WaldoAgent] Alarm for ${userId.slice(0, 8)} at local hour ${localHour}`);

    // ─── KAIROS tick-and-decide: daily compaction (2–4 AM local) ──
    // Run compaction only if: correct window + not already done today
    if (localHour >= 2 && localHour < 4) {
      const yesterday          = getYesterdayDate(timezone);
      const lastCompactionDate = getState(this.sql, 'last_compaction_date');
      if (lastCompactionDate !== yesterday) {
        try {
          await this.runDailyCompaction(yesterday, timezone);
        } catch (err) {
          console.error('[WaldoAgent] Daily compaction error:', err);
          // Compaction failure must NEVER block morning patrol
        }
      }
    }

    // ─── Patrol: Morning Wag, Evening Review, Fetch Alert ─────────
    try {
      await this.runPatrol();
    } catch (err) {
      console.error('[WaldoAgent] Patrol error:', err);
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

    // 2. Initialize SQLite with user identity (Tier 1 — read-only category)
    // isProvision=true bypasses the identity-key guard
    writeMemory(this.sql, 'user_id',    user_id,                    'identity', true);
    writeMemory(this.sql, 'user_name',  profile.name,               'identity', true);
    writeMemory(this.sql, 'timezone',   profile.timezone,           'identity', true);
    writeMemory(this.sql, 'wake_time',  profile.wakeTimeEstimate,   'identity', true);
    writeMemory(this.sql, 'evening_time', profile.preferredEveningTime, 'identity', true);
    writeMemory(this.sql, 'wearable_type', profile.wearableType,    'identity', true);
    writeMemory(this.sql, 'baselines_established', 'false', 'health');
    writeMemory(this.sql, 'days_of_data', '0', 'health');

    // 3. Load existing core_memory from Supabase — VALIDATE before writing
    // Prevents poisoned Supabase rows from contaminating the DO's trusted memory.
    const existingMemory = await fetchCoreMemoryFromSupabase(user_id, this.env);
    let skipped = 0;
    for (const [key, value] of Object.entries(existingMemory)) {
      const safe = sanitizeMemoryValue(value);
      if (safe === null) { skipped++; continue; }
      // Never overwrite identity keys from Supabase import
      writeMemory(this.sql, key, safe, 'preference');
    }
    if (skipped > 0) {
      console.warn(`[WaldoAgent] Provision: skipped ${skipped} poisoned memory entries for ${user_id.slice(0, 8)}`);
    }

    // 4. Add episode: provisioned
    addEpisode(this.sql, 'system', `Waldo provisioned for ${profile.name}. Timezone: ${profile.timezone}. Wake time: ${profile.wakeTimeEstimate}.`);

    // 5. Start interview — patrol alarm set after interview completes
    setState(this.sql, 'interview_step', '0');
    setState(this.sql, 'interview_complete', 'false');

    console.log(`[WaldoAgent] Provisioned for user ${user_id.slice(0, 8)} (${profile.name})`);

    return json({
      status: 'provisioned',
      userId: user_id,
      name: profile.name,
      timezone: profile.timezone,
      message: `Waldo is live for ${profile.name}. Starting onboarding interview.`,
      firstQuestion: INTERVIEW_QUESTIONS[0]!.question,
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

    // Interview gate — route through interview flow until complete
    const interviewComplete = getState(this.sql, 'interview_complete') === 'true';
    if (!interviewComplete) {
      const reply = await this.handleInterviewTurn(message);
      return json({ reply, inInterview: true });
    }

    // Cost cap gate
    if (this.isDailyCostCapReached()) {
      const fallback = "I'm at my daily limit — I'll be back tomorrow with fresh eyes. If it's urgent, check the Waldo dashboard.";
      return json({ reply: fallback, costCapped: true });
    }

    const startMs = Date.now();

    // Load context
    const [crs, profile] = await Promise.all([
      fetchLatestCRS(this.userId, this.env),
      fetchUserProfile(this.userId, this.env),
    ]);

    const memory       = loadCompactMemory(this.sql);
    const profileMem   = loadProfileMemory(this.sql);
    const recentDiaries = loadRecentDiaries(this.sql, 2);
    const history      = getConversationHistory(this.sql, 8);

    const system = buildSystemPrompt('conversational', memory, profile?.name ?? 'User', {
      profileMemory:  profileMem,
      recentDiaries,
    });

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

    this.trackCost(result.costUsd);

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
    const adminKey    = request.headers.get('x-admin-key');
    const env         = this.env as unknown as Record<string, string>;
    const expectedKey = env['ADMIN_KEY'] ?? env['WALDO_WORKER_SECRET'];
    if (!adminKey || adminKey !== expectedKey) return json({ error: 'Unauthorized' }, 401);

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

    // Update current state in memory (health category — system-set, not user-writable)
    writeMemory(this.sql, 'current_score', String(crs.score), 'health');
    writeMemory(this.sql, 'current_zone',  crs.zone,          'health');

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
    const alertable     = crs.score <= 60;
    const cooldownPassed = !wasRecentlySent(this.sql, 'fetch_alert', FETCH_ALERT_COOLDOWN_MS);
    const dailyCount     = countTodaySent(this.sql, 'fetch_alert');
    const costOk         = !this.isDailyCostCapReached();

    if (alertable && cooldownPassed && dailyCount < MAX_FETCH_ALERTS_PER_DAY && costOk) {
      await this.sendFetchAlert(profile, crs, memory);
      markSent(this.sql, 'fetch_alert', FETCH_ALERT_COOLDOWN_MS);
    }
  }

  // ─── Morning Wag ───────────────────────────────────────────────

  private async sendMorningWag(profile: UserProfile, crs: { score: number; zone: string; sleepJson: Record<string, unknown> | null }, memory: Record<string, string>): Promise<void> {
    const startMs = Date.now();
    const userId = this.userId!;

    const today  = new Date().toISOString().slice(0, 10);
    const health      = await fetchHealthSnapshot(userId, today, this.env);
    const profileMem  = loadProfileMemory(this.sql);
    const recentDiaries = loadRecentDiaries(this.sql, 2);

    const system  = buildSystemPrompt('morning_wag', memory, profile.name, { profileMemory: profileMem, recentDiaries });
    const context = buildUserContext(crs, health, memory);

    const result = await callLLM(
      [{ role: 'user', content: `Generate the Morning Wag for today. Context:\n${context}` }],
      { system, maxTokens: 300, triggerType: 'morning_wag', cacheSystem: true },
      this.env,
    );

    const message = result.text;
    writeMemory(this.sql, 'last_morning_wag',      message,                               'health');
    writeMemory(this.sql, 'last_morning_wag_date', new Date().toISOString().slice(0, 10), 'health');
    addEpisode(this.sql, 'morning_wag', message, 'waldo', { score: crs.score, provider: result.provider });

    // Deliver
    if (profile.telegramChatId) {
      await sendTelegramMessage(profile.telegramChatId, message, this.env);
    }

    const latencyMs = Date.now() - startMs;
    this.trackCost(result.costUsd);
    void saveConversationToSupabase(userId, 'waldo', message, 'morning_wag', this.env);
    void saveAgentLog(userId, 'morning_wag', result.tokensIn, result.tokensOut, latencyMs, 'sent', result.costUsd, this.env);

    console.log(`[WaldoAgent] Morning Wag sent to ${profile.name} (${result.provider}, ${result.tokensIn + result.tokensOut} tokens)`);
  }

  // ─── Evening Review ────────────────────────────────────────────

  private async sendEveningReview(profile: UserProfile, crs: { score: number; zone: string }, memory: Record<string, string>): Promise<void> {
    const startMs = Date.now();
    const userId = this.userId!;

    const profileMem    = loadProfileMemory(this.sql);
    const recentDiaries = loadRecentDiaries(this.sql, 1);
    const system = buildSystemPrompt('evening_review', memory, profile.name, { profileMemory: profileMem, recentDiaries });
    const result = await callLLM(
      [{ role: 'user', content: `Generate the Evening Review. Nap Score today: ${crs.score} (${crs.zone}).` }],
      { system, maxTokens: 200, triggerType: 'evening_review', cacheSystem: true },
      this.env,
    );

    if (profile.telegramChatId) {
      await sendTelegramMessage(profile.telegramChatId, result.text, this.env);
    }

    addEpisode(this.sql, 'evening_review', result.text, 'waldo');
    writeMemory(this.sql, 'last_evening_date', new Date().toISOString().slice(0, 10), 'health');
    this.trackCost(result.costUsd);
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
    this.trackCost(result.costUsd);
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

  // ─── Daily Compaction (AtlanClaw pattern: episodes → diary entry) ─

  private async runDailyCompaction(yesterdayDate: string, timezone: string): Promise<void> {
    const userId = this.userId!;
    const episodes = getUnconsolidatedEpisodes(this.sql, yesterdayDate);

    // KAIROS: only compact if there's meaningful content
    if (episodes.length < MIN_EPISODES_FOR_COMPACTION) {
      setState(this.sql, 'last_compaction_date', yesterdayDate);
      console.log(`[WaldoAgent] Compaction skipped for ${yesterdayDate} (${episodes.length} episodes, below threshold)`);
      return;
    }

    // Build a summary for Claude to compact
    const episodeSummary = episodes.map(e => {
      const who = e.role === 'user' ? 'User' : e.role === 'waldo' ? 'Waldo' : e.type;
      return `[${e.type}][${e.created_at.slice(11, 16)}] ${who}: ${e.content.slice(0, 200)}`;
    }).join('\n');

    const compactionPrompt = `You are compacting Waldo's memory for ${yesterdayDate}.

Below are yesterday's raw agent events. Write a concise diary entry (max 300 tokens) that captures:
- What proactive messages were sent and how the user responded
- Any new preferences, patterns, or facts revealed
- The emotional tone of interactions
- Anything Waldo learned or should remember

Be specific, not generic. Focus on what's DIFFERENT from baseline.
Never include raw health values (HRV numbers, HR bpm, sleep hours).

RAW EVENTS:
${episodeSummary}

Diary entry:`;

    let diaryEntry: string;
    try {
      const result = await callLLM(
        [{ role: 'user', content: compactionPrompt }],
        {
          system: 'You are a concise memory compactor. Write factual, specific diary entries. No filler.',
          maxTokens: 300,
          triggerType: 'weekly_compaction',
          cacheSystem: false,
        },
        this.env,
      );
      diaryEntry = result.text.trim();
      this.trackCost(result.costUsd);
    } catch (err) {
      // Compaction failure is NOT fatal — log and mark as done to avoid retry loops
      console.error('[WaldoAgent] Compaction LLM call failed:', err);
      setState(this.sql, 'last_compaction_date', yesterdayDate);
      return;
    }

    // Write diary entry to memory_blocks (category='episodic')
    writeMemory(this.sql, `diary_${yesterdayDate}`, diaryEntry, 'episodic');

    // Mark episodes as consolidated
    markEpisodesConsolidated(this.sql, yesterdayDate);

    // Record compaction complete
    setState(this.sql, 'last_compaction_date', yesterdayDate);

    // Mirror diary entry to Supabase (fire-and-forget)
    void syncMemoryToSupabase(userId, `diary_${yesterdayDate}`, diaryEntry, this.env);

    console.log(`[WaldoAgent] Compaction complete for ${yesterdayDate}: ${episodes.length} episodes → diary entry`);
  }

  // ─── Interview flow ────────────────────────────────────────────

  private async handleInterviewTurn(userMessage: string): Promise<string> {
    const step = parseInt(getState(this.sql, 'interview_step') ?? '0', 10);
    const question = INTERVIEW_QUESTIONS[step];

    // User wants to skip
    if (/skip|later|no thanks|not now/i.test(userMessage)) {
      setState(this.sql, 'interview_complete', 'true');
      await this.ctx.storage.setAlarm(Date.now() + ALARM_PATROL_MS);
      const wakeTime = readMemory(this.sql, 'wake_time') ?? '07:00';
      return `No worries — I'll learn as we go. Your first Morning Wag arrives tomorrow at ${wakeTime}. Say anything to chat.`;
    }

    if (!question) {
      // Shouldn't happen, but complete interview gracefully
      setState(this.sql, 'interview_complete', 'true');
      await this.ctx.storage.setAlarm(Date.now() + ALARM_PATROL_MS);
      return "Got it. I'll be watching. Your first Morning Wag arrives tomorrow.";
    }

    // Save the answer — validate before writing (interview input is user-controlled)
    const safeAnswer = sanitizeMemoryValue(userMessage);
    if (safeAnswer !== null) {
      writeMemory(this.sql, question.key, safeAnswer, 'profile');
    }
    addEpisode(this.sql, 'interview', userMessage.slice(0, 300), 'user');

    const nextStep = step + 1;
    setState(this.sql, 'interview_step', String(nextStep));

    const nextQuestion = INTERVIEW_QUESTIONS[nextStep];

    if (!nextQuestion) {
      // Interview complete
      setState(this.sql, 'interview_complete', 'true');
      await this.ctx.storage.setAlarm(Date.now() + ALARM_PATROL_MS);
      const wakeTime = readMemory(this.sql, 'wake_time') ?? '07:00';
      const reply = `Got it. I know enough to start being useful. Your first Morning Wag arrives tomorrow at ${wakeTime}. Say anything to chat anytime.`;
      addEpisode(this.sql, 'interview', reply, 'waldo');
      return reply;
    }

    // Return next question with a brief transition
    const transitions = [
      'Good to know.',
      'Makes sense.',
      'Got it.',
      'Noted.',
      'Understood.',
    ];
    const transition = transitions[step % transitions.length] ?? 'Got it.';
    const reply = `${transition} ${nextQuestion.question}`;
    addEpisode(this.sql, 'interview', reply, 'waldo');
    return reply;
  }

  // ─── Daily cost cap ────────────────────────────────────────────

  private isDailyCostCapReached(): boolean {
    const today       = getLocalDate(readMemory(this.sql, 'timezone') ?? 'UTC');
    const resetDate   = getState(this.sql, 'cost_reset_date');

    if (resetDate !== today) {
      setState(this.sql, 'daily_cost_usd', '0');
      setState(this.sql, 'cost_reset_date', today);
      return false;
    }

    const todayCost = parseFloat(getState(this.sql, 'daily_cost_usd') ?? '0');
    return todayCost >= DAILY_COST_CAP_USD;
  }

  private trackCost(costUsd: number): void {
    const current = parseFloat(getState(this.sql, 'daily_cost_usd') ?? '0');
    setState(this.sql, 'daily_cost_usd', String(current + costUsd));
  }
}

// ─── Soul prompt builder ──────────────────────────────────────────

/**
 * Build the system prompt for Waldo.
 *
 * Loads from 3 sources (AtlanClaw pattern):
 * 1. SOUL BASE (hardcoded — never writable by user/agent = read-only ConfigMap equivalent)
 * 2. User profile from memory_blocks (interview answers + health baselines)
 * 3. Recent diary entries (daily compacted episodes = MEMORY.md equivalent)
 *
 * Total: ~400-600 tokens depending on data richness.
 */
function buildSystemPrompt(
  mode: TriggerType | 'conversational',
  memory: Record<string, string>,
  name: string,
  opts?: { profileMemory?: Record<string, string>; recentDiaries?: string[] },
): string {
  // ─── SOUL BASE (read-only, never modified by agent or user) ──────
  const base = `You are Waldo. A dalmatian. You watch, you learn, you act.

Rules:
- 2-3 lines MAX for any message. Usually 2.
- Lead with what you DID or what to DO. Not what you observed.
- Never list metrics unless asked. The score speaks for itself.
- Compare to THEIR baseline only. Never population norms.
- Sound like a friend who already handled it. Not a health app.
- "Already on it" energy. Quiet confidence. No filler words.

Safety (non-negotiable):
- Never diagnose medical conditions.
- Never recommend medications.
- Never say "you are stressed" — say "your body is showing stress signals."
- Not a medical device. Emergencies → call 112 / emergency services.`;

  // ─── Mode instructions ────────────────────────────────────────
  const modeInstructions: Record<string, string> = {
    morning_wag:      '\nMode: Morning Wag. Warm, specific, actionable. What changed overnight. One thing to watch. Never start with "Good morning".',
    fetch_alert:      '\nMode: Fetch Alert. Calm, protective. One sentence. Already handled it.',
    evening_review:   '\nMode: Evening Review. Reflective, forward-looking. What the day told you. What tomorrow needs.',
    conversational:   '\nMode: Chat. Answer the question with their data. Be direct. Wit is permitted but never forced.',
    weekly_compaction:'\nMode: Internal compaction. No user-facing output.',
  };

  // ─── Health baselines (system-set, trusted) ───────────────────
  const healthKeys = ['hrv_baseline', 'sleep_avg_7d', 'resting_hr_baseline', 'chronotype', 'sleep_debt', 'last_weekly_summary'];
  const healthContext = Object.entries(memory)
    .filter(([k]) => healthKeys.includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  // ─── User profile from interview (user-supplied, validated at write time) ─
  const profile = opts?.profileMemory ?? {};
  const profileParts: string[] = [];
  if (profile['user_role'])           profileParts.push(`Role: ${profile['user_role']}`);
  if (profile['stress_triggers'])     profileParts.push(`Stress triggers: ${profile['stress_triggers']}`);
  if (profile['daily_pattern'])       profileParts.push(`Daily pattern: ${profile['daily_pattern']}`);
  if (profile['communication_pref']) profileParts.push(`Prefers: ${profile['communication_pref']}`);
  if (profile['primary_goal'])        profileParts.push(`Goal: ${profile['primary_goal']}`);
  const profileContext = profileParts.join('\n');

  // ─── Recent diary entries (episodic memory = MEMORY.md equivalent) ─
  const diaries = opts?.recentDiaries ?? [];
  const diaryContext = diaries.length > 0
    ? '\nRecent memory:\n' + diaries.map((d, i) => `[${i + 1}d ago] ${d}`).join('\n')
    : '';

  return [
    base,
    modeInstructions[mode] ?? '',
    `\n\nUser: ${name}`,
    healthContext   ? '\n\nHealth baselines:\n' + healthContext : '',
    profileContext  ? '\n\nWho they are:\n' + profileContext   : '',
    diaryContext,
  ].join('');
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

function getYesterdayDate(timezone: string): string {
  try {
    const yesterday = new Date(Date.now() - 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(yesterday);
  } catch { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }
}

// ─── Response helper ──────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

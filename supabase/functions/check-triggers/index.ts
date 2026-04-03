/**
 * Waldo — check-triggers Edge Function (multi-user)
 *
 * Called by pg_cron every 15 minutes.
 * Iterates ALL active users with linked Telegram.
 * For each user: checks if Morning Wag, Fetch Alert, or Evening Review should fire.
 * Uses idempotency to prevent duplicate sends on pg_cron retries.
 *
 * Changes from v1:
 * - Concurrent user processing (Promise.allSettled, cap 5) — fixes sequential timeout at 10+ users
 * - Daily Fetch Alert cap (max 3 per user per day)
 * - force_trigger validated against MessageMode enum (was unvalidated string)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkIdempotency } from '../_shared/config.ts';
import type { MessageMode } from '../_shared/soul-file.ts';

const CONCURRENCY_LIMIT = 5;
const MAX_FETCH_ALERTS_PER_DAY = 3;

// Valid values for force_trigger — must match MessageMode
const VALID_TRIGGER_TYPES: readonly MessageMode[] = [
  'morning_wag',
  'fetch_alert',
  'evening_review',
  'conversational',
  'onboarding',
];

function isValidTriggerType(value: string): value is MessageMode {
  return (VALID_TRIGGER_TYPES as readonly string[]).includes(value);
}

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'check-triggers', level, event, ...data }));
}

/** Get current hour:minute in the user's timezone. */
function localTime(timezone: string): { hour: number; minute: number; dateStr: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    return {
      hour: get('hour'),
      minute: get('minute'),
      dateStr: `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`,
    };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), dateStr: now.toISOString().slice(0, 10) };
  }
}

function isWakeWindow(hour: number, minute: number, wakeTime: string): boolean {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  return hour === wakeH && minute >= wakeM && minute < wakeM + 15;
}

function isEveningWindow(hour: number, minute: number, eveningTime: string): boolean {
  const [evH, evM] = eveningTime.split(':').map(Number);
  return hour === evH && minute >= evM && minute < evM + 15;
}

function isQuietHours(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

/** Count how many Fetch Alerts were sent today for this user. */
async function countTodayFetchAlerts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  dateStr: string,
): Promise<number> {
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;
  const { count } = await supabase
    .from('sent_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('trigger_type', 'fetch_alert')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);
  return count ?? 0;
}

/** Evaluate triggers for a single user. Returns trigger type or null. */
async function evaluateUser(
  supabase: ReturnType<typeof createClient>,
  user: {
    id: string;
    timezone: string;
    wake_time_estimate: string;
    preferred_evening_time: string;
    telegram_chat_id: number;
  },
  forceType: MessageMode | null,
): Promise<{ triggerType: MessageMode; reason: string } | null> {
  const { hour, minute, dateStr } = localTime(user.timezone ?? 'UTC');

  if (forceType) {
    return { triggerType: forceType, reason: 'forced' };
  }

  if (isQuietHours(hour)) return null;

  // ─── Morning Wag ──────────────────────────────────────────
  const wakeTime = user.wake_time_estimate ?? '07:00';
  if (isWakeWindow(hour, minute, wakeTime)) {
    const alreadySent = await checkIdempotency(supabase, user.id, 'morning_wag');
    if (!alreadySent) {
      return { triggerType: 'morning_wag', reason: `Wake window ${hour}:${String(minute).padStart(2, '0')} ${user.timezone}` };
    }
  }

  // ─── Evening Review ────────────────────────────────────────
  const eveningTime = user.preferred_evening_time ?? '21:00';
  if (isEveningWindow(hour, minute, eveningTime)) {
    const alreadySent = await checkIdempotency(supabase, user.id, 'evening_review');
    if (!alreadySent) {
      return { triggerType: 'evening_review', reason: `Evening window ${hour}:${String(minute).padStart(2, '0')} ${user.timezone}` };
    }
  }

  // ─── Fetch Alert (stress patrol) ──────────────────────────
  const [{ data: latestCrs }, { data: latestStress }] = await Promise.all([
    supabase
      .from('crs_scores')
      .select('score, zone')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('stress_events')
      .select('confidence, severity')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .order('confidence', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const crsScore = latestCrs?.score ?? 100;
  const stressConf = latestStress?.confidence ?? 0;

  if (crsScore <= 60 || stressConf >= 0.6) {
    // Check 2h idempotency cooldown
    const alreadySent = await checkIdempotency(supabase, user.id, 'fetch_alert', 2 * 60 * 60 * 1000);
    if (!alreadySent) {
      // Check daily cap (max 3 Fetch Alerts per day)
      const todayCount = await countTodayFetchAlerts(supabase, user.id, dateStr);
      if (todayCount < MAX_FETCH_ALERTS_PER_DAY) {
        return {
          triggerType: 'fetch_alert',
          reason: `CRS ${crsScore}, stress confidence ${(stressConf * 100).toFixed(0)}% (${todayCount + 1}/${MAX_FETCH_ALERTS_PER_DAY} today)`,
        };
      } else {
        log('info', 'fetch_alert_daily_cap', { userId: user.id, todayCount, cap: MAX_FETCH_ALERTS_PER_DAY });
      }
    }
  }

  return null;
}

/** Process a batch of users concurrently, respecting the concurrency limit. */
async function processUsersConcurrently(
  users: Array<{
    id: string;
    timezone: string;
    wake_time_estimate: string;
    preferred_evening_time: string;
    telegram_chat_id: number;
  }>,
  supabase: ReturnType<typeof createClient>,
  forceType: MessageMode | null,
): Promise<Array<{ userId: string; triggered: boolean; triggerType?: string; delivered?: boolean; error?: string }>> {
  const results: Array<{ userId: string; triggered: boolean; triggerType?: string; delivered?: boolean; error?: string }> = [];

  // Process in chunks of CONCURRENCY_LIMIT
  for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
    const chunk = users.slice(i, i + CONCURRENCY_LIMIT);

    const settled = await Promise.allSettled(
      chunk.map(user => processOneUser(user, supabase, forceType)),
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        log('error', 'user_chunk_failed', { error: outcome.reason?.message ?? String(outcome.reason) });
        results.push({ userId: 'unknown', triggered: false, error: String(outcome.reason) });
      }
    }
  }

  return results;
}

async function processOneUser(
  user: {
    id: string;
    timezone: string;
    wake_time_estimate: string;
    preferred_evening_time: string;
    telegram_chat_id: number;
  },
  supabase: ReturnType<typeof createClient>,
  forceType: MessageMode | null,
): Promise<{ userId: string; triggered: boolean; triggerType?: string; delivered?: boolean; error?: string }> {
  try {
    const trigger = await evaluateUser(supabase, user, forceType);

    if (!trigger) {
      return { userId: user.id, triggered: false };
    }

    log('info', 'trigger_fired', { userId: user.id, trigger: trigger.triggerType, reason: trigger.reason });

    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        trigger_type: trigger.triggerType,
        channel: 'telegram',
      }),
    });

    const agentResult = await agentResponse.json();
    const message = agentResult.message;

    if (!message) {
      log('warn', 'no_message', { userId: user.id, trigger: trigger.triggerType, error: agentResult.error });
      return { userId: user.id, triggered: true, triggerType: trigger.triggerType, delivered: false, error: agentResult.error };
    }

    const telegramUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot/send`;
    const sendResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        chat_id: user.telegram_chat_id,
        message,
        user_id: user.id,
        trigger_type: trigger.triggerType,
      }),
    });

    const sendResult = await sendResponse.json();
    const delivered = sendResult.ok === true && sendResult.skipped !== true;

    log('info', 'delivery_complete', {
      userId: user.id,
      trigger: trigger.triggerType,
      delivered,
      skipped: sendResult.skipped ?? false,
      zone: agentResult.zone,
    });

    return { userId: user.id, triggered: true, triggerType: trigger.triggerType, delivered };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log('error', 'user_process_failed', { userId: user.id, error: errMsg });
    return { userId: user.id, triggered: false, error: errMsg };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const startMs = Date.now();

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const forceUserId: string | null = body.user_id ?? null;

    // Validate force_trigger against allowed enum values — reject unknown strings
    let forceType: MessageMode | null = null;
    if (body.force_trigger != null) {
      if (!isValidTriggerType(String(body.force_trigger))) {
        return new Response(
          JSON.stringify({ error: `Invalid force_trigger: "${body.force_trigger}". Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      forceType = body.force_trigger as MessageMode;
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const query = supabase
      .from('users')
      .select('id, timezone, wake_time_estimate, preferred_evening_time, telegram_chat_id')
      .eq('active', true)
      .eq('onboarding_complete', true)
      .not('telegram_chat_id', 'is', null);

    if (forceUserId) query.eq('id', forceUserId);

    const { data: users, error: usersError } = await query;

    if (usersError) {
      log('error', 'users_fetch_failed', { error: usersError.message });
      return new Response(JSON.stringify({ error: usersError.message }), { status: 500 });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ triggered: false, reason: 'No active users with Telegram linked' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    log('info', 'checking_users', { count: users.length, concurrency: CONCURRENCY_LIMIT });

    const results = await processUsersConcurrently(
      users as Array<{ id: string; timezone: string; wake_time_estimate: string; preferred_evening_time: string; telegram_chat_id: number }>,
      supabase,
      forceType,
    );

    const latencyMs = Date.now() - startMs;
    const triggered = results.filter(r => r.triggered);
    const delivered = results.filter(r => r.delivered);

    log('info', 'run_complete', {
      total_users: users.length,
      triggered: triggered.length,
      delivered: delivered.length,
      latency_ms: latencyMs,
    });

    return new Response(JSON.stringify({
      total_users: users.length,
      triggered: triggered.length,
      delivered: delivered.length,
      latency_ms: latencyMs,
      results,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    log('error', 'run_failed', { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

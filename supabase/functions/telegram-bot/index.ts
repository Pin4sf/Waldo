/**
 * Waldo Telegram Bot — multi-user webhook handler
 *
 * Routing:
 *   /start              → prompt user to send their 6-digit linking code
 *   6-digit number      → linking flow (matches user to their Waldo)
 *   any other text      → look up user by chat_id → invoke-agent
 *   👍/👎 callback      → feedback signal → agent_evolutions
 *   POST /send          → proactive delivery (called by check-triggers)
 */
import { Bot, webhookCallback, InlineKeyboard } from 'https://deno.land/x/grammy@v1.31.3/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getUserByChatId, checkIdempotency, recordSent } from '../_shared/config.ts';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'telegram-bot', level, event, ...data }));
}

const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is unset');

const bot = new Bot(token);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── /start ────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  log('info', 'start_command', { chatId, username: ctx.from?.username });

  // Check if already linked
  const existing = await getUserByChatId(supabase, chatId);
  if (existing) {
    await ctx.reply("Already on it. You're linked. Just talk to me anytime.");
    return;
  }

  await ctx.reply(
    "Hey — I'm Waldo.\n\n" +
    "Open the Waldo app, tap \"Link Telegram\", and send me the 6-digit code it gives you."
  );
});

// ─── 6-digit linking code ──────────────────────────────────────
bot.hears(/^\d{6}$/, async (ctx) => {
  const chatId = ctx.chat.id;
  const code = ctx.message.text.trim();
  log('info', 'linking_attempt', { chatId, code });

  // Check if already linked
  const existing = await getUserByChatId(supabase, chatId);
  if (existing) {
    await ctx.reply("You're already linked. Just talk to me.");
    return;
  }

  // Look up linking code
  const { data: linkCode, error } = await supabase
    .from('telegram_linking_codes')
    .select('user_id, expires_at, used')
    .eq('code', code)
    .maybeSingle();

  if (!linkCode || linkCode.used) {
    await ctx.reply("That code isn't valid. Open the Waldo app and tap \"Link Telegram\" for a fresh one.");
    return;
  }

  if (new Date(linkCode.expires_at) < new Date()) {
    await ctx.reply("That code expired — they're only good for 10 minutes. Open the app for a new one.");
    return;
  }

  // Link the Telegram chat to this user
  const { error: linkError } = await supabase
    .from('users')
    .update({ telegram_chat_id: chatId })
    .eq('id', linkCode.user_id);

  if (linkError) {
    log('error', 'link_failed', { chatId, error: linkError.message });
    await ctx.reply("Something went wrong linking your account. Try again in a moment.");
    return;
  }

  // Mark code as used
  await supabase
    .from('telegram_linking_codes')
    .update({ used: true })
    .eq('code', code);

  log('info', 'user_linked', { chatId, userId: linkCode.user_id });

  const { data: user } = await supabase
    .from('users')
    .select('onboarding_complete, name, wake_time_estimate')
    .eq('id', linkCode.user_id)
    .single();

  if (user?.name) {
    // User completed app onboarding — name is already set. Mark complete + welcome them.
    await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', linkCode.user_id);

    const wakeTime = user.wake_time_estimate ?? '07:00';
    await ctx.reply(
      `Linked, ${user.name}. Already on it.\n\n` +
      `Your first Morning Wag arrives tomorrow at ${wakeTime}.\n\n` +
      `Until then — ask me anything about your health data.`
    );
  } else {
    // No name set — user skipped app onboarding. Interview via Telegram.
    await ctx.reply(
      "Linked. Let's get you set up.\n\n" +
      "I'm Waldo — I read your body signals and act before you have to ask. " +
      "Not a medical device, nothing I say is medical advice.\n\n" +
      "First — what's your name?"
    );
  }
});

// ─── /status ───────────────────────────────────────────────────
bot.command('status', async (ctx) => {
  const chatId = ctx.chat.id;
  const user = await getUserByChatId(supabase, chatId);
  if (!user) {
    await ctx.reply("Not linked yet. Open the Waldo app and tap \"Link Telegram\".");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: crs }, { data: syncLogs }] = await Promise.all([
    supabase.from('crs_scores').select('score, zone').eq('user_id', user.id).eq('date', today).maybeSingle(),
    supabase.from('sync_log').select('provider, last_sync_at, last_sync_status').eq('user_id', user.id),
  ]);

  let lines = [`*Waldo Status*\n`];
  if (crs) {
    const zoneEmoji = crs.zone === 'peak' ? '🟢' : crs.zone === 'moderate' ? '🟡' : '🔴';
    lines.push(`${zoneEmoji} Nap Score: ${crs.score} (${crs.zone})`);
  } else {
    lines.push(`⚪ No Nap Score yet today`);
  }
  lines.push('');

  const providers = syncLogs ?? [];
  const calSync = providers.find(s => s.provider === 'google_calendar');
  const gmailSync = providers.find(s => s.provider === 'gmail');
  const tasksSync = providers.find(s => s.provider === 'google_tasks');

  const syncStatus = (s: { last_sync_status: string; last_sync_at: string | null } | undefined, label: string) => {
    if (!s || s.last_sync_status === 'no_token') return `○ ${label}: not connected`;
    const when = s.last_sync_at ? new Date(s.last_sync_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : 'never';
    const ok = s.last_sync_status === 'ok';
    return `${ok ? '✓' : '✗'} ${label}: ${ok ? `synced ${when}` : s.last_sync_status}`;
  };

  lines.push(syncStatus(calSync, 'Calendar'));
  lines.push(syncStatus(gmailSync, 'Gmail'));
  lines.push(syncStatus(tasksSync, 'Tasks'));

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
});

// ─── /connect ──────────────────────────────────────────────────
bot.command('connect', async (ctx) => {
  const chatId = ctx.chat.id;
  const user = await getUserByChatId(supabase, chatId);
  if (!user) {
    await ctx.reply("Link your account first. Open the Waldo app and tap \"Link Telegram\".");
    return;
  }

  const connectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-google/connect?user_id=${user.id}&scopes=calendar,gmail,tasks`;
  const keyboard = new InlineKeyboard().url('Connect Google Workspace', connectUrl);
  await ctx.reply(
    "Connect Google to give Waldo calendar context, email load, and task pressure:\n\n" +
    "• Google Calendar — meeting density, focus gaps\n" +
    "• Gmail — volume & after-hours activity (no body content)\n" +
    "• Google Tasks — deadline pressure",
    { reply_markup: keyboard }
  );
});

// ─── /morning ──────────────────────────────────────────────────
bot.command('morning', async (ctx) => {
  const chatId = ctx.chat.id;
  const user = await getUserByChatId(supabase, chatId);
  if (!user) {
    await ctx.reply("Not linked yet. Open the Waldo app to get started.");
    return;
  }

  await ctx.replyWithChatAction('typing');

  const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
  const response = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ user_id: user.id, trigger_type: 'morning_wag', channel: 'telegram' }),
  });
  const result = await response.json();

  const keyboard = new InlineKeyboard()
    .text('👍', `fb_pos:${user.id}`)
    .text('👎', `fb_neg:${user.id}`);

  await ctx.reply(result.message ?? 'Something went wrong.', { reply_markup: keyboard });
});

// ─── Any text message → look up user → invoke agent ──────────
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const question = ctx.message.text;
  log('info', 'user_message', { chatId, length: question.length, username: ctx.from?.username });

  const user = await getUserByChatId(supabase, chatId);
  if (!user) {
    await ctx.reply("I don't have you linked yet. Open the Waldo app and tap \"Link Telegram\" to get started.");
    return;
  }

  await ctx.replyWithChatAction('typing');

  const triggerType = user.onboarding_complete ? 'conversational' : 'onboarding';

  try {
    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        trigger_type: triggerType,
        question,
        channel: 'telegram',
      }),
    });

    const result = await response.json();
    log('info', 'agent_response', {
      userId: user.id, zone: result.zone,
      tokens_in: result.tokens_in, tokens_out: result.tokens_out,
      fallback: result.fallback ?? false,
    });

    const keyboard = new InlineKeyboard()
      .text('👍', `fb_pos:${user.id}`)
      .text('👎', `fb_neg:${user.id}`);

    await ctx.reply(result.message ?? result.error ?? 'Something went wrong.', {
      reply_markup: keyboard,
    });
  } catch (err) {
    log('error', 'agent_call_failed', { error: err instanceof Error ? err.message : String(err), userId: user.id });
    await ctx.reply("I'm having trouble connecting right now. I'll check in again soon.");
  }
});

// ─── Feedback callbacks ────────────────────────────────────────
bot.callbackQuery(/^fb_pos:(.+)$/, async (ctx) => {
  const userId = ctx.match![1];
  await ctx.answerCallbackQuery({ text: 'Noted.' });
  await supabase.from('agent_evolutions').insert({
    user_id: userId,
    source: 'positive_signal',
    context: 'User gave 👍 on Telegram message',
    change_type: 'confirmation',
    change_value: { signal: 'positive' },
  });
});

bot.callbackQuery(/^fb_neg:(.+)$/, async (ctx) => {
  const userId = ctx.match![1];
  await ctx.answerCallbackQuery({ text: 'Got it. I\'ll adjust.' });
  await supabase.from('agent_evolutions').insert({
    user_id: userId,
    source: 'negative_feedback',
    context: 'User gave 👎 on Telegram message',
    change_type: 'needs_review',
    change_value: { signal: 'negative' },
  });
});

bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ─── Webhook handler + /send endpoint ─────────────────────────
const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Proactive message delivery (called by check-triggers)
    if (url.pathname.endsWith('/send') && req.method === 'POST') {
      const { chat_id, message, user_id, trigger_type } = await req.json();
      if (!chat_id || !message) {
        return new Response(JSON.stringify({ error: 'Missing chat_id or message' }), { status: 400 });
      }

      // Idempotency check
      if (user_id && trigger_type) {
        const alreadySent = await checkIdempotency(supabase, user_id, trigger_type);
        if (alreadySent) {
          log('info', 'idempotency_skip', { user_id, trigger_type });
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const keyboard = new InlineKeyboard()
        .text('👍', `fb_pos:${user_id ?? 'unknown'}`)
        .text('👎', `fb_neg:${user_id ?? 'unknown'}`);

      await bot.api.sendMessage(chat_id, message, { reply_markup: keyboard });

      // Record delivery
      if (user_id && trigger_type) {
        await recordSent(supabase, user_id, trigger_type, 'telegram', message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Telegram webhook (validate secret token)
    if (url.searchParams.get('secret') !== token) {
      return new Response('not allowed', { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('ok'); // Always 200 to Telegram to prevent retries
  }
});

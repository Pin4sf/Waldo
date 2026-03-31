/**
 * Waldo Telegram Bot — webhook handler
 *
 * Handles incoming Telegram messages and callback queries.
 * Routes to invoke-agent for Claude responses.
 * Sends proactive messages (called by check-triggers).
 */
import { Bot, webhookCallback, InlineKeyboard } from 'https://deno.land/x/grammy@v1.31.3/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

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

log('info', 'bot_initialized');

// ─── Save telegram chat ID on first /start ────────────────────
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  log('info', 'start_command', { chatId, username: ctx.from?.username });

  // Save chat ID to user record
  const { error } = await supabase
    .from('users')
    .update({ telegram_chat_id: chatId })
    .eq('id', DEMO_USER_ID);

  if (error) log('error', 'save_chat_id_failed', { error: error.message });
  else log('info', 'chat_id_saved', { chatId });

  await ctx.reply(
    "Already on it. I'm Waldo.\n\n" +
    "I read your body signals, your calendar, your email patterns, and your tasks. " +
    "I'll message you every morning with your Nap Score and what to do about it.\n\n" +
    "Just talk to me anytime. I know your data."
  );
});

// ─── Handle user messages → invoke agent ──────────────────────
bot.on('message:text', async (ctx) => {
  const question = ctx.message.text;
  const chatId = ctx.chat.id;
  const startMs = Date.now();
  log('info', 'user_message', { chatId, question: question.slice(0, 100), username: ctx.from?.username });

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    // Call invoke-agent Edge Function
    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
    log('info', 'calling_agent', { url: agentUrl, trigger: 'conversational' });

    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: DEMO_USER_ID,
        trigger_type: 'conversational',
        question,
        channel: 'telegram',
      }),
    });

    const result = await response.json();
    const latencyMs = Date.now() - startMs;
    log('info', 'agent_response', {
      status: response.status,
      zone: result.zone,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      latency_ms: latencyMs,
      fallback: result.fallback ?? false,
    });

    // Send response with feedback buttons
    const keyboard = new InlineKeyboard()
      .text('👍', 'feedback_positive')
      .text('👎', 'feedback_negative');

    await ctx.reply(result.message ?? result.error ?? 'Something went wrong.', {
      reply_markup: keyboard,
    });
    log('info', 'message_sent', { chatId, latency_ms: latencyMs });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log('error', 'agent_call_failed', { error: errMsg, chatId });
    await ctx.reply("I'm having trouble connecting right now. I'll check in again soon.");
  }
});

// ─── Handle feedback buttons ──────────────────────────────────
bot.callbackQuery('feedback_positive', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Noted. Waldo learns from this.' });

  await supabase.from('agent_evolutions').insert({
    user_id: DEMO_USER_ID,
    source: 'positive_signal',
    context: 'User gave 👍 on Telegram message',
    change_type: 'confirmation',
    change_value: { signal: 'positive' },
  });
});

bot.callbackQuery('feedback_negative', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Got it. Waldo will adjust.' });

  await supabase.from('agent_evolutions').insert({
    user_id: DEMO_USER_ID,
    source: 'negative_feedback',
    context: 'User gave 👎 on Telegram message',
    change_type: 'needs_review',
    change_value: { signal: 'negative' },
  });
});

// Catch-all for unhandled callbacks
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ─── Webhook handler ──────────────────────────────────────────
const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Proactive message endpoint (called by check-triggers)
    if (url.pathname.endsWith('/send') && req.method === 'POST') {
      const { chat_id, message } = await req.json();
      if (!chat_id || !message) {
        return new Response(JSON.stringify({ error: 'Missing chat_id or message' }), { status: 400 });
      }

      const keyboard = new InlineKeyboard()
        .text('👍', 'feedback_positive')
        .text('👎', 'feedback_negative');

      await bot.api.sendMessage(chat_id, message, { reply_markup: keyboard });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Telegram webhook (validate secret)
    if (url.searchParams.get('secret') !== token) {
      return new Response('not allowed', { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('ok'); // Always return 200 to Telegram to prevent retries
  }
});

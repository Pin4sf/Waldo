/**
 * Waldo — whatsapp-bot Edge Function
 *
 * WhatsApp Business Cloud API webhook handler.
 * Same architecture as telegram-bot but for WhatsApp.
 *
 * Setup (Meta Developer Console):
 * 1. Create a Meta App at developers.facebook.com
 * 2. Add WhatsApp product → Business Account
 * 3. Webhook URL: https://<project>.supabase.co/functions/v1/whatsapp-bot
 * 4. Verify token: set as WHATSAPP_VERIFY_TOKEN in Supabase secrets
 * 5. Subscribe to: messages, message_reactions
 *
 * Required Supabase Secrets:
 *   WHATSAPP_VERIFY_TOKEN    — webhook verification token (you choose)
 *   WHATSAPP_ACCESS_TOKEN    — Meta System User Access Token (permanent)
 *   WHATSAPP_PHONE_NUMBER_ID — From Meta dashboard (phone number to send from)
 *
 * User linking: same 6-digit code pattern as Telegram.
 * Users DM the bot on WhatsApp → send /start → get prompted for linking code.
 *
 * Commands:
 *   /start   → explains linking
 *   /status  → Nap Score + integration status
 *   /morning → manual Morning Wag
 *   [6 digits] → link account
 *   [text]   → Waldo conversational response
 *
 * Routes:
 *   GET /whatsapp-bot  → webhook verification (Meta requires this)
 *   POST /whatsapp-bot → incoming message handler
 *   POST /whatsapp-bot/send → proactive delivery (called by check-triggers)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getUserByChatId, checkIdempotency, recordSent } from '../_shared/config.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'whatsapp-bot', level, event, ...data }));
}

// ─── WhatsApp API helpers ──────────────────────────────────────

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) {
    log('error', 'missing_whatsapp_config');
    return;
  }

  await fetch(`${WHATSAPP_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
}

// ─── Incoming message handler ──────────────────────────────────

async function handleIncomingMessage(
  supabase: ReturnType<typeof createClient>,
  from: string,    // WhatsApp phone number (e.g. "919876543210")
  text: string,
): Promise<void> {
  const normalizedPhone = from.replace(/\D/g, '');

  // Check if user is linked (using telegram_chat_id column as the phone number for WhatsApp users)
  // For a proper implementation, add a whatsapp_phone column to users table.
  // For now, use the linking code pattern.

  const trimmed = text.trim();

  // /start command
  if (trimmed.toLowerCase() === '/start') {
    await sendWhatsAppMessage(from,
      "Hey — I'm Waldo.\n\n" +
      "Open the Waldo app, go to Profile → Link WhatsApp, and send me the 6-digit code it shows you."
    );
    return;
  }

  // 6-digit linking code
  if (/^\d{6}$/.test(trimmed)) {
    const { data: linkCode } = await supabase
      .from('telegram_linking_codes')  // reusing same table
      .select('user_id, expires_at, used')
      .eq('code', trimmed)
      .maybeSingle();

    if (!linkCode || linkCode.used) {
      await sendWhatsAppMessage(from, "That code isn't valid. Get a fresh one from the Waldo app.");
      return;
    }

    if (new Date(linkCode.expires_at) < new Date()) {
      await sendWhatsAppMessage(from, "That code expired (10 minutes). Open the app for a new one.");
      return;
    }

    // Store WhatsApp phone in user metadata (core_memory)
    await supabase.from('core_memory').upsert({
      user_id: linkCode.user_id,
      key: 'whatsapp_phone',
      value: normalizedPhone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });

    await supabase.from('telegram_linking_codes').update({ used: true }).eq('code', trimmed);

    const { data: user } = await supabase.from('users').select('name').eq('id', linkCode.user_id).maybeSingle();
    await sendWhatsAppMessage(from, `Linked${user?.name ? `, ${user.name}` : ''}. Already on it.\n\nYou'll get your Morning Wag here tomorrow at your wake time.`);
    return;
  }

  // Find user by WhatsApp phone via core_memory
  const { data: memRow } = await supabase
    .from('core_memory')
    .select('user_id')
    .eq('key', 'whatsapp_phone')
    .eq('value', normalizedPhone)
    .maybeSingle();

  if (!memRow) {
    await sendWhatsAppMessage(from, "I don't have you linked yet. Send /start to get started.");
    return;
  }

  const userId = memRow.user_id;

  // /status command
  if (trimmed.toLowerCase() === '/status') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: crs } = await supabase.from('crs_scores').select('score, zone').eq('user_id', userId).eq('date', today).maybeSingle();
    const score = crs ? `Nap Score: ${crs.score} (${crs.zone})` : 'No Nap Score yet today';
    await sendWhatsAppMessage(from, `${score}\n\nSend /morning for your Morning Wag.`);
    return;
  }

  // /morning command
  if (trimmed.toLowerCase() === '/morning') {
    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ user_id: userId, trigger_type: 'morning_wag', channel: 'whatsapp' }),
    });
    const result = await response.json();
    await sendWhatsAppMessage(from, result.message ?? 'Something went wrong. Try again in a moment.');
    return;
  }

  // Conversational — call invoke-agent
  const { data: recentCrs } = await supabase.from('crs_scores').select('date').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(1).single();
  const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
  const response = await fetch(agentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ user_id: userId, trigger_type: 'conversational', question: text, date: recentCrs?.date, channel: 'whatsapp' }),
  });
  const result = await response.json();
  await sendWhatsAppMessage(from, result.message ?? "I had trouble with that. Try again in a moment.");

  // Save to conversation_history
  await supabase.from('conversation_history').insert([
    { user_id: userId, role: 'user', content: text, mode: 'conversational', channel: 'whatsapp' },
    { user_id: userId, role: 'waldo', content: result.message, mode: 'conversational', channel: 'whatsapp' },
  ]);
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Meta webhook verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Proactive delivery endpoint (POST /whatsapp-bot/send)
  if (url.pathname.endsWith('/send') && req.method === 'POST') {
    const { phone, message, user_id, trigger_type } = await req.json();
    if (!phone || !message) return new Response(JSON.stringify({ error: 'Missing phone or message' }), { status: 400 });
    await sendWhatsAppMessage(phone, message);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Incoming message (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages ?? [];

      for (const msg of messages) {
        if (msg.type !== 'text') continue;
        const from: string = msg.from;
        const text: string = msg.text?.body ?? '';
        log('info', 'incoming_message', { from: from.slice(0, 6) + '***', textLength: text.length });
        await handleIncomingMessage(supabase, from, text);
      }
    } catch (err) {
      log('error', 'handler_error', { error: err instanceof Error ? err.message : String(err) });
    }
    return new Response('ok', { status: 200 }); // Always 200 to WhatsApp to prevent retries
  }

  return new Response('Not found', { status: 404 });
});

# OneSync — Messaging Architecture

Last updated: March 6, 2026

---

## Channels

| Channel | Library/SDK | Runtime | Why |
|---------|------------|---------|-----|
| Telegram | grammY | Deno (Supabase Edge Functions native) | Free, instant setup, rich formatting, no approval needed |
| WhatsApp | Raw HTTP (Cloud API v21.0) | Deno | 2.9B users, enterprise credibility, most people's default messenger |

---

## Telegram (grammY)

### Setup

1. Message @BotFather on Telegram
2. `/newbot` → get bot token
3. Set webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook`
   - URL: `https://<project>.supabase.co/functions/v1/telegram-webhook`
4. grammY handles parsing, middleware, reply

### grammY in Edge Functions

```typescript
import { Bot, webhookCallback } from "https://deno.land/x/grammy/mod.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN")!);

bot.on("message:text", async (ctx) => {
  const userId = await resolveUser(ctx.from.id, "telegram");
  const response = await processMessage(userId, ctx.message.text, "telegram");
  await ctx.reply(response);
});

// Edge Function handler
Deno.serve(webhookCallback(bot, "std/http"));
```

### Features

- **Markdown formatting**: `*bold*`, `_italic_`, `` `code` ``
- **Inline keyboards**: Buttons for feedback ("Was this helpful?")
- **No rate limits** for bot messages (practical, not theoretical)
- **No approval process** for bots
- **Group support**: Can work in group chats (future feature)

---

## WhatsApp (Cloud API)

### Setup

1. Create Meta Business App at developers.facebook.com
2. Add WhatsApp product
3. Get temporary access token (lasts 24h) for development
4. Generate permanent System User token for production
5. Set webhook URL: `https://<project>.supabase.co/functions/v1/whatsapp-webhook`
6. Subscribe to `messages` webhook field

### Webhook Verification

WhatsApp requires GET verification before POST messages flow:

```typescript
// GET handler for webhook verification
if (req.method === "GET") {
  const params = new URL(req.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}
```

### Sending Messages

```typescript
async function sendWhatsAppMessage(phoneNumber: string, text: string) {
  await fetch(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: text },
      }),
    }
  );
}
```

### Proactive Messaging — The 24-Hour Rule

**Within 24 hours** of user's last message: Can send any free-form text (free).

**Outside 24 hours**: Must use pre-approved **template messages** (UTILITY category).

```typescript
// Template message for proactive outreach
async function sendWhatsAppTemplate(phoneNumber: string, templateName: string, params: string[]) {
  await fetch(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: params.map(p => ({ type: "text", text: p })),
          }],
        },
      }),
    }
  );
}
```

### Template Messages (Pre-Approved)

Design templates to prompt a reply (which re-opens the free-form 24-hour window):

| Template Name | Category | Body | Purpose |
|---------------|----------|------|---------|
| `stress_checkin` | UTILITY | "Hey {{1}}, I noticed some changes in your vitals. How are you feeling? Reply to let me know." | Stress alert |
| `morning_brief` | UTILITY | "Good morning {{1}}! Your sleep score was {{2}}/100 last night. Want your full morning briefing?" | Morning brief |
| `weekly_summary` | UTILITY | "{{1}}, your weekly health summary is ready. Reply 'yes' to see it." | Weekly report |
| `inactivity_nudge` | UTILITY | "Hey {{1}}, you've been sitting for {{2}} hours. A short walk might help. Reply if you'd like a suggestion." | Movement nudge |

### Pricing (Post-July 2025)

- **Service conversations** (user-initiated): **Free**
- **Utility templates** (business-initiated): ~$0.005-0.02 per message (varies by country)
- **Marketing templates**: Higher cost, not used by OneSync
- First 1,000 service conversations/month: Free

---

## Unified Messaging Abstraction

```typescript
interface MessageChannel {
  send(userId: string, text: string): Promise<void>;
  sendTemplate(userId: string, template: string, params: string[]): Promise<void>;
  supportsRichFormatting(): boolean;
  getChannelId(): string;
}

class TelegramChannel implements MessageChannel {
  async send(userId: string, text: string) {
    const chatId = await getChatId(userId, "telegram");
    await bot.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }
  // ...
}

class WhatsAppChannel implements MessageChannel {
  async send(userId: string, text: string) {
    const phone = await getPhone(userId, "whatsapp");
    const lastMsg = await getLastMessageTime(userId, "whatsapp");
    const withinWindow = Date.now() - lastMsg.getTime() < 24 * 60 * 60 * 1000;

    if (withinWindow) {
      await sendWhatsAppMessage(phone, text);
    } else {
      // Must use template — fall back to generic check-in
      await sendWhatsAppTemplate(phone, "stress_checkin", [userName]);
    }
  }
  // ...
}
```

### Message Router

```typescript
async function routeMessage(userId: string, message: string, priority: 'low' | 'normal' | 'high') {
  const prefs = await getUserPreferences(userId);

  // Determine channel
  let channel: MessageChannel;
  if (priority === 'high' && prefs.whatsappLinked) {
    channel = new WhatsAppChannel(); // WhatsApp for urgent (more likely to be seen)
  } else if (prefs.preferredChannel === 'telegram') {
    channel = new TelegramChannel();
  } else {
    channel = new WhatsAppChannel();
  }

  // Enqueue for reliability
  await enqueueMessage(userId, channel.getChannelId(), message, priority);
}
```

---

## Message Queue (Supabase Queues / pgmq)

### Why Queue?

- Edge Functions can fail (cold start timeout, API error)
- WhatsApp rate limits (80 messages/second for business)
- Telegram occasionally has API downtime
- Need retry logic without losing messages

### Setup

```sql
-- Enable pgmq extension in Supabase
select pgmq.create('outbound_messages');

-- Enqueue a message
select pgmq.send(
  'outbound_messages',
  jsonb_build_object(
    'user_id', '123',
    'channel', 'telegram',
    'text', 'Your HRV has recovered nicely!',
    'priority', 'normal',
    'created_at', now()
  )
);
```

### Consumer (message-sender Edge Function)

```typescript
// Triggered by pg_cron every 10 seconds, or by pg_notify
async function processQueue() {
  const messages = await pgmq.read('outbound_messages', 10); // batch of 10

  for (const msg of messages) {
    try {
      const channel = getChannel(msg.body.channel);
      await channel.send(msg.body.user_id, msg.body.text);
      await pgmq.delete('outbound_messages', msg.msg_id);
    } catch (error) {
      // Message stays in queue for retry
      // pgmq handles visibility timeout (message reappears after 30s)
      console.error(`Failed to send message ${msg.msg_id}:`, error);
    }
  }
}
```

### Dead Letter Queue

After 3 failed attempts, move to dead letter queue:

```sql
select pgmq.create('dead_letters');

-- In consumer: check read_ct (read count)
-- If msg.read_ct > 3, move to dead_letters
```

---

## 5 Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `telegram-webhook` | Telegram webhook POST | Receive user messages, route to message-processor |
| `whatsapp-webhook` | WhatsApp webhook GET/POST | Verify webhook + receive messages, route to message-processor |
| `message-processor` | Called by webhook functions | Run Claude agent loop, generate response, enqueue reply |
| `message-sender` | pg_cron (every 10s) | Dequeue and deliver outbound messages |
| `proactive-scheduler` | pg_cron (every 15 min) | Check if any proactive message is warranted |

### Flow: User Message

```
User sends "How did I sleep?" on Telegram
  --> telegram-webhook receives
  --> Calls message-processor Edge Function (invoke)
  --> message-processor:
      1. Resolve user from telegram_id
      2. Load context (last 10 messages, core memory)
      3. Run agent loop (Sonnet model)
      4. Agent calls get_sleep_summary tool
      5. Agent generates response
      6. Enqueue response to outbound_messages queue
  --> message-sender picks up from queue
  --> Delivers via Telegram bot API
  --> Saves exchange to conversation_history
```

### Flow: Proactive Stress Alert

```
Background sync writes new health data to PowerSync/Supabase
  --> pg_cron triggers check-triggers Edge Function
  --> check-triggers evaluates multi-signal stress gate
  --> If triggered: calls message-processor with trigger_type='stress_detected'
  --> message-processor runs agent loop (Sonnet/Opus based on severity)
  --> Agent reads biometrics, calendar, generates contextual message
  --> Enqueue to outbound_messages with priority='high'
  --> message-sender delivers immediately
```

---

## Auth Linking (Telegram/WhatsApp to Supabase User)

### Problem

User authenticates in the React Native app via Supabase Auth. But Telegram/WhatsApp bots don't know which Supabase user they are.

### Solution: 6-Digit Linking Code

```
1. User opens OneSync app → goes to Settings → Link Telegram/WhatsApp
2. App generates 6-digit code, stores in linking_codes table (expires 5 min)
3. User sends code to the bot: "/link 482917"
4. Bot looks up code in linking_codes table
5. If valid and not expired: stores mapping (telegram_chat_id → user_id)
6. User is now linked
```

```sql
create table linking_codes (
  code text primary key,
  user_id uuid references auth.users(id),
  channel text not null, -- 'telegram' or 'whatsapp'
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '5 minutes',
  used boolean default false
);

create table channel_links (
  user_id uuid references auth.users(id),
  channel text not null,
  channel_user_id text not null, -- telegram chat_id or whatsapp phone
  linked_at timestamptz default now(),
  primary key (user_id, channel)
);
```

---

## Webhook Security

### Telegram

Telegram doesn't sign webhooks. Security via:
1. Secret token in webhook URL path: `/functions/v1/telegram-webhook?token=<SECRET>`
2. Or use `X-Telegram-Bot-Api-Secret-Token` header (set during webhook registration)

### WhatsApp

Meta signs webhooks with `X-Hub-Signature-256` header:

```typescript
import { createHmac } from "node:crypto";

function verifyWhatsAppSignature(body: string, signature: string): boolean {
  const expected = createHmac("sha256", APP_SECRET)
    .update(body)
    .digest("hex");
  return `sha256=${expected}` === signature;
}
```

### Additional Security

- All Edge Functions check `Authorization` header for inter-function calls
- Rate limit: max 10 messages per minute per user (prevents abuse)
- Input sanitization: strip potential injection in user messages before passing to Claude

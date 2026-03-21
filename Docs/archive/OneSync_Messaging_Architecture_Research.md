# OneSync Messaging Architecture Research
## Dual Telegram + WhatsApp Bot for AI Health Agent

**Date**: 2026-03-06
**Status**: Research / Architecture Design

---

## Table of Contents

1. [Telegram Bot API Architecture](#1-telegram-bot-api-architecture)
2. [WhatsApp Cloud API Architecture](#2-whatsapp-cloud-api-architecture)
3. [Unified Message Abstraction](#3-unified-message-abstraction)
4. [Proactive Messaging Patterns](#4-proactive-messaging-patterns)
5. [Interactive Health Feedback UX](#5-interactive-health-feedback-ux)
6. [Webhook Security](#6-webhook-security)
7. [Message Queuing and Delivery Guarantees](#7-message-queuing-and-delivery-guarantees)
8. [Recommended Architecture](#8-recommended-architecture)

---

## 1. Telegram Bot API Architecture

### Library Choice: grammY (Recommended)

Use **grammY** — the Telegram Bot Framework that runs natively on Deno and has first-class Supabase Edge Functions support. It is well-documented, actively maintained, and handles all Telegram API complexity.

**Do NOT use raw HTTP calls.** grammY handles serialization, error handling, retry logic, file uploads, and webhook callback parsing. Raw HTTP would mean reimplementing all of this.

Import for Deno/Edge Functions:
```typescript
import { Bot, webhookCallback, InlineKeyboard } from "https://deno.land/x/grammy/mod.ts";
```

### Webhook Setup Pattern

```typescript
import { Bot, webhookCallback } from "https://deno.land/x/grammy/mod.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN")!);

// Register handlers
bot.command("start", (ctx) => ctx.reply("Welcome to OneSync Health!"));

// Create webhook handler (NOT bot.start() — this is serverless)
const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Verify request is from Telegram (secret in query param)
  if (url.searchParams.get("secret") !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return await handleUpdate(req);
});
```

**Deployment:**
```bash
supabase functions deploy telegram-bot --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_WEBHOOK_SECRET=my-secret
```

**Register webhook with Telegram:**
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.supabase.co/functions/v1/telegram-bot?secret=<WEBHOOK_SECRET>&secret_token=<SECRET_TOKEN>
```

The `--no-verify-jwt` flag is required because Telegram sends webhooks without Supabase JWT tokens.

### Handling Different Update Types

```typescript
// Text messages
bot.on("message:text", async (ctx) => {
  const userMessage = ctx.message.text;
  const userId = ctx.from.id;
  // Route to AI agent
});

// Callback queries from inline keyboards
bot.callbackQuery(/^feedback_/, async (ctx) => {
  const data = ctx.callbackQuery.data; // e.g., "feedback_good"
  await ctx.answerCallbackQuery({ text: "Recorded!" });
  // Store in Supabase
});

// Catch-all for unhandled callbacks (MUST always answer to clear loading spinner)
bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery();
});
```

### Sending Rich Messages with Buttons

```typescript
// Inline keyboard with buttons
const keyboard = new InlineKeyboard()
  .text("Good", "mood_good").text("Okay", "mood_okay").text("Bad", "mood_bad").row()
  .text("Skip", "mood_skip");

await bot.api.sendMessage(chatId, "*How are you feeling today?*", {
  parse_mode: "MarkdownV2",
  reply_markup: keyboard,
});
```

### Rate Limiting

Telegram enforces:
- 30 messages/second to different chats
- 1 message/second to the same chat
- 20 messages/minute to the same group

grammY has an `auto-retry` plugin and a `transformer-throttler` plugin that handles this:
```typescript
import { autoRetry } from "https://deno.land/x/grammy_auto_retry/mod.ts";
bot.api.config.use(autoRetry());
```

---

## 2. WhatsApp Cloud API Architecture

### Webhook Setup (Two Phases)

**Phase 1: Verification (GET request)**

Meta sends a GET request to verify your webhook endpoint. You must respond with the `hub.challenge` value:

```typescript
Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Webhook verification
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    // Incoming message handling
    // Verify signature first (see Security section)
    const body = await req.json();
    await handleWhatsAppWebhook(body);
    return new Response("OK", { status: 200 });
  }
});
```

**Phase 2: Processing Incoming Messages**

WhatsApp webhook payloads are deeply nested:

```typescript
async function handleWhatsAppWebhook(body: any) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return; // Could be a status update, not a message

  const message = value.messages[0];
  const from = message.from; // Phone number
  const messageType = message.type; // "text", "interactive", "image", etc.

  switch (messageType) {
    case "text":
      const text = message.text.body;
      // Route to AI agent
      break;
    case "interactive":
      // Button reply or list reply
      if (message.interactive.type === "button_reply") {
        const buttonId = message.interactive.button_reply.id;
        const buttonTitle = message.interactive.button_reply.title;
      } else if (message.interactive.type === "list_reply") {
        const listId = message.interactive.list_reply.id;
      }
      break;
  }
}
```

### Sending Messages (Raw HTTP — no mature Deno library exists)

Use raw HTTP to the WhatsApp Cloud API. There is no grammY equivalent for WhatsApp in Deno.

```typescript
const WA_API_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
const WA_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");

async function sendWhatsAppMessage(to: string, text: string) {
  const response = await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  return response.json();
}
```

### Sending Interactive Messages (Buttons)

```typescript
async function sendWhatsAppButtons(to: string, bodyText: string, buttons: Array<{id: string, title: string}>) {
  await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    }),
  });
}
```

### Sending List Messages (for >3 options)

```typescript
async function sendWhatsAppList(to: string, bodyText: string, buttonText: string, sections: any[]) {
  await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: buttonText, // e.g., "View Options"
          sections: sections   // Up to 10 items across sections
        }
      }
    }),
  });
}
```

### Key Differences from Telegram

| Feature | Telegram | WhatsApp |
|---------|----------|----------|
| Bot initiation | User must /start the bot | User must message first OR opt-in |
| Proactive messaging | Anytime after /start | Only within 24-hour window (or templates) |
| Buttons per message | Unlimited inline keyboard | Max 3 reply buttons |
| Extended choices | Inline keyboard rows | List messages (max 10 items) |
| Formatting | MarkdownV2, HTML | Bold (*), Italic (_), Strike (~), Mono (```) |
| Media | Photos, docs, audio, video, stickers | Photos, docs, audio, video, stickers, location |
| Message editing | Supported | Not supported |
| Library support (Deno) | grammY (excellent) | Raw HTTP (no mature library) |
| Webhook auth | secret_token header | HMAC-SHA256 signature |
| Rate limits | 30 msg/s global | 80 msg/s (business tier dependent) |

---

## 3. Unified Message Abstraction

### Architecture: Adapter Pattern with Message Router

```
                    +------------------+
                    |    AI Agent       |
                    |  (Health Logic)   |
                    +--------+---------+
                             |
                    AgentMessage (platform-agnostic)
                             |
                    +--------v---------+
                    |  Message Router   |
                    +--+----+------+---+
                       |    |      |
            +----------+  +---+  +---------+
            |             |      |         |
    +-------v---+  +------v-+  +-v--------+
    | Telegram  |  |WhatsApp|  |  Push    |
    | Adapter   |  |Adapter |  | Adapter  |
    +-----------+  +--------+  +----------+
```

### Core Types

```typescript
// Platform-agnostic message types
interface AgentMessage {
  userId: string;           // Internal user ID
  text: string;             // Plain text content (adapters format per platform)
  buttons?: AgentButton[];  // Optional interactive elements
  media?: AgentMedia;       // Optional media attachment
  isProactive: boolean;     // Whether this is unsolicited (affects WhatsApp routing)
  templateId?: string;      // WhatsApp template name (required if proactive + outside window)
  templateParams?: string[];
  priority: "low" | "normal" | "high" | "urgent";
}

interface AgentButton {
  id: string;      // Callback identifier
  label: string;   // Display text (max 20 chars for WhatsApp)
  type: "quick_reply" | "url" | "call";
}

interface AgentMedia {
  type: "image" | "document" | "audio" | "video";
  url: string;
  caption?: string;
}

// Normalized incoming message
interface IncomingMessage {
  userId: string;
  platform: "telegram" | "whatsapp";
  platformUserId: string;     // Telegram chat_id or phone number
  text?: string;
  callbackData?: string;       // Button press
  mediaUrl?: string;
  timestamp: number;
}
```

### Message Router

```typescript
class MessageRouter {
  private adapters: Map<string, ChannelAdapter>;

  constructor() {
    this.adapters = new Map();
    this.adapters.set("telegram", new TelegramAdapter());
    this.adapters.set("whatsapp", new WhatsAppAdapter());
  }

  async send(message: AgentMessage): Promise<void> {
    // Look up user's preferred/registered channels
    const userChannels = await getUserChannels(message.userId);

    for (const channel of userChannels) {
      const adapter = this.adapters.get(channel.platform);
      if (!adapter) continue;

      try {
        await adapter.send(channel.platformUserId, message);
      } catch (error) {
        // Log failure, potentially queue for retry
        await queueFailedMessage(channel, message, error);
      }
    }
  }

  normalize(platform: string, rawPayload: any): IncomingMessage {
    const adapter = this.adapters.get(platform);
    return adapter!.normalize(rawPayload);
  }
}
```

### Adapter Interface

```typescript
interface ChannelAdapter {
  send(platformUserId: string, message: AgentMessage): Promise<void>;
  normalize(rawPayload: any): IncomingMessage;
  canSendProactive(platformUserId: string): Promise<boolean>;
}
```

### Formatting Abstraction

```typescript
// The agent writes in a simple markup, adapters convert
interface TextFormatter {
  bold(text: string): string;
  italic(text: string): string;
  code(text: string): string;
  link(text: string, url: string): string;
}

const telegramFormatter: TextFormatter = {
  bold: (t) => `*${t}*`,
  italic: (t) => `_${t}_`,
  code: (t) => `\`${t}\``,
  link: (t, url) => `[${t}](${url})`,
};

const whatsappFormatter: TextFormatter = {
  bold: (t) => `*${t}*`,
  italic: (t) => `_${t}_`,
  code: (t) => "```" + t + "```",
  link: (t, url) => `${t}: ${url}`, // WhatsApp doesn't support hyperlinks in body
};
```

Alternatively, store agent messages in a simple internal format (e.g., `**bold**`, `_italic_`) and have each adapter convert to platform-native format at send time.

### Button Adaptation

```typescript
// TelegramAdapter: Convert AgentButtons to InlineKeyboard
function toTelegramKeyboard(buttons: AgentButton[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  buttons.forEach((btn, i) => {
    kb.text(btn.label, btn.id);
    if ((i + 1) % 3 === 0) kb.row(); // 3 buttons per row
  });
  return kb;
}

// WhatsAppAdapter: Convert AgentButtons to interactive message
function toWhatsAppButtons(buttons: AgentButton[]): any {
  if (buttons.length <= 3) {
    // Use reply buttons
    return {
      type: "button",
      action: {
        buttons: buttons.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.label.substring(0, 20) }
        }))
      }
    };
  } else {
    // Use list message (up to 10 items)
    return {
      type: "list",
      action: {
        button: "Choose",
        sections: [{
          title: "Options",
          rows: buttons.map(b => ({
            id: b.id,
            title: b.label.substring(0, 24),
          }))
        }]
      }
    };
  }
}
```

---

## 4. Proactive Messaging Patterns

### Telegram: Straightforward

After a user sends `/start`, the bot can message them anytime:

```typescript
// Morning brief
await bot.api.sendMessage(chatId, "Good morning! Here's your health brief...");

// Stress alert
const alertKeyboard = new InlineKeyboard()
  .text("I'm fine", "stress_fine")
  .text("Need help", "stress_help");

await bot.api.sendMessage(chatId, "Your stress levels seem elevated. How are you?", {
  reply_markup: alertKeyboard,
});
```

### WhatsApp: Template Messages Required Outside 24-Hour Window

**The 24-hour rule:**
- When a user messages you, a 24-hour "customer service window" opens.
- Within this window, you can send any message (free-form text, buttons, media).
- Outside this window, you can ONLY send pre-approved template messages.

**Implementation pattern:**

```typescript
class WhatsAppAdapter implements ChannelAdapter {
  async send(phone: string, message: AgentMessage): Promise<void> {
    const windowOpen = await this.isWithinServiceWindow(phone);

    if (message.isProactive && !windowOpen) {
      // Must use template message
      if (!message.templateId) {
        throw new Error("Proactive message outside window requires templateId");
      }
      await this.sendTemplate(phone, message.templateId, message.templateParams);
    } else {
      // Within window — send free-form
      await this.sendFreeForm(phone, message);
    }
  }

  private async isWithinServiceWindow(phone: string): Promise<boolean> {
    // Query Supabase for last inbound message timestamp
    const { data } = await supabase
      .from("conversations")
      .select("last_inbound_at")
      .eq("phone", phone)
      .single();

    if (!data?.last_inbound_at) return false;
    const elapsed = Date.now() - new Date(data.last_inbound_at).getTime();
    return elapsed < 24 * 60 * 60 * 1000; // 24 hours
  }

  private async sendTemplate(phone: string, templateName: string, params?: string[]) {
    await fetch(WA_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: params ? [{
            type: "body",
            parameters: params.map(p => ({ type: "text", text: p }))
          }] : undefined,
        }
      }),
    });
  }
}
```

### Recommended WhatsApp Templates for Health Alerts

**Category: UTILITY** (non-promotional, user-specific, account-related updates)

These templates need Meta approval. Design them to be clear, specific, and non-promotional:

| Template Name | Body Text | Category | Use Case |
|---|---|---|---|
| `health_check_in` | "Hi {{1}}, it's time for your daily health check-in. How are you feeling today? Reply to let us know." | Utility | Daily morning brief prompt |
| `stress_alert` | "Hi {{1}}, we noticed elevated stress indicators in your recent data. Take a moment to check in with yourself. Reply to this message for breathing exercises or tips." | Utility | Stress level alerts |
| `medication_reminder` | "Hi {{1}}, this is a reminder to take your {{2}}. Reply 'done' when complete." | Utility | Medication adherence |
| `weekly_summary` | "Hi {{1}}, your weekly health summary is ready. Reply to view your insights." | Utility | Weekly recap |
| `appointment_reminder` | "Hi {{1}}, you have an appointment with {{2}} on {{3}}. Reply to confirm or reschedule." | Utility | Appointment reminders |
| `goal_milestone` | "Hi {{1}}, congratulations! You've reached your {{2}} goal. Reply to see your progress." | Utility | Goal tracking |

**Approval tips:**
- Keep templates factual and non-promotional.
- Do NOT include marketing language, offers, or upsells.
- Use the UTILITY category, not MARKETING (cheaper and higher delivery rates).
- Templates with variables ({{1}}, {{2}}) are more flexible and reusable.
- Include a clear call-to-action like "Reply to..." to re-open the 24-hour window.

**Strategy: Always try to re-open the 24-hour window.** Template messages should prompt the user to reply, which re-opens free-form messaging for 24 hours.

---

## 5. Interactive Health Feedback UX

### Pattern: Structured Feedback Collection

**Mood Check (3 buttons, works on both platforms):**

```typescript
const moodCheck: AgentMessage = {
  userId: "user123",
  text: "How are you feeling right now?",
  buttons: [
    { id: "mood_good", label: "Good", type: "quick_reply" },
    { id: "mood_okay", label: "Okay", type: "quick_reply" },
    { id: "mood_bad",  label: "Not great", type: "quick_reply" },
  ],
  isProactive: false,
  priority: "normal",
};
```

**Thumbs Up/Down (binary feedback):**

```typescript
const feedbackRequest: AgentMessage = {
  userId: "user123",
  text: "Was today's breathing exercise helpful?",
  buttons: [
    { id: "fb_yes", label: "Yes, helpful", type: "quick_reply" },
    { id: "fb_no",  label: "Not really", type: "quick_reply" },
  ],
  isProactive: false,
  priority: "low",
};
```

**Multi-Choice Symptom Checker (needs list on WhatsApp):**

```typescript
const symptomCheck: AgentMessage = {
  userId: "user123",
  text: "Which of these have you experienced today?",
  buttons: [
    { id: "sym_headache",  label: "Headache", type: "quick_reply" },
    { id: "sym_fatigue",   label: "Fatigue", type: "quick_reply" },
    { id: "sym_insomnia",  label: "Poor sleep", type: "quick_reply" },
    { id: "sym_anxiety",   label: "Anxiety", type: "quick_reply" },
    { id: "sym_none",      label: "None of these", type: "quick_reply" },
  ],
  isProactive: false,
  priority: "normal",
};
// Router: Telegram renders as 5 inline buttons; WhatsApp renders as list message
```

### Storing Callback Responses

```sql
-- Supabase table for tracking interactions
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  platform TEXT NOT NULL,           -- 'telegram' | 'whatsapp'
  interaction_type TEXT NOT NULL,   -- 'mood_check' | 'feedback' | 'symptom'
  callback_data TEXT NOT NULL,      -- 'mood_good' | 'fb_yes' | 'sym_headache'
  message_id TEXT,                  -- Platform message ID for reference
  context JSONB,                    -- Additional context (what triggered this)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick user history lookups
CREATE INDEX idx_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX idx_interactions_type ON user_interactions(interaction_type, created_at DESC);
```

### Callback Handler Pattern

```typescript
// Unified callback processing
async function handleCallback(incoming: IncomingMessage): Promise<AgentMessage | null> {
  const callbackData = incoming.callbackData;
  if (!callbackData) return null;

  // Parse callback: "mood_good" -> type="mood", value="good"
  const [type, ...rest] = callbackData.split("_");
  const value = rest.join("_");

  // Store interaction
  await supabase.from("user_interactions").insert({
    user_id: incoming.userId,
    platform: incoming.platform,
    interaction_type: type,
    callback_data: callbackData,
  });

  // Generate response based on callback
  switch (type) {
    case "mood":
      if (value === "bad") {
        return {
          userId: incoming.userId,
          text: "I'm sorry to hear that. Would you like to try a quick breathing exercise or talk about what's going on?",
          buttons: [
            { id: "action_breathe", label: "Breathing exercise", type: "quick_reply" },
            { id: "action_talk",    label: "Talk about it", type: "quick_reply" },
          ],
          isProactive: false,
          priority: "high",
        };
      }
      return { userId: incoming.userId, text: "Great, glad to hear it!", isProactive: false, priority: "low" };

    case "fb":
      return { userId: incoming.userId, text: "Thanks for the feedback!", isProactive: false, priority: "low" };

    default:
      return null;
  }
}
```

---

## 6. Webhook Security

### Telegram: Secret Token Header

When you call `setWebhook`, pass `secret_token`. Telegram then includes it in every webhook request as `X-Telegram-Bot-Api-Secret-Token`.

```typescript
// Setting webhook with secret token
await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `https://${PROJECT_ID}.supabase.co/functions/v1/telegram-bot`,
    secret_token: WEBHOOK_SECRET, // 1-256 chars, A-Z a-z 0-9 _ -
  }),
});

// Verifying in the Edge Function
Deno.serve(async (req) => {
  const secretHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secretHeader !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return await handleUpdate(req);
});
```

This is better than the query-parameter approach shown in some grammY examples, because the secret never appears in URL logs.

### WhatsApp: HMAC-SHA256 Signature Verification

Meta signs every webhook payload with your App Secret using HMAC-SHA256, sent in the `X-Hub-Signature-256` header.

```typescript
import { crypto } from "https://deno.land/std/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std/encoding/hex.ts";

async function verifyWhatsAppSignature(req: Request): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("X-Hub-Signature-256");
  if (!signature) return { valid: false, body: "" };

  const rawBody = await req.text();
  const appSecret = Deno.env.get("WA_APP_SECRET")!;

  // Compute HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedSignature = "sha256=" + encodeHex(new Uint8Array(sig));

  // Constant-time comparison
  const valid = signature === expectedSignature;
  return { valid, body: rawBody };
}

// Usage in Edge Function
Deno.serve(async (req) => {
  if (req.method === "POST") {
    const { valid, body } = await verifyWhatsAppSignature(req);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }
    const payload = JSON.parse(body);
    await handleWhatsAppWebhook(payload);
    return new Response("OK", { status: 200 });
  }
});
```

**Critical:** You must verify the signature against the raw body string BEFORE parsing JSON. If you parse first and re-stringify, the signature will not match.

---

## 7. Message Queuing and Delivery Guarantees

### Supabase Edge Function Constraints

| Limit | Value |
|-------|-------|
| CPU time per request | 2 seconds |
| Wall clock (free) | 150 seconds |
| Wall clock (pro) | 400 seconds |
| Memory | 256 MB |
| Function size | 20 MB bundled |

### Problem: What If the Edge Function Fails?

If your webhook handler crashes or times out:
- **Telegram**: Will retry the webhook delivery several times with increasing delays. Telegram retries for up to 24 hours.
- **WhatsApp**: Meta retries webhook delivery for up to 7 days, with exponential backoff.

Both platforms have built-in retry, but your handler should be **idempotent** — processing the same webhook twice should not cause duplicate side effects.

### Recommended Pattern: Acknowledge Fast, Process Async

```
Webhook arrives
  |
  v
Edge Function receives it
  |
  v
1. Verify signature (fast)
2. Insert raw payload into Supabase queue table (fast)
3. Return 200 OK immediately
  |
  v
Separate worker function (triggered by pg_notify or cron)
  |
  v
Processes queued messages with full error handling and retries
```

### Implementation with Supabase Queues (pgmq)

```sql
-- Enable pgmq
SELECT pgmq.create('incoming_messages');
SELECT pgmq.create('outgoing_messages');
```

**Webhook handler (fast, just enqueues):**

```typescript
Deno.serve(async (req) => {
  // Verify signature...
  const body = await req.json();

  // Enqueue for processing (very fast — just a DB insert)
  await supabase.schema("pgmq_public").rpc("send", {
    queue_name: "incoming_messages",
    message: {
      platform: "telegram", // or "whatsapp"
      payload: body,
      received_at: new Date().toISOString(),
    },
  });

  return new Response("OK", { status: 200 });
});
```

**Worker function (processes the queue):**

```typescript
// Triggered by cron or pg_notify
Deno.serve(async (req) => {
  const { data: messages } = await supabase
    .schema("pgmq_public")
    .rpc("read", {
      queue_name: "incoming_messages",
      sleep_seconds: 0,
      n: 10, // Process up to 10 messages
    });

  for (const msg of messages ?? []) {
    try {
      // Process message through AI agent
      await processMessage(msg.message);

      // Delete from queue on success
      await supabase.schema("pgmq_public").rpc("delete", {
        queue_name: "incoming_messages",
        msg_id: msg.msg_id,
      });
    } catch (error) {
      console.error("Processing failed, will retry:", error);
      // Message stays in queue; pgmq will make it visible again after visibility timeout
    }
  }

  return new Response("OK");
});
```

### Outgoing Message Queue

For proactive messages and retries on failed sends:

```typescript
// Enqueue outgoing message
await supabase.schema("pgmq_public").rpc("send", {
  queue_name: "outgoing_messages",
  message: {
    userId: "user123",
    agentMessage: { text: "Your morning brief...", buttons: [...] },
    retryCount: 0,
    maxRetries: 3,
  },
});

// Worker processes outgoing queue
async function processOutgoing(msg: any) {
  try {
    const router = new MessageRouter();
    await router.send(msg.message.agentMessage);
  } catch (error) {
    if (msg.message.retryCount < msg.message.maxRetries) {
      // Re-enqueue with incremented retry count
      await supabase.schema("pgmq_public").rpc("send", {
        queue_name: "outgoing_messages",
        message: { ...msg.message, retryCount: msg.message.retryCount + 1 },
      });
    } else {
      // Log permanent failure
      await supabase.from("failed_messages").insert({ ...msg.message, error: error.message });
    }
  }
}
```

---

## 8. Recommended Architecture

### Overview

```
                         +---------------------------+
                         |     Supabase Edge Functions|
                         |                           |
  Telegram Webhook ----> | telegram-webhook (fn)     |
                         |   - Verify secret_token   |
                         |   - Enqueue to pgmq       |
                         |   - Return 200            |
                         |                           |
  WhatsApp Webhook ----> | whatsapp-webhook (fn)     |
                         |   - Verify HMAC-SHA256    |
                         |   - Enqueue to pgmq       |
                         |   - Return 200            |
                         |                           |
  pg_cron / pg_notify -> | message-processor (fn)    |
                         |   - Read from pgmq        |
                         |   - Normalize via adapter  |
                         |   - Route to AI agent     |
                         |   - Agent response ->      |
                         |     outgoing queue         |
                         |                           |
  pg_cron / pg_notify -> | message-sender (fn)       |
                         |   - Read outgoing queue   |
                         |   - Route via adapters    |
                         |   - Handle 24hr window    |
                         |   - Retry on failure      |
                         |                           |
  pg_cron (scheduled) -> | proactive-scheduler (fn)  |
                         |   - Morning briefs        |
                         |   - Stress alerts          |
                         |   - Check 24hr window     |
                         |   - Use templates if needed|
                         +---------------------------+
                                    |
                         +----------v----------+
                         |    Supabase DB       |
                         |                     |
                         | - users             |
                         | - conversations     |
                         | - user_interactions |
                         | - pgmq queues       |
                         | - health_data       |
                         +---------------------+
```

### Edge Functions Structure

```
supabase/functions/
  telegram-webhook/index.ts     # Receives + enqueues Telegram updates
  whatsapp-webhook/index.ts     # Receives + enqueues WhatsApp updates
  message-processor/index.ts    # Dequeues, normalizes, routes to AI agent
  message-sender/index.ts       # Sends outgoing messages via adapters
  proactive-scheduler/index.ts  # Cron-triggered proactive messaging
  _shared/
    adapters/
      telegram.ts               # TelegramAdapter (uses grammY Bot.api)
      whatsapp.ts               # WhatsAppAdapter (raw fetch)
      types.ts                  # AgentMessage, IncomingMessage, etc.
    router.ts                   # MessageRouter
    formatter.ts                # Platform-specific text formatting
    security.ts                 # Signature verification helpers
    queue.ts                    # pgmq helpers
```

### Key Design Decisions

1. **grammY for Telegram, raw HTTP for WhatsApp.** No mature Deno WhatsApp library exists. Raw HTTP for WhatsApp is simple enough (just fetch calls with JSON).

2. **Separate webhook receivers from processors.** Webhook functions should be fast (under 100ms) — just verify and enqueue. Processing happens asynchronously via queue workers.

3. **pgmq for all message queuing.** Supabase Queues (built on pgmq) provides exactly-once delivery with visibility timeouts, perfect for message processing guarantees.

4. **Track the 24-hour window in the database.** Update `conversations.last_inbound_at` on every incoming WhatsApp message. The WhatsApp adapter checks this before deciding between free-form and template messages.

5. **Template messages as re-engagement hooks.** Design all WhatsApp templates to prompt the user to reply, which re-opens the 24-hour free-form window.

6. **Idempotent processing.** Use message IDs to deduplicate — both Telegram and WhatsApp provide unique message identifiers.

---

## Sources

- [Supabase: Building a Telegram Bot](https://supabase.com/docs/guides/functions/examples/telegram-bot)
- [grammY: Hosting on Supabase Edge Functions](https://grammy.dev/hosting/supabase)
- [grammY: Inline and Custom Keyboards](https://grammy.dev/plugins/keyboard)
- [grammY GitHub](https://github.com/grammyjs/grammY)
- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase: Processing Large Jobs with Edge Functions and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- [Supabase: Consuming Queue Messages with Edge Functions](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions)
- [Supabase Queues (pgmq)](https://supabase.com/docs/guides/queues/pgmq)
- [WhatsApp Template Categories Explained (WUSeller)](https://www.wuseller.com/blog/whatsapp-template-categories-explained-marketing-vs-utility-vs-authentication-vs-service/)
- [WhatsApp Interactive Buttons (Infobip)](https://www.infobip.com/blog/how-to-use-whatsapp-interactive-buttons)
- [WhatsApp 24-hour Conversation Window (ActiveCampaign)](https://help.activecampaign.com/hc/en-us/articles/20679458055964-Understanding-the-24-hour-conversation-window-in-WhatsApp-messaging)
- [Twilio: Send WhatsApp Notification Messages with Templates](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates)
- [Telegram Bot API: Webhook Secret Token](https://core.telegram.org/bots/api)
- [HMAC-SHA256 Webhook Signature Verification (Hookdeck)](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification)
- [Building Scalable Webhook Architecture for WhatsApp (ChatArchitect)](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions)
- [Chatwoot Multi-Channel Communication Architecture](https://deepwiki.com/chatwoot/chatwoot/7-configuration-and-customization)
- [n8n: AI-Powered Telegram & WhatsApp Business Agent Workflow](https://n8n.io/workflows/5311-ai-powered-telegram-and-whatsapp-business-agent-workflow/)

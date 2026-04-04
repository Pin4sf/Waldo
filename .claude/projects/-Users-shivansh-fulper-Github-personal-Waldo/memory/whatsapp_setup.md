---
name: WhatsApp Business API Setup
description: WhatsApp Cloud API credentials and setup steps — deferred, do this when ready to add WhatsApp to Waldo
type: reference
---

## Status: Deferred — Focus on Telegram first

Edge Function `whatsapp-bot` is deployed and working. Just needs these 3 secrets set in Supabase.

## The 3 Supabase Secrets Needed

```
WHATSAPP_VERIFY_TOKEN     → pick any string (e.g. waldo-whatsapp-2026) — must match what you type in Meta webhook form
WHATSAPP_ACCESS_TOKEN     → EAABxx... (from Meta Dev Console → WhatsApp → Getting Started)
WHATSAPP_PHONE_NUMBER_ID  → 15-digit number ID (same page as above)
```

## Setup Path (20-30 min when ready)

1. developers.facebook.com → Create App → Business → Add WhatsApp product
2. WhatsApp → Getting Started → note Phone Number ID + generate Access Token
3. WhatsApp → Configuration → Webhook → set URL: `https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/whatsapp-bot`
4. Verify token = whatever you put in WHATSAPP_VERIFY_TOKEN
5. Subscribe to: messages
6. Add test phone numbers (up to 5 in dev mode)
7. Set the 3 secrets in Supabase → test with /start on WhatsApp

## For Group Messaging
- Requires Meta review approval
- Group message format is slightly different — need to update whatsapp-bot to handle group_id field
- Add this when ready to deploy to group

## Current Bot Commands (already implemented)
/start, /status, /morning, 6-digit linking code, conversational chat
Same linking code pattern as Telegram.

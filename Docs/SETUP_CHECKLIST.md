# OneSync — Pre-Code Setup Checklist

**Date:** March 15, 2026
**Status:** Do all of Phase 1 BEFORE writing a single line of app code.

> Every item here can be done in parallel with writing code EXCEPT the ones marked **BLOCKING**. Do those first.

---

## Phase 1 — Do TODAY (Day 0)

### 1. Samsung Health Sensor SDK — Developer Mode (BLOCKING)
- [ ] Go to Samsung Health app on your Galaxy Watch → Settings → About → tap version 5x to enable dev mode
- [ ] Connect watch to your Samsung phone, enable SDK in Galaxy Wearable app
- [ ] Run the [Samsung Sensor SDK sample app](https://developer.samsung.com/health/sensor) on your own device
- [ ] **Goal:** Verify raw IBI data streams from your watch before writing any code
- **Time:** 30 minutes
- **Cost:** Free
- **If blocked:** Health Connect HRV is the fallback — MVP doesn't die

### 2. Telegram Bot — Create via BotFather
- [ ] Message @BotFather on Telegram → `/newbot`
- [ ] Name: "OneSync" / username: "onesync_ai_bot" (or similar)
- [ ] Save the API token somewhere secure
- [ ] Test with a basic webhook using a free ngrok tunnel
- **Time:** 15 minutes
- **Cost:** Free forever

### 3. Anthropic API Key
- [ ] Sign up at console.anthropic.com
- [ ] Create API key, set usage limits ($20/mo during dev)
- [ ] Verify Claude Haiku works with a test message
- **Time:** 10 minutes
- **Cost:** Pay-per-use (estimate $5–20/mo during dev)

### 4. Supabase Project
- [ ] Create project at supabase.com (free tier)
- [ ] Save: project URL, anon key, service role key
- [ ] Enable pg_cron extension (Database → Extensions → pg_cron)
- [ ] Enable pgmq extension
- [ ] Enable pg_notify (on by default)
- **Time:** 20 minutes
- **Cost:** Free tier (500MB, 500K edge calls)

### 5. WhatsApp Cloud API — START VERIFICATION NOW (non-blocking but time-sensitive)
- [ ] Create Meta Business Account at business.facebook.com
- [ ] Apply for WhatsApp Business API at developers.facebook.com/docs/whatsapp
- [ ] Submit business documentation (name must match exactly)
- [ ] Start sandbox (5 test numbers available immediately)
- **Time:** 1 hour to apply; 3–14 days for approval
- **Cost:** Free tier (1,000 conversations/month)
- **Why now:** Approval takes up to 2 weeks. Start in parallel. Don't block MVP on this.

---

## Phase 2 — This Week (Days 1–5)

### 6. Google Play Console
- [ ] Register at play.google.com/console ($25 one-time fee)
- [ ] Create app listing (can be unpublished for testing)
- [ ] Submit Health Connect permissions declaration (required for production, takes 2+ weeks review)
- **Time:** 1 hour
- **Cost:** $25

### 7. Samsung Developer Account
- [ ] Register at developer.samsung.com (free, instant)
- [ ] Apply for Health Sensor SDK distribution approval (separate from developer mode)
- [ ] Note: distribution approval status unclear — apply now, use dev mode for MVP
- **Time:** 30 minutes
- **Cost:** Free

### 8. Expo Account + EAS
- [ ] Sign up at expo.dev
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] `eas login` and `eas build:configure`
- [ ] 15 free builds/month on free tier (enough for MVP)
- **Time:** 30 minutes
- **Cost:** Free tier

### 9. Test Devices
- [ ] Confirm you have: Samsung Galaxy Watch 6 (or 5/7) + Android phone (Samsung preferred)
- [ ] If not: either borrow one or pivot MVP device to Pixel Watch + Pixel phone (cleaner dev experience)
- [ ] Enable Developer Options on phone (tap Build Number 7x in Settings → About)
- [ ] Enable USB debugging
- **Time:** 15 minutes

---

## Phase 3 — Week 2 (Pre-Build Validation)

### 10. Wizard of Oz Test — CRITICAL BEFORE CODING
- [ ] Export 7 days of Samsung Health data to CSV
- [ ] Manually compute CRS for each day using the formula in ALGORITHMS_AND_HEALTH.md
- [ ] Write 3–5 sample "morning brief" messages you would send to yourself based on that data
- [ ] Send them to yourself via Telegram manually (as if you were the agent)
- [ ] **Evaluate:** Does the CRS feel right? Do the messages feel useful? Is the "magic moment" real?
- **Time:** 4–6 hours over 2 days
- **Cost:** Free
- **Why:** If the manual version doesn't feel useful, fix the algorithm before writing 8 weeks of code

### 11. 3 Beta User Commitments
- [ ] Identify 3 people (IIT network, friends, colleagues) who:
  - Own an Android phone with a compatible watch
  - Use Telegram
  - Experience stress/burnout and care about it
  - Will give you honest weekly feedback
- [ ] Get commitment BEFORE you build. Not "maybe." Confirmed.
- **Time:** A few conversations
- **Why:** Building for zero users is the fastest way to build the wrong thing

### 12. Supabase Schema Setup
- [ ] Run the schema from AGENT_AND_BACKEND.md to create tables:
  - `users`, `health_snapshots`, `stress_events`, `conversation_history`, `core_memory`, `feedback_events`, `baseline_history`, `intervention_log`
- [ ] Enable RLS on all tables
- [ ] Test basic insert/read from client
- **Time:** 2–3 hours

### 13. Expo Project Bootstrap
- [ ] `npx create-expo-app onesync --template blank-typescript`
- [ ] Set up NativeWind v4 + Gluestack-UI v3
- [ ] Add `react-native-health-connect` package
- [ ] Confirm Health Connect reads from test device (even one data type)
- **Time:** 4–6 hours

---

## Registrations Status Tracker

| Service | Status | Cost | Time to Activate |
|---------|--------|------|-----------------|
| Samsung Sensor SDK (dev mode) | ☐ | Free | 30 min |
| Telegram Bot | ☐ | Free | 15 min |
| Anthropic API | ☐ | ~$5/mo dev | 10 min |
| Supabase | ☐ | Free | 20 min |
| WhatsApp Cloud API (apply) | ☐ | Free | 1 hr apply + 14 days |
| Google Play Console | ☐ | $25 | 1 hr |
| Samsung Developer | ☐ | Free | 30 min |
| Expo / EAS | ☐ | Free | 30 min |

---

## API Keys Template

Create a `.env.local` file (never commit this):

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# WhatsApp (Phase 2 - apply now)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# App
APP_ENV=development
```

---

## Done When

- [ ] Samsung Health Sensor SDK streams IBI from your watch (dev mode)
- [ ] Telegram bot responds to `/start` command
- [ ] Anthropic API key works (test call returns response)
- [ ] Supabase project live with schema applied
- [ ] WhatsApp verification submitted
- [ ] You've done the Wizard of Oz test and CRS feels real
- [ ] 3 beta users committed by name

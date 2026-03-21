# OneSync — Final MVP Plan (Synthesized)

Last updated: March 6, 2026

---

## What We're Building

A **Cognitive Co-pilot** that reads biometric data from smartwatches, computes a Cognitive Readiness Score (CRS), and proactively intervenes via Telegram/WhatsApp when stress is detected — using Claude as the AI brain.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        WEARABLE LAYER                            │
│                                                                  │
│  Samsung GW ──[Sensor SDK]──> Wearable Data Layer ──┐            │
│  Garmin ──[Connect IQ]──> CIQ Mobile SDK ──────────┤            │
│  Oura/WHOOP/Fitbit ──[Cloud REST APIs]─────────────┤            │
│  Any Android ──[Health Connect]────────────────────┤            │
│                                                     │            │
│                                                     v            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              REACT NATIVE APP (Expo SDK 53+)          │       │
│  │                                                        │       │
│  │  expo-background-task (15 min) ──> Read sensors        │       │
│  │  PowerSync SQLite ──> Local storage + sync queue       │       │
│  │  Zustand (UI state) + MMKV (KV) + TanStack Query      │       │
│  │  Gluestack-UI v3 components                            │       │
│  │  CRS Gauge + Charts (gifted-charts) + Dashboard        │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                          │ PowerSync auto-sync                   │
│                          v                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              SUPABASE BACKEND                         │       │
│  │                                                        │       │
│  │  Postgres ──> health_snapshots, sleep, baselines       │       │
│  │  pg_cron ──> scheduled triggers                        │       │
│  │  pgmq ──> message queue                                │       │
│  │  Edge Functions:                                       │       │
│  │    telegram-webhook ──┐                                │       │
│  │    whatsapp-webhook ──┤──> message-processor            │       │
│  │    check-triggers ────┘    (Claude agent loop)          │       │
│  │    message-sender ──> Telegram API / WhatsApp API      │       │
│  │    morning-brief, compute-baselines                    │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                          │                                       │
│                          v                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              CLAUDE AI LAYER                          │       │
│  │                                                        │       │
│  │  Messages API (tool_use, ReAct loop)                   │       │
│  │  18 tools: health, memory, comms, calendar, email      │       │
│  │  Model routing: Haiku / Sonnet / Opus by severity      │       │
│  │  Prompt caching: personality + user profile             │       │
│  │  Safety guardrails in system prompt                     │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              MESSAGING LAYER                          │       │
│  │                                                        │       │
│  │  Telegram (grammY) ←→ User                             │       │
│  │  WhatsApp (Cloud API) ←→ User                          │       │
│  │  Proactive templates for outside 24h window             │       │
│  │  6-digit code linking to Supabase Auth                  │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack (Final)

| Layer | Choice |
|-------|--------|
| Framework | React Native + Expo SDK 53+ (custom dev client) |
| Background sync | expo-background-task (WorkManager, 15-min) |
| Health data | react-native-health-connect + Samsung Sensor SDK + Garmin CIQ |
| Watch comms | react-native-wear-connectivity |
| State mgmt | Zustand (client) + TanStack Query (server) + MMKV (KV) |
| Local DB | PowerSync (SQLite, offline-first) |
| UI components | Gluestack-UI v3 |
| Charts | react-native-gifted-charts + Custom SVG gauge |
| Backend | Supabase (Postgres, Edge Functions, Auth, Realtime) |
| AI | Claude API (Messages with tool_use) |
| Telegram bot | grammY (Deno native) |
| WhatsApp bot | Raw HTTP to Cloud API v21.0 |
| Message queue | Supabase Queues (pgmq) |
| OEM battery | react-native-autostarter |

---

## 18 Agent Tools

| # | Tool | Category |
|---|------|----------|
| 1 | get_current_biometrics | Health |
| 2 | get_health_history | Health |
| 3 | get_sleep_summary | Health |
| 4 | get_stress_events | Health |
| 5 | read_core_memory | Memory |
| 6 | update_core_memory | Memory |
| 7 | search_conversation_history | Memory |
| 8 | send_message | Communication |
| 9 | schedule_message | Communication |
| 10 | get_upcoming_events | Calendar |
| 11 | suggest_reschedule | Calendar |
| 12 | get_recent_emails | Email |
| 13 | search_emails | Email |
| 14 | suggest_breathing_exercise | Intervention |
| 15 | suggest_break | Intervention |
| 16 | suggest_activity | Intervention |
| 17 | get_current_time | Utility |
| 18 | log_interaction | Utility |

---

## Build Sequence (12 Weeks)

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Project Setup + Backend**
- [ ] Initialize Expo project with SDK 53+, custom dev client
- [ ] Set up Supabase project (database, auth, Edge Functions)
- [ ] Create database schema (all tables + indexes + RLS)
- [ ] Set up PowerSync connection
- [ ] Configure EAS Build (development profile)

**Week 2: Health Connect + Background Sync**
- [ ] Integrate react-native-health-connect
- [ ] Implement health data reader (HR, sleep, steps, SpO2)
- [ ] Set up expo-background-task (15-min sync)
- [ ] Write health data to PowerSync SQLite → Supabase
- [ ] Implement CRS computation from available data
- [ ] OEM battery optimization detection (react-native-autostarter)

**Week 3: Dashboard UI**
- [ ] Set up Gluestack-UI v3
- [ ] Build CRS gauge component (custom SVG)
- [ ] Build metric cards (HR, HRV, steps, SpO2, sleep, circadian)
- [ ] Build sleep summary component
- [ ] Build weekly trend chart (gifted-charts)
- [ ] Build insight card component
- [ ] Dark mode support
- [ ] Pull-to-refresh sync

### Phase 2: AI + Messaging (Weeks 4-7)

**Week 4: Telegram Bot**
- [ ] Create Telegram bot via BotFather
- [ ] Build telegram-webhook Edge Function (grammY)
- [ ] Build message-processor Edge Function (Claude agent loop)
- [ ] Implement tool definitions (health tools first)
- [ ] Basic conversation: user asks, bot answers with health data
- [ ] Set up prompt caching

**Week 5: WhatsApp Bot**
- [ ] Set up Meta Business app
- [ ] Build whatsapp-webhook Edge Function
- [ ] Webhook signature verification
- [ ] Message sending (free-form + templates)
- [ ] Create and submit template messages for approval
- [ ] Unified messaging abstraction (router)

**Week 6: Proactive Intelligence**
- [ ] Build check-triggers Edge Function
- [ ] Implement multi-signal stress detection gate
- [ ] Build message-sender Edge Function (pgmq consumer)
- [ ] Set up pg_cron jobs (check-triggers, message-sender)
- [ ] Build morning-brief Edge Function
- [ ] Model routing (Haiku/Sonnet/Opus)
- [ ] Rate limiting and cooldown logic

**Week 7: Memory + Context**
- [ ] Implement core_memory tools (read/update)
- [ ] Conversation history management (last 10 messages)
- [ ] Build compute-baselines Edge Function
- [ ] Build adjust-crs-weights Edge Function
- [ ] Feedback loop ("Was this helpful?" buttons)
- [ ] Safety guardrails in system prompt

### Phase 3: Onboarding + Polish (Weeks 8-9)

**Week 8: Onboarding Flow**
- [ ] Build 5-step onboarding screens
- [ ] Health Connect permission flow (careful UX)
- [ ] Wearable connection flow
- [ ] Channel linking (6-digit code)
- [ ] AI onboarding interview (Claude extracts profile from conversation)
- [ ] "Learning Mode" for first 7 days

**Week 9: Calendar + Email + Polish**
- [ ] Google OAuth integration (Calendar + Gmail scopes)
- [ ] Calendar tools (get_upcoming_events, suggest_reschedule)
- [ ] Email tools (get_recent_emails, search_emails)
- [ ] History screen (calendar view + daily detail + charts)
- [ ] Settings screen (all options)
- [ ] Edge cases: no wearable, no messaging, offline behavior

### Phase 4: Watch Companion Apps (Weeks 10-12)

**Week 10: Samsung Watch Companion**
- [ ] Set up Kotlin Wear OS project
- [ ] Integrate Samsung Health Sensor SDK
- [ ] Implement HR + IBI continuous tracker
- [ ] Implement skin temperature tracker (GW5+)
- [ ] Send data via Wearable Data Layer API (MessageClient)
- [ ] Receive on phone side (react-native-wear-connectivity)
- [ ] Compute RMSSD from raw IBI

**Week 11: Garmin Watch App**
- [ ] Set up Connect IQ project (Monkey C)
- [ ] Implement Sensor + SensorHistory data collection
- [ ] HR, IBI, SpO2, temperature, stress, Body Battery
- [ ] Send via Communications.transmit()
- [ ] Build native Android bridge for Connect IQ Mobile SDK
- [ ] Receive on phone side via bridge

**Week 12: Integration + Testing**
- [ ] End-to-end testing: watch → phone → Supabase → Claude → message
- [ ] Test on real devices (Samsung GW6/7, Garmin, CMF Watch Pro 2)
- [ ] OEM battery testing (Samsung, Xiaomi)
- [ ] Load testing (simulate 50-100 users)
- [ ] Fix bugs, polish UX
- [ ] Prepare for Google Play submission (Health Connect declaration)

---

## Cloud API Integrations (Post-MVP or Parallel)

| Device | Effort | When |
|--------|--------|------|
| Oura REST API | 1 week | Week 10-11 (parallel with watch apps) |
| Fitbit Web API | 1 week | After MVP if user demand |
| WHOOP API | 1 week | After MVP if user demand |

---

## Developer Registrations (Do ASAP)

### This Week
1. Google Play Console ($25, ID verification: 2 weeks)
2. Meta Business App (WhatsApp sandbox: instant, business verification: 2 weeks)
3. Expo account (instant, free)
4. Supabase project (instant, free)
5. Anthropic API account (instant, pay-per-use)
6. Telegram bot via BotFather (instant, free)

### Before Week 4
7. Samsung Developer account (instant)
8. Samsung Health Sensor SDK (download, dev mode)
9. Garmin Connect IQ SDK (instant, download)

### Before Week 9
10. Google Cloud Console (Calendar + Gmail APIs, OAuth consent screen)
11. Fitbit developer app (if integrating)

---

## Cost Estimate (MVP, Solo Developer)

| Item | Monthly Cost |
|------|-------------|
| Supabase (free tier) | $0 |
| PowerSync (free tier, 1 user) | $0 |
| Anthropic API (~100 users) | $30-50 |
| Expo (free tier, 15 builds/mo) | $0 |
| WhatsApp templates (~500 msgs) | $5-10 |
| Google Play (one-time) | $25 |
| **Total monthly** | **$35-60** |
| **First month (incl Play)** | **$60-85** |

---

## Success Criteria for MVP

1. **Background sync works reliably** on Samsung + Pixel devices (15-min interval)
2. **CRS score updates** every 15 minutes with available data
3. **Stress detection** fires on genuine stress events with <20% false positive rate
4. **Proactive messages** arrive within 2 minutes of stress detection
5. **Conversations** in Telegram/WhatsApp feel natural and context-aware
6. **Morning briefing** includes sleep + calendar + personalized insight
7. **Samsung watch companion** streams raw IBI for real-time HRV
8. **Onboarding** takes <5 minutes including AI interview
9. **Works offline** — app shows cached data, syncs when connected
10. **No medical claims** — framed as wellness insights, not diagnoses

---

## What's NOT in MVP

- iOS / Apple Watch (Phase 2)
- In-app chat (use Telegram/WhatsApp)
- Social features / leaderboards
- Paid subscription / monetization
- ROOK / Terra integration
- Advanced analytics dashboard
- Multi-language support
- Wearable-specific watch faces
- Integration with fitness apps (Strava, etc.)
- EHR / medical record integration

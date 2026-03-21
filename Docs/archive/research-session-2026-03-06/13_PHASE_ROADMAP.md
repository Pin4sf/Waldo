# OneSync -- Complete Phase-by-Phase Roadmap

Last updated: March 7, 2026

This document defines the full product evolution from MVP through mature product, with clear feature scope, agent-app integration points, and channel expansion at each phase.

---

## OVERVIEW

| Phase | Timeline | Focus | Key Milestone |
|-------|----------|-------|---------------|
| **Phase 1: MVP** | Weeks 1-12 | Core loop working end-to-end | "Sensor -> Score -> AI -> Message -> Feedback" on your device |
| **Phase 2: Expand** | Weeks 13-20 | Multi-channel, richer agent, deeper health | Push notifications + in-app chat + voice + weekly insights |
| **Phase 3: Scale** | Weeks 21-28 | Multi-user, iOS, advanced AI | Public beta, App Store + Play Store, knowledge graph |
| **Phase 4: Mature** | Weeks 29-40 | Monetization, partnerships, ecosystem | Paid tier, health provider integrations, skills marketplace |

---

## PHASE 1: MVP (Weeks 1-12)

### What Gets Built

**App Layer:**
- React Native + Expo SDK 53+ with Kotlin native modules
- Health Connect integration (native Kotlin module)
- Background sync via native WorkManager (15-min interval)
- CRS computation on-phone (weighted formula + time-of-day normalization)
- Weighted stress confidence scoring (replaces binary AND gates)
- Corrected artifact rejection (interpolation, not deletion)
- Dashboard: CRS gauge, metric cards, sleep summary, weekly trends
- op-sqlite + SQLCipher for encrypted local storage
- Custom upload sync (append-only health data -> Supabase)
- NativeWind v4 styling + custom health components
- OEM battery optimization detection + user guidance
- 5-step onboarding with Health Connect permissions

**Backend Layer:**
- Supabase: Postgres, Edge Functions, Auth, RLS
- Database schema: health_snapshots, sleep_records, user_profiles, core_memory, conversation_history, baselines
- pg_cron for scheduled tasks
- pgmq for message queuing
- pg_notify for high-priority stress alert delivery

**Agent OS Layer:**
- Claude Messages API with tool_use (ReAct loop, max 5 iterations)
- 18 tools (health, memory, comms, calendar, email, intervention, utility)
- Context assembly pipeline (static cached + user cached + dynamic fresh)
- Dynamic tool loading (5-8 tools per call based on intent)
- Model routing: rules-based pre-filter -> Haiku / Sonnet / Opus
- Prompt caching (Block 1: personality+tools, Block 2: user profile)
- Provider failover: Sonnet -> Haiku -> template
- Core memory (structured KV, self-modifying via agent tools)
- Session compaction (summarize after 10 messages)
- 3 built-in skills: sleep-analysis, stress-management, morning-briefing
- Pre-reasoning safety hook (emergency keyword detection)
- Post-reasoning output validation (banned medical phrases)
- Audit logging (model, tools, tokens, response)

**Autonomous Operations:**
- Morning Briefing Hand (daily at estimated wake time)
- Stress Monitor Hand (triggered by data sync, gated by confidence + cooldown)
- Baseline Updater Hand (daily 4 AM, pure computation)

**Channel Adapters (MVP):**
- Telegram bot (grammy, Deno-native in Edge Functions)
- WhatsApp bot (Cloud API v21.0, raw HTTP)
- Unified message interface (channel-agnostic routing)
- 6-digit code linking (messaging account -> Supabase Auth)
- Proactive templates for WhatsApp 24h window

**Watch Companion (MVP):**
- Samsung Watch: Kotlin Wear OS app with Health Sensor SDK
  - Continuous HR + IBI tracking
  - Skin temperature (GW5+)
  - Data via Wearable Data Layer API -> phone app
  - RMSSD computation from raw IBI on phone

### Agent-App Integration (MVP)

```
APP -> AGENT:
  Background sync writes health_snapshots to Supabase
  -> pg_cron triggers check-triggers Edge Function
  -> Stress Monitor Hand evaluates confidence
  -> If triggered: agent loop runs, sends message via channel

USER -> AGENT:
  User sends Telegram/WhatsApp message
  -> Webhook Edge Function receives
  -> Context assembly pipeline builds context
  -> Agent loop processes with tools
  -> Response delivered via same channel

AGENT -> APP:
  Agent updates core_memory (preferences, insights)
  -> App pulls on next open via TanStack Query
  -> Dashboard reflects latest CRS, insights

AGENT -> USER (Proactive):
  Morning Briefing Hand runs via pg_cron
  -> Gathers sleep + calendar + biometrics
  -> Composes personalized message
  -> Delivers via preferred channel
```

### MVP Success Criteria
1. Background sync works reliably on Samsung + Pixel (15-min interval)
2. CRS updates every 15 min with available data
3. Stress detection fires with <20% false positive rate
4. Proactive messages arrive within 2-5 min of stress detection
5. Telegram/WhatsApp conversations feel natural and context-aware
6. Morning briefing includes sleep + calendar + personalized insight
7. Samsung watch companion streams raw IBI for real-time HRV
8. Works offline -- app shows cached data, syncs when connected
9. Onboarding takes <5 min including AI interview

---

## PHASE 2: EXPAND (Weeks 13-20)

### Focus: Multi-Channel + Richer Agent + Deeper Health Intelligence

### 2.1 Channel Expansion (HIGH PRIORITY)

**Push Notifications (Week 13-14):**
- Firebase Cloud Messaging (FCM) integration in React Native app
- Notification types: stress alert, medication reminder, morning brief summary, weekly insight
- Rich notifications with CRS score, quick-action buttons ("Breathe", "I'm OK", "Snooze")
- Notification preferences in app settings (which types, quiet hours, priority levels)
- Fallback channel: if user hasn't opened Telegram in 24h, use push notification instead
- Channel router logic: prefer messaging -> fallback to push -> never duplicate

**In-App Chat (Week 14-16):**
- Real-time chat UI inside the OneSync app itself
- Supabase Realtime for message delivery (WebSocket-based)
- Chat screen with message bubbles, typing indicator, tool-use visualization
- History view with conversation search
- "Ask OneSync" floating button on dashboard
- Deep-link from push notification -> opens specific chat thread
- This becomes the PRIMARY channel (Telegram/WhatsApp become secondary/backup)

**Voice Interface (Week 17-18):**
- Voice input: Whisper STT (on-device via whisper.rn or cloud via API)
- Voice output: Text-to-speech for agent responses (edge-tts or expo-speech)
- Hands-free mode: "Hey OneSync, how did I sleep?" while driving/exercising
- Voice journaling: "I'm feeling anxious and my head hurts" -> agent records + responds
- Accessibility: critical for users who prefer voice over typing
- Integration with in-app chat (voice messages appear as transcribed text)

### 2.2 Agent Intelligence Upgrades

**Conversation Summaries with Embeddings (Week 13-14):**
- pgvector extension in Supabase for semantic search
- After each conversation session: generate embedding + structured summary
- `memory_search` tool: agent can search past conversations by meaning
- "What did we discuss about my headaches last week?" -> semantic retrieval

**Weekly Review Hand (Week 15):**
- Opus-powered weekly analysis every Sunday
- Reviews all health data, conversation summaries, goal progress
- Updates core memory with new insights and pattern discoveries
- Generates rich weekly report with trends, charts data, recommendations
- Delivered via in-app chat + push notification

**Enhanced Skills (Week 16-17):**
- nutrition-basics skill: meal logging guidance, basic calorie awareness
- exercise-recovery skill: activity balance, recovery recommendations
- medication-tracking skill: reminder scheduling, interaction awareness
- Custom skill authoring: users can define their own health protocols

**Full Hook Pipeline (Week 18):**
- Context injection hook: auto-inject recent vitals, upcoming meds, calendar
- Compaction hook: automatic with quality checks (never lose allergies/medications)
- Analytics hook: track intervention effectiveness, user engagement patterns
- Rate limit hook: per-user daily AI cost budget

### 2.3 Health Intelligence

**Cumulative Sleep Debt Tracking (Week 13):**
- Rolling 7-day and 14-day sleep debt computation
- Sleep debt integrated into CRS as sub-component
- Visual in dashboard: "You're 4.2h behind on sleep this week"

**Circadian Model (Week 14):**
- Chronotype estimation from midpoint-of-sleep
- Time-of-day expected patterns for all metrics
- Circadian alignment score as CRS component

**Activity-Stress Disambiguation (Week 15):**
- Use accelerometer data to distinguish physical exertion from psychological stress
- If steps > 200 in last 10 min AND HR elevated: exercise, not stress
- Reduce false positives by 30-50%

**Health Pattern Discovery (Week 19-20):**
- Correlation detection: "Your HRV drops 18% on days with 3+ meetings"
- Trend analysis: "Your sleep quality has improved 12% since you started the 11pm bedtime"
- Surface patterns in weekly review and proactive messages

### 2.4 App Enhancements

**History Screen (Week 14):**
- Calendar view with daily health summaries
- Tap a day -> detailed breakdown (CRS components, sleep stages, stress events, conversations)
- Weekly/monthly trend charts

**Settings Expansion (Week 15):**
- Notification preferences (per-channel, per-type, quiet hours)
- Agent personality tuning (more/less proactive, formal/casual)
- Health goals management
- Data export (CSV, JSON)
- Account deletion

**Widget (Week 18):**
- Android home screen widget showing current CRS + trend arrow
- Glanceable health status without opening app

### 2.5 Watch Companion Expansion

**Garmin Watch App (Week 16-17):**
- Connect IQ app in Monkey C
- HR, IBI, SpO2, temperature, stress, Body Battery collection
- Communications.transmit() -> native Android bridge -> React Native
- Garmin is fully open (no partner approval needed)

### Agent-App Integration (Phase 2)

```
NEW: IN-APP CHAT FLOW:
  User types/speaks in app chat
  -> Supabase Realtime delivers to Edge Function
  -> Agent loop processes (same pipeline as Telegram/WhatsApp)
  -> Response delivered via Supabase Realtime -> app renders in real-time
  -> Push notification if app is backgrounded

NEW: PUSH NOTIFICATION FLOW:
  Stress Monitor Hand detects stress
  -> Channel router checks: is user active in app chat? in Telegram?
  -> If no active channel: send push notification via FCM
  -> Rich notification with CRS score + quick actions
  -> Tap notification -> opens in-app chat with full conversation

NEW: VOICE FLOW:
  User activates voice in app
  -> Audio captured -> Whisper STT -> text
  -> Same agent pipeline processes text
  -> Response: text rendered in chat + spoken via TTS
  -> Voice journaling entries saved to health observations

UPGRADED: WEEKLY INSIGHT FLOW:
  Sunday: Weekly Review Hand (Opus) runs
  -> Analyzes all week's data + conversations
  -> Updates core memory with new patterns
  -> Generates rich weekly report
  -> Delivered: in-app chat (full report) + push notification (summary)
```

### Phase 2 Success Criteria
1. In-app chat is responsive (<3s for simple queries)
2. Push notifications arrive within 30s of trigger
3. Voice input works reliably for health journaling
4. Weekly review surfaces at least 1 non-obvious health pattern
5. Semantic memory search recalls relevant past conversations
6. Garmin watch data flows reliably to app
7. Channel router correctly selects the right delivery channel
8. Users prefer in-app chat over Telegram/WhatsApp (target: 60%+ of interactions)

---

## PHASE 3: SCALE (Weeks 21-28)

### Focus: Multi-User + iOS + Advanced AI

### 3.1 Multi-User Infrastructure

**Authentication & Onboarding (Week 21):**
- Google Sign-In + Apple Sign-In
- Onboarding flow optimized from Phase 1 learnings
- Referral system (invite codes)

**Backend Scaling (Week 22):**
- Supabase Pro plan ($25/month) for higher limits
- Edge Function concurrency scaling
- Move agent loop to dedicated worker (Railway/Fly.io) if Edge Function limits hit
- QStash for per-user scheduling (morning briefs at individual wake times)
- Database partitioning for health_snapshots (by user_id + month)

**Cost Management (Week 22):**
- Per-user AI cost tracking
- Adaptive model routing based on cost budget
- Rules-based expansion: handle more scenarios without LLM calls
- Batch processing for non-urgent operations

### 3.2 iOS App (Weeks 23-26)

**React Native advantage -- shared codebase for:**
- Dashboard UI, charts, components (100% shared)
- Agent communication layer (100% shared)
- State management, navigation (100% shared)

**iOS-specific native modules:**
- HealthKit integration (Swift native module via Expo Modules API)
- Background App Refresh (iOS equivalent of WorkManager)
- Apple Watch communication (WatchConnectivity framework)
- APNs for push notifications

**Apple Watch Companion (Week 25-26):**
- SwiftUI watch app
- HealthKit real-time HR + HRV streaming
- Complications showing CRS score
- Haptic alerts for stress detection

### 3.3 Advanced AI

**Knowledge Graph (Week 23-24):**
- Entity extraction from conversations (medications, conditions, symptoms, activities)
- Relationship tracking: "magnesium --improves--> sleep", "meetings --trigger--> stress"
- Pattern surfacing: "Your headaches correlate with <6h sleep nights"
- Stored in Postgres (entities + relations tables)
- Agent tool: `query_health_graph` for complex pattern queries

**Adaptive CRS Weights (Week 24):**
- Feedback loop: "Was this stress alert helpful?" -> adjust thresholds
- Per-user weight optimization based on feedback data
- After 15+ feedback events: personalized CRS formula

**Extended Thinking for Deep Analysis (Week 25):**
- User asks "Give me a deep analysis of my month"
- Route to Opus with extended thinking enabled
- Longer timeout (dedicated worker, not Edge Function)
- Rich multi-paragraph response with data-backed insights

**Multi-Language Support (Week 27):**
- System prompt localization
- Skill files in multiple languages
- Agent detects user language from messages

### 3.4 Cloud API Integrations

**Oura REST API (Week 23):**
- Sleep stages, readiness score, HRV, temperature deviation
- Daily webhook or polling
- Rich sleep data without needing watch companion

**Fitbit Web API (Week 24):**
- HR, HRV, SpO2, sleep stages, activity
- OAuth2 flow in app

**WHOOP API (Week 25):**
- Recovery, strain, sleep performance
- Subscription-only (user must have WHOOP membership)

### 3.5 Channel Maturity

**Email Digest (Week 26):**
- Weekly health report as beautiful HTML email
- Resend or SendGrid for delivery
- User configurable: frequency, content sections

**Watch Notifications (Week 26):**
- Stress alerts delivered as watch haptic + glance card
- Morning brief summary on watch face complication

### Agent-App Integration (Phase 3)

```
NEW: CROSS-PLATFORM SYNC:
  Health data from iOS HealthKit / Android Health Connect
  -> Same Supabase backend, same agent pipeline
  -> User switches phones: history and memory preserved
  -> Agent adapts to different data availability per platform

NEW: KNOWLEDGE GRAPH QUERIES:
  User: "Why do I always feel tired on Mondays?"
  -> Agent calls query_health_graph
  -> Finds: Sunday sleep < 6h (3 of last 4 weeks)
  -> Finds: Monday has 4+ meetings (stress trigger)
  -> Finds: Monday HRV baseline 15% below weekly average
  -> Synthesizes: "Your Sunday sleep debt + heavy Monday schedule is a pattern"

NEW: MULTI-DEVICE AGENT:
  Samsung Watch detects HRV drop at 2pm
  -> Phone background sync picks up data
  -> Agent evaluates: stress confidence 0.68
  -> Channel router: user wearing Apple Watch too? Send haptic
  -> Channel router: user in meeting? Queue message for after
  -> Delivers intervention at optimal time via optimal channel

NEW: CLOUD WEARABLE DATA:
  Oura ring syncs overnight
  -> Cloud API webhook hits Supabase Edge Function
  -> Agent has richer sleep data (Oura sleep staging is excellent)
  -> Morning brief includes: "Oura shows 1h45m deep sleep (above your 1h30m baseline)"
```

### Phase 3 Success Criteria
1. iOS app feature-parity with Android (except watch-specific features)
2. Support 100+ concurrent users without degradation
3. Knowledge graph surfaces patterns users hadn't noticed
4. Cloud wearable integrations provide richer data than Health Connect alone
5. Per-user AI cost stays under $1/month at scale
6. App Store and Play Store listings approved

---

## PHASE 4: MATURE (Weeks 29-40)

### Focus: Monetization + Partnerships + Ecosystem

### 4.1 Monetization

**Freemium Model:**
- **Free tier**: Basic CRS, daily morning brief, Telegram/WhatsApp, 1 wearable
- **Pro tier ($4.99/month)**: In-app chat, voice, weekly deep analysis, unlimited wearables, knowledge graph insights, priority AI (Opus for complex queries), email digests, custom skills
- **Family tier ($9.99/month)**: Up to 5 family members, shared insights (opt-in), caregiver notifications

**Revenue targets:**
- 1,000 users, 10% conversion = 100 Pro users = $499/month revenue
- AI costs at 1,000 users: ~$720/month (offset by free tier using Haiku only)
- Break-even: ~200 Pro subscribers

### 4.2 Health Provider Integration

**FHIR/EHR Integration:**
- Read lab results from health providers (with user consent)
- Agent interprets: "Your A1C dropped from 6.1 to 5.8 -- great progress"
- SMART on FHIR for secure data access

**Health Coach Mode:**
- Certified health coaches can view client data (with consent)
- Coach sets goals and protocols via skills system
- Agent enforces coach-defined protocols between sessions
- Revenue: B2B licensing to health coaching platforms

### 4.3 Skills Marketplace

**User-Created Skills:**
- Skill editor in app
- Users share skills (intermittent fasting protocol, marathon training, migraine tracking)
- Review + moderation system
- Revenue: featured skills, premium skills

### 4.4 Advanced Agent Capabilities

**Predictive Health:**
- ML models trained on user's historical data
- "Based on your patterns, you're likely to have a low-energy day tomorrow"
- Proactive recommendations based on predictions, not just current state

**Multi-Agent Collaboration:**
- Specialized sub-agents for complex queries
- Nutrition agent + exercise agent + sleep agent collaborate for holistic recommendation
- Orchestrator agent manages delegation

**Ambient Health Monitoring:**
- Phone sensors (microphone for respiratory rate, camera for HR via PPG)
- Environmental context (weather, air quality, pollen count)
- Location-based insights (gym detected, commute stress patterns)

### Agent-App Integration (Phase 4)

```
FULL VISION:
  Continuous health monitoring from watch + phone + cloud APIs
  -> Real-time CRS with predictive modeling
  -> Agent has full context: health + calendar + email + location + weather
  -> Proactive interventions delivered via optimal channel at optimal time
  -> Agent learns continuously: what works for THIS user
  -> Knowledge graph connects everything: lifestyle -> health outcomes
  -> Weekly Opus-powered deep analysis with actionable insights
  -> Health provider integration: lab results in context
  -> Family awareness: "Your partner's stress is elevated today"
  -> Predictive: "Tomorrow looks like a high-stress day -- here's how to prepare"
```

---

## CHANNEL ADAPTER EVOLUTION (Detailed)

### MVP Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| **Telegram** | grammy bot, webhook Edge Function | Primary conversational channel |
| **WhatsApp** | Cloud API v21.0, webhook Edge Function | Alternative conversational channel |

### Phase 2 Channels (HIGH PRIORITY)

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| **Push Notifications** | FCM (Android), APNs (iOS via Expo Notifications) | Alerts, reminders, brief summaries when user not in chat |
| **In-App Chat** | Supabase Realtime (WebSocket), custom chat UI | Primary channel (replaces Telegram/WhatsApp as default) |
| **Voice** | whisper.rn (STT) + expo-speech (TTS) | Hands-free interaction, voice journaling, accessibility |

### Phase 3 Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| **Email Digest** | Resend API, MJML templates | Weekly health report, monthly summaries |
| **Watch Notifications** | Wear OS tiles, watchOS complications | Glanceable CRS, haptic stress alerts |
| **Smart Widget** | Android widget (Expo custom), iOS widget (WidgetKit) | Home screen CRS gauge with trend |

### Phase 4 Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| **Smart Display** | Web app for tablet/smart display | Bedside health dashboard |
| **Caregiver Alerts** | Push/SMS to designated contacts | Emergency or concerning health events |
| **Health Provider Portal** | Web dashboard | Coach/provider views client health data |

### Channel Router Logic

```
Priority order for message delivery:
1. If user is ACTIVE in in-app chat -> deliver there (real-time)
2. If user has app in foreground -> push notification + in-app
3. If user is in Telegram/WhatsApp session (last 30 min) -> deliver there
4. If message is URGENT (stress alert, emergency) -> push notification (high priority)
5. If message is ROUTINE (morning brief) -> preferred channel from settings
6. If message is LOW PRIORITY (weekly summary) -> in-app chat (no push)

Never duplicate: a message goes to ONE channel only
Preference configurable: user chooses default in settings
Fallback chain: in-app -> push -> telegram -> whatsapp -> email
```

---

## AGENT-APP SYNC ARCHITECTURE (All Phases)

### Data Flow: App -> Agent

| Data | Sync Method | Frequency | Phase |
|------|------------|-----------|-------|
| Health snapshots (HR, HRV, steps, SpO2) | Background sync -> Supabase | Every 15 min | MVP |
| Sleep sessions | Background sync -> Supabase | On wake detection | MVP |
| Raw IBI (Samsung SDK) | Background sync -> computed RMSSD | Real-time on phone | MVP |
| User messages (Telegram/WhatsApp) | Webhook -> Edge Function | Real-time | MVP |
| User messages (in-app chat) | Supabase Realtime | Real-time | Phase 2 |
| Voice input | STT -> text -> Edge Function | Real-time | Phase 2 |
| Oura/Fitbit/WHOOP data | Cloud API webhook/poll | Hourly or on-demand | Phase 3 |
| Lab results (FHIR) | On-demand pull | User-triggered | Phase 4 |

### Data Flow: Agent -> App

| Data | Sync Method | Trigger | Phase |
|------|------------|---------|-------|
| Agent responses | Channel adapter | On agent completion | MVP |
| Core memory updates | Agent tool -> Supabase | During conversation | MVP |
| Health baselines | pg_cron Edge Function | Daily at 4 AM | MVP |
| Conversation summaries | Async after conversation | After session ends | MVP |
| Push notifications | FCM/APNs | On proactive trigger | Phase 2 |
| Weekly insights | Weekly Review Hand | Sunday evening | Phase 2 |
| Knowledge graph updates | Pattern discovery | Weekly | Phase 3 |
| Predictive alerts | ML model inference | When prediction ready | Phase 4 |

### Data Flow: Agent -> Agent (Internal)

| Flow | Method | Phase |
|------|--------|-------|
| Stress Monitor -> Message Sender | pgmq queue | MVP |
| Morning Brief -> Channel Router | pgmq queue | MVP |
| Weekly Review -> Core Memory Update | Direct DB write | Phase 2 |
| Baseline Updater -> Stress Monitor (threshold update) | Postgres table | MVP |
| Pattern Discovery -> Knowledge Graph | Direct DB write | Phase 3 |
| Orchestrator -> Sub-agents | Edge Function calls | Phase 4 |

---

## WHAT TO TRACK: METRICS PER PHASE

### MVP Metrics
- Background sync success rate (target: >95%)
- Stress detection precision (target: >80%)
- Agent response time (target: <5s for Haiku, <15s for Sonnet)
- Daily active users in messaging channels
- Morning brief open rate
- "Was this helpful?" positive rate (target: >70%)

### Phase 2 Metrics
- In-app chat adoption rate (target: 60%+ of interactions)
- Voice usage rate
- Push notification engagement rate (target: >20% tap-through)
- Weekly review read rate
- Semantic memory recall accuracy

### Phase 3 Metrics
- iOS vs Android user split
- Per-user AI cost (target: <$1/month)
- Knowledge graph entity count per user
- Cloud wearable integration adoption
- App Store rating (target: 4.5+)

### Phase 4 Metrics
- Free-to-Pro conversion rate (target: 10%)
- Monthly recurring revenue
- Prediction accuracy (target: >70% for next-day energy prediction)
- Health provider integration usage
- Skills marketplace engagement

---

## SUMMARY: WHAT COMES AFTER MVP

The MVP proves the core loop: **sensor -> score -> AI -> message -> feedback**.

Phase 2 makes it a **complete product**: the app becomes the primary interface (not just Telegram), with push notifications, voice, and deeper health intelligence.

Phase 3 makes it **scalable and cross-platform**: iOS, multi-user infrastructure, knowledge graph, cloud wearable APIs.

Phase 4 makes it **sustainable**: monetization, health provider partnerships, skills marketplace, predictive capabilities.

The agent grows at each phase:
- **MVP agent**: Reactive + 2 proactive triggers (morning brief, stress alert)
- **Phase 2 agent**: + weekly review, semantic memory, full hook pipeline, 6+ skills
- **Phase 3 agent**: + knowledge graph reasoning, adaptive weights, extended thinking, multi-language
- **Phase 4 agent**: + predictive modeling, multi-agent collaboration, ambient awareness

# OneSync -- Costs, Monetization & Phase Roadmap

Last updated: March 15, 2026

> Cost estimates, model comparison, pricing strategy, and complete phase-by-phase roadmap.

---

## Phase Overview

| Phase | Timeline | Focus | Key Milestone | Device Coverage |
|-------|----------|-------|---------------|----------------|
| **Phase 1: MVP** | Weeks 1–8 | Core loop end-to-end | Sensor → Score → AI → Message → Feedback | Samsung GW 6/7 via Health Connect (~25% Android wearables) |
| **Phase 2: Expand** | Weeks 9–20 | Cloud APIs + messaging + richer agent | Garmin, Oura, WHOOP, Fitbit integrated + WhatsApp + push | ~55–60% of global wearables; Samsung raw IBI |
| **Phase 3: Scale** | Weeks 21–32 | iOS + Apple Watch + public launch | App Store launch, HealthKit SDNN variant, public beta | ~80–85% of global wearables |
| **Phase 4: Mature** | Weeks 33–48 | Monetization, enterprise, hardware | Paid tier, team dashboards, OneBand pilot | ~95%+ with Huawei + custom |

> Phase 1 is 8 weeks per MVP_SCOPE.md (overrides earlier 12-week estimates in other docs).

---

## AI Model Cost Comparison (March 2026)

### Per-User Monthly Cost (Single Model, 1500 calls/user/month)

Assumptions: 2K input + 800 output tokens per call, 50% cache hit rate. Exchange rate: Rs 92/USD.

| # | Model | Provider | Input $/MTok | Output $/MTok | Cost/User/Mo | 100 Users/Mo |
|---|-------|----------|-------------|--------------|-------------|-------------|
| 1 | DeepSeek R1 | DeepSeek | $0.12 | $0.20 | **$0.44** | $43.80 |
| 2 | Qwen 2.5-72B | Alibaba | $0.12 | $0.39 | **$0.74** | $73.80 |
| 3 | DeepSeek V3.2 | DeepSeek | $0.28 | $0.42 | **$0.97** | $96.60 |
| 4 | GPT-4o mini | OpenAI | $0.15 | $0.60 | **$1.06** | $105.75 |
| 5 | MiniMax M2 | MiniMax | $0.20 | $1.00 | **$1.65** | $165.00 |
| 6 | MiniMax M2.5 | MiniMax | $0.30 | $1.20 | **$2.12** | $211.50 |
| 7 | Kimi K2 | Moonshot | $0.39 | $1.90 | **$3.17** | $316.50 |
| 8 | GLM-4.5 | Zhipu AI | $0.55 | $2.20 | **$3.89** | $388.50 |
| 9 | Kimi K2.5 | Moonshot | $0.60 | $3.00 | **$4.65** | $465.00 |
| 10 | GLM-5 | Zhipu AI | $1.00 | $3.20 | **$6.09** | $609.00 |
| 11 | Claude Haiku 4.5 | Anthropic | $1.00 | $5.00 | **$7.65** | $765.00 |
| 12 | Qwen 2.5-Max | Alibaba | $2.00 | $6.00 | **$11.70** | $1,170.00 |
| 13 | GPT-5 | OpenAI | $1.25 | $10.00 | **$14.81** | $1,481.25 |
| 14 | GPT-4o | OpenAI | $2.50 | $10.00 | **$17.62** | $1,762.50 |
| 15 | GPT-5.2 | OpenAI | $1.75 | $14.00 | **$20.74** | $2,073.75 |
| 16 | Claude Sonnet 4.5 | Anthropic | $3.00 | $15.00 | **$22.95** | $2,295.00 |
| 17 | Claude Opus 4.6 | Anthropic | $5.00 | $25.00 | **$38.25** | $3,825.00 |

### Visual Cost Comparison (100 Users/Month)

```
DeepSeek R1          | $     43.80 |
Qwen 2.5-72B         | $     73.80 | █
DeepSeek V3.2        | $     96.60 | █
GPT-4o mini          | $    105.75 | ██
MiniMax M2           | $    165.00 | ███
MiniMax M2.5         | $    211.50 | ████
Kimi K2              | $    316.50 | ██████
GLM-4.5              | $    388.50 | ███████
Kimi K2.5            | $    465.00 | █████████
GLM-5                | $    609.00 | ████████████
Claude Haiku 4.5     | $    765.00 | ███████████████
Qwen 2.5-Max         | $  1,170.00 | ███████████████████████
GPT-5                | $  1,481.25 | █████████████████████████████
GPT-4o               | $  1,762.50 | ███████████████████████████████████
GPT-5.2              | $  2,073.75 | █████████████████████████████████████████
Claude Sonnet 4.5    | $  2,295.00 | █████████████████████████████████████████████
Claude Opus 4.6      | $  3,825.00 | ████████████████████████████████████████████████████████████
```
Each block ~ $50/month. DeepSeek V3.2 is **40x cheaper** than Claude Opus 4.6.

### Best Model Picks for OneSync

| Priority | Model | Cost/User/Mo | Why |
|----------|-------|-------------|-----|
| Best Value | DeepSeek V3.2 | $0.97 | Ultra-cheap, strong at math |
| Cheapest | DeepSeek R1 | $0.44 | Reasoning model, cheapest |
| Best Chinese | Qwen 2.5-72B | $0.74 | Strong general purpose |
| Best Balance | GLM-5 | $6.09 | Latest GLM, Feb 2026 |
| Best Quality | Claude Sonnet 4.5 | $22.95 | Balanced performance |
| Premium | Claude Opus 4.6 | $38.25 | Most capable, deep reasoning |

### Model Use Cases in OneSync

| Model | Use Case in OneSync |
|-------|-------------------|
| DeepSeek V3 | Health math, CRS calculation, data processing |
| Qwen 2.5-72B | Core agent reasoning, SOUL.md processing |
| GPT-4o mini | Routine tasks, scheduling, memory operations |
| Claude Haiku 4.5 | Health insights, personalized coaching |
| Claude Opus 4.6 | Deep analysis, crisis detection, weekly reports |

### OneSync Mixed Model Routing (Recommended)

| Model | % Calls | Calls/mo | Monthly Cost/User |
|-------|---------|----------|------------------|
| DeepSeek V3 | 40% | 600 | $0.39 |
| GPT-4o mini | 25% | 375 | $0.26 |
| Qwen 2.5-72B | 20% | 300 | $0.15 |
| Claude Haiku 4.5 | 12% | 180 | $0.92 |
| Claude Opus 4.6 | 3% | 45 | $1.15 |
| **TOTAL** | **100%** | **1500** | **$2.86** |

**49% reduction** from original single-model estimate ($5.58 -> $2.86) by routing 85% of calls to sub-$0.60/MTok models.

### Cost Optimization Levers

1. **Rules-based pre-filter** (skip Claude on normal readings): saves 60-80% of calls
2. **Prompt caching** (80-85% savings on cached tokens): personality + user profile cached
3. **Dynamic tool loading** (5-8 vs 18 tools): saves ~800 tokens/call
4. **Model routing** (cheap models for routine, Claude for critical): 85% of calls on sub-$0.60 models
5. **Session compaction** (summarize conversations): reduces context size

---

## Infrastructure Costs

| Service | Free Tier | Pro Tier | When to Upgrade |
|---------|-----------|----------|-----------------|
| Supabase | 500MB DB, 500K Edge calls | $25/mo | ~200 users |
| Expo EAS | 15 builds/mo | $29/mo | When team grows |
| Telegram Bot API | Free forever | -- | Never |
| Health Connect SDK | Free forever | -- | Never |
| All wearable SDKs | Free | -- | Never |
| Domain + SSL | $18/year | -- | -- |
| Cloudflare Workers | 100K req/day free | -- | Never (for MVP) |
| Vercel (Landing) | Free hobby tier | -- | Never (for MVP) |

### Monthly Operating Cost by User Count

| Users | AI Cost | Infra | Total/mo (USD) | Total/mo (INR) |
|-------|---------|-------|---------------|---------------|
| 10 | $28.64 | $0 | **$28.64** | Rs 2,635 |
| 50 | $143.19 | $0 | **$143.19** | Rs 13,174 |
| 100 | $286.39 | $25 | **$311.39** | Rs 28,648 |
| 500 | $1,431.94 | $25 | **$1,456.94** | Rs 134,038 |
| 1,000 | $2,863.88 | $50 | **$2,913.88** | Rs 268,076 |
| 5,000 | $14,319.38 | $50 | **$14,369.38** | Rs 13,21,982 |

### Total Operating Cost Scenarios (100 Users)

| Scenario | AI Model | Model Cost | Health API | Infra | Total/Mo |
|----------|----------|-----------|-----------|-------|----------|
| Ultra-Lean | DeepSeek V3.2 only | $96.60 | Free (HC SDK) | Free | **$96.60** |
| Budget Chinese | Qwen 2.5-72B only | $73.80 | Free (HC SDK) | Free | **$73.80** |
| Budget + Safety | DeepSeek V3.2 + Claude | $96.60 | Free (HC SDK) | $25 | **$121.60** |
| Mid-Range | GLM-5 only | $609.00 | Free (HC SDK) | $25 | **$634.00** |
| Quality | Claude Haiku 4.5 only | $765.00 | Free (HC SDK) | $25 | **$790.00** |
| Premium | Claude Opus 4.6 only | $3,825.00 | Free (HC SDK) | $25 | **$3,850.00** |

All scenarios use Health Connect SDK (free) for wearable data.

---

## MVP Build Cost (3 Months)

| Category | Cost (INR) | Cost (USD) |
|----------|-----------|-----------|
| Team (solo founder + AI tools) | Rs 20,520 | $223 |
| One-time setup (Play Store, APIs, misc) | Rs 14,420 | $157 |
| API testing (3 months, ~10 users) | Rs 7,904 | $86 |
| Infrastructure | Free | Free |
| **TOTAL** | **Rs 42,844** | **$466** |

### One-Time Setup Breakdown

| Item | Cost (INR) | Cost (USD) |
|------|----------|-----------|
| Google Play Developer | Rs 2,300 | $25 |
| Apple Developer (Phase 2) | Rs 9,200 | $100 |
| API Credits (initial testing) | Rs 920 | $10 |
| Miscellaneous | Rs 2,000 | $22 |

### Team Cost Breakdown

| Role | Monthly Cost (INR) | Months | Total (INR) |
|------|-------------------|--------|-----------|
| Solo Founder (You) | Rs 0 | 3 | Rs 0 |
| UI/UX Freelancer | Rs 15,000 | 1 | Rs 15,000 |
| Claude Code (AI Dev) | Rs 1,840 | 3 | Rs 5,520 |

### Original vs Lean Estimate Comparison

| Metric | Original Estimate | Lean Estimate | Savings |
|--------|------------------|--------------|---------|
| Per-User API Cost | $5.58/mo | $2.86/mo | 49% |
| Team (3-mo MVP) | Rs 9,20,000 | Rs 20,520 | 98% |
| MVP Total Cost | Rs 9,20,000 (~$10,800) | Rs 42,844 (~$466) | 95% |
| 6-Month Runway | Rs 18,50,000 (~$21,724) | Rs 88,868 (~$966) | 95% |
| Primary AI Models | Claude only | DeepSeek + Qwen + GPT-4o-mini + Claude | -- |
| Team Size | 5-6 people | Solo founder + AI tools | -- |

### 6-Month Runway (MVP to Early Traction)

| Month | Phase | Users | API Cost | Infra | Team | Monthly Burn | Cumulative |
|-------|-------|-------|---------|-------|------|-------------|-----------|
| 1 | Build | 0 | Rs 0 | Rs 0 | Rs 6,840 | Rs 21,260 +setup | Rs 21,260 |
| 2 | Build | 0 | Rs 0 | Rs 0 | Rs 6,840 | Rs 6,840 | Rs 28,100 |
| 3 | Build | 5 | Rs 1,317 | Rs 0 | Rs 6,840 | Rs 8,157 | Rs 36,257 |
| 4 | Beta | 20 | Rs 5,270 | Rs 0 | Rs 1,840 | Rs 7,110 | Rs 43,367 |
| 5 | Launch | 50 | Rs 13,174 | Rs 0 | Rs 1,840 | Rs 15,014 | Rs 58,381 |
| 6 | Growth | 100 | Rs 26,348 | Rs 2,300 | Rs 1,840 | Rs 30,488 | Rs 88,868 |

**Total 6-month runway: Rs 88,868 ($966)**

---

## Pricing Strategy

| Plan | Price/mo | API Cost/user | Gross Margin |
|------|----------|--------------|-------------|
| Free (limited) | Rs 0 | $0.29 (Haiku only) | N/A |
| Basic | Rs 299 ($3.25) | $2.86 | 12% |
| Pro | Rs 599 ($6.51) | $2.86 | 56% |
| Premium | Rs 999 ($10.86) | $2.86 | 74% |

**Break-even:** ~200 Pro subscribers ($6.51 x 200 = $1,302/mo revenue vs ~$720 AI cost + $25 infra).

### Phase 4 Monetization Model

- **Free tier**: Basic CRS, daily morning brief, Telegram/WhatsApp, 1 wearable, 5 messages/day
- **Pro ($4.99/mo)**: In-app chat, voice, weekly deep analysis, unlimited wearables, knowledge graph, priority AI (Opus for complex queries), email digests, custom skills
- **Family ($9.99/mo)**: Up to 5 members, shared insights (opt-in), caregiver notifications

Revenue targets:
- 1,000 users, 10% conversion = 100 Pro users = $499/month revenue
- AI costs at 1,000 users: ~$720/month (offset by free tier using Haiku only)
- Break-even: ~200 Pro subscribers

---

## Phase 1: MVP (Weeks 1-12)

### What Gets Built

**App:** React Native + Expo + Kotlin native modules, Health Connect, background sync (WorkManager), CRS on-phone, stress confidence scoring, dashboard (CRS gauge + metrics + sleep + trends), op-sqlite + SQLCipher, NativeWind v4, OEM battery guidance, 5-step onboarding.

**Backend:** Supabase (Postgres, Edge Functions, Auth, RLS), pg_cron, pgmq, pg_notify.

**Agent OS:** Claude Messages API + tool_use, 18 tools, context pipeline, dynamic tool loading, model routing + pre-filter, prompt caching, provider failover, core memory, session compaction, 3 skills (sleep, stress, morning-briefing), safety hooks, output validation.

**Channels:** Telegram (grammy) + WhatsApp (Cloud API) + 6-digit linking.

**Watch:** Samsung Wear OS companion (Kotlin, Sensor SDK, IBI streaming).

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

### 12-Week Build Sequence

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Foundation | Expo project, Kotlin module setup, Supabase schema, Health Connect native module |
| 2 | Data pipeline | Custom SQLite sync, background WorkManager, CRS on-phone, artifact rejection |
| 3 | Dashboard | CRS gauge, metric cards, sleep summary (NativeWind) |
| 4 | Agent core | Claude agent loop, rules pre-filter, weighted stress scoring, 18 tool definitions |
| 5 | Messaging | Telegram bot (grammy), WhatsApp webhook, message queue (pgmq) |
| 6 | Proactive | Morning briefing hand, stress monitor hand, pg_notify for high-priority |
| 7 | Samsung watch | Wear OS companion, Sensor SDK IBI, Wearable Data Layer |
| 8 | Onboarding | 5-step flow, AI interview, linking codes, permissions UX |
| 9 | Polish | History screen, settings, dark mode, error states, empty states |
| 10 | Testing | Self-testing on Samsung + Pixel, false positive tuning, OEM battery testing |
| 11 | Beta prep | Fix critical bugs, submit Health Connect declaration, WhatsApp verification |
| 12 | Beta launch | Deploy to 5-10 beta testers, monitor, iterate |

### MVP Success Criteria

1. Background sync works reliably on Samsung + Pixel (15-min interval)
2. CRS updates every 15 min with available data
3. Stress detection: <20% false positive rate
4. Proactive messages arrive within 2-5 min of detection
5. Conversations feel natural and context-aware
6. Morning briefing includes sleep + calendar + personalized insight
7. Samsung watch streams raw IBI for real-time HRV
8. Works offline -- cached data, syncs when connected
9. Onboarding takes <5 min including AI interview

---

## Phase 2: Expand (Weeks 13-20)

### 2.1 Channel Expansion (HIGH PRIORITY)

**Push Notifications (Week 13-14):**
- Firebase Cloud Messaging (FCM) integration
- Notification types: stress alert, medication reminder, morning brief summary, weekly insight
- Rich notifications with CRS score + quick-action buttons ("Breathe", "I'm OK", "Snooze")
- Notification preferences in app settings (which types, quiet hours, priority levels)
- Fallback channel: if user hasn't opened Telegram in 24h, use push instead
- Channel router logic: prefer messaging -> fallback to push -> never duplicate

**In-App Chat (Week 14-16):**
- Real-time chat UI inside OneSync app
- Supabase Realtime for message delivery (WebSocket-based)
- Chat screen with message bubbles, typing indicator, tool-use visualization
- History view with conversation search
- "Ask OneSync" floating button on dashboard
- Deep-link from push notification -> opens specific chat thread
- Becomes the PRIMARY channel (Telegram/WhatsApp become secondary/backup)

**Voice Interface (Week 17-18):**
- Voice input: Whisper STT (on-device via whisper.rn or cloud via API)
- Voice output: Text-to-speech for agent responses (edge-tts or expo-speech)
- Hands-free mode: "Hey OneSync, how did I sleep?" while driving/exercising
- Voice journaling: "I'm feeling anxious and my head hurts" -> agent records + responds
- Integration with in-app chat (voice messages appear as transcribed text)

### 2.2 Agent Intelligence Upgrades

**Conversation Summaries with Embeddings (Week 13-14):**
- pgvector extension in Supabase for semantic search
- After each conversation session: generate embedding + structured summary
- `memory_search` tool: agent can search past conversations by meaning

**Weekly Review Hand (Week 15):**
- Opus-powered weekly analysis every Sunday
- Reviews all health data, conversation summaries, goal progress
- Updates core memory with new insights and pattern discoveries
- Delivered via in-app chat + push notification

**Enhanced Skills (Week 16-17):**
- nutrition-basics skill: meal logging guidance
- exercise-recovery skill: activity balance, recovery recommendations
- medication-tracking skill: reminder scheduling, interaction awareness
- Custom skill authoring: users define their own health protocols

**Full Hook Pipeline (Week 18):**
- Context injection hook: auto-inject recent vitals, upcoming meds, calendar
- Compaction hook: automatic with quality checks (never lose allergies/medications)
- Analytics hook: track intervention effectiveness, user engagement patterns
- Rate limit hook: per-user daily AI cost budget

### 2.3 Health Intelligence

- **Cumulative sleep debt tracking** (rolling 7d/14d, integrated into CRS)
- **Chronotype estimation** from midpoint-of-sleep
- **Activity-stress disambiguation** (accelerometer context, reduce false positives 30-50%)
- **Health pattern discovery** ("Your HRV drops 18% on days with 3+ meetings")

### 2.4 App Enhancements

- History screen (calendar view, daily details, trend charts)
- Settings expansion (notification prefs, agent personality, data export)
- Android home screen widget (CRS + trend arrow)

### 2.5 Watch Companion Expansion

- Garmin Connect IQ app (Monkey C): HR, IBI, SpO2, temperature, Body Battery

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

## Phase 3: Scale (Weeks 21-28)

### 3.1 Multi-User Infrastructure

**Authentication & Onboarding (Week 21):**
- Google Sign-In + Apple Sign-In
- Onboarding flow optimized from Phase 1 learnings
- Referral system (invite codes)

**Backend Scaling (Week 22):**
- Supabase Pro plan ($25/month)
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

**Shared RN codebase:** Dashboard UI, charts, agent communication, state management (100% shared).

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
- Agent tool: `query_health_graph` for complex pattern queries

**Adaptive CRS Weights (Week 24):**
- Feedback loop: "Was this stress alert helpful?" -> adjust thresholds
- Per-user weight optimization after 15+ feedback events

**Extended Thinking for Deep Analysis (Week 25):**
- Route to Opus with extended thinking enabled
- Longer timeout (dedicated worker, not Edge Function)
- Rich multi-paragraph response with data-backed insights

**Multi-Language Support (Week 27):**
- System prompt localization, skill files in multiple languages

### 3.4 Cloud API Integrations

- **Oura REST API** (Week 23): Sleep stages, readiness score, HRV, temperature deviation
- **Fitbit Web API** (Week 24): HR, HRV, SpO2, sleep stages, activity
- **WHOOP API** (Week 25): Recovery, strain, sleep performance

### 3.5 Channel Maturity

- **Email Digest** (Week 26): Weekly HTML report via Resend/SendGrid
- **Watch Notifications** (Week 26): Haptic + glance card on Wear OS/watchOS

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

## Phase 4: Mature (Weeks 29-40)

### 4.1 Monetization

- Freemium model (free tier Haiku-only, Pro tier full AI)
- Revenue target: 1,000 users, 10% conversion = $499/mo
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

## Channel Adapter Evolution (Detailed)

### MVP Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| Telegram | grammy bot, webhook Edge Function | Primary conversational channel |
| WhatsApp | Cloud API v21.0, webhook Edge Function | Alternative conversational channel |

### Phase 2 Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| Push Notifications | FCM (Android), APNs (iOS via Expo Notifications) | Alerts, reminders, brief summaries |
| In-App Chat | Supabase Realtime (WebSocket), custom chat UI | Primary channel (replaces Telegram as default) |
| Voice | whisper.rn (STT) + expo-speech (TTS) | Hands-free, voice journaling, accessibility |

### Phase 3 Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| Email Digest | Resend API, MJML templates | Weekly health report, monthly summaries |
| Watch Notifications | Wear OS tiles, watchOS complications | Glanceable CRS, haptic stress alerts |
| Smart Widget | Android widget (Expo), iOS widget (WidgetKit) | Home screen CRS gauge with trend |

### Phase 4 Channels

| Channel | Implementation | Use Case |
|---------|---------------|----------|
| Smart Display | Web app for tablet/smart display | Bedside health dashboard |
| Caregiver Alerts | Push/SMS to designated contacts | Emergency or concerning health events |
| Health Provider Portal | Web dashboard | Coach/provider views client health data |

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

### Channel Router Evolution Summary

```
MVP:       Telegram -> WhatsApp (fallback)
Phase 2:   In-App Chat -> Push -> Telegram -> WhatsApp
Phase 3:   In-App -> Push -> Telegram -> WhatsApp -> Email -> Watch
Phase 4:   + Smart Display, Caregiver Alerts, Provider Portal
```

---

## Agent-App Sync Architecture (All Phases)

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
| Baseline Updater -> Stress Monitor (threshold update) | Postgres table | MVP |
| Weekly Review -> Core Memory Update | Direct DB write | Phase 2 |
| Pattern Discovery -> Knowledge Graph | Direct DB write | Phase 3 |
| Orchestrator -> Sub-agents | Edge Function calls | Phase 4 |

---

## Metrics to Track

### MVP
- Background sync success rate (target: >95%)
- Stress detection precision (target: >80%)
- Agent response time (target: <5s Haiku, <15s Sonnet)
- Daily active users in messaging channels
- Morning brief open rate
- "Was this helpful?" positive rate (target: >70%)

### Phase 2
- In-app chat adoption rate (target: 60%+ of interactions)
- Voice usage rate
- Push notification engagement rate (target: >20% tap-through)
- Weekly review read rate
- Semantic memory recall accuracy

### Phase 3
- iOS vs Android user split
- Per-user AI cost (target: <$1/month)
- Knowledge graph entity count per user
- Cloud wearable integration adoption
- App Store rating (target: 4.5+)

### Phase 4
- Free-to-Pro conversion rate (target: 10%)
- Monthly recurring revenue
- Prediction accuracy (target: >70% for next-day energy)
- Health provider integration usage
- Skills marketplace engagement

---

## Backend Scaling Path

| Phase | Architecture |
|-------|-------------|
| MVP (0-200) | Supabase only (Edge Functions + pg_cron + pgmq) |
| Growth (200-1K) | + QStash for scheduling + consider Inngest for workflows |
| Scale (1K+) | + dedicated worker service (Railway/Fly.io) for agent loops |

---

## Agent Growth Per Phase

```
MVP agent:     Reactive + 2 proactive triggers (morning brief, stress alert)
Phase 2 agent: + weekly review, semantic memory, full hook pipeline, 6+ skills
Phase 3 agent: + knowledge graph reasoning, adaptive weights, extended thinking, multi-language
Phase 4 agent: + predictive modeling, multi-agent collaboration, ambient awareness
```

---

## NOTES & RECOMMENDATIONS

### 1. Chinese Model Quality Risk
DeepSeek/Qwen handle 85% of calls in the mixed routing model. If their quality for health-critical reasoning is insufficient, costs double overnight. Mitigate: build a quality evaluation harness in Week 4 -- test all models against 50 health scenarios, measure accuracy before committing to routing percentages.

### 2. The Solo Founder Burnout Risk
12 weeks of solo full-stack + AI + wearable SDK + messaging bot is a LOT. This is the biggest unlisted risk. Mitigate: ruthlessly cut scope to core loop, use Claude Code as force multiplier, set weekly milestones, don't optimize prematurely.

### 3. Free Tier Sustainability
At Rs 0.29/user/month for free tier (Haiku only), 1000 free users costs $290/month with $0 revenue. Cap free tier aggressively: 1 morning brief/day, 5 messages/day, no proactive stress alerts. Make the value difference between free and Pro obvious.

### 4. The $399/mo Terra API is Never Needed
Health Connect + direct SDKs achieve 96% data coverage at $0. Terra's value is only in reducing development time for cloud API integrations. Given that each cloud API takes ~1 week to integrate, the math never works out for Terra at MVP scale.

### 5. Cost Discrepancy Between Documents
The CRITIQUE_AND_RISKS.md notes ~$0.72/user/month (Claude-only estimate) vs $2.86/user/month (mixed routing in this doc). The discrepancy comes from different assumptions: the $0.72 estimate assumed 4 Haiku + 1.5 Sonnet calls/day, while the $2.86 estimate assumes 50 calls/day (1500/month). The real number depends on how aggressively the rules-based pre-filter works. Target: $0.50-1.00/user/month after pre-filter optimization.

### 6. Revenue Before Scale
Don't wait for 1000 users to monetize. Launch Pro tier at 50 users. Even 5 paying users at Rs 599/month validates willingness to pay and covers a significant portion of costs. Early revenue = extended runway = less pressure.

### 7. Phase 2 is the Real Product
MVP proves the core loop works. Phase 2 (in-app chat + push + voice + weekly insights) is when OneSync becomes a real product people would pay for. Budget time for Phase 2 -- don't let MVP scope creep eat into it.

### 8. Hardware Convergence (See HARDWARE_STRATEGY.md)
Phases 1-2 are pure software. Phase 3-4 is when custom hardware (OneBand + ear module) enters the picture. The software architecture must remain hardware-ready: sensor abstraction layer, device_id/sensor_location fields, multi-device fusion logic. Don't code yourself into a corner that only works with Health Connect.

### 9. Key Assumptions & Risks
- Solo founder handles all development using Claude Code / AI-assisted coding
- 50% prompt cache hit rate (SOUL.md, BODY.md, MEMORY.md are highly cacheable)
- DeepSeek V3 and Qwen 2.5 quality is sufficient for health data processing
- Free tiers (Supabase, Cloudflare, Expo) cover MVP needs up to ~100 users
- Beta testers recruited from IIT network (free)
- No founder salary during 3-month MVP build
- Supabase pauses inactive free projects after 7 days -- set up a keep-alive cron job

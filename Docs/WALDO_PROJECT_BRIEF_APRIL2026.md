# Waldo — Project Brief
### April 15, 2026 · First Deadline Review

*Where we started. What we built. How we built it. Where we stand now. What comes next.*

---

## The One-Line Summary

Waldo is a personal AI agent that reads your body from your wearable, computes your cognitive readiness, and acts proactively — messaging you before you know something is wrong. Not a health tracker. The biological intelligence layer for the AI agent economy.

---

## Part 1 — Where This Started

### The Founding Insight

March 2026. The agent economy was exploding — Lindy raised $50M, OpenClaw hit 170K stars, YC declared nearly half its latest batch was AI agents. Every agent being built could manage your calendar, draft your emails, book your meetings. None of them knew when you were burning out.

The insight: **every agent built today is a brain without a body.** They optimize your output without understanding your input. Your calendar says you have twelve focused hours. Your HRV says your nervous system has been recovering for three days. No AI caught that gap.

The second insight: **wearables already collect the most intimate data in existence, and do nothing with it.** Hundreds of millions of people wear devices that measure them all night, open an app in the morning, glance at a score, and make the exact same decisions they were going to make anyway. A dashboard is a mirror. It shows you what already happened. Waldo acts on what comes next.

The founding question: *what if the AI that manages your life started not from your calendar, but from your heartbeat?*

### Why Now

| Signal | What It Meant |
|--------|--------------|
| YC 2026: 50% of batch is AI agents | Agent economy is the mandate |
| 62% of knowledge workers report burnout (HBR) | Demand is real and growing |
| WHOOP added proactive nudges | Market validation — but single-device, in-app only |
| Apple scaled back Health+ (Feb 2026) | The big player blinked |
| Claude Haiku 4.5: $1/$5 per MTok | Economics work at consumer price points |
| Health Connect reached 500M Android devices | The data infrastructure exists |

The window was open. Not wide — Nori (YC, two-exit founders) was live on the App Store. Prana (YC W26) was building. ChatGPT Health had 230M weekly users. But the quadrant of **proactive + channel-delivered + scientifically grounded + device-agnostic + evolving agent** was still empty.

### The First Decision

Build from the data up. Not from the UI down. Phase A0: parse real health data, validate the algorithm, understand what the numbers actually mean before writing a single line of UI or agent code. This decision shaped everything that followed.

---

## Part 2 — What We Built

### The Numbers (April 15, 2026)

| Layer | Files | Lines of Code |
|-------|-------|--------------|
| Health Parser + CRS Engine | 31 TypeScript files | 7,957 |
| Web Console (Dashboard) | 40+ TypeScript/React files | 13,198 |
| Supabase Edge Functions | 35 functions | 10,770 |
| Cloudflare Worker Agent | 8 TypeScript files | 3,161 |
| React Native Mobile App | 50+ files | 6,978 |
| **Total Source Code** | **160+ files** | **~42,064 lines** |

Documentation: 20+ documents, 15,000+ lines, covering vision, architecture, algorithms, brand, adapters, infrastructure, competitor research.

### Layer 1 — The Intelligence Engine (Phase A0, Complete)

The foundation everything rests on. Built before any UI, any agent, any product.

**Health Parser** — A streaming XML parser that processes 289MB of Apple Health data in 2.2 seconds. Extracts 12 data types from 683,000 records. The basis for all CRS computation.

**CRS Engine — The Cognitive Readiness Score**

The core algorithm, grounded in SAFTE-FAST (US Army fatigue science, used to clear astronauts for spaceflight):

```
CRS = (Sleep Score × 35%) + (HRV Score × 25%) + (Circadian Score × 25%) + (Activity Score × 15%)

Where:
  Sleep Score    = duration + efficiency + deep% + REM% + bedtime consistency + debt
  HRV Score      = RMSSD vs personal 30-day baseline (time-of-day normalized)
  Circadian Score= wake time alignment + chronotype + bedtime shift
  Activity Score = steps + exercise minutes + stand hours + energy balance
```

Validated on 856 days of real data (Ark's Apple Health export). CRS range: 30–89 observed, average 73 on rich days. Not a guess. Grounded science.

**What Else Gets Computed on Every Day:**
- Day Strain (0–21 WHOOP-style, TRIMP-based, from HR zone minutes)
- Sleep Debt (14-day weighted rolling, repayment modeled at 0.5x rate)
- Stress Events (confidence-scored: HRV drop × HR elevation × duration × sedentary penalty)
- Spots Engine (1,498 individual observations across 843 days)
- Pattern Detector (long-term correlations: "Monday afternoons → HRV drops after 3 meetings")
- User Intelligence Profile (cross-day routine analysis, personal baselines, chronotype)

**Stress Detection**

The trigger for Fetch Alerts. A confidence score:

```
Confidence = 0.35×HRV_drop + 0.25×HR_elevation + 0.20×duration + 0.20×sedentary

≥0.60 → Fetch Alert fires
≥0.80 → HIGH alert
Must sustain 10+ minutes. 2-hour cooldown. Maximum 3 per day.
```

219 alert-level stress events detected across 149 days of real data. 2 high-confidence patterns surfaced automatically.

### Layer 2 — The Agent (Phase C/D, Built and Deployed)

The intelligence engine connects to Claude Haiku 4.5 through a 25-field prompt builder and a 10-hook pipeline.

**Architecture: Hexagonal from Day 1**

The adapter pattern is the moat. Every external boundary — messaging channel, AI model, health data source, storage, weather, calendar, email, tasks, music, screen time — sits behind an interface. Swapping Telegram for WhatsApp, Claude for DeepSeek, Apple Watch for a Garmin requires zero changes to agent logic. The agent calls the adapter. The adapter calls the provider.

```
Core Logic (pure TypeScript, zero external deps)
  ├── CRS Engine
  ├── Stress Detection
  ├── Agent Reasoning (prompt builder, 10 hooks, quality gates)
  └── Delivery Orchestration (pre-filter, cooldown, nudge system)
         │
         ▼
Adapter Layer (implementations swap freely)
  ├── HealthDataSource  → HealthKit (iOS) | Health Connect (Android) | ExportParser
  ├── LLMProvider       → Claude Haiku | fallback chain (4 levels)
  ├── ChannelAdapter    → Telegram | WhatsApp | Discord | Slack | in-app
  ├── StorageAdapter    → op-sqlite + SQLCipher | DO SQLite
  ├── CalendarProvider  → Google Calendar | Outlook | Apple Calendar
  ├── EmailProvider     → Gmail | Outlook (metadata only, never content)
  ├── TaskProvider      → Todoist | Notion | Linear | Google Tasks
  ├── MusicProvider     → Spotify | YouTube Music | Apple Music
  ├── ScreenTimeProvider→ RescueTime
  └── WeatherProvider   → Open-Meteo (weather + AQI, free, no API key)
```

**The 13 Agent Tools**

The agent doesn't just send messages — it acts:

| Tool | What It Does |
|------|-------------|
| `get_crs` | Read today's cognitive readiness score and zone |
| `get_sleep` | Sleep metrics, stages, debt, last 7 days |
| `get_stress_events` | Stress events with confidence, severity, duration |
| `get_activity` | Steps, exercise, strain, zone minutes |
| `get_calendar` | Events, meeting load, focus gaps |
| `get_tasks` | Pending, overdue, velocity, urgency queue |
| `get_email_load` | Volume, after-hours ratio, response pressure |
| `read_memory` | Access episodic + semantic memory (DO SQLite) |
| `update_memory` | Write to agent memory with validation |
| `send_message` | Deliver via any channel adapter (idempotent) |
| `propose_action` | Create calendar/task proposals for user approval |
| `search_episodes` | FTS5 full-text search across all past episodes |
| `get_user_profile` | Baselines, chronotype, preferences, connected sources |

**The Rules Pre-Filter**

60–80% of all trigger checks never reach Claude. A cheap TypeScript pre-filter runs first:

```
CRS > 60 AND stress_confidence < 0.3 → SKIP (no message needed)
CRS < 50 OR stress_confidence > 0.6 → FIRE (immediate alert)
Morning Wag: always fires at wake time
Between checks: scheduled pg_cron every 15 minutes
```

This is the cost efficiency engine. 96 daily background checks per user. Most cost $0.

**The Cloudflare Durable Objects Agent**

Phase D migration complete. Each user now has a persistent Durable Object — a long-running process with its own SQLite database. The agent brain moved from stateless Edge Functions to permanent per-user memory.

```
cloudflare/waldo-worker/src/
  agent.ts     — ReAct loop, 25-field prompt builder, 10-hook pipeline, soul files
  tools.ts     — All 13 tool implementations
  memory.ts    — 5-tier memory architecture (working/semantic/episodic/procedural/archival)
  workspace.ts — R2 workspace files (capabilities.md, profile.md, baselines.md, today.md)
  llm.ts       — LLMProvider with 4-level fallback chain + circuit breaker
  scheduler.ts — DO alarms (Morning Wag, Patrol, cooldowns)
  types.ts     — Shared type contracts
  index.ts     — Router Worker (routes to correct user's DO)
```

**5-Tier Memory Architecture**

| Tier | Type | Storage | Always Loaded? |
|------|------|---------|----------------|
| 0 | Working | Context window | Yes (volatile) |
| 1 | Semantic | DO SQLite `memory_blocks` | Yes (<200 tokens) |
| 2 | Episodic | DO SQLite `episodes` → R2 after 90d | On-demand |
| 3 | Procedural | DO SQLite `procedures` | On evolution |
| 4 | Archival | Supabase pgvector (Phase 2) | Semantic search |

Raw health values never enter DO memory. Only derived insights.

**The 35 Edge Functions**

| Category | Functions |
|----------|-----------|
| **Health sync** | `health-import`, `sync-google-fit`, `bootstrap` |
| **Integrations** | `oauth-google`, `oauth-spotify`, `oauth-todoist`, `oauth-strava`, `oauth-linear`, `oauth-notion` |
| **Data sync** | `sync-google-calendar`, `sync-gmail`, `sync-tasks`, `sync-spotify`, `sync-strava`, `sync-youtube-music`, `sync-rescuetime`, `sync-linear`, `sync-notion`, `sync-todoist` |
| **Agent** | `invoke-agent`, `check-triggers`, `execute-proposal`, `build-intelligence`, `nightly-consolidation`, `weekly-compaction`, `baseline-updater` |
| **Delivery** | `telegram-bot`, `whatsapp-bot`, `tts`, `voice-transcribe` |
| **Infrastructure** | `user-register`, `user-profile`, `admin`, `mcp-server`, `disconnect-provider` |

### Layer 3 — The Dashboard (Web Console, Built)

The Figma-designed web console at `tools/waldo-demo/`. The full product UI — not a prototype.

**20 Dashboard Components:**

| Component | What It Shows |
|-----------|--------------|
| **TheBrief** | Hero card with Morning Wag text, mascot, 🔊 audio playback (Groq TTS → browser fallback) |
| **FormCard** | CRS/Form radial gauge, 3-pillar breakdown (Recovery/CASS/ILAS), pillar drag attribution |
| **SleepCard** | Hypnogram (deterministic from real stage proportions), 4-stage bars, sleep debt strip |
| **LoadCard** | Day Strain bullet graph (0–21), zone bars, 7-day avg reference line |
| **HRVCard** | 30-day line chart with personal baseline band, "Strong/Normal/Dipping/Low" badge |
| **RestingHRCard** | 7-day sparkline, trend label, athletic classification |
| **SleepScoreCard** | Stepped line, 4 stat pills (duration/deep/REM/efficiency) |
| **SleepDebtCard** | 7-day stepped debt accumulation, direction arrow |
| **CircadianCard** | 24-hour arc, wake drift, energy wave |
| **MotionCard** | Segmented bars (steps/exercise/stand) |
| **BodyReadings** | SpO2 (alert only when <95%), respiratory rate |
| **TodaysBriefCard** | 3-block daily timeline (Morning/Midday/Afternoon) with calendar events and Waldo actions |
| **TheHandoff** | Proposal approval card with "Run it." + "Walk me through it first" (voice states: listening → processing → confirmed) → "Already on it." |
| **TheWindowCard** | Focus window protection — "9:30–11:00am · Prime focus · Protected ✓" |
| **ThePatrol** | Timestamped action log of every Waldo decision |
| **TheSlopeCard** | 4-week dumbbell plot across 6 dimensions (Body/Schedule/Comms/Tasks/Mood/Screen) |
| **SignalDepthCard** | Segmented arc showing connected sources (9/10) |
| **FetchCard** | Stress event timeline |
| **WaldoCalendar** | Calendar integration view |
| **DailyScheduleCard** | Today's schedule with meeting load score |

**The Demo Page** (`/demo`) — A pure synthetic showcase. No auth, no Supabase. Shows the full product at peak state (Form 87, great sleep, protected window, plan ready, 9/10 signal depth, all dimensions improving). Built for investor demos and presentations.

### Layer 4 — The Mobile App (Foundation Built)

`waldo-app/` — React Native + Expo SDK 53+, 6,978 lines across 50+ files.

Architecture: New Architecture (Fabric + TurboModules), NativeWind v4, Zustand + TanStack Query + MMKV, op-sqlite + SQLCipher for health data.

The CRS engine runs on-phone, TypeScript, offline-capable. No server round-trip needed to compute your score.

Status: Foundation complete. HealthKit (iOS) and Health Connect (Android) integration in progress (Phase B).

---

## Part 3 — How We Built It

### The Process

**Research Before Code.** Every feature started with a literature review or competitive analysis. The CRS formula is grounded in SAFTE-FAST. The stress detection weights came from academic peer review. The architecture patterns came from reverse-engineering Claude Code (1,905 files), OpenClaw (170K stars), Hermes Agent (38K stars), MemPalace (28.5K stars), and 12 other production agent systems.

**Validate Before Scale.** Phase A0 ran CRS on 856 days of real data before a single user-facing feature was built. We knew the algorithm worked before we touched the UI.

**Build → Break → Fix → Repeat.** Nothing ships without qa-breaker approval. Nothing ships without handling null HRV, watch disconnect, 0 sleep data, 3 Fetch alerts in 10 minutes, Samsung not writing HRV to Health Connect, OEM battery kills. Edge cases first. Happy path second.

**Adapter Pattern from Day 1.** Never a quick win that creates long-term lock-in. Every external integration — messaging, AI model, health data, storage — goes behind an interface. This took discipline early. It's the moat now.

### The Session-by-Session Evolution

| Session | Date | What Got Built |
|---------|------|---------------|
| **0 — Foundation** | March 2026 | Architecture locked. Vision crystallized. Brand finalized. CRS formula grounded in SAFTE-FAST. |
| **1 — Parser Core** | March 2026 | Streaming XML parser (289MB in 2.2s), 12 data type extractors, CSV/JSON writers. |
| **2 — Phase A0 Complete** | March 2026 | CRS engine, stress detector, Day Strain, Sleep Debt, Pattern Detector, Spots engine, User Intelligence, weather enrichment, agent simulation. 7,818 lines. 856 days validated. |
| **3 — End-to-End Demo** | March 2026 | Supabase schema, Claude agent with 8 tools, Telegram bot, web dashboard, mobile foundation. First time Waldo actually talked back. |
| **4 — Deep Research** | March 31, 2026 | Claude Code reverse-engineering (1,905 files). 18 architectural upgrades identified. Cloudflare Durable Objects locked as Phase D runtime. 5-tier memory architecture designed. MCP server as strategic moat confirmed. Nori competitive analysis. |
| **5 — Infrastructure** | April 2026 | DO agent deployed. R2 workspace. Cross-domain intelligence (all 6 dimensions). 13 tools. ReAct loop. Pre-filter. Proposal pipeline. |
| **6 — Full Figma Build** | April 2026 | All 20 dashboard cards built to Figma spec. Real data wired everywhere. HRV badge, CRS % vs baseline, sleep minutes vs usual, pillar drag, yesterday comparisons. |
| **7 — Voice + TTS + Demo** | April 2026 | 🔊 TTS (Groq PlayAI Fritz → browser fallback), 🎙 voice input (Groq Whisper), full demo page, TheWindowCard, TheHandoff voice states. |
| **8 — Audit + Polish** | April 2026 | Dead code removed. Hardcoded data replaced with real data everywhere. Figma gap audit. Signal Depth fixed. All cards show real data or hide gracefully. |

### The Commits Tell the Story

```
641cd35  feat: demo page + TheWindowCard + TheHandoff voice states
b18c74d  fix: write capabilities.md at provision time for all new users
24d7f16  fix: remove all hardcoded/synthetic data — BodyReadings, Tier2Cards, LoadCard
638eb75  fix: sleep hypnogram identical every day + stage percentages over 100%
15ee388  feat: voice input + TTS audio brief
a8c748b  feat: Today's Brief timeline + agent soul + capabilities.md
0c896d4  feat: The Slope — 4-week direction dumbbell plot
3e8e7ff  feat: real baselines + yesterday comparisons + HRV badge
65ccd58  feat: DO agent — waldo_actions, R2 archival, propose_action, search_episodes
ffc565f  feat: voice STT, proposal approvals, day context, MCP server
ae5533e  feat: full cross-domain agent — all 6 dimensions wired
52ce079  feat: FormCard pillar engine — real Recovery/CASS/ILAS breakdown
```

---

## Part 4 — Current State (April 15, 2026)

### What's Live and Working

| Capability | Status | Notes |
|-----------|--------|-------|
| CRS computation | ✅ Live | Runs on real Apple Health + Google Fit data |
| Morning Wag | ✅ Live | Delivered via Telegram, generated by Claude Haiku 4.5 |
| Fetch Alerts | ✅ Live | Stress-triggered proactive messages with 2h cooldown |
| Web Dashboard | ✅ Live | All 20 cards, real data, Figma-spec design |
| Google Calendar sync | ✅ Live | Meeting load, focus gaps, event timeline |
| Gmail sync | ✅ Live | Volume, after-hours ratio, thread depth (metadata only) |
| Google Tasks sync | ✅ Live | Pending, overdue, velocity, urgency queue |
| Spotify sync | ✅ Live | Mood inference from audio features |
| Strava sync | ✅ Live | Workout data enriches Day Strain |
| Telegram bot | ✅ Live | Two-way conversation with Waldo |
| Voice input | ✅ Live | Groq Whisper STT → transcript → Waldo |
| TTS audio brief | ✅ Live | Groq PlayAI Fritz → browser audio fallback |
| Proposal pipeline | ✅ Live | Waldo proposes actions → user approves → executes |
| Cloudflare DO agent | ✅ Live | Per-user persistent agent brain |
| 5-tier memory | ✅ Live | Working → Semantic → Episodic → Archival |
| R2 workspace | ✅ Live | capabilities.md, profile.md, baselines.md, today.md |
| Multi-user support | ✅ Live | Multiple users, admin console |
| Demo page (/demo) | ✅ Live | Synthetic peak-day showcase, no auth required |
| Signal Depth | ✅ Live | Real connection state, 9/10 when all connected |
| Health XML import | ✅ Live | Upload Apple Health export, CRS computed immediately |
| MCP server | ✅ Deployed | `/mcp-server` Edge Function (getCRS, getStressLevel) |
| WhatsApp bot | ✅ Deployed | Needs WhatsApp Business API secrets |

### What's In Progress

| Capability | Status | Blocker |
|-----------|--------|---------|
| HealthKit (iOS native) | Phase B1 | Build Phase B1 |
| Health Connect (Android native) | Phase B2 | Build Phase B2 |
| Background sync (15-min) | Phase B | Needs native modules |
| Mobile onboarding | Phase F | Needs native data first |
| WhatsApp delivery | Deployed, needs config | 3 Supabase secrets |
| Nightly consolidation | Deployed | Needs Phase D complete |
| Loops email integration | Designed | Phase D |

### Signal Depth: What Sources Are Connected

Waldo reads from up to 10 sources. The more connected, the richer the intelligence:

| Source | What It Gives Waldo |
|--------|-------------------|
| Apple Health / Android (XML upload) | HRV, sleep stages, resting HR, steps, SpO2, respiratory rate |
| Google Calendar | Meeting load, focus gaps, back-to-back detection, schedule density |
| Gmail | Communication load, after-hours ratio, volume spikes, response pressure |
| Google Tasks | Task pile-up, velocity, overdue count, urgency queue |
| Spotify | Mood score via audio features (valence, energy, tempo) |
| Strava | Workout data, activity enrichment, training load |
| Telegram | Two-way conversation, response patterns |
| Weather + AQI | Environmental context (Open-Meteo, free, always connected) |

### Current Intelligence Output Quality

On a fully-connected user (8/10 sources), Waldo computes:

- **32 metrics** across 6 dimensions (Body, Schedule, Communication, Tasks, Mood, Screen)
- **Daily Cognitive Load Score** (meeting load + communication + task + sleep debt)
- **Burnout Trajectory Score** (3-component: recovery balance, sustained load, sleep consistency)
- **Resilience Score** (HRV consistency, sleep quality, recovery speed)
- **Cross-Source Insights** (calendar + HRV + sleep → "board prep correlates with +8% HRV next morning")
- **Pattern Detection** (auto-surfaced correlations from 30+ days of multi-source data)

---

## Part 5 — The Brand

### The Identity

| Element | Value |
|---------|-------|
| **Name** | Waldo — always Waldo. Never "Waldo AI," never "WALDO." |
| **Tagline** | "Already on it." — not a marketing line. A description of what the product does. |
| **Mascot** | A dalmatian. Warm, loyal, always watching, always ahead. The visual metaphor for the product. |
| **Positioning** | The AI that reads your smartwatch and handles things before you notice they need handling. |

### The Brand Promise

"Already on it." contains the entire brand. Waldo doesn't wait. Waldo doesn't ask. Waldo has already done it. Every surface — every message, loading state, empty state, error — should echo this.

### Colors

| Token | Value | Use |
|-------|-------|-----|
| Background | `#FAFAF8` | Warm cream — not white, not gray |
| Accent | `#F97316` | Orange — urgency, life, energy |
| Text | `#1A1A1A` | Near-black with warmth |
| Positive | `#D1FAE5` / `#34D399` | Mint green — peak zone, success |
| Zone: Peak | `#34D399` (mint) | CRS 80–100 |
| Zone: Moderate | `#FBBF24` (amber) | CRS 65–79 |
| Zone: Low | `#F87171` (rose) | CRS < 65 |

### Typography

| Role | Font |
|------|------|
| Display / Headlines | Corben (serif, warmth, editorial weight) |
| Body / UI | DM Sans (geometric, clean, functional) |

### Waldo's Voice

**Warm, specific, actionable. Not clinical, not coaching.**

The dalmatian metaphor does the work. Waldo is the buddy who happens to know your biology. Not a doctor. Not an assistant. A buddy.

Good: *"Bit of a rough night — your sleep was short by about 40 minutes. I've nudged your 9am to 10:30. Nothing drastic."*

Bad: *"CRS 47. Your HRV ran 12% below your 30-day baseline overnight."*

**Banned words:** wellness, mindfulness, optimize, hustle, AI-powered, health tracker, unlock your potential, empower, journey, holistic.

### Waldo Moods (The Mascot System)

The dalmatian's visual state mirrors your CRS zone:

| Zone | State | Mascot |
|------|-------|--------|
| Peak (80–100) | Tail wagging, bright | `good-light-mode.svg` |
| Moderate (65–79) | Alert, focused | `on-it-light-mode.svg` |
| Low (<65) | Ears down, gentle | `rough-light-mode.svg` |
| No data | Watching, curious | `watching-light-mode.svg` |
| Processing | Head tilted, thinking | `thinking-light-mode.svg` |

### The Naming System

| What You Say Internally | What Users See | What It Is |
|------------------------|----------------|-----------|
| Morning brief | Morning Wag | Daily biological briefing |
| Fetch Alert | Fetch Alert / Fetch | Proactive stress intervention |
| CRS | Form / Nap Score | Daily cognitive readiness number |
| Spot | Spot | Single data pattern observation |
| Background analysis | The Patrol | 24/7 continuous monitoring |
| Pattern map | The Constellation | Months of Spots connected |
| Stress detection engine | The Sniff | Body-first signal detection |
| Proposal approval card | The Handoff | Waldo → user action approval |
| Focus window | The Window | Best uninterrupted time stretch |
| Trend view | The Slope | 4-week direction across dimensions |
| Free tier | Pup | Morning Wag + basic Spots |
| Pro tier | Pro | Full Patrol, Fetches, interventions |
| Team tier | Pack | Multiple Waldos, shared Constellations |

---

## Part 6 — Future Capabilities

### The Three Layers

**Layer 1 — Biology (MVP: Built)**

Read body signals from any wearable. Compute CRS offline. Detect stress. Deliver Morning Wag and Fetch Alerts. The core retention loop.

*What's left:* Native HealthKit + Health Connect integration (live data, 15-min sync vs. XML upload). This is Phase B.

**Layer 2 — Context (Phase 2)**

Connect biology to your world. Calendar awareness unlocks meeting triage. Email metadata awareness unlocks communication load. Task integration unlocks workload balancing. Together: the agent can do things neither a health app nor a productivity agent can do alone.

Full connector ecosystem: 213+ tools across 27 categories, 196 with APIs, 47 with MCP servers. Target: 15 core connectors (all already scaffolded in supabase/functions/).

**Layer 3 — Agency (Phase 3+)**

The user teaches Waldo through conversation. Skills accumulate. The agent proposes new skills. The agent executes without being asked. Natural language cron. GEPA evolutionary self-improvement (ICLR 2026 Oral paper). The agent gets smarter every night during Dreaming Mode.

### The Dreaming Mode Pipeline

Every night at 2am local time, while you sleep:

1. **Consolidate** — Raw episodes → diary entry → memory_blocks (always runs, Phase D)
2. **Promote** — Diary entry → validated patterns (when evidence threshold met)
3. **Pre-compute** — Tomorrow's Morning Wag context ready in <3s on wake
4. **Evolve** — Apply accumulated behavioral parameter changes (Phase G)
5. **Deep Mine** — Weekly: cross-domain pattern discovery, Constellation update
6. **Self-Improve** — GEPA: reads execution traces, proposes skill mutations (Phase 3+)

Cost: ~$0.002/user/day ($0.06/month). Competitive advantage that compounds nightly.

### The Moat: Waldo as Body API

The endgame isn't an app. It's a layer.

Waldo exposes biological intelligence via MCP (Model Context Protocol) — 97M installs, the fastest-growing developer protocol in history. When Cursor asks if you're cognitively ready for a complex refactor, when Lindy checks if 4pm is a good time for your investor call, when your calendar agent wants to know if you can handle a board meeting tomorrow — they ask Waldo.

Not competing with the agent ecosystem. Powering it from underneath.

**`getCRS()`** — What's your cognitive readiness right now?
**`getStressLevel()`** — Is the user under acute stress?
**`getCognitiveWindow()`** — When is the next high-quality focus window?
**`getSleepDebt()`** — How depleted is the body?
**`getRecoveryOutlook()`** — When will the user be back at baseline?

The MCP server is already deployed (`/mcp-server` Edge Function). The protocol is live.

### The Data Flywheel

| Time | What Waldo Knows |
|------|-----------------|
| Day 1 | Population defaults. Functional but generic. |
| Week 2 | Personal baselines. CRS becomes yours. |
| Month 1 | Feedback loop active. Agent tunes to your responses. |
| Month 3 | Deep patterns. Agent knows your stress triggers and recovery aids. |
| Month 6 | Predictive. Agent anticipates tomorrow based on today. |
| Year 1 | The agent knows you better than you know yourself. Switching cost: total. |

Every thumbs-up, every thumbs-down, every Fetch Alert dismissed — labeled training data that no competitor in the world has. Subjective cognitive performance correlated with biometric signals, at scale.

### Near-Term Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| **B1** | iOS HealthKit native module + BGTaskScheduler 15-min sync | Next |
| **B2** | Android Health Connect + WorkManager | After B1 |
| **C** | 3-step mobile onboarding (wearable → channel → profile) | After B2 |
| **D** | Complete DO migration + Dreaming Mode Phase 1 | After C |
| **E** | Code Mode (81% token reduction), pre-activity Spot, voice interface | After D |
| **F** | Polish, Waldo Moods full implementation, deep Constellation | After E |
| **G** | Agent self-evolution, natural language cron, skills system | After F |
| **H** | Beta launch | ~6 months |

**First milestone:** 5 daily users. Agent sending ≥1 useful proactive message per person per day. Users replying. CRS updating every 15 minutes. No critical bugs for 7 days.

---

## Part 7 — The Opportunity

### Why This Is a Real Business

**Market size:** 500M+ smartwatch users globally. 230M people already asking AI about health weekly (ChatGPT Health). The habit exists. The behavior exists. The hardware exists. The intelligence layer doesn't.

**Price point:** Free tier (acquisition) → Rs 399/mo Pro ($4.34, 79% margin) → Rs 999/mo/seat Team (92% margin). Break-even: 50 Pro subscribers. Comfortable profitability at 200. Capital efficient by design.

**Unit economics:**
- Rules pre-filter: 60–80% of triggers cost $0
- Claude Haiku 4.5 with prompt caching (1h TTL)
- Code Mode Phase E: 81% further token reduction
- Total at scale: $0.01–$0.03/user/day all-in

**Total MVP build cost (Shivansh estimate): ~$966 USD.** 50–150x more capital-efficient than average health tech MVP ($50K–$150K).

### The Competition Summary

| Player | Strength | Gap |
|--------|----------|-----|
| WHOOP Coach | Best recovery data | $17–30/mo, single-device, in-app only |
| Oura Advisor | Best sleep data | Reactive only, single-device |
| Nori (YC F25) | Strong founders, multi-wearable | iOS only, no real-time alerts |
| Lindy | Beautiful agent architecture | Zero biological awareness |
| ChatGPT Health | 230M users | Purely reactive (you ask, they answer) |
| **Waldo** | **The empty quadrant** | **Proactive + channel + science + device-agnostic + evolving** |

### The Raise

**Pre-seed target:** Rs 50L–1Cr ($55K–$110K)

**Use:** 6 months runway + iOS polish + first hire + academic CRS validation

The academic validation of the CRS algorithm (clinical HRV study partnership) is the moat nobody can buy their way past. A published, peer-reviewed correlation between CRS and cognitive performance is worth more than any patent.

---

## Appendix — Documentation Index

| Document | Purpose | Lines |
|----------|---------|-------|
| `WALDO_NORTHSTAR.md` | Vision, founding insight, why now | 144 |
| `WALDO_ONEPAGER.md` | Pitch deck narrative | 146 |
| `WALDO_MASTER_REFERENCE.md` | The complete build reference | 1,800+ |
| `WALDO_AGENT_INTELLIGENCE.md` | Agent OS: 25-field prompt, 10-hook pipeline, memory | 1,437 |
| `WALDO_RESEARCH_AND_ALGORITHMS.md` | CRS science, SAFTE-FAST validation | 535 |
| `WALDO_ADAPTER_ECOSYSTEM.md` | 10 adapters, 32 metrics, 23 capabilities | 299 |
| `WALDO_DESIGNER_BRIEF.md` | Brand, colors, typography, Waldo Moods | — |
| `WALDO_BRAND_STANDARDS_V2.md` | Full brand standards document | — |
| `WALDO_SCALING_INFRASTRUCTURE.md` | Cloudflare DO architecture, cost model | — |
| `WALDO_EMAIL_INFRASTRUCTURE.md` | Loops email platform, Stripe integration | — |
| `WALDO_ROLLOUT_STRATEGY.md` | Phase 0–4 distribution strategy | — |
| `WALDO_FULL_VISION_BRAINSTORM.md` | 7 life domains, 67 micro-automations | — |
| `WALDO_CONNECTOR_ECOSYSTEM.md` | 213+ connectors, MCP servers, A2A | — |
| `MVP_SCOPE.md` | Definitive MVP: IN/OUT, success criteria | — |
| `MVP_ENGINEERING_PRD.md` | Engineering specs | — |
| `WALDO_STARTUP_COMPETITIVE_LANDSCAPE.md` | Full competitor analysis | — |
| `CLAUDE.md` | Agent operating instructions (full system) | — |
| `.claude/rules/` | Architecture, coding standards, security, phase orchestration | 4 files |

---

## The One Thing to Remember

*Every AI agent being built today knows what you have to do. Waldo knows who you are.*

Body first. Context next. Then everything else.

**Already on it.**

---

*Waldo · April 15, 2026 · First Deadline · v1.0*

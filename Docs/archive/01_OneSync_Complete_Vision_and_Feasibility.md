# OneSync — Complete Vision, Cognitive Co-Pilot Design & Technical Feasibility

> **"Every AI agent knows your calendar. Only OneSync knows your body."**
> **OneSync — Your AI co-pilot that reads your body.**

*Last updated: March 4, 2026*

---

## Table of Contents

1. [What Is OneSync](#1-what-is-onesync)
2. [The Four Pillars](#2-the-four-pillars)
3. [The Agent OS — 11-File Markdown Configuration System](#3-the-agent-os--11-file-markdown-configuration-system)
4. [Health Algorithms — The Biology Intelligence Layer](#4-health-algorithms--the-biology-intelligence-layer)
5. [Technical Architecture — How It's Built](#5-technical-architecture--how-its-built)
6. [Cross-Platform Communication](#6-cross-platform-communication)
7. [Device Strategy — Phone to Glasses to Wrist](#7-device-strategy--phone-to-glasses-to-wrist)
8. [Multi-Agent Coordination & A2A Protocol](#8-multi-agent-coordination--a2a-protocol)
9. [Agent Paradigms Borrowed — What We Learned From 12+ Frameworks](#9-agent-paradigms-borrowed--what-we-learned-from-12-frameworks)
10. [Feasibility Audit — Can We Actually Build Everything We're Claiming?](#10-feasibility-audit--can-we-actually-build-everything-were-claiming)
11. [MVP Specification — What Gets Built in 10-15 Days](#11-mvp-specification--what-gets-built-in-10-15-days)
12. [Phased Roadmap — MVP to Platform](#12-phased-roadmap--mvp-to-platform)

---

## 1. What Is OneSync

OneSync is the first **Cognitive Co-pilot** — a personal agent where biology intelligence is the unfair advantage.

It's not a health app. It's not a calendar AI. It's a **persistent personal co-pilot** — like Lindy (~$50M raised, Lindy 3.0 + Enterprise HIPAA) or what Meta is building with Manus ($2B acquisition, integrated into Ads Manager in 7 weeks) — but with a superpower no one else has: it understands your body's rhythms, stress levels, cognitive performance, and energy patterns, and uses that understanding to make every decision smarter.

**Paradigm alignment:** Our markdown-driven Agent OS (SOUL.md, MEMORY.md, BODY.md, AGENTS.md) directly extends the CLAUDE.md / MEMORY.md paradigm established by Anthropic's Claude Code — the most battle-tested pattern for persistent AI configuration. This isn't just inspired by the ecosystem; it's built to be native to it.

**External positioning: "Cognitive Co-pilot."** We deliberately avoid "Agent OS" in public-facing materials. Investors and knowledge workers respond to "co-pilot" — it implies collaboration, not replacement. Internally, the architecture IS a general-purpose Agent OS (markdown-driven configuration, multi-agent coordination, A2A protocol, progressive autonomy, cross-platform communication). Biology intelligence is a module — the first and most powerful one — but the platform can eventually support any domain of personal assistance.

**The wedge:** We enter the market as "your AI co-pilot that reads your body" — targeting burned-out knowledge workers and startup founders who already wear a smartwatch but get zero actionable value from the data. We expand into "everyone's AI chief of staff" as the platform matures.

---

## 2. The Four Pillars

### Pillar 1: Biology Intelligence
The algorithms that translate raw biometric data (heart rate, HRV, sleep stages, steps, skin temperature) into actionable insights: cognitive readiness scores, circadian phase estimation, stress detection, mental wellbeing monitoring, and task-cognition matching.

### Pillar 2: Autonomous Agent
The Agent OS — an 11-file markdown-driven configuration system that defines who the agent is (SOUL.md), how it behaves (AGENTS.md), when it acts proactively (HEARTBEAT.md), what it remembers (MEMORY.md), and how it coordinates with other agents (TEAMS.md). Progressive autonomy from L0 (Observer) to L3 (fully autonomous Agent).

### Pillar 3: Cross-Platform Communication
The agent doesn't live in one app. It communicates via Telegram, WhatsApp, Slack, email, push notifications, and eventually voice. It manages conversations across surfaces while maintaining a unified context.

### Pillar 4: Memory & Learning
Three-tier memory inspired by OpenClaw: daily interaction logs (short-term), core memory (long-term patterns), and compaction (automatic summarization of old data into persistent insights). The agent gets smarter about YOUR biology over weeks and months.

---

## 3. The Agent OS — 11-File Markdown Configuration System (10 Original + BODY.md)

This is the heart of OneSync's architecture. Inspired by OpenClaw, pi-mono, Claude Code, CrewAI, and OpenAI Agents SDK, we use a set of human-readable markdown files to configure every aspect of the agent's identity, behavior, and capabilities.

### 3.1 File Directory Structure

```
~/.onesync/
├── SOUL.md              ← WHO the agent IS
├── IDENTITY.md          ← HOW the agent PRESENTS itself
├── USER.md              ← WHO the user IS (preferences, identity)
├── BODY.md              ← WHAT the user's BODY says (biological profile, baselines, CRS calibration)
├── AGENTS.md            ← WHAT the agent DOES (behavioral rules)
├── BOOTSTRAP.md         ← HOW the agent STARTS (boot sequence)
├── HEARTBEAT.md         ← WHEN the agent ACTS autonomously
├── TOOLS.md             ← WHAT the agent CAN USE (MCP server manifest)
├── TEAMS.md             ← WHO ELSE EXISTS (sub-agents, A2A peers)
├── MEMORY.md            ← WHAT the agent REMEMBERS (long-term)
├── memory/
│   ├── 2026-03-01.md    ← Daily interaction logs
│   ├── 2026-03-02.md
│   └── ...
└── skills/
    ├── morning-brief/   ← Installable skill packages
    ├── stress-check/
    └── sleep-coach/
```

### 3.2 SOUL.md — Core Identity

Defines the agent's personality, values, communication style, and hard boundaries. Loaded first, every session. Inspired by OpenClaw's SOUL.md and CrewAI's "backstory" concept.

**OneSync-specific elements:**
- Health-sensitivity encoding ("never guilt-trip about health choices")
- Progressive trust model ("respect autonomy levels, ask before acting until trusted")
- Biology-informed communication ("adapt message length to user's current cognitive state")
- Safety boundaries ("never make medical diagnoses, flag patterns and suggest professionals")

### 3.3 IDENTITY.md — Presentation Layer

Separates identity (name, avatar, emoji, voice style) from soul (values, behavior). Allows the agent to present differently across platforms (Telegram vs WhatsApp vs push notification vs Ray-Ban voice) without changing its core behavior.

### 3.4 USER.md — User Profile + Health Baseline

The most OneSync-unique file. Contains standard user info (name, timezone, preferences) PLUS health baselines auto-computed by our algorithms: resting HR, average HRV, chronotype, stress baseline, sleep patterns, cognitive peak hours, known stress triggers. Auto-updated by the biology intelligence layer.

### 3.5 AGENTS.md — Behavioral Instructions

The primary instruction file. Defines the decision framework (check biometrics BEFORE suggesting schedule changes), communication rules (max notifications per 30 min), escalation rules (health anomaly = immediate, routine insight = batch into next check-in), and tool usage priorities.

### 3.6 BOOTSTRAP.md — Initialization Sequence

**"Time to Magic" under 24 hours.** We do NOT require a 3-day baseline period before the agent becomes useful. Instead:

**First-run onboarding (< 5 minutes):**
1. Request Health Connect permissions
2. Pull whatever historical data exists (most watches have 7-30 days stored)
3. If historical data exists → compute personal baselines immediately
4. If no historical data → use **population-level defaults** (resting HR ~65bpm, HRV RMSSD ~40ms for 25-35 age group, 7.5h average sleep) as starting point
5. Set up Telegram, schedule first heartbeat
6. **Agent is live and useful on Day 0**

The population defaults are "good enough" to deliver real value immediately. The CRS might be ±15% off initially, but the user still gets biometric-triggered stress interventions, circadian estimation from sleep/wake times, and proactive communication within hours — not days. Personalization improves continuously as data accumulates.

**Session start:** Load files in order: SOUL → USER → AGENTS → MEMORY → today's log → HEARTBEAT → pull biometrics → compute scores → ready.

**Context window management:** If context approaches 80% capacity, trigger memory compaction — summarize oldest interactions into MEMORY.md, clear daily logs older than 7 days.

### 3.7 HEARTBEAT.md — Proactive Task Schedule (THE HERO FEATURE)

The agent's autonomous task list. Combines time-based crons (inspired by OpenClaw) with **biometric triggers** (novel to OneSync). **Biometric triggers are the hero feature** — the thing that makes people say "holy shit, this is different." The morning brief is useful, but a stress intervention that arrives exactly when your HRV drops is unforgettable.

**Biometric triggers (LEAD with these in demos and pitch):**
- HRV drops >20% below baseline → **immediate stress intervention** ("Your stress just spiked. You have a 10-minute gap before your next call — want a 3-minute breathing exercise or should I suggest rescheduling?")
- No movement for 90 min during a predicted high-CRS window → movement nudge with context ("You've been in deep focus for 90 min. Your CRS is still at 74 — perfect for 5 more minutes, then a quick walk.")
- Sleep score <60 → adjusted morning brief with recovery focus + automatic rescheduling suggestions for high-demand tasks
- Resting HR >15% above baseline for 30+ min → gentle check-in ("Your heart rate has been elevated. Everything okay?")

**Time-based crons (supporting features, not the hero):** 07:00 morning brief, 12:00 midday stress check, 21:00 evening wind-down, Sunday 20:00 week preview.

This is what makes OneSync's heartbeat unique — it's not just a cron job, it's a **biologically-reactive scheduling system.** The demo moment is always the biometric trigger, never the morning brief.

### 3.8 TOOLS.md — Available Capabilities

Lists all tools the agent can use: biometric tools (read_heart_rate, read_hrv, read_sleep, compute_crs, compute_circadian_phase, compute_stress_level), communication tools (send_telegram, send_push_notification), calendar tools (get_events, suggest_reschedule, find_free_slots), and memory tools (save_to_memory, recall_memory, compact_daily_log).

Also contains the A2A Agent Card (Phase 3) — a JSON-compatible capability description that lets other agents discover what OneSync can do.

### 3.9 TEAMS.md — Multi-Agent Coordination

Defines sub-agents (Health Analyst on Haiku for cheap number crunching, Communication Manager for message drafting, Research Agent for meeting prep), handoff rules (always return to Core after sub-agent completes), and A2A external agents (Phase 3).

### 3.10 Skills Directory — Installable Packages

Skill packages that bundle heartbeat rules, message templates, and domain-specific logic. Examples: morning-brief, stress-coach, sleep-optimizer, meeting-prep, jet-lag-recovery, marathon-training. Inspired by OpenClaw's ClawHub and pi-mono's npm-publishable packages.

### 3.11 Boot Sequence Flow

```
BOOTSTRAP.md triggers
    → Load SOUL.md (personality)
    → Load IDENTITY.md (presentation)
    → Load USER.md (user context + health baselines)
    → Load AGENTS.md (behavioral rules)
    → Load MEMORY.md (long-term knowledge, first 200 lines)
    → Load today's daily log (short-term context)
    → Load TOOLS.md (capabilities)
    → Check HEARTBEAT.md (due proactive tasks)
    → Pull latest biometric data from Health Connect
    → Compute CRS, stress level, circadian phase
    → Load TEAMS.md (sub-agents ready)
    → AGENT RUNNING
```

---

## 4. Health Algorithms — The Biology Intelligence Layer

### 4.1 Cognitive Readiness Score (CRS) — ~150 LOC

**What it does:** Combines HRV, sleep quality, activity, and time-of-day into a single 0-100 score predicting cognitive performance right now.

**Inputs:** resting_hr, current_hr, hrv_rmssd, sleep_score (0-100), steps_last_hour, hours_since_wake, personal_baselines

**Formula:** weighted composite of HRV ratio (40%), sleep score (30%), activity factor (15%), circadian factor (15%), with exponential decay after 14h awake.

**Research backing — honest assessment:** Systematic review of 20 studies (BMC Medicine, 2024) finds HRV is *associated* with cognitive performance, but effect sizes are modest. Single-metric HRV prediction (e.g., "82.4% accuracy") comes from controlled lab conditions — real-world consumer wearable accuracy is significantly lower. Oura's readiness score: HRV explains <5% of variance in subjective readiness; resting HR explains 29%. Cross-device agreement is also limited — WHOOP and Oura HRV measurements correlate at only r=0.41.

**Why this doesn't kill our thesis — it IS our thesis:** The moat is NOT single-metric HRV prediction. The moat is **multi-signal interpretation via LLM reasoning.** Google's PHIA (Personal Health Information Agent) achieves 84% accuracy on health reasoning benchmarks — not by reading one number, but by reasoning across multiple signals with contextual awareness. That's exactly what OneSync does: combine HRV + sleep quality + activity + circadian phase + user feedback into a holistic CRS via Claude's reasoning. No single metric is a magic bullet; the intelligence is in the interpretation layer.

**API availability:** Google Health Connect provides HR, HRV (RMSSD), sleep stages, steps. Apple HealthKit provides equivalent. All inputs are available from standard smartwatches (Galaxy Watch, Pixel Watch, Apple Watch, Fitbit, Garmin, WHOOP, Oura). Wearable data aggregation is commoditized: Terra API ($399/mo, 150+ devices), Sahha.ai ($4M raised, 300+ devices, AI-derived scores), Vital/Junction (500+ devices, $0.50/user/mo).

### 4.1.1 Prediction-Accuracy Feedback Loop — ~80 LOC (NEW)

**What it does:** Lets users validate CRS predictions with a simple thumbs up/down on every proactive suggestion. "I said your CRS is 72 and suggested deep work. Did that feel right?" The user taps 👍 or 👎, optionally adds a quick note.

**Why this matters:**
- **Closes the calibration loop.** Population-level defaults are our starting point (see Time-to-Magic strategy in Section 3.6). Without feedback, personalization depends entirely on passive biometric data. With feedback, the CRS weights (HRV 40%, sleep 30%, activity 15%, circadian 15%) can adapt per-user within 2-3 weeks.
- **Creates engagement.** Every thumbs-up reinforces trust. Every thumbs-down makes the next prediction better. Users feel invested in the agent's accuracy.
- **Generates defensible data.** Over time, we accumulate the largest dataset of subjective cognitive performance correlated with biometric data. This is a moat.

**Implementation:**
- Store feedback in `crs_feedback` table: `(user_id, timestamp, predicted_crs, user_rating, context_note)`
- Weekly batch job (Haiku) adjusts per-user CRS weights based on accumulated feedback
- Target: 5 feedback points/day passively (one per proactive suggestion)
- Accuracy target: CRS prediction accuracy improves from ~70% (population defaults) to ~85% (personalized) within 30 days

**LOC:** ~80 (feedback UI component: ~30, storage + API: ~20, weight adjustment algorithm: ~30)

### 4.2 Circadian Phase Estimator — ~200 LOC

**What it does:** Estimates the user's internal body clock position relative to standard 24h cycle, predicting energy peaks and valleys.

**Method:** Based on Borbély's two-process model (the gold standard in sleep science). Process S (sleep pressure) increases exponentially during wake, decays during sleep. Process C (circadian oscillation) modeled as a sinusoid with a period derived from the user's actual sleep/wake times.

**Inputs:** sleep_onset_times (7-day array), wake_times (7-day array), current_time

**Output:** circadian_phase (0-24h), predicted_peak_hours, predicted_dip_hours, chronotype classification

**API availability:** Sleep onset/wake times are available from Health Connect (sleep session data) and HealthKit. Works with any wearable that tracks sleep.

### 4.3 Stress Detector — ~80 LOC

**What it does:** Real-time stress level estimation from HRV features.

**Method:** Compute RMSSD (root mean square of successive differences) from RR intervals, compare to personal baseline. Stress = deviation below baseline + rate of change.

**Inputs:** hrv_samples (last 5 min), resting_hrv_baseline, current_activity_level

**Output:** stress_level (0-1), stress_trend (increasing/decreasing/stable), duration_elevated

**Research backing:** HRV-based stress detection is well-established in clinical settings. RMSSD drops 15-30% during acute stress. However, consumer wearable accuracy varies — our approach combines HRV deviation with activity context and temporal patterns rather than relying on a single threshold. The CRS Feedback Loop (Section 4.1.1) continuously calibrates stress sensitivity per-user.

**API availability:** Health Connect provides HRV data (RMSSD) from compatible watches. Samsung Galaxy Watch 4+ and Google Pixel Watch provide continuous HRV. Apple Watch provides HRV via HealthKit.

### 4.4 Mental Wellbeing Monitor — Phase 2

**What it does:** Tracks trends in sleep regularity, HRV baseline drift, activity patterns, and social engagement to flag potential wellbeing concerns.

**Why Phase 2:** Requires 30+ days of baseline data to be meaningful. MVP focuses on acute signals (CRS, stress), Phase 2 adds longitudinal trend analysis.

**Research backing:** AI models predict depressive episodes with 91% accuracy from wearable data patterns (Lee et al.). Personalized models outperform generalized ones (Nature).

### 4.5 Task-Cognition Matching — Phase 2

**What it does:** Matches pending tasks to optimal time slots based on cognitive demand + predicted CRS.

**Example:** "Write investor email" (high cognitive demand) → schedule during predicted CRS peak. "Respond to Slack messages" (low demand) → schedule during circadian dip.

---

## 5. Technical Architecture — How It's Built

### 5.1 Stack

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| Mobile App | React Native + Expo | Cross-platform, fast iteration, Expo EAS for builds |
| Backend | Supabase (Postgres + Edge Functions + Auth + Realtime) | One platform replaces 4 services (DB + API + Auth + Realtime) |
| AI Engine | **Claude Agent SDK** + Claude API (tool_use) | Agent loop with subagent spawning, model selection per subagent, built-in tool orchestration. Eliminates need for LangGraph/LangChain entirely |
| AI Models | **Claude Opus 4.6** (complex reasoning, 1M-token context beta, 128K output, $5/$25 per MTok) + **Claude Sonnet 4.6** (core agent, $3/$15 per MTok) + **Claude Haiku 4.5** (sub-agents, $0.80/$4 per MTok) | Model routing: Haiku for health data crunching, Sonnet for core agent loop, Opus for complex multi-step reasoning |
| Context Mgmt | **Prompt Caching** (90% input discount, 1-hour extended TTL) + **Compaction API** (beta, server-side context summarization) | Prompt caching slashes cost for repeated SOUL.md/AGENTS.md system prompts. Compaction API replaces our custom memory compaction with server-side summarization |
| Tool Layer | **Model Context Protocol (MCP)** — 97M monthly SDK downloads, 28% Fortune 500 adoption, 75+ connectors, donated to Linux Foundation AAIF | MCP replaces custom tool definitions with standardized tool discovery and invocation. Our TOOLS.md becomes an MCP server manifest |
| Health Data | Google Health Connect SDK (Android), HealthKit (iOS Phase 2), **Terra API / Sahha.ai** (data aggregation layer) | Health Connect for direct access; Terra/Sahha for 150-300+ device coverage without per-device integration |
| Messaging | Telegram Bot API (MVP), WhatsApp Business API (Phase 2) | Free, 2B+ users, rich bot API. Note: WhatsApp has 24-hour response window constraint for business-initiated messages |
| Wearable Ext. | Meta Wearables Device Access Toolkit (Phase 3+) | Camera, mic, speakers on Ray-Ban Display |

### 5.2 Agent Loop Architecture (Claude Agent SDK)

```
[Trigger] → heartbeat cron / user message / health webhook / A2A request / MCP event
    ↓
[Context Assembly]
    Load: SOUL + USER + AGENTS + BODY.md + recent MEMORY + current biometrics
    Prompt caching: SOUL.md + AGENTS.md cached (90% discount, 1h TTL)
    Compute: CRS, stress_level, circadian_phase
    ↓
[Claude Agent SDK — Agent Loop]
    System prompt: assembled from SOUL.md + AGENTS.md (cached)
    User context: from USER.md + BODY.md + MEMORY.md + biometrics
    Tools: from TOOLS.md as MCP server manifest
    Model selection: Sonnet 4.6 (core) / Haiku 4.5 (sub-agents) / Opus 4.6 (complex reasoning)
    ↓
[ReAct Loop with Subagent Spawning]
    Claude Agent SDK manages: tool calls → observe → decide → subagent handoff
    Subagents: Health Analyst (Haiku), Comms Manager (Haiku), Research (Sonnet)
    Each subagent has scoped tools and model selection
    ↓
[Context Management]
    If context > 80%: Compaction API (server-side summarization) replaces manual memory compaction
    Long conversations: interleaved thinking for complex health reasoning
    ↓
[Output]
    Send via appropriate channel (Telegram, push, voice)
    Log interaction to daily memory file
    Update USER.md / BODY.md if new pattern learned
```

### 5.3 Supabase Schema (MVP)

```sql
-- Core tables
user_profiles (id, user_id, name, timezone, preferences_json, health_baselines_json, autonomy_level)
heartbeat_rules (id, user_id, rule_text, schedule_cron, trigger_type, enabled)
agent_interactions (id, user_id, date, role, content, importance_score, compacted)
core_memory (id, user_id, category, content, confidence, last_updated)
health_snapshots (id, user_id, timestamp, hr, hrv_rmssd, steps, sleep_score, crs, stress_level, circadian_phase)

-- RLS policies: users can only access their own data
-- Edge Functions: heartbeat_cron, process_message, compute_health, compact_memory
```

### 5.4 Cost Structure

| Item | Monthly Cost |
|------|-------------|
| Supabase Pro | $25/mo |
| Claude API (~50 calls/day/user, Sonnet 4.6 + Haiku 4.5 routing, with prompt caching) | ~$120/mo for 100 users (prompt caching reduces repeated system prompt costs by 90%) |
| Telegram Bot API | Free |
| Expo EAS Build | $0 (free tier) |
| Domain + misc | $15/mo |
| **Total for 100 users** | **~$160/mo** |
| **Per-user cost** | **~$1.60/mo** |

At $15/mo pricing → 87% gross margin at 100 users. Scales better with more users (Supabase fixed cost amortizes). With prompt caching (90% discount on cached system prompts), per-user API costs drop further at scale.

### 5.5 BODY.md — The Biological Profile (NEW)

Extending Anthropic's CLAUDE.md / MEMORY.md paradigm, we introduce **BODY.md** — a persistent markdown file that encodes the user's biological profile, auto-updated by the biology intelligence layer.

**Contents:**
- **Baselines:** Resting HR, average HRV (RMSSD), sleep averages, step patterns, chronotype classification
- **Health goals:** User-defined targets (sleep 7.5h, reduce stress episodes, walk 8K steps)
- **Wearable patterns:** Device-specific data quality notes, sampling rates, known gaps
- **Circadian preferences:** Computed peak hours, predicted dip windows, chronotype (early bird/night owl/neutral)
- **CRS calibration:** Current per-user weight adjustments from the Feedback Loop (HRV weight, sleep weight, etc.)
- **Sensitivity flags:** Known stress triggers, recovery patterns, seasonal variations

**Why a separate file (not just USER.md):** USER.md stores identity and preferences (name, timezone, communication style). BODY.md stores biological state that changes daily. Separating them allows the agent to update BODY.md on every health snapshot without touching the stable USER.md. It also mirrors the CLAUDE.md hierarchy pattern — each file has a clear, scoped purpose.

**Auto-update cadence:** BODY.md baselines recalculate weekly. Circadian preferences update daily. CRS calibration weights update after every weekly batch job. Health goals are user-editable.

---

## 6. Cross-Platform Communication

### 6.1 Channel Roadmap

| Channel | Phase | API/Method | Feasibility |
|---------|-------|-----------|-------------|
| Telegram | MVP | Bot API (free, unlimited) | ✅ Available now, well-documented |
| Push Notifications | MVP | Expo Push + FCM/APNs | ✅ Standard mobile infra |
| WhatsApp | Phase 2 | WhatsApp Business API | ✅ Available, requires business verification. **Note:** 24-hour response window for business-initiated messages — proactive heartbeat messages must use approved templates |
| Slack | Phase 2 | Slack Bot API | ✅ Available, generous free tier |
| Email | Phase 2 | IMAP/SMTP or SendGrid | ✅ Standard protocols |
| SMS | Phase 2 | Twilio API | ✅ Available, pay-per-message |
| Meta Ray-Ban Voice | Phase 3 | Wearables Device Access Toolkit | ✅ SDK released, publishing opens 2026 |
| Google Calendar | Phase 2 | Google Calendar API | ✅ Available, OAuth required |
| iMessage | Phase 3 | Apple Business Chat | ⚠️ Requires Apple approval |

### 6.2 Unified Context Model

All channels share a single conversation context via Supabase Realtime. A conversation started on Telegram can continue via push notification and be followed up on WhatsApp — the agent maintains full context. This is inspired by OpenClaw's WebSocket gateway pattern but implemented via Supabase's built-in Realtime subscriptions.

---

## 7. Device Strategy — Data Layer First, Hardware Second

### 7.0 Wearable Data Aggregation Layer (Phase 2)

The wearable data layer is commoditized. Rather than building individual integrations for every device, we leverage aggregation APIs in Phase 2:

| Provider | Devices | Cost | Key Feature |
|----------|---------|------|-------------|
| **Terra API** | 150+ devices (Samsung partnership) | $399/mo | Widest coverage, real-time webhooks |
| **Sahha.ai** | 300+ devices | $4M raised, per-user pricing | AI-derived health scores, SDK-first |
| **Vital** | 500+ devices | $0.50/user/mo | Most devices, HIPAA compliant |
| **Junction** | 500+ devices | Per-user pricing | Open-source friendly |

**MVP: Direct Health Connect integration** (zero cost, fastest path). **Phase 2: Add Terra or Sahha** for instant 150-300+ device support without per-device integration work. This lets us focus engineering effort on the intelligence layer (where our moat is) rather than plumbing.

### 7.1 MVP Focus: ONE Wearable Ecosystem

Instead of supporting "any Health Connect watch" for MVP, we pick **one primary wearable** and optimize the experience for it. This lets us:
- Test against a known HRV sampling rate and data quality
- Create device-specific onboarding guides and marketing materials
- Build a community of users with the same hardware (easier debugging, shared experiences)
- Showcase consistent demo results (investor demos always work with the same device)

**Primary MVP device: Samsung Galaxy Watch 5/6** (recommended) OR **Oura Ring Gen 3** (alternative).

**Why Galaxy Watch 5/6:** Best-in-class continuous HRV sampling via Health Connect (every 10 min), largest Android wearable market share (~30%), $179-$279 price range accessible to knowledge workers, SpO2 + skin temperature sensors, continuous HR monitoring. Samsung Health data feeds directly into Health Connect with no additional API needed.

**Why Oura Ring as alternative:** Best sleep tracking in the market (gold standard for consumer sleep staging), HRV measured during sleep (most accurate window), readiness score that maps naturally to our CRS, $299 ring + $5.99/mo subscription — users are already paying for health data and frustrated it doesn't DO anything. Oura API v2 (cloud-based, OAuth2) is well-documented and reliable.

**Decision:** Choose one before MVP sprint starts. Both are excellent. Galaxy Watch = broader data (continuous daytime HR/HRV), Oura = deeper sleep data (best sleep staging). For burned-out knowledge workers, sleep quality is often the pain point → Oura may resonate more. For real-time stress detection during work → Galaxy Watch wins.

### 7.2 Device Compatibility Matrix

| Device | Data We Get | What We Do With It | Phase | API Available? |
|--------|-----------|-------------------|-------|---------------|
| **Android Phone** | Compute, communication, calendar | Core agent runtime | MVP | ✅ Native |
| **Samsung Galaxy Watch 5/6** (PRIMARY) | HR, HRV, sleep, steps, SpO2, temp | Biology intelligence inputs | MVP | ✅ Health Connect |
| **Oura Ring Gen 3** (ALTERNATIVE PRIMARY) | HRV, sleep stages, readiness, temp | Biology intelligence inputs | MVP | ✅ Oura API v2 |
| **Other Health Connect watches** | HR, HRV, sleep, steps | Biology intelligence inputs | Phase 2 | ✅ Health Connect |
| **Apple Watch** | HR, HRV, sleep, steps, SpO2 | Biology intelligence inputs | Phase 2 | ✅ HealthKit |
| **WHOOP** | HRV, strain, recovery, sleep | Enhanced biology data | Phase 2 | ✅ WHOOP API |
| **Garmin** | HR, HRV, Body Battery, sleep, stress | Enhanced biology data | Phase 2 | ✅ Garmin Connect API |
| **iPhone** | Compute, communication, calendar | iOS agent runtime | Phase 2 | ✅ Native |
| **Meta Ray-Ban Display** | Camera, 5-mic, speakers, neural band | Ambient awareness + voice I/O | Phase 3+ | ✅ Wearables DAT |
| **OneBand (own hardware)** | Continuous HRV, temp, SpO2, EDA | Deepest biology data | Phase 4 | 🔨 Custom build |

### 7.3 Meta Ray-Ban Display — Future Vision (Phase 3+)

> **Note:** Meta Ray-Ban integration is part of the long-term vision, NOT the early pitch. We do not lead with this in MVP or Phase 1 materials. It's included here for technical completeness and to show platform extensibility.

Meta's Wearables Device Access Toolkit (released 2025, broad publishing 2026) gives third-party apps access to 12MP camera (food recognition, posture detection, context awareness), 5-microphone array (voice commands, ambient conversation capture), open-ear speakers (ambient nudges, meeting reminders with CRS context), and Neural Band EMG wristband (gesture-based agent control).

**Integration architecture:** Meta Ray-Ban connects via Bluetooth to the phone app. Our app uses the Wearables DAT to pipe sensor data through our agent, process via Claude API, and send audio responses back through speakers. Health data still comes from the wrist (watch/ring), creating a two-device system: wrist for biology, glasses for interaction.

**Why we deprioritize this for now:** Adding hardware complexity before proving the core biology-aware agent experience is premature. The empty quadrant thesis must be validated with just a watch/ring + phone before expanding to glasses. Ray-Ban integration is a Phase 3 expansion play, not a wedge feature.

### 7.4 Bee (Amazon) as Complementary Device — Future Vision

Bee ($49 pendant) captures conversations and creates summaries. OneSync could integrate Bee's output as an additional context source. **Feasibility:** Bee's API is Amazon-internal. Speculative for Phase 4+.

---

## 8. Multi-Agent Coordination & the Three-Protocol Stack

### 8.1 The Three-Protocol Stack

The agent interoperability landscape has converged around three complementary protocols, all now under the **Linux Foundation AAIF (AI Agent Infrastructure Foundation)**:

| Protocol | Function | Status | Our Use |
|----------|----------|--------|---------|
| **MCP (Model Context Protocol)** | Agent-to-tools | 97M monthly SDK downloads, 28% Fortune 500, 75+ connectors | TOOLS.md becomes an MCP server manifest. Our health tools are MCP-native |
| **A2A (Agent-to-Agent Protocol)** | Agent-to-agent | v0.3, 150+ member orgs, Python SDK + gRPC | Phase 3: Agent Card for external discovery |
| **AGENTS.md (OpenAI convention)** | Agent discovery | 60K+ projects, adopted by OpenAI | Our AGENTS.md already follows this pattern |

**Why this matters:** By building on all three protocols, OneSync is interoperable with the entire emerging agent ecosystem — not locked into any single vendor.

### 8.2 Internal Sub-Agents (Phase 2)

Built with **Claude Agent SDK** — native subagent spawning with per-subagent model selection:

| Sub-Agent | Model | Role | Handoff Trigger |
|-----------|-------|------|----------------|
| Health Analyst | Claude Haiku 4.5 ($0.80/$4 per MTok) | Crunch biometric data, detect patterns | When health data needs deep analysis |
| Communication Manager | Claude Haiku 4.5 | Draft messages, suggest replies | When user asks to draft/send messages |
| Research Agent | Claude Sonnet 4.6 ($3/$15 per MTok) | Meeting prep, person/company research | meeting_prep heartbeat or user request |
| Core Orchestrator | Claude Sonnet 4.6 | All other decisions, user interaction | Always active, delegates to sub-agents |
| Complex Reasoning | Claude Opus 4.6 ($5/$25 per MTok) | Multi-step health trend analysis, weekly summaries | Weekly batch, complex user queries |

**Handoff rules:** Claude Agent SDK manages subagent lifecycle — sub-agents inherit scoped context, not full conversation history. Sub-agents can read MEMORY.md and BODY.md but only Core can write. Failed sub-agent tasks escalate to Core with error context.

**Cost optimization:** Routing simple tasks to Haiku ($0.80/MTok) vs Sonnet ($3/MTok) reduces API costs by ~70% for routine operations. Prompt caching (90% discount, 1-hour extended TTL) slashes cost further for the repeated SOUL.md/AGENTS.md system prompts.

### 8.3 A2A Protocol — External Agent Communication (Phase 3)

Google's Agent2Agent Protocol (v0.3, 150+ member organizations, donated to Linux Foundation AAIF) enables agent-to-agent communication. OneSync's TOOLS.md already contains an Agent Card-compatible capability description.

**How it works:**
1. OneSync publishes an Agent Card: "I can provide health-contextualized scheduling, stress-aware communication timing, and biology-informed task prioritization."
2. External agents (Google Gemini agents, other A2A-compatible agents) discover OneSync via the registry.
3. Task flow: External agent → "Schedule a meeting for this user" → OneSync checks CRS and circadian phase → "User is cognitively depleted until 14:00, suggest 14:30" → External agent adjusts.

**Feasibility:** A2A v0.3 is released with Python SDK, gRPC support, and signed security cards. The protocol is production-ready for early adopters. We don't build this in MVP but our architecture is designed for it.

### 8.4 Health MCP Server — Strategic Product (Phase 2)

**The highest-leverage infrastructure play:** Build and open-source a **Health MCP Server** that exposes wearable biometric data (HR, HRV, sleep, stress, CRS) to any MCP-compatible agent (Claude, Cursor, Windsurf, any of 75+ MCP clients).

**What it does:**
- Standardizes health data access via MCP tool definitions: `get_heart_rate()`, `get_hrv()`, `get_sleep_score()`, `get_crs()`, `get_stress_level()`
- Any Claude-powered agent can call these tools to become health-aware
- Connects to Health Connect, Oura API, WHOOP API, Terra/Sahha under a unified interface

**Why this is strategic:**
- **Ecosystem gravity:** If our MCP server becomes the standard way agents access health data, every agent that uses it is building on OneSync infrastructure
- **Positions us as infrastructure, not just an app:** "The health data layer for the agent ecosystem"
- **Existing precedent:** Open Wearables MCP, Spike MCP, and Apple Health MCP servers already exist but are fragmented and incomplete. We build the definitive one
- **Distribution:** MCP has 97M monthly SDK downloads. A well-built health MCP server gets discovered organically
- **Moat reinforcement:** The MCP server feeds data into our CRS/stress algorithms. Other agents get raw data; OneSync gets interpreted intelligence

---

## 9. Agent Paradigms Borrowed — What We Learned From 12+ Frameworks

| Framework | Key Innovation | What We Took for OneSync |
|-----------|---------------|------------------------|
| **OpenClaw** (250K+ stars, Peter Steinberger joined OpenAI Feb 2026) | SOUL.md, HEARTBEAT.md, file-based memory, 23 channel adapters, ClawHub skills, memory compaction. Note: ClawHavoc security incident (Jan 2026) — malicious skills in ClawHub compromised user data, highlighting importance of skill verification | The entire 10-file paradigm, heartbeat pattern, memory architecture. ClawHavoc lesson: our skills marketplace needs signing + sandboxing from day one |
| **pi-mono** (badlogic) | Unified LLM interface (20+ providers), extension lifecycle (jiti), 4 operational modes | LLM abstraction layer, lifecycle hooks (onBoot, onHeartbeat, onHealthData), mode-agnostic core |
| **Perplexity Computer** | 19-model meta-router, sub-agent orchestration, persistent memory | Model routing (Haiku for simple, Sonnet for complex), sub-agent parallelization |
| **Anthropic Patterns** | 5 composable patterns: chain, route, parallelize, orchestrate, evaluate | Pattern composition for agent decision loops (chain for morning brief, route for triage) |
| **OpenAI Agents SDK** | Handoffs, guardrails, tracing, sessions | Guardrails (health data validation), handoff pattern for sub-agents, tracing for debugging |
| **Claude Code** | CLAUDE.md hierarchy, subagents, MEMORY.md (200 lines loaded), skills | Hierarchical config loading, persistent memory capping, skill architecture |
| **CrewAI** | Role/Goal/Backstory identity, unified memory with importance scoring | Importance scoring for memory compaction (high-importance survives longer) |
| **Microsoft AutoGen** (maintenance mode — Microsoft shifting to Magentic-One) | Event-driven async messaging, Magentic orchestration | Async event patterns for health data processing. Lesson: avoid frameworks entering maintenance mode |
| **Dust.tt** ($21.5M Sequoia, $7.3M ARR) | Coordinator → 6 parallel sub-agents, Temporal workflows, database-driven state | Durable workflow pattern for long-running health trend analysis. Validates enterprise agent demand |
| **LangGraph v1.0** (LangChain) | Stateful agent graphs, interrupt() for human-in-loop, checkpointing | Progressive autonomy pattern — interrupt() maps to our L2 Co-Pilot approval flow. We don't use LangGraph directly (Claude Agent SDK is simpler) but the pattern is validated |
| **Google A2A** (v0.3) | Agent Cards (JSON capability discovery), task lifecycle, gRPC | Agent Card format for Phase 3 inter-agent discovery |
| **Lindy AI** | No-code creation, voice agents (Gaia), 5000+ integrations, auto-QA | Voice agent pattern for Phase 3 Meta Ray-Ban integration |
| **Iris** (YC F25) | Swipe-to-approve progressive autonomy, 48% WoW growth | L0→L3 autonomy progression, stored in USER.md |

### Cross-Cutting Patterns Applied

| Pattern | Source | OneSync Application |
|---------|--------|-------------------|
| Guardrails | OpenAI Agents SDK | Input: "Is this HRV reading physiologically plausible?" Output: "Is this health suggestion safe?" |
| Tracing | OpenAI Agents SDK | Every action logged: trigger → input → reasoning → output → latency. Critical for trust |
| Model Router | Perplexity Computer | Simple tasks → Haiku 4.5 ($0.80/$4 per MTok), complex reasoning → Sonnet 4.6 ($3/$15 per MTok) |
| Temporal Durability | Dust.tt | Long-running health analysis survives app restarts via Supabase state table |
| Composable Patterns | Anthropic | Chain (morning brief), Route (triage data type), Parallelize (health + calendar check) |
| Importance Scoring | CrewAI | Memory entries scored 0-1. High-importance memories survive compaction longer |
| Progressive Autonomy | Iris (YC F25, 168 DAU, 48% WoW), LangGraph interrupt(), OpenAI require_approval, EU AI Act Article 14 | L0 Observer → L1 Advisor → L2 Co-Pilot → L3 Agent. Now a formally recognized industry pattern. EU AI Act mandates it for high-risk health AI |
| Lifecycle Hooks | pi-mono | onBoot, onHeartbeat, onHealthData, onMessage, onDecision — skills can subscribe |
| Subagent Spawning | Claude Agent SDK | Native model selection per subagent, scoped tool access, automatic lifecycle management |
| Context Management | Anthropic Compaction API + Prompt Caching | Server-side context summarization replaces custom compaction. 90% discount on cached prompts |
| Tool Interop | MCP (97M downloads) | Standardized tool discovery replaces custom tool definitions. Health tools as MCP server |
| Skill Security | OpenClaw (ClawHavoc incident) | Skills marketplace needs signing, sandboxing, and review from launch |

---

## 10. Feasibility Audit — Can We Actually Build Everything We're Claiming?

This section is a brutally honest assessment of whether every integration, API, and capability we're planning is actually available and buildable.

### 10.1 MVP Features — All Confirmed Feasible ✅

| Feature | API/Technology | Status | Evidence |
|---------|---------------|--------|----------|
| Read HR from smartwatch | Google Health Connect | ✅ Production-ready | Official Android API, Samsung/Google/Fitbit support |
| Read HRV (RMSSD) | Google Health Connect | ✅ Production-ready | Supported since Android 14, Galaxy Watch 4+, Pixel Watch |
| Read sleep stages | Google Health Connect | ✅ Production-ready | Sleep session data with stages (REM, deep, light, awake) |
| Read steps | Google Health Connect | ✅ Production-ready | Standard Health Connect data type |
| Compute CRS from biometrics | Custom algorithm (~150 LOC) | ✅ Buildable | Weighted composite of available data. Published research validates approach. Population defaults for instant start |
| CRS Feedback Loop | Custom (~80 LOC) | ✅ Buildable | Thumbs up/down UI + storage + weekly weight adjustment batch job |
| Compute circadian phase | Custom algorithm (~200 LOC) | ✅ Buildable | Borbély two-process model, inputs are sleep/wake times from Health Connect |
| Compute stress level | Custom algorithm (~80 LOC) | ✅ Buildable | RMSSD comparison to baseline, well-established method |
| Claude Agent SDK + API (ReAct loop) | Anthropic Claude Agent SDK | ✅ Production-ready | Claude Agent SDK provides agent loop, subagent spawning, model selection. Sonnet 4.6 ($3/$15 per MTok), Haiku 4.5 ($0.80/$4 per MTok). Prompt caching: 90% input discount, 1h extended TTL. Compaction API (beta) for server-side context management |
| Telegram bot messaging | Telegram Bot API | ✅ Production-ready | Free, well-documented, supports rich messages, inline keyboards |
| Supabase backend | Supabase | ✅ Production-ready | Postgres, Edge Functions (Deno), Auth, Realtime, all on free/pro tier |
| React Native mobile app | React Native + Expo | ✅ Production-ready | Expo 52+ supports Health Connect via community modules |
| Heartbeat cron (proactive tasks) | Supabase Edge Functions + pg_cron | ✅ Production-ready | pg_cron for scheduling, Edge Functions for execution |
| Memory storage + compaction | Supabase Postgres + Edge Functions | ✅ Buildable | Standard CRUD + summarization via Claude Haiku |
| Push notifications | Expo Push + FCM/APNs | ✅ Production-ready | Standard Expo notification service |

### 10.2 Phase 2 Features — Mostly Confirmed ✅

| Feature | API/Technology | Status | Notes |
|---------|---------------|--------|-------|
| Apple HealthKit (iOS) | HealthKit framework | ✅ Available | Requires iOS app. Equivalent data to Health Connect |
| Oura Ring direct API | Oura API v2 (cloud) | ✅ Available | OAuth2, REST API. Readiness score, HRV, sleep stages, temp |
| WHOOP direct API | WHOOP Developer API | ✅ Available | OAuth2, REST. Strain, recovery, sleep, HRV |
| Garmin direct API | Garmin Connect API / Health API | ✅ Available | Push-based API. Body Battery, stress, HRV, sleep, activity |
| WhatsApp messaging | WhatsApp Business API (Cloud) | ✅ Available | Requires Meta Business verification. Free for first 1000 conversations/month |
| Slack bot | Slack Bot API | ✅ Available | OAuth2, Events API, generous free tier |
| Email integration | IMAP/SMTP or SendGrid/Postmark | ✅ Available | Standard protocols, multiple providers |
| Google Calendar | Google Calendar API v3 | ✅ Available | OAuth2, full CRUD on events |
| Sub-agent routing | Claude API (multiple calls) | ✅ Buildable | Route different tasks to Haiku vs Sonnet. Standard API usage |
| Mental Wellbeing Monitor | Custom algorithm + 30-day data | ✅ Buildable | Requires data accumulation, not new APIs |
| Task-Cognition Matching | Custom algorithm + calendar API | ✅ Buildable | Combine CRS prediction with calendar event metadata |

### 10.3 Phase 3 Features — Feasible with Caveats ⚠️

| Feature | API/Technology | Status | Notes |
|---------|---------------|--------|-------|
| Meta Ray-Ban Display integration | Meta Wearables Device Access Toolkit | ⚠️ Available but restricted | SDK released. Camera, mic, speakers accessible. Publishing opens broadly in 2026. Need to apply for developer access |
| Meta Neural Band (EMG) | Part of Wearables DAT | ⚠️ Early stage | Gesture input via EMG. Available to early partners. Public timeline unclear |
| A2A protocol support | Google A2A v0.3 | ✅ Available | Python SDK, gRPC, spec is public. Early but production-usable |
| Voice agent (through Ray-Ban speakers) | Wearables DAT + Claude API | ⚠️ Feasible but complex | Need audio processing pipeline: mic → speech-to-text → Claude → text-to-speech → speakers |
| OneBand custom wearable | Custom hardware | ⚠️ Requires hardware expertise | Needs hardware co-founder + $500K+ for prototyping. Phase 4 more realistic |
| CUDIS Ring integration | CUDIS API | ❓ Unclear | No public developer API documented yet. Would need partnership |
| Car infotainment integration | Android Auto / OnePlus partnership | ⚠️ Possible | Android Auto supports messaging apps. Direct OEM partnership is speculative |

### 10.4 What's NOT Feasible (Honest Limits)

| Claimed Feature | Reality Check |
|----------------|--------------|
| Real-time continuous HRV streaming | Most watches sample HRV periodically (every 5-15 min), not continuously. Our algorithms work with periodic samples, which is fine |
| Medical-grade health predictions | We are NOT a medical device. FDA clearance would be needed for medical claims. We provide "wellness insights," not diagnoses |
| Glucose monitoring integration | CGM APIs (Dexcom, Libre) exist but require prescription devices. Phase 3+ and only for users who already have a CGM |
| EEG integration | Consumer EEG (Muse, Neurosity) APIs exist but adoption is extremely niche. Not worth pursuing until Phase 4+ |
| Bee (Amazon) integration | No public API. Bee is Amazon-proprietary. Speculative unless Amazon opens platform |
| iMessage integration | Apple Business Chat requires Apple approval. Very difficult for small startups. Deprioritize |

### 10.5 Summary Verdict

**MVP (10-15 days):** 100% feasible. Every API and technology is production-ready and well-documented. The ~1,710 LOC estimate (including CRS feedback loop) is realistic for a solo developer with AI assistance.

**Phase 2 (Month 2-4):** 95% feasible. All major APIs are available. The only risk is WhatsApp Business API verification timeline (can take 2-4 weeks).

**Phase 3 (Month 5-8):** 70% feasible. Meta Ray-Ban integration depends on developer access approval. A2A is available but early. Voice pipeline is complex but proven technology.

**Phase 4 (Month 9-12):** 40% feasible as planned. OneBand hardware requires significant capital and expertise. Car infotainment and some device partnerships are speculative.

---

## 11. MVP Specification — What Gets Built in 10-15 Days

### 11.1 Scope

- Android app (React Native + Expo)
- **ONE primary wearable:** Samsung Galaxy Watch 5/6 via Health Connect (or Oura Ring via API v2)
- 3 core algorithms: CRS, Circadian Phase Estimator, Stress Detector
- **CRS Prediction-Accuracy Feedback Loop** (thumbs up/down on every proactive suggestion)
- Claude API agent loop with 14 tool definitions
- Supabase backend (auth, profiles, heartbeat rules, interactions, core memory, crs_feedback)
- Telegram bot for communication
- **Biometric-triggered heartbeat rules as hero feature** (HRV stress intervention, movement nudge, sleep-adjusted morning)
- Supporting time-based rules (morning brief at 07:00, evening wind-down at 21:00)
- Basic memory: daily logs + core memory table + weekly compaction
- Progressive autonomy: L0 (Observer) and L1 (Advisor) modes only
- **"Time to Magic" < 24 hours:** Population-level defaults, no 3-day baseline wait

### 11.2 LOC Breakdown

| Component | Estimated LOC |
|-----------|--------------|
| React Native app (screens, navigation, Health Connect) | ~400 |
| Supabase Edge Functions (heartbeat, message processing, health compute) | ~350 |
| Health algorithms (CRS, circadian, stress) | ~430 |
| **CRS Feedback Loop** (UI + storage + weight adjustment) | **~80** |
| Claude API integration (tool definitions, ReAct loop) | ~150 |
| Telegram bot bridge | ~100 |
| Memory system (daily log, core memory, compaction) | ~110 |
| LLM abstraction layer | ~30 |
| Lifecycle event stubs | ~20 |
| Config/utils | ~40 |
| **Total** | **~1,710** |

### 11.3 Day-by-Day Plan

| Day | Task |
|-----|------|
| 1-2 | Supabase setup (schema, auth, RLS, Edge Functions scaffold) + heartbeat_rules + crs_feedback tables |
| 3-4 | React Native app (Expo init, Health Connect for Galaxy Watch 5/6 or Oura API v2 integration) |
| 5-6 | Health algorithms (CRS with population defaults, circadian, stress detector) + health_snapshots |
| 7 | Claude API integration (tool definitions, ReAct loop, system prompt from SOUL.md) |
| 8 | **Biometric trigger system** (HRV stress intervention, movement nudge, sleep-adjusted alerts) |
| 9 | Telegram bot (send/receive, webhook, message routing) + memory system |
| 10 | CRS Feedback Loop (thumbs up/down UI, storage, weekly weight adjustment batch) |
| 11-12 | End-to-end testing, bug fixes, instant onboarding flow (population defaults, no 3-day wait) |
| 13-14 | Polish, edge cases, documentation |
| 15 | **Demo build** — lead with biometric stress intervention demo, not morning brief |

---

## 12. Phased Roadmap — MVP to Platform

### Phase 1: MVP (Month 1) — "Your Cognitive Co-Pilot on Telegram"
- Android + ONE wearable (Galaxy Watch 5/6 or Oura Ring) + 3 algorithms + CRS feedback loop + Claude agent + Telegram + Supabase
- **Target: 500 beta users — burned-out knowledge workers, startup founders, remote workers** who already wear a smartwatch and are frustrated their health data doesn't connect to their work life
- **Hero moment:** Biometric-triggered stress intervention arrives exactly when their HRV drops during a tough meeting
- **Channels:** LinkedIn (burnout/productivity angle), Twitter/X founder communities, Indie Hackers, startup Slack groups, ProductHunt
- Key metric: Daily active engagement, CRS feedback accuracy (thumbs up rate), biometric trigger engagement rate

### Phase 2: Multi-Platform (Month 2-4) — "Your Agent, Everywhere"
- iOS app + HealthKit
- Direct wearable APIs (Oura, WHOOP, Garmin)
- WhatsApp + Slack + Email channels
- Google Calendar integration
- Sub-agent architecture (Health Analyst, Comms Manager)
- Mental Wellbeing Monitor + Task-Cognition Matching
- L2 autonomy (Co-Pilot mode)
- Target: 5,000 users, $15/mo Pro tier launch

### Phase 3: Ambient Intelligence (Month 5-8) — "Agent Everywhere"
- Meta Ray-Ban Display integration (voice + camera + speakers) — expansion play, not core pitch
- A2A protocol support (Agent Card + external agent communication)
- Skills marketplace (installable routine packages)
- Full L3 autonomy for trusted users
- Enterprise wellness pilot
- Target: 10,000 users, enterprise contracts

### Phase 4: Platform (Month 9-12) — "The Biology-Aware Agent OS"
- OneBand custom wearable (if hardware co-founder found)
- Third-party device SDK
- Developer API (let others build on OneSync's Agent OS)
- Car infotainment integration
- International expansion (multi-language, multi-timezone)
- Target: 25,000 users, Series A readiness

---

*This document is the single source of truth for everything OneSync has been designed to be. Every claim in this document has been validated against available APIs, published research, and production-ready technology. The feasibility audit in Section 10 provides an honest assessment of what's buildable today vs what requires future development.*

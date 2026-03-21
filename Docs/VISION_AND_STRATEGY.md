# OneSync -- Vision & Strategy

> **"Every AI agent knows your calendar. Only OneSync knows your body."**
> **OneSync -- Your AI co-pilot that reads your body.**

*Last updated: March 15, 2026 | For co-founders, advisors, investors, and collaborators*

---

## Table of Contents

1. [Vision & Positioning](#1-vision--positioning)
2. [The Four Pillars](#2-the-four-pillars)
3. [The Full Product](#3-the-full-product)
4. [The Gap](#4-the-gap)
5. [Market Analysis](#5-market-analysis)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Go-to-Market Strategy](#7-go-to-market-strategy)
8. [Product Requirements Document (PRD)](#8-product-requirements-document-prd)
9. [Feasibility Audit](#9-feasibility-audit)
10. [Device Ecosystem & Partnerships](#10-device-ecosystem--partnerships)
11. [Investor FAQ -- Top 17 Tough Questions](#11-investor-faq----top-17-tough-questions)
12. [The Ask](#12-the-ask)
13. [Notes & Recommendations](#13-notes--recommendations)

---

## 1. Vision & Positioning

### The Vision

There are two kinds of AI products being built right now. On one side: health trackers (Oura, WHOOP, Garmin, Samsung Health) that collect extraordinary biometric data -- heart rate variability, sleep stages, skin temperature, blood oxygen -- and show it to you in a dashboard you glance at and forget. On the other side: AI agents (Lindy, Manus, Perplexity Computer) that are getting remarkably good at managing your tasks, emails, and calendar -- but are completely blind to your body. They will schedule your hardest meeting when you are cognitively depleted and push you through a 14-hour day when your biology is screaming for recovery.

Nobody has put the two together. That is OneSync.

OneSync is a persistent personal AI co-pilot where biology intelligence is the unfair advantage. It reads your body signals continuously from your smartwatch -- HRV, sleep quality, heart rate, activity -- and uses that understanding to act on your behalf. Not just track. Not just advise. *Act.* It sends you a Telegram message the moment your stress spikes, before you have even noticed it yourself. It learns your circadian rhythm and knows when you are sharp versus when you are fading. Over weeks and months, it builds a personal model of YOUR biology that no competitor can replicate because the data and the feedback loop are uniquely yours.

The long-term vision is a cognitive co-pilot that lives across every surface of your life -- phone, watch, smart glasses, messaging apps, email -- operating with earned autonomy, coordinating with other AI agents, and powered by the deepest understanding of your biological state that any software has ever had.

### The Hybrid Wedge -- Positioning Decision

We chose the **"Hybrid Wedge"** strategy with **"Cognitive Co-pilot"** as the external positioning.

We deliberately frame OneSync as a "Cognitive Co-pilot" externally -- NOT as an "Agent OS." The term "co-pilot" resonates with knowledge workers (it implies collaboration, not replacement) and with investors (it evokes the Copilot wave without the baggage of "AI agents will take your job"). Internally, the architecture IS a general-purpose Agent OS, but the market does not need to know that yet.

We tried three positioning options and landed here:

**Why not "general AI chief of staff":** Lindy owns this space with ~$50M raised, Lindy 3.0 + Enterprise (HIPAA-compliant), 4,000+ integrations, and established "AI Chief of Staff" branding at $50/mo. Competing head-on against an established player with more integrations and more resources would be extremely difficult.

**Why not "health + calendar app":** Lifestack 2.0 already does circadian planning with wearable integration across Oura, WHOOP, Garmin, Apple Watch, and Fitbit. ONVY has 500+ wearable integrations for health coaching. The pure health-scheduling space is getting crowded fast.

**Why "biology-aware cognitive co-pilot" wins:** It combines the growth trajectory of the AI agent market ($7.84B to $52.62B by 2030, 46.3% CAGR) with a defensible moat (health algorithms, biometric data, progressive body-awareness) that none of the pure agent players have. It is a blue ocean within a red ocean.

The positioning unlocks three things simultaneously: a clear wedge ("we do one thing better than anyone" = biology-aware decisions), a platform story (the underlying Agent OS grows into general personal assistance), and a device narrative (biology needs sensors, sensors need wearables, wearables need our intelligence layer).

**The wedge:** We enter the market as "your AI co-pilot that reads your body" -- targeting burned-out knowledge workers and startup founders who already wear a smartwatch but get zero actionable value from the data. We expand into "everyone's AI chief of staff" as the platform matures.

---

## 2. The Four Pillars

### Pillar 1: Biology Intelligence

The algorithms that translate raw biometric data (heart rate, HRV, sleep stages, steps, skin temperature) into actionable insights: cognitive readiness scores, circadian phase estimation, stress detection, mental wellbeing monitoring, and task-cognition matching.

Six algorithms form the core:

| Algorithm | What It Does | Key Inputs |
|-----------|-------------|------------|
| **Cognitive Readiness Score (CRS)** | 0-100 score predicting cognitive performance *right now* | HRV, sleep quality, activity, time-of-day, personal baselines |
| **Stress Detector** | Real-time stress estimation from HRV deviation + HR elevation | HRV RMSSD, resting HR, current HR, rate of change |
| **Circadian Phase Estimator** | Predicts energy peaks and valleys based on your body clock | Sleep/wake times (7-day), Borbely two-process model |
| **Mental Wellbeing Monitor** | Flags concerning trends in sleep, HRV baseline drift, activity | 30+ days of longitudinal data, pattern analysis |
| **Task-Cognition Matching** | Matches pending tasks to optimal time slots by cognitive demand | CRS predictions + calendar event metadata |
| **Prediction-Accuracy Feedback Loop** | Users rate every CRS prediction (thumbs up/down), weights personalize over time | User feedback, biometric snapshots, weekly batch adjustment |

The CRS starts with population-level defaults (functional within hours of install, no 3-day baseline wait) and personalizes to ~85% accuracy within 30 days via the feedback loop. The feedback loop is also our data moat -- over time we accumulate the largest dataset of subjective cognitive performance correlated with biometrics.

**Research honesty:** Systematic review of 20 studies (BMC Medicine, 2024) finds HRV is *associated* with cognitive performance, but effect sizes are modest. Single-metric HRV prediction from controlled lab conditions does not translate directly to consumer wearables. Oura's readiness score: HRV explains <5% of variance in subjective readiness; resting HR explains 29%. Cross-device agreement is limited -- WHOOP and Oura HRV correlate at only r=0.41.

**Why this does not kill our thesis -- it IS our thesis:** The moat is NOT single-metric HRV prediction. The moat is **multi-signal interpretation via LLM reasoning.** Google's PHIA (Personal Health Information Agent) achieves 84% accuracy on health reasoning benchmarks -- not by reading one number, but by reasoning across multiple signals with contextual awareness. That is exactly what OneSync does: combine HRV + sleep quality + activity + circadian phase + user feedback into a holistic CRS via Claude's reasoning.

### Pillar 2: Autonomous Agent (The Agent OS)

The Agent OS -- an 11-file markdown-driven configuration system that defines who the agent is (SOUL.md), how it behaves (AGENTS.md), when it acts proactively (HEARTBEAT.md), what it remembers (MEMORY.md), and how it coordinates with other agents (TEAMS.md). Progressive autonomy from L0 (Observer) to L3 (fully autonomous Agent).

### Pillar 3: Cross-Platform Communication

The agent does not live in one app. It communicates via Telegram, WhatsApp, Slack, email, push notifications, and eventually voice. It manages conversations across surfaces while maintaining a unified context.

### Pillar 4: Memory & Learning

Three-tier memory inspired by OpenClaw: daily interaction logs (short-term), core memory (long-term patterns), and compaction (automatic summarization of old data into persistent insights). The agent gets smarter about YOUR biology over weeks and months.

---

## 3. The Full Product

What follows is everything OneSync is designed to become. Not all of this ships on day one -- the PRD in Section 8 covers phasing. But this is the complete architecture we are building toward.

### 3.1 The Agent OS -- 11-File Markdown Configuration System

Inspired by the Claude Code CLAUDE.md / MEMORY.md paradigm, OpenClaw's SOUL.md system, and pi-mono's lifecycle architecture, OneSync runs on 11 human-readable markdown files that define everything about the agent:

```
~/.onesync/
+-- SOUL.md              <- WHO the agent IS
+-- IDENTITY.md          <- HOW the agent PRESENTS itself
+-- USER.md              <- WHO the user IS (preferences, identity)
+-- BODY.md              <- WHAT the user's BODY says (biological profile, baselines, CRS calibration)
+-- AGENTS.md            <- WHAT the agent DOES (behavioral rules)
+-- BOOTSTRAP.md         <- HOW the agent STARTS (boot sequence)
+-- HEARTBEAT.md         <- WHEN the agent ACTS autonomously
+-- TOOLS.md             <- WHAT the agent CAN USE (MCP server manifest)
+-- TEAMS.md             <- WHO ELSE EXISTS (sub-agents, A2A peers)
+-- MEMORY.md            <- WHAT the agent REMEMBERS (long-term)
+-- memory/
|   +-- 2026-03-01.md    <- Daily interaction logs
|   +-- 2026-03-02.md
|   +-- ...
+-- skills/
    +-- morning-brief/   <- Installable skill packages
    +-- stress-check/
    +-- sleep-coach/
```

This is not just config -- it is a platform. The markdown files are the API surface for customization, and eventually for third-party skill developers.

**Key files explained:**

- **SOUL.md** -- Core identity. Defines the agent's personality, values, communication style, and hard boundaries. Health-sensitivity encoding ("never guilt-trip about health choices"), progressive trust model, biology-informed communication, safety boundaries ("never make medical diagnoses").

- **BODY.md** -- The biological profile. Extending Anthropic's CLAUDE.md paradigm, BODY.md is a persistent markdown file encoding the user's biological state: baselines (resting HR, average HRV, sleep averages, chronotype), health goals, circadian preferences, CRS calibration weights, and sensitivity flags. Auto-updated by the biology intelligence layer. Separate from USER.md because biological state changes daily while identity is stable.

- **AGENTS.md** -- Behavioral instructions. Defines the decision framework (check biometrics BEFORE suggesting schedule changes), communication rules (max notifications per 30 min), escalation rules (health anomaly = immediate, routine insight = batch), and tool usage priorities.

- **BOOTSTRAP.md** -- Initialization sequence. "Time to Magic" under 24 hours. No 3-day baseline wait. Population-level defaults (resting HR ~65bpm, HRV RMSSD ~40ms for 25-35 age group) get the agent running immediately. Agent is live and useful on Day 0.

- **HEARTBEAT.md** -- Proactive task schedule. Combines time-based crons with biometric triggers. This is the hero feature.

- **TOOLS.md** -- MCP server manifest of available capabilities, plus A2A Agent Card for external discovery.

- **TEAMS.md** -- Sub-agent definitions with model selection and handoff rules.

- **skills/** -- Installable skill packages that bundle heartbeat rules, message templates, and domain-specific logic (morning-brief, stress-coach, jet-lag-recovery, marathon-training).

### 3.2 Progressive Autonomy (L0 to L3)

The agent earns trust, it does not assume it. Four levels:

- **L0 -- Observer:** Watches biometrics silently. Reports only when asked. (Onboarding default for cautious users.)
- **L1 -- Advisor:** Proactively suggests actions via Telegram/push. User decides. (Default for most users.)
- **L2 -- Co-Pilot:** Suggests AND executes with one-tap approval. "I've drafted a reply to that Slack message -- send it?" (Earned after consistent positive feedback.)
- **L3 -- Agent:** Acts independently for trusted, repeatable tasks. "Your CRS was 38 at 3pm so I moved your deep-work block to tomorrow morning when I predict 78." (Only for power users who explicitly enable it.)

This model aligns with the EU AI Act Article 14 (human oversight for health AI) and is a formally recognized pattern across OpenAI's Agents SDK (require_approval), LangGraph's interrupt(), and Iris (YC F25, 48% WoW growth).

### 3.3 Proactive Heartbeat System (THE HERO FEATURE)

The agent does not wait for you to open the app. It reaches out.

**Biometric triggers (the hero feature):**
- HRV drops >20% below baseline for 10+ minutes --> immediate stress intervention ("Your stress just spiked. You have a 10-minute gap before your next call -- want a 3-minute breathing exercise or should I suggest rescheduling?")
- No movement for 90 minutes during a predicted high-CRS window --> contextual movement nudge ("You've been in deep focus for 90 min. Your CRS is still at 74 -- perfect for 5 more minutes, then a quick walk.")
- Sleep score below 60 --> adjusted morning brief with recovery focus + automatic rescheduling suggestions for high-demand tasks
- Resting HR elevated >15% above baseline for 30+ minutes --> gentle check-in ("Your heart rate has been elevated. Everything okay?")

**Time-based crons (supporting features):** 07:00 morning brief, 12:00 midday stress check, 21:00 evening wind-down, Sunday 20:00 week preview.

The biometric triggers are what make OneSync fundamentally different. Every other agent has cron jobs. Nobody else has an agent that reacts to your body in real time. The demo moment is always the biometric trigger, never the morning brief.

### 3.4 Memory & Learning

Three-tier architecture:

1. **Daily logs** -- Every interaction stored with importance scoring (0-1). High-importance memories (health insights, user corrections, preference discoveries) survive longer.
2. **Core memory** -- Persistent learned patterns: "User's HRV drops every Monday afternoon (meeting stress)." "User prefers direct suggestions, not questions." "User's CRS is 15% lower on days after less than 6h sleep."
3. **Compaction** -- Weekly batch job summarizes old daily logs into core memory entries, then clears the logs. Context window stays manageable while knowledge compounds indefinitely.

### 3.5 Cross-Platform Communication

The agent lives where you live, not in a single app:

| Channel | Phase | Notes |
|---------|-------|-------|
| Telegram | MVP | Free, rich bot API, 2B+ users |
| Push Notifications | MVP | Standard mobile infra via Expo Push |
| WhatsApp | Phase 2 | Business API, 24-hour response window constraint |
| Slack | Phase 2 | Bot API, generous free tier |
| Email | Phase 2 | IMAP/SMTP or SendGrid |
| Google Calendar | Phase 2 | Read/write events, OAuth required |
| Meta Ray-Ban Voice | Phase 3 | Wearables Device Access Toolkit |

All channels share a unified conversation context via Supabase Realtime -- start on Telegram, continue on WhatsApp, get a follow-up via push.

### 3.6 Multi-Agent Architecture & Interoperability

**Internal sub-agents:**

| Sub-Agent | Model | Role |
|-----------|-------|------|
| Core Orchestrator | Claude Sonnet 4.6 | All decisions, user interaction, delegates to sub-agents |
| Health Analyst | Claude Haiku 4.5 | Crunch biometric data, detect patterns |
| Communication Manager | Claude Haiku 4.5 | Draft messages, suggest replies |
| Research Agent | Claude Sonnet 4.6 | Meeting prep, person/company research |
| Complex Reasoning | Claude Opus 4.6 | Multi-step health trend analysis, weekly summaries |

**External interoperability -- The Three-Protocol Stack:**

| Protocol | Function | Status | Our Use |
|----------|----------|--------|---------|
| **MCP (Model Context Protocol)** | Agent-to-tools | 97M monthly SDK downloads, 28% Fortune 500, Linux Foundation AAIF | TOOLS.md becomes MCP server manifest. Health tools are MCP-native |
| **A2A (Agent-to-Agent Protocol)** | Agent-to-agent | v0.3, 150+ member orgs, Python SDK + gRPC | Phase 3: Agent Card for external discovery |
| **AGENTS.md (OpenAI convention)** | Agent discovery | 60K+ projects | Our AGENTS.md already follows this pattern |

**Health MCP Server (strategic infrastructure play):** An open-source MCP server that exposes wearable data (get_heart_rate(), get_hrv(), get_crs(), get_stress_level()) to any MCP-compatible agent. If this becomes the standard way agents access health data, we are infrastructure -- not just an app. MCP has 97M monthly SDK downloads. A well-built health MCP server gets discovered organically.

### 3.7 High-Level System Architecture

```
[User Surfaces: Mobile App | Telegram | Email | Ray-Ban Voice]
                     |
[Supabase Gateway: Edge Functions + Realtime + Auth + pg_cron]
    - Heartbeat Cron
    - Message Router
    - Health Processor
    - Memory Compactor
                     |
[Agent Orchestrator (Claude Agent SDK)]
    - System Prompt from SOUL.md + AGENTS.md (prompt-cached, 90% discount)
    - User Context from USER.md + BODY.md + MEMORY.md + biometrics
    - Tools from TOOLS.md (MCP server manifest)
    - Model routing: Sonnet (core) / Haiku (sub-agents) / Opus (complex)
                     |
[Sub-Agent Router (Claude Agent SDK)]
    - Core (Sonnet 4.6) -> Health Analyst (Haiku 4.5)
                         -> Comms Manager (Haiku 4.5)
                         -> Research Agent (Sonnet 4.6)
                     |
[Postgres Database]
    - user_profiles | heartbeat_rules | health_snapshots
    - agent_interactions | core_memory | agent_config
                     |
[External Services]
    - Health Connect API | Google Calendar API
    - Claude Agent SDK | Telegram Bot API
    - Meta Wearables DAT (Phase 3) | A2A Protocol (Phase 3)
```

### 3.8 Agent Paradigms Borrowed -- What We Learned

| Framework | Key Innovation | What We Took |
|-----------|---------------|-------------|
| **OpenClaw** (250K+ stars) | SOUL.md, HEARTBEAT.md, file-based memory, ClawHub skills | Entire 10-file paradigm, heartbeat pattern, memory architecture. ClawHavoc lesson: skills marketplace needs signing + sandboxing from day one |
| **pi-mono** (badlogic) | Unified LLM interface, extension lifecycle, 4 operational modes | LLM abstraction layer, lifecycle hooks (onBoot, onHeartbeat, onHealthData) |
| **Perplexity Computer** | 19-model meta-router, sub-agent orchestration | Model routing (Haiku for simple, Sonnet for complex) |
| **Anthropic Patterns** | 5 composable patterns: chain, route, parallelize, orchestrate, evaluate | Pattern composition for agent decision loops |
| **OpenAI Agents SDK** | Handoffs, guardrails, tracing, sessions | Guardrails (health data validation), handoff pattern, tracing for debugging |
| **Claude Code** | CLAUDE.md hierarchy, subagents, MEMORY.md | Hierarchical config loading, persistent memory capping, skill architecture |
| **CrewAI** | Role/Goal/Backstory identity, unified memory with importance scoring | Importance scoring for memory compaction |
| **Dust.tt** ($21.5M Sequoia) | Coordinator with 6 parallel sub-agents, Temporal workflows | Durable workflow pattern for long-running health trend analysis |
| **LangGraph v1.0** | Stateful agent graphs, interrupt() for human-in-loop | Progressive autonomy pattern -- interrupt() maps to our L2 approval flow |
| **Iris** (YC F25) | Swipe-to-approve progressive autonomy, 48% WoW growth | L0 to L3 autonomy progression |

---

## 4. The Gap

### The Empty Quadrant

We are building in the only quadrant of the market that is empty: **high body awareness + high agent autonomy.**

```
                        Agent Autonomy
                    Low <------------------> High

        High  | CUDIS, Oura AI    |  * OneSync *          |
  Body        | Advisor, Garmin,  |  (EMPTY QUADRANT)     |
  Awareness   | WHOOP             |  (knows body + acts)  |
              | (track, don't act)|                       |
              |-------------------------------------------|
        Low   | Lifestack, ONVY,  |  Lindy, OpenClaw,     |
              | Nori, ChatGPT     |  Perplexity, Manus    |
              | Health             |  (agent, no biology)  |
              | (health-aware but  |                       |
              |  limited autonomy) |                       |
              '-------------------------------------------'
```

**The upper-right quadrant is empty -- but the window is closing.**

ChatGPT Health launched January 2026 and now handles 230 million weekly health queries -- proving massive demand for AI that understands your body. But it is purely reactive Q&A: you ask questions, it answers. It cannot message you when your HRV drops or reschedule your meeting because your CRS is low. Nori (YC F25, ex-Spotify/Chartable founders) aggregates wearable data into a health coach, but coaching is not agency -- it tells you what to do, it does not do it. Lifestack maps your energy curve to your calendar, but it is a planner you open, not an agent that reaches you. Lindy has raised $50M+ and built a powerful autonomous agent with 4,000+ integrations -- but it is completely blind to your biology. Oura ($5.2B valuation) and WHOOP have the best health data in the world, trapped inside their own apps with minimal autonomy.

### Convergence Timeline

The convergence is coming -- wearable companies are adding AI features, agent companies may eventually add health. But as of March 2026, nobody occupies the quadrant that combines deep biometric intelligence with proactive autonomous action. We estimate **12-18 months before the window closes.**

---

## 5. Market Analysis

### 5.1 Market Size

| Market | Size | Source |
|--------|------|--------|
| AI Agents Market | $7.84B (2025) to $52.62B (2030) | MarketsAndMarkets, 46.3% CAGR |
| Wellness Apps | $25.26B (2025) to $68.55B (2034) | Grand View Research, 11.7% CAGR |
| AI Companion Market | $37.73B (2025) to $435.9B (2034) | Industry forecasts, 31.3% CAGR |
| Corporate Wellness | $68B (2025) to $129B (2034) | Grand View Research |
| Digital Health | $330B (2025) to $600B+ (2030) | Grand View Research |
| Wearable Health Tech | $200B+ by late 2020s | Industry forecasts |
| US Wearable Users | 86.4 million (2026) | eMarketer |
| Healthcare AI Funding (2025) | $3.4 billion raised | CB Insights -- median health AI valuations 41% above general AI |
| **Our Target (intersection)** | **$15-25B by 2030** | Agent-assisted personal health optimization |

### 5.2 Why Now -- 5 Converging Trends

1. **Wearable data explosion:** 86.4M Americans wear health trackers but data goes unused. The "data-to-action gap" is our opportunity.

2. **Agent infrastructure is ready:** Claude Agent SDK, MCP (97M monthly downloads), Google A2A v0.3, all under Linux Foundation AAIF. Building an interoperable agent in 2026 is 10x easier than 2024. Prompt caching (90% discount) and Compaction API make it economically viable.

3. **Meta validated the thesis:** $2B Manus acquisition + Ray-Ban Display + neural band. Zuckerberg wants "personal superintelligence." Biology-aware agents are a natural extension.

4. **Apple scaled back:** Apple Health+ scaled back in February 2026. The biggest potential competitor is pulling away from health AI, leaving the market open.

5. **Burnout epidemic + demand validation at scale:** Post-pandemic burnout continues. Corporate wellness market at $68B. ChatGPT Health sees 40M daily health queries. Oura valued at $5.2B. Healthcare AI raised $3.4B in 2025 alone with median valuations 41% above general AI. The market is ready.

---

## 6. Competitive Landscape

### 6.1 Competitive Deep Dives

**Lindy -- The "AI Chief of Staff" ($50/mo, ~$50M raised)**

What they do well: Mature product. Lindy 3.0 + Enterprise (HIPAA-compliant). 4,000+ integrations. No-code agent creation. Voice agents via Gaia. Claimed "400K users" (unverified -- likely includes free/trial).

What they do not do: Zero biometric awareness. Every decision is based on text. Lindy does not know if you are stressed, sleep-deprived, or at peak cognitive performance.

Our differentiation: "Lindy manages your tasks. OneSync manages your tasks WHILE managing your energy." When Lindy suggests rescheduling a meeting, it is because of a calendar conflict. When OneSync suggests it, it is because your HRV dropped 20% and your CRS says you are cognitively depleted.

Long-term relationship: Complementary, not competitive. Lindy could eventually integrate with OneSync's health APIs.

**Nori -- The "AI Health Coach" (YC F25, 2K+ users)**

What they do well: YC F25 batch. Founded by Chartable team (acquired by Spotify). Health coaching with wearable data integration. 2,000+ users.

What they do not do: Coaching model, not agent model. Nori tells you what to do; it does not do it for you. No proactive biometric-triggered interventions. No multi-platform communication. No progressive autonomy.

Our differentiation: "Nori coaches your health. OneSync IS your health-aware agent that acts on it." Coaching vs agency -- fundamentally different product categories. Threat level: Medium. Closest thesis overlap. Watch closely.

**Oura -- The "$5.2B Health OS" (AI Advisor, Veri CGM acquisition)**

What they do well: Best-in-class sleep tracking (gold standard). Oura Ring Gen 3 + Gen 4. AI Advisor feature. Acquired Veri (CGM/glucose monitoring). Massive user base. Readiness score is culturally relevant.

What they do not do: AI Advisor is health-focused Q&A -- no task management, no calendar integration, no proactive agent behaviors. Hardware + data company adding AI as a feature, not agent-first.

Our differentiation: Oura owns the ring; we own the intelligence layer. "Oura tells you your readiness score. OneSync uses your readiness score to reorganize your day." We integrate with Oura (API v2) -- their data, our brain.

**ChatGPT Health -- The "40M Daily Health Queries" (Jan 2026)**

What they do well: Launched January 2026 with Apple Health integration. 40M daily health queries -- massive demand validation. Isolated data storage, E2E encryption, explicit opt-in.

What they do not do: Reactive Q&A only. No proactive interventions. No biometric triggers. Cannot take actions. No Android support (Apple Health only). No agent architecture. No MCP/A2A interoperability.

Our differentiation: "ChatGPT answers health questions. OneSync acts on health signals." ChatGPT Health proves 40M people want their AI to understand their body. We are building the action layer it is missing.

**Lifestack 2.0 -- The "Energy-First Calendar" (Seed stage)**

First mover in health + calendar. Circadian planning. Wearable integration across multiple devices. But it is a calendar app, not an agent. No progressive autonomy. No proactive heartbeat-driven actions. No multi-platform communication. No memory that learns patterns over months.

Our differentiation: "Lifestack schedules your day around energy. OneSync lives your day WITH you."

**Bee / Amazon -- The "Always-On Memory Pendant" ($49, Amazon-acquired)**

Bee knows what you SAID, not what your body SAYS. No biometric integration. Memory is conversation-based, not biology-based. "Bee remembers your words. OneSync understands your biology."

**ONVY -- The "Wearable Health Coach" ($2M raised, Munich)**

500+ wearable integrations. Daily briefings. Real-time nudges. Female health intelligence module. Enterprise wellness focus. But pure health coaching -- no task management, no calendar integration, no agent autonomy.

**Meta -- The "Personal Superintelligence" (Manus $2B acquisition + Ray-Ban Display)**

High autonomy, zero body awareness. We do not compete -- we build ON them. Meta builds the rails; we build the biology-aware intelligence that rides on those rails. Partnership opportunity, not competitive threat.

**Perplexity Computer -- The "$20B Meta-Agent" (30-45M MAU)**

Different axis entirely. General-purpose web agent. Zero biology awareness. Could be complementary.

### 6.2 Full Competitive Matrix

| Feature | OneSync | Lindy | ChatGPT Health | Nori | Oura AI | Lifestack | Bee | ONVY | OpenClaw | Perplexity |
|---------|---------|-------|---------------|------|---------|-----------|-----|------|----------|-----------|
| Biometric awareness | 5/5 | 0/5 | 2/5 | 3/5 | 5/5 | 3/5 | 0/5 | 4/5 | 0/5 | 0/5 |
| Agent autonomy | 4/5 | 5/5 | 1/5 | 2/5 | 1/5 | 2/5 | 3/5 | 1/5 | 4/5 | 5/5 |
| Health algorithms | 5/5 | 0/5 | 1/5 | 3/5 | 4/5 | 3/5 | 0/5 | 3/5 | 0/5 | 0/5 |
| Proactive heartbeat | 5/5 | 3/5 | 0/5 | 2/5 | 2/5 | 1/5 | 2/5 | 3/5 | 5/5 | 2/5 |
| Multi-platform comms | 4/5 | 5/5 | 1/5 | 1/5 | 1/5 | 1/5 | 2/5 | 1/5 | 5/5 | 3/5 |
| Memory/learning | 4/5 | 3/5 | 2/5 | 2/5 | 3/5 | 2/5 | 4/5 | 2/5 | 5/5 | 4/5 |
| Protocol interop (MCP/A2A) | 4/5 | 1/5 | 1/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 2/5 | 2/5 |
| Progressive autonomy | 5/5 | 2/5 | 0/5 | 1/5 | 0/5 | 0/5 | 1/5 | 0/5 | 3/5 | 3/5 |
| Valuation/Funding | Pre-seed | ~$50M | OpenAI | YC F25 | $5.2B | Pre-seed | Amazon | $2M | 250K+ stars | $20B |
| Price | $15/mo | $50/mo | Free (ChatGPT+) | TBD | $5.99/mo + ring | Free/TBD | $49 device | TBD | Free/self-host | $200/mo |

**Key insight:** Nobody scores high on BOTH biometric awareness AND agent autonomy. That is the empty quadrant. That is OneSync.

---

## 7. Go-to-Market Strategy

### Phase 1: Burned-Out Knowledge Workers (Month 1-3)

**Target:** Startup founders, remote knowledge workers, and high-performers who already wear a smartwatch (Galaxy Watch or Oura Ring), feel chronically burned out, and are frustrated that their health data does not connect to their work life. These people do not identify as "biohackers" -- they are pragmatists who want to perform better without burning out.

**Why this target over biohackers:** Biohackers are a small, noisy niche who optimize for the sake of optimizing. Burned-out knowledge workers are a massive, underserved group with real pain: they push through exhaustion, miss recovery signals, and crash. They will pay $15/mo for something that prevents one bad decision made while cognitively depleted.

**Channel:** LinkedIn content (burnout/productivity angle -- "I let an AI read my HRV during meetings for a week, here is what happened"), Twitter/X founder communities, Indie Hackers, ProductHunt launch, startup Slack groups (Elpha, Lenny's Community, On Deck alumni), podcast appearances (Huberman-adjacent health + productivity shows).

**Hook:** "Your watch knows you slept 4 hours. Your calendar still has back-to-back meetings. OneSync is the AI co-pilot that actually does something about it."

**Hero demo moment:** User is in a meeting, HRV drops, OneSync sends a Telegram message: "Stress just spiked. You have a 10-min gap next -- want a breathing exercise or should I suggest rescheduling your 3pm?" This is the moment that gets people to sign up.

**"Time to Magic" < 24 hours:** No 3-day baseline collection. Population-level defaults get the agent running immediately. First biometric-triggered intervention can happen within hours of setup.

**Pricing:** Free beta (first 500 users).

**Goal:** 500 active users, validate CRS accuracy via feedback loop (target: 70% thumbs-up rate within 2 weeks), prove biometric triggers drive engagement.

### Phase 2: Expansion + Monetization (Month 3-6)

**Target:** Broader knowledge worker market -- executives, product managers, engineers, consultants. Also Oura/WHOOP/Garmin users who want their data to be actionable.

**Channel:** Referrals from Phase 1 users, wearable maker partnerships (Oura/WHOOP co-marketing: "Get more from your ring with OneSync"), LinkedIn thought leadership, podcast tour, YC/Antler alumni networks.

**Pricing:** Free tier (basic monitoring, 1 channel) + Pro $15/mo (all algorithms, multi-channel, sub-agents, custom heartbeat rules, CRS history dashboard).

**Goal:** 5,000 users, 500 paying ($7,500 MRR), product-market fit signal.

### Phase 3: Platform + Enterprise (Month 6-12)

**Target:** Companies wanting to reduce burnout, improve employee wellness, and add intelligence to their existing productivity tools.

**Channel:** Enterprise sales, partnerships with wearable makers as referral partners, B2B content marketing.

**Pricing:** Enterprise $8/user/mo (team wellness dashboards, custom skills, SSO/SAML, admin controls).

**Goal:** 10,000 users, 3 enterprise pilots, Series A readiness.

---

## 8. Product Requirements Document (PRD)

### 8.1 Problem Statement

86.4 million Americans wear health-tracking wearables in 2026. These devices collect HR, HRV, sleep stages, steps, SpO2, skin temperature, and stress indicators continuously. Yet all this data sits in dashboards that users glance at and forget. The insights do not connect to actions. Your watch knows you slept poorly, but your calendar still has you in back-to-back meetings all morning.

Meanwhile, AI agents are getting smarter at managing tasks, emails, and schedules -- but they are completely blind to your body. They optimize your productivity without knowing your biology.

**The demand is proven:** ChatGPT Health sees 40 million daily health queries. Users are asking their AI about their body -- but ChatGPT can only answer questions, not take proactive action.

**The gap:** No product connects biometric intelligence to agentic action. Wearables track but do not act. ChatGPT Health answers but does not act. Agents act but do not understand your body. OneSync fills this gap.

### 8.2 User Stories

**MVP User Stories (P0):**
- As a burned-out founder, I want the agent to proactively alert me when my stress level spikes (HRV drop detected) -- so I can take a break before I make a bad decision while cognitively depleted. (HERO FEATURE)
- As a knowledge worker, I want the agent to nudge me to move when I have been sedentary during a high-CRS window.
- As a user, I want the agent to be useful within 24 hours of setup (no 3-day baseline wait).
- As a user, I want to give thumbs up/down on every CRS prediction -- so the agent learns my patterns faster.
- As a user, I want to receive a morning brief on Telegram that includes my overnight sleep quality, current CRS, and today's calendar.
- As a user, I want the agent to learn my chronotype and predict my energy peaks.
- As a user, I want to set my autonomy level (observer/advisor).

**Phase 2 User Stories (P1):**
- Suggest rescheduling meetings when predicted CRS is low.
- Draft context-aware replies across Telegram, WhatsApp, and Slack.
- Install custom skills (jet lag recovery, exam prep, marathon training).
- Co-Pilot mode (suggest + execute with approval).

**Phase 3 User Stories (P2):**
- Voice through Meta Ray-Ban speakers based on body state.
- Coordinate with other AI agents via A2A protocol.
- Fully autonomous mode for trusted users.

### 8.3 Feature Requirements

**P0 -- Must Have (MVP):**

| Feature | Description |
|---------|------------|
| **Biometric Stress Intervention** (HERO) | Proactive notification + action options when HRV drops >20% below baseline. The demo moment. |
| **CRS Prediction-Accuracy Feedback Loop** | Thumbs up/down on every prediction. Drives personalization + engagement + data moat. |
| **Instant Onboarding (< 24h to value)** | Population-level defaults, no 3-day baseline wait. Agent is useful on Day 0. |
| Health Connect Integration | Read HR, HRV, sleep, steps from primary wearable via Health Connect (Galaxy Watch 6/7 primary) |
| CRS Algorithm | Compute Cognitive Readiness Score (0-100) from biometrics with population defaults |
| Circadian Phase Estimator | Predict energy peaks/valleys from sleep/wake patterns |
| Stress Detector | Real-time stress estimation from HRV deviation |
| Claude Agent Loop | tool_use ReAct loop with tool definitions |
| Telegram Communication | Bidirectional messaging via Telegram Bot API |
| Morning Brief | Daily proactive summary: health + calendar + priorities |
| Evening Wind-down | Recovery score + sleep suggestions + tomorrow preview |
| Daily Memory Logs | Store all interactions with importance scoring |
| Core Memory | Persist learned patterns across sessions |
| Progressive Autonomy (L0/L1) | Observer and Advisor modes |

**P1 -- Should Have (Phase 2):**

| Feature | Description |
|---------|------------|
| Oura/WHOOP/Garmin/Fitbit APIs | Direct cloud API integrations for premium wearables (Phase 2) |
| iOS + HealthKit | Apple ecosystem support — Apple Watch via HealthKit SDNN (Phase 3) |
| WhatsApp + Slack + Email | Multi-platform communication |
| Google Calendar Integration | Read/write events, suggest rescheduling |
| Sub-Agent Routing | Health Analyst (Haiku), Comms Manager, Research Agent |
| Mental Wellbeing Monitor | 30-day trend analysis for wellbeing flags |
| Task-Cognition Matching | Match tasks to optimal time slots by CRS prediction |
| Skills Marketplace | Install/manage domain-specific skill packages |
| L2 Autonomy (Co-Pilot) | Suggest + execute with one-tap approval |
| Memory Compaction | Auto-summarize old daily logs into core memory |

**P2 -- Nice to Have (Phase 3+):**

| Feature | Description |
|---------|------------|
| Meta Ray-Ban Display | Voice I/O through glasses, camera context |
| A2A Protocol Support | Agent Card + external agent communication |
| L3 Autonomy (Full Agent) | Act independently for trusted users |
| Voice Agent | Speech-to-text + text-to-speech pipeline |
| Enterprise Wellness | Team dashboards, admin controls, SSO |
| OneBand Custom Hardware | Continuous HRV, temp, SpO2, EDA |
| Developer API | Let others build on OneSync Agent OS |

### 8.4 Success Metrics

| Metric | Month 1 | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|---------|----------|
| Total Users | 500 | 2,000 | 5,000 | 25,000 |
| Paying Users | 0 (beta) | 200 | 500 | 2,500 |
| MRR | $0 | $3,000 | $7,500 | $57,500 |
| DAU/MAU Ratio | >40% | >45% | >50% | >55% |
| **Biometric Trigger Engagement** | **>50%** | **>60%** | **>70%** | **>75%** |
| **CRS Feedback Rate** (thumbs/day) | **3** | **4** | **5** | **5** |
| CRS Accuracy (user validation) | 70% | 78% | 82% | 85% |
| Time to First Value | <24h | <12h | <6h | <3h |
| Avg. Agent Interactions/Day | 3 | 5 | 8 | 12 |
| NPS | >30 | >40 | >50 | >60 |

---

## 9. Feasibility Audit

This section is a brutally honest assessment of whether every integration, API, and capability we are planning is actually available and buildable.

### 9.1 MVP Features -- All Confirmed Feasible

| Feature | API/Technology | Status | Evidence |
|---------|---------------|--------|----------|
| Read HR from smartwatch | Google Health Connect | Production-ready | Official Android API, Samsung/Google/Fitbit support |
| Read HRV (RMSSD) | Google Health Connect | Production-ready | Supported since Android 14, Galaxy Watch 4+, Pixel Watch |
| Read sleep stages | Google Health Connect | Production-ready | Sleep session data with stages (REM, deep, light, awake) |
| Read steps | Google Health Connect | Production-ready | Standard Health Connect data type |
| Compute CRS from biometrics | Custom algorithm (~150 LOC) | Buildable | Weighted composite of available data. Published research validates approach |
| CRS Feedback Loop | Custom (~80 LOC) | Buildable | Thumbs up/down UI + storage + weekly weight adjustment |
| Compute circadian phase | Custom algorithm (~200 LOC) | Buildable | Borbely two-process model, inputs from Health Connect |
| Compute stress level | Custom algorithm (~80 LOC) | Buildable | RMSSD comparison to baseline, well-established method |
| Claude Agent SDK + API | Anthropic Claude Agent SDK | Production-ready | Agent loop, subagent spawning, model selection. Prompt caching: 90% discount |
| Telegram bot messaging | Telegram Bot API | Production-ready | Free, well-documented, supports rich messages |
| Supabase backend | Supabase | Production-ready | Postgres, Edge Functions, Auth, Realtime |
| React Native mobile app | React Native + Expo | Production-ready | Expo 52+ supports Health Connect |
| Heartbeat cron | Supabase Edge Functions + pg_cron | Production-ready | Standard scheduling |
| Memory storage + compaction | Supabase Postgres + Edge Functions | Buildable | Standard CRUD + summarization via Claude Haiku |
| Push notifications | Expo Push + FCM/APNs | Production-ready | Standard Expo notification service |

### 9.2 Phase 2 Features -- Mostly Confirmed

| Feature | API/Technology | Status | Notes |
|---------|---------------|--------|-------|
| Apple HealthKit (iOS) | HealthKit framework | Available | Requires iOS app. Equivalent data to Health Connect |
| Oura Ring direct API | Oura API v2 (cloud) | Available | OAuth2, REST. Readiness score, HRV, sleep stages, temp |
| WHOOP direct API | WHOOP Developer API | Available | OAuth2, REST. Strain, recovery, sleep, HRV |
| Garmin direct API | Garmin Connect API | Available | Push-based API. Body Battery, stress, HRV, sleep |
| WhatsApp messaging | WhatsApp Business API | Available | Requires Meta Business verification. 24-hour response window |
| Slack bot | Slack Bot API | Available | OAuth2, Events API, generous free tier |
| Email integration | IMAP/SMTP or SendGrid | Available | Standard protocols |
| Google Calendar | Google Calendar API v3 | Available | OAuth2, full CRUD on events |
| Sub-agent routing | Claude API (multiple calls) | Buildable | Route tasks to Haiku vs Sonnet |
| Mental Wellbeing Monitor | Custom algorithm + 30-day data | Buildable | Requires data accumulation, not new APIs |
| Task-Cognition Matching | Custom algorithm + calendar API | Buildable | Combine CRS prediction with calendar metadata |

### 9.3 Phase 3 Features -- Feasible with Caveats

| Feature | API/Technology | Status | Notes |
|---------|---------------|--------|-------|
| Meta Ray-Ban Display | Meta Wearables Device Access Toolkit | Available but restricted | SDK released. Publishing opens broadly in 2026 |
| Meta Neural Band (EMG) | Part of Wearables DAT | Early stage | Available to early partners. Public timeline unclear |
| A2A protocol support | Google A2A v0.3 | Available | Python SDK, gRPC, spec is public. Early but usable |
| Voice agent (Ray-Ban speakers) | Wearables DAT + Claude API | Feasible but complex | Needs audio processing pipeline |
| OneBand custom wearable | Custom hardware | Requires hardware expertise | Needs hardware co-founder + $500K+ for prototyping |

### 9.4 What Is NOT Feasible (Honest Limits)

| Claimed Feature | Reality Check |
|----------------|--------------|
| Real-time continuous HRV streaming | Most watches sample HRV periodically (every 5-15 min), not continuously. Our algorithms work with periodic samples, which is fine |
| Medical-grade health predictions | We are NOT a medical device. FDA clearance would be needed for medical claims. We provide "wellness insights," not diagnoses |
| Glucose monitoring integration | CGM APIs exist but require prescription devices. Phase 3+ only |
| EEG integration | Consumer EEG adoption is extremely niche. Not worth pursuing until Phase 4+ |
| Bee (Amazon) integration | No public API. Speculative unless Amazon opens platform |
| iMessage integration | Apple Business Chat requires Apple approval. Very difficult for small startups |

### 9.5 Summary Verdict

**MVP:** 100% feasible. Every API and technology is production-ready and well-documented.

**Phase 2:** 95% feasible. All major APIs are available. Only risk is WhatsApp Business API verification timeline (2-4 weeks).

**Phase 3:** 70% feasible. Meta Ray-Ban depends on developer access approval. A2A is available but early. Voice pipeline is complex but proven.

**Phase 4:** 40% feasible as planned. OneBand hardware requires significant capital and expertise. Some partnerships are speculative.

---

## 10. Device Ecosystem & Partnerships

### 10.1 Device Integration Roadmap

**MVP strategy: ONE wearable done right, then expand.** Samsung Galaxy Watch 6/7 via Health Connect is the MVP device. No cloud APIs needed for MVP — they're Phase 2.

| Phase | Devices | Data Path | HRV Quality |
|-------|---------|-----------|-------------|
| **Phase 1 (MVP)** | Samsung GW 6/7 (primary), Pixel Watch, Amazfit | Health Connect | Full RMSSD (Samsung); sleep HRV (others) |
| **Phase 2** | Garmin, Oura Ring, WHOOP, Fitbit + Samsung raw IBI | Cloud REST APIs + Watch SDK companions | Full for all; real-time IBI for Samsung & Garmin |
| **Phase 3** | Apple Watch | iOS HealthKit (SDNN variant) | Good — requires iOS app |
| **Phase 4** | Huawei Watch, OneBand (own hardware) | Huawei Health Kit + Custom SDK | Processed HRV / Custom |

**Why Galaxy Watch 6/7:** Richest Health Connect data of any Android device — RMSSD every 10 min, sleep stages, SpO2, skin temp. Samsung Health Sensor SDK gives raw IBI (Phase 2). 13-LED sensor on Watch 7 = best HRV accuracy under ₹20,000.

**Why NOT aggregators (Terra, Sahha, Vital):** Terra costs $399/month with no free tier. Our own direct integrations (Health Connect + Cloud APIs + Watch SDKs) cover 10 premium devices for $0. Aggregators solve a distribution problem we don't have — our users own the top 5–8 devices which we integrate directly. See WEARABLE_DATA_PIPELINE.md for full comparison.

### 10.2 Market Coverage by Phase

| Phase | Global Market Reach | Key Unlock |
|-------|--------------------|----|
| Phase 1 (MVP) | ~25–30% of Android wearables | Samsung GW users — the core paying audience |
| Phase 2 | ~55–60% of global wearables | Garmin, Oura, WHOOP, Fitbit — the premium health segment |
| Phase 3 | ~80–85% of global wearables | Apple Watch — the single biggest market unlock (25% global share) |
| Phase 4 | ~95%+ | Huawei + custom hardware |

The critical insight: **Phase 1 + Phase 2 covers 90%+ of your likely paying users.** The users who pay for cognitive readiness tracking are premium wearable owners (Samsung, Garmin, Oura, WHOOP) — not budget device users.

### 10.3 Partnership Strategy

**Samsung (primary):** Deep integration first mover. "Get more from your Galaxy Watch with OneSync." Co-marketing opportunity once traction proven. Samsung Health Sensor SDK partnership application is a parallel track.

**Garmin, Oura, WHOOP (Phase 2):** Referral partnerships. Their users are high-intent health trackers — ideal OneSync audience. Each integration announcement is a marketing moment.

**Apple (Phase 3):** HealthKit integration required. Apple Watch is 25% of global market — cannot skip iOS forever. Plan iOS app by Month 6–9.

**Enterprise wellness (Phase 4):** OneSync as the cognitive co-pilot layer on top of existing corporate health data. Enterprise pricing, team dashboards, SSO.

**Meta Ray-Ban (Phase 3+):** Voice I/O through glasses based on body state. Proves the thesis with phone+watch first; glasses are an enhancement layer when the product is established.

### 10.4 Device Coverage Details

See [WEARABLE_DATA_PIPELINE.md](WEARABLE_DATA_PIPELINE.md) → "Global Device Coverage Map" section for the full technical breakdown: per-device HRV data paths, integration complexity, pipeline architecture, and phase-by-phase market coverage estimates.

---

## 11. Investor FAQ -- Top 17 Tough Questions

**1. "Isn't this just another AI agent?"**
No. We are a Cognitive Co-pilot -- the only one that reads your body. Every other agent knows your calendar. OneSync knows your biology. That means it can tell you "don't take that investor call right now, your cognitive readiness is at 42 and your HRV says you need recovery" -- no other agent can do that. Biology intelligence is our moat.

**2. "How do you compete with Lindy (~$50M raised)?"**
We do not compete head-on. Lindy does task automation blind to the user's body. We do biology-aware task optimization. Different wedge, complementary positioning. When Lindy wants health intelligence, they will integrate with our Health MCP Server -- or acquire us.

**3. "Lifestack already does health + calendar."**
Lifestack is a calendar app with health data. We are an agent OS with biology as a first-class citizen. They schedule your day. We live your day with you -- proactive, autonomous, cross-platform, learning.

**4. "What about Meta building this?"**
Meta validated our thesis ($2B Manus acquisition). But Meta's approach is hardware + general agent. They do not have biology intelligence. We build ON Meta's hardware (Ray-Ban Display), not against it.

**5. "Are your health algorithms accurate enough?"**
Honest answer: single-metric HRV prediction claims from lab studies do not translate directly to consumer wearables. Oura's readiness score: HRV explains <5% of variance; resting HR explains 29%.

But our approach works because the moat is multi-signal interpretation via LLM reasoning. Google's PHIA achieves 84% accuracy on health reasoning benchmarks by reasoning across multiple signals. CRS combines HRV + sleep quality + activity + circadian phase + user feedback into a holistic score. We start with population-level defaults (instantly useful), then personalize via the Feedback Loop. Target: ~70% accuracy on day one, ~85% personalized within 30 days.

**6. "Can one person build this in 10-15 days?"**
Yes. The MVP is ~1,710 LOC using Supabase (replaces 4 services), Claude API tool_use (replaces LangGraph), and Expo (cross-platform mobile). We focus on ONE wearable, one communication channel, and population-level defaults for instant onboarding.

**7. "What's the moat?"**
Five layers: (a) Biology algorithms improve with more personal data (switching cost), (b) the Prediction-Accuracy Feedback Loop generates a unique dataset of subjective cognitive performance correlated with biometrics, (c) Agent OS with 11-file configuration is a platform others can build on, (d) longitudinal health + behavior data creates a personal health model unique to each user, (e) Health MCP Server becomes the standard way any agent accesses health data -- if every Claude-powered agent uses our MCP server for health data, we are infrastructure, not just an app.

**8. "A2A protocol -- isn't that premature?"**
Google A2A v0.3 is production-ready with Python SDK and gRPC support. We do not build it in MVP, but our architecture is designed for it. When agent-to-agent becomes mainstream (2026-2027), we are ready day one.

**9. "What's the revenue model?"**
$15/mo Pro tier. Target: 500 paying users by month 6 = $7,500 MRR = $90K ARR. Enterprise at $8/user/mo. Per-user cost ~$1.60/mo with prompt caching. ~90% gross margin at scale.

**10. "Why should we fund you vs wait for Apple/Google/OpenAI?"**
Apple Health+ scaled back in February 2026. Google builds infrastructure (Health Connect, A2A, PHIA research) but does not ship consumer health agents. ChatGPT Health sees 40M daily queries but is reactive Q&A only. Big tech validates the demand and builds platforms; we build the biology-aware action layer ON those platforms.

**11. "How do you handle health data privacy and regulation?"**
All health data stays on-device or in the user's own Supabase row (RLS-enforced). We never aggregate health data across users. HIPAA-adjacent practices from day one. We are a wellness tool, not a medical device.

Regulatory tracking: Colorado SB24-205 (AI transparency, enforcement Feb 2026). EU AI Act Article 14 mandates human oversight for high-risk health AI -- our progressive autonomy model is inherently compliant. Privacy architecture follows the ChatGPT Health template: E2E encryption at rest, excluded from model fine-tuning, deletable on user request.

**12. "What if Oura/WHOOP/Garmin build this themselves?"**
They are hardware companies optimizing for device sales. Their apps show dashboards; they do not build agents. Building an Agent OS requires AI expertise, LLM integration, and multi-platform communication -- completely different engineering DNA.

**13. "How do you get to $1M ARR?"**
$15/mo x 5,556 paying users = $1M ARR. At 10% conversion from free to paid and $1.60/user cost, we need ~55,000 total users. Achievable within 12-18 months with the burned-out knowledge worker wedge.

**14. "What's the Meta Ray-Ban integration timeline?"**
Phase 3+ (Month 5-8). We prove the core thesis with just a smartwatch/ring + phone first. We do not need Ray-Ban to be valuable -- the watch-based stress intervention alone is the killer feature.

**15. "Is this a venture-scale business?"**
AI agent market: $52.62B by 2030. Wellness apps: $68.55B by 2034. AI companion market: $435.9B by 2034. Healthcare AI raised $3.4B in 2025 with valuations 41% above general AI. If 0.1% of 86.4M US wearable users adopt at $15/mo, that is $155M ARR.

**16. "What about ChatGPT Health? Doesn't OpenAI have a massive head start?"**
ChatGPT Health validates our thesis at massive scale. But it is a reactive Q&A interface. It cannot proactively intervene when your HRV drops, reschedule meetings based on CRS, or send you a Telegram message with a breathing exercise at exactly the right moment. They proved the demand; we build the agent. Long-term, our Health MCP Server could provide health data to ChatGPT.

**17. "Why build on Anthropic's stack specifically?"**
Three reasons: (a) Claude Agent SDK provides native subagent spawning, model selection, and tool orchestration without LangGraph/LangChain middleware. (b) MCP with 97M monthly SDK downloads is the emerging standard for agent-to-tool communication. (c) Prompt caching (90% discount) and Compaction API solve our two biggest cost/complexity challenges. Anthropic's ecosystem is the most production-ready for health-aware agent development, and the CLAUDE.md paradigm alignment means our Agent OS architecture is native to this ecosystem.

---

## 12. The Ask

### For IVI-ISB
Incubation support, mentorship, and $50K pre-seed to build MVP and validate with 500 beta users.

### For YC S26
$500K for 7% equity. 18-month runway to go from MVP to 10K users to Series A readiness. Focus: nail the biology-aware agent experience, prove the empty quadrant thesis, establish platform foundations.

### For Antler
$100K pre-seed + co-founder matching. The hardware vision (OneBand + Meta Ray-Ban integration) needs a hardware co-founder. Antler's co-founder matching is uniquely valuable.

### Key Numbers to Remember

| Metric | Number |
|--------|--------|
| US wearable users | 86.4 million |
| AI agent market (2030) | $52.62 billion |
| Wellness apps market (2034) | $68.55 billion |
| AI companion market (2034) | $435.9 billion |
| Corporate wellness market (2034) | $129 billion |
| Healthcare AI raised (2025) | $3.4 billion |
| ChatGPT Health daily queries | 40 million (demand validation) |
| Oura valuation | $5.2 billion |
| MCP monthly SDK downloads | 97 million |
| MVP build time | 10-15 days |
| MVP LOC | ~1,710 |
| Per-user cost (with prompt caching) | ~$1.60/month |
| Pro tier price | $15/month |
| Gross margin at scale | ~90% |
| Users for $1M ARR | 5,556 paying |
| CRS accuracy (personalized, 30 days) | ~85% (multi-signal, user-validated) |
| Meta Manus acquisition | $2 billion (validation) |
| Perplexity Computer valuation | $20 billion |

---

## 13. Notes & Recommendations

*These are independent observations and strategic recommendations, intended to stress-test and strengthen the OneSync vision.*

### Strengths Worth Doubling Down On

1. **The "hero moment" is real.** The stress intervention -- receiving a message at the exact moment your body signals distress, before you consciously register it -- is a genuinely differentiated, demonstrable, and emotionally powerful product experience. Everything in the GTM, pitch, and demo should orbit this moment. It is the single most defensible "show, don't tell" feature in the entire plan.

2. **The Health MCP Server is the sleeper play.** Becoming the standard health data layer for the agent ecosystem is a higher-leverage outcome than the consumer app itself. If every Claude/Cursor/Windsurf agent calls your MCP server to access biometric data, you become infrastructure. Prioritize open-sourcing this in Phase 2 -- it is both distribution and moat.

3. **The 11-file Agent OS as a platform surface is underappreciated.** Skills-as-markdown-packages is an elegant extension point. The ClawHavoc lesson (mandatory signing + sandboxing from day one) is the right instinct. If this becomes the de facto way to configure a personal health agent, you have a platform -- not just a product.

### Risks & Blind Spots to Address

4. **Notification fatigue is the existential product risk.** The heartbeat system is powerful, but the line between "proactive agent that reads your body" and "another notification I swipe away" is razor-thin. The document mentions notification limits in AGENTS.md but does not deeply specify the suppression and personalization logic. Recommendation: build a dedicated "notification reputation score" per trigger type, tracked per user, that decays engagement -- if a user ignores a trigger type 3 times in a row, suppress it and ask once for recalibration. This is more important than adding new triggers.

5. **The CRS feedback loop is a cold-start problem.** At 5 thumbs per day with a target of ~85% accuracy at 30 days, you need roughly 150 data points before personalization kicks in meaningfully. The first 2 weeks are the danger zone where the agent makes mediocre predictions and the user has to trust it anyway. Recommendation: over-invest in the quality of population defaults by segmenting them (age bracket, activity level, chronotype self-report during onboarding) so even default CRS feels semi-personalized from day one.

6. **Android-only MVP limits your best-fit audience.** Burned-out startup founders and knowledge workers skew heavily toward iPhone. Galaxy Watch is a solid technical choice, but Oura Ring (API v2, cloud-based, works with both iOS and Android) may give broader reach for the target audience. Consider whether the MVP should be Oura-first (cloud API, no Health Connect dependency, works cross-platform) with a lightweight companion app, rather than Health Connect-first.

7. **The 12-18 month window estimate may be optimistic.** ChatGPT Health is iterating fast. Oura's AI Advisor is expanding. Nori has YC behind it. The window is real, but the closing speed is accelerating. Recommendation: treat months 1-3 as the critical window for thesis validation, not 12-18 months. If the hero moment does not land with beta users in 8 weeks, pivot the intervention strategy rather than expanding scope.

### Strategic Recommendations

8. **Lead with one algorithm, not six.** The CRS is the product. The Circadian Phase Estimator, Mental Wellbeing Monitor, and Task-Cognition Matching are supporting cast. The pitch and the MVP should communicate "one magic number that predicts your cognitive performance" -- not a suite of six algorithms. Simplicity sells in early markets.

9. **The "Cognitive Co-pilot" positioning is correct, but watch for "just another chatbot" perception.** The differentiation is proactive, biology-triggered action. Every touchpoint -- marketing, onboarding, first interaction -- should hammer this. The worst outcome is a user who thinks OneSync is "ChatGPT but it knows I slept badly." It is not. It is the agent that intervenes without being asked.

10. **Revenue model tension: $15/mo is aggressive for a beta product, but $0 beta risks value perception.** Recommendation: launch with a free beta, but gate it (invite-only, 500 users). At month 3, introduce a "founding member" price of $10/mo (locked for life) to create urgency and filter for willingness to pay, before establishing the $15/mo Pro tier for general availability.

11. **The five-layer moat story is strong for investors but needs prioritization for execution.** In practice, moat layers (a) and (b) -- personal data accumulation and the feedback loop dataset -- are the only moats that matter in months 1-6. The MCP server, A2A interoperability, and platform story are Series A narratives. Do not allocate engineering time to moat layers (c)-(e) before proving that (a) and (b) work.

12. **Missing from the plan: a churn analysis framework.** Health/wellness apps have notoriously high churn (>70% in 30 days for most). The plan does not specify what happens when engagement drops. Recommendation: design a "re-engagement heartbeat" -- if a user goes 48 hours without interaction, the agent proactively reaches out with a compelling insight from their recent biometric data ("Your HRV has been trending up this week -- you are recovering well. Want to see the pattern?"). Make the agent earn its way back.

### Contradictions Resolved Between Source Documents

13. **Agent OS file count:** Source docs varied between 10-file and 11-file systems. Standardized to 11-file with BODY.md as the dedicated biological profile file, separate from USER.md.

14. **Competitive window:** Source C estimated 12-18 months, source B noted faster convergence. This document uses 12-18 months as the outer bound but recommends treating months 1-3 as the critical validation window (see recommendation 7).

15. **Per-user cost:** Source docs ranged from $0.95 to $1.60/user/month depending on prompt caching assumptions. Standardized to ~$1.60/month as the conservative estimate.

### Competitive Response Scenarios

16. **If Oura ships proactive Telegram/WhatsApp alerts:** Our advantage narrows to device-agnosticism + Agent OS platform. Must have multi-device support live before this happens.

17. **If Lindy adds health integration:** Our Health MCP Server becomes a partnership channel rather than a competitive moat. Prepare to be acquired or to be their health layer.

18. **If Apple ships biology-aware Siri:** Only affects iOS users initially. We are Android-first. But reduces long-term TAM significantly. Accelerate cross-platform strategy.

### Missing from Current Strategy

19. No CAC/funnel estimates for funding pitch -- needed before investor conversations.
20. No partnership outreach plan (who contacts Oura/Samsung/Garmin and when).
21. Privacy policy and terms of service not yet drafted.
22. No plan for Google Play Store review process (Health Connect apps take 2+ weeks for review).
23. No pre-launch demand validation (recommend 3-5 Reddit/Twitter posts explaining CRS with waitlist link before building -- 500+ signups in 2 weeks = demand signal).

---

*This document consolidates the complete strategic, product, market, and feasibility thinking for OneSync. It is designed to be read by investors, co-founders, advisors, and the founding team as the definitive guide to what we are building, why, and how. For detailed engineering specifications, tech stack decisions, and implementation plans, see the companion engineering documents.*

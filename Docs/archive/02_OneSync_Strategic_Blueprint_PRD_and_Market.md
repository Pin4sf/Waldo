# OneSync — Strategic Brief, Architecture Blueprint, PRD & Market Analysis

> **"Every AI agent knows your calendar. Only OneSync knows your body."**
> **OneSync — Your AI co-pilot that reads your body.**

*Last updated: March 4, 2026*

---

## Table of Contents

**Part A: Strategic Brief**
1. [Positioning Decision](#1-positioning-decision)
2. [Market Map — The Empty Quadrant](#2-market-map--the-empty-quadrant)
3. [Competitive Deep Dives](#3-competitive-deep-dives)
4. [Go-to-Market Strategy](#4-go-to-market-strategy)

**Part B: Architecture Blueprint**
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Agent OS Architecture — The 10-File System](#6-agent-os-architecture--the-10-file-system)
7. [Data Flow Architecture](#7-data-flow-architecture)

**Part C: Product Requirements (PRD)**
8. [Problem Statement](#8-problem-statement)
9. [User Stories](#9-user-stories)
10. [Feature Requirements (P0/P1/P2)](#10-feature-requirements-p0p1p2)
11. [Success Metrics](#11-success-metrics)

**Part D: Market Analysis**
12. [Market Size & Timing](#12-market-size--timing)
13. [Competitive Landscape — Full Matrix](#13-competitive-landscape--full-matrix)
14. [Device Ecosystem & Partnerships](#14-device-ecosystem--partnerships)
15. [Investor FAQ — Top 17 Tough Questions](#15-investor-faq--top-17-tough-questions)
16. [The Ask](#16-the-ask)

---

# Part A: Strategic Brief

## 1. Positioning Decision

We chose the **"Hybrid Wedge"** strategy with **"Cognitive Co-pilot"** as the external positioning.

**OneSync = Your AI co-pilot that reads your body.**

We deliberately frame OneSync as a "Cognitive Co-pilot" externally — NOT as an "Agent OS." The term "co-pilot" resonates with knowledge workers (it implies collaboration, not replacement) and with investors (it evokes the Copilot wave without the baggage of "AI agents will take your job"). Internally, the architecture IS a general-purpose Agent OS, but the market doesn't need to know that yet.

We tried three positioning options and landed here:

**Why not "general AI chief of staff":** Lindy owns this space with ~$50M raised, Lindy 3.0 + Enterprise (HIPAA-compliant), 4,000+ integrations, and established "AI Chief of Staff" branding at $50/mo. Their claimed "400K users" is unverified — likely includes free/trial accounts — but even at a fraction of that, they have significant traction and distribution. Competing head-on against an established player with more integrations and more resources would be extremely difficult. We'd be a worse Lindy.

**Why not "health + calendar app":** Lifestack 2.0 already does circadian planning with wearable integration across Oura, WHOOP, Garmin, Apple Watch, and Fitbit. However, Lifestack is early stage (~7 people, pre-seed). ONVY has 500+ wearable integrations for health coaching. The pure health-scheduling space is getting crowded fast. We'd be a late Lifestack.

**Why "biology-aware cognitive co-pilot" wins:** It combines the growth trajectory of the AI agent market ($7.84B → $52.62B by 2030, 46.3% CAGR) with a defensible moat (health algorithms, biometric data, progressive body-awareness) that none of the pure agent players have. It's a blue ocean within a red ocean.

The positioning unlocks three things simultaneously: a clear wedge ("we do one thing better than anyone" = biology-aware decisions), a platform story (the underlying Agent OS grows into general personal assistance), and a device narrative (biology needs sensors, sensors need wearables, wearables need our intelligence layer).

---

## 2. Market Map — The Empty Quadrant

Think of the market as a 2x2 matrix:

```
                        Agent Autonomy
                    Low ←————————————→ High

        High  │ CUDIS, Oura AI    │  ★ OneSync ★       │
  Body        │ Advisor, Garmin,  │  (EMPTY QUADRANT)   │
  Awareness   │ WHOOP             │  (knows body + acts)│
              │ (track, don't act)│                     │
              │─────────────────────────────────────────│
        Low   │ Lifestack, ONVY,  │  Lindy, OpenClaw,   │
              │ Nori, ChatGPT     │  Perplexity, Manus  │
              │ Health             │  (agent, no biology) │
              │ (health-aware but  │                     │
              │  limited autonomy) │                     │
              └─────────────────────────────────────────┘
```

**The upper-right quadrant is empty — but the window is closing.** Nobody yet combines deep health/body awareness (real biometric data from wearables, health algorithms, circadian awareness) with full agent autonomy (proactive actions, multi-platform communication, progressive L0→L3 autonomy, A2A protocol). However, convergence is happening fast: ChatGPT Health (40M daily health queries but can't take actions), Oura AI Advisor ($5.2B valuation, health data but limited autonomy), and Nori (YC F25, health coaching but early stage) are all moving toward this space from different directions.

**Where ChatGPT Health sits:** Low body awareness (reads Apple Health data but doesn't deeply interpret it), medium autonomy (answers questions but can't take proactive actions). 40M daily health queries validate the demand. Their approach: isolated data storage, E2E encryption, excluded from model training, avoided EU launch. ChatGPT Health proves users WANT AI to understand their health — but it's a reactive Q&A interface, not a proactive agent.

**Where Nori sits:** Medium body awareness (health coaching, Chartable founders know health data), low-medium autonomy (2K+ users but coach model, not agent model). YC F25 batch. Closest competitor in thesis — but coaching is not agency.

**Where Bee (Amazon) sits:** Medium on both axes. Post-Amazon acquisition, Bee knows what you said (conversation capture), not what your body is doing (no biometric integration). It takes some actions (email, calendar) but doesn't have proactive health-triggered behaviors. It's a memory pendant, not a biology-aware agent.

**Where Meta/Manus sits:** High autonomy, zero body awareness. Zuckerberg's vision of "personal superintelligence" is about general execution. They have the hardware (Ray-Ban Display, + Limitless acquisition for memory AI) and the agent (Manus), but no biology intelligence layer. **This is a partnership opportunity, not a competitive threat.** We build ON Meta's hardware.

---

## 3. Competitive Deep Dives

### 3.1 Lindy — The "AI Chief of Staff" ($50/mo, ~$50M raised)

**What they do well:** Mature product. ~$50M raised. Lindy 3.0 + Enterprise (HIPAA-compliant). 4,000+ integrations. No-code agent creation. "Delegate your work in plain language" positioning. Strong brand as AI Chief of Staff. Voice agents via Gaia. Claimed "400K users" (unverified — likely includes free/trial).

**What they don't do:** Zero biometric awareness. Every decision is based on text (emails, calendar events, messages). Lindy doesn't know if you're stressed, sleep-deprived, or at peak cognitive performance. It manages your tasks blind to your body.

**Our differentiation:** "Lindy manages your tasks. OneSync manages your tasks WHILE managing your energy." When Lindy suggests rescheduling a meeting, it's because of a calendar conflict. When OneSync suggests it, it's because your HRV dropped 20% and your CRS says you're cognitively depleted. That's a fundamentally different and better suggestion.

**Long-term relationship:** Complementary, not competitive. Lindy could eventually integrate with OneSync's health APIs to add body-awareness to their agent.

### 3.2 Lifestack 2.0 — The "Energy-First Calendar" (Seed stage)

**What they do well:** First mover in health + calendar. Circadian planning. Wearable integration across Oura, WHOOP, Garmin, Apple Watch, Fitbit. ADHD-friendly design. Planning GPS, glucose, EEG integration next.

**What they don't do:** It's a calendar app, not an agent. No progressive autonomy. No proactive heartbeat-driven actions. No A2A protocol. No multi-platform communication (can't message you on Telegram, WhatsApp, or through your glasses). No sub-agent architecture. No memory that learns your patterns over months.

**Our differentiation:** "Lifestack schedules your day around energy. OneSync lives your day WITH you." Lifestack is a tool you open. OneSync is an agent that reaches you proactively, across platforms, with context that grows over time. We're building a companion; they're building a planner.

### 3.3 Bee / Amazon — The "Always-On Memory Pendant" ($49, Amazon-acquired)

**What they do well:** $49 price point. Acquired by Amazon. Always-on conversation capture with consent (green LED). Auto-creates summaries, reminders, action items. Recent Actions feature drafts emails and creates calendar invites from conversation context. Amazon distribution, Alexa ecosystem integration potential.

**What they don't do:** Bee knows what you SAID, not what your body SAYS. No biometric integration. No HRV, no sleep data, no stress detection, no circadian awareness. Memory is conversation-based, not biology-based. Can't proactively intervene based on health signals.

**Our differentiation:** "Bee remembers your words. OneSync understands your biology." Bee captures that you said "I'm tired" in a meeting. OneSync knows you're tired because your HRV dropped, your sleep score was 42, and you've been awake 14 hours — before you say a word.

### 3.4 ONVY — The "Wearable Health Coach" ($2M raised, Munich)

**What they do well:** 500+ wearable integrations. Daily briefings from biometrics. Weekly reflections. Real-time nudges. Female health intelligence module. Enterprise wellness focus.

**What they don't do:** Pure health coaching — no task management, no calendar integration, no communication management, no agent autonomy. It tells you about your health but doesn't act on it. Enterprise-only, not personal agent.

**Our differentiation:** "ONVY coaches your health. OneSync IS your health-aware agent that manages your entire life." ONVY says "your stress is high." OneSync says "your stress is high, so I've suggested moving your 3pm deep-work session to tomorrow when your predicted CRS is 78, and I've drafted a quick reply to the Slack message that's been pending."

### 3.5 Meta — The "Personal Superintelligence" (Manus $2B acquisition + Ray-Ban Display)

**What they're doing:** Zuckerberg has explicitly stated his goal is "personal superintelligence." Meta acquired Manus for $2B (fastest integration in Meta history — 7 weeks into Ads Manager). Ray-Ban Display with neural band, camera, mic, speakers. This is the biggest validation AND biggest threat in the space.

**Why we don't compete — we build ON them:** Meta's approach is hardware-first (Ray-Ban) + general agent (Manus). They have incredible distribution (4M+ advertisers, billions of social users) but no biology intelligence layer. Meta builds the rails; we build the biology-aware intelligence that rides on those rails.

**Partnership thesis (Phase 3+):** OneSync on Meta Ray-Ban Display = biology-aware ambient intelligence on your face. Meta also acquired Limitless (always-on memory AI pendant), reinforcing their "personal superintelligence" play. This is a long-term "built on Meta" story. For now, we prove the thesis with just a smartwatch + phone.

### 3.6 Nori — The "AI Health Coach" (YC F25, 2K+ users)

**What they do well:** YC F25 batch. Founded by Chartable team (podcast analytics, acquired by Spotify). Health coaching with wearable data integration. 2,000+ users. AI-powered personalized health recommendations.

**What they don't do:** Coaching model, not agent model. Nori tells you what to do; it doesn't do it for you. No proactive biometric-triggered interventions. No multi-platform communication. No progressive autonomy. No A2A interoperability.

**Our differentiation:** "Nori coaches your health. OneSync IS your health-aware agent that acts on it." Nori says "you should take a break." OneSync sends you a Telegram message at the exact moment your HRV drops, offers a breathing exercise or to reschedule your next meeting, and logs the outcome. Coaching vs agency — fundamentally different product categories.

**Threat level:** Medium. Closest thesis overlap. But coaching → agent is a bigger leap than it looks. Watch closely.

### 3.7 ChatGPT Health — The "40M Daily Health Queries" (Jan 2026)

**What they do well:** Launched January 2026 with Apple Health integration. 40M daily health queries — massive demand validation. Reads steps, sleep, heart rate from Apple Health. Isolated data storage (separate from training), E2E encryption, explicit opt-in. Deliberately avoided EU launch (regulatory caution). OpenAI's brand and distribution power.

**What they don't do:** Reactive Q&A only — you ask questions, it answers. No proactive interventions. No biometric triggers. Can't take actions (won't reschedule your meeting, send you a message, or suggest a breathing exercise at the right moment). No progressive autonomy. No Android support (Apple Health only). No agent architecture. No MCP/A2A interoperability.

**Our differentiation:** "ChatGPT answers health questions. OneSync acts on health signals." ChatGPT Health proves 40M people want their AI to understand their body. But it's a reactive chatbot with health context — not a proactive, autonomous agent. We're building the action layer that ChatGPT Health is missing. If anything, ChatGPT Health is our best market validation: it proves demand at scale while leaving the proactive agent opportunity wide open.

**Long-term relationship:** Potential integration via MCP. Our Health MCP Server could provide health data to ChatGPT and other LLM agents.

### 3.8 Oura — The "$5.2B Health OS" (AI Advisor, Veri CGM acquisition)

**What they do well:** $5.2B valuation (unicorn). Best-in-class sleep tracking (gold standard). Oura Ring Gen 3 + Gen 4. AI Advisor feature launched. Acquired Veri (CGM/glucose monitoring) — pivoting from "ring company" to "health OS." Massive user base of health-conscious consumers. Readiness score is culturally relevant ("my Oura says I'm at 85 today").

**What they don't do:** Oura AI Advisor is health-focused Q&A — no task management, no calendar integration, no communication management, no proactive agent behaviors. They're a hardware + data company adding AI as a feature, not building an agent-first experience. No A2A, no multi-platform communication, no progressive autonomy.

**Our differentiation:** Oura owns the ring; we own the intelligence layer. "Oura tells you your readiness score. OneSync uses your readiness score to reorganize your day." We integrate with Oura (API v2) — their data, our brain. This is complementary, not competitive, in Phase 1. Long-term: if Oura builds a full agent, they become a competitor. But hardware companies historically struggle with software agent experiences.

### 3.9 Perplexity Computer — The "$20B Meta-Agent" (30-45M MAU)

**What they do well:** $20B valuation. 30-45M MAU. 19-model meta-router (routes queries to optimal model). Persistent memory. Deep search + agent capabilities. Expanding from "answer engine" to "computer use agent" that can browse web, fill forms, complete tasks.

**What they don't do:** Zero biology awareness. No wearable integration. No health algorithms. Computer-first (browser actions), not body-first. Their "Computer" product is about automating web tasks, not understanding your biological state.

**Our differentiation:** Different axis entirely. Perplexity Computer is a general-purpose web agent. OneSync is a biology-aware personal agent. They could be complementary: Perplexity handles web research/actions, OneSync handles body-aware scheduling and health-triggered interventions. The model routing pattern is relevant (we borrow it).

---

## 4. Go-to-Market Strategy

### Phase 1: Burned-Out Knowledge Workers (Month 1-3)

**Target:** Startup founders, remote knowledge workers, and high-performers who already wear a smartwatch (Galaxy Watch or Oura Ring), feel chronically burned out, and are frustrated that their health data doesn't connect to their work life. These people don't identify as "biohackers" — they're pragmatists who want to perform better without burning out.

**Why this target over biohackers:** Biohackers are a small, noisy niche who optimize for the sake of optimizing. They're interesting but not a scalable market. Burned-out knowledge workers are a massive, underserved group with real pain: they push through exhaustion, miss recovery signals, and crash. They'll pay $15/mo for something that prevents one bad decision made while cognitively depleted.

**Channel:** LinkedIn content (burnout/productivity angle — "I let an AI read my HRV during meetings for a week, here's what happened"), Twitter/X founder communities, Indie Hackers, ProductHunt launch, startup Slack groups (Elpha, Lenny's Community, On Deck alumni), podcast appearances (Huberman-adjacent health + productivity shows).

**Hook:** "Your watch knows you slept 4 hours. Your calendar still has back-to-back meetings. OneSync is the AI co-pilot that actually does something about it."

**Hero demo moment:** User is in a meeting → HRV drops → OneSync sends a Telegram message: "Stress just spiked. You have a 10-min gap next — want a breathing exercise or should I suggest rescheduling your 3pm?" This is the "holy shit" moment that gets people to sign up.

**"Time to Magic" < 24 hours:** No 3-day baseline collection. Population-level defaults (resting HR ~65bpm, HRV RMSSD ~40ms) get the agent running immediately. Personalization improves via the CRS Feedback Loop (thumbs up/down on every prediction). First biometric-triggered intervention can happen within hours of setup.

**Pricing:** Free beta (first 500 users).

**Goal:** 500 active users, validate CRS accuracy via feedback loop (target: 70% thumbs-up rate within 2 weeks), prove biometric triggers drive engagement.

### Phase 2: Expansion + Monetization (Month 3-6)

**Target:** Broader knowledge worker market — executives, product managers, engineers, consultants. Also Oura/WHOOP/Garmin users who want their data to be actionable.

**Channel:** Referrals from Phase 1 users, wearable maker partnerships (Oura/WHOOP co-marketing: "Get more from your ring with OneSync"), LinkedIn thought leadership, podcast tour, YC/Antler alumni networks.

**Hook:** "The AI co-pilot that reads your body and manages your energy — not just your calendar."

**Pricing:** Free tier (basic monitoring, 1 channel) + Pro $15/mo (all algorithms, multi-channel, sub-agents, custom heartbeat rules, CRS history dashboard).

**Goal:** 5,000 users, 500 paying ($7,500 MRR), product-market fit signal.

### Phase 3: Platform + Enterprise (Month 6-12)

**Target:** Companies wanting to reduce burnout, improve employee wellness, and add intelligence to their existing productivity tools.

**Channel:** Enterprise sales, partnerships with wearable makers (Oura, WHOOP, Garmin as referral partners), B2B content marketing.

**Hook:** "Like ONVY for enterprise wellness, but with a cognitive co-pilot that actually manages work, not just tracks health."

**Pricing:** Enterprise $8/user/mo (team wellness dashboards, custom skills, SSO/SAML, admin controls).

**Goal:** 10,000 users, 3 enterprise pilots, Series A readiness.

---

# Part B: Architecture Blueprint

## 5. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      USER SURFACES                            │
│  📱 Mobile App   💬 Telegram   📧 Email   🕶️ Ray-Ban Voice   │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│                   SUPABASE GATEWAY                            │
│  Edge Functions (Deno) + Realtime + Auth + pg_cron           │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────┐   │
│  │Heartbeat│ │ Message  │ │  Health   │ │   Memory      │   │
│  │  Cron   │ │ Router   │ │ Processor │ │  Compactor    │   │
│  └────┬────┘ └─────┬────┘ └─────┬─────┘ └───────┬───────┘   │
│       │            │            │                │            │
│  ┌────▼────────────▼────────────▼────────────────▼───────┐   │
│  │              AGENT ORCHESTRATOR (Claude Agent SDK)      │   │
│  │  Context Assembly → Claude Agent Loop → Output         │   │
│  │  System Prompt from: SOUL.md + AGENTS.md (cached, 90%)│   │
│  │  User Context from: USER.md + BODY.md + MEMORY.md     │   │
│  │  Tools from: TOOLS.md (MCP server manifest)           │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────▼───────────────────────────────┐   │
│  │                 SUB-AGENT ROUTER (Claude Agent SDK)     │   │
│  │  Core (Sonnet 4.6) → Health Analyst (Haiku 4.5)      │   │
│  │                    → Comms Manager (Haiku 4.5)        │   │
│  │                    → Research Agent (Sonnet 4.6)      │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │              POSTGRES DATABASE                         │   │
│  │  user_profiles │ heartbeat_rules │ health_snapshots   │   │
│  │  agent_interactions │ core_memory │ agent_config       │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│                 EXTERNAL SERVICES                             │
│  🏥 Health Connect API    📅 Google Calendar API             │
│  🤖 Claude Agent SDK (Sonnet 4.6 + Haiku 4.5)  📱 Telegram  │
│  🕶️ Meta Wearables DAT    🌐 A2A Protocol (Phase 3)         │
└──────────────────────────────────────────────────────────────┘
```

## 6. Agent OS Architecture — The 10-File System

The 11 markdown files (10 original + BODY.md) map to Supabase storage as follows during MVP, then migrate to actual files in Phase 2:

| File | MVP (Supabase) | Phase 2+ (File-based) | Purpose |
|------|---------------|----------------------|---------|
| SOUL.md | System prompt constant (prompt-cached, 90% discount) | User-customizable file | Agent personality, values, boundaries |
| IDENTITY.md | App constants | Multi-platform config | Name, avatar, voice style per platform |
| USER.md | `user_profiles` table | Auto-updating file | User identity + preferences (stable data) |
| **BODY.md** | `health_baselines` table | Auto-updating file | **Biological profile: baselines, CRS calibration, circadian prefs, health goals** |
| AGENTS.md | Edge Function logic (prompt-cached) | Editable rules file | Decision framework, communication rules |
| BOOTSTRAP.md | Onboarding flow code | First-run ritual + session boot | Initialization sequence |
| HEARTBEAT.md | `heartbeat_rules` table | User-editable schedule | Proactive task schedule + biometric triggers |
| TOOLS.md | MCP server manifest | MCP-compatible manifest | Available capabilities as MCP tools + A2A Agent Card |
| TEAMS.md | Not needed in MVP | Claude Agent SDK subagent config | Sub-agent definitions + model selection + handoff rules |
| MEMORY.md | `core_memory` table (Compaction API) | Persistent file | Long-term learned patterns |
| memory/*.md | `agent_interactions` table | Daily log files | Short-term interaction history |
| skills/ | Built-in routines | Installable packages | Domain-specific skill bundles (signed + sandboxed) |

## 7. Data Flow Architecture

### 7.1 Health Data Flow

```
Smartwatch (HR, HRV, Sleep, Steps)
    → Health Connect API (Android) / HealthKit (iOS)
    → React Native app reads via Health Connect SDK
    → Sends to Supabase Edge Function (compute_health)
    → Algorithms compute: CRS, Circadian Phase, Stress Level
    → Stored in health_snapshots table
    → Available to agent for decision-making
```

### 7.2 Heartbeat Flow

```
pg_cron triggers Edge Function (every minute, checks heartbeat_rules)
    → If rule is due (time-based): execute
    → If rule has biometric trigger: check latest health_snapshot
    → If condition met: assemble context + call Claude API
    → Claude decides action (send message, update memory, etc.)
    → Execute via appropriate tool (Telegram, push, calendar)
    → Log interaction to agent_interactions
```

### 7.3 User Message Flow

```
User sends message (Telegram / app)
    → Webhook hits Supabase Edge Function (process_message)
    → Assemble context: SOUL + USER + BODY.md + AGENTS + recent MEMORY + biometrics
    → SOUL.md + AGENTS.md loaded from prompt cache (90% discount, 1h TTL)
    → Claude Agent SDK enters agent loop: think → tool call (MCP) → observe → subagent
    → If context > 80%: Compaction API summarizes oldest interactions server-side
    → Final response sent back via same channel
    → Interaction logged with importance score
```

---

# Part C: Product Requirements (PRD)

## 8. Problem Statement

**86.4 million Americans** wear health-tracking wearables in 2026. These devices collect HR, HRV, sleep stages, steps, SpO2, skin temperature, and stress indicators continuously. Yet all this data sits in dashboards that users glance at and forget. The insights don't connect to actions. Your watch knows you slept poorly, but your calendar still has you in back-to-back meetings all morning.

Meanwhile, AI agents (Lindy, Manus, Perplexity Computer) are getting smarter at managing tasks, emails, and schedules — but they're completely blind to your body. They optimize your productivity without knowing your biology. The result: agents that schedule deep work when you're cognitively depleted, or let you push through stressful periods when your HRV says you need recovery.

**The demand is proven:** ChatGPT Health launched in January 2026 with Apple Health integration and immediately sees **40 million daily health queries**. Users are asking their AI about their body — but ChatGPT can only answer questions, not take proactive action. It can tell you your sleep was poor; it can't reschedule your morning meetings because of it.

**The gap:** No product connects biometric intelligence to agentic action. Wearables track but don't act. ChatGPT Health answers but doesn't act. Agents act but don't understand your body.

**OneSync fills this gap** by being the first cognitive co-pilot that reads your biology AND takes action based on it — proactively, across platforms, with progressive autonomy. For the burned-out startup founder who pushes through exhaustion because no tool tells them to stop, OneSync is the co-pilot that reads the body signals they're ignoring and actually does something about it.

## 9. User Stories

### 9.1 MVP User Stories (P0)

- **As a burned-out founder,** I want the agent to proactively alert me when my stress level spikes (HRV drop detected) — so I can take a break before I make a bad decision while cognitively depleted. *(HERO FEATURE)*
- **As a knowledge worker,** I want the agent to nudge me to move when I've been sedentary during a high-CRS window — so I don't waste my peak cognitive hours sitting in low-value meetings.
- **As a user,** I want the agent to be useful within 24 hours of setup (no 3-day baseline wait) — so I see value immediately using population-level defaults.
- **As a user,** I want to give thumbs up/down on every CRS prediction — so the agent learns my personal patterns faster and I trust its suggestions more over time.
- **As a user,** I want to receive a morning brief on Telegram that includes my overnight sleep quality, current CRS, and today's calendar — so I know how to approach my day.
- **As a user,** I want the agent to learn my chronotype and predict my energy peaks — so I can schedule important work during high-performance windows.
- **As a user,** I want to set my autonomy level (observer/advisor) — so the agent respects my comfort with AI-driven suggestions.

### 9.2 Phase 2 User Stories (P1)

- **As a user,** I want the agent to suggest rescheduling a meeting when my predicted CRS is low — so I can perform at my best for important calls.
- **As a user,** I want the agent to draft context-aware replies across Telegram, WhatsApp, and Slack — so I spend less time on routine communication.
- **As a user,** I want to install custom skills (jet lag recovery, exam prep, marathon training) — so the agent adapts to my current life phase.
- **As a user,** I want the agent to work in Co-Pilot mode (suggest + execute with my approval) — so I maintain control while delegating more.

### 9.3 Phase 3 User Stories (P2)

- **As a user,** I want the agent to speak to me through my Meta Ray-Ban speakers based on my body state — so I get ambient health intelligence without pulling out my phone.
- **As a user,** I want the agent to coordinate with other AI agents (Google, third-party) via A2A protocol — so my health context informs all my AI interactions.
- **As a user,** I want fully autonomous mode where the agent manages my communication and schedule independently — because it has earned my trust over months of accurate suggestions.

## 10. Feature Requirements (P0/P1/P2)

### P0 — Must Have (MVP)

| Feature | Description |
|---------|------------|
| **Biometric Stress Intervention** (HERO) | Proactive notification + action options when HRV drops >20% below baseline. This is the demo moment. |
| **CRS Prediction-Accuracy Feedback Loop** | Thumbs up/down on every prediction. Drives personalization + engagement + data moat. ~80 LOC. |
| **Instant Onboarding (< 24h to value)** | Population-level defaults, no 3-day baseline wait. Agent is useful on Day 0. |
| Health Connect Integration | Read HR, HRV, sleep, steps from ONE primary wearable (Galaxy Watch 5/6 or Oura Ring) |
| CRS Algorithm | Compute Cognitive Readiness Score (0-100) from biometrics with population defaults |
| Circadian Phase Estimator | Predict energy peaks/valleys from sleep/wake patterns |
| Stress Detector | Real-time stress estimation from HRV deviation |
| Claude Agent Loop | tool_use ReAct loop with 14 tool definitions |
| Telegram Communication | Bidirectional messaging via Telegram Bot API |
| Morning Brief | Daily proactive summary: health + calendar + priorities |
| Evening Wind-down | Recovery score + sleep suggestions + tomorrow preview |
| Daily Memory Logs | Store all interactions with importance scoring |
| Core Memory | Persist learned patterns across sessions |
| Progressive Autonomy (L0/L1) | Observer and Advisor modes |

### P1 — Should Have (Phase 2)

| Feature | Description |
|---------|------------|
| iOS + HealthKit | Apple ecosystem support |
| Oura/WHOOP/Garmin APIs | Direct wearable integration for richer data |
| WhatsApp + Slack + Email | Multi-platform communication |
| Google Calendar Integration | Read/write calendar events, suggest rescheduling |
| Sub-Agent Routing | Health Analyst (Haiku), Comms Manager, Research Agent |
| Mental Wellbeing Monitor | 30-day trend analysis for wellbeing flags |
| Task-Cognition Matching | Match tasks to optimal time slots by CRS prediction |
| Skills Marketplace | Install/manage domain-specific skill packages |
| L2 Autonomy (Co-Pilot) | Suggest + execute with one-tap approval |
| Memory Compaction | Auto-summarize old daily logs into core memory |

### P2 — Nice to Have (Phase 3+)

| Feature | Description |
|---------|------------|
| Meta Ray-Ban Display | Voice I/O through glasses, camera context |
| A2A Protocol Support | Agent Card + external agent communication |
| L3 Autonomy (Full Agent) | Act independently for trusted users |
| Voice Agent | Speech-to-text + text-to-speech pipeline |
| Enterprise Wellness | Team dashboards, admin controls, SSO |
| OneBand Custom Hardware | Continuous HRV, temp, SpO2, EDA |
| Developer API | Let others build on OneSync Agent OS |

## 11. Success Metrics

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

# Part D: Market Analysis

## 12. Market Size & Timing

### 12.1 Market Size

| Market | Size | Source |
|--------|------|--------|
| AI Agents Market | $7.84B (2025) → $52.62B (2030) | MarketsAndMarkets, 46.3% CAGR |
| **Wellness Apps** | **$25.26B (2025) → $68.55B (2034)** | Grand View Research, 11.7% CAGR |
| **AI Companion Market** | **$37.73B (2025) → $435.9B (2034)** | Industry forecasts, 31.3% CAGR |
| **Corporate Wellness** | **$68B (2025) → $129B (2034)** | Grand View Research |
| Digital Health | $330B (2025) → $600B+ (2030) | Grand View Research |
| Wearable Health Tech | $200B+ by late 2020s | Industry forecasts |
| US Wearable Users | 86.4 million (2026) | eMarketer |
| **Healthcare AI Funding (2025)** | **$3.4 billion raised** | CB Insights — median health AI valuations 41% above general AI |
| **Our Target (intersection)** | **$15-25B by 2030** | Agent-assisted personal health optimization |

### 12.2 Why Now — 5 Converging Trends

1. **Wearable data explosion:** 86.4M Americans wear health trackers but data goes unused. The "data-to-action gap" is our opportunity.

2. **Agent infrastructure is ready:** Claude Agent SDK, MCP (97M monthly downloads), Google A2A v0.3, all under Linux Foundation AAIF — building an interoperable agent in 2026 is 10x easier than 2024. Prompt caching (90% discount) and Compaction API make it economically viable.

3. **Meta validated the thesis:** $2B Manus acquisition + Ray-Ban Display + neural band. Zuckerberg wants "personal superintelligence." Biology-aware agents are a natural extension.

4. **Apple scaled back:** Apple Health+ scaled back in February 2026. The biggest potential competitor is pulling away from health AI, leaving the market open.

5. **Burnout epidemic:** Post-pandemic burnout continues. Corporate wellness market at **$68B** (growing to $129B by 2034). Knowledge workers are looking for tools that respect their biology.

6. **Demand validated at scale:** ChatGPT Health sees 40M daily health queries. Oura valued at $5.2B. Healthcare AI raised $3.4B in 2025 alone with median valuations 41% above general AI. The market is ready for health-aware intelligence.

## 13. Competitive Landscape — Full Matrix

| Feature | OneSync | Lindy | ChatGPT Health | Nori | Oura AI Advisor | Lifestack | Bee (Amazon) | ONVY | OpenClaw | Perplexity |
|---------|---------|-------|---------------|------|----------------|-----------|-------------|------|----------|-----------|
| **Biometric awareness** | ★★★★★ | ☆☆☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★★ | ★★★☆☆ | ☆☆☆☆☆ | ★★★★☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| **Agent autonomy** | ★★★★☆ | ★★★★★ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★★☆ | ★★★★★ |
| **Health algorithms** | ★★★★★ | ☆☆☆☆☆ | ★☆☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ☆☆☆☆☆ | ★★★☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| **Proactive heartbeat** | ★★★★★ | ★★★☆☆ | ☆☆☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★★ | ★★☆☆☆ |
| **Multi-platform comms** | ★★★★☆ | ★★★★★ | ★☆☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★★★★ | ★★★☆☆ |
| **Memory/learning** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★★★ | ★★★★☆ |
| **Protocol interop (MCP/A2A)** | ★★★★☆ | ★☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Progressive autonomy** | ★★★★★ | ★★☆☆☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ★★★☆☆ | ★★★☆☆ |
| **Valuation/Funding** | Pre-seed | ~$50M | OpenAI | YC F25 | $5.2B | Pre-seed | Amazon | $2M | 250K+ ★ | $20B |
| **Price** | $15/mo | $50/mo | Free (ChatGPT+) | TBD | $5.99/mo + ring | Free/TBD | $49 device | TBD | Free/self-host | $200/mo |

**Key insight:** Nobody scores high on BOTH biometric awareness AND agent autonomy. ChatGPT Health has distribution (40M daily queries) but zero agency. Oura has the best health data but minimal autonomy. Lindy has the best agency but zero biology. **OneSync is the only product designed to score high on both axes.** That's the empty quadrant. That's OneSync.

## 14. Device Ecosystem & Partnerships

### 14.1 Device Integration Roadmap

**MVP strategy: ONE wearable, done right.** We pick one primary device and optimize the entire experience for it before expanding.

| Phase | Device | What We Get | API Status |
|-------|--------|------------|------------|
| **MVP** | **Samsung Galaxy Watch 5/6** (primary) | HR, HRV, sleep, steps, SpO2, temp | ✅ Health Connect |
| **MVP** | **Oura Ring Gen 3** (alternative primary) | HRV, sleep stages, readiness, temp | ✅ Oura API v2 |
| **Phase 2** | Other Health Connect watches | HR, HRV, sleep, steps | ✅ Health Connect |
| **Phase 2** | Apple Watch | HR, HRV, sleep, steps, SpO2 | ✅ HealthKit |
| **Phase 2** | WHOOP | HRV, strain, recovery, sleep | ✅ WHOOP Dev API |
| **Phase 2** | Garmin | Body Battery, stress, HRV, sleep | ✅ Garmin Health API |
| **Phase 3+** | Meta Ray-Ban Display | Camera, 5-mic, speakers, neural band | ✅ Wearables DAT |
| **Phase 4** | OneBand (own) | Continuous HRV, temp, SpO2, EDA | 🔨 Custom build |

### 14.2 Meta Ray-Ban Display — Future Vision (NOT in early pitch)

> **Important:** Meta Ray-Ban is part of the long-term platform vision, but we do NOT lead with it in MVP or Phase 1 investor conversations. It adds hardware complexity and distraction before the core biology-aware co-pilot experience is proven. Include only in "future vision" sections of pitch materials.

Meta's Wearables Device Access Toolkit gives access to 12MP camera, 5-microphone array, open-ear speakers, and Neural Band (EMG). The integration architecture (watch for biology data, glasses for ambient interaction) is compelling but premature for early stage. We prove the thesis with just a watch/ring + phone first.

### 14.3 Partnership Strategy

**Primary wearable maker (Oura or Samsung):** Deep integration partnership. "Get more from your Galaxy Watch with OneSync" or "Your Oura Ring data, finally actionable." Co-marketing, referral revenue, potential data API partnership.

**Other wearable makers (WHOOP, Garmin):** Phase 2 expansion. Referral partnerships once MVP traction is proven.

**Enterprise wellness providers:** Integrate with existing corporate wellness programs. OneSync as the cognitive co-pilot layer on top of existing health data infrastructure.

**Meta (Phase 3+):** Longer-term opportunity. Build a showcase app for Ray-Ban Display once the core product has traction.

## 15. Investor FAQ — Top 17 Tough Questions

**1. "Isn't this just another AI agent?"**
No. We're a Cognitive Co-pilot — the only one that reads your body. Every other agent knows your calendar. OneSync knows your biology. That means it can tell you "don't take that investor call right now, your cognitive readiness is at 42 and your HRV says you need recovery" — no other agent can do that. Biology intelligence is our moat — it requires health algorithms, biometric data pipelines, and months of personal data that can't be replicated by competitors bolting on a health API overnight.

**2. "How do you compete with Lindy (~$50M raised)?"**
We don't compete head-on. Lindy does task automation blind to the user's body — they've raised ~$50M, launched Lindy 3.0 + Enterprise (HIPAA), and claim 400K users (unverified, likely includes free/trial). We do biology-aware task optimization. Different wedge, complementary positioning. When Lindy wants health intelligence, they'll integrate with our Health MCP Server — or acquire us.

**3. "Lifestack already does health + calendar."**
Lifestack is a calendar app with health data. We're an agent OS with biology as a first-class citizen. They schedule your day. We live your day with you — proactive, autonomous, cross-platform, learning.

**4. "What about Meta building this?"**
Meta validated our thesis ($2B Manus acquisition). But Meta's approach is hardware + general agent. They don't have biology intelligence. We build ON Meta's hardware (Ray-Ban Display), not against it. That's a partnership, not a competition.

**5. "Are your health algorithms accurate enough?"**
Let's be honest: single-metric HRV prediction claims (e.g., "82.4% accuracy" from lab studies) don't translate directly to consumer wearables. Systematic reviews show HRV is associated with cognitive performance but effect sizes are modest. Oura's readiness score: HRV explains <5% of variance; resting HR explains 29%. Cross-device agreement is limited (WHOOP vs Oura HRV correlates at only r=0.41).

**But that's exactly why our approach works.** Our moat isn't single-metric prediction — it's **multi-signal interpretation via LLM reasoning.** Google's PHIA (Personal Health Information Agent) achieves 84% accuracy on health reasoning benchmarks by reasoning across multiple signals, not relying on one number. That's what CRS does: combine HRV + sleep quality + activity + circadian phase + user feedback into a holistic score via Claude's contextual reasoning.

We start with population-level defaults (instantly useful), then personalize via the CRS Feedback Loop (thumbs up/down on every prediction). Target: ~70% accuracy on day one → ~85% personalized within 30 days. No cherry-picked lab numbers — real-world, user-validated accuracy.

**6. "Can one person build this in 10-15 days?"**
Yes. The MVP is ~1,710 LOC using Supabase (replaces 4 services), Claude API tool_use (replaces LangGraph), and Expo (cross-platform mobile). We focus on ONE wearable (Galaxy Watch or Oura Ring), one communication channel (Telegram), and population-level defaults for instant onboarding. Modern infrastructure makes this realistic.

**7. "What's the moat?"**
Five layers: (a) biology algorithms improve with more personal data (network effect on yourself — switching cost), (b) the Prediction-Accuracy Feedback Loop generates the largest dataset of subjective cognitive performance correlated with biometrics — no one else has this, (c) Agent OS with 10-file configuration is a platform others can build on, (d) longitudinal health + behavior data creates a "personal health model" that's unique to each user and impossible to replicate, (e) **Health MCP Server** — our open-source MCP server becomes the standard way any agent accesses health data. If every Claude-powered agent uses our MCP server for health data, we're infrastructure, not just an app. MCP has 97M monthly SDK downloads — that's our distribution channel for ecosystem gravity.

**8. "A2A protocol — isn't that premature?"**
Google A2A v0.3 is production-ready with Python SDK and gRPC support. We don't build it in MVP, but our architecture is designed for it. When agent-to-agent becomes mainstream (2026-2027), we're ready day one.

**9. "What's the revenue model?"**
$15/mo Pro tier. Target: 500 paying users by month 6 = $7,500 MRR = $90K ARR. Enterprise at $8/user/mo for team wellness. AI-first SaaS business with health data moat and very low per-user cost (~$1.60/mo with prompt caching). AI-first SaaS margins typically range 20-60% (lower than traditional SaaS due to inference costs), but prompt caching (90% discount on repeated system prompts) and model routing (Haiku for simple tasks) keep us at the higher end: ~90% gross margin at scale.

**10. "Why should we fund you vs wait for Apple/Google/OpenAI?"**
Apple Health+ scaled back in February 2026. Google builds infrastructure (Health Connect, A2A protocol, PHIA research) but doesn't ship consumer health agents — PHIA achieved 84% on health reasoning benchmarks and validates our approach but remains a research paper, not a product. ChatGPT Health (OpenAI) sees 40M daily health queries but is reactive Q&A only — no proactive interventions, no biometric triggers, no agent autonomy. Big tech validates the demand and builds platforms; we build the biology-aware action layer ON those platforms.

**11. "How do you handle health data privacy and regulation?"**
All health data stays on-device or in the user's own Supabase row (RLS-enforced). We never aggregate health data across users. HIPAA-adjacent practices from day one. We're a wellness tool, not a medical device — no FDA implications (FDA wellness guidance doesn't require clearance, but health claims must be carefully managed).

**Regulatory landscape we're tracking:** Colorado SB24-205 (AI transparency, enforcement began Feb 2026) — requires disclosure when AI is used in consequential decisions. EU AI Act Article 14 mandates human oversight for high-risk health AI — our progressive autonomy model (L0→L3 with explicit user control) is inherently compliant. ChatGPT Health's playbook is instructive: isolated data storage, E2E encryption, excluded from model training, deliberate EU avoidance at launch. We follow the same pattern.

**Privacy architecture:** Health data is E2E encrypted at rest, excluded from any model fine-tuning, and deletable on user request. BODY.md is stored per-user, never cross-referenced. We follow the "ChatGPT Health template" for regulatory safety.

**12. "What if Oura/WHOOP/Garmin build this themselves?"**
They're hardware companies optimizing for device sales. Their apps show dashboards; they don't build agents. Building an Agent OS requires AI expertise, LLM integration, and multi-platform communication — a completely different engineering DNA.

**13. "How do you get to $1M ARR?"**
$15/mo × 5,556 paying users = $1M ARR. At 10% conversion from free to paid and our $1.90/user cost, we need ~55,000 total users. Achievable within 12-18 months with the burned-out knowledge worker wedge → broader expansion path. The "Time to Magic < 24h" onboarding removes the biggest activation barrier.

**14. "What's the Meta Ray-Ban integration timeline?"**
Meta Ray-Ban is part of our long-term vision (Phase 3+), not our early pitch. We prove the core cognitive co-pilot thesis with just a smartwatch/ring + phone first. Meta's Wearables DAT is available for developers, and we'll apply for access once we have traction (Month 5-8). We don't need Ray-Ban to be valuable — the watch-based stress intervention alone is the killer feature.

**15. "Is this a venture-scale business?"**
The AI agent market grows from $7.84B to $52.62B by 2030. The wellness app market hits $68.55B by 2034. The AI companion market reaches $435.9B by 2034. Healthcare AI raised $3.4B in 2025 alone with median valuations 41% above general AI. We're at the intersection with a platform play (Agent OS + skills marketplace + Health MCP Server + A2A). If 0.1% of 86.4M US wearable users adopt at $15/mo, that's $155M ARR. Yes, it's venture-scale.

**16. "What about ChatGPT Health? Doesn't OpenAI have a massive head start?"**
ChatGPT Health validates our thesis at massive scale — 40M daily health queries proves users want AI to understand their body. But ChatGPT Health is a reactive Q&A interface: you ask questions, it answers. It can't proactively intervene when your HRV drops, reschedule your meetings based on your CRS, or send you a Telegram message with a breathing exercise at exactly the right moment. We're not competing with ChatGPT Health — we're building the action layer it's missing. They proved the demand; we build the agent. Long-term, our Health MCP Server could even provide health data to ChatGPT, making us infrastructure that OpenAI's product depends on.

**17. "Why build on Anthropic's stack specifically?"**
Three reasons: (a) **Claude Agent SDK** provides native subagent spawning, model selection per subagent, and built-in tool orchestration — exactly what our multi-agent architecture needs, without LangGraph/LangChain middleware. (b) **MCP (Model Context Protocol)** with 97M monthly SDK downloads and 28% Fortune 500 adoption is the emerging standard for agent-to-tool communication. Building our Health MCP Server on this protocol gives us the widest distribution. (c) **Prompt caching** (90% discount, 1-hour extended TTL) and **Compaction API** (server-side context summarization) solve our two biggest cost/complexity challenges: repeated system prompts and memory management. Anthropic's ecosystem is the most production-ready for health-aware agent development, and CLAUDE.md/MEMORY.md paradigm alignment means our Agent OS architecture is native to this ecosystem, not bolted on.

## 16. The Ask

### For IVI-ISB
Incubation support, mentorship, and $50K pre-seed to build MVP and validate with 500 beta users.

### For YC S26
$500K for 7% equity. 18-month runway to go from MVP → 10K users → Series A readiness. Focus: nail the biology-aware agent experience, prove the empty quadrant thesis, establish platform foundations.

### For Antler
$100K pre-seed + co-founder matching. The hardware vision (OneBand + Meta Ray-Ban integration) needs a hardware co-founder. Antler's co-founder matching is uniquely valuable for this.

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

*This document consolidates all strategic, architectural, product, and market thinking for OneSync — your AI co-pilot that reads your body — into a single reference. It is designed to be read by investors, co-founders, advisors, and the founding team as the definitive guide to what we're building, why, and how.*

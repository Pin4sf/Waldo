# Waldo — Master Reference Document

**Version:** 1.1 (post-critique)
**Date:** March 17, 2026
**Status:** The single source of truth for building Waldo. All previous docs are now archived reference material.

> **Brand:** Waldo — the biological intelligence agent. Dalmatian mascot. Tagline: "Already on it."
> **Naming:** Morning Wag (daily briefing), Fetch (intervention), Spots (patterns), Patrol (24/7 analysis), Constellation (long-term map), Nap Score (consumer CRS).
> **Tiers:** Pup (free), Pro (full), Pack (team/family).

> **"Every AI agent knows your calendar. Only Waldo knows your body."**

> This document supersedes all previous planning documents. When any prior doc conflicts with this one, this wins. The 15 previous docs in `Docs/` informed this document and remain as appendices for deep dives, but you should never need to open them during development.

---

## How to Use This Document

| If you need... | Go to... |
|---------------|----------|
| The pitch, market position, business case | **Part 1: Executive Summary** |
| What to build, schemas, code specs, tool definitions | **Part 2: MVP Build Specification** |
| What comes after MVP, full product vision | **Part 3: Full Product Architecture** |
| What was decided and why (contradictions resolved) | **Appendix A: Decision Log** |

---

# PART 1: EXECUTIVE SUMMARY

## 1.1 What Waldo Is

A **personal cognitive operating system** — an AI agent on your phone that reads your body signals from wearables (Apple Watch + Android), manages your tasks based on your cognitive state, and evolves into an autonomous OS that handles virtually any task in your life.

**Three pillars, built in sequence:**

| Pillar | Phase | What It Does |
|--------|-------|-------------|
| **Body Intelligence** | MVP | Reads HRV, HR, sleep, activity from any wearable (HealthKit + Health Connect). Computes CRS (consumer name: Nap Score) on-phone (offline). Detects stress. Messages you proactively — via your preferred channel — before you crash. |
| **Task Intelligence** | Phase 2 | Connects to calendar, email, Slack, tasks. Prioritizes work by CRS. Reschedules meetings when you're depleted. |
| **Autonomous Personal OS** | Phase 3+ | Learns skills from you. Delegates to specialist sub-agents. Executes arbitrary tasks. Powers other agents (Cursor, Lindy, Claude Code) with your biological state. |

**The core loop:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                         │
│  Apple Watch (HealthKit) ──┐                                        │
│  Android Watch (Health Connect) ──→ Native Modules (Swift/Kotlin)   │
│                                        → op-sqlite + SQLCipher      │
│                                        → CRS Engine (TypeScript)    │
├─────────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE LAYER                                                  │
│  CRS + Stress Detector → Supabase Sync → pg_cron (every 15 min)    │
│                                            → Rules Pre-Filter       │
│                                              (60-80% skip = $0)     │
│                                            → Claude Haiku 4.5       │
│                                              (25-field prompt,      │
│                                               10 hooks, 8 tools,    │
│                                               3 iter, 50s timeout)  │
├─────────────────────────────────────────────────────────────────────┤
│  DELIVERY LAYER                                                      │
│  Personality Spectrum (5 zones × 4 modes)                            │
│    → 5 Quality Gates → 4-Phase Nudge → Channel Adapter                    │
│    → Feedback buttons → 3-Tier Learning → Memory (with decay)       │
├─────────────────────────────────────────────────────────────────────┤
│  ONBOARDING (AI Interview)                                           │
│  Day 0: Dynamic AI interview (3-5 min) → core_memory populated     │
│  Day 3: Sleep deep-dive (with real data)                             │
│  Day 7: Stress calibration (after first detection)                   │
│  Day 14: Relationship check-in                                       │
│  Agent personalized from Day 1, not Day 14.                          │
└─────────────────────────────────────────────────────────────────────┘
```

**What makes it different:** Y Combinator's 2026 RFS calls for "AI that can DO, not just assist" — nearly 50% of their latest batch is AI agents. NVIDIA GTC 2026 declared autonomous agents the next infrastructure layer. Every agent (Lindy, OpenClaw, Manus) can manage your calendar and draft emails. But NO agent knows when you're cognitively depleted. They'll schedule your hardest meeting when your HRV has crashed.

62% of knowledge workers report burnout (HBR, Feb 2026). The tools meant to help are making it worse because they're blind to the body.

**Waldo is the biological intelligence layer for the agentic economy.** It's the agent that knows your body — and the one that every other agent will eventually need to talk to. Architecture distilled from 14 production-grade agent systems (OpenFang, Paperclip, OpenViking, CoPaw, Pi Mono, NemoClaw, Agency-Agents, and 7 more).

## 1.2 Market Position

### The Empty Quadrant

```
                        Agent Autonomy
                    Low <------------------> High

        High  | Oura Advisor, WHOOP  |  * Waldo *          |
  Body        | Coach, Garmin,       |  Biology + Agency     |
  Awareness   | Samsung Health       |  (knows body + acts)  |
              | (track, don't act)   |                       |
              |----------------------------------------------|
        Low   | Lifestack, ONVY,     |  Lindy, OpenClaw,     |
              | Nori, ChatGPT Health |  Perplexity, Manus    |
              | (health-aware but    |  (agent, no biology)  |
              |  limited autonomy)   |                       |
              '----------------------------------------------'
```

**The agentic economy needs a biological layer.** Every AI agent managing tasks, emails, and calendars is operating without the most important context: the human's cognitive and physical state. Waldo fills that gap — first as a standalone agent, eventually as the "body API" that other agents query via MCP/A2A protocols.

**Window estimate:** Apple Health+ was scaled back (Bloomberg, Feb 2026). WHOOP has proactive nudges but is single-device/$30/mo. Execution speed is the moat.

### Market Size

- Global wearable health market: $60B+ (2026), growing 15%+ annually
- AI agent market: $7.84B → $52.62B by 2030 (46.3% CAGR)
- Global smartwatch installed base: ~500M+ devices (Apple Watch ~50% market share)
- India smartwatch market: 38M+ units shipped in 2025
- **Target market is global, not India-only.** MVP launches cross-platform (Android + iOS) with founder's network. iOS + Apple Watch from Day 1 unlocks the richest, most health-conscious user base immediately — not deferred to Phase 3.

**Bottom-up market sizing:**
- India (MVP): 5-8M Android watches with HRV + growing iPhone/Apple Watch premium segment → ~50-80K potential users → ~5,000 paying at Rs 399/mo = ~$260K ARR
- Global (iOS + Apple Watch): ~200M Apple Watch users → even 0.01% penetration = 20,000 paying at $9.99/mo = ~$2.4M ARR
- **iOS in MVP = venture-scale from Day 1.** India validates product-market fit at near-zero cost. iOS unlocks global willingness-to-pay 5-10x higher.

### Competitive Landscape

| Market Player | What They Do | Waldo Advantage | Relationship |
|-----------|-------------|-------------------|-------------|
| **WHOOP** ($3.6B) | WHOOP Coach AI (GPT-4 powered) now has **proactive nudges** — Daily Outlook (morning), Day in Review (evening), rising stress alerts. Strength Trainer, AI memory, WHOOP Age/healthspan. $199-359/yr subscription. | Single-device (proprietary band required), **in-app only** (confirmed: no Telegram/WhatsApp/SMS for coaching), device-locked ecosystem, $199-359/yr. Coach UX "fairly mixed since 2023 launch." | **HIGH overlap** — closest to proactive model; potential data partner (they lack cross-platform biology) |
| **Oura** ($5.2B) | Oura Advisor AI active. Launched proprietary AI model for women's health (Feb 2026). Personalized, clinically grounded. | Single-device, no proactive messaging outside app, coaching not agency | **MEDIUM overlap** — specialized AI; potential partner (Oura data → Waldo agent) |
| **Apple Health+** | AI health coach was **SCALED BACK** (Bloomberg, Feb 2026). Features rolling out individually in Health app, not as unified service. Siri + Health with iOS 27. | Apple-only, fragmented rollout, no proactive external messaging | **LOW overlap** (near-term) — complementary; Waldo adds cross-platform + external messaging |
| **Nori** (YC F25) | Concierge AI health coach aggregating Apple Health + medical records + wearables into daily plan. Built **HealthMCP** (Model Context Protocol for health data — validates the "body API" concept). **iOS only — no Android.** Founders: 2x YC, 2x exits (Chartable → Spotify, Octopart → Altium). | **iOS only** (no Android at all). Scheduled morning plan only (no real-time proactive alerts). No external messaging. Users report data syncing issues ("getting a lot of things wrong"). Strong founders are the threat, not the current product. | **MEDIUM overlap** — strong team; potential integration (HealthMCP aligns with our body API vision) |
| **Lindy** ($50M+ raised) | AI Chief of Staff, 4000+ integrations | Zero biology awareness | **LOW overlap** — integration partner (Lindy + Waldo biology = smarter task agent) |
| **ChatGPT Health** | 230M weekly health queries (Jan 2026) | Purely reactive Q&A, no biometric integration | **LOW overlap** — complementary (reactive Q&A vs proactive agent) |
| **Sahha.ai** | Health AI SDK for developers | B2B SDK, not end-user product | **LOW overlap** — potential data partner (their SDK, our agent) |
| **Welltory** | HRV analysis + recommendations. Notable: has native Galaxy Watch app that measures HRV directly (bypassing Samsung Health's sync gap). | No proactive messaging, no AI agent, no unified score | **LOW overlap** — potential data partner (Galaxy Watch HRV) |

**Critical competitive update (March 2026):** WHOOP Coach proactive nudges are **confirmed in-app only** — no delivery via Telegram, WhatsApp, SMS, or any external channel. WHOOP remains device-locked ($199-359/yr), powered by GPT-4. Nori (YC F25) is iOS-only with no Android version. **Neither competitor delivers coaching via external messaging channels. Waldo's clearest differentiators: (1) device-agnostic, (2) channel-agnostic delivery via adapter pattern, (3) biology as a service for the agent ecosystem.**

**Waldo's differentiation pillars:** (1) device-agnosticism via Health Connect + HealthKit, (2) channel-agnostic delivery via adapter pattern (Telegram → WhatsApp → Discord → Slack → in-app), (3) free/affordable pricing (50-100x cheaper than WHOOP), (4) CRS as a transparent unified score (algorithm published, unlike all competitors), (5) cross-platform (Android + iOS from MVP).

**Apple threat reduced:** Bloomberg reported Apple scaled back Health+ AI coach plans. Features being rolled out incrementally, not as a unified service. This gives Waldo more runway than the 12-18 month estimate in earlier docs.

### Positioning: "Morning Wag" → "Cognitive Co-Pilot"

**External framing (what users and investors hear first):** "An AI that reads your smartwatch and tells you each morning how to make the most of your day." The Morning Wag is the wedge — tangible, testable, habitual. It uses overnight data (most reliable), doesn't interrupt, and delivers the core value proposition in 30 seconds.

**Internal architecture:** A general-purpose Agent OS with biological intelligence. The market doesn't need to know that yet.

**Wedge:** Enter as "your AI Morning Wag that reads your body" → add stress pattern tracking → add workspace connectors (calendar, email, Slack, tasks) → become "the cognitive performance optimizer that knows your body AND your world."

### The Two Intelligence Layers

Waldo's real power comes from combining **biological intelligence** with **life/work context**:

| Layer | Sources | What It Knows |
|-------|---------|--------------|
| **Biology** | Wearable via Health Connect (HRV, HR, sleep, steps, SpO2) | Cognitive state right now — sharp, fatigued, stressed, recovering |
| **Life Context** | Calendar, email, Slack/Teams, task managers (Phase 2+) | What's coming, what's urgent, what can move, who's waiting |

Neither layer alone is sufficient. Health apps know your body but not your calendar. Productivity agents know your calendar but not your body. **Waldo combines both to automate tasks that no other agent can:**

| Agentic Task | Bio Signal + Context Signal | What Agent Does |
|-------------|---------------------------|-----------------|
| Smart scheduling | CRS depleted + deep work block ahead | Moves deep work to predicted high-CRS window |
| Meeting triage | HRV drops after 3 consecutive meetings + 5 lined up | Inserts break, suggests declining lowest-priority |
| Proactive rescheduling | CRS crashed + important presentation in 2 hours | Suggests moving to tomorrow morning |
| Focus protection | Circadian peak detected + low-priority meetings during peak | Proposes declining to protect best hours |
| Stress pattern discovery | HRV drops 25% every Monday 2-4pm + recurring 1:1 on calendar | Surfaces correlation, offers preparation strategies |
| Workload balancing | 7-day HRV baseline down 12% + 3 new tasks assigned | Flags overcommitment with evidence |
| Recovery nudge | 4+ hours sleep debt + light calendar tomorrow | Protects recovery space |

**MVP = Biology layer only** (Health Connect + HealthKit + CRS + Channel Adapter [Telegram first]) — proves the plumbing works and proactive messaging creates engagement.

**MVP v2 (Phase 2) = The real product.** Add workspace connectors + user-created skills + conversational learning. This is where Waldo becomes a true autonomous agent:
- Agent learns from conversation what the user wants automated
- User can teach the agent new skills ("when my CRS drops below 50 and I have a presentation, move it")
- Agent builds skills dynamically from user behavior patterns, not just pre-programmed triggers
- Full workspace context (calendar, email, Slack, Notion, task managers) enables the agentic tasks below

**Phase 3+ = Full cognitive performance optimizer** with predictive models, Samsung Sensor SDK (true HRV), cloud wearable APIs, and agent-to-agent interop.

### The Agent Skills Vision (Phase 2)

The end-state agent is not limited to pre-built Fetch Alerts and Morning Wags. **The user should be able to create any skill the agent can execute:**

| How Skills Get Created | Example |
|----------------------|---------|
| **User teaches via conversation** | "When I'm stressed and have a meeting in the next hour, send me 3 talking points so I feel prepared instead of anxious" → agent creates this as a repeating skill |
| **Agent discovers from patterns** | After 4 weeks: "I've noticed your HRV recovers faster on days you take a walk between 2-3pm. Want me to block that time on your calendar?" → user approves, becomes a skill |
| **User configures explicitly** | Settings: "If CRS < 40, auto-decline all optional meetings and draft apology messages" |
| **Skills marketplace (Phase 4)** | Other users share skills: "exam-prep-optimizer", "jet-lag-recovery", "sprint-planning-protector" |

The agent's intelligence comes from combining **biology + workspace context + conversation memory + learned skills**. Every conversation teaches it something. Every thumbs-up/down refines a skill. Over time, the agent becomes uniquely yours — not because of the algorithm, but because of the skills it has learned specifically for your life.

### Connector Roadmap

| Connector | Phase | What It Unlocks |
|-----------|-------|----------------|
| Google Calendar / Outlook | Phase 2 | Meeting-aware interventions, schedule optimization, focus protection |
| Gmail / Outlook | Phase 2 | Communication timing, Morning Wag includes email context |
| Slack / Teams | Phase 2 | Context-switching detection, meeting fatigue correlation |
| Linear / Notion / Jira | Phase 3 | Workload balancing, sprint strain detection |
| Zoom / Google Meet | Phase 3 | Meeting join/leave detection, meeting fatigue measurement |
| MCP / A2A protocol | Phase 4 | Waldo as "body API" for other agents (Lindy, OpenClaw query your CRS) |

## 1.3 Business Model

### Pricing

| Tier | Price | What You Get | Per-User AI Cost | Gross Margin |
|------|-------|-------------|-----------------|-------------|
| **Pup (Free)** | Rs 0 | Daily CRS + Morning Wag + messaging channel + 3 msgs/day | ~$0.27/user | N/A (acquisition) |
| **Pro** | Rs 399/mo ($4.34) | Full CRS + Fetch Alerts + unlimited msgs + weekly analysis | ~$0.90/user | 79% |
| **Pack** | Rs 999/mo/seat | Team dashboard + API access + priority support | ~$0.90/user | 92% |

**Comparisons:** Oura Rs 599/mo, WHOOP Rs 2,500/mo, Lindy $50/mo.

### Unit Economics (Verified March 2026)

**API pricing:** Claude Haiku 4.5 = $1/$5 per MTok (input/output). Cache read = $0.10/MTok. 1-hour cache write = $2/MTok.

**Per-user call volume:** ~7 Claude calls/day for Pro users (Morning Wag + ~1 Fetch Alert + ~5 conversation calls). The 96 daily 15-min background checks are handled by the rules-based pre-filter — no Claude call unless something is actually abnormal.

**Per-call cost with caching:** ~$0.003-0.005 (2000 tokens cached at 0.1x + 1000 fresh at 1x + 350 output at 5x + amortized cache writes).

**Monthly cost breakdown:**
- Free user (3 calls/day): **~$0.27/month**
- Pro user (7-10 calls/day): **~$0.80-1.00/month**
- Heavy Pro user (15 calls/day): **~$1.50/month**

**Break-even:** ~50 Pro subscribers covers AI + infrastructure costs. ~200 Pro subscribers = comfortable profitability ($393/month profit assuming 5:1 free-to-paid ratio).

**Key cost levers:**
1. Rules-based pre-filter eliminates ~96 daily Claude calls per user (the 15-min checks). Savings: ~$8.70/user/month.
2. Prompt caching (1-hour TTL for soul files, 5-min for user profile): cache reads at 10% of input cost.
3. Dynamic tool loading: 3-4 tools per call instead of 8 saves ~300 tokens/call.

### Full Recurring Cost Map (All Phases)

**MVP — Direct Costs:**

| Service | Free Tier | Paid Tier | When to Upgrade | Notes |
|---------|-----------|-----------|----------------|-------|
| **Claude Haiku 4.5** | Pay-per-use | ~$0.90/Pro user/mo | Day 1 | Core AI. No free tier. |
| **Supabase** | 500MB DB, 500K Edge calls | $25/mo (Pro: 8GB, 2M calls) | ~120-140 users | Free tier pauses after 7 days inactivity — set up keep-alive cron |
| **Telegram Bot API** | Free forever | — | Never | No cost at any scale |
| **Health Connect SDK** | Free forever | — | Never | Android system API |
| **Google Play Console** | — | $25 one-time | Before beta | One-time, not recurring |
| **Expo EAS** | 15 builds/mo | $29/mo | When team grows | Free tier sufficient for MVP |
| **Domain + SSL** | — | ~$18/year (~$1.50/mo) | Before public launch | Cloudflare or Namecheap |

**MVP total for 100 users: ~$90-115/month** (Claude ~$63 + Supabase $25 + domain $1.50)

**Phase 2 — Workspace Connectors:**

| Connector | API Cost | Limits | Fallback if Blocked |
|-----------|---------|--------|-------------------|
| **Google Calendar API** | **Free** | 1M queries/day | N/A — generous limit |
| **Gmail API** | **Free** | Quota-based, generous | N/A |
| **Slack API** | **Free** (Bot tokens) | Rate-limited per workspace | N/A |
| **Microsoft Outlook/Teams** | **Free** (Graph API) | 10K requests/10min per app | N/A |
| **WhatsApp Cloud API** | Free: 1,000 service conversations/mo. Then: ~$0.02/msg (India) | Per-message after free tier | Telegram remains primary. WhatsApp is additive. |
| **FCM Push Notifications** | **Free** | Unlimited | N/A — Google service |

**Phase 2 connector cost: effectively $0** for MVP-scale. WhatsApp adds ~$0.02/message beyond 1000 free/month.

**Phase 2-3 — Wearable Cloud APIs:**

| Wearable API | API Cost | Requirement | Data Available |
|-------------|---------|-------------|---------------|
| **Oura API** | **Free** | User must have active Oura membership ($6/mo, paid by user) | Sleep, HRV (nightly avg), readiness, HR (5-min intervals) |
| **Fitbit Web API** | **Free** | User has Fitbit account | HR, HRV (sleep only, 5-min RMSSD), sleep stages, SpO2 |
| **WHOOP API** | **Free** | User has WHOOP membership ($30/mo, paid by user) | Recovery, strain, daily RMSSD, sleep, respiratory rate |
| **Garmin Connect IQ SDK** | **Free** | No approval needed | Raw IBI, HR, SpO2, temp, accel (on-watch app, Monkey C) |
| **Samsung Sensor SDK** | **Free** | Dev mode: no approval. Distribution: may need partnership. | Raw IBI (1Hz), HR, accel, PPG, skin temp, EDA (GW8+) |

**Wearable API cost: $0.** All free. User pays for their own device/membership.

**If Direct SDK Access is Denied — Fallback Aggregators:**

| Aggregator | Pricing | What You Get | When to Consider |
|-----------|---------|-------------|-----------------|
| **Terra Health API*** | **$399/mo** (annual) or $499/mo (monthly). 100K credits included. ~200 credits/active user/month. | Unified API for Garmin, Fitbit, WHOOP, Oura, Samsung, Apple, 200+ devices. Pre-processed data. | Only if Samsung SDK distribution is denied AND Garmin Connect IQ is insufficient AND you need 5+ device integrations simultaneously |
| **Sahha.ai*** | Custom pricing (free sandbox) | Health scores, wearable data, engagement SDK | Only if you want pre-built health scoring instead of your own CRS |
| **ROOK*** | Custom pricing | Similar to Terra, newer | Alternative to Terra |
| **Thryve*** | Custom pricing | EU-focused aggregator | If targeting EU market |

*\*Asterisk: These are FALLBACK options. Our architecture avoids them by building direct integrations. Terra at $399/mo for 100 users = $4/user/month — destroys unit economics. Direct SDKs are $0.*

**Phase 3 — Additional Costs:**

| Service | Cost | When |
|---------|------|------|
| **Apple Developer Program** | $99/year (~$8.25/mo) | When building iOS app |
| **QStash** (per-user scheduling) | $0 (free: 500 msgs/day) → $25/mo | When per-user wake time scheduling needed at 500+ users |
| **Sentry** (error tracking) | Free (5K events/mo) → $26/mo | When you need production error monitoring |
| **Railway / Fly.io** (dedicated worker) | $5-25/mo | When Edge Function timeout is a bottleneck at 1K+ users |
| **Resend** (email digests) | Free (100 emails/day) → $20/mo | When adding weekly email reports |
| **pgvector** compute | Included in Supabase Pro | When adding semantic memory search |

**Phase 3 additional: ~$60-80/month** on top of Phase 2 costs.

### Total Cost Summary by Phase

| Phase | Users | AI Cost/mo | Infra/mo | Connectors/mo | Total/mo | Per-User |
|-------|-------|-----------|---------|--------------|---------|----------|
| **MVP** | 5 | $4.50 | $0 (free tier) | $0 | **~$5** | $1.00 |
| **MVP** | 50 | $29 | $0 | $0 | **~$29** | $0.58 |
| **MVP** | 100 | $63 | $25 | $0 | **~$88** | $0.88 |
| **Phase 2** | 200 | $126 | $25 | $0* | **~$151** | $0.76 |
| **Phase 2** | 500 | $315 | $25 | ~$10 (WhatsApp) | **~$350** | $0.70 |
| **Phase 3** | 1,000 | $630 | $75 | ~$20 | **~$725** | $0.73 |
| **Fallback*** | 100 + Terra | $63 | $25 | **$399** (Terra) | **~$487** | $4.87 |

*\*The "Fallback" row shows why we avoid aggregators. Terra alone 5x the total cost. Direct integrations are existential for unit economics.*

### What We Do NOT Pay For (Confirmed Free)

- Health Connect SDK (Android system API)
- Telegram Bot API (free at any scale)
- Google Calendar API (1M queries/day free)
- Gmail API (generous free quota)
- Slack Bot API (free tier)
- FCM Push Notifications (free)
- All wearable cloud APIs (Oura, Fitbit, WHOOP — free for developers)
- Garmin Connect IQ SDK (fully open, no cost, no approval)
- Samsung Sensor SDK (free in dev mode)

### 6-Month Runway

| Month | Phase | Users | Monthly Burn (INR) | Cumulative (INR) |
|-------|-------|-------|-------------------|-----------------|
| 1-2 | Build | 0 | ~7,000 | ~28,000 |
| 3 | Build + Self-test | 5 | ~8,000 | ~36,000 |
| 4 | Beta | 20 | ~7,000 | ~43,000 |
| 5 | Launch | 50 | ~15,000 | ~58,000 |
| 6 | Growth | 100 | ~30,000 | ~89,000 |

**Total 6-month runway: ~Rs 89,000 ($966 USD).** This is a sub-$1000 MVP.

## 1.4 Competitive Moat

| Moat Layer | Strength | Timeline |
|-----------|----------|----------|
| Personal baselines (switching cost) | Strong after 30 days | Immediate |
| Core memory (agent learns preferences) | Strong, non-exportable | Builds over months |
| Feedback dataset (CRS + thumbs up/down) | Unique labeled data no competitor has | Builds over months |
| Population model (federated learning) | Very strong after 1000+ users | 12+ months |
| Device-agnosticism | Moderate (multi-brand support) | Phase 2-3 |

**Year 1 moat = execution speed. Year 2+ moat = data network effect.**

## 1.5 Key Risks (P0)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **User retention** (health apps: 3-12% 30-day retention — Headspace 7.65%, Calm 8.34%, median ~6%) | Fatal | Proactive messaging IS the retention mechanism — app comes to you. Noom proves proactive coaching reaches 40%+ Day 30 retention. Academic evidence: tailored push notifications increase engagement by 4-12 percentage points vs passive (Klasnja et al. 2018, JMIR mHealth). |
| **Samsung HRV not in Health Connect** (confirmed: Samsung Health does NOT write HRV to Health Connect) | High | CRS designed for missing data — dynamic weight redistribution. HR BPM series as stress proxy. Pixel Watch + Fitbit DO write HRV to HC. Apple Watch via HealthKit. Samsung Sensor SDK in Phase 2 for true HRV. Validate in Phase A. |
| **HRV stress detection accuracy** (false positives destroy trust) | High | Multi-signal gating, conservative thresholds, 7-day learning period, feedback loop. Fetch Alerts gated on Phase G self-test (if false positive rate > 30%, defer to Phase 2). |
| **OEM battery killing background sync** (Samsung/Xiaomi) | High | Foreground service notification, WorkManager, device-specific setup guide. #1 technical risk per developer community. |
| **Solo founder risk** | Medium | The "AI-augmented solo founder" is the 2026 meta: 36.3% of new startups are solo-founded (Carta 2025), solo founders are 2.6x more likely to own ongoing ventures (MIT Sloan), 52.3% of successful exits are solo-founded (Crunchbase). YC: "We believe it's now possible for solo founders to build multi-billion dollar companies." Claude Code users save 4.1 hours/week avg. Actively searching for cofounder in IIT/hackathon network. |

## 1.6 Fundraising Path

| Milestone | Target |
|-----------|--------|
| Wizard of Oz validation (5-7 people including Apple Watch teammates) | Before any code |
| MVP with 5 daily users | Month 3-4 |
| Beta with 20+ users + metrics | Month 5-6 |
| **Pre-seed pitch with beta metrics** | **Month 6-7** |

**Pre-seed target:** Rs 50L - 1Cr ($55K-$110K USD)

**Capital efficiency framing:** Waldo MVP total cost: ~$966 USD. Average health tech MVP costs $50K-$150K. This is 50-150x more capital-efficient. Pre-seed funds accelerate growth (iOS polish, first hire, academic validation), not survival.

---

# PART 2: MVP BUILD SPECIFICATION

> This section contains everything you need to build. No external doc references required.
> No week-by-week timelines. Phased deliverables only. Build as fast as you can.

## 2.1 Definitive MVP Scope

### What MVP Proves

1. Health Connect (Android) and HealthKit (iOS) give enough signal for meaningful CRS computation
2. Stress detection via HRV + HR is useful (even without raw IBI)
3. Proactive messaging (via user's preferred channel) creates genuine engagement
4. **The Morning Wag becomes a daily habit** (hero feature — uses overnight data, most reliable, most habitual)
5. Claude agent personality + health context = valuable, non-generic advice
6. Cross-platform (Android + iOS) is viable from Day 1

### MVP Done Definition

> 5-7 people (including you) using Waldo daily across Android and iOS. Agent sends at least 1 useful proactive message per person per day (Morning Wag minimum). Users reply to the agent. CRS updates every 15 minutes. No critical bugs in a 7-day window. Morning Wag open rate > 60%.

### IN SCOPE

**App (React Native + Expo + NativeWind v4) — Cross-Platform:**
- **Android:** Health Connect integration (HR, HRV where available, sleep stages, steps, SpO2). Background sync every 15 minutes (Kotlin WorkManager native module). Note: Samsung watches do NOT write HRV to Health Connect — use HR BPM series as stress proxy for Samsung users. Pixel Watch + Fitbit DO write HRV.
- **iOS:** HealthKit integration (HR, HRV as SDNN — convert to RMSSD equivalent via per-user calibration, sleep stages, steps, SpO2). Apple Watch provides the most reliable HRV data among consumer wearables. Background delivery via HealthKit observer queries.
- On-phone CRS computation (offline-capable, TypeScript)
- Weighted stress confidence scoring
- CRS gauge dashboard (270-degree arc, 3 color zones)
- Sleep summary card (with sleep coaching insights: "Going to bed 30 min earlier could add ~0.8h deep sleep")
- Basic metric cards (HR, HRV, Steps with trend arrows)
- Messaging channel linking (6-digit code, Telegram first)
- Simple 3-step onboarding: Connect wearable → Grant permissions → Link messaging channel
- Settings (profile, notification preferences)
- **Caffeine/alcohol self-report** — "I had coffee" inline button suppresses Fetch Alerts 45 min, "I drank last night" adjusts morning CRS interpretation. Low effort, high personalization signal.
- "Not a medical device" disclaimer
- Encrypted local storage (op-sqlite + SQLCipher)
- Dark mode (system-aware)

**Agent (Supabase Edge Functions + Claude Haiku):**
- Claude Haiku 4.5 as single model — call `anthropic.messages.create()` directly (no middleware for MVP)
- 8 core tools (see Section 2.5)
- Hardcoded soul files in Edge Function code (versioned via git, not database)
- Hardcoded thresholds and model config (no blueprint system for MVP — add in Phase 2)
- Mode-specific soul files (base, stress-alert, morning-brief, conversational) as string constants
- Tiered context: BODY_L0 (~60 tokens always) + BODY_L1 (~400 tokens default) + L2 on-demand
- Prompt caching (2 cache blocks: personality + user profile)
- Morning Wag (daily — pg_cron every 15 min checks who needs briefing based on wake_time_estimate)
- Proactive Fetch Alert (confidence >= 0.60, 2h cooldown)
- Conversational replies (user messages bot anytime)
- 7-day learning messages
- Rules-based pre-filter (skip Claude when CRS > 60 AND confidence < 0.3) — savings estimated 60-80%, **must validate during Phase G self-test**
- Template fallback messages on API failure (with user's actual CRS/HRV data included, not generic)
- Safety guardrails (banned medical phrases, emergency keyword detection)
- **Auth:** Supabase anonymous auth on first app launch → upgrade to phone/email after onboarding. Edge Functions use service_role key for all server-side operations.

**NemoClaw-Inspired Infrastructure (Phase 2, NOT MVP):**
- Blueprint versioning, A/B testing, rollback → add when you have 50+ users
- Inference middleware with multi-provider routing → add when adding DeepSeek/Qwen
- Declarative policy enforcement → add when you have multiple developers or model routing
- Operator-in-the-loop escalation → add when expanding beyond Fetch Alerts
- Plan-apply-rollback lifecycle → add when config changes need governance
- *For MVP: hardcode everything. Change config by editing code and redeploying. You have 5 users.*

**Backend (Supabase):**
- **Auth:** Supabase Auth with anonymous sign-in on first launch. Phone number link after onboarding. Telegram bot uses service_role key (bypasses RLS by design — bot is a trusted server-side process).
- Core schema: users, health_snapshots, sleep_sessions, stress_events, conversation_history, core_memory, feedback_events, baseline_history, agent_logs
- **No NemoClaw tables for MVP** — add agent_blueprints, policy_violations, escalation_requests, config_runs in Phase 2
- pg_cron + **pg_net**: single cron job every 15 min calls `check-triggers` Edge Function via `net.http_post()`. **pg_net is required** — pg_cron runs SQL only, cannot invoke Edge Functions directly without it.
- **No pgmq for MVP** — check-triggers sends messages directly via channel adapter. pgmq adds reliability (retries, dead letter) but also complexity and latency. Add in Phase 2 when scale requires it.
- Edge Functions: channel-webhook, check-triggers (handles Fetch Alerts + Morning Wags + sends messages directly)
- Messaging bot (grammY for Telegram on Deno — first channel adapter)
- RLS on all user data tables (Edge Functions use service_role, bypassing RLS)
- UNIQUE constraint on health_snapshots(user_id, timestamp) to prevent duplicate uploads
- **Background sync idempotency:** upload queue uses upsert with ON CONFLICT(user_id, timestamp) DO UPDATE

**Data & Privacy:**
- Health data encrypted at rest (SQLCipher local, Supabase default encryption)
- Row-Level Security on all user data
- Clear disclaimer in onboarding
- Basic data export (CSV)
- No data sharing with third parties

### OUT OF SCOPE (MVP)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| WhatsApp integration | Phase 2 | Meta verification takes 2-4 weeks (not 14 days as originally estimated). Start verification in Phase A, non-blocking. Utility messages cost Rs 0.145/msg in India. |
| Samsung Sensor SDK companion watch app | Phase 2 | Samsung HRV gap confirmed — Sensor SDK gives IBI on-watch but requires Wear OS companion app. HR proxy sufficient for MVP. |
| Garmin Connect IQ companion | Phase 2 | Garmin writes to Health Connect for basic data |
| Google Calendar / Gmail integration | Phase 2 | Not needed to prove core loop |
| In-app chat | Phase 2 | Messaging adapter supports Telegram for MVP; in-app chat is a second adapter in Phase 2 |
| Push notifications (FCM/APNs) | Phase 2 | Messaging adapter handles delivery for MVP |
| Voice (Whisper STT/TTS) | Phase 3 | Complexity not justified for MVP |
| Multi-model AI routing (DeepSeek/Qwen) | Phase 2 | Haiku is sufficient, infrastructure supports later addition |
| Custom hardware (OneBand) | Phase 4 | Software-only for years 1-2 |
| Team / multi-user dashboard | Phase 4 | Single-user only for MVP |
| Weekly summary report | Phase 2 | Requires Opus, not justified for MVP |
| History screen with calendar view | Phase 2 | Dashboard is sufficient |
| Gamification / streaks | Phase 2 | Focus on core value first |
| AI interview onboarding | Phase 2 | Manual 3-step setup for beta |
| Knowledge graph | Phase 3 | Need 3+ months of user data first |
| Adaptive CRS weights | Phase 3 | Need 15+ feedback events per user |
| DND intelligence (auto-toggle DND during deep work windows) | Phase 2 | Promising feature (Android system APIs are trivial), but not core to validating the Morning Wag thesis |

### MVP Success Criteria

**Technical:**
- Background sync works on Samsung Galaxy Watch + Pixel Watch + Apple Watch (15-min intervals on Android, HealthKit observer queries on iOS)
- CRS updates within 1 minute of new health data
- Stress detection false positive rate < 30% (self-tested over 2 weeks). If > 30%, defer Fetch Alert delivery to Phase 2.
- Proactive messages delivered within 2-5 minutes of detection
- Agent conversation feels natural and context-aware
- **Morning Wag includes sleep + CRS + 1 actionable insight + sleep coaching suggestion**
- Morning Wag includes weekend recovery prediction when sleep debt > 3h
- App works offline (CRS computes without internet)
- Onboarding completes in < 5 minutes on both Android and iOS

**User:**
- Founder uses it daily for 2 weeks
- At least 5 beta users (mix of Android + iOS) complete onboarding and use for 7 days
- **Morning Wag open rate > 60%** (the hero metric)
- At least 1 user says "this message was actually useful"
- 7-day retention >= 40%

## 2.2 Tech Stack (Final Decisions)

| Layer | Technology | Package | Notes |
|-------|-----------|---------|-------|
| **Mobile App** | React Native + Expo SDK 53+ | `expo` | Custom dev client required. Cross-platform Android + iOS. |
| **Native Modules (Android)** | Kotlin via Expo Modules API | Custom | Health Connect, WorkManager |
| **Native Modules (iOS)** | Swift via Expo Modules API | Custom | HealthKit integration |
| **Health Data (Android)** | Native Kotlin HealthConnectClient | Expo native module | Direct API. Samsung: HR + sleep + steps (no HRV — work with whatever Samsung gives). Pixel/Fitbit: full HRV (RMSSD). |
| **Health Data (iOS)** | Native Swift HealthKit | Expo native module | Apple Watch: **beat-to-beat IBI** via `HKHeartbeatSeriesQuery` (compute true RMSSD), pre-computed SDNN, 4-stage sleep, SpO2, respiratory rate, ECG voltage (512 Hz), wrist temp. ~120 data types. Best data source. |
| **Background Sync (Android)** | Native Kotlin WorkManager | Expo native module | No JS cold-start. 15-min intervals. OEM battery optimization is #1 risk. |
| **Background Sync (iOS)** | HealthKit `HKObserverQuery` + `enableBackgroundDelivery` | Native Swift | `.immediate` / `.hourly` / `.daily` frequency. Simpler than WorkManager — no foreground service, no OEM fights. |
| **Local DB** | op-sqlite + SQLCipher | `@op-engineering/op-sqlite` | AES-256 encrypted |
| **State** | Zustand + TanStack Query + MMKV | Standard | Client + server + KV |
| **UI Styling** | NativeWind v4 | `nativewind` | Tailwind for RN |
| **Charts** | react-native-gifted-charts | Standard | Pure RN, no web view |
| **CRS Computation** | TypeScript (on-phone) | In-app | Offline, instant |
| **Backend** | Supabase (Postgres + Edge Functions + Auth + RLS) | Standard | Free → $25/mo at 200 users |
| **Scheduling** | pg_cron | Built-in | Supabase extension |
| **Message Queue** | pgmq | Built-in | Zero infrastructure |
| **AI Model (MVP)** | Claude Haiku 4.5 | `@anthropic-ai/sdk` | tool_use for ReAct loops |
| **AI Pre-filter** | Rules-based (no AI) | Custom Edge Function | Saves 60-80% of AI calls |
| **Telegram Bot** | grammY (Deno native) | `grammy` | Free forever |
| **SVG** | react-native-svg | Standard | CRS gauge component |

**Decisions finalized (March 20, 2026 — post-critique, post-research):**
- NativeWind v4 only (not Gluestack-UI — simpler, lighter)
- 8 tools for MVP (not 18 — the full set is Phase 1 extended / Phase 2)
- Claude Haiku only for MVP (direct API calls, no middleware)
- **Cross-platform from MVP** — Android (Health Connect) + iOS (HealthKit). React Native shared codebase, platform-specific native modules.
- **Build order: HealthKit first → Health Connect second → Agent + messaging third.** Data connectors before intelligence layer. Get the data pipeline right, then build on top.
- **Samsung Sensor SDK deferred to post-MVP.** Work with whatever Samsung gives via Health Connect (HR, sleep, steps). Add Samsung Sensor SDK companion watch app once core agent is working well and Samsung HRV is the bottleneck.
- Channel adapter pattern from Day 1 — Telegram is the first adapter implementation. WhatsApp, Discord, Slack are future adapters. Never hardcode channel assumptions into agent logic.
- 3-step onboarding (not 5-step + AI interview — too complex for beta)
- **Caffeine/alcohol self-report in MVP** — Messaging inline buttons, suppresses Fetch Alerts
- **Morning Wag + simple calendar scheduling (Reclaim AI-style)** — the two core user-facing features for MVP

**Samsung HRV data gap (confirmed March 2026):** Samsung Health does NOT write HRV (HeartRateVariabilityRmssdRecord) to Health Connect. This is a deliberate omission, not a bug. Confirmed across Samsung Community forums, developer forums, Sleep as Android, Intervals.icu. **MVP approach:** Work with whatever Samsung gives (HR, sleep, steps). CRS dynamic weight redistribution handles missing HRV. Samsung users get a functional but degraded CRS. Samsung Sensor SDK in post-MVP unlocks true HRV for 38M+ Samsung watches in India.

**HealthKit data richness (confirmed March 2026):** Apple Watch via HealthKit provides ~120 data types vs Health Connect's ~49. Key advantages: `HKHeartbeatSeriesQuery` gives beat-to-beat IBI timestamps (compute true RMSSD yourself), 4-stage sleep (REM/Core/Deep/Awake at minute resolution), raw ECG voltage at 512 Hz, respiratory rate, wrist temperature. Background delivery via `HKObserverQuery` with `.immediate` frequency — no WorkManager, no OEM battery fights. Apple Watch users get the best possible CRS.

**Latest tech updates (March 2026, from web research):**
- **Health Connect background read** is now available via `FEATURE_READ_HEALTH_DATA_IN_BACKGROUND` permission. Request this during onboarding — it may allow reading Health Connect data from WorkManager without foreground requirements. **Validate in Phase B.**
- **Claude prompt caching** now supports **1-hour TTL** at 2x write cost (vs 5-min at 1.25x). For Waldo: use 1-hour cache for SOUL files (stable across calls), 5-min cache for user profile (changes slowly). Cache reads are 0.1x regardless of TTL.
- **Anthropic Cookbook** (March 2026) documents **session memory compaction with cache sharing** — ~90% cost reduction on prefix tokens by sharing cache between main chat and compaction calls. Implement this for conversation summaries.
- **OSS repos confirmed** (March 17, 2026 cross-reference — all active):
  - [badlogic/pi-mono](https://github.com/badlogic/pi-mono) — v0.58.3 (March 15, 2026). Layered architecture, extension lifecycle hooks.
  - [openclaw/openclaw](https://github.com/openclaw/openclaw) — v2026.3.8 (171K+ stars). **New: Context Engine Plugins** (v2026.3.7) with lifecycle hooks for ingest/assemble/compact/afterTurn. Per-topic Telegram agent routing. LanceDB memory plugin for long-term auto-recall.
  - [sipeed/picoclaw](https://github.com/sipeed/picoclaw) — 12K+ stars. Ultra-lightweight Go agent. File-based MEMORY.md, provider failover.
  - [RightNow-AI/openfang](https://github.com/RightNow-AI/openfang) — 137K LOC Rust. WASM-sandboxed tool execution, cryptographic audit chain, 16 security systems.
  - [agentscope-ai/CoPaw](https://github.com/agentscope-ai/CoPaw) — v0.0.7 (Alibaba). ReMe memory module, pre-reasoning hooks, "record first answer second" pattern.
  - [kyegomez/swarms](https://github.com/kyegomez/swarms) — v6.8.1 (5.9K stars). SwarmRouter, MCP protocol integration.
  - [paperclipai/paperclip](https://github.com/paperclipai/paperclip) — v0.3.1 (27.2K stars). Adapter pattern, per-agent budgets, worktree isolation.
  - [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) — Four-bucket context management, progressive disclosure, BDI mental states.
  - [volcengine/OpenViking](https://github.com/volcengine/OpenViking) — 11.3K stars (ByteDance). L0/L1/L2 tiered context loading (our tiered BODY context came from here).
  - [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) — 44K+ stars. Specialized soul files per interaction mode.
- **Google Fit APIs deprecated in 2026** — all traffic moving to Health Connect. Good for Waldo (one API to rule them all).
- **WHOOP Coach** now has proactive nudges powered by OpenAI. WHOOP is the first major competitor to implement our proactive hero feature. See competitive analysis above.

## 2.3 Phased Build Plan

> No timelines. Just phases in dependency order. Build as fast as you can.

### Phase A: Pre-Code Setup

**Objective:** De-risk everything before writing app code. Validate the two existential questions: (1) Does the Morning Wag feel useful? (2) Is the health data pipeline viable on both platforms?

**Deliverables:**
1. Create Telegram bot via @BotFather (needed for Wizard of Oz)
2. Get Anthropic API key, verify Claude Haiku works with a test tool_use call
3. Create Supabase project, enable pg_cron + pgmq extensions, apply schema
4. **Tech spike: op-sqlite + SQLCipher** — create a minimal Expo project, install op-sqlite with SQLCipher, verify it builds and runs on both Android and iOS. If it fails, evaluate alternatives (expo-sqlite, WatermelonDB). **Do not proceed to Phase B without confirming this works.**
5. **Validate Samsung HRV → Health Connect (2-hour test).** Export Samsung Health data, check Health Connect for `HeartRateVariabilityRmssdRecord` entries. Expected result: NOT available (confirmed by developer community). Document what IS available (HR, sleep, steps). This validates the HR-proxy fallback strategy.
6. **Validate Apple Watch HRV → HealthKit.** Check that HealthKit provides `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` from Apple Watch. Expected result: available and reliable. This confirms Apple Watch users get the best CRS.
7. **Wizard of Oz test (5-7 people, including Apple Watch teammates).** Export 7 days of health data from Samsung Health AND Apple Health. Manually compute CRS for each person. Send Morning Wags to all 5-7 people on Telegram for 5-7 days. Track: Do they open? Do they reply? Do they want more after day 5? This is the single highest-ROI test before writing code.
8. Commit 5-7 beta users by name (confirmed, not "maybe") — mix of Android + iOS
9. Start WhatsApp Cloud API verification (2-4 weeks for healthcare, runs in parallel, non-blocking)
10. Register Google Play Console ($25) + Apple Developer Program ($99/yr) + Samsung Developer (free)
11. Set up Expo account + EAS CLI
12. Begin cofounder search in IIT/hackathon/Atlan network. Target: Android/health background or growth/distribution skills. Not blocking — but actively searching.

**Gate:** Wizard of Oz Morning Wags feel useful to at least 3 of 5-7 testers AND op-sqlite spike works on both platforms AND Samsung HRV gap confirmed. If WoO fails, fix the Morning Wag format before proceeding.

### Phase B: Foundation — Data Connectors (HealthKit First, Then Health Connect)

**Objective:** Health data flows from watch → phone → Supabase on both platforms. CRS computes on-phone. Build HealthKit first (best data, teammates have Apple Watch), then Health Connect.

**Build order rationale:** Data quality is the foundation. If the data is wrong, everything built on top is wrong. HealthKit gives the richest data (~120 types, beat-to-beat IBI, 4-stage sleep, ECG). Get it right first, validate CRS accuracy, then port the pattern to Health Connect.

**Phase B1 — HealthKit (iOS, build first):**
1. Expo project scaffold with NativeWind v4 (cross-platform)
2. Swift HealthKit native module via Expo Modules API:
   - `HKHeartbeatSeriesQuery` — beat-to-beat IBI timestamps → compute true RMSSD on-phone
   - `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` — pre-computed SDNN as fallback
   - `HKQuantityTypeIdentifierHeartRate` — HR samples
   - `HKQuantityTypeIdentifierRestingHeartRate` — resting HR
   - `HKCategoryTypeIdentifierSleepAnalysis` — 4-stage sleep (REM, Core, Deep, Awake)
   - `HKQuantityTypeIdentifierOxygenSaturation` — SpO2
   - `HKQuantityTypeIdentifierRespiratoryRate` — respiratory rate (sleep only)
   - `HKQuantityTypeIdentifierStepCount` — steps
3. Background delivery via `HKObserverQuery` + `enableBackgroundDelivery(.immediate)` — no WorkManager needed, no OEM battery fights
4. op-sqlite + SQLCipher local buffer
5. CRS computation in TypeScript — platform-agnostic, uses abstracted health data interface. Apple Watch users get full CRS with true RMSSD.
6. Weighted stress confidence scoring (formula from Section 2.7)
7. Supabase schema migration (all tables from Section 2.4) — add `platform` field ('android' | 'ios') and `device_hrv_source` field ('healthkit_ibi' | 'healthkit_sdnn' | 'health_connect_rmssd' | 'hr_proxy')
8. Custom upload queue: SQLite → Supabase health_snapshots

**Phase B1 Gate:** CRS updates on an iPhone with Apple Watch every 15 minutes using true RMSSD from beat-to-beat data.

**Phase B2 — Health Connect (Android, build second):**
9. Kotlin Health Connect native module via Expo Modules API:
   - `HeartRateRecord` — HR BPM series (available from Samsung)
   - `HeartRateVariabilityRmssdRecord` — RMSSD (available from Pixel Watch/Fitbit, NOT from Samsung)
   - `SleepSessionRecord` — sleep stages (available from Samsung)
   - `StepsRecord` — steps
   - `OxygenSaturationRecord` — SpO2 (unreliable from Samsung)
10. Kotlin WorkManager native module (15-min periodic sync)
11. Foreground service notification for Samsung/Xiaomi (background reliability)
12. Samsung-specific: HR BPM series as stress proxy when HRV unavailable. CRS dynamic weight redistribution (HRV 25% → 0%, redistribute to sleep/circadian/activity).

**Phase B2 Gate:** CRS updates on Android from Health Connect data. Samsung users get functional (degraded) CRS. Pixel/Fitbit users get full CRS.

**Full Phase B Gate:** CRS updates on BOTH platforms from real watch data.

**Post-MVP (when core agent works well):** Samsung Sensor SDK companion Wear OS app for true HRV from Galaxy Watch IBI data. Only add this when Samsung CRS quality is the identified bottleneck.

### Phase C: Dashboard

**Objective:** CRS and health data visible on screen.

**Deliverables:**
1. CRS gauge component (270-degree SVG arc, 3 color zones: Teal/Amber/Coral)
2. Sleep summary card (duration, stages bar, efficiency)
3. Metric cards (HR, HRV, Steps, SpO2, Circadian — with trend arrows)
4. "Today's Insight" card (placeholder — agent fills this later)
5. Weekly CRS trend line chart (7-day)
6. Basic settings screen (profile, notification prefs)
7. Dark mode (system-aware, NativeWind color tokens)

**Gate:** Dashboard shows real health data with auto-updating CRS.

### Phase D: Agent Core + Messaging

**Objective:** Claude agent responds via channel adapter with health context. Morning Wag + simple calendar-aware scheduling (Reclaim AI-style -- know what's coming today, suggest optimal timing for deep work based on CRS + schedule).

**Deliverables:**
1. Soul files as hardcoded string constants in `_shared/config.ts`:
   - `SOUL_BASE` — always-loaded personality (~300 tokens)
   - `SOUL_STRESS_ALERT` — mode-specific for proactive Fetch Alert messages
   - `SOUL_MORNING_BRIEF` — mode-specific for Morning Wag briefings. Includes: sleep summary, CRS, sleep coaching insight, weekend recovery prediction (if debt > 3h), and simple schedule awareness ("You have 3 meetings today — your peak window is 10am-1pm")
   - `SOUL_CONVERSATIONAL` — mode-specific for user-initiated chat
2. Agent loop Edge Function (`invoke-agent`):
   - ReAct loop with `anthropic.messages.create()` + `tool_use`
   - **Max 3 iterations** (not 5 — safer for Edge Function 60s timeout on free plan)
   - **50s hard timeout** (leaves 10s margin for response delivery)
   - 8 tool definitions with schemas (Section 2.5)
   - Tool routing per trigger type (hardcoded map, not database)
   - Cost logging to `agent_logs` after each call (fire-and-forget, don't block response)
3. Context assembly:
   - Cached block: soul-base + soul-mode + user profile + core memory (~2000 tokens)
   - Fresh block: BODY_L0 + BODY_L1 + trigger context + last 5 messages (~1500 tokens)
   - Total: ~3500 tokens input (well within Haiku's window)
4. Channel webhook Edge Function (grammY for Telegram — first adapter):
   - Webhook secret validation
   - User resolution by `channel_type` + `channel_id` (via `user_channels` table)
   - Callback query handler for feedback buttons
   - **Idempotency:** deduplicate by channel-specific message ID
5. Basic conversational flow: user messages bot → context assembly → agent loop → response → channel adapter
6. Template fallback messages WITH user data (not generic):
   - "Your CRS is {crs}. I'm having trouble connecting right now — I'll follow up shortly."
   - Include actual CRS value from latest snapshot so user still gets value

**What's NOT in Phase D (deferred to Phase 2):**
- No blueprint versioning (soul files are in git)
- No inference middleware (direct API calls)
- No policy enforcer (tool access controlled by which tools are loaded per trigger type)
- No escalation system
- No plan-apply-rollback

**Gate:** You message your agent (via Telegram) and get a personalized health-aware response.

### Phase E: Proactive Delivery

**Objective:** Agent messages YOU without being asked. Escalation system operational.

**Deliverables:**
1. `check-triggers` Edge Function (pg_cron every 15 min):
   - Fetch latest health_snapshots per user
   - Rules-based pre-filter (skip Claude if CRS > 60 AND confidence < 0.3)
   - Route to Stress Monitor Hand if confidence >= 0.60
2. `morning-brief` Edge Function (pg_cron at user's estimated wake time):
   - Gather sleep + CRS + one insight
   - Send via channel adapter
3. `message-sender` Edge Function (pgmq worker):
   - Drain queue, deliver via channel adapter
   - Exponential backoff on failure
4. Fetch Alert delivery — **reframed as awareness + preparation, not in-the-moment intervention:**
   - The user may be in a meeting when the alert arrives. They can't leave or do a breathing exercise on camera.
   - **MVP framing:** "I noticed your stress levels are elevated. When you get a moment: [micro-action]. Also, I'm tracking this pattern for you."
   - The real value is (a) the micro-action suggestion doable in any context ("take 3 slow breaths through your nose — no one will notice"), (b) the pattern accumulation over weeks ("Your Monday 2pm meetings consistently spike your stress"), and (c) Phase 2 prevention ("Next week, I've suggested a 10-min buffer before your Monday 1:1")
   - Include feedback buttons: [Helpful] [Not helpful] [Too frequent]
   - "Too frequent" → increase cooldown for this user to 4h (stored in `users.stress_cooldown_minutes`)
   - Store feedback in `feedback_events` for threshold tuning
5. Cooldown enforcement: 2h between Fetch Alerts, max 3 proactive/day
6. **First 7 days (no HRV baseline):** Disable Fetch Alerts entirely. Send learning messages instead. Only Morning Wags are proactive during learning period.

**Gate:** You wake up to a Morning Wag. Agent messages you when it detects stress.

### Phase F: Onboarding + Polish

**Objective:** Someone other than you can set it up and use it.

**Deliverables:**
1. 3-step onboarding flow:
   - Step 1: Auto-detect wearable → Health Connect permissions (one category at a time, with pre-education)
   - Step 2: Messaging channel link → 6-digit linking code → verify connection
   - Step 3: Brief profile (age, wake time, notification preference) → done
2. 7-day learning messages ("Day 3: Your resting HR is 62 BPM, lower than average. That's good.")
3. Permission pre-education screen (critical for Android permanent-denial UX)
4. OEM-specific battery setup guide (Samsung/Xiaomi/Huawei)
5. Error states and empty states for all screens
6. "Not a medical device" disclaimer in onboarding
7. Data export (CSV) in settings

**Gate:** A non-technical person can complete onboarding in < 5 minutes.

### Phase G: Self-Test + Tuning

**Objective:** 2 weeks of daily founder use. Tune everything.

**Deliverables:**
1. Daily use for 2+ weeks. Log every false positive alert.
2. Tune stress confidence threshold (start conservative at 0.65+, lower if too few alerts)
3. Tune cooldown (2h between alerts, max 3/day)
4. A/B test soul file tone using blueprint v0.1.0 vs v0.1.1
5. Fix top 3 most annoying bugs
6. Validate blueprint rollback works (deploy v0.1.1, observe, rollback if needed)
7. Monitor agent_logs: cost per day, response time, tool usage distribution
8. Monitor policy_violations: any unexpected denials?

**Gate:** You've used it daily for 14 days. False positive rate < 20%.

### Phase H: Beta

**Objective:** 3-5 real users for 7 days.

**Deliverables:**
1. Onboard 3 committed beta users (from IIT network)
2. Deploy separate blueprint version for beta users if needed
3. Collect feedback weekly (15-min conversation, not a survey)
4. Track metrics: DAU, Morning Wag open rate, Fetch Alert response rate, thumbs-up %
5. Iterate on agent quality based on feedback
6. Hit MVP Done criteria: 5 people daily, 1+ useful proactive message/person/day, 7-day retention >= 40%

**Gate:** MVP is done when the definition is met.

## 2.4 Complete Database Schema

```sql
-- ================================================================
-- WALDO MVP — COMPLETE SUPABASE SCHEMA
-- Run this as a single migration
-- ================================================================

-- CORE TABLES
-- ================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE,
  -- Channel linking handled by user_channels table (supports multiple channels per user)
  primary_channel_type VARCHAR(20) DEFAULT 'telegram',  -- 'telegram', 'whatsapp', 'discord', 'slack', 'in_app'
  age INT,
  chronotype VARCHAR(10) DEFAULT 'normal',  -- 'early', 'normal', 'late'
  hrv_metric_type VARCHAR(10) DEFAULT 'rmssd',  -- 'rmssd' (Android) or 'sdnn' (iOS)
  wake_time_estimate TIME DEFAULT '07:00',
  notification_preferences JSONB DEFAULT '{"morning_brief": true, "stress_alerts": true, "max_proactive_per_day": 5}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  learning_period_start DATE,                -- Set when first health data arrives; Fetch Alerts disabled for 7 days
  last_morning_brief_date DATE,              -- Tracks whether today's brief was sent
  stress_cooldown_minutes INT DEFAULT 120,   -- Default 2h; "too frequent" feedback increases to 240
  device_manufacturer TEXT,                  -- 'samsung', 'google', 'garmin', 'xiaomi', etc. (from Health Connect DataOrigin)
  device_model TEXT,                         -- 'Galaxy Watch 6', 'Pixel Watch 3', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ
);

CREATE TABLE user_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_type VARCHAR(20) NOT NULL,  -- 'telegram', 'whatsapp', 'discord', 'slack', 'in_app'
  channel_id TEXT NOT NULL,            -- telegram_chat_id, whatsapp_number, discord_user_id, etc.
  linking_code TEXT,
  linking_expires_at TIMESTAMPTZ,      -- Code expires after 10 minutes
  linking_attempts INT DEFAULT 0,       -- Rate limit: max 5 attempts per code
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_type, channel_id)
);
CREATE INDEX idx_user_channels_user ON user_channels(user_id);

CREATE TABLE health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  hr INT,
  hrv_rmssd FLOAT,
  steps_today INT,
  steps_last_2h INT,
  spo2 FLOAT,
  is_exercising BOOLEAN DEFAULT FALSE,
  crs FLOAT,
  crs_sleep_component FLOAT,
  crs_hrv_component FLOAT,
  crs_circadian_component FLOAT,
  crs_activity_component FLOAT,
  stress_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, timestamp)  -- Prevents duplicate uploads from sync queue
);
CREATE INDEX idx_snapshots_user_time ON health_snapshots(user_id, timestamp DESC);

CREATE TABLE sleep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  deep_minutes INT,
  rem_minutes INT,
  light_minutes INT,
  efficiency FLOAT,
  bedtime_deviation_minutes INT,
  weekly_debt_hours FLOAT,
  hrv_during_sleep_rmssd FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, start_time)  -- Prevents duplicate sleep session syncs
);
CREATE INDEX idx_sleep_user_time ON sleep_sessions(user_id, end_time DESC);

CREATE TABLE stress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL,
  stress_confidence FLOAT NOT NULL,
  hrv_drop_percent FLOAT,
  hr_elevation_percent FLOAT,
  persist_minutes INT,
  triggered_alert BOOLEAN DEFAULT FALSE,
  user_feedback VARCHAR(50),  -- 'helpful', 'not_helpful', 'false_alarm'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stress_user_time ON stress_events(user_id, detected_at DESC);

CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) DEFAULT 'telegram',
  direction VARCHAR(15) NOT NULL,  -- 'user_to_agent', 'agent_to_user'
  message_text TEXT,
  tool_calls JSONB,
  trigger_type VARCHAR(30),  -- 'user_reply', 'stress_alert', 'morning_brief'
  model_used VARCHAR(30),
  provider TEXT,
  blueprint_version TEXT,
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_convo_user_time ON conversation_history(user_id, created_at DESC);

CREATE TABLE core_memory (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  identity JSONB DEFAULT '{}',
  health_profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  patterns JSONB DEFAULT '{}',
  active_goals JSONB DEFAULT '[]',
  recent_insights JSONB DEFAULT '[]',
  body_l0 TEXT,   -- ~60 tokens, always loaded
  body_l1 TEXT,   -- ~400 tokens, per-session
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversation_history(id),
  feedback_type VARCHAR(20) NOT NULL,  -- 'helpful', 'not_helpful', 'too_frequent', 'false_alarm'
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE baseline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hrv_7day_baseline FLOAT,
  hrv_30day_baseline FLOAT,
  resting_hr_baseline FLOAT,
  avg_sleep_hours FLOAT,
  chronotype_estimate VARCHAR(10),
  time_of_day_ratios JSONB,  -- [1.30, 1.10, 1.00, 0.85, 0.90, 1.05]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- OBSERVABILITY (MVP)
-- ================================================================

CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trigger_type VARCHAR(30),
  provider TEXT,
  model_used VARCHAR(30),
  tools_called TEXT[],
  tokens_in INT,
  tokens_out INT,
  cache_read_tokens INT DEFAULT 0,
  response_time_ms INT,
  cost_usd FLOAT,
  blueprint_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_logs_user_time ON agent_logs(user_id, created_at DESC);

-- NEMOCLAW TABLES — ADD IN PHASE 2 (not MVP)
-- See plans/2026-03-17-nemoclaw-inspired-agent-infrastructure.md for full schema:
-- agent_blueprints, user_blueprint_assignments, policy_violations,
-- escalation_requests, user_action_preferences, config_runs

-- RLS POLICIES
-- ================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Users see only their own data
CREATE POLICY "Users own data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own snapshots" ON health_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own sleep" ON sleep_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own stress" ON stress_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own convos" ON conversation_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own memory" ON core_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own feedback" ON feedback_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own baselines" ON baseline_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own logs" ON agent_logs FOR SELECT USING (auth.uid() = user_id);

-- Service role can write to all tables (Edge Functions use service role)
-- (Supabase default: service role bypasses RLS)
```

## 2.5 Agent Tool Definitions (8 MVP Tools)

```typescript
const MVP_TOOLS = [
  {
    name: "get_crs",
    description: "Get the user's current Cognitive Readiness Score with component breakdown (sleep, HRV, circadian, activity). Returns the latest CRS and what's affecting it.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_sleep",
    description: "Get last night's sleep summary: duration, deep/REM/light minutes, efficiency, and sleep debt.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_stress_events",
    description: "Get recent stress detections with timestamps, confidence scores, and component signals.",
    input_schema: {
      type: "object",
      properties: {
        hours_back: { type: "number", description: "How many hours back to look. Default 24.", default: 24 },
      },
      required: [],
    },
  },
  {
    name: "get_activity",
    description: "Get today's activity: steps, sedentary time, exercise sessions, and recent movement.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "send_message",
    description: "Send a message to the user via their active messaging channel. Routes through the channel adapter (Telegram, WhatsApp, Discord, Slack, or in-app).",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text to send" },
        include_feedback_buttons: { type: "boolean", description: "Include thumbs up/down buttons", default: false },
      },
      required: ["text"],
    },
  },
  {
    name: "read_memory",
    description: "Read the user's core memory: identity, health profile, preferences, patterns, goals, and recent insights.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "update_memory",
    description: "Update the user's core memory. Use when you learn something important about the user's health patterns, preferences, or goals. Always explain what you're remembering.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["health_profile", "preferences", "patterns", "active_goals", "recent_insights"] },
        key: { type: "string", description: "What to remember" },
        value: { type: "string", description: "The information to store" },
      },
      required: ["category", "key", "value"],
    },
  },
  {
    name: "get_user_profile",
    description: "Get the user's profile: age, chronotype, wake time, notification preferences.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];
```

**Tool routing per trigger type:**

| Trigger | Tools Available | Model |
|---------|---------------|-------|
| `stress_alert` | get_crs, get_stress_events, send_message | Haiku |
| `morning_brief` | get_crs, get_sleep, send_message, read_memory | Haiku |
| `user_reply` | All 8 tools | Haiku |
| `baseline_update` | (no AI, pure computation) | None |

## 2.6 CRS Algorithm (Complete Implementation)

```typescript
// CRS = (Sleep * 0.35) + (HRV * 0.25) + (Circadian * 0.25) + (Activity * 0.15)

interface CRSResult {
  score: number;       // 0-100
  zone: 'peak' | 'moderate' | 'low';
  components: {
    sleep: number;     // 0-100
    hrv: number;       // 0-100
    circadian: number; // 0-100
    activity: number;  // 0-100
  };
}

function computeCRS(
  sleep: SleepData | null,
  hrvRmssd: number | null,
  baseline: BaselineData,
  activity: ActivityData,
  userAge: number,
  chronotype: 'early' | 'normal' | 'late',
  currentHour: number,
  lastSleepEnd: Date | null,
  now: Date
): CRSResult {
  // Compute all components first (circadian + activity always available)
  const circadianScore = lastSleepEnd
    ? computeCircadianScore(currentHour, chronotype, lastSleepEnd, now)
    : 50; // Neutral if no sleep end time known
  const activityScore = computeActivityScore(activity);

  // Track which optional components have real data
  const hasSleep = sleep !== null;
  const hasHrv = hrvRmssd !== null && baseline.hrv7Day > 0;

  const sleepScore = hasSleep ? computeSleepScore(sleep) : null;
  const hrvScore = hasHrv
    ? computeHRVScore(hrvRmssd, baseline.hrv7Day, baseline.hrv30Day, userAge, currentHour, baseline.timeOfDayRatios)
    : null;

  // Insufficient data: need at least 3 of 4 components (circadian + activity + one of sleep/HRV)
  if (!hasSleep && !hasHrv) {
    return {
      score: -1,
      zone: 'insufficient_data' as any,
      components: { sleep: -1, hrv: -1, circadian: circadianScore, activity: activityScore },
    };
  }

  // Dynamic weight redistribution when a component is missing
  const sleepWeight = hasSleep ? 0.35 : 0;
  const hrvWeight = hasHrv ? 0.25 : 0;
  const circadianWeight = 0.25;
  const activityWeight = 0.15;
  const totalWeight = sleepWeight + hrvWeight + circadianWeight + activityWeight;

  const crs = Math.round(
    (
      (sleepScore ?? 0) * sleepWeight +
      (hrvScore ?? 0) * hrvWeight +
      circadianScore * circadianWeight +
      activityScore * activityWeight
    ) / totalWeight * 100 / 100 // Normalize to 0-100 scale
  );

  return {
    score: Math.max(0, Math.min(100, crs)),
    zone: crs >= 80 ? 'peak' : crs >= 50 ? 'moderate' : 'low',
    components: {
      sleep: sleepScore ?? -1,
      hrv: hrvScore ?? -1,
      circadian: circadianScore,
      activity: activityScore,
    },
  };
}
```

*(Full component scoring functions are in the archived ALGORITHMS_AND_HEALTH.md — identical to the code shown in the original doc.)*

## 2.7 Stress Detection (Weighted Confidence Scoring)

```typescript
function computeStressConfidence(
  hrvDropPercent: number | null,     // HRV drop from baseline (weight 0.35)
  hrElevationPercent: number | null, // HR elevation (weight 0.25)
  persistMinutes: number,            // Duration (weight 0.20)
  isExercising: boolean,             // Context (weight 0.20, inverted)
  stepCountRecent: number
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  if (hrvDropPercent !== null) {
    weightedSum += 0.35 * Math.min(hrvDropPercent / 30, 1);
    totalWeight += 0.35;
  }
  if (hrElevationPercent !== null) {
    weightedSum += 0.25 * Math.min(hrElevationPercent / 25, 1);
    totalWeight += 0.25;
  }
  weightedSum += 0.20 * Math.min(persistMinutes / 15, 1);
  totalWeight += 0.20;

  if (!isExercising && stepCountRecent < 200) weightedSum += 0.20;
  else if (!isExercising) weightedSum += 0.10;
  totalWeight += 0.20;

  // CRITICAL: Require at least one cardiac signal (HRV or HR).
  // Without cardiac data, duration + inactivity alone can produce false 1.0 confidence.
  if (hrvDropPercent === null && hrElevationPercent === null) return 0;
  if (totalWeight < 0.40) return 0;
  return weightedSum / totalWeight;
}

// Thresholds (hardcoded for MVP, move to config in Phase 2):
// >= 0.60: ALERT (proactive message)
// 0.40-0.59: LOG (track but don't alert)
// < 0.40: IGNORE
```

**False positive reduction strategy:**
1. Personal baselines, not population norms
2. Time-of-day HRV normalization (afternoon dip adjustment)
3. Weighted confidence (handles missing signals gracefully)
4. Activity exclusion (step counter + exercise detection)
5. Temporal persistence (10-min minimum sustained)
6. Cooldown period (2 hours between alerts)
7. User feedback loop (thumbs up/down tunes thresholds)
8. Rules-based pre-filter (skip Claude on normal readings)

## 2.8 Architecture Influences — What We Took From Each Repo

> These 10 repos were analyzed in depth. Here's what Waldo adopts from each, mapped to specific implementation points.

### Patterns Adopted for MVP

| Pattern | Source Repo | Waldo Implementation | Phase |
|---------|-----------|----------------------|-------|
| **Layered module design** (LLM → Agent Core → Health App) | [Pi Mono](https://github.com/badlogic/pi-mono) | `_shared/` in Supabase Edge Functions separates LLM calls from agent logic from health tools | MVP |
| **Context assembly pipeline** (static → user → dynamic) | All repos + [HumanLayer](https://github.com/humanlayer/context-engineering) | `buildSystemPrompt()` assembles cached soul + user profile + fresh biometrics per call | MVP |
| **File-based evolving memory** (SOUL.md + MEMORY.md) | [PicoClaw](https://github.com/sipeed/picoclaw), [CoPaw](https://github.com/agentscope-ai/CoPaw) | `core_memory` table with structured JSONB + soul files as string constants | MVP |
| **Pre-reasoning hooks** (safety, context injection, compaction) | [CoPaw](https://github.com/agentscope-ai/CoPaw) | Safety hook (emergency keywords), context injection (latest biometrics), rate limit check — all run before agent loop | MVP |
| **Autonomous Hands / cron tasks** | [OpenFang](https://github.com/RightNow-AI/openfang) | Morning Wag Hand, Stress Monitor Hand — scheduled via pg_cron, each with focused scope and tools | MVP |
| **Dynamic tool loading** per intent | [OpenFang](https://github.com/RightNow-AI/openfang), HumanLayer | Only load relevant tools per trigger type (3 for Fetch Alerts, 4 for Morning Wag, 8 for user chat) | MVP |
| **Provider failover chain** | [PicoClaw](https://github.com/sipeed/picoclaw) | Haiku → template fallback (MVP). Haiku → Sonnet → template (Phase 2) | MVP |
| **Tiered context loading** (L0/L1/L2) | [OpenViking](https://github.com/volcengine/OpenViking) | BODY_L0 (~60 tokens always) + BODY_L1 (~400 tokens default) + L2 on-demand via tools. 65-70% token reduction vs flat loading. | MVP |
| **Specialized soul files** per interaction mode | [Agency-Agents](https://github.com/msitarzewski/agency-agents) | `SOUL_STRESS_ALERT`, `SOUL_MORNING_BRIEF`, `SOUL_CONVERSATIONAL` — different personality per trigger type | MVP |
| **"Record first, answer second"** | [CoPaw](https://github.com/agentscope-ai/CoPaw) | When user shares health info ("started magnesium"), agent calls `update_memory` BEFORE reasoning about response | MVP |
| **Rules-based pre-filter** (skip LLM on normal data) | Synthesized from all repos | `shouldInvokeClaude()` — if CRS > 60 AND confidence < 0.3, skip Claude entirely. Biggest single cost optimization. | MVP |

### Patterns Adopted for Phase 2+

| Pattern | Source Repo | Waldo Implementation | Phase |
|---------|-----------|----------------------|-------|
| **Context Engine Plugins** with lifecycle hooks | [OpenClaw v2026.3.7](https://github.com/openclaw/openclaw) | Make context assembly pluggable: `ingest` (inject new data), `assemble` (build prompt), `compact` (summarize old conversations), `afterTurn` (post-reasoning updates). Enables A/B testing different context strategies. | Phase 2 |
| **Per-topic agent routing** (different agents per Telegram topic) | [OpenClaw v2026.3.7](https://github.com/openclaw/openclaw) | One Telegram group with topics: "Fetch Alerts" (stress monitor hand), "Morning Wags" (briefing hand), "Chat" (conversational hand). Each topic routes to different agent config. | Phase 2 |
| **LanceDB long-term memory** with auto-recall | [OpenClaw v2026.3.7](https://github.com/openclaw/openclaw) | Replace pgvector semantic search with LanceDB for conversation history retrieval. Auto-capture important health moments without explicit tool calls. | Phase 2 |
| **Heartbeat-based execution** with session persistence | [Paperclip](https://github.com/paperclipai/paperclip) | Wake agent on biometric triggers + schedules. Persist session state between invocations so agent resumes health narrative, not re-reads everything. | Phase 2 |
| **Per-agent budget control** with token throttling | [Paperclip](https://github.com/paperclipai/paperclip) | Daily AI cost budget per user ($0.10). Auto-throttle to template responses when budget exceeded. | MVP (basic), Phase 2 (full) |
| **Adapter pattern** for multi-tool backends | [Paperclip](https://github.com/paperclipai/paperclip) | `ChannelAdapter` interface: `send()`, `receiveWebhook()`, `formatMessage()`. Adding WhatsApp/push = writing one adapter. | Phase 2 |
| **Goal ancestry** (why context for recommendations) | [Paperclip](https://github.com/paperclipai/paperclip) | Health recommendations carry full reasoning chain: User Goal → Health Area → Current State → Intervention. Traceable for IIT Ropar study. | Phase 2 |
| **WASM-sandboxed tool execution** | [OpenFang](https://github.com/RightNow-AI/openfang) | Not needed for MVP (trusted tools). Phase 3+ if opening skills marketplace to third-party developers. | Phase 3 |
| **Triple-layer memory** (KV + semantic + knowledge graph) | [OpenFang](https://github.com/RightNow-AI/openfang) | Tier 1: core_memory KV (MVP). Tier 2: pgvector conversation search (Phase 2). Tier 3: knowledge graph — entity extraction + relationship tracking (Phase 3). | MVP → Phase 3 |
| **SwarmRouter** (single entry dispatching to multiple orchestration strategies) | [Swarms](https://github.com/kyegomez/swarms) | Phase 4 multi-agent: sleep specialist + stress specialist + activity specialist coordinated by orchestrator. Single `routeToAgent()` entry point. | Phase 4 |
| **BDI mental states** (Belief-Desire-Intention reasoning) | [Agent-Skills-for-CE](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | Agent logs WHY it recommended each intervention: Belief ("HRV dropped 25%") → Desire ("reduce stress") → Intention ("suggest breathing"). Audit trail for IIT Ropar study. | Phase 2 |
| **Session memory compaction with cache sharing** (~90% cost reduction) | [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) (March 2026) | Share cache prefix between main agent calls and compaction calls. Compaction reads same cached soul + user profile. | MVP |
| **Versioned blueprints with plan-apply-rollback** | [NemoClaw](https://github.com/NVIDIA/NemoClaw) | All agent config (souls, tools, thresholds, routing) in versioned `agent_blueprints` table. A/B testing, instant rollback, audit trail. | Phase 2 |
| **Declarative per-hand policies** | [NemoClaw](https://github.com/NVIDIA/NemoClaw) | Each Hand (stress monitor, Morning Wag, etc.) has explicit allowed tools, data scopes, and constraints enforced at runtime. | Phase 2 |
| **Operator-in-the-loop escalation** | [NemoClaw](https://github.com/NVIDIA/NemoClaw) | High-stakes recommendations (suggest doctor visit, alert emergency contact) require user approval. "Ask first time, remember preference." | Phase 2 |

### What We Explicitly Did NOT Adopt

| Pattern | Source | Why Not |
|---------|--------|---------|
| LangChain / LangGraph framework | General | Every analyzed repo builds custom agent loops. LangChain adds dependency bloat without control. Direct Claude API with tool_use gives full transparency. |
| LF/HF ratio for HRV | Literature | Scientifically debunked (Billman 2013). Use RMSSD only. |
| Agent SDK (persistent runtime) | Anthropic Agent SDK | Our Edge Functions are stateless serverless. Messages API with tool_use fits perfectly. Agent SDK expects long-running processes. |
| Full MCP server for health data | OpenClaw | Premature for MVP. Consider in Phase 3 as a strategic infrastructure play (open-source Health MCP server). |
| WASM sandbox for tools | OpenFang | Overkill for MVP with 8 trusted tools. Only needed if opening to third-party skill developers (Phase 4). |

## 2.9 Known Risks & Unvalidated Assumptions

These MUST be tested during development. Do not assume they are true:

| Assumption | Risk if Wrong | When to Validate |
|-----------|--------------|-----------------|
| Rules-based pre-filter saves 60-80% of AI calls | AI cost per user doubles | Phase G self-test (measure actual skip rate) |
| op-sqlite + SQLCipher works with Expo custom dev client on both Android + iOS | Rearchitect local data layer | **Phase A tech spike (both platforms)** |
| Supabase Edge Function 150s idle timeout is enough for agent loop (CPU limit is 2s but doesn't include I/O wait) | Agent loop times out, user gets no response | Phase D first integration test |
| ~~Health Connect HRV from Samsung~~ **CONFIRMED NOT AVAILABLE.** Samsung Health does NOT write HRV to Health Connect. | CRS loses 25% of signal weight for Samsung users | **Phase A (validate). Mitigation: HR BPM proxy, dynamic weight redistribution.** |
| Apple Watch HRV (SDNN) is reliably available via HealthKit | iOS CRS is degraded | **Phase A (validate with teammate's Apple Watch)** |
| WorkManager survives OEM battery optimization on Samsung | Background sync fails, CRS stops updating (#1 technical risk) | Phase B test on real Samsung device |
| CRS zone thresholds (80/50) produce meaningful distinctions | Users see "moderate" 80% of the time | Phase G self-test (measure zone distribution) |
| Prompt caching achieves 60-70% savings | Token costs higher than projected | Phase D first cached call (verify cache hits in Anthropic dashboard) |
| 5-7 beta users (mix Android + iOS) are committed | No beta testers when you need them | Phase A (get confirmed commitments NOW) |
| Fetch Alert false positive rate < 30% | Users mute the bot, retention collapses | Phase G self-test. **If > 30%, defer Fetch Alert delivery to Phase 2.** |

**Data retention plan (not yet addressed):**
- health_snapshots: ~96 rows/day/user = ~35K/year/user
- At 200 users: ~7M rows/year → Supabase free tier (500MB) will be exhausted
- **Phase 2 action:** Add table partitioning by month, archive data > 90 days to cold storage

## 2.10 Edge Function Specifications

### pg_cron setup (run once during Supabase setup)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule check-triggers every 15 minutes
SELECT cron.schedule(
  'check-triggers-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-triggers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### check-triggers (called by pg_cron via pg_net every 15 min)

```typescript
// Handles BOTH Fetch Alerts AND Morning Wags in a single function
// Sends messages directly via channel adapter (no pgmq for MVP)
Deno.serve(async () => {
  // BATCH QUERY: single SQL query returns users needing action
  // (avoids N*3 queries per user — critical for scalability)
  const usersNeedingAction = await supabase.rpc('get_users_needing_triggers', {
    current_time: new Date().toISOString(),
  });

  for (const user of usersNeedingAction) {
    // Morning Wag check
    if (user.needs_morning_brief) {
      const response = await invokeAgent(user.id, 'morning_brief', {});
      await sendViaChannel(user.id, response);  // Routes through channel adapter
      await supabase.from('users').update({ last_morning_brief_date: today() }).eq('id', user.id);
      continue; // Don't also send Fetch Alert in same cycle
    }

    // Fetch Alert check (rules-based pre-filter already applied in SQL query)
    if (user.stress_confidence >= 0.60) {
      const response = await invokeAgent(user.id, 'stress_alert', {
        confidence: user.stress_confidence, crs: user.crs,
      });
      await sendViaChannel(user.id, response, { feedbackButtons: true });  // Routes through channel adapter
    }
  }
});
```

### channel-webhook

```typescript
// Receives user messages from any channel, routes to agent
Deno.serve(async (req) => {
  const secret = new URL(req.url).searchParams.get("secret");
  const channel = new URL(req.url).searchParams.get("channel") || "telegram";
  if (secret !== Deno.env.get("CHANNEL_WEBHOOK_SECRET")) return unauthorized();

  const update = await req.json();
  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query); // Feedback buttons, escalation responses
  }
  if (update.message?.text) {
    const userId = await resolveUserByChannel(channel, update);
    const response = await invokeAgent(userId, 'user_reply', { message: update.message.text });
    await sendViaChannel(userId, response);
  }
});
```

*Morning Wags and message sending are handled directly by `check-triggers` via the channel adapter for MVP (no separate Edge Functions, no pgmq). Add pgmq + dedicated message-sender in Phase 2 when scale requires reliability/retry logic.*

## 2.11 Safety Guardrails

**Hard rules (in system prompt — cannot be overridden):**
1. You are NOT a doctor. Never diagnose conditions.
2. Never say "you are having a heart attack/stroke/panic attack."
3. If biometrics suggest emergency (HR > 180 sustained, SpO2 < 90): "Your readings are unusual. If you feel unwell, contact a doctor or emergency services."
4. Never recommend stopping prescribed medication.
5. Always frame suggestions as "you might try..." not "you should..."
6. If user expresses suicidal ideation, provide crisis helpline numbers immediately.

**Rate limits:**
| Limit | Value |
|-------|-------|
| Max proactive messages/day | 3 (Fetch Alerts) + 1 (Morning Wag) = 4 total |
| Max agent loop iterations | 3 |
| Max tokens per response | 1024 |
| Cooldown between Fetch Alerts | 2 hours |
| Daily AI cost budget per user | $0.10 (typical spend: $0.03-0.05/day) |

**Emergency keywords:** "chest pain", "can't breathe", "suicidal", "kill myself", "overdose" → bypass agent loop, return emergency response immediately.

## 2.12 Pre-Code Setup Checklist

| # | Task | Time | Cost | Blocking? |
|---|------|------|------|-----------|
| 1 | Samsung Sensor SDK developer mode on watch | 30 min | Free | No (validates hardware, not on critical path) |
| 2 | Create Telegram bot via @BotFather | 15 min | Free | Yes |
| 3 | Anthropic API key + test Haiku call | 10 min | ~$5/mo | Yes |
| 4 | Supabase project + enable pg_cron + pgmq | 20 min | Free | Yes |
| 5 | Wizard of Oz test (manual CRS + Telegram messages) | 4-6 hours | Free | **Yes — gate to proceed** |
| 6 | Commit 3 beta users by name | A few conversations | Free | Yes |
| 7 | WhatsApp Cloud API verification (parallel, non-blocking) | 1 hr + 14 days | Free | No |
| 8 | Google Play Console | 1 hr | $25 | No |
| 9 | Samsung Developer Account | 30 min | Free | No |
| 10 | Expo account + EAS CLI | 30 min | Free | No |

**Environment variables needed:**
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
# Channel adapter: Telegram (MVP)
TELEGRAM_BOT_TOKEN=
CHANNEL_WEBHOOK_SECRET=
# Future channel adapters (uncomment when ready)
# WHATSAPP_TOKEN=
# DISCORD_BOT_TOKEN=
# SLACK_BOT_TOKEN=
APP_ENV=development
```

---

# PART 3: FULL PRODUCT ARCHITECTURE

## 3.1 Phase 2: Expand

**Focus:** Workspace connectors, richer messaging, deeper agent intelligence. This is where Waldo goes from "biology-only agent" to "biology + context agent."

**Workspace Connectors (the big unlock):**
- **Google Calendar / Outlook** — meeting-aware interventions, schedule optimization, focus protection
- **Gmail / Outlook email** — communication timing, Morning Wag includes email context
- **Slack / Teams** — context-switching detection, meeting fatigue correlation
- NemoClaw-inspired infrastructure (blueprints, policies, middleware) — now justified with multiple connectors and growing complexity

**Messaging:**
- **Push notifications** (FCM) — Fetch Alerts when app is backgrounded
- **In-app chat** (Supabase Realtime) — becomes primary channel
- **WhatsApp integration** — if verified

**Agent Intelligence (THE BIG UNLOCK):**
- **Conversational skill creation** — user teaches agent new behaviors through natural conversation ("when my CRS is low and I have a big meeting, prep me with talking points"). Agent stores these as learned skills.
- **Behavioral pattern → skill pipeline** — agent discovers patterns from weeks of data + conversation, proposes new skills to the user ("I noticed X, want me to do Y automatically?")
- **Full workspace context** — agent reads calendar, email, Slack, Notion, task lists. Combines with biology to produce the agentic tasks from the Two Intelligence Layers table.
- **Conversation-as-context** — agent ingests WhatsApp/Telegram/Slack conversation history (with user permission) to understand work context, relationships, priorities, and communication patterns
- **Multi-model routing** — DeepSeek V3 for routine (40%), GPT-4o mini (25%), Qwen 2.5-72B (20%), Claude Haiku (12%), Claude Opus (3%)
- **Weekly Review Hand** — Opus-powered weekly analysis, updates core memory with discovered patterns
- **Semantic memory search** — pgvector for conversation history
- **Full hook pipeline** — context injection, compaction, analytics

**Wearable Expansion:**
- **Samsung Sensor SDK** companion — raw IBI streaming
- **Garmin Connect IQ** companion — raw IBI
- **Cloud APIs** — Oura, Fitbit, WHOOP

**App:**
- History screen with calendar view + trend charts
- Home screen widget (Android) — CRS at a glance

**Channel evolution (adapter pattern — add channels without rewriting agent logic):**
```
MVP:      Telegram adapter (first implementation of ChannelAdapter interface)
Phase 2:  WhatsApp adapter → Discord adapter → Slack adapter → In-App Chat adapter → Push adapter
```

**Adapter Architecture (applies to ALL external integrations):**

Waldo uses adapter interfaces for all external boundaries. This ensures any component can be swapped without rewriting agent logic:

| Adapter | MVP Implementation | Future Implementations |
|---------|-------------------|----------------------|
| `ChannelAdapter` | Telegram (grammY) | WhatsApp, Discord, Slack, In-App, Push |
| `LLMProvider` | Claude Haiku (@anthropic-ai/sdk) | DeepSeek, GPT-4o mini, Qwen, Gemini |
| `HealthDataSource` | HealthKit (Swift), Health Connect (Kotlin) | Samsung Sensor SDK, Garmin Connect IQ, Cloud APIs (Oura, Fitbit, WHOOP) |
| `StorageAdapter` | op-sqlite + SQLCipher | Future: cloud sync, cross-device |

Each adapter exposes a standard interface. Agent logic, CRS computation, and delivery orchestration never reference a specific provider directly — they call the adapter interface.

**Ecosystem partner integration:** Waldo's biology layer can power other agents. Via MCP/A2A protocol (Phase 4), external agents (Lindy, Cursor, Claude Code) can query a user's CRS through a standard interface — making Waldo the "body API" for the agent economy.

## 3.2 Phase 3: Deep Intelligence + Scale (iOS now in MVP)

**Focus:** With iOS moved to MVP, Phase 3 focuses on intelligence depth, cloud wearable APIs, and prediction.

**New capabilities:**
- **Apple Watch companion app** (SwiftUI + HealthKit + WatchConnectivity) — richer on-wrist experience beyond phone
- **Cloud wearable APIs** — Oura REST API, Fitbit Web API, WHOOP API (for users without Health Connect / HealthKit access)
- **Knowledge graph** — entity extraction, relationship tracking, pattern surfacing
- **Adaptive CRS weights** — per-user weight optimization from feedback (requires 15+ feedback events)
- **Extended thinking** — Opus with long timeouts for deep analysis
- **Multi-language support** — system prompt localization
- **Email digest** — weekly HTML report via Resend
- **Samsung Sensor SDK** companion watch app (on-watch IBI → phone → true RMSSD for Samsung users)
- **Predictive cognitive modeling** — next-day CRS prediction from patterns

**Device coverage:** ~80-85% of global wearables (up from ~60% in MVP)

### Wearable Data Access Strategy: Direct First, Connectors If Blocked

**Core principle:** Build direct integrations for $0 cost. Never depend on aggregators ($399/mo) if avoidable.

| Device | Primary Path | Fallback If Blocked | Status |
|--------|-------------|-------------------|--------|
| Samsung Galaxy Watch | Health Connect HR+sleep (MVP) → Samsung Sensor SDK raw IBI (Phase 3) | HR BPM series as HRV proxy | **MVP (degraded HRV)** |
| Google Pixel Watch | Health Connect (full HRV) | N/A | **MVP (full CRS)** |
| Apple Watch | **HealthKit (MVP)** — full HRV (SDNN), HR, sleep, steps, SpO2 | N/A — Apple's own API | **MVP (best CRS)** |
| Garmin | Health Connect basics (MVP) → Connect IQ SDK raw IBI (Phase 2) | Garmin Cloud API for historical data | Available |
| Oura | Oura REST API v2 (Phase 3) | N/A — free for developers | Available |
| Fitbit | Fitbit Web API (Phase 3) | N/A — free | Available |
| WHOOP | WHOOP API v2 (Phase 3) | N/A — free | Available |
| Budget devices (Noise, boAt, Xiaomi) | Health Connect (basic HR + sleep + steps) | Build custom parsers from manufacturer cloud APIs if HC data is insufficient | Limited data quality |

**If Health Connect data is insufficient for a specific device:**
1. Check if the manufacturer has a public API (most do for cloud-synced data)
2. Build a custom connector using their REST API / SDK
3. Only as LAST RESORT consider aggregators (Terra $399/mo, Sahha custom pricing)
4. Accept degraded CRS for budget devices (HR + sleep duration only, no HRV or staging)

## 3.3 Phase 4: Mature

**Focus:** Monetization, enterprise, agent economy integration.

**New capabilities:**
- **Freemium model** live (Pup/Pro/Pack tiers)
- **FHIR/EHR integration** — lab results in agent context
- **Skills marketplace** — users create and share health protocols (jet-lag-recovery, marathon-training, exam-prep)
- **Multi-agent collaboration** — specialist sub-agents for complex queries (sleep agent + stress agent + activity agent coordinated by orchestrator)
- **Predictive cognitive modeling** — ML models for next-day energy/stress predictions ("Tomorrow looks like a high-stress day — here's how to prepare")
- **Agent-to-agent interop** — Waldo as a biological data provider for other agents (Lindy, OpenClaw) via MCP or A2A protocol. Waldo becomes the "body API" of the agentic economy.
- **Team cognitive dashboards** — startup teams, remote teams see aggregate cognitive readiness

## 3.4 NemoClaw-Inspired Infrastructure (Complete)

See [NemoClaw Infrastructure Plan](plans/2026-03-17-nemoclaw-inspired-agent-infrastructure.md) for full implementation details covering:

1. **Blueprint / Versioned Agent Configurations** — immutable configs, A/B testing, instant rollback
2. **Transparent Inference Middleware** — provider-agnostic, cost-tracked, budget-enforced
3. **Declarative Policy System** — per-hand tool/data permissions, violation logging
4. **Operator-in-the-Loop Escalation** — "ask first, then act" with learned preferences
5. **Plan-Apply-Rollback Lifecycle** — Terraform-style config management

## 3.5 Academic Validation (Optional, Post-Traction)

If traction warrants academic credibility (for enterprise sales, regulatory, or fundraising):
- IIT Ropar prospective study: N=50, 30 days, CRS vs PVT/cortisol
- Budget: Rs 12-15L, fundable via BIRAC BIG grant (Rs 50L non-dilutive)
- See archived `IIT_ROPAR_TBIF_COLLABORATION.md` and `DATASETS_AND_RESEARCH.md` for full design
- **Not on critical path.** Only pursue after MVP proves product-market fit.

## 3.6 Scaling Path

| Users | Architecture | Monthly Cost |
|-------|-------------|-------------|
| 0-200 | Supabase free/Pro only | $0-25 infra + AI |
| 200-1K | + QStash for per-user scheduling | ~$50 infra + AI |
| 1K-5K | + Dedicated worker (Railway/Fly.io) for agent loops | ~$200 infra + AI |
| 5K+ | Evaluate move from Supabase to dedicated Postgres | Custom |

## 3.7 Patent Strategy (Revised)

File provisional patent for CRS only. Drop the messaging and HRV normalization patents — not sufficiently novel.

1. **CRS multi-signal algorithm with adaptive personalization** — the specific combination of sleep + HRV + circadian + activity with feedback-driven weight adjustment and device-confidence weighting. Indian provisional: Rs 8,000-15,000. Gives 12 months of protection at minimal cost while validating if there's anything genuinely novel.

**Dropped:**
- ~~Proactive health intervention delivery via messaging platforms~~ — sending notifications based on health data is not sufficiently novel for a utility patent. Save the money.
- ~~Time-of-day normalized HRV baseline~~ — standard physiological practice. Not patentable.

**Open-source strategy (after Phase G):** Open-source the validated CRS v1.0 algorithm. The algorithm isn't the moat — personalization data is. Open-sourcing builds credibility, attracts contributors, creates content, and gives academic citations. Don't open-source the raw v0.1 — wait until it's tuned on real data.

---

# APPENDIX A: CONTRADICTION RESOLUTION LOG

All contradictions found across the 15 source documents, with final decisions:

| Contradiction | Source A | Source B | Final Decision | Rationale |
|--------------|---------|---------|---------------|-----------|
| **MVP timeline** | MVP_SCOPE: 8 weeks | COSTS_AND_ROADMAP: 12 weeks | **No timeline.** Phased deliverables (A-H). | User explicitly requested no time bounds. Build as fast as possible. |
| **MVP tools count** | MVP_SCOPE: 8 tools | AGENT_AND_BACKEND: 18 tools | **8 for MVP.** 18 is the full Phase 1 extended plan. | 8 tools is sufficient to prove the core loop. |
| **Model routing** | MVP_SCOPE: "Haiku only, no routing" | AGENT_AND_BACKEND: Haiku/Sonnet/Opus routing | **Haiku-only for MVP.** Inference middleware supports routing but only routes to Haiku. | Simplicity for MVP. Infrastructure ready for Phase 2 multi-model. |
| **Onboarding** | MVP_SCOPE: 3-step | DESIGN_AND_UX: 5-step + AI interview | **3-step for MVP.** AI interview is Phase 2. | Simpler onboarding reduces friction for beta. |
| **UI framework** | SETUP_CHECKLIST: "NativeWind v4 + Gluestack-UI v3" | MVP_ENGINEERING_PRD: NativeWind v4 only | **NativeWind v4 only.** | Lighter, simpler. Custom health dashboard doesn't need full component library. |
| **Samsung watch companion** | COSTS_AND_ROADMAP Phase 1: includes it | NEXT_STEPS: "drop it if scope too big" | **OUT of MVP.** Health Connect from phone is sufficient. | Health Connect HRV is enough to validate the thesis. Samsung companion is Phase 2. |
| **Cost per user** | CRITIQUE_AND_RISKS: $0.72/mo | COSTS_AND_ROADMAP: $2.86/mo (mixed) / $7.65/mo (Haiku) | **~$0.90/mo for Pro users** (verified March 18). | Old estimates assumed 1500 calls/mo without caching. Actual: ~210 calls/mo with pre-filter + prompt caching. |
| **WhatsApp** | MVP_SCOPE: OUT | COSTS_AND_ROADMAP Phase 1: IN | **OUT of MVP.** Start verification in parallel. | Telegram is free, instant, sufficient. Don't block launch. |
| **Push notifications** | MVP_SCOPE: OUT | COSTS_AND_ROADMAP Phase 1: not mentioned | **OUT of MVP.** | Telegram handles delivery. FCM adds complexity without proving the thesis. |
| **Cooldown between alerts** | DESIGN_AND_UX: 30 min | AGENT_AND_BACKEND: 2 hours | **2 hours.** | False positive cost is higher than missed alert cost. Conservative is better for trust. |
| **Agent SDK vs Messages API** | VISION_AND_STRATEGY: "Claude Agent SDK" | AGENT_AND_BACKEND: "Messages API with tool_use" | **Messages API with tool_use.** | Edge Functions are stateless serverless — Agent SDK expects persistent runtime. |
| **NemoClaw infra in MVP** | NemoClaw plan: all 5 systems in MVP | Critique: premature for 5 users | **Phase 2.** Hardcode everything for MVP. | 34 hours of infrastructure for 5 users is not minimal. Ship faster. |
| **Phase A Samsung SDK step** | SETUP_CHECKLIST: "Enable Samsung Sensor SDK" | Decision log: "Samsung SDK OUT of MVP" | **Remove from Phase A.** Not on critical path. | Health Connect is the MVP data source, not Samsung SDK. |
| **Auth strategy** | Not specified in any doc | Required for RLS policies | **Supabase anonymous auth → phone/email upgrade.** Edge Functions use service_role. | Simplest auth flow for beta. Upgrade auth in Phase 2. |

---

# APPENDIX B: DOCUMENT ARCHIVE MAP

All previous documents are now reference material. Here's what each contains if you need a deep dive:

| Document | What It Contains | When to Reference |
|----------|-----------------|-------------------|
| MVP_SCOPE.md | Original scope definition | Superseded by this document |
| MVP_ENGINEERING_PRD.md | Detailed tech specs, npm packages | Package versions, API details |
| AGENT_AND_BACKEND.md | 11 OSS agent project analysis | Agent patterns, memory architecture |
| ALGORITHMS_AND_HEALTH.md | Full algorithm code, HRV computation | Component scoring functions |
| COSTS_AND_ROADMAP.md | Cost model, pricing, phase roadmap | Unit economics, pricing |
| VISION_AND_STRATEGY.md | Pitch narrative, investor FAQ | Fundraising, market analysis |
| DESIGN_AND_UX.md | UI components, color tokens, charts | Dashboard design, color system |
| WEARABLE_DATA_PIPELINE.md | Device-specific SDK details | When adding new wearable support |
| CRITIQUE_AND_RISKS.md | Risk register, mitigations | Risk assessment |
| NOTES_AND_RECOMMENDATIONS.md | Strategic insights, IIT Ropar | Strategy, innovation angles |
| DATASETS_AND_RESEARCH.md | Public datasets for validation | CRS algorithm testing |
| SETUP_CHECKLIST.md | Pre-code setup steps | Setting up services |
| NEXT_STEPS.md | Execution plan | Superseded by Phase A-H |
| HARDWARE_STRATEGY.md | OneBand + ear module | **ARCHIVED** — not on any active roadmap. Software-only focus. |
| IIT_ROPAR_TBIF_COLLABORATION.md | Faculty, grants, study design | **ARCHIVED** — optional post-traction. Not on critical path. |

---

*This is the master reference. Build from Part 2. Reference Part 1 for context. Reference Part 3 for what comes next. Archive everything else.*

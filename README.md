# Waldo

**The biological intelligence layer for the agentic economy.**

An AI agent that reads your body signals from wearables, computes a Cognitive Readiness Score, and proactively messages you on Telegram before you burn out — before you even notice something's wrong.

```
Wearable → CRS Score → Stress Detection → Claude Agent → Proactive Message → Feedback → Learns
```

## The Problem

Every AI agent today — Lindy, Manus, Claude — can manage your calendar and draft your emails. **None of them know when you're cognitively depleted.** They'll schedule your hardest meeting when your nervous system is wrecked.

Health apps show you a dashboard. You glance at a score. You make the same decisions anyway. 3-12% Day 30 retention across the industry.

Waldo is different: it **comes to you**. A morning brief on Telegram. A stress alert when your body is struggling. Personalized, proactive, and it learns.

## What It Does

| Feature | How It Works |
|---------|-------------|
| **Morning Cognitive Brief** | Every morning at wake time: sleep quality, CRS score, one actionable insight |
| **Stress Alerts** | Detects stress from HRV + HR signals. Messages you before you notice. |
| **Conversational Chat** | Ask the bot anything: "Why am I so tired?" — answers grounded in YOUR data |
| **Learns Your Patterns** | "Monday afternoons = HRV drops after 3+ meetings." Adapts over weeks. |

## How It Works

1. **Your watch measures your body** — HR, HRV, sleep stages, steps via HealthKit / Health Connect
2. **Phone computes CRS (0-100)** — Cognitive Readiness Score based on sleep (35%), HRV (25%), circadian rhythm (25%), activity (15%). On-phone, offline, encrypted.
3. **Rules engine checks every 15 min** — 60-80% of the time everything's fine: no AI call, $0 cost
4. **When it matters, Claude Haiku crafts a message** — personalized, one micro-action, delivered via Telegram
5. **You tap Helpful / Not Helpful** — the agent learns your patterns, thresholds, and preferences over time

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 53+ |
| iOS Native | Swift — HealthKit (beat-to-beat IBI, true RMSSD) |
| Android Native | Kotlin — Health Connect + WorkManager |
| Local DB | op-sqlite + SQLCipher (AES-256 encrypted) |
| Styling | NativeWind v4 |
| Backend | Supabase (Postgres + Edge Functions + RLS) |
| AI | Claude Haiku 4.5 via @anthropic-ai/sdk (Messages API + tool_use) |
| Bot | grammY (Telegram, Deno) |
| Scheduling | pg_cron |

## The CRS Algorithm

```
CRS = (Sleep × 0.35) + (HRV × 0.25) + (Circadian × 0.25) + (Activity × 0.15)
```

Grounded in **SAFTE-FAST** (US Army biomathematical fatigue model). All baselines are personal, not population norms. The first open, transparent composite readiness score — no competitor publishes their formula.

## Build Phases

| Phase | What | Gate |
|-------|------|------|
| **A** | Wizard of Oz (manual CRS via Telegram) | 3+ users find morning briefs useful |
| **B1/B2** | HealthKit + Health Connect connectors | CRS updates every 15 min with real data |
| **C** | Dashboard (CRS gauge, sleep, trends) | Real data displays correctly |
| **D** | Agent Core + Telegram bot | Bot responds with health-aware context |
| **E** | Proactive delivery (morning brief + stress alerts) | Brief at wake time, alerts on stress |
| **F-H** | Onboarding, 14-day self-test, 5-7 user beta | Daily use, false positive < 20% |

## The Vision

| Phase | What Waldo Becomes |
|-------|---------------------|
| **MVP** | Health agent — CRS + stress alerts + morning brief via Telegram |
| **Phase 2** | Cognitive co-pilot — calendar, email, Slack, task manager, all CRS-aware |
| **Phase 3+** | Autonomous personal OS — learns skills from you, delegates to sub-agents, powers other agents with your biology |

The endgame: Waldo as the **biological intelligence substrate** that every other AI agent consults before acting. Not competing with Lindy or Manus — powering them with the one signal they don't have.

## Competitive Position

| | Biology | Proactive | External Messaging | Multi-Device | Cross-Platform | Price |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Waldo** | Deep (HRV, CRS) | Telegram | Yes | Any HC/HK | Android + iOS | Free / $4/mo |
| WHOOP Coach | Deep | In-app only | No | WHOOP only | Both | $17-30/mo |
| Oura Advisor | Deep | No | No | Oura only | Both | $6/mo |
| Nori (YC) | Aggregated | Limited | No | Multi | iOS only | TBD |
| Lindy | None | Yes | Yes | N/A | Web | $50/mo |

## Unit Economics

| Tier | Price | AI Cost/User/Mo | Margin |
|------|-------|----------------|--------|
| Free | Rs 0 | ~$0.27 | Acquisition |
| Pro | Rs 399/mo ($4.34) | ~$0.90 | **79%** |

Total MVP build cost: **~$966 USD** (50-150x cheaper than average health tech MVP).

## Documentation

- **[Full Documentation](https://pin4sf.github.io/Waldo)** — Architecture, algorithms, agent intelligence, MVP scope
- **[Presentation Deck](https://pin4sf.github.io/Waldo/presentation.html)** — Internal technical brief with diagrams
- **[Website](https://onesync-website-zs1p.vercel.app/)** — Product website

## Status

**Pre-code. Planning finalized. Ready to build.** (March 2026)

---

*In the agentic economy, every agent will need to know your body. Waldo is that layer.*

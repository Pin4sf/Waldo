# OneSync — The Biological Intelligence Layer for the AI Agent Economy

**No agent knows when you're cognitively depleted. OneSync changes that.**

---

## The Shift Happening Right Now

Y Combinator's 2026 RFS calls for "AI that can DO, not just assist." Nearly 50% of their latest batch is AI agents. NVIDIA GTC 2026 declared autonomous agents the next infrastructure layer with 17 enterprise adopters. Lindy, OpenClaw, Manus — every agent can manage your calendar and draft your emails.

**But no agent knows when you're burning out.** They'll schedule your hardest meeting when your HRV has crashed. They'll push you through a 14-hour day when your biology is screaming for recovery. 62% of knowledge workers report burnout (HBR, Feb 2026). The tools meant to help are making it worse because they're blind to the one signal that matters most: your body.

## What OneSync Is

**An AI that reads your smartwatch and tells you each morning how to make the most of your day.**

It briefs you on your cognitive readiness, learns what works for YOU, tracks your stress patterns over weeks, and gets smarter every day. It reaches you on Telegram — not buried in another health app.

**Not a health tracker. Not a dashboard. A morning cognitive brief that becomes your biological edge.**

```
Wearable → CRS Score → Stress Detection → Claude Agent → Proactive Message → Feedback → Learns
```

| What the Agent Does | How |
|-------------------|-----|
| **Tells you how sharp you are right now** | Cognitive Readiness Score (0-100) from sleep, HRV, circadian rhythm, activity. Updates every 15 min. |
| **Intervenes before you spiral** | Detects stress from biometric signals. Messages you with personalized intervention BEFORE you notice. |
| **Briefs you every morning** | Sleep quality, today's CRS, one actionable insight: "Your HRV recovered — schedule deep work now." |
| **Learns your patterns** | "Monday afternoons = HRV drops after 3+ meetings." Adapts over weeks. |
| **Earns more autonomy over time** | L1: Advises. L2: Suggests + one-tap approval. L3: Acts independently for trusted tasks. |

## Who This Is For

**Burned-out knowledge workers** who wear a smartwatch but get zero actionable value, and use productivity tools that have zero awareness of their body.

| Segment | Core Pain | What OneSync Does |
|---------|-----------|-------------------|
| **Startup founders** | 14-hour days, no signal when to stop | Creates biological boundaries, flags cognitive depletion before key decisions |
| **Software engineers** | Deep work disrupted, meeting fatigue | Protects peak cognitive windows, blocks calendar during circadian highs |
| **Product managers** | Context-switching burnout, decision fatigue | Flags depletion before high-stakes meetings, suggests rescheduling |
| **Consultants / remote workers** | Always-on culture, no boundaries | Detects stress accumulation across the work week, recommends recovery |
| **Students** | Cramming without awareness | Optimizes study/rest cycles based on actual cognitive readiness |

## The Two Intelligence Layers

What makes OneSync uniquely powerful is combining **biological intelligence** with **life context** from the tools people already use:

```
BIOLOGICAL INTELLIGENCE          LIFE CONTEXT
(what your body says)            (what your world looks like)
                    \              /
                     \            /
                   ONESYNC AGENT
                  (acts on both)
                        |
              AGENTIC AUTOMATION
         (tasks no other agent can do)
```

| Layer | Data Sources | What It Enables |
|-------|-------------|----------------|
| **Biology** | Wearable (HRV, HR, sleep, steps, SpO2 via Health Connect) | Know cognitive state RIGHT NOW — sharp, fatigued, stressed, recovering |
| **Life Context** | Calendar, email, Slack/Teams, task managers, meeting tools | Know what's coming, what's urgent, what can move, who's waiting |
| **Combined** | Biology + Context together | **Intelligent automation that neither health apps nor productivity agents can do alone** |

### What the Agent Automates (Biology + Context)

| Agentic Task | Biology Signal | Context Signal | What the Agent Does |
|-------------|---------------|----------------|-------------------|
| **Smart scheduling** | CRS < 60 (depleted) | Deep work block at 2pm | Suggests moving deep work to tomorrow morning when CRS is typically 75+ |
| **Meeting triage** | HRV drops after 3rd consecutive meeting | 5 back-to-back meetings today | Inserts a 15-min break after meeting 3, suggests declining the lowest-priority one |
| **Proactive rescheduling** | CRS crashed to 38 | Board presentation at 2pm | "Your cognitive readiness is low. Want me to suggest moving this to tomorrow morning?" |
| **Focus protection** | Circadian peak detected (10am-1pm) | 2 low-priority meetings during peak | Proposes declining or moving them to protect your best cognitive hours |
| **Stress pattern discovery** | HRV drops 25% every Monday 2-4pm | Recurring 1:1 with manager on calendar | "Your Monday manager 1:1 correlates with your biggest weekly stress spike. Want preparation strategies?" |
| **Workload balancing** | 7-day HRV baseline down 12% | 3 new tasks assigned this week in Linear/Jira | "Your stress load is up 40% this week. You may be overcommitted. Here's what could shift." |
| **Recovery nudge** | Sleep debt accumulated 4+ hours | Light calendar tomorrow | "Tomorrow's schedule is open — your body needs recovery. Protect that space." |
| **Communication timing** | Currently at circadian peak, CRS 82 | Draft email to investor sitting in outbox | "You're at peak cognitive readiness. Good time to send that investor email." |

**MVP:** Cross-platform biology layer (HealthKit + Health Connect + CRS + Telegram). HealthKit built first (best data — beat-to-beat IBI, true RMSSD). Morning cognitive brief + calendar-aware scheduling. Proves the proactive messaging loop creates engagement.

**Phase 2 — the real product:** Add workspace connectors + conversational skill creation. The user teaches the agent what to automate through natural conversation. Agent learns from behavior, proposes new skills, and executes across calendar/email/Slack/Notion/task managers. Samsung Sensor SDK for true HRV from Galaxy Watch.

**Phase 3:** Deep intelligence (knowledge graph, predictive modeling, adaptive CRS weights). Cloud wearable APIs (Oura, Fitbit, WHOOP). Skills marketplace. Agent-to-agent interop (body API via MCP/A2A).

## Market Timing

| Signal | Implication |
|--------|-----------|
| YC 2026: 50% of batch is AI agents | Agent economy is THE mandate |
| NVIDIA GTC 2026: Agent Toolkit + 17 enterprise adopters | Infrastructure ready |
| 62% knowledge workers report burnout (HBR) | Demand is massive |
| WHOOP Coach added proactive nudges | Market validation — but $30/mo, single-device |
| Apple Health+ scaled back (Bloomberg, Feb 2026) | Window wider than expected |
| AI API costs dropped 90%+ in past year | Economics work at scale |

## Competitive Position

**No agent has biology. No health app has agency.**

| | Biology | Proactive | External Messaging | Multi-Device | Cross-Platform | Price |
|---|---|---|---|---|---|---|
| **OneSync** | Deep | Yes | Telegram/WhatsApp | Any HC/HK watch | Android + iOS | Free / $4 |
| WHOOP Coach | Deep | Yes (**in-app only**) | No | WHOOP only | iOS + Android | $17-30/mo |
| Oura Advisor | Deep | No (reactive) | No | Oura only | iOS + Android | $6/mo |
| Lindy | None | Yes | Yes | N/A | Web | $50/mo |
| Nori (YC) | Aggregated | Morning plan only | No | Multi | **iOS only** | TBD |

## Business Model

| Tier | Price | AI Cost/User | Margin |
|------|-------|-------------|--------|
| Free | Rs 0 | $0.27/mo | Acquisition |
| Pro | Rs 399/mo ($4.34) | $0.90/mo | 79% |
| Team | Rs 999/mo/seat | $0.90/mo | 92% |

Based on Claude Haiku 4.5 ($1/$5 per MTok) with prompt caching (1-hour TTL) and rules-based pre-filter. ~7 Claude calls/day for Pro users; 96 daily background checks handled by rules engine at $0 AI cost. Break-even: ~50 Pro subscribers. Comfortable profitability at 200. **MVP build cost: ~$466 USD.**

## Tech

React Native + Expo | Kotlin + Swift native modules | Supabase | Claude Haiku 4.5 | Health Connect (Android) + HealthKit (iOS) | grammY Telegram

Architecture informed by [OpenClaw](https://github.com/openclaw/openclaw) (171K stars), [OpenFang](https://github.com/RightNow-AI/openfang), [NemoClaw](https://github.com/NVIDIA/NemoClaw), and 7 other open-source agent projects.

## Roadmap

**Now:** Architecture finalized, ready to build MVP (cross-platform Android + iOS)
**MVP:** 5-7 daily users (Android + Apple Watch), morning cognitive brief + stress pattern tracking + Telegram agent
**Phase 2:** Multi-model routing, WhatsApp, in-app chat, workspace connectors (calendar/email/Slack), weekly AI analysis
**Phase 3:** Samsung Sensor SDK (true HRV), cloud wearable APIs, knowledge graph, predictive modeling
**Phase 4:** Skills marketplace, multi-agent collaboration, team cognitive dashboards

## The Ask

**Pre-seed:** Rs 50L - 1Cr ($55K-$110K)
**Use of funds:** 6 months runway + iOS polish + first hire + academic validation
**Capital efficiency:** MVP total cost ~$966 USD (50-150x more capital-efficient than avg health tech MVP at $50K-$150K)

## Founder

**Shivansh Fulper** — Building the biological intelligence layer for the AI agent economy.

---

*In the agentic economy, every agent will need to know your body. OneSync is that layer.*

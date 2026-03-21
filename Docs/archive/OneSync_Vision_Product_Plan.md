# OneSync — Vision, Product & Immediate Plan

> **"The first AI that acts on what your body knows before you do."**

*Last updated: March 2026 · For co-founders, advisors, and collaborators*

---

## 1. The Vision

There are two kinds of AI products being built right now. On one side: health trackers (Oura, WHOOP, Garmin, Samsung Health) that collect extraordinary biometric data — heart rate variability, sleep stages, skin temperature, blood oxygen — and show it to you in a dashboard you glance at and forget. On the other side: AI agents (Lindy, Manus, Perplexity Computer) that are getting remarkably good at managing your tasks, emails, and calendar — but are completely blind to your body. They'll schedule your hardest meeting when you're cognitively depleted and push you through a 14-hour day when your biology is screaming for recovery.

Nobody has put the two together. That's OneSync.

OneSync is a persistent personal AI co-pilot where biology intelligence is the unfair advantage. It reads your body signals continuously from your smartwatch — HRV, sleep quality, heart rate, activity — and uses that understanding to act on your behalf. Not just track. Not just advise. *Act.* It sends you a Telegram message the moment your stress spikes, before you've even noticed it yourself. It learns your circadian rhythm and knows when you're sharp versus when you're fading. Over weeks and months, it builds a personal model of YOUR biology that no competitor can replicate because the data and the feedback loop are uniquely yours.

The long-term vision is a cognitive co-pilot that lives across every surface of your life — phone, watch, smart glasses, messaging apps, email — operating with earned autonomy, coordinating with other AI agents, and powered by the deepest understanding of your biological state that any software has ever had. We're building in the only quadrant of the market that's empty: **high body awareness + high agent autonomy.** Every other product sits in one corner or the other. OneSync sits in both.

---

## 2. The Full Product

What follows is everything OneSync is designed to become. Not all of this ships on day one — Section 4 covers what we build first and why. But this is the complete architecture we're building toward.

### Biology Intelligence Layer

Six algorithms that transform raw wearable data into actionable intelligence:

| Algorithm | What It Does | Key Inputs |
|-----------|-------------|------------|
| **Cognitive Readiness Score (CRS)** | 0-100 score predicting cognitive performance *right now* | HRV, sleep quality, activity, time-of-day, personal baselines |
| **Stress Detector** | Real-time stress estimation from HRV deviation + HR elevation | HRV RMSSD, resting HR, current HR, rate of change |
| **Circadian Phase Estimator** | Predicts energy peaks and valleys based on your body clock | Sleep/wake times (7-day), Borbély two-process model |
| **Mental Wellbeing Monitor** | Flags concerning trends in sleep, HRV baseline drift, activity | 30+ days of longitudinal data, pattern analysis |
| **Task-Cognition Matching** | Matches pending tasks to optimal time slots by cognitive demand | CRS predictions + calendar event metadata |
| **Prediction-Accuracy Feedback Loop** | Users rate every CRS prediction (👍/👎), weights personalize over time | User feedback, biometric snapshots, weekly batch adjustment |

The CRS starts with population-level defaults (functional within hours of install, no 3-day baseline wait) and personalizes to ~85% accuracy within 30 days via the feedback loop. The feedback loop is also our data moat — over time we accumulate the largest dataset of subjective cognitive performance correlated with biometrics.

### The Agent OS — Markdown-Driven Configuration

Inspired by the Claude Code `CLAUDE.md` / `MEMORY.md` paradigm, OpenClaw's `SOUL.md` system, and pi-mono's lifecycle architecture, OneSync runs on 11 human-readable markdown files that define everything about the agent:

| File | Purpose |
|------|---------|
| `SOUL.md` | Who the agent IS — personality, values, communication style, hard boundaries |
| `IDENTITY.md` | How the agent presents itself across platforms (Telegram vs WhatsApp vs voice) |
| `USER.md` | Who the user is — preferences, identity, stable personal data |
| `BODY.md` | The user's biological profile — baselines, CRS calibration, circadian prefs, health goals. Auto-updated by the biology layer |
| `AGENTS.md` | Behavioral rules — decision framework, notification limits, escalation rules |
| `BOOTSTRAP.md` | Initialization sequence — what loads first, population defaults, "Time to Magic" flow |
| `HEARTBEAT.md` | Proactive task schedule — biometric triggers + time-based crons |
| `TOOLS.md` | Available capabilities as an MCP server manifest |
| `TEAMS.md` | Sub-agent definitions — which models handle which tasks, handoff rules |
| `MEMORY.md` | Long-term learned patterns — compacted from daily interaction logs |
| `skills/` | Installable skill packages — morning-brief, stress-coach, jet-lag-recovery, etc. |

This isn't just config — it's a platform. The markdown files are the API surface for customization, and eventually for third-party skill developers.

### Progressive Autonomy

The agent earns trust, it doesn't assume it. Four levels:

- **L0 — Observer:** Watches biometrics silently. Reports only when asked. (Onboarding default for cautious users.)
- **L1 — Advisor:** Proactively suggests actions via Telegram/push. User decides. (Default for most users.)
- **L2 — Co-Pilot:** Suggests AND executes with one-tap approval. "I've drafted a reply to that Slack message — send it?" (Earned after consistent positive feedback.)
- **L3 — Agent:** Acts independently for trusted, repeatable tasks. "Your CRS was 38 at 3pm so I moved your deep-work block to tomorrow morning when I predict 78." (Only for power users who explicitly enable it.)

This model aligns with the EU AI Act Article 14 (human oversight for health AI) and is a formally recognized pattern across OpenAI's Agents SDK (`require_approval`), LangGraph's `interrupt()`, and Iris (YC F25).

### Proactive Heartbeat System

The agent doesn't wait for you to open the app. It reaches out.

**Biometric triggers (the hero feature):** HRV drops 20% below your baseline for 10+ minutes → immediate Telegram message with breathing exercise options and CRS context. No movement for 90 minutes during a predicted high-CRS window → contextual movement nudge. Sleep score below 60 → adjusted morning brief with recovery suggestions. Resting HR elevated for 30+ minutes → gentle check-in.

**Time-based crons:** Morning brief (overnight sleep + CRS + day preview), midday energy check, evening wind-down (recovery score + sleep suggestions), weekly review.

The biometric triggers are what make OneSync fundamentally different. Every other agent has cron jobs. Nobody else has an agent that reacts to your body in real time.

### Memory & Learning

Three-tier architecture inspired by OpenClaw and CrewAI:

1. **Daily logs** — Every interaction stored with importance scoring (0-1). High-importance memories (health insights, user corrections, preference discoveries) survive longer.
2. **Core memory** — Persistent learned patterns: "User's HRV drops every Monday afternoon (meeting stress)." "User prefers direct suggestions, not questions." "User's CRS is 15% lower on days after less than 6h sleep."
3. **Compaction** — Weekly batch job summarizes old daily logs into core memory entries, then clears the logs. The agent's context window stays manageable while knowledge compounds indefinitely.

### Cross-Platform Communication

The agent lives where you live, not in a single app:

**MVP:** Telegram (free, rich bot API, 2B+ users). **Phase 2:** WhatsApp Business API, Slack, Email, Push notifications. **Phase 3:** Voice via Meta Ray-Ban Display speakers, Google Calendar read/write. All channels share a unified conversation context — start on Telegram, continue on WhatsApp, get a follow-up via push.

### Multi-Agent Architecture & Interoperability

**Internal sub-agents:** Health Analyst (cheap model for number crunching), Comms Manager (message drafting), Research Agent (meeting prep). The core orchestrator delegates, each sub-agent has scoped tools and model selection.

**External interoperability:** Tools exposed as MCP (Model Context Protocol) server — the emerging standard with 97M monthly SDK downloads. Agent discovery via A2A (Agent-to-Agent Protocol) from Google. OneSync publishes an Agent Card: "I can provide health-contextualized scheduling and stress-aware communication timing." External agents query us before scheduling a meeting or assigning a task.

**Health MCP Server (strategic infrastructure play):** An open-source MCP server that exposes wearable data (`get_heart_rate()`, `get_hrv()`, `get_crs()`, `get_stress_level()`) to any MCP-compatible agent. If this becomes the standard way agents access health data, we're infrastructure — not just an app.

### Device Ecosystem

The platform is device-agnostic by design, but the roadmap is deliberate:

**Foundation:** Any Android smartwatch via Health Connect (Samsung Galaxy Watch, Pixel Watch, Fitbit, OnePlus, Amazfit, Xiaomi — all write to HC). **Expansion:** Direct APIs for Oura, WHOOP, Garmin (richer data than HC alone), Apple Watch via HealthKit. **Future:** Meta Ray-Ban Display (camera + mic + speakers for ambient intelligence), and eventually custom wearable hardware for deepest-possible biosignal capture.

---

## 3. The Gap

ChatGPT Health launched January 2026 and now handles 230 million weekly health queries — proving massive demand for AI that understands your body. But it's purely reactive Q&A: you ask questions, it answers. It can't message you when your HRV drops or reschedule your meeting because your CRS is low. Nori (YC F25, ex-Spotify/Chartable founders) aggregates wearable data into a health coach, but coaching is not agency — it tells you what to do, it doesn't do it. Lifestack maps your energy curve to your calendar, but it's a planner you open, not an agent that reaches you. Lindy has raised $50M+ and built a powerful autonomous agent with 4,000+ integrations — but it's completely blind to your biology. Oura ($5.2B valuation) and WHOOP have the best health data in the world, trapped inside their own apps with minimal autonomy.

The convergence is coming — wearable companies are adding AI features, agent companies may eventually add health. But as of March 2026, nobody occupies the quadrant that combines deep biometric intelligence with proactive autonomous action. That's the window. We estimate 12-18 months before it closes.

---

## 4. The MVP — What We're Building First

The vision above is what we're building *toward*. Here's what we're building *now*, and why.

### The Core Thesis We Need to Prove

Can an AI agent that reads your body signals deliver a proactive intervention that feels genuinely useful — not annoying, not generic, but *right* — at the exact moment your biology says you need it?

If yes, everything else follows. If no, the architecture doesn't matter.

### What Ships First

An Android app that reads biometric data from a Samsung Galaxy Watch via Health Connect, computes a Cognitive Readiness Score, detects stress in real-time, and sends the user a contextual intervention via Telegram when their body signals say they're struggling.

That's it. One wearable ecosystem. One communication channel. One biometric trigger. One algorithm. Bare metal.

| In the MVP | Not in the MVP (yet) |
|------------|---------------------|
| Health Connect integration (HR, HRV, sleep, steps) | iOS / Apple HealthKit |
| CRS algorithm with population defaults | Circadian Phase Estimator (separate) |
| Stress detector (HRV + HR based) | Mental Wellbeing Monitor |
| ONE biometric trigger: stress intervention | Movement nudge, sleep-adjusted alerts |
| Telegram bot (bidirectional) | WhatsApp, Slack, Email, Voice |
| CRS Feedback Loop (👍/👎) | Automated weight adjustment batch |
| Claude Haiku for all AI calls | Multi-model routing, sub-agents |
| L1 Advisor mode only | L0/L2/L3 autonomy levels |
| Simple memory (Supabase tables) | Memory compaction, MEMORY.md |
| Single-user onboarding | Skills marketplace, A2A, enterprise |

### Why This Specific Scope

The **stress intervention** is the hero moment. Someone is in a difficult meeting, their HRV drops, their heart rate climbs — and their phone sends them a Telegram message: *"Your stress just spiked. CRS is 48. You have a gap in 10 min — want a 3-min breathing exercise or should we note this and move on?"* That moment — the feeling that their phone understood their body before they did — is what makes people tell others about OneSync. It's the viral loop. It's the demo that makes investors lean in. It's the thesis test.

Everything else (morning briefs, calendar integration, WhatsApp, sub-agents, Ray-Ban glasses) only matters if that one moment works.

### The Stack

| Layer | Choice | Cost |
|-------|--------|------|
| Mobile | React Native + Expo (custom dev client) | Free |
| Health Data | Health Connect SDK (`react-native-health-connect`) | Free |
| Backend | Supabase (Postgres + Edge Functions + Auth) | Free → $25/mo |
| AI | Claude Haiku 4.5 via Anthropic API | ~$0.95/user/month |
| Communication | Telegram Bot API | Free |
| Health APIs | Health Connect (all Android devices) | Free |

**Total cost to run 100 users: ~$120/month.** Health data layer costs zero. All free tiers cover MVP needs.

### What Success Looks Like

The MVP is validated when: >65% of CRS predictions get a thumbs-up, >50% of stress interventions get a positive response, and >40% of users engage daily. At that point, we've proven that biology-aware proactive AI is something people want — and we start expanding.

---

## 5. What's Next

The immediate sequence, in order:

1. **Set up the project.** Expo init, Supabase project, Telegram bot, Anthropic API key. The scaffolding.
2. **Get Health Connect reading real data on a real Samsung Galaxy Watch.** This is the first technical risk — HC permission flows are finicky on different Android OEMs. We need this working on a physical device, not an emulator.
3. **Build the CRS algorithm and stress detector.** Pure computation — no AI needed. Input: HC data. Output: a number (0-100) and a stress classification.
4. **Wire up the Telegram bot + Claude agent loop.** User sends a message → Edge Function assembles context (profile + biometrics + memory) → Claude reasons with tools → response goes back via Telegram.
5. **Fire the first biometric-triggered stress intervention on a real person.** This is the moment of truth. If it feels right, we have a product. If it feels wrong, we iterate on the algorithm and the messaging.
6. **Open beta with 50 users.** Collect CRS feedback, measure engagement, iterate aggressively.
7. **Expand.** More triggers, more channels, more devices, more autonomy. The roadmap from Section 2 kicks in.

Right now it's not about moats or market positioning or competing with anyone. It's about making the thing exist. One app, one watch, one trigger, one message at the right moment. Build it, prove it works, then build everything else.

---

*This document is a living brain dump. Feedback, questions, and "you're wrong about X" are all welcome. The goal is to get this right, not to be right.*

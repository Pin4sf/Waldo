# OneSync — Exact Next Steps

**Date:** March 15, 2026
**Context:** Documentation finalized. Ready to move from planning to building.

---

## The State of Things

All documentation is complete. The architecture is sound. The risks are known. The costs are low.

**The only thing left is to start.**

---

## This Week (March 15–21) — Pre-Code

### Day 1 (Today)
1. **Enable Samsung Sensor SDK developer mode on your watch** — 30 minutes. This de-risks the biggest hardware question. Instructions in SETUP_CHECKLIST.md.
2. **Create Telegram bot via @BotFather** — 15 minutes. You need this for the Wizard of Oz test.
3. **Start WhatsApp Cloud API verification** — 1 hour to apply, 14 days to approve. Start the clock now.

### Days 2–3
4. **Wizard of Oz test** — Export 7 days of Samsung Health data, manually compute CRS, write 3–5 morning brief messages, send to yourself on Telegram. Does it feel useful? If yes → build. If no → fix the algorithm first.
5. **Commit 3 beta users by name** — From IIT network. Get confirmed, not "maybe." They need: Android phone + smartwatch + Telegram + stress/burnout.

### Days 4–5
6. **Set up Supabase project** — Schema applied, RLS enabled, pg_cron + pgmq extensions on.
7. **Bootstrap Expo project** — `create-expo-app`, NativeWind, Gluestack-UI, test Health Connect basic read.
8. **Apply for Google Play Console** ($25) + Samsung Developer (free).

---

## Weeks 1–2 — Foundation

**Goal: Health Connect reads real data → CRS computes on-phone → Supabase receives it**

Key tasks (reference MVP_ENGINEERING_PRD.md Week 1–2 plan):
- Kotlin WorkManager module with 15-min periodic sync
- Kotlin Health Connect module reading: HR, HRV, sleep stages, steps, SpO2
- SQLite local buffer + custom upload queue to Supabase
- CRS computation (TypeScript, on-phone) — spec in ALGORITHMS_AND_HEALTH.md
- Weighted stress confidence scoring
- Basic Supabase write test (health_snapshots table)

**Milestone:** You can see today's CRS update on your phone every 15 minutes. No app dashboard yet — just console log is fine.

---

## Weeks 3–4 — Dashboard + Agent Core

**Goal: CRS shows on screen → Claude agent replies on Telegram**

Key tasks:
- CRS gauge UI (270° arc, color zones per DESIGN_AND_UX.md)
- Metric cards (sleep, HR, HRV, steps)
- Claude Haiku agent with SOUL.md + BODY.md context
- 8 tools: get_crs, get_sleep, get_stress_events, get_activity, send_message, read_memory, update_memory, get_user_profile
- Telegram webhook (Supabase Edge Function)
- Basic Telegram reply flow (user messages bot → agent responds)

**Milestone:** You send a message to your Telegram bot and get a personalized health-aware response.

---

## Weeks 5–6 — Proactive Delivery + Onboarding

**Goal: Agent messages YOU without being asked → Someone else can set it up**

Key tasks:
- Morning brief (pg_cron at 7am, gather sleep + CRS, send Telegram message)
- Stress alert trigger (check-triggers Edge Function, confidence ≥ 0.60 → message)
- 7-day learning messages ("Day 3: Here's what I've noticed about your HRV…")
- 3-step onboarding: wearable detect → Health Connect permissions → Telegram link
- 6-digit linking code system
- Permission pre-education screen (critical for Android one-and-done permission model)

**Milestone:** You wake up to a morning brief. The agent messages you when it detects stress.

---

## Weeks 7–8 — Self-Test + Beta

**Goal: 2 weeks of daily founder use → 3–5 beta testers onboarded**

Key tasks:
- Use it daily for 2 weeks. Log every false positive alert.
- Tune stress confidence thresholds (start conservative at 0.65+)
- Add cooldown logic (2h between alerts, max 3/day)
- Fix the top 3 most annoying bugs
- Onboard 3 committed beta users
- Collect feedback (weekly 15-min conversation, not a survey)

**Milestone:** 5 people (you + 4 others) use it for 7 days. At least 1 says "that alert was actually useful."

---

## Parallel Track (While Building)

These don't block building but have long lead times. Start them now:

| Task | Why | Lead Time |
|------|-----|-----------|
| WhatsApp Cloud API verification | Phase 2 messaging | 3–14 days |
| Google Play Health Connect declaration | Production release | 2+ weeks |
| Samsung Sensor SDK partnership application | Phase 2 raw IBI | Unknown |
| IIT Ropar TBIF SPRINT application | Non-dilutive funding + validation | Apply now, cohort quarterly |
| Provisional patent filing (CRS algorithm) | Before any public disclosure | File before ProductHunt |
| Build in public: 3 Reddit/Twitter posts | Demand signal + waitlist | Start Week 3 |

---

## Decision Points

You'll hit these moments. Here's the decision in advance:

**"Samsung SDK distribution was denied"**
→ Use Health Connect HRV for MVP. Apply for Garmin Connect IQ SDK. Samsung stays on Phase 2 wishlist.

**"Health Connect HRV data is missing / unreliable"**
→ Fall back to HR-only stress detection with lower confidence. Increase minimum samples required before alerting. Be transparent with users ("HRV unavailable, using HR only — accuracy may be lower").

**"WhatsApp verification is taking forever"**
→ Launch with Telegram only. WhatsApp is a nice-to-have. Don't delay launch.

**"CRS feels wrong / useless after Wizard of Oz test"**
→ Revisit weights in ALGORITHMS_AND_HEALTH.md. Run a 2-week personal experiment with just sleep score. Adjust before building.

**"Solo dev is too slow — need to cut more"**
→ Drop Samsung watch companion (Week 7 in PRD). Health Connect from the phone is enough to prove the thesis. Re-add in Phase 2.

---

## The Document Map (Post-Cleanup)

### Build With These (Daily Reference)
| Doc | Purpose |
|-----|---------|
| [MVP_SCOPE.md](MVP_SCOPE.md) | What we're building and what we're NOT |
| [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) | Everything to set up before coding |
| [MVP_ENGINEERING_PRD.md](MVP_ENGINEERING_PRD.md) | Full technical spec (week-by-week) |
| [ALGORITHMS_AND_HEALTH.md](ALGORITHMS_AND_HEALTH.md) | CRS + stress detection implementation |
| [AGENT_AND_BACKEND.md](AGENT_AND_BACKEND.md) | Agent architecture + Supabase schema |
| [DESIGN_AND_UX.md](DESIGN_AND_UX.md) | UI components + color system |
| [WEARABLE_DATA_PIPELINE.md](WEARABLE_DATA_PIPELINE.md) | Device data access + SDK guide |

### Reference When Needed
| Doc | Purpose |
|-----|---------|
| [VISION_AND_STRATEGY.md](VISION_AND_STRATEGY.md) | Pitch narrative + investor FAQ |
| [COSTS_AND_ROADMAP.md](COSTS_AND_ROADMAP.md) | Unit economics + phase roadmap |
| [CRITIQUE_AND_RISKS.md](CRITIQUE_AND_RISKS.md) | Risk register + mitigations |
| [NOTES_AND_RECOMMENDATIONS.md](NOTES_AND_RECOMMENDATIONS.md) | Strategic compass + IIT Ropar study |

### Archive (Phase 3+, Not For MVP)
| Doc | Purpose |
|-----|---------|
| [HARDWARE_STRATEGY.md](HARDWARE_STRATEGY.md) | OneBand + NFL hardware — revisit Phase 4 |
| [IIT_ROPAR_TBIF_COLLABORATION.md](IIT_ROPAR_TBIF_COLLABORATION.md) | Partnership + grants — action items in NEXT_STEPS above |

---

## The Single Most Important Thing

> Build the simplest version that closes the loop: sensor → score → AI → message → feedback.

Don't polish. Don't add features. Don't over-engineer the agent.

Close the loop first. Then iterate.

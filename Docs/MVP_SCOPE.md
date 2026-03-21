# OneSync MVP — Definitive Scope

**Version:** 1.0
**Date:** March 15, 2026
**Status:** The single source of truth for what we're building. This overrides any conflicting scope in other documents.

> If you're about to build something and it's not in the IN SCOPE list below, stop and add it to the backlog.

---

## The One-Sentence Product

An AI agent on your phone that reads your body signals from your wearable and messages you on Telegram when you're stressed, tired, or about to make a bad decision — before you realize it yourself.

---

## The Core Loop We're Proving

```
WEARABLE → HEALTH CONNECT → ON-PHONE CRS → STRESS DETECTION
                                                    ↓
              TELEGRAM ← CLAUDE AGENT ← TRIGGER CHECK (Supabase)
                  ↓
         USER REPLY → FEEDBACK → AGENT LEARNS
```

This loop is the MVP. Everything else is Phase 2+.

---

## Target User (MVP)

- Android phone (Samsung or Pixel preferred)
- Samsung Galaxy Watch 5/6/7 **or** Google Pixel Watch 2/3 **or** any watch that writes to Health Connect
- Knowledge worker / student experiencing burnout or high stress
- Willing to use Telegram for their AI health agent

---

## IN SCOPE — 8 Weeks

### App (React Native / Expo)
- [ ] Health Connect integration (HR, HRV, sleep, steps, SpO2)
- [ ] Background sync every 15 minutes (WorkManager)
- [ ] On-phone CRS computation (offline-capable)
- [ ] Weighted stress confidence scoring
- [ ] CRS gauge dashboard
- [ ] Sleep summary card
- [ ] Basic metric cards (HR, HRV, Steps)
- [ ] Telegram channel linking (6-digit code)
- [ ] Simple 3-step onboarding: Connect wearable → Grant permissions → Link Telegram
- [ ] Settings (profile, notification preferences)

### Agent (Supabase + Claude)
- [ ] Claude Haiku as single model (no routing for MVP)
- [ ] 8 core tools: `get_crs`, `get_sleep`, `get_stress_events`, `get_activity`, `send_message`, `read_memory`, `update_memory`, `get_user_profile`
- [ ] SOUL.md (personality) + BODY.md (today's vitals) context — both cached
- [ ] Morning brief (daily, 7am local time)
- [ ] Proactive stress alert (when confidence ≥ 0.60)
- [ ] Conversational replies (user can message the bot anytime)
- [ ] 7-day learning messages ("Here's what I'm learning about you…")

### Backend (Supabase)
- [ ] Core schema: users, health_snapshots, stress_events, conversation_history, core_memory, feedback_events
- [ ] pg_cron: morning brief + trigger check every 15 min
- [ ] pgmq: message queue for delivery
- [ ] Edge Functions: telegram-webhook, check-triggers, message-sender, morning-brief
- [ ] Telegram bot (grammY)

### Data & Privacy
- [ ] Health data encrypted at rest (SQLCipher local, Supabase RLS)
- [ ] Clear "not a medical device" disclaimer in onboarding
- [ ] Basic data export (CSV)

---

## OUT OF SCOPE — MVP

| Feature | When |
|---------|------|
| WhatsApp integration | Phase 2 (Week 9+) |
| Samsung Health Sensor SDK (raw IBI) | Phase 2 — use Health Connect HRV for MVP |
| Garmin Connect IQ companion | Phase 2 |
| Google Calendar / Gmail integration | Phase 2 |
| In-app chat | Phase 2 |
| Push notifications (FCM) | Phase 2 |
| Voice (Whisper STT/TTS) | Phase 3 |
| Multi-model AI routing | Phase 2 |
| iOS support | Phase 3 |
| Custom hardware (OneBand) | Phase 4 |
| Team / multi-user dashboard | Phase 4 |
| Weekly summary report | Phase 2 |
| CSV export in-app | Phase 2 |
| History screen | Phase 2 |
| Gamification / streaks | Phase 2 |
| AI interview onboarding | Phase 2 (manual profile setup for beta) |

---

## MVP Success Criteria

**Technical (must work before beta):**
- Background sync works on Samsung Galaxy Watch + Pixel Watch (15-min intervals, survives phone restart)
- CRS updates within 1 minute of new health data arriving
- Stress detection false positive rate < 20% (self-tested over 2 weeks)
- Proactive messages delivered within 2–5 minutes of detection
- Telegram conversation feels natural and context-aware (not robotic)
- Morning brief includes last night's sleep + today's CRS + 1 actionable insight
- App works offline (CRS computes without internet)
- Onboarding completes in < 5 minutes

**User (must see before calling MVP "done"):**
- You (founder) use it daily for 2 weeks straight
- At least 3 beta users from IIT network complete onboarding and use it for 7 days
- At least 1 user says "this message was actually useful" about a proactive alert
- 7-day retention ≥ 40% (3 out of first 5 beta users still active after 7 days)

---

## Definition of "MVP Done"

> 5 people (including you) are using OneSync daily. The agent is sending at least 1 useful proactive message per person per day. Users are replying to the agent. CRS is updating every 15 minutes. No critical bugs in a 7-day window.

---

## What This MVP Proves

1. Health Connect gives enough signal for meaningful CRS computation
2. Stress detection via HRV + HR is useful (even without raw IBI)
3. Proactive Telegram messages create genuine engagement
4. The morning brief becomes a daily habit
5. Claude agent personality + health context = valuable, non-generic advice

---

## Timeline

| Week | Focus | Key Deliverable |
|------|-------|----------------|
| 0 | Pre-coding | Samsung SDK dev mode, Telegram bot, Supabase setup, Health Connect test |
| 1 | Foundation | Expo + Kotlin modules, Health Connect reads, basic Supabase sync |
| 2 | CRS Engine | On-phone CRS, stress detection, SQLite sync, WorkManager |
| 3 | Dashboard | CRS gauge, metric cards, sleep card (NativeWind) |
| 4 | Agent Core | Claude Haiku agent, SOUL + BODY context, 8 tools, Telegram webhook |
| 5 | Proactive | Morning brief (pg_cron), stress trigger, message delivery |
| 6 | Onboarding | 3-step flow, linking codes, permission UX, 7-day learning messages |
| 7 | Self-Test | 2 weeks of daily use by founder, false positive tuning |
| 8 | Beta | 3–5 beta testers, iterate on agent quality |

---

## Key Constraints

- **Solo developer**: do not add any feature that takes >2 days unless it's on the IN SCOPE list
- **Health Connect only** for wearable data in MVP (no Samsung Sensor SDK on critical path)
- **Claude Haiku only** for all AI calls in MVP (add routing in Phase 2)
- **Telegram only** for messaging in MVP (WhatsApp verification in parallel but not blocking)
- **Android only** for MVP (iOS Phase 3)

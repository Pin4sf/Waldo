---
type: heartbeat_user_overrides
user: ark
last_updated: 2026-03-30
---

# Ark — Heartbeat Overrides

> User-specific overrides layered on top of platform HEARTBEAT_*.md files.
> Only differences from platform defaults are listed here.
> If a field is not listed, platform default applies.

---

## Morning Wag Overrides

**Wake time:** 06:21 IST (Asia/Kolkata)
**Platform default was:** 07:00 — overridden by Ark's actual wake data.

**Zone modifier — extra context for Ark:**
Ark is a student building projects. High cognitive demand days.
When CRS is in Flagging zone (50-64) on a high-workload day (≥3 calendar events):
→ Surface the time-of-day peak window explicitly.
→ "Your peak window is 10:00–13:00. If you have a hard task, front-load it."

**No cheerful openers.** Platform SOUL_MORNING allows optional opener on Peak days.
For Ark: skip it. Lead directly with score.

---

## Patrol (Fetch Alert) Overrides

**Active window:** 07:00 — 21:30 IST
**Platform default:** 06:00 — 22:00 — narrowed for Ark (confirmed quiet morning pre-06:00 and late evening preference).

**Stress signal sources for Ark (ranked):**
1. HRV drop > 15% from 30d baseline (primary)
2. Elevated resting HR > 10bpm above baseline (secondary)
3. After-hours email spike (emerging — not yet active, insufficient data)
4. Calendar density (Google Calendar available — use when meeting load > 4 events/day)

**Ark-specific suppression:**
- Don't fire Fetch Alert between 08:00–10:30 on weekdays (IIT class blocks inferred).
  Reasoning: Ark's CRS naturally dips slightly in morning hours. Patrol should distinguish
  HRV-driven stress from normal morning circadian patterns.
- Academic exam periods (infer from calendar density spikes): reduce Fetch Alert threshold
  from 0.60 → 0.75 to reduce noise during naturally elevated stress weeks.

---

## Evening Review Overrides

**Time:** 21:00 IST (platform default — no change)

**Ark-specific additions:**
- When Sunday evening review fires:
  - If sleep debt > 1h: add one gentle note about sleep debt before the week.
    Format: "You're going into the week with ~Xh sleep debt. Sunday nights tend to be your trickiest."
  - This is NOT a lecture. One line, then move on to the normal review.
  - Condition: Sunday + sleep_debt > 1.0h AND burnout_trajectory < 0.55 (if higher, that's a separate conversation)
- This override is NOT yet active. Activate when Sunday sleep pattern is confirmed (4+ more weeks) OR Ark raises sleep consistency goal again.
  Current status: **PENDING — not yet firing**

---

## Baseline Updater

No overrides. Platform default (04:00 IST, no message) applies.

---

## Weekly Compaction

No overrides. Platform default (Sunday 20:00 IST, internal only) applies.

Additional write target for Ark: update `agent/users/ark/memory/MEMORY_PATTERNS.md` with
any patterns that cross confidence threshold during the week.

---

## Quiet Hours

**22:00 — 06:00 IST** (Asia/Kolkata)
No outbound messages during this window.
Exception: Emergency bypass (SAFETY.md) always fires. Always.

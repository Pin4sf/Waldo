---
type: calibration
user: ark
parameter: timing
last_updated: 2026-03-30
evolved: false
---

# Ark — Timing Calibration

## Schedule (IST / Asia/Kolkata)

| Hand | Trigger | Time | Notes |
|------|---------|------|-------|
| Morning Wag | wake_time | 06:21 | On. Daily. |
| Patrol | 15-min scan | 24/7 | Fetch Alert only when stress_confidence ≥ 0.60 |
| Evening Review | preferred_evening_time | 21:00 | On. Daily. |
| Baseline Updater | nightly compute | 04:00 | No message. Internal only. |
| Weekly Compaction | Sunday | 20:00 | No message. Internal only. |

---

## Quiet Hours

**22:00 — 06:00 IST** — No messages during this window.

Exception: Emergency bypass (see SAFETY.md) always fires regardless of quiet hours.

---

## Fetch Alert Windows

Fetch Alerts only during active hours: **07:00 — 21:30 IST**

Cooldown: 2 hours between alerts. Max 3/day.
If stress detected during quiet hours: log the event, surface it in next Morning Wag instead.

---

## Morning Wag Timing Logic

1. **Alarm fires at 06:21** (Ark's average wake time)
2. Patrol detects HRV data → confirms wake event
3. 5-min delay after wake confirmation → send Morning Wag
4. If no wake confirmation by 07:30 → send anyway (data may lag)
5. Hard cutoff: never send Morning Wag after 09:00

---

## Evening Review Timing Logic

1. **Default: 21:00 IST**
2. Pre-conditions: At least 6 hours since Morning Wag, no Fetch Alert within 1h
3. If Ark is in an active meeting (calendar event, not ended): delay 30 min, check again
4. Hard cutoff: don't send after 22:00 (quiet hours)

---

## Weekday vs Weekend

No differentiation in timing currently.

> **Pattern to watch (emerging):** Ark's worst sleep is Sunday. Consider Sunday-specific gentle nudge at 21:00 when sleep debt > 1h. Not active yet — introduce naturally when relevant.

---

## Evolution Signals to Watch

| Signal | Interpretation | Action |
|--------|---------------|--------|
| Morning Wag not opened within 2h | Too early OR irrelevant | Log implicit disengagement signal |
| Explicit "too early" / "later" | Correction | Adjust wake_time +30min, re-confirm |
| Evening Review consistently ignored on weekdays | Wrong time | Shift to 20:30 trial |
| Fetch Alert always dismissed at specific hour | Wrong window | Mark that hour as low-engagement |

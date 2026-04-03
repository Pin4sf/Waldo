# Waldo — Morning Wag Hand
> Trigger: pg_cron daily at user.wake_time (local) → check-triggers Edge Function
> Phase B-C: pg_cron + Supabase Edge Function
> Phase D+: Cloudflare DO alarm, per-user scheduling

---

## When it fires
Daily, within a 5-minute window of the user's configured wake time.
If wake_time not set: default 07:00 local.
Skip if: already sent morning_wag in last 18 hours (idempotency check).

## Pre-conditions (must ALL be true)
- health_snapshot exists for yesterday (any data, even partial)
- CRS has been computed (score ≥ 0, or score = -1 acceptable — still fires)
- User has a linked channel (telegram_chat_id not null)
- Not in quiet hours

## Multi-phase playbook

### Phase 1: PREPARE (15 min before wake_time, no LLM)
Pure computation. Pre-assemble everything before the user wakes.
- Load last night's health_snapshot
- Compute CRS components
- Load today's calendar events (if connected)
- Load overdue tasks (if connected)
- Select soul variant: SOUL_MORNING + CRS zone modifier (SOUL_PEAK/DEPLETED/etc.)
- Speculative pre-build: assemble the message using template (discard if data changes)
- Cache result for 15 minutes

### Phase 2: DELIVER (at wake_time)
- Check pre-filter first:
  ```
  IF CRS > 65 AND no_stress_events_last_2h AND no_data_anomalies:
    → use template response (skip Claude)
    → template: "{name}, {score} this morning. {sleep_summary}. {top_action}."
  ELSE:
    → invoke Claude with soul=SOUL_MORNING + zone_modifier
    → max 2 iterations, budget 4000 tokens
  ```
- Deliver via ChannelAdapter
- Write to sent_messages with idempotency_key

### Phase 3: CLOSE LOOP (2h after delivery)
- Check feedback_events for this message_id
- If no open/reply within 2h → log implicit_disengagement signal
- If dismissed → log dismissal signal
- Both signals feed into CALIBRATION_TIMING evolution (Phase G)

## Template fallback (pre-filter wins — ~60% of mornings)
```
"{name}, {score} this morning. {sleep_one_line}. {one_action}."
```
Variables resolved from health_snapshot. Zero Claude cost.

Examples:
- "Ark, 74 this morning. Solid night — 7.2h. Clear your hard task before 1pm."
- "Ark, 58 today. Short on deep sleep. One priority only today."
- "Ark, 81. Strong recovery. What's the hardest thing on your plate?"

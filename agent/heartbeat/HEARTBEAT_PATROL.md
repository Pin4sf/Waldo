# Waldo — The Patrol (Stress Monitor Hand)
> Trigger: pg_cron every 15 minutes → check-triggers Edge Function
> "The Patrol never sleeps."

---

## What The Patrol does
Every 15 minutes, silently check if stress conditions are met.
90% of checks → nothing. No message, no Claude call. Just the rules engine watching.

## Patrol check sequence (pure rules, no LLM)

```
1. Is user in quiet hours? → SKIP
2. Was a Fetch Alert sent in last 2h? → SKIP (cooldown)
3. Have 3 Fetch Alerts been sent today? → SKIP (daily cap)
4. Is there a new stress_event with confidence ≥ 0.60 in the last 15 min? → CONTINUE
5. Is CRS currently < 70? (stress is more meaningful when already depleted) → WEIGHT UP
6. Is the stress_event sustained for ≥ 10 minutes? → CONFIRM
7. Calculate adjusted confidence = raw_confidence × recency_factor
8. If adjusted_confidence ≥ 0.60: FIRE FETCH ALERT
9. Else: LOG, skip
```

## Stress event thresholds
| Confidence | Action |
|-----------|--------|
| < 0.40 | Ignore entirely |
| 0.40-0.59 | Log, monitor — may combine with next window |
| 0.60-0.79 | Fetch Alert (standard) |
| ≥ 0.80 | Fetch Alert (HIGH — shorter, more urgent tone) |

## Patrol during specific contexts
- **During exercise** (HKMetadataKeyHeartRateMotionContext = active): suppress HR-elevation stress signals. Normal during workout.
- **In quiet hours**: log events but don't fire. Resume at quiet_hours_end.
- **After morning_wag fired within 30 min**: backoff 30 min — user just got a message.

## What fires the stress_event in the first place
The mobile app (HealthPipeline) computes stress_confidence continuously:
```
0.35 × HRV_drop_pct + 0.25 × HR_elevation_pct + 0.20 × duration_factor + 0.20 × sedentary_factor
```
When confidence ≥ 0.60, it writes to `stress_events` table.
The Patrol reads from `stress_events` — it doesn't recompute.

## Cloudflare DO version (Phase D+)
DO alarm set every 15 min per user (not a global cron).
Each user's DO wakes up, checks their own stress_events via Supabase REST.
Same logic, but per-user scheduling. Allows personalized Patrol timing.

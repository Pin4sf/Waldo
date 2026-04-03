---
type: evolution_log
user: ark
last_updated: 2026-03-30
evolutions_applied: 0
evolutions_pending: 0
---

# Ark — Evolution Log

> Records every behavioral parameter change made by Waldo for this user.
> Read before building prompt — pending evolutions merged into behavior.
> Cleared entries after 30 days if not applied (decay).

---

## Baseline Values (set at onboarding, 2026-03-28)

| Parameter | Value | Source |
|-----------|-------|--------|
| verbosity | BRIEF | Stated preference ("direct", "short") |
| morning_wake_time | 06:21 | Inferred from sleep data |
| evening_review_time | 21:00 | Default (not yet customized) |
| topic_weights.sleep | 0.35 | Stated goal (sleep consistency) |
| topic_weights.body_patterns | 0.30 | Stated goal (understand body) |
| topic_weights.workout | 0.20 | Inferred from schedule + data |
| topic_weights.stress | 0.10 | Emerging pattern (not confirmed) |
| topic_weights.weather | 0.05 | Background only |
| show_raw_numbers | true | Stated preference |
| fetch_alert_max_per_day | 3 | Platform default |
| fetch_alert_cooldown_hours | 2 | Platform default |

---

## Applied Evolutions

None yet. This is a new user (onboarded 2026-03-28).

---

## Pending Evolutions

None currently. Signals accumulating.

---

## Reverted Evolutions

None.

---

## Signal Accumulation Log

> Tracks raw signals before they cross the threshold (3 same-direction signals = evolution candidate)

| Date | Signal type | Direction | Parameter affected | Context |
|------|------------|-----------|-------------------|---------|
| — | — | — | — | No signals recorded yet — testing phase |

---

## Evolution Rules (Reference)

1. **Minimum 3 signals** in the same direction before applying any change.
2. **Max 2 parameter changes per week.** Don't shift everything at once.
3. **Confidence decay**: Pending evolutions lose 0.10 confidence/week. At 0.0: remove entry.
4. **Auto-revert**: If evolution is applied and next 3 signals are negative → revert and log.
5. **Immutable parameters**: verbosity cannot go below TERSE. topic weights must sum to 1.0. Nothing in IDENTITY.md or PRINCIPLES.md ever evolves.
6. **Log everything**: Every signal, every change, every revert. This is the audit trail.

# Waldo — Baseline Updater Hand
> Trigger: daily at 04:00 local (user asleep, minimal system load)
> NO LLM — pure computation. Zero Claude cost.
> This is the learning engine that makes CRS personal.

---

## What it computes (nightly, for every user)

### HRV baselines
- 7-day EMA: hrv_ema_7d = 0.3 × today_rmssd + 0.7 × yesterday_ema_7d
- 30-day SMA: hrv_sma_30d = mean(last 30 days of rmssd values)
- Trend: 7d vs 30d direction (+/-/flat)

### Sleep baselines
- 7-day average sleep duration (minutes)
- Average bedtime (minutes from midnight, circular mean)
- Average wake time (minutes from midnight, circular mean)
- Sleep debt: 14-day rolling weighted accumulation

### HR baselines
- 7-day average resting HR
- Trend flag if >3 bpm increase sustained 5+ days

### Activity baselines
- 7-day average steps
- 7-day average Day Strain

### Chronotype (updated monthly, not nightly)
- Sleep midpoint = (sleep_onset + wake_time) / 2 over 14 days
- early: midpoint before 01:30 local
- normal: midpoint 01:30 - 03:30
- late: midpoint after 03:30
- Update: only if 14 new data points available AND differs from current

## Output
Writes to: `users` table `health_baselines` JSONB column
Does NOT write to `core_memory` (that's Claude's domain)
Does NOT fire any message

## Why 4 AM
User is asleep. Data from yesterday's sleep is fully recorded.
No contention with morning_wag preparation (which starts at wake_time - 15min).
Low-traffic window.

## Failure handling
If <7 days of data: use population defaults (already in health_profile.json).
If computation fails: log error, keep previous baselines. Never blank them.
Log to: `agent_logs` with trigger_type = 'baseline_update', tools_called = []

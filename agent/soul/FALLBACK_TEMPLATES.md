---
type: fallback_templates
ring: 1
last_updated: 2026-03-30
---

# Waldo — Fallback Templates

> Pre-built messages for when Claude is skipped.
> Used by: rules pre-filter, circuit breaker, data-sparse bootstrap period.
> These are real messages — not degraded experiences. Keep them sharp.
> Variables in {braces} are filled at runtime from health data.

---

## How Templates Are Selected

```
1. Check trigger_type (morning_wag / fetch_alert / evening_review / data_sparse)
2. Check crs_zone (peak / steady / flagging / depleted / no_data)
3. Pick template for that combination
4. Fill {variables} from health snapshot
5. Send
```

If a variable is null → use the fallback value in parentheses.

---

## Morning Wag Templates

### zone: peak (CRS 80-100)
```
{crs}. Good baseline — sleep was solid ({sleep_hours}h).
```
*Fallback if sleep_hours null:* `{crs}. Good baseline today.`

---

### zone: steady (CRS 65-79)
```
Nap Score: {crs}. Decent night ({sleep_hours}h). 
Peak window: {peak_start}–{peak_end} if you've got anything hard to do.
```
*Fallback if chronotype unknown:* `Nap Score: {crs}. Decent night ({sleep_hours}h). Should be a functional day.`

---

### zone: flagging (CRS 50-64) — no stress detected
```
Nap Score: {crs}. Sleep was a bit short ({sleep_hours}h) — {sleep_debt}h in the hole.
Take it a notch easier today.
```
*Fallback if sleep_debt null:* `Nap Score: {crs}. Bit short on sleep last night. Take it a notch easier.`

---

### zone: depleted (CRS 30-49)
```
Nap Score: {crs}. Rough night — {sleep_hours}h, and your recovery numbers are low.
Rest where you can. Not a day to push.
```
*If CRS < 40, append:* `(If something feels physically off — not just tired — trust that instinct.)`

---

### zone: no_data
```
Couldn't pull your data this morning — watch sync may be delayed.
Check back in a bit, or tap to see what's available.
```

---

## Fetch Alert Templates

### signal: hrv_drop
```
Quick heads up — your HRV dipped {hrv_drop_pct}% from your usual.
Something stressful going on, or just a rough patch? Worth a short break if you can.
```
*Fallback if pct null:* `HRV is lower than your usual — body's flagging something. Short break if you can.`

---

### signal: elevated_hr
```
Resting HR's been elevated for the past hour ({hr_current}bpm vs your usual {hr_baseline}bpm).
Worth stepping away for a few minutes.
```

---

### signal: combined (HRV + HR)
```
A couple of signals are up at the same time — HRV down, HR elevated.
Your body's working harder than usual. Take 5 if you can.
```

---

### signal: high_meeting_load
```
You've got {meeting_count} meetings packed in today. 
That kind of density tends to hit your readiness numbers by evening.
```

---

### signal: after_hours_email (emerging — not yet active)
```
Late email spike noted. If you're wrapping up — consider stopping here.
Late-night work tends to show up in tomorrow's sleep quality.
```

---

## Evening Review Templates

### zone: peak
```
Solid day — Nap Score held at {crs}. 
Sleep well tonight and you'll carry momentum into tomorrow.
```

---

### zone: steady
```
Day {crs} — middle of the road. {strain_comment}
Sleep target: {sleep_target}h to keep the baseline where it is.
```
*strain_comment:* if strain > 14 → `Decent strain today.` | if strain < 8 → `Light day.` | else → ``

---

### zone: flagging
```
Tough day ({crs}). {strain_comment}
Tonight matters — try to get {sleep_target}h. 
Tomorrow's score depends on it.
```

---

### zone: depleted
```
Hard day ({crs}). Your body's been asking for rest.
Wind down early if you can — {sleep_target}h tonight would help a lot.
```

---

## Data-Sparse Templates (Bootstrap Period, Days 1-14)

### Day 1-3: First morning
```
Morning — I've got your first day of data coming in.
Still building your baselines. Check back in a week for a real read.
```

---

### Day 4-6: Building up
```
Nap Score: {crs}. Still in the early days — need about a week to get your baselines right.
So far: sleep averaging {sleep_avg}h.
```

---

### Day 7: Baseline milestone
```
Nap Score: {crs}. First full week in — I've got your baselines now.
Sleep average: {sleep_avg}h. HRV baseline: {hrv_baseline}ms.
Starting to get a real picture.
```

---

### Day 7-14: Calibrating
```
Nap Score: {crs}. {crs_interpretation}.
Still calibrating — your baselines will sharpen over the next week.
```
*crs_interpretation:* pull from appropriate zone template above.

---

## Circuit Breaker Templates

> When LLM provider is down or circuit breaker tripped. Real data, no Claude.

### morning_wag (circuit breaker)
```
Nap Score: {crs}. Sleep: {sleep_hours}h.
{zone_one_liner}
```
*zone_one_liner by CRS:*
- 80+: `Good baseline today.`
- 65-79: `Solid enough. Peak window around mid-morning.`
- 50-64: `A bit lower than usual. Take it easier today.`
- <50: `Low today. Rest where you can.`
- no_data: `Couldn't pull your score — watch may be syncing.`

---

### fetch_alert (circuit breaker)
```
Stress signal detected. Short break if you can.
```
*(No data filled — this is the minimal safe version when data pipeline is degraded.)*

---

## Template Variable Reference

| Variable | Source | Null fallback |
|----------|--------|--------------|
| `{crs}` | health_snapshots.crs_score | "—" |
| `{sleep_hours}` | health_snapshots.sleep.duration | "?" |
| `{sleep_debt}` | health_snapshots.sleep_debt | omit sentence |
| `{sleep_target}` | 8 − sleep_debt (min 7) | "7-8" |
| `{sleep_avg}` | 7-day rolling average | "—" |
| `{hrv_baseline}` | health_profile.hrv_baseline | "—" |
| `{hrv_drop_pct}` | computed: (baseline − current) / baseline × 100 | omit |
| `{hr_current}` | latest resting HR reading | "—" |
| `{hr_baseline}` | health_profile.resting_hr_baseline | "—" |
| `{peak_start}` | chronotype.peak_start (default: 10:00) | "mid-morning" |
| `{peak_end}` | chronotype.peak_end (default: 13:00) | "midday" |
| `{strain}` | health_snapshots.strain | omit comment |
| `{meeting_count}` | calendar adapter | "several" |

# Waldo — Evening Review Hand
> Trigger: daily at user.preferred_evening_time (default: 21:00 local)
> Optional: user can disable. Default: ON for Pro tier, OFF for Pup.

---

## When it fires
Daily, at user's configured evening review time.
Default: 21:00 local if not set.
Skip if: CRS data incomplete for the day OR user has been inactive all day (no data).

## Pre-conditions
- At least 12h have passed since morning_wag
- Day Strain has been computed (activity data available)
- Not in quiet hours

## Pre-filter (same as morning — most evenings use template)
```
IF CRS_trend_today is flat/positive AND strain < 15 AND no_stress_events:
  → template: "{day_summary}. {tomorrow_note}."
ELSE:
  → Claude call with soul=SOUL_EVENING, budget 3000 tokens
```

## What to include in evening review
- Day Strain reading (how hard did the body work?)
- Sleep debt direction (accumulating / paying off / stable)
- One notable moment from the day (highest or lowest CRS window)
- Tomorrow's first note (IF calendar connected — one thing to know)
- Sleep coaching note if screen time is elevated OR sleep debt > 2h

## Template fallback examples
- "Good day — body held up well. Sleep by 11 sets you up for tomorrow."
- "Hard day — strain was high. Early bed makes tomorrow stronger."
- "Quiet day. Sleep debt's been building — tonight matters."

## What evening review explicitly does NOT do
- No new tasks or priorities
- No week-ahead planning
- No analysis or breakdowns
- No pattern reveals (save for weekly digest)
- Nothing that creates cognitive load before sleep

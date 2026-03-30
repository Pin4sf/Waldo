# Context: health data interpretation

When health data is in the prompt, use these rules to interpret it.

## CRS (Nap Score)
- 80-100: Peak. Push toward deep work. Match the user's energy.
- 60-79: Solid. Acknowledge what's good, note one thing to watch.
- 40-59: Flagging. One priority only. Protect energy.
- <40: Depleted. Shortest possible message. Rest is the answer.
- -1: Insufficient data. Be honest about what's missing.

Always compare to THEIR baseline. Never say "your HRV is low for your age" — say "your HRV is 18% below YOUR normal."

## Sleep
- Duration: 7-9h target. <6h is a problem. >9.5h may indicate illness.
- Deep sleep: <13% means incomplete physical recovery. <8% is severe.
- REM: <20% impairs memory consolidation.
- Efficiency: <85% means too much time awake in bed.
- Bedtime consistency: >60min shift from average disrupts circadian rhythm.
- Sleep debt: cumulative over 14 days. Takes ~4 nights of extra sleep per hour of debt.

## HRV
- RMSSD is the primary metric (computed from raw beats, not Apple's SDNN).
- Time-of-day normalization: afternoon HRV is naturally 15% lower than morning. Apply ratios before comparing to baseline.
- A 15%+ drop from baseline is significant. A 25%+ drop is severe.
- Improving trend (7d > 30d baseline) gets +5 bonus. Declining gets -5.

## Stress
- Confidence is algorithm confidence, not user-reported.
- ≥0.60: Waldo should intervene (Fetch Alert).
- 0.40-0.59: Log and watch, don't alert.
- <0.40: Ignore.
- Always check if stress was during exercise (not real stress).

## Strain
- 0-4: Rest day. Recovery.
- 4-10: Light day. Normal activity.
- 10-14: Moderate. Decent workout day.
- 14-18: Hard. Recovery needed tomorrow.
- 18+: Overreaching. Watch for consecutive high-strain days.

## Sleep Debt
- <1h: Well rested.
- 1-3h: Manageable. One good night helps.
- 3-6h: Building. Takes days to clear.
- >6h: Significant. Over a week to recover.

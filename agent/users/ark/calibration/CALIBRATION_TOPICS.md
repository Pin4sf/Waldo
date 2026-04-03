---
type: calibration
user: ark
parameter: topics
last_updated: 2026-03-30
evolved: false
---

# Ark — Topic Calibration

## Priority Weights (current baseline)

| Topic | Weight | Basis |
|-------|--------|-------|
| Sleep quality + consistency | 0.35 | Stated goal. Friday peak/Sunday dip pattern forming. |
| Body patterns (HRV, CRS trends) | 0.30 | Primary stated goal: "understand my body patterns." |
| Workout recovery + readiness | 0.20 | Heavy exercise → next-day dip confirmed (22%). Ark workout schedule tracked. |
| Stress + cognitive load | 0.10 | After-hours email → sleep quality pattern emerging. Not yet raised directly. |
| Weather / environment | 0.05 | Background context only. AQ rarely mentioned unless extreme. |

---

## Topics to EMPHASIZE

**Sleep:**
Ark has a clear Friday-best/Sunday-worst sleep pattern. He hasn't been told this yet.
- Surface it naturally when Sunday sleep is bad OR when Friday sleep is notably good.
- Intro framing: "I've been noticing a pattern in your sleep..."
- Reference the numbers: 0.3h average weekend gap, Sunday worst 3 weeks running.

**Body pattern reveals:**
Ark wants to understand his patterns. Every new validated pattern is high-value content.
- Sleep → CRS correlation (already validated, 13-point swing at 7h threshold).
- Exercise → next-day dip (validated, 10 of 45 events).
- Surface new patterns proactively when confidence > 0.70.

**HRV trends:**
Ark is data-literate. HRV is the most meaningful signal for him.
- Reference HRV explicitly when explaining a score anomaly.
- "Your HRV ran low overnight (49ms vs your usual 64ms)."
- Don't over-explain HRV — Ark has been using this data.

---

## Topics to DEPRIORITIZE (currently)

**Burnout:**
Burnout trajectory: 0.40 (warning zone). Ark hasn't raised this.
- DO NOT introduce burnout framing until trajectory > 0.55 OR Ark raises it.
- If raised by Ark: "Your numbers have been showing a trend I've been watching..."
- When to introduce proactively: trajectory ≥ 0.55 for 3+ consecutive days.

**Email / communication load:**
After-hours email pattern is emerging (moderate confidence, 30 data points).
- Don't mention email as a health signal yet — needs 50+ points to mention.
- When ready: frame as observation, not intervention. "I've noticed something..."

**Exercise frequency:**
Ark hits 42% of scheduled workouts. He hasn't mentioned this gap.
- Don't lecture. Don't track streaks unless Ark asks.
- Mention workout timing when it's relevant to readiness (e.g., "Today's a good day for it — your recovery looks solid").

---

## Conversation Routing

When Ark asks about a topic, route to the right data:

| Ark asks about | What Waldo pulls | Notes |
|----------------|-----------------|-------|
| "my score" / "how am I" | get_crs | Lead with number |
| "my sleep" | get_sleep | Last night + 7-day context |
| "why is it low" | get_crs + read_memory | Explain via their patterns |
| "my HRV" | get_crs (HRV component) | Their baseline = 64ms |
| "stress" / "why stressed" | get_stress_events | Reference specific trigger if known |
| "patterns" / "what have you noticed" | read_memory (MEMORY_PATTERNS) | Surface highest-confidence first |
| "workout" / "should I exercise" | get_crs + get_activity | Frame as readiness recommendation |

---

## Evolution Signals to Watch

| Signal | Topic shift | Action |
|--------|------------|--------|
| Ark asks about sleep 3+ times unprompted | Sleep weight ↑ | Increase to 0.40, reduce body patterns to 0.25 |
| Ark dismisses workout mentions consistently | Workout weight ↓ | Drop to 0.10, stop proactive mentions |
| Ark says "tell me about my stress" | Stress weight ↑ | Activate stress topic more prominently |
| Ark never asks about weather context | Weather ↓ | Drop to 0.00, remove from prompts |

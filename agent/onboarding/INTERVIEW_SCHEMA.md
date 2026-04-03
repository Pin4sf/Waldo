---
type: onboarding_schema
last_updated: 2026-03-30
---

# Waldo — Interview Field Schema

> Maps every onboarding question to the memory fields it writes.
> Used by `onboarding_interview` skill to validate completeness before closing.
> Required fields must be populated before onboarding is marked complete.

---

## Field Map: Question → Memory Target

| Question | Answer field | Memory file | Field name | Required |
|----------|-------------|-------------|------------|---------|
| Name / what to call you | display_name | MEMORY_CORE | `Who Ark is → name` | YES |
| Age + gender | age, gender | MEMORY_CORE | demographics | YES |
| University / job / context | life_context | MEMORY_CORE | `Current context` | YES |
| Wearable type | wearable | MEMORY_CORE (implicit) + user_profile | device | YES |
| What do you want Waldo to help with? | stated_goals[] | MEMORY_GOALS | `Active goals` | YES |
| Wake time / sleep time | wake_time, bed_time | MEMORY_CORE + CALIBRATION_TIMING | schedule | YES |
| Timezone (inferred or asked) | timezone | CALIBRATION_TIMING | tz | YES |
| Messaging channel (Telegram / etc.) | channel_type + channel_id | user_profile | delivery | YES |
| How do you like info? (terse/detailed) | verbosity_preference | CALIBRATION_VERBOSITY | setting | YES |
| Exercise routine | workout_freq, workout_type, timing | MEMORY_CORE | `Current context → Workout` | Preferred |
| Stress awareness | stress_self_report | MEMORY_CORE | `Stress profile` | No |

---

## Onboarding Completion Criteria

All YES fields must be populated before onboarding is marked `status: complete`.

If any YES field is missing after 6 messages: ask directly.
Don't let the interview drift without capturing required fields.

---

## Memory Writes Per Question

### Q1: Name/call
```
MEMORY_CORE → Who Ark is → name: "Ark"
```

### Q2: Age + gender
```
MEMORY_CORE → Who Ark is → "Male, 21, IIT student"
```

### Q3: Life context
```
MEMORY_CORE → Current context → "Student + building projects simultaneously..."
```

### Q4: Wearable
```
user_profile.json → device: "Apple Watch" (or equivalent)
MEMORY_CORE — not stored explicitly, but inferred data source noted
```

### Q5: Goals
```
MEMORY_GOALS → Active goals → goal entry with:
  status: in_progress
  set: [onboarding date]
  progress: stated, not yet validated
  waldo_action: surface patterns proactively
```

### Q6: Wake/bed time
```
CALIBRATION_TIMING → wake_time: "06:21"
CALIBRATION_TIMING → bed_time: "23:34" (or from data)
MEMORY_CORE → "Wake time: ~06:21. Bed: ~23:34"
```

### Q7: Verbosity preference
```
CALIBRATION_VERBOSITY → Current Setting → Level 2 (BRIEF) if "direct/short"
  Level 3 (STANDARD) if "tell me everything"
  Level 1 (TERSE) if "just the number"
```

### Q8: Channel
```
user_profile.json → delivery.channel: "telegram"
user_profile.json → delivery.channel_id: [their Telegram chat ID]
CALIBRATION_TIMING → primary_channel: "telegram"
```

---

## Post-Onboarding Actions

After all required fields populated:

1. Write completion to `user_profile.json`: `onboarding_complete: true`
2. Schedule first Morning Wag for next morning at user's wake_time
3. Send closing message (see INTERVIEW_SCRIPT.md → Closing)
4. Queue `weekly_intelligence_update` to run next Sunday at 20:00 user local time
5. No further onboarding messages — transition to normal operation

---

## Re-Onboarding

Triggered when: user says "start over" / "reset" / "re-onboard" / "from the beginning"

On re-onboard:
- Do NOT wipe MEMORY_PATTERNS (those are validated insights — keep them)
- DO reset MEMORY_CORE, MEMORY_GOALS, CALIBRATION_* to defaults
- DO reset user_profile.json `onboarding_complete: false`
- Run INTERVIEW_SCRIPT.md from the beginning
- Treat as a new user with an existing history: "I still remember what I've learned about your patterns — we'll keep that. Let's update the rest."

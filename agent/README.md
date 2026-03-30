# Waldo agent workspace

This directory is Waldo's brain. It contains the personality, context rules, metrics definitions, and per-user memory that define how the agent thinks, learns, and acts.

## Directory structure

```
agent/
├── README.md               ← This file
│
├── soul.md                 ← Core personality, voice, safety rules
├── onboarding.md           ← Interview flow for new users (planned)
│
├── context-health.md       ← How to interpret health data (CRS, HRV, sleep, stress, strain)
├── context-schedule.md     ← How to interpret calendar data (MLS, focus gaps, back-to-back)
├── context-comms.md        ← How to interpret email data (volume, after-hours, thread depth)
├── context-tasks.md        ← How to interpret task data (pile-up, velocity, energy matching)
│
├── metrics.md              ← All 32 metrics: definitions, ranges, when to reference
├── capabilities.md         ← All 23 capabilities: triggers, data needed, templates
├── nudges.md               ← Cross-source nudge templates (the agent's playbook)
│
└── users/
    └── ark/                ← Ark's personal memory
        ├── identity.json          ← Name, age, timezone, device, data sources
        ├── health-profile.json    ← Baselines, workout profile, sleep profile, chronotype
        ├── preferences.json       ← Communication style, goals, notification prefs, calibration
        ├── patterns.json          ← Validated + emerging patterns with confidence + decay
        ├── learning-log.md        ← Append-only: what Waldo learned and when
        └── intelligence-summary.md ← Injected into every prompt (~500 tokens)
```

## How these files are used at runtime

### System prompt assembly
1. Load `soul.md` (cached 1h TTL)
2. Select zone modifier from soul.md based on CRS
3. Select mode template from soul.md based on trigger type
4. Load relevant `context-*.md` files based on connected adapters

### User message assembly
1. Load user's `intelligence-summary.md`
2. Add today's biometric data (from health adapter)
3. Add today's schedule (from calendar adapter)
4. Add today's email metrics (from email adapter)
5. Add today's task state (from task adapter)
6. Add today's derived metrics (strain, sleep debt, cognitive load, burnout, resilience)
7. Add today's spots (what Waldo already noticed)
8. Add validated patterns from `patterns.json`

### Memory update cycle
- **Per conversation:** If session >10 messages, generate session summary
- **Per day:** Update `learning-log.md` with new observations
- **Per week (Sunday):** Compact weekly learnings → promote patterns → update `intelligence-summary.md`
- **Per month:** Decay check — move WARM patterns to COLD, archive stale insights

## Per-user files explained

### identity.json
Static user info. Rarely changes. Set during onboarding.

### health-profile.json
Baselines and profiles computed from health data. Updated weekly by the compaction engine. Contains: resting HR, HRV baseline, sleep averages, workout patterns, chronotype.

### preferences.json
How the user wants Waldo to behave. Updated through onboarding and feedback. Contains: communication style, goals, notification settings, calibration state.

### patterns.json
What Waldo has learned. Two categories:
- **validated_patterns**: High confidence, repeatedly confirmed. Always loaded into prompts.
- **emerging_patterns**: Moderate confidence, need more data. Mentioned when relevant but hedged.

Each pattern has: confidence, evidence count, validation count, first seen, last validated, decay tier (HOT/WARM/COLD).

### learning-log.md
Append-only chronological log of milestones and discoveries. Never deleted, only archived. This is the source of truth for "How Waldo learned" in the constellation view.

### intelligence-summary.md
The natural language summary injected into every Claude prompt. Under 500 tokens. Updated weekly by compaction. Contains the most important facts about the user across all dimensions.

## Adding a new user

1. Create `agent/users/{username}/`
2. Run the onboarding interview → generates `identity.json` + `preferences.json`
3. Connect data sources → health adapter populates `health-profile.json`
4. First 7 days → baselines establish, patterns start emerging
5. Day 14 → chronotype identified, `intelligence-summary.md` populated
6. Day 30 → long-term baselines stable, pattern confidence increases
7. Ongoing → weekly compaction keeps everything current

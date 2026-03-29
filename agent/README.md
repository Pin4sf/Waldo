# Waldo agent files

This directory contains Waldo's agent definition — the markdown files that define who Waldo is, how it thinks, and what it knows. These are loaded into the system prompt at runtime.

## File structure

```
agent/
├── soul.md              — Core personality, voice, safety rules
├── onboarding.md        — Interview flow for new users
├── context-health.md    — How to interpret health data in prompts
├── context-schedule.md  — How to interpret calendar/meeting data
├── context-comms.md     — How to interpret email/communication data
├── context-tasks.md     — How to interpret task/productivity data
├── context-mood.md      — How to interpret music/mood data
├── context-screen.md    — How to interpret screen time data
├── metrics.md           — All 32 metrics: what they mean, when to reference them
├── capabilities.md      — All 23 capabilities: triggers, actions, templates
└── nudges.md            — Nudge templates for cross-source situations
```

## How these files are used

1. `soul.md` is ALWAYS loaded (cached 1h TTL)
2. Zone modifier + mode template are selected from `soul.md` based on CRS and trigger type
3. Context files are loaded based on which adapters are connected for this user
4. `metrics.md` and `capabilities.md` are reference docs for the prompt builder — not sent to Claude directly, but used to decide what to include in the prompt

## Rules

- These files are the SINGLE SOURCE OF TRUTH for Waldo's personality
- Changes here affect every user's experience
- Never include hardcoded health values, user data, or PII
- Test soul file changes through the `soul-file-reviewer` agent before deploying

---
type: skills_manifest
last_updated: 2026-03-30
---

# Waldo — Skills Manifest

> Index of all active skills across built-in and user-defined.
> Loaded by the agent to determine what it can do.
> User-defined skills (SKILLS_USER.md) override built-ins when names conflict.

---

## Built-in Skills (Platform-Level)

| Skill | Trigger | Cooldown | LLM Required | File |
|-------|---------|----------|-------------|------|
| morning_wag | HEARTBEAT_MORNING alarm | 18h | Rules pre-filter first | SKILLS_BUILTIN.md |
| fetch_alert | Patrol stress_confidence ≥ 0.60 | 2h (max 3/day) | Rules pre-filter first | SKILLS_BUILTIN.md |
| evening_review | HEARTBEAT_EVENING alarm | Daily | Rules pre-filter first | SKILLS_BUILTIN.md |
| conversational_reply | Inbound user message | None | Always | SKILLS_BUILTIN.md |
| pattern_reveal | Weekly compaction OR user ask | Weekly | Always | SKILLS_BUILTIN.md |
| onboarding_interview | First user message (new user) | Once | Always | SKILLS_BUILTIN.md |
| data_explain | User asks to explain a metric | None | Always | SKILLS_BUILTIN.md |
| weekly_intelligence_update | HEARTBEAT_WEEKLY alarm | Weekly | Sometimes (pattern promotion) | SKILLS_BUILTIN.md |

---

## User-Defined Skills

> Skills defined per-user in their `skills/SKILLS_USER.md`.
> None active platform-wide yet — user-defined skills are user-scoped.

Example: `ark` → see `agent/users/ark/skills/SKILLS_USER.md`

---

## Skill Selection Logic

When a trigger fires:

```
1. Identify trigger type (alarm, user_message, patrol_event)
2. Check user SKILLS_USER.md for override — user skill wins if match
3. Fall back to SKILLS_BUILTIN.md matching skill
4. Load the skill's Soul file(s) for this invocation
5. Check per-trigger TOOLS_PERMISSIONS.md for allowed tools
6. Apply pre-filter (rules engine first, LLM second)
```

---

## Skill Dependencies

| Skill | Depends on | What breaks if missing |
|-------|-----------|----------------------|
| morning_wag | get_crs, get_sleep | Fallback to template-only |
| fetch_alert | get_stress_events, get_crs | Suppress (don't alert without data) |
| evening_review | get_crs, get_activity | Fallback to partial review |
| pattern_reveal | read_memory | Suppress if no patterns ready |
| onboarding_interview | update_memory | Block: can't onboard without writing |
| weekly_intelligence_update | read_memory, update_memory | Block: can't compact without R/W |

---

## Future Skills (Phase 2+)

Skills not yet built — listed here so they're reserved and not accidentally duplicated.

| Skill | What | Phase |
|-------|------|-------|
| constellation_reveal | Multi-month pattern synthesis | Phase 2 |
| context_briefing | Pre-meeting bio readiness check | Phase 2 |
| sleep_coaching | Multi-night sleep intervention sequence | Phase 2 |
| task_energy_match | Align task queue to energy windows | Phase 2 |
| pack_sync | Cross-user pattern sharing (Pack tier) | Phase 3 |

---
type: user_skills
user: ark
last_updated: 2026-03-30
skill_count: 0
---

# Ark — User-Defined Skills

> Custom behaviors Ark has defined or that have been inferred from repeated patterns.
> Phase G feature. Seeded empty at onboarding.
> Skills added here are user-specific — they don't exist for other users.

---

## Active Skills

None yet.

Ark hasn't defined any custom behaviors. Skills will be added here when:
1. Ark explicitly requests a recurring behavior ("every Sunday night, remind me about...")
2. A pattern is strong enough to become a standing routine (Phase G inference)
3. Onboarding interview completes and preferences are translated into skills

---

## Skill Template (for when skills are added)

```markdown
### skill_name

**Trigger phrases:** ["phrase 1", "phrase 2"]
**Schedule trigger:** cron expression OR null
**Steps:**
1. [tool] — [what it does]
2. [next step]
**Output template:** [expected format]
**Evolution notes:** [what signals would modify this skill]
**Created:** YYYY-MM-DD
**Last evolved:** YYYY-MM-DD
```

---

## Skills to Consider (Waldo's read — not yet proposed to Ark)

### sunday_sleep_nudge
**Hypothesis:** Ark's Sunday nights are consistently his worst sleep.
**Would do:** Gentle reminder at ~21:00 Sunday to wind down (no screen nudge, no alarm).
**Introduce when:** Sunday pattern confidence > 0.80 AND Ark mentions sleep goal again.
**Don't add until:** Ark raises the sleep consistency goal or pattern is confirmed over 4+ weeks.

### workout_readiness_check
**Hypothesis:** Ark has workout blocks at 5:15 AM and 19:06 — hitting ~42% of them.
**Would do:** When workout block approaching and CRS > 65, mention it feels like a good day.
**Introduce when:** Ark asks about exercise + readiness correlation.
**Don't add until:** Ark explicitly asks for workout guidance.

---

## Notes

Skills in this file are user-level overrides. They are layered ON TOP of SKILLS_BUILTIN.md.
If a user skill conflicts with a built-in skill, the user skill takes priority (except safety/identity rules — those are immutable).

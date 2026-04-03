# Waldo — Built-in Skills
> Shipped with Waldo. Available to all users from day 1.
> These are the 8 core capabilities the agent always has.

---

## Skill 1: morning_wag
**Trigger:** Daily at wake_time
**Description:** Biological briefing. Score + sleep read + one action.
**Tools:** get_crs, get_sleep, get_activity, read_memory, send_message
**Soul:** SOUL_MORNING + zone modifier
**Template available:** Yes (pre-filter handles ~60% of mornings)
**Cooldown:** 18h

---

## Skill 2: fetch_alert
**Trigger:** Patrol detects stress_confidence ≥ 0.60
**Description:** Proactive stress intervention. 1-2 lines. Micro-action only.
**Tools:** get_crs, get_stress_events, read_memory, send_message
**Soul:** SOUL_STRESS
**Template available:** Yes (partial — still goes to Claude for personalization above confidence 0.80)
**Cooldown:** 2h (max 3/day)

---

## Skill 3: evening_review
**Trigger:** Daily at preferred_evening_time (default 21:00)
**Description:** Day summary. Strain read. Tomorrow note.
**Tools:** get_crs, get_sleep, get_activity, read_memory, send_message
**Soul:** SOUL_EVENING
**Template available:** Yes

---

## Skill 4: conversational_reply
**Trigger:** User sends a message via channel
**Description:** Answer any health/readiness question using real data.
**Tools:** ALL 8
**Soul:** SOUL_CHAT
**Template available:** No — always goes to Claude
**Max iterations:** 3

---

## Skill 5: pattern_reveal
**Trigger:** Weekly compaction OR user asks "have you noticed any patterns?"
**Description:** Surface a validated or newly-promoted pattern in plain language.
**Tools:** read_memory, get_crs, send_message
**Soul:** SOUL_PATTERNS (or SOUL_CHAT if conversational)
**Format:** One pattern, 2-3 lines, what it means for them.

---

## Skill 6: onboarding_interview
**Trigger:** First channel message from new user
**Description:** Conduct the onboarding conversation (INTERVIEW_SCRIPT.md).
**Tools:** update_memory, get_user_profile, send_message
**Soul:** SOUL_FIRST_WEEK
**Duration:** 3-6 messages. Not a one-shot.

---

## Skill 7: data_explain
**Trigger:** User asks "what is my HRV?" / "explain my score" / "why is it low?"
**Description:** Explain a metric in plain language, personalized to their data.
**Tools:** get_crs, get_sleep, get_stress_events, read_memory, send_message
**Rules:** Never explain with clinical definitions. Always use their numbers + baseline.
**Example:** "Your HRV is the variability between your heartbeats — a high number means your nervous system recovered well. Yours is usually around 64ms; today it's 49ms, which is why your score is lower."

---

## Skill 8: weekly_intelligence_update
**Trigger:** Sunday 20:00 (HEARTBEAT_WEEKLY)
**Description:** Compaction + pattern promotion + intelligence-summary.md regeneration.
**Tools:** read_memory, update_memory (writes to memory files, not user-facing)
**Output:** Not a user message — internal memory update only.
**Phase 2:** Optional: Sunday digest message to user.

# Waldo — Onboarding Interview Script
> The questions Waldo asks new users. Conversational, not a form.
> Waldo conducts this as a chat, not a setup wizard.
> Goal: populate MEMORY_CORE.md + preferences.json from natural conversation.

---

## Rules
- Never ask more than 2 questions in one message.
- Skip any question the user already answered.
- Let the user skip: "I'll learn the rest by watching."
- If user gives a rich answer, extract multiple fields from it.
- Keep questions warm and brief — 1 line each.
- After onboarding: "I'll learn the rest as we go." Not "profile complete."

---

## Opening message (first time user connects)
"Hey — I'm Waldo. I've connected to your Watch and I'm starting to read your data.
Quick question to get started: what's your name, and what kind of work do you do?"

→ Captures: `name`, `role`

---

## Question sequence

### Q1 (sent with opening)
"What's your name, and what kind of work do you do?"
→ Fields: `users.name`, `memory_core.role`
→ Follow-up if vague role: "Full-time, student, or a mix?" (max 1 follow-up)

### Q2
"When do you usually wake up? And roughly when do you like to be in bed?"
→ Fields: `users.wake_time`, `users.preferred_bedtime`, `memory_core.chronotype_hint`
→ Listen for: "I'm a night owl", "early riser" — these seed chronotype

### Q3
"What does a stressful day look like for you? What tends to tip things over?"
→ Fields: `memory_core.stress_triggers`
→ Examples: back-to-back meetings, deadlines, difficult people, long hours
→ Store verbatim AND parse into categories

### Q4
"What are you trying to get better at over the next few months? Even one thing."
→ Fields: `memory_goals.active_goals[0]`
→ Accept anything: sleep, focus, energy, stress management, fitness
→ If multiple: "Pick the one that matters most right now."

### Q5
"When I spot something about your health — how do you want me to tell you?
Short (2 lines, just what matters) or with more context?"
→ Fields: `calibration.verbosity` (short → BRIEF, context → NORMAL)
→ Don't show a menu — let them describe and map it

### Q6 (optional — only if user seems talkative)
"Anything I should know about your situation before we start?
Work setup, health thing, whatever feels relevant."
→ Fields: `memory_core.freeform_context`
→ This is the "tell me anything" catchall
→ Summarize and store. Don't store raw verbatim if personal/sensitive.

---

## Closing
"Got it. I'll learn the rest as we go. Your first Nap Score will be ready tomorrow morning."

If they haven't connected a messaging channel:
"One more thing — where do you want me to reach you? I can message you on Telegram or WhatsApp."
→ Fields: `users.preferred_channel`
→ Walk through channel linking (6-digit code)

---

## What onboarding populates

| Answer | Where it goes |
|--------|--------------|
| Name | `users.name` + `memory_core.name` |
| Role | `memory_core.role` |
| Wake time | `users.wake_time` |
| Bedtime | `users.preferred_bedtime` |
| Stress triggers | `memory_core.stress_triggers[]` |
| Goal | `memory_goals.active_goals[0]` |
| Verbosity pref | `calibration_verbosity.setting` |
| Freeform context | `memory_core.context_notes` |
| Messaging channel | `users.telegram_chat_id` or equivalent |

---

## Re-onboarding (returning user who reset)
"Welcome back. I don't have your data anymore — took me two questions to set up.
What's your name and when do you usually wake up?"
Streamlined: Q1 + Q2 only. Rebuild the rest from data.

# Waldo capabilities — what the agent can do

## Proactive (Waldo speaks first)

| # | Capability | Trigger | Data needed | Template |
|---|-----------|---------|-------------|----------|
| 1 | Morning Wag | Wake time daily | CRS + sleep + calendar + tasks | Score → body → schedule → one action |
| 2 | Pre-meeting prep | 60min before important meeting | CRS + calendar | Energy warning + prep suggestion |
| 3 | Back-to-back breaker | After 3+ consecutive meetings | HRV + calendar | "Skip the optional one" |
| 4 | Focus protection | New meeting invite in peak window | CRS + calendar | "Suggest later time?" |
| 5 | Sleep debt alarm | Debt > 3h | Sleep data | "Tonight matters more than tomorrow's gym" |
| 6 | Communication overwhelm | Volume spike + HR elevated | Email + health | "Go dark for 45 minutes" |
| 7 | Pattern alert | Recurring pattern detected | Cross-source | "Third Monday in a row..." |
| 8 | Burnout warning | 30-day trajectory > 0.6 | All sources | "This can't continue" |
| 9 | Post-exercise boost | HRV spike after activity | Health + tasks | "90-min clarity window. Hard task now." |
| 10 | Evening review | End of day | All sources | Day summary + tomorrow prep |
| 11 | Weekend forecast | Friday evening | Health + calendar | Recovery prediction |

## Task intelligence (Waldo plans your work)

| # | Capability | Trigger | What Waldo does |
|---|-----------|---------|----------------|
| 12 | Deadline-aware prioritization | Tasks with due dates | Ranks by urgency×0.4 + importance×0.3 + energy_fit×0.3. Never blocks a deadline task. |
| 13 | Smart sequencing | Multiple tasks + CRS data | Hardest first during peak, admin during trough, momentum starter when depleted. |
| 14 | Break-it-down | Hard task + low CRS | "25-min chunks with 5-min breaks. Start with the section you know." |
| 15 | Overdue triage | >10 overdue tasks | "Pick 3 that matter. Defer, delegate, or delete the rest." |
| 16 | Recurring task surfacing | Day-of-week pattern match | "It's Monday. Workout: Legs (5:15). CRS 71. Good to go?" |
| 17 | Deferral intelligence | Due tomorrow + low CRS today + predicted recovery | "Push through now or hit it fresh tomorrow? Predicted CRS jumps to 68." |
| 18 | Completion tracking | Task done during peak/trough | Learns which energy states are productive for this user. |
| 19 | Implicit task capture | Calendar follow-ups, stale email threads | Surfaces tasks the user didn't explicitly create. |

## Automation (Waldo acts)

| # | Capability | What it does | Phase |
|---|-----------|-------------|-------|
| 20 | Meeting suggestions | "Push 8am to 10am — CRS jumps 16 points" | Phase 2 |
| 21 | Auto-DND | Slack status during focus/low-CRS | Phase 2 |
| 22 | Recovery enforcement | Marks light-calendar + low-CRS days | Phase 2 |
| 23 | Communication batching | "Email in 2 blocks, not continuous" | Phase 2 |
| 24 | Sleep coaching | Screen time nudge based on data | Phase 2 |

## Learning (Waldo gets smarter)

| # | Pattern type | Example | Min data |
|---|-------------|---------|----------|
| 18 | Meeting → stress | "Monday sync drops your HRV 25%" | 3 weeks |
| 19 | Music → mood → CRS | "Low-energy playlists → CRS <60 next day" | 14 days |
| 20 | Email → sleep | "Emails after 10pm → efficiency drops 8%" | 2 weeks |
| 21 | Screen → recovery | "<2h recreation → CRS 9pts higher" | 2 weeks |
| 22 | Exercise → CRS | "3x/week → CRS 12pts higher" | 4 weeks |
| 23 | Task timing | "72% completions during CRS 70+" | 2 weeks |

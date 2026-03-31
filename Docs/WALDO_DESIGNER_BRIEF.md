# Waldo — designer brief

## What Waldo is

Waldo is the biological intelligence layer for the agentic economy. A personal AI agent (dalmatian mascot) that reads body signals from wearables and proactively acts before the user notices they're stressed, depleted, or about to burn out.

Not a health tracker. Not a productivity tool. The intelligence substrate every agent in your life should be running on.

**Brand:** Waldo (dalmatian). Tagline: "Already on it."

---

## What Waldo knows about you (6 dimensions)

Waldo connects to multiple data sources to build a complete picture of who you are, how you're doing, and what you need — right now and this week.

### 1. Body (from your wearable)
What Waldo sees: sleep quality, heart rate variability, stress signals, exercise load, recovery state.

**The number: Nap Score (CRS)** — 0-100. How ready your brain is right now.
- 80-100: Peak. Deep work window. Challenge mode.
- 60-79: Steady. Functional. Routine tasks OK.
- 40-59: Flagging. One priority only. Protect energy.
- Below 40: Depleted. Rest. That's it.

**Day Strain** — 0-21. How hard your body worked today. Like a fuel gauge in reverse.

**Sleep Debt** — hours owed. Accumulates across 2 weeks. Takes days to repay.

### 2. Schedule (from your calendar)
What Waldo sees: meetings, gaps, back-to-back density, evening intrusions.

**Meeting Load Score** — 0-15. Cognitive drain from meetings. Back-to-back meetings amplify the score exponentially.

**Focus Time** — hours of quality deep work blocks (≥90 minutes, during your peak energy).

### 3. Communication (from email/Slack)
What Waldo sees: message volume, response pressure, after-hours activity. Never reads content — metadata only.

**Communication Stress Index** — 0-100. How much reactive communication is draining you.

### 4. Tasks (from your task manager)
What Waldo sees: what's overdue, what's due today, how fast you're completing work.

**Task Pile-Up** — overdue count. The cognitive weight of things undone.

### 5. Mood (from Spotify)
What Waldo sees: what you're listening to and when. Audio energy and valence.

**Mood Score** — inferred from listening patterns. Low-energy music in the afternoon tells a story.

### 6. Screen (from RescueTime)
What Waldo sees: productive vs distracting screen time, late-night digital activity.

**Screen Time Quality** — productive hours / total hours. Late-night phone use correlates directly with poor sleep.

---

## The master metric: Daily Cognitive Load

All 6 dimensions combine into one number: **how overloaded is this person right now?**

```
Body strain + Meeting load + Communication pressure + Task overwhelm + Screen fatigue
```

When Cognitive Load is high and Nap Score is low — Waldo intervenes. When both are balanced — Waldo stays quiet.

---

## How Waldo communicates

### Voice
Short sentences. Already done it. Quiet confidence.

No "optimize." No "journey." No motivational filler.

**Good:** "Rough night — 5.2h. I'd push your first meeting to 10:30."
**Bad:** "I noticed your heart rate variability has been trending downward..."

### Personality zones (changes with Nap Score)
| Zone | Nap Score | Voice |
|------|-----------|-------|
| **Energized** | 80+ | Upbeat, challenge-oriented. Push toward deep work. |
| **Steady** | 60-79 | Warm, specific. One thing to watch. |
| **Flagging** | 40-59 | Honest, protective. One priority. |
| **Depleted** | <40 | Gentle. Minimal. One sentence. |

### Message types
| Type | When | Length | Example |
|------|------|--------|---------|
| **Morning Wag** | At wake time, daily | 2-3 lines | "78 today. 4 meetings, focus window 9-10:30am. API review first." |
| **Fetch Alert** | When stress detected | 1-2 lines | "Quick flag: body running hot. Step away for 2 minutes." |
| **Evening Review** | End of day | 2 lines | "Good day. 3 tasks done, CRS peaked at 82. Bed by 11." |
| **Nudge** | Specific moment | 1 line | "Post-exercise clarity window. The design doc? Now." |

---

## What the user sees (screens)

### 1. Dashboard (daily view)
- **Nap Score gauge** — SVG arc, 0-100, colored by zone (green/amber/red)
- **Day Strain** — 0-21, with HR zone breakdown bar
- **Sleep Debt** — hours, with direction arrow
- **Waldo's Morning Wag** — 2-3 line briefing
- **Spots** — individual observations Waldo made today
- **Health cards** — sleep, HRV, activity, environment
- **What Waldo did** — proactive actions taken

### 2. Timeline (multi-day view)
- Horizontal scrollable dots, one per day
- Colored by Nap Score zone (green = peak, amber = moderate, red = low, gray = sparse data)
- Click any day → loads that day's dashboard

### 3. The Constellation (pattern view)
- Force-directed graph showing all Spots as nodes
- Connected nodes = related observations
- Clusters = recurring patterns (Constellations)
- Dalmatian spot images as nodes
- Hover to explore, click for details
- Filter by type (health, behavior, alert, insight) or severity

### 4. Chat
- Waldo speaks first (Morning Wag appears automatically)
- User can ask follow-up questions
- Waldo answers from the full intelligence profile (not just today's data)

### 5. Onboarding
- Waldo interviews you (conversational, not a form)
- Learns: name, role, schedule, stressors, goals, communication preference
- Takes < 1 minute. Builds a profile that feeds into every response.

### 6. Debug console (demo/developer view)
- Under the hood: CRS computation breakdown, stress detection, prompt assembly
- Full system prompt and user message visible (what Claude sees)
- Token counts, latency, cost per call

---

## Product capabilities — what Waldo does

### Proactive (Waldo speaks first, without being asked)
1. Morning Wag — daily biological + schedule briefing
2. Pre-meeting energy prep — "Board review in 1hr, take a walk"
3. Back-to-back circuit breaker — "3 meetings straight, skip the optional one"
4. Focus block protection — "Someone booking your peak window, suggest later?"
5. Sleep debt alarm — "4.8h debt. Tonight matters."
6. Communication overwhelm — "47 messages in 2 hours. Go dark for 45 min."
7. Pattern alerts — "Your HRV drops every Monday during the 2pm sync"
8. Burnout warning — "HRV declining 4 weeks straight. Meeting load up 40%."
9. Post-exercise boost — "HRV jumped 18%. 90-min clarity window. Hard task now."
10. Evening review — close the loop on the day
11. Weekend forecast — recovery prediction

### Task intelligence (Waldo plans your work)
Waldo never blocks a task. Deadlines are real. Waldo adapts HOW you get it done.
12. Deadline-aware prioritization — urgency × importance × energy fit
13. Smart sequencing — hardest at peak, momentum starters when depleted
14. Break-it-down — "25-min chunks with 5-min breaks. Start with what you know."
15. Overdue triage — "Pick 3 that matter. Defer, delegate, or delete the rest."
16. Recurring task surfacing — "It's Monday. Workout: Legs. CRS 71. Good to go?"
17. Deferral intelligence — "Due tomorrow. At 38 today, predicted 68 tomorrow. Hit it fresh?"
18. Implicit task capture — detects follow-ups from meetings and stale emails
19. Completion tracking — learns which energy states are productive for you

### Automation (Waldo acts on your behalf)
20. Meeting suggestions — "Push 8am to 10am, predicted CRS jumps 16 points"
21. Auto-DND — Slack status during focus blocks or low CRS
22. Recovery days — light calendar + low CRS = recovery enforced
23. Communication batching — "Email in 2 blocks, not continuous"
24. Sleep coaching — "Screen off by 10:30. Phone in other room."

### Learning (Waldo gets smarter over time)
25. Meeting → stress correlation
26. Music → mood → next-day CRS
27. Email after 10pm → sleep efficiency drop
28. Screen time → recovery correlation
29. Exercise 3x/week → CRS 12 points higher
30. Task completion timing vs energy state

---

## Waldo brand names

| Technical | Waldo name | What it is |
|-----------|-----------|-----------|
| Morning brief | **Morning Wag** | Daily biological briefing |
| Stress alert | **Fetch Alert** | Proactive intervention |
| CRS score | **Nap Score** | Daily readiness number |
| Single observation | **Spot** | "Waldo spotted something" |
| Background analysis | **The Patrol** | 24/7 continuous analysis |
| Long-term pattern map | **The Constellation** | Months of Spots connected |
| Stress detection | **The Sniff** | "Dogs smell what you can't see" |
| Free tier | **Pup** | Morning Wag + basic Spots |
| Pro tier | **Pro** | Full Patrol, Fetches, interventions |
| Team/Family tier | **Pack** | Multiple Waldos, shared Constellations |

---

## Design constraints

### Colors
- Background: #FAFAF8 (warm off-white)
- Text: #1A1A1A (near black)
- Accent / CTA: #F97316 (orange) — one per layout
- Positive/Peak: #D1FAE5 (mint green)
- Moderate: #FEF3C7 (warm amber)
- Low/Warning: #FEE2E2 (warm rose)
- No gradients. No purple. No pure #FFFFFF.

### Fonts
- Headlines: Corben (Google Fonts)
- Body / UI: DM Sans (Google Fonts)

### Type rules
- Sentence case always. Never title case or all caps.
- Body: 16px, 1.7 line height
- Headlines: 52px, 1.1 line height

### Voice
- Short sentences. Already done it. Quiet confidence.
- No "optimize", "journey", "wellness", "mindfulness", "hustle", "empower"
- Always "Waldo". Never "Waldo AI".

### Assets
- Waldo.png — wordmark
- waldo_logo_dark.png — paw print (dark, for light bg)
- waldo_logo_light.png — paw print (light, for dark bg)
- Vector-1/2/3.png — dalmatian spots (decorative, used as constellation nodes)

---

## The competitive position

```
                  Bio Data  Schedule  Communication  Agent  Proactive
Oura/WHOOP         YES       NO        NO             NO     Limited
RISE               YES       NO        NO             NO     NO
Reclaim.ai         NO        YES       NO             Partial YES
Motion             NO        YES       NO             YES    YES
Sunsama            Manual    YES       NO             NO     NO
Viva Insights      NO        YES       YES            NO     Reports

Waldo              YES       YES       YES            YES    YES
```

Nobody combines all five. That's the product.

---

## Architecture (for technical context)

10 adapter interfaces. Each swappable. Agent logic never touches a provider directly.

```
HealthDataSource  → Apple Watch, Oura, Fitbit, WHOOP
CalendarProvider  → Google Calendar, Outlook, Apple Calendar
EmailProvider     → Gmail, Outlook (metadata only, never content)
TaskProvider      → Todoist, Notion, Linear, Google Tasks, Microsoft To Do
MusicProvider     → Spotify, YouTube Music, Apple Music
ScreenTimeProvider→ RescueTime
WeatherProvider   → Open-Meteo (weather + air quality)
ChannelAdapter    → Telegram, WhatsApp, Discord, Slack, In-App
LLMProvider       → Claude Haiku (reasoning engine)
StorageAdapter    → Encrypted local DB
```

32 metrics computed. 23 capabilities. 375 cross-source correlation possibilities.

The more sources connected, the exponentially smarter Waldo gets.

# Waldo — Project Brief

**Version:** April 2026
**Audience:** External collaborators, designers, animators, contractors, potential partners
**Confidentiality:** Safe to share. No proprietary algorithms, architecture, or technical implementation disclosed.

---

## What Waldo Is

Waldo is a **personal AI agent** that reads your body signals from a smartwatch and acts before you notice you're stressed, tired, or about to make a bad decision.

Not a health tracker. Not a dashboard. Not a wellness app. An agent that already handled it.

**Mascot:** A dalmatian named Waldo.
**Tagline:** "Already on it."
**Universal tagline:** "Waldo knows how you're really doing."

---

## The Core Product

You wear a smartwatch. Waldo reads your biology continuously. Every morning you get a **Nap Score** (0–100) — how ready your brain is today. When stress builds, Waldo catches it before you do and sends you a calm, specific nudge. Over weeks and months, Waldo learns YOUR patterns — when you crash, what helps you recover, which meetings drain you, when you do your best work — and starts acting on your behalf.

Waldo connects to your calendar, email, tasks, and music to understand not just your body, but your day. When biology meets context, the agent becomes transformative: "Your body is depleted and you have a board call in 40 minutes. Keep it short today."

---

## The Nap Score

Waldo's headline number. 0–100. How cognitively ready you are right now.

| Zone | Score | What it means |
|------|-------|--------------|
| **Peak** | 80–100 | Deep work window. Go for the hard thing. |
| **Steady** | 60–79 | Good working day. Keep the important block intact. |
| **Flagging** | 40–59 | Protect your energy. One priority only. |
| **Depleted** | 0–39 | Rest. Waldo's handling the rest. |

Grounded in published fatigue science used by the US military and FAA for cognitive performance prediction. The only open composite readiness score — transparent, personalized to you, updated continuously.

---

## What Waldo Does — Complete Capability Map

### I. Morning Intelligence

Every morning, before you finish your coffee, Waldo delivers a **Morning Wag** — a short, specific biological briefing:

- How you slept (duration, quality, recovery efficiency)
- Your Nap Score for the day
- One actionable insight tailored to today's schedule
- Calendar-aware recommendations (peak work windows matched to your meetings)
- Sleep debt status (accumulating, paying off, stable)
- Weather and environmental context

### II. Real-Time Stress Intervention

When your body shows stress signals — elevated heart rate, suppressed heart rate variability, prolonged sedentary posture — Waldo sends a **Fetch Alert** before you consciously register the stress:

- Calm, specific, 1–2 sentence nudge
- Micro-action suggestion (breathing exercise, short walk, hydration, stand up)
- Learns what works for YOU over time (breathing: effective 72% of the time, walk breaks: 45%)
- Maximum 3 alerts per day, 2-hour cooldown between them — Waldo is protective, never annoying

### III. Calendar & Schedule Intelligence

Waldo reads your calendar and understands the cognitive cost of your day:

- **Meeting load scoring** — back-to-back meetings amplify cognitive drain exponentially
- **Focus block protection** — guards your peak energy window from interruptions
- **Back-to-back circuit breaker** — inserts breaks when you have 3+ consecutive meetings
- **Pre-activity preparation** — 30 minutes before high-stakes events, Waldo tells you your readiness
- **Meeting rescheduling suggestions** — "Your readiness will be higher tomorrow morning. Move the board call?"
- **Boundary violation detection** — flags meetings booked during your evenings or early mornings

### IV. Communication & Email Awareness

Waldo reads email metadata (volume, timing, patterns) — **never the content**:

- **Communication stress tracking** — detects when your inbox volume spikes above baseline
- **After-hours ratio** — how much communication happens outside working hours
- **Response pressure** — unanswered threads accumulating
- **Late-night email → sleep impact** — Waldo discovers that your 10pm emails cost you 15 minutes of sleep latency

### V. Task Intelligence

Waldo connects to your task manager and understands your workload:

- **Deadline-aware prioritization** — matches task difficulty to your current cognitive readiness
- **Smart sequencing** — hardest tasks at your peak, momentum starters when depleted
- **Overdue triage** — "Pick the 3 that unblock everyone. Defer the rest 48 hours."
- **Break-it-down** — large tasks split into 25-minute chunks for low-energy days
- **Completion tracking** — learns which energy states produce your best output
- **Deferral intelligence** — uses predicted tomorrow readiness to suggest when to tackle hard tasks

### VI. Meeting Intelligence — Waldo Joins Your Calls

Waldo sits in your meetings and captures everything — so you can be fully present instead of taking notes:

- **Live meeting transcription** — real-time transcript with speaker identification. Works with Google Meet, Zoom, and Microsoft Teams.
- **Automatic meeting notes** — structured summary generated after every meeting: key decisions, action items, who said what, open questions
- **Action item extraction** — "John will review the deck by Thursday" → automatically creates a task in your task manager
- **Meeting → stress correlation** — Waldo cross-references your biometric state during the meeting with what was discussed. "Your HRV dropped 22% during the budget conversation. That topic consistently stresses you."
- **Pre-meeting prep** — before recurring meetings, Waldo surfaces: last meeting's action items, what's changed since, your current readiness level
- **Post-meeting recovery tracking** — monitors your HRV and stress after meetings to learn which meetings drain you most
- **Meeting load intelligence** — combines transcript analysis with calendar metadata to understand not just HOW MANY meetings, but which ones are cognitively expensive
- **Conversation insights for the Constellation** — topics, decisions, and stress triggers from meetings become data points that connect to health patterns over weeks and months

**How it works for the user:** Waldo joins your scheduled calls automatically (or you invite it). It listens, transcribes, and summarizes. After the meeting, the notes appear in your dashboard and the intelligence feeds into your Morning Wag: "Yesterday's 3pm strategy session was your biggest stress trigger this week — your HRV dropped 25% and didn't recover until after dinner."

**Privacy:** Waldo can operate in two modes:
- **Visible mode** — joins as a participant (other attendees see "Waldo" in the call)
- **Silent mode** — captures audio locally from your device only. No one else knows. No bot in the meeting.

Users choose their preference per meeting or globally.

---

### VII. Mood & Lifestyle Awareness

Waldo infers mood from music listening patterns and screen habits:

- **Mood inference from Spotify** — audio features (energy, valence, tempo) correlate with cognitive state
- **Late-night screen tracking** — correlates late screen time with next-morning recovery
- **Focus session detection** — identifies deep work blocks from screen patterns

### VII. Pattern Discovery (The Constellation)

Over weeks and months, Waldo connects observations into deep personal patterns:

- **"Monday syndrome"** — your HRV always drops Monday afternoon between 2–4pm
- **Meeting → stress correlation** — specific meetings that consistently trigger physiological stress
- **Exercise → creative windows** — your CRS jumps 8 points after a run, opening a 2-hour creative peak
- **Sleep timing → decision quality** — sleep debt accumulation correlates with impulsive decisions
- **Email → sleep causation** — after-hours email consistently delays your sleep onset

These patterns are visualized as **The Constellation** — an interactive graph of everything Waldo has learned about you. Individual observations ("Spots") connect into multi-week patterns, giving you a map of your personal biology that no app, doctor, or wearable has ever surfaced.

### VIII. Learning & Personalization

Waldo doesn't just analyze — it evolves:

- **Verbosity preference** — learns whether you want detailed messages or two-word nudges
- **Timing calibration** — discovers your actual optimal alert windows (not when you SAY, when your body RESPONDS)
- **Topic focus** — weights insights toward what you engage with (sleep-focused? activity-focused?)
- **Intervention effectiveness** — tracks what actually works for YOU (breathing exercises vs walk breaks vs caffeine reduction)
- **Language style** — adapts from clinical to warm based on your feedback

### IX. Automation (Agent Acts on Your Behalf)

With enough trust built, Waldo graduates from advisor to actor:

- **Calendar management** — suggests rescheduling, auto-blocks focus time
- **Communication batching** — groups non-urgent notifications into 2–3 daily windows
- **Recovery enforcement** — after multiple depleted days, protects your schedule from overcommitment
- **Sleep nudges** — bedtime reminders adjusted to YOUR sleep latency
- **DND management** — auto-mutes Slack/Teams during peak cognitive windows or depleted states

### X. User-Created Routines

Users write custom intelligence requests in plain language:

- "Every Sunday evening, tell me my recovery outlook for next week."
- "Before any meeting with 5+ people, tell me my readiness."
- "When my sleep debt goes above 3 hours, alert me immediately."
- "Every Friday, summarize what patterns you discovered this week."

Waldo interprets the request, sets the cadence, and delivers on schedule with your biological data as context.

---

### XI. Digital Day Awareness — Waldo Knows What You Did All Day

Waldo builds a passive picture of your day without screen capture, screenshots, or invasive monitoring. It pieces together your digital footprint from signals you're already generating:

- **App activity context** — from Screen Time (iOS/macOS) or Digital Wellbeing (Android): which apps you used, for how long, at what times — without reading content
- **Calendar-driven narrative** — your calendar tells a story of your day: what meetings happened, how long, whether you attended
- **Communication volume patterns** — email/Slack metadata (volume, timing, response gaps) describes your day without reading a word
- **Task completion signals** — what you actually finished vs planned tells Waldo how the day went
- **Meeting transcript summaries** — from Waldo's meeting notes, it knows the tone and outcome of your calls
- **Biometric timeline** — HR, HRV, and activity data provides a physiological read of your day moment-by-moment

Waldo synthesizes these signals into a **Day Summary** — a private, accurate picture of how your day actually went, purely from data you're already generating. No screen reading. No keyboard logging. No screenshots.

This powers the **Evening Review** and the **Morning Wag**: Waldo doesn't ask how your day was. It already knows. It just confirms, enriches, and acts.

**Privacy principle:** Waldo builds this picture from metadata and signals, never from content. It knows you had a 47-minute meeting that elevated your HR by 18 bpm — not what was said in the meeting. It knows you sent 23 emails after 6pm — not what they said.

---

### XII. Talk to Waldo — Voice Interface

Waldo understands voice input. You speak; Waldo responds.

**Input (Speech-to-Text):**
- Send a voice message on Telegram or WhatsApp — Waldo transcribes and responds
- Ask health questions hands-free: "Hey Waldo, how did I sleep?" "What's my score today?" "Am I burning out?"
- Dictate custom routines, capture observations, report how you're feeling
- Works offline on-device for privacy (on-device transcription option)

**Output (Text-to-Speech):**
- Waldo reads its Morning Wag aloud — hear your daily briefing while getting ready
- Voice replies to voice questions — ambient conversation, no screen required
- Integration with iOS/Android native TTS for in-app playback
- Future: Waldo as a smart speaker skill (Alexa, Google Home)

**Waldo's voice character:** Warm, calm, matter-of-fact. Never robotic. Matches the dalmatian personality — already handled it, here's what you need to know.

---

### XIII. Calendar Zone Blocking — Waldo Protects Your Time

Waldo doesn't just read your calendar — it writes to it. Based on your biological state, Waldo actively reserves the right time for the right work:

- **Peak zone protection** — automatically blocks your circadian peak window (typically 10am–1pm for most people) for deep work. No meetings allowed unless you override.
- **Recovery zone enforcement** — after high Day Strain or multiple depleted days, Waldo marks recovery windows on the calendar. Low-priority requests can't land there.
- **Pre-meeting buffers** — auto-inserts 15-minute gaps before high-stakes meetings so you arrive ready, not flustered
- **Post-meeting recovery blocks** — after cognitively expensive meetings, blocks transition time before the next commitment
- **Circadian-aware scheduling** — when you accept a new meeting, Waldo nudges if it conflicts with your biological peak or lands during a predicted dip
- **"Do Not Schedule" hours** — user-defined or Waldo-suggested evening/morning protection (boundary violations flagged and blocked)
- **Weekly architecture suggestions** — "Your best week looks like: deep work 9–12 Monday/Wednesday/Friday, meetings clustered Tuesday/Thursday afternoon. Want me to template that?"

**Respects your autonomy:** Waldo suggests and nudges. You always have final say. Every blocked slot can be overridden. The agent learns from your overrides too.

---

### XIV. Collaboration With Other AI Agents — Waldo as the Body API

Waldo doesn't operate in isolation. It becomes the **biological intelligence layer** that other AI agents can query:

**Waldo as an MCP Server (Model Context Protocol)**

Every AI agent being built today — Claude, GPT, Gemini, your custom agents, Cursor, Lindy, Devin — is blind to your body. Waldo fixes this by exposing biological intelligence through the industry-standard MCP protocol:

- `getCRS()` — current Cognitive Readiness Score and zone
- `getStressLevel()` — current biometric stress signature and confidence
- `getCognitiveWindow()` — your peak mental performance window for today
- `getPredictedCRS(tomorrow)` — next-day readiness forecast
- `getHealthBaseline()` — your personal physiological normal
- `getSleepDebt()` — accumulated sleep debt and direction
- `getMeetingContext(last_N)` — insights from your most recent meetings

Any agent with an MCP client can now make biology-aware decisions on your behalf.

**Real-world examples:**
- Your coding agent (Cursor/Devin) checks your CRS before suggesting you tackle a hard bug at 4pm — recommends waiting until tomorrow morning
- Your calendar agent (Reclaim/Motion) schedules meetings around your biological peaks, not just calendar gaps
- Your email agent batches outbound email for when you're in a steady or peak state — not when you're depleted
- Your journaling agent prompts deeper reflection when your stress indicators are elevated

**Agent-to-Agent Collaboration (A2A Protocol)**

Using the A2A protocol (v1.0, live as of March 2026, 150+ organizations), Waldo can:
- Receive delegated tasks from other agents: "Manage Shivansh's energy today"
- Coordinate with specialist agents: sleep agent, nutrition agent, movement agent
- Publish a public **Agent Card** — so any AI ecosystem can discover Waldo and understand its capabilities
- Join multi-agent orchestration pipelines where Waldo handles the "biological clearance" layer

**Pack Tier (Teams & Organizations)**

When multiple people use Waldo, agents can coordinate across the group:
- "Schedule the sprint kickoff when the most people are in peak state"
- "Don't plan the board debrief on a day when three members are recovering from travel"
- Team cognitive readiness dashboard for managers and coaches

---

## Industries & Verticals

### Who Uses Waldo

| Vertical | Core Value |
|----------|-----------|
| **Knowledge workers** | Deep work protection, meeting load management, burnout prevention |
| **Startup founders** | Sustainable decision-making, founder burnout prevention |
| **Software engineers** | Focus block protection, code quality × cognitive state correlation |
| **Executives & managers** | Team cognitive readiness, strategic decision timing |
| **Students** | Study efficiency, sleep management, exam anxiety reduction |
| **Athletes & sports teams** | Training readiness, overtraining detection, game-day optimization |
| **Healthcare workers** | Shift recovery, fatigue management, clinical decision quality |
| **Traders & financial professionals** | Decision quality protection, impulse control |
| **People with ADHD** | Executive function forecasting, task initiation support, crash prediction |
| **People with anxiety** | Stress detection before conscious awareness, trigger mapping |
| **Working parents** | Energy banking, help scheduling, guilt-free prioritization |
| **Frequent travelers** | Jet lag management, timezone recovery, circadian resetting |
| **Military & aviation** | Cognitive readiness assessment (grounded in SAFTE-FAST, used by US Army and FAA) |
| **Couples & families** | Shared biological awareness — "Neither of you should be making big decisions today" |

### Enterprise Applications

| Application | What Waldo Provides |
|------------|-------------------|
| **Player readiness dashboards** (sports) | Pre-game cognitive readiness across entire roster |
| **Workforce cognitive management** | Team burnout trajectory, shift optimization, recovery scheduling |
| **Clinical decision support** | Provider fatigue monitoring, cognitive state before critical decisions |
| **Remote team management** | Distributed team readiness visibility, timezone-aware scheduling |
| **Safety-critical operations** | Fatigue risk management for pilots, operators, first responders |

---

## How Users Interact With Waldo

### Messaging Channels
- **Telegram** — Morning Wags, Fetch Alerts, conversational chat
- **WhatsApp** — same as Telegram (coming soon)
- **Web console** — full dashboard, chat, insights, integrations
- **Mobile app** — native iOS/Android with live wearable sync
- **Discord / Slack** — workspace delivery (coming soon)

### Waldo Moods — The Dalmatian Visual System

The dalmatian's visual state changes with your Nap Score. This is not decoration — **it IS the product**:

| State | When | Visual |
|-------|------|--------|
| **Energized** | Score 80+ | Tail up, ears perked, bright spots, bouncing |
| **Steady** | Score 60–79 | Relaxed, sitting attentively, tail wagging gently |
| **Flagging** | Score 40–59 | Lower posture, ears drooping, subdued |
| **Depleted** | Score <40 | Curled up, faded spots, still — minimal UI to match |
| **Stress detected** | Alert firing | Ears back, alert posture, nose forward — protective |
| **No data** | First use | Head tilted, curious, looking around — waiting |

When your Nap Score drops below 40, the entire interface simplifies. Fewer metrics, shorter messages, one clear instruction: "Rest." Waldo doesn't overwhelm depleted people with data.

---

## Data Waldo Connects To

### Health & Body
Apple Watch · Samsung Galaxy Watch · Fitbit · WHOOP · Oura Ring · Google Fit · any Health Connect or HealthKit compatible device

### Work & Productivity
Google Calendar · Outlook · Apple Calendar · Google Tasks · Todoist · Notion · Linear · Microsoft To Do

### Meetings
Google Meet · Zoom · Microsoft Teams — live transcription, speaker identification, automatic notes, action item extraction

### Communication
Gmail · Outlook (metadata only — Waldo **never reads email content**)

### Lifestyle
Spotify · YouTube Music · RescueTime

### Environment
Weather · Air quality · UV index · Location-based context

### Delivery
Telegram · WhatsApp · Discord · Slack · In-app · Email digest

---

## The Endgame Vision

### Today: Body Intelligence
Waldo reads your Apple Watch and tells you how sharp you are. Every stress signal caught before you notice. Your body stops being a mystery.

### Next: Context Intelligence
Waldo connects your calendar, email, tasks, and music. When biology meets context: "Your body is depleted and you have a board call in 40 minutes." No other agent can say this.

### Then: Agency & Skills
You teach Waldo through conversation. "When my score drops below 50 and I have a presentation, prep me with talking points." The agent remembers. Next time it acts without asking.

### Endgame: The Body API
Waldo becomes the **biological intelligence layer** underneath every other AI agent. When your calendar agent decides whether to schedule a 4pm meeting, it asks Waldo: "Is this person cognitively ready?" When your email agent decides when to send that investor email, it checks your readiness first.

Every AI agent being built today knows what you need to do. **Waldo knows if you can actually do it.**

---

## Brand Identity (For Collaborators)

### Colors
| Role | Hex |
|------|-----|
| Background | `#FAFAF8` (warm off-white, never pure white) |
| Text | `#1A1A1A` (near-black) |
| Accent/CTA | `#F97316` (Waldo orange) |
| Peak zone | `#D1FAE5` (mint green) |
| Steady zone | `#FEF3C7` (warm amber) |
| Flagging zone | `#FEE2E2` (warm rose) |
| Depleted zone | `#F3F4F6` (neutral gray) |

**Rules:** No gradients. No purple. No blue. No pure white. Sentence case only.

### Typography
- **Corben** (Google Fonts) — headlines only, 400 weight, never bold
- **DM Sans** (Google Fonts) — body text, 400/500 only, never 700

### Voice
| Do | Don't |
|----|-------|
| "Rough night. Push your 9am." | "I've detected a decline in your recovery metrics." |
| Short, warm, already handled | Long, clinical, observational |
| "Already on it." | "We recommend you consider..." |

**Banned words:** wellness, mindfulness, optimize, hustle, AI-powered, health tracker, health app, unlock your potential, empower, holistic, journey

---

## What Makes Waldo Different

| | Health apps (WHOOP, Oura) | Productivity agents (Lindy, Reclaim) | Meeting AI (Otter, Fireflies) | Waldo |
|---|---|---|---|---|
| Reads your body | ✅ | ❌ | ❌ | ✅ |
| Proactively messages you | Limited (in-app) | ✅ | ❌ | ✅ |
| Joins your meetings | ❌ | ❌ | ✅ | ✅ |
| Connects meetings to biology | ❌ | ❌ | ❌ | ✅ |
| Works on any smartwatch | ❌ (locked) | N/A | N/A | ✅ |
| Understands your schedule | ❌ | ✅ | Calendar only | ✅ |
| Learns your patterns | Basic | Basic | Conversation only | ✅ (all sources) |
| Acts before you ask | ❌ | Partially | ❌ | ✅ |
| Price | $17–30/mo | $10–50/mo | $10–20/mo | Free + $4/mo Pro |

**The empty quadrant:** Proactive + channel-delivered + biologically grounded + device-agnostic + evolving memory. No one else is there.

---

## Contact

For collaboration inquiries: **Shivansh Fulper** — [contact method]

---

*Waldo is not a medical device. The Nap Score is for informational purposes only and should not be used for medical decisions.*

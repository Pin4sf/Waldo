# Waldo — Designer Brief
**Version 3.0 — April 2026**
**For:** UI/UX designers, brand designers, web designers, social media team

---

## READ THIS FIRST

Waldo is not a health app. It is not a productivity tool. It is not a wellness dashboard.

**Waldo is a personal AI agent that reads your body from the inside out and acts before you even notice something is wrong.**

It reads your Apple Watch (or any smartwatch) continuously. It knows when your nervous system is depleted. It messages you — directly, via Telegram or WhatsApp, like a text from a friend — before your stress registers consciously. Every morning it sends you a biological briefing. Over time it learns you: your patterns, your triggers, your peaks, your crashes. Then it starts acting on your behalf.

The mascot is a dalmatian named Waldo. Personality: already on it.
Tagline: **"Already on it."**

---

## The Long-Term Vision (Design To This)

Waldo is building the **horizontal intelligence layer** — a plug-and-play biological OS that can be adapted to any industry that produces sensor, wearable, or biometric data.

**Consumer (now):** Knowledge workers with Apple Watch → Nap Score, Morning Wag, stress alerts
**Enterprise (next):** NFL teams → Player cognitive readiness dashboards, injury prevention
**Medical (future):** YN sweatband (CKD detection) → clinical-grade health intelligence layer
**Platform (endgame):** Waldo as MCP server — a "body API" that any AI agent can query before making decisions on behalf of a human

The architecture is built for this: 10 plug-and-play data adapters, one intelligence engine.
When designing, think: **this skin needs to work for a knowledge worker at 7am AND for an NFL coach watching player readiness before kickoff.**

---

## Brand Identity

### Name & Mascot
- Product name: **Waldo**
- Mascot: **dalmatian dog** — spots, warm, loyal, always watching, always ahead
- Personality: like a best friend who happens to know your biology
- NOT: clinical, corporate, coaching, wellness-y

### Tagline
**"Already on it."**
— conveys proactivity, reliability, warmth. Waldo acts before you ask.

### Voice (Read Before Writing Any Copy)
| DO | DON'T |
|----|-------|
| Short sentences. Already done it. | Long explanations. |
| "Rough night. Push your 9am." | "I've noticed your HRV has been declining..." |
| Specific and actionable | Vague and encouraging |
| Warm, like a friend texting | Cold, like a doctor's report |
| "Waldo spotted something." | "Our AI has detected..." |

**Banned words:** wellness, mindfulness, optimize, hustle, AI-powered, health tracker, health app, unlock your potential, empower, journey, unlock, journey, holistic
**Never say:** "Waldo AI" — always just "Waldo"
**Always say:** Nap Score (never CRS in consumer-facing text)

### Colors
| Role | Hex | Usage |
|------|-----|-------|
| Background | `#FAFAF8` | Warm off-white — all screens, never pure white |
| Text | `#1A1A1A` | Near-black — primary text |
| Accent / CTA | `#F97316` | Waldo orange — one per layout maximum |
| Peak / Positive | `#D1FAE5` | Mint green — Nap Score 80+ |
| Moderate | `#FEF3C7` | Warm amber — Nap Score 50-79 |
| Low / Warning | `#FEE2E2` | Warm rose — Nap Score <50 |
| Muted text | `#9CA3AF` | Secondary labels, timestamps |
| Border / divider | `#E5E5E3` | Subtle separators |

**Rules:** No gradients. No purple. No pure `#FFFFFF`. No dark mode yet (Phase 2).

### Typography
| Role | Font | Size | Weight |
|------|------|------|--------|
| Product wordmark | VCorben (custom) | Variable | Bold |
| Display headlines | Corben (Google Fonts) | 52px | Regular |
| UI body | DM Sans (Google Fonts) | 16px | 400/500/600 |
| Metric numbers | DM Sans | 32-48px | 700 |
| Captions / labels | DM Sans | 12-13px | 400 |

**Rules:** Sentence case always. Never title case or ALL CAPS in UI. Line height 1.7 for body, 1.1 for headlines.

### Logo Assets (already exist)
- `Waldo.png` — wordmark
- `waldo_logo_dark.png` — paw print on light background
- `waldo_logo_light.png` — paw print on dark background
- `Vector-1.png`, `Vector-2.png`, `Vector-3.png` — dalmatian spots (use as decorative nodes in Constellation view)

---

## Waldo Moods — The Dalmatian Emotional System

Waldo's visual state changes with the user's Nap Score. This is not decoration — it's the product. The dalmatian is a living indicator of how the user is doing.

| Mood | Nap Score | Dalmatian State | Voice |
|------|-----------|-----------------|-------|
| **Energized** | 80-100 | Tail up, ears perked, spots bright, animated bounce | Upbeat. Push hard. "Peak window. Big task now." |
| **Steady** | 65-79 | Relaxed, sitting attentively, tail gently wagging | Warm and specific. "Good baseline. One thing to watch." |
| **Flagging** | 50-64 | Sitting lower, tail slower, slightly subdued | Honest and protective. "One priority. Protect energy." |
| **Depleted** | <50 | Curled up, spots faded, tail still | Minimal. Gentle. "Rest. That's it." |
| **No data** | — | Looking around, curious, head tilted | "Wear your Watch tonight for a full score." |
| **Stress detected** | — | Ears back, alert, nose forward | Active. "I've spotted something. Take 2 minutes." |

**Design intent:** The dalmatian avatar should live on the dashboard, be visible in the Morning Wag message card, and animate subtly when new data arrives. It is the emotional anchor of the app — users should develop a relationship with it.

---

## What Waldo Currently Computes (Phase B1 — LIVE)

These metrics are computing RIGHT NOW from Apple Watch via HealthKit. Designed and built. **Design these screens first.**

### The Nap Score (CRS — Cognitive Readiness Score)
The headline number. 0-100. How sharp your brain is right now.

```
Nap Score = (Sleep × 35%) + (HRV × 25%) + (Circadian × 25%) + (Activity × 15%)
```

| Range | Zone | Color | Meaning |
|-------|------|-------|---------|
| 80-100 | Peak | Mint green `#D1FAE5` | Deep work window. Challenge mode. |
| 65-79 | Moderate | Warm amber `#FEF3C7` | Steady. Routine tasks fine. |
| 50-64 | Flagging | Orange `#F97316` (light) | Protect energy. One priority. |
| 0-49 | Low | Rose `#FEE2E2` | Rest. That's it. |
| -1 | No data | Gray `#E5E5E3` | Not enough data yet. |

### Sleep Score (35% of Nap Score)
```
Starts at 100. Penalties:
  Duration: <6h = -15/hr, 6-7h = -10/hr, >9.5h = -5
  Deep sleep: <8% = -20, <13% = -10
  REM: <20% = -8
  Efficiency: <85% proportional penalty
  Bedtime shift: >60min from usual = -10, >120min = -20
  Sleep debt: -5/hr deficit, capped at -30
```

Displays: Total hours, deep%, REM%, bedtime, wake time, efficiency.

### HRV Score (25% of Nap Score)
Computed from **true beat-to-beat RMSSD** (raw IBI via HKHeartbeatSeriesQuery on Apple Watch).
```
RMSSD → time-of-day normalized (6 blocks, population ratios: 1.30/1.10/1.00/0.85/0.90/1.05)
→ compared to YOUR 7-day baseline (EMA, α=0.3)
  +15% above baseline = score 90
  Within ±5% = score 70
  -25% below baseline = score 20
  Trend bonus: 7d vs 30d improving = +5
```

HRV data source displayed to user: "IBI (beat-to-beat)" or "SDNN (fallback)" — so they understand quality.

### Circadian Score (25% of Nap Score)
```
Wake time vs optimal for your chronotype (early/normal/late)
  ±30min of ideal = 100
  ±1hr = 75
  ±2hr = 40
  Bedtime consistency (14-day std dev): low variance = bonus
```

### Activity Score (15% of Nap Score)
```
Steps: <3000 = 20, 5000 = 50, 8000 = 75, 10000+ = 90
Exercise minutes: 0 = -10, 30+ = +10
Stand hours (Apple Watch): <6 = 0, 8+ = +5
```

### Day Strain (0-21, WHOOP-style)
```
TRIMP: time in each HR zone × zone weight [1.0, 1.5, 2.5, 4.0, 8.0]
Log-scaled: strain = min(21, log10(TRIMP + 1) × 7)
  0-4: rest. 4-10: low. 10-14: medium. 14-18: high. 18+: overreaching.
```

### Sleep Debt (0-20h)
```
14-day weighted rolling accumulation:
  debt += max(0, 7.5h - actual) × recency_weight
  Repayment at 0.5x rate
  Direction: accumulating / paying off / stable
```

### Stress Confidence (0.0-1.0) — triggers Fetch Alerts
```
0.35 × HRV_drop + 0.25 × HR_elevation + 0.20 × duration + 0.20 × sedentary
  ≥0.60 → Fetch Alert fires
  ≥0.80 → HIGH alert
  Must sustain 10+ minutes. 2h cooldown. Max 3/day.
```

### Also computed from Apple Watch today:
- **Resting HR** (bpm, 7-day trend)
- **Steps** (daily count + 7-day average)
- **SpO2** (avg percentage, flagged if <95%)
- **Respiratory Rate** (breaths/min, flagged if trending up)
- **Exercise minutes** (vs 30-min daily target)
- **Wrist temperature** (if Apple Watch Series 8+)
- **VO2 Max** (if available, ml/kg/min)
- **Active Energy Burned** (kcal)
- **Flights climbed** (floors)
- **Daylight exposure** (minutes)

---

## What Waldo Will Compute (Phase 2 — Design These Screens Too)

These need to be designed before they're built. Designers should scaffold all Phase 2 screens so we can build without design bottlenecks.

### Schedule Dimension (from Calendar)
| Metric | Range | What it means |
|--------|-------|---------------|
| **Meeting Load Score** | 0-15+ | Cognitive drain from meetings. Back-to-back amplifies exponentially. |
| **Focus Time** | 0-8h | Uninterrupted blocks ≥90min during your peak energy window |
| **Back-to-Back Count** | 0-10 | Meetings with <5min gap |
| **Boundary Violations** | 0-10 | Evening/early morning meetings |
| **Schedule Density** | 0-100% | Booked / total workday |

### Communication Dimension (from Email/Slack — metadata only, never content)
| Metric | Range | What it means |
|--------|-------|---------------|
| **Communication Stress Index** | 0-100 | Volume + pressure + after-hours activity combined |
| **Response Pressure** | 0-1.0 | Unanswered messages >2h / total |
| **After-Hours Ratio** | 0-1.0 | Messages outside 8am-7pm |
| **Volume Spike** | 0.5-3x | Today vs 30-day average |

### Tasks Dimension (from task manager)
| Metric | Range | What it means |
|--------|-------|---------------|
| **Task Pile-Up** | 0-50 | Overdue count. The cognitive weight of undone things. |
| **Completion Velocity** | 0-2.0 | Tasks done / created per day |
| **Procrastination Index** | 0-30 days | Avg days from creation to completion |
| **Urgency Queue** | 0-10 | Due within 24h |
| **Task-Energy Match** | 0-100% | Hard tasks during CRS peak / total hard tasks |

### Mood & Screen Dimension (from Spotify + RescueTime)
| Metric | Range | What it means |
|--------|-------|---------------|
| **Mood Score** | 0-100 | Inferred from Spotify audio valence × energy |
| **Screen Time Quality** | 0-100% | Productive hours / total screen hours |
| **Late-Night Digital** | 0-3h | Screen/music after 10pm (sleep correlation) |
| **Focus Session Count** | 0-10 | Uninterrupted 25min+ blocks |

### Combined Master Metrics
| Metric | Range | What it means |
|--------|-------|---------------|
| **Daily Cognitive Load** | 0-100 | How overloaded is this person RIGHT NOW (combines all 6 dimensions) |
| **Burnout Trajectory Score** | -1 to +1 | 30-day rolling trend. >0.6 = heading for burnout. |
| **Waldo Intelligence Score** | 0-100 | How much context Waldo has. More sources = smarter. |

---

## What Waldo Will Compute (Phase 3 — Know These Exist)

- **Resilience Score** — 14-day HRV stability. How bounce-back-able are you?
- **Recovery-Load Balance** — WHOOP-style: recovery available vs strain demanded
- **Predicted Tomorrow Score** — ML-based CRS prediction for deferral intelligence
- **Cross-source correlations** — Waldo learns YOUR patterns: "Your HRV crashes every time you email after 10pm"
- **Waldo Intelligence Score (full)** — With 10 sources connected: 375 unique 2/3/4-way correlations, ~80-100 meaningful behavioral patterns

---

## The App Screens (Mobile — Design Priority Order)

### DESIGN IMMEDIATELY (Phase B1 — built, needs polished UI)

**Screen 1: Dashboard (Today)**
The main screen. Opens every morning.

Required elements:
- **Nap Score gauge** — large SVG arc (270°), 0-100, zone-colored. The hero of every screen.
- **Waldo Mood avatar** — dalmatian state based on current zone. Lives next to/below the gauge.
- **4 component cards** in 2×2 grid: Sleep / HRV / Circadian / Activity. Each shows score + mini bar.
- **Day Strain bar** — 0-21, horizontal, zone-colored.
- **Sleep Debt** — "2.4h owed" with trend arrow.
- **Data freshness** — "Updated 4 min ago" in muted text.
- **What Waldo spotted today** — 1-3 "Spot" chips (individual observations, like dalmatian spots).
- **Morning Wag card** — Waldo's daily message. 2-3 lines. Dalmatian avatar beside it.
- **Refresh button** — secondary, bottom. "Update now."
- **Medical disclaimer** — "Not a medical device" in 11px muted text.

States to design:
- First use / no data (Waldo tilting head: "Wear your Watch tonight")
- Loading state (smooth, not spinner — branded)
- Partial data (some components gray/unavailable)
- Peak state (80+, green, Waldo tail wagging)
- Depleted state (<50, rose, Waldo curled)

**Screen 2: Onboarding (3 steps)**
Step 1: Connect wearable + grant HealthKit permissions
Step 2: Link messaging channel (Telegram / WhatsApp) via 6-digit code
Step 3: Quick profile (name, role, typical wake time)

Tone: Conversational, not a form. Waldo is "meeting you" for the first time.
Progress: Subtle. Don't make it feel like a medical intake form.

**Screen 3: Permissions gate**
If HealthKit not granted: Waldo is waiting, looking at you expectantly.
CTA: "Let Waldo in" — not "Grant permissions."

---

### DESIGN NEXT (Phase C — coming soon, scaffold now)

**Screen 4: History / Timeline**
- Horizontal scrollable day strip at top — colored dots, one per day (green/amber/rose/gray)
- Click any day → loads that day's full dashboard (same as today but historical)
- "7 days" / "30 days" / "90 days" filter

**Screen 5: Sleep Detail**
Expanded sleep view for a specific night:
- Sleep stage chart (horizontal stacked bar over time: Core/Deep/REM/Awake/InBed)
- Key stats: total hours, deep %, REM %, efficiency, bedtime, wake time
- Comparison to your 30-day average
- Sleep debt trend chart (7 days)

**Screen 6: HRV Detail**
- RMSSD trend chart (30 days)
- Today's reading vs 7-day baseline
- Time-of-day distribution
- Data source label: "Beat-to-beat" or "SDNN"

**Screen 7: Activity Detail**
- Steps chart (7 days)
- Day Strain chart (7 days)
- HR zone breakdown bar (today)
- Exercise sessions list

**Screen 8: Stress Events Log**
- Timeline of Fetch Alerts
- Each event: time, stress confidence score, Waldo's message, user response
- Pattern: "Your last 3 high-stress events were on Tuesdays between 2-4pm"

---

### DESIGN FOR PHASE D (Agent + Messaging — design now so we can build fast)

**Screen 9: Chat / Conversation**
- Waldo speaks first (Morning Wag appears automatically at top)
- Message thread below
- User input bar at bottom
- Waldo messages have avatar. User messages are right-aligned.
- Feedback: thumbs up / thumbs down on each Waldo message (critical for learning)
- Occasional inline data visualizations in chat (mini Nap Score gauge in message)
- Status: "Waldo is checking your data..." while computing

**Screen 10: Notification / Fetch Alert (in-app)**
Full-screen alert card when stress detected:
- Waldo alert avatar (ears back, alert)
- "Waldo spotted something" header
- 1-2 lines: what was detected, what to do
- CTA: "Got it" or "Tell me more"
- Time and confidence level in small text

**Screen 11: Settings**
- Profile (name, role, timezone, wake time)
- Connected wearable (device name, last sync)
- Messaging channel (Telegram/WhatsApp, linked/unlinked)
- Notification preferences
- Data & privacy (export, delete account)
- About / version

---

### DESIGN FOR PHASE 2 (Scaffold These Now)

**Screen 12: The Constellation**
The most visually distinctive screen. Pattern discovery over months.

- Force-directed graph. Nodes = individual Spots (observations). Edges = correlations.
- Node colors: health (blue), behavior (orange), alert (rose), insight (mint)
- Node sizes: larger = higher confidence / more occurrences
- Dalmatian spot images used as node backgrounds
- Clusters = named Constellations (e.g., "Monday Syndrome", "Pre-deadline HRV dip")
- Hover/tap a node → see the observation + date
- Tap a cluster → see the full pattern + what Waldo does about it
- Filter bar: type / severity / time range

**Screen 13: Phase 2 Dashboard additions**
Additional cards appear as sources connect:
- Meeting Load Score card
- Focus Time card
- Communication Stress Index card
- Task Pile-Up card
- "Connect more sources" card (empty states for unconnected adapters)

**Screen 14: Connect Sources**
Adapter connection hub. Each source: logo, description, "Connect" button.
Status: connected (green check) / not connected (gray). Data preview on hover.

Phase 2 sources: Google Calendar, Gmail, Todoist/Notion/Linear, Spotify, RescueTime.

---

## The Website (Design These Too)

### Homepage / Landing Page

Hero:
- **Headline:** "Your AI knows what you need to do. Waldo knows if you can actually do it."
- **Subhead:** "A personal agent that reads your Apple Watch and tells you each morning how to make the most of your day."
- **CTA:** "Get early access" → email capture / waitlist
- **Dalmatian animation** — Waldo tail wagging, spots visible, approachable
- **Social proof:** "Validated on 856 days of real biometric data"

Above the fold: no screenshots yet — hero copy + waitlist CTA only.

Sections:
1. **The Problem** — "Your wearable knows everything. Your AI knows nothing."
2. **The Nap Score** — animated gauge explaining 4 zones
3. **Morning Wag demo** — show example messages (iPhone mockup + Telegram screenshot)
4. **How it works** — 5-step visual: Watch → CRS → Stress → Message → Learns
5. **What Waldo watches** — 6 dimensions of intelligence (expandable cards)
6. **Competitive table** — "No agent has biology. No health app has agency."
7. **Pricing** — Pup / Pro / Pack
8. **The vision** — "Today: your Apple Watch. Tomorrow: every sensor in any industry."
9. **Waitlist CTA** — early access, email capture

### Pricing Page

| Tier | Name | Price | What you get |
|------|------|-------|-------------|
| Free | **Pup** | Rs 0 | Morning Wag + basic Spots + Nap Score |
| Pro | **Pro** | Rs 399/mo (~$4.34) | Full Patrol, Fetch Alerts, Constellations, all dimensions |
| Team | **Pack** | Rs 999/mo/seat | Multiple Waldos, shared dashboards, team cognitive view |

Callout: "Break-even at 50 Pro subscribers. Comfortable profitability at 200."

### Enterprise / Verticals Page (Design this too — for NFL/YN conversations)

- Header: "Waldo's intelligence layer. Your industry's data."
- Use case cards: Sports performance / Clinical wearables / Remote workforce / Aerospace
- "The same intelligence. Plugged into your sensor ecosystem."
- Contact form for enterprise inquiries

---

## Design System Components to Build

### Data Visualization
- **Nap Score Gauge** — SVG arc, animated fill, zone-colored, number in center
- **Component score bar** — horizontal bar, color by score, 0-100
- **Sleep stage chart** — horizontal stacked timeline bar
- **Trend sparkline** — 7-day or 30-day line, micro-sized for cards
- **Day Strain bar** — 0-21, segmented by zone
- **Constellation graph** — force-directed, interactive (Phase 2)
- **Sleep debt indicator** — hours owed + direction arrow
- **HRV trend chart** — 30-day with baseline comparison band

### UI Components
- **Waldo Mood avatar** — 6 states (see Waldo Moods section above)
- **Spot chip** — small pill, icon + text, colored by type
- **Morning Wag card** — avatar + message + timestamp + feedback buttons
- **Fetch Alert card** — alert state, full-width, high contrast
- **Metric card** (2×2 grid item) — emoji + score + bar + label + "no data" state
- **Source connection card** — logo + status + connect button
- **Day strip dot** — colored circle, 20px, for timeline
- **Score number** — large, bold, zone-colored
- **Data freshness label** — muted, small, "Updated X ago"

### States to Design For Every Screen
- Loading (data fetching)
- First use / empty (no data yet)
- Partial data (some metrics unavailable)
- Error (sync failed, watch disconnected)
- Peak state (Nap Score 80+)
- Depleted state (<50)
- Offline (no connection, showing cached data)

---

## Architecture — For Designer Context (Non-Technical)

Waldo is built on 10 plug-and-play data connectors. Each connector = one domain of your life. You connect the ones you want. Waldo gets exponentially smarter with each one.

```
Your Apple Watch    → Body intelligence (live, Phase B1)
Your Calendar       → Schedule intelligence (Phase 2)
Your Email          → Communication pressure (Phase 2, headers only — never reads content)
Your Task Manager   → Work queue intelligence (Phase 2)
Your Music App      → Mood inference (Phase 2)
Screen Time app     → Digital hygiene (Phase 2)
Weather / AQ        → Environmental context (live)
Messaging (Telegram)→ How Waldo talks to you (live)
Claude AI           → The brain that reasons over all of it
Encrypted storage   → Everything stays on your phone first
```

**For designers:** The "Connect Sources" screen is a core part of the onboarding journey. Empty states when a source isn't connected should feel like Waldo is curious and waiting, not like the app is broken.

---

## What Makes Waldo Different From Every Competitor

```
                    Body  Proactive  Messaging  Multi-device  Price
Oura/WHOOP           ✓     Limited     ✗           ✗           $17-30
RISE                 ✓     ✗           ✗           ✗           $7
Reclaim.ai           ✗     ✓           ✗           N/A         $10
Lindy                ✗     ✓           ✓           N/A         $50
Nori (YC, live now)  ✓     Morning only ✗          Multi        TBD

Waldo                ✓        ✓         ✓            ✓          Free/$4
```

The quadrant of **proactive + channel-delivered + scientifically grounded + device-agnostic + evolving memory** is still empty. That's the design language: confident, specific, already done.

---

## Immediate Design Priorities

**Week 1 — Unblock development:**
1. Dashboard screen (polished — we have a functional prototype, needs visual design)
2. Onboarding flow (3 screens: wearable → channel → profile)
3. Nap Score gauge component (this is the hero of the product)
4. Waldo Mood avatar system (6 states, dalmatian illustrations)
5. App icon + splash screen

**Week 2 — Website:**
6. Landing page (hero + waitlist CTA + 5 sections)
7. "How it works" visual (5-step flow diagram)
8. Competitive comparison table

**Week 3 — Pre-launch:**
9. History/timeline screen
10. Sleep detail + HRV detail screens
11. Settings screen
12. Pricing page

**Phase 2 prep (scaffold in Figma, don't finalize):**
13. Constellation graph screen
14. Chat/conversation screen
15. Connect sources hub
16. Phase 2 dashboard with all 6 dimension cards

---

---

## Web Console — The Primary Product Surface (April 2026 Update)

> **IMPORTANT:** The web console (`waldo-sigma.vercel.app`) is now the primary way users onboard, connect integrations, upload health data, view their dashboard, and chat with Waldo. **Design the web console first.** The mobile app comes after — and it should mirror what the web console does.

### Why Web Console First

1. No App Store approval needed. No $99 Apple Developer account. No EAS builds.
2. iOS users can't install our native app yet — the web console IS their Waldo experience.
3. Android users upload health data and connect Google via web, then use the APK for live wearable sync.
4. Investors, designers, friends can see a working demo at a URL. No install friction.

### Web Console User Journey (Design This Flow)

```
1. ARRIVE → Landing page / waitlist (if not signed up yet)
     ↓
2. SIGN UP → Name, timezone, wearable type → user created
     ↓
3. SETUP SCREEN ("Your Waldo is ready")
   ├── Step 1: Connect Google Workspace → OAuth popup → auto-detects completion ✓
   ├── Step 2: Link Telegram → 6-digit code → auto-detects when linked ✓
   ├── Step 3 (iOS): Upload Apple Health XML → drag-and-drop → batched upload with progress
   └── Both optional — "Open my dashboard →" always visible
     ↓
4. DASHBOARD → Full Nap Score view, Morning Wag, health stats, spots, CRS components
     ↓
5. TABS: Today | History/Timeline | Chat | Constellation | Profile
```

### What the Web Console Shows Today (Built, Working)

| Tab | Content | Data Source |
|-----|---------|-------------|
| **Today** | Nap Score gauge + CRS component bars + Morning Wag card + health stat grid + adjustment cards + spot carousel + date picker with colored dot strip | Supabase: `crs_scores`, `health_snapshots`, `day_activity`, `spots`, `master_metrics`, `calendar_metrics` |
| **Chat** | Conversational thread + quick-reply suggestions + thread pills + sending indicator | Supabase: `conversation_history` + `invoke-agent` Edge Function (Claude Haiku) |
| **Insights** | 30-day Nap Score bar chart + weekly pattern summary + confirmed patterns + spots grid | Supabase: `crs_scores`, `patterns`, `spots` |
| **Profile** | User identity + integration status with sync/connect buttons + core memory tags + agent activity log with cost + Waldo's schedule + sign out + 5-tap admin mode | Supabase: `users`, `oauth_tokens`, `sync_log`, `core_memory`, `agent_logs` |

### New Features to Design (From April 2026 Research)

**1. Apple Health Upload Panel** (Built, needs visual polish)
- Lives in Integrations tab on Profile
- Drag-and-drop zone for `export.xml` file
- Progress bar with batch status: "Uploading batch 2/3 (30 days)…"
- Success state: "85 days imported. Nap Score range: 30–89."
- Instructions: "How to export from your iPhone" (4-step visual guide)

**2. Pre-Activity Spot** (New trigger type — Phase E)
- Calendar-aware: fires 30 min before high-stakes meetings
- Shows as a card on Dashboard: "Board call in 35 min. Running lower than usual today."
- Uses CRS + sleep debt + calendar event metadata
- Design: same card format as Morning Wag but with orange accent border

**3. Follow-up Reply Threading on Proactive Messages**
- Every Morning Wag and Fetch Alert should have "Tell me more" / "What should I do?" buttons
- Clicking opens an inline chat thread contextual to that specific message
- Not just 👍/👎 feedback — actual conversational follow-up

**4. User-Configurable Routines** (Phase G+)
- Users write a natural language prompt + set a cadence
- "Every Sunday evening, tell me my recovery outlook for next week"
- Shows as a "My Routines" section in Profile or a dedicated Routines tab
- Each routine delivery has a chat follow-up button

**5. "Connected as [email]" on Integration Cards**
- Google integration now captures the email via OAuth userinfo
- Show: "Connected as arkpatil2717@gmail.com" instead of just "Connected"
- Each integration card: status dot (green/amber/gray) + label + last sync time + records synced

### Web Console vs Mobile App — What Goes Where

| Feature | Web Console | Mobile App |
|---------|-------------|------------|
| Sign up / onboarding | ✅ Primary | ✅ Alternative |
| Connect Google OAuth | ✅ Primary (opens browser) | Redirects to web |
| Connect Spotify OAuth | ✅ Primary | Redirects to web |
| Upload Apple Health XML | ✅ Only here (iOS users) | N/A (iOS uses HealthKit native) |
| Link Telegram | ✅ Shows code | Also shows code |
| Dashboard / Nap Score | ✅ Full | ✅ Full |
| Chat with Waldo | ✅ Full | ✅ Full |
| Constellation / Insights | ✅ Full | ✅ Full |
| Health Connect (Android live sync) | ❌ Can't (on-device API) | ✅ Only here |
| Background health sync | ❌ | ✅ Only here (HealthKit/HC) |
| Push notifications | ❌ | ✅ (future) |
| Admin user switching | ✅ (5-tap unlock) | ✅ (5-tap unlock) |

---

## Web Console Dashboard — Home Screen Design (The Brief)

> This section is the primary brief for designing the Waldo web console home screen. Read it fully before opening Figma.

### The Design Problem (Say This Out Loud Before You Start)

Every health dashboard shows you **numbers**. Apple Health shows rings. WHOOP shows recovery. Oura shows readiness. They all say: "Here is what happened to your body."

Waldo's dashboard says: **"Here is what your agent already did about it."**

The unit of the Waldo console is not a score. It is a **patrol entry** — a timestamped record of Waldo's observation and action. Scores are the *why*. Actions are the *what*. The home screen leads with agency, supports it with data.

This is the differentiation. Design to it relentlessly.

---

### The Four Dashboard Architectures (Pick One, Scaffold the Others)

#### Architecture 1: "The Morning State" ⭐ RECOMMENDED FOR LAUNCH

Score-led with agency panel below. Familiar pattern, differentiated by the Patrol section.

```
┌──────────────────────────────────────────────────────────────┐
│  Waldo   [dalmatian mood: wagging / steady / curled]  Apr 6  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              ╭──────────────────╮                           │
│              │        73        │  ← Nap Score              │
│              │     STEADY       │     (large arc gauge)     │
│              ╰──────────────────╯                           │
│                                                              │
│   Sleep ████████░  81    HRV  ██████░░  68                  │
│   Strain ████░░░░  9.2   Debt  ↑ 1.4h owed                 │
│                                                              │
│  ──────────────────────────────────────────────             │
│  THE PATROL — What Waldo handled today                       │
│  ──────────────────────────────────────────────             │
│  ☀  7:02am  Morning Wag sent                                │
│     "Rough night. Moved your 9am → 10:30. Nothing drastic." │
│                                                              │
│  ⚡  9:47am  Stress detected · Confidence 0.71              │
│     "HR elevated 18bpm over 12 min. Sent you a nudge."      │
│                                                              │
│  🧠 11:30am  Peak window open                               │
│     "CRS 78. HRV stabilized. Good time for deep work."      │
│                                                              │
│  [ Patrol active · Updated 4 min ago ]                      │
└──────────────────────────────────────────────────────────────┘
```

**Why this first:** Scores are familiar (users understand health numbers), Patrol section below is additive and explains what Waldo *did* with those numbers. Low learning curve, high differentiation.

---

#### Architecture 2: "The Patrol Timeline" — Agency-First

Flip the hierarchy. Start with what Waldo did — score is supporting context.

```
┌──────────────────────────────────────────────────────────────┐
│  Monday, April 6  ·  Nap Score: 73  ·  [Waldo avatar]       │
├──────────────────────────────────────────────────────────────┤
│  THE PATROL                                                  │
│                                                              │
│  ● 7:02am   ☀ Morning Wag                                   │
│     "Rough night — sleep short by 40 min."                  │
│     "Moved 9am → 10:30. Nothing drastic."          [open ↗] │
│                                                              │
│  ● 9:47am   ⚡ Fetch Alert                                   │
│     Stress confidence 0.71 · HR +18bpm sustained 12 min     │
│     Sent nudge. You replied: "Thanks, needed that." [open ↗] │
│                                                              │
│  ● 11:30am  🧠 Peak window detected                         │
│     CRS 78 · HRV stabilized. Marked as focus-protected.      │
│                                                              │
│  ● 2:00pm   😴 Circadian dip (predicted)                    │
│     Nothing heavy scheduled. All clear.                      │
│                                                              │
│  ─────────────────────────────────────────────              │
│  TODAY'S READINGS   Sleep 81 · HRV 68 · Strain 9.2          │
└──────────────────────────────────────────────────────────────┘
```

**Use for:** Power users, beta users who want to see everything Waldo did. Good as an alternate "detailed view" or as the default after users have used Waldo for 7+ days and trust it.

---

#### Architecture 3: "The Six Rings" — Full Dimensional (Phase 2 Vision)

Extend Apple's rings metaphor to all 6 life dimensions. Design this now, wire for Phase 2.

```
                  BODY (Nap Score 73) ────────── ● green arc
                 /
         SCHEDULE (MLS 6) ───────────────────── ● amber arc
        /
    COMMS (CSI 42) ──────────────────────────── ● green arc
        \
         TASKS (3 overdue) ──────────────────── ● red arc
                 \
                  MOOD (Mood Score 68) ─────── ● amber arc
                           \
                            WALDO IQ (34%) ── ● gray (connect more)
```

Six concentric arcs. Center shows today's master score. Each arc expandable. Empty rings (disconnected sources) show greyed-out with "Connect to unlock →".

**Design intent:** Empty rings are not a failure state — they are a hook. The user sees the rings for Calendar, Slack, Todoist all grayed out and thinks "I want those." It's a viral growth mechanic built into the UI.

---

#### Architecture 4: "The Constellation Map" — Phase 3 Vision Teaser

For the Constellation tab. Show discovered patterns as an interactive graph.

```
   [Sleep 81] ────── [HRV 68]
       |                  |
       └───── [Nap 73] ───┘ ← Waldo Intelligence hub
                   |
          [Calendar: heavy] ──── [Stress 0.71]
                                       |
                              "Tuesday 2pm pattern"
                             (3 occurrences, high conf)
```

Nodes = data points. Edges = correlations Waldo discovered. Orange glow on high-confidence patterns. Tap any node to see the raw Spot. Tap an edge to see the pattern and what Waldo does about it. This is the Phase 3 deep dive tab. Design the shell now; populate with real data later.

---

### Recommended Build Order

| Phase | Dashboard Architecture | When |
|-------|----------------------|------|
| **Launch (now)** | **Agentic Bento Grid** (see section below) — agent-generated, swipeable tiles with L1/L2/L3 depth | Build this sprint |
| **Launch (now)** | Architecture 1 (Morning State) lives inside the hero bento tile | Part of bento |
| **Launch (now)** | Architecture 2 (Patrol Timeline) as a bento tile + expanded view | Part of bento |
| **Phase 2** | Architecture 3 (Six Rings) as a new bento tile when sources connect | When Calendar/Slack connect |
| **Phase 2** | Workspace Smart Stack tile (Calendar/Tasks/Mail vertical cycling) | When Phase 2 adapters ship |
| **Phase 3** | Architecture 4 (Constellation) as dedicated tab + mini bento tile | When patterns accumulate |

---

### The Nap Score — Hero Visualization

The most important component in the entire product. Get this right first.

**Geometry:** 220° arc (not full circle — leaves room for zone labels at bottom). Filled clockwise from left bottom.

**Zone colors:**
- 80-100 · Peak → arc color `#059669` · background card `#D1FAE5`
- 65-79 · Steady → arc color `#D97706` · background card `#FEF3C7`
- 50-64 · Flagging → arc color `#EA580C` · background card `#FFF7ED`
- 0-49 · Low → arc color `#DC2626` · background card `#FEE2E2`
- No data → arc color `#D1D5DB` · label "Wear your Watch tonight"

**Center text:**
- Score number: 64px DM Sans 700, zone-colored
- Zone label: 14px DM Sans 500, muted (`#6B7280`)
- Below gauge: "Updated 4 min ago" in 12px muted

**CRS v2 upgrade path (Phase G):** The arc stays the same. But below it, instead of 4 component bars (Sleep/HRV/Circadian/Activity), show 3 pillar bars: Recovery / Autonomic State / Load. Each pillar is expandable to see sub-components. Design both states in Figma — v1 (4 bars) for launch, v2 (3 pillars) as a Figma variant. Don't build v2 yet — just have the design ready.

---

### The Patrol Section — Design Specification

The Patrol is the soul of the product. It answers "what has Waldo actually done for me today?"

**Entry types and their icons:**

| Type | Icon | Color | What it shows |
|------|------|-------|---------------|
| Morning Wag | ☀️ | Warm yellow | Daily brief sent — excerpt + "open" link to full message |
| Fetch Alert | ⚡ | Rose/orange | Stress detected — confidence + what was observed + nudge sent |
| Peak Window | 🧠 | Mint green | High CRS + stable HRV — "good time for deep work" |
| Pre-Activity Spot | 📅 | Amber | Calendar-aware — "Board call in 35 min. Running lower today." |
| Circadian Dip | 😴 | Muted | Expected afternoon dip — nothing needed / scheduled lightly |
| Fetch Suppressed | 🔇 | Gray | Stress detected but cooldown active — "already alerted today" |
| Morning Wag Skipped | — | Gray | CRS > 60 + stress confidence < 0.3 → rules pre-filter kicked in. Nothing to flag. |

**Empty state (no patrol entries yet):**
> "Patrol active. First scan at 7am tomorrow. Waldo's watching."
> — Dalmatian sniffing animation below.

**Entry design:**
- Left: colored dot + icon
- Middle: timestamp (bold) + event label + 1-line excerpt
- Right: "open ↗" chip if the message was sent (opens the full message in chat view)
- Bottom: user reaction if given (👍/👎/reply excerpt)

**Feedback loop (critical for learning):**
Every sent message entry shows the user's reaction. If they replied — show the first line of their reply. This closes the loop visually: "Waldo acted → you responded → Waldo learned."

---

### All Scores: What to Show, When, and How

#### Tier 1 — MVP (live today, show on launch)

| Score | Visual | Notes |
|-------|--------|-------|
| **Nap Score** | 220° arc, large, hero | The only full-size viz. Everything else is supporting. |
| **Sleep Score** | Horizontal bar + sleep stage breakdown strip | Show stages as color-coded segments (Core/Deep/REM/Awake) |
| **HRV Score** | Score pill + 7-day sparkline with baseline band | Show "Beat-to-beat" or "SDNN fallback" label |
| **Day Strain** | Segmented 0-21 bar (0-4 rest / 4-10 low / 10-14 med / 14-18 high / 18+ over) | WHOOP-style. Orange at 14+, red at 18+ |
| **Sleep Debt** | Debt meter: battery icon draining — "1.4h owed" + direction arrow (↑↓→) | "Paying off" (green arrow down) or "Accumulating" (red arrow up) |
| **Circadian Score** | Today's position on a time-of-day energy curve | Show current time as a dot on the arc. "You're at your dip — expected." |
| **Resting HR** | Number + 7-day trend sparkline | Flag if trending up over 7 days |
| **SpO2** | Number + "Normal" / "Low" tag | Flag if < 95% |
| **Respiratory Rate** | Number + trend | Flag if trending up (early illness signal) |
| **Stress Events (today)** | Count chip: "2 today" | Taps through to stress events log |

#### Tier 2 — Phase 2 (design empty states now, fill when connected)

Show as locked/grayed cards on dashboard with "Connect [Source] →" CTA:

| Score | Source | Empty State Copy |
|-------|--------|-----------------|
| **Meeting Load Score** | Calendar | "Connect Calendar to see your cognitive schedule load" |
| **Focus Time** | Calendar | "See how much uninterrupted time you actually have" |
| **Comms Stress Index** | Gmail / Slack | "Connect email to measure communication pressure" |
| **Task Pile-Up** | Todoist / Notion / Linear | "Connect your task manager to see cognitive weight of undone work" |
| **Task-Energy Match** | Calendar + tasks | "Waldo will match your hardest tasks to your peak windows" |
| **Mood Score** | Spotify | "Connect Spotify to infer mood from your listening patterns" |
| **Burnout Trajectory** | All sources | "Needs 30 days of data + 3+ sources. Keep going." |
| **Waldo Intelligence Score** | All sources | Progress bar: "2/10 sources connected. 34% intelligence." |

#### Tier 3 — Phase 3 (show as future cards, animated/teased)

- **Resilience Score** — "How fast you bounce back after bad days"
- **Recovery-Load Balance** — "Strain demanded vs recovery available"
- **Predicted Tomorrow Score** — "Tomorrow's Nap Score forecast: 71"
- **Constellation Patterns** — "3 patterns discovered across 90 days"
- **Waldo as MCP** — "Other AI agents can now query your biology"

Show Tier 3 features as teaser cards at the bottom of the dashboard: grayed, labeled "Coming soon," with a "Notify me" toggle. This builds anticipation without cluttering the launch UI.

---

### Dashboard Tab Structure (Web Console Navigation)

```
[ Today ] [ Patrol ] [ History ] [ Chat ] [ Insights ] [ Connect ]
```

| Tab | What's here |
|-----|-------------|
| **Today** | Morning State dashboard (Nap Score + Patrol entries for today) |
| **Patrol** | Full Patrol Timeline — all of Waldo's actions, searchable, filterable by type |
| **History** | 7/30/90 day Nap Score chart + day-dot strip + any day's full dashboard |
| **Chat** | Conversational thread with Waldo. Morning Wag appears here too. |
| **Insights** | Spots grid + confirmed patterns + Constellation (Phase 2) |
| **Connect** | All 10 adapters — connected/not connected, one-click OAuth or upload |

---

### Waldo Moods — Integration Into the Dashboard

The dalmatian avatar lives in the top-left of the dashboard header. It is not decoration — it IS the score at a glance.

| State | When | What Waldo does in the UI |
|-------|------|--------------------------|
| **Energized** | Nap Score 80+ | Tail animated, bouncing slightly. Bright spots. "Push hard today." |
| **Steady** | 65-79 | Sitting attentively, tail gently wagging. Calm. |
| **Flagging** | 50-64 | Sitting lower, ears drooping slightly. Protective. |
| **Depleted** | < 50 | Curled up. Spots faded. Minimal UI. Less information shown. |
| **Stress detected** | Fetch Alert active | Ears back, nose forward, alert posture. Orange border on page. |
| **No data** | No Apple Watch data yet | Head tilted, curious. "Wear your Watch tonight for a full score." |
| **Patrol active** | Background (always) | Small paw-print pulse animation in corner. "The Patrol never sleeps." |

**Design rule:** When Nap Score is < 50, reduce information density on the dashboard. Don't show 8 metric cards. Show 3: Nap Score, "Rest today," and the single most important thing. Waldo doesn't overwhelm depleted people with data.

---

### Progressive Disclosure — Don't Overwhelm

Waldo is NOT a dashboard. The UI must resist becoming one.

**The One Thing rule:** Every dashboard state should have exactly one primary action/insight surfaced. Not three. Not a list. One.

| State | The One Thing |
|-------|--------------|
| Peak (80+) | "Deep work window open. 3.5h until your dip." |
| Steady (65-79) | "Good baseline. Watch your meeting load this afternoon." |
| Flagging (50-64) | "One priority today. Protect your energy." |
| Depleted (<50) | "Rest. Waldo's handling the rest." |
| Stress detected | "Take 2 minutes. Waldo spotted something." |

Show this as a large, warm, conversational line directly below the Nap Score arc. This IS Waldo's voice. Not a notification. Not a card. Just text, like a text from a friend.

**Don't show by default:**
- All 10 metrics at once
- Raw HRV values (users don't know what "42ms RMSSD" means)
- More than 3 Patrol entries on the home screen (show "View all →")
- Confidence scores (0.71 stress confidence means nothing to a user — say "elevated" or "high")
- Formula breakdowns

**Always show:**
- Nap Score (the number and the zone)
- Waldo's one-line insight
- At least one Patrol entry ("what Waldo did today")
- When data was last updated

---

### Micro-Copy Standards for the Dashboard

Write like Waldo, not like a dashboard label:

| Don't write | Write instead |
|-------------|--------------|
| "HRV Score: 68" | "Heart rate variability — holding steady" |
| "Sleep Debt: 1.4h" | "1.4h in the hole — paying it back slowly" |
| "Stress Confidence: 0.71" | "High stress detected" |
| "Day Strain: 9.2" | "Light day. Body mostly rested." |
| "Circadian Score: 74" | "You're past your dip — second wind ahead." |
| "Fetch Alert triggered" | "Waldo spotted something and sent you a nudge" |
| "No data available" | "Wear your Watch tonight — Waldo's waiting" |
| "System error" | "Waldo lost signal. Back in a moment." |
| "Loading…" | "The Patrol is running…" |

---

### Phase 3 Features to Tease in the Design (Don't Build Yet, Design the Shell)

These live at the bottom of the "Connect" tab and the bottom of "Insights" as teaser cards. Make users want them before they exist.

**1. Waldo as MCP Server**
> "Other AI agents — Cursor, Notion, Claude — will soon be able to ask Waldo how you're doing before making decisions on your behalf. Your body API, for the agentic economy."
> [Notify me when live]

**2. Predicted Tomorrow Score**
> "Waldo will forecast your Nap Score 24h in advance based on your sleep debt trend, circadian phase, and historical patterns. 78% correlation on test data."
> [Coming in Phase 3]

**3. Voice Interface**
> "Ask Waldo anything. 'How did I sleep?' 'Am I burning out?' 'When's my best time to code today?' Voice replies from Waldo. Ambient health intelligence."
> [Coming in Phase 3]

**4. The Constellation (Phase 2)**
> "After 30 days, Waldo starts mapping your personal patterns. Correlations between sleep, stress, calendar, and output. A constellation of everything Waldo has learned about you."
> Teaser: show a blurred/semi-transparent constellation graph with "30 days to unlock" counter.

**5. Pack Tier (Team / Family)**
> "See cognitive readiness across your whole team before a sprint. Or check in on family members who share. Built for coaches, founders, and anyone who cares about the people they work with."
> [Coming in Phase 4]

---

### Key Design Decisions to Resolve Before Figma

Before starting the mockup, align on these:

1. **Arc shape:** 220° semi-arc (more space for score label below) or 270° (tighter, more compact)? Recommendation: 220° for web where space is available.

2. **Dalmatian size:** Full illustration (56px) in header vs small animated paw-print (24px) vs large mascot on loading/empty screen only? Recommendation: Small in header (subtle), large on empty/depleted states only.

3. **The Patrol — card list vs timeline dots:** Vertical timeline with dot + line (like a changelog) vs plain list of cards? Recommendation: Dot-timeline for visual character.

4. **Phase 2 empty states:** Grayed-out rings (visible but empty) vs completely hidden until connected? Recommendation: Grayed with CTA — visible as hooks, not gaps.

5. **Mobile responsiveness:** Web console is primary but must work on mobile browser before native app ships. Design web at 1280px wide, then verify at 375px.

6. **"Already on it" tagline placement:** Every loading state uses "Already on it." as the loading copy. Splash screen. Error fallback. Anywhere Waldo is working in the background.

---

## Complete Agent Capabilities — 23 Things Waldo Can Do

Every capability below can appear as a Patrol entry on the dashboard. Design an entry card for each.

### Proactive — Waldo Speaks First (11 capabilities)

| # | Capability | Trigger | Patrol Icon | Status |
|---|-----------|---------|-------------|--------|
| 1 | **Morning Wag** | Daily at wake time | ☀️ | ✅ Live |
| 2 | **Fetch Alert** | Stress confidence ≥0.60, 2h cooldown, max 3/day | ⚡ | ✅ Live |
| 3 | **Evening Review** | Daily at user's evening time | 🌙 | ✅ Live |
| 4 | **Pre-Activity Spot** | 30 min before high-stakes calendar events | 📅 | 🔵 Phase E |
| 5 | **Peak Window Alert** | CRS ≥78 + HRV stabilized | 🧠 | ✅ Live (template) |
| 6 | **Back-to-Back Circuit Breaker** | >3 meetings with <5min gap detected | 🔴 | 🔵 Phase 2 |
| 7 | **Focus Block Protection** | Guards peak energy window from interruption | 🛡️ | 🔵 Phase 2 |
| 8 | **Sleep Debt Alarm** | Sleep debt >3h and accumulating | 💤 | 🟡 Logic built |
| 9 | **Communication Overwhelm Alert** | CSI spike >80 | 📬 | 🔵 Phase 2 |
| 10 | **Weekly Pattern Breaker** | Detects recurring patterns (e.g., "Monday syndrome") | 🔄 | 🔵 Phase G |
| 11 | **Burnout Trajectory Warning** | 30-day BTS >0.6 | 🔥 | 🔵 Phase G |

### Task Intelligence — Waldo Plans Your Work (8 capabilities)

Waldo never blocks tasks. It adapts HOW, not WHETHER. Deadlines are sacred.

| # | Capability | What It Does | Status |
|---|-----------|-------------|--------|
| 12 | **Deadline-Aware Prioritization** | urgency × importance × energy_fit ranking | 🔵 Phase 2 |
| 13 | **Smart Sequencing** | Hardest at CRS peak, momentum starters when depleted | 🔵 Phase 2 |
| 14 | **Break-It-Down** | Splits heavy tasks into 25-min chunks for low-CRS days | 🔵 Phase 2 |
| 15 | **Overdue Triage** | "Pick 3 to do today, defer the rest" | 🔵 Phase 2 |
| 16 | **Recurring Task Surfacing** | Day-of-week patterns from task history | 🔵 Phase 2 |
| 17 | **Deferral Intelligence** | Uses predicted tomorrow CRS to defer or escalate | 🔵 Phase G |
| 18 | **Implicit Task Capture** | Extracts tasks from calendar follow-ups and stale threads | 🔵 Phase 3 |
| 19 | **Completion Tracking** | Learns which energy states produce best output per user | 🔵 Phase G |

### Automation — Waldo Acts (5 capabilities)

| # | Capability | What It Does | Status |
|---|-----------|-------------|--------|
| 20 | **Meeting Rescheduling Suggestions** | "Move this to 10:30 — your CRS will be higher" | 🔵 Phase 2 |
| 21 | **Auto-DND During Focus/Low-CRS** | Sets Slack status to DND during peak or depleted windows | 🔵 Phase 2 |
| 22 | **Recovery Day Enforcement** | After 3 consecutive low-CRS days, blocks all non-critical triggers | 🔵 Phase 2 |
| 23 | **Communication Batching** | Groups notifications into 2-3 daily windows | 🔵 Phase 3 |
| 24 | **Sleep Optimization Nudge** | Screen time reduction + bedtime reminder | 🔵 Phase 2 |

### Learning — Waldo Gets Smarter (6 capabilities)

These don't show as Patrol entries — they happen silently in the background. Show in the "What Waldo Knows" section of the Profile tab.

| # | What Waldo Learns | How | Status |
|---|------------------|-----|--------|
| 25 | Meeting → stress correlation | Detects which meeting types spike your stress | 🔵 Phase G |
| 26 | Music → mood → CRS link | Correlates Spotify audio features with next-day CRS | 🔵 Phase 2 |
| 27 | Coding time vs cognitive state | Learns when you produce best output | 🔵 Phase G |
| 28 | Email → sleep causation | After-hours email → poor sleep quality | 🔵 Phase 2 |
| 29 | Screen time → recovery correlation | Late screen time → lower next-day HRV | 🔵 Phase 2 |
| 30 | Task completion timing patterns | Learns your personal velocity at different CRS levels | 🔵 Phase G |

---

## 10 Adapters — The Connect Tab Design Spec

Each adapter gets a card in the "Connect" tab. Design the card with these elements:
- Provider logo (left)
- Provider name + one-line description (middle)
- Status: green dot "Connected" / gray dot "Not connected" / amber "Sync error"
- Connected state shows: "Connected as email@gmail.com · Last sync: 3h ago · 204 records"
- CTA: "Connect →" (accent button) or "Sync now" (ghost button) or "Disconnect" (destructive, in settings)

| # | Adapter | Provider(s) + Logos | Data It Gives Waldo | Status |
|---|---------|-------------------|-------------------|--------|
| 1 | **Body (HealthDataSource)** | Apple Watch · Fitbit · Oura · WHOOP · Galaxy Watch | HR, HRV, sleep stages, SpO2, respiratory rate, wrist temp, steps, VO2Max | ✅ HealthKit + HC built |
| 2 | **Schedule (CalendarProvider)** | Google Calendar · Outlook · Apple Calendar | Meeting load, focus gaps, boundary violations, back-to-back count | ✅ Google syncing |
| 3 | **Communication (EmailProvider)** | Gmail · Outlook (metadata only — never reads content) | Volume, after-hours ratio, response pressure, thread depth | ⚠️ Gmail 403 (reconnect needed) |
| 4 | **Tasks (TaskProvider)** | Google Tasks · Todoist · Notion · Linear · Microsoft To Do | Pile-up, velocity, urgency queue, procrastination index | ✅ Google Tasks syncing |
| 5 | **Mood (MusicProvider)** | Spotify · YouTube Music · Apple Music | Mood from audio features (valence, energy, tempo) | 🟡 Spotify OAuth ready |
| 6 | **Screen (ScreenTimeProvider)** | RescueTime | Screen quality, focus sessions, late-night digital | 🔴 Phase 2 |
| 7 | **Environment (WeatherProvider)** | Open-Meteo (automatic, no connect needed) | Temperature, UV index, humidity, AQI — from GPS location | ✅ Live |
| 8 | **Location (LocationAdapter)** | Phone GPS (automatic) | Real weather at your exact location, place context | ✅ Built (mobile) |
| 9 | **AI Brain (LLMProvider)** | Claude Haiku 4.5 (invisible to user) | Reasoning, conversation, message generation | ✅ Live |
| 10 | **Delivery (ChannelAdapter)** | Telegram · WhatsApp · Discord · Slack · In-App | How Waldo sends you messages | ✅ Telegram live |

**Special adapter: Apple Health Upload (iOS users without native app)**
- NOT an adapter card — it's an upload zone in the Body adapter section
- Shows: drag-and-drop zone + "How to export from iPhone" instructions
- After upload: shows days imported + Nap Score range

**Special adapter: Google Fit (Android wearable data via cloud)**
- Listed under Body adapter as a secondary source
- "Connect Google with health scopes" button
- Shows: steps, HR, sleep from any Android watch synced to Google Fit

### Connect Tab Empty State

When a user first arrives with nothing connected:

```
┌──────────────────────────────────────────────────────────────────┐
│  Connect your world to Waldo                                     │
│                                                                  │
│  Each source makes Waldo exponentially smarter.                 │
│  Start with your watch — everything else is optional.            │
│                                                                  │
│  [Body]      Apple Watch / Fitbit / Oura       [ Connect → ]    │
│  [Schedule]  Google Calendar / Outlook          [ Connect → ]    │
│  [Email]     Gmail / Outlook (metadata only)    [ Connect → ]    │
│  [Tasks]     Google Tasks / Todoist / Linear    [ Connect → ]    │
│  [Music]     Spotify / YouTube Music            [ Connect → ]    │
│  [Telegram]  Link via 6-digit code              [ Connect → ]    │
│                                                                  │
│  ─────────────────────────────────────────────────               │
│  Waldo Intelligence: 0/10 sources · 0% intelligence              │
│  [ ████░░░░░░░░░░░░░░░░ ]                                       │
│  "Connect your first source to start. Waldo's waiting."          │
└──────────────────────────────────────────────────────────────────┘
```

### Waldo Intelligence Progress Bar

Shows on the Connect tab AND as a small indicator on the dashboard.

```
Intelligence: 3/10 sources · 34%
[ ██████░░░░░░░░░░░░░░ ]
"Calendar + Gmail + Apple Watch. Add Spotify for mood awareness."
```

Each new source adds a specific capability message:
- Apple Watch: "Body intelligence active"
- Calendar: "Schedule awareness unlocked"
- Gmail: "Communication pressure tracking"
- Spotify: "Mood inference from your music"
- Tasks: "Work queue intelligence"

---

## Delivery Channels — Design the Notification Cards

| Channel | How Waldo delivers | Status | Design needed |
|---------|-------------------|--------|--------------|
| **Telegram** | Bot `@wadloboi1_test_bot` — full chat, Morning Wags, Fetch Alerts, feedback buttons | ✅ Live | Message card templates already exist |
| **Web Console Chat** | In-browser chat tab with conversation history | ✅ Live | Full chat UI already built |
| **WhatsApp** | Business API — same messages as Telegram | 🟡 Edge Function deployed, needs Meta credentials | Message card template (same as Telegram) |
| **Discord** | Webhook → DM or channel | 🔴 Phase 2 | Bot card template |
| **Slack** | App integration → DM | 🔴 Phase 2 | Slack message card |
| **In-App Push** | Native push notification on mobile | 🔴 Phase F | Push notification design |
| **Email Digest** | Weekly summary email | 🔴 Phase 3 | Email template |

---

## CRS v2 Three-Pillar Architecture (Phase G — Design For This)

> CRS v1 (flat 4-component) is live. CRS v2 is the upgrade target. **Design both** — v1 for launch, v2 for the UI evolution.

### v1 (Current): `Nap Score = Sleep(35%) + HRV(25%) + Circadian(25%) + Activity(15%)`
- Single 0-100 score. 4 component bars underneath.

### v2 (Target): `Nap Score = Recovery(50%) + Autonomic State(35%) + Load(15%)`
Three meaningful pillars that answer "why" your score is what it is:

| Pillar | Weight | Sub-components | What it answers |
|--------|--------|---------------|----------------|
| **Recovery Score** | 50% | Sleep Stage Quality + Respiratory Rate + SpO2 + Wrist Temp | "How well did your body restore itself overnight?" |
| **Current Autonomic State** | 35% | Morning HRV Z-score + Resting HR trend + Walking HR | "What state is your nervous system in right now?" |
| **Load Accumulation** | 15% | Energy expenditure + Physical effort + Timezone disruption + Daylight | "How much debt has accumulated?" |

**Design implications:**
- Dashboard needs 3 pillar cards instead of 4 component bars
- Each pillar is expandable → shows sub-components
- Per-pillar intervention routing: "Recovery was fine (94), but your nervous system is depleted (29)" → different recommendation than "Sleep was bad"
- Timezone disruption is a new signal no competitor shows

---

## Privacy Positioning — Use This Copy (Non-Negotiable)

**Frame:** "Derived insights, not raw data."

**Copy to use everywhere:** "Waldo doesn't store your HRV readings or your sleep staging data. It stores what they mean for you, today."

This is architecturally true — the Cloudflare Durable Object stores "HRV declining" not "HRV was 42ms". Raw health data stays encrypted in Supabase with Row-Level Security. The agent brain only sees summaries.

**"Already on it"** — appears on every Waldo-facing surface. Every loading state, every onboarding screen, every fallback message. Not "Waldo noticed X." Already on it.

---

## The Agentic Bento Grid — Definitive Dashboard Specification

> **This is the primary dashboard pattern for Waldo's web console.** Everything above (Morning State, Patrol Timeline, Six Rings, Constellation) lives INSIDE the bento grid as tiles. Read this section as the authoritative build spec.

### Why Bento Grid

A bento grid is not a layout technique — it's an **editorial hierarchy encoded as spatial size**. A 2x2 tile IS more important than a 1x1 tile. No labels needed. Eye-tracking data: 2.6x longer dwell on larger tiles vs smaller neighbors.

This maps to Waldo's information model:
- **Large hero tile** = what Waldo wants you to know RIGHT NOW
- **Medium tiles** = what Waldo did (Patrol entries, Morning Wag)
- **Small tiles** = supporting context (Sleep, HRV, Strain)
- **Absent tiles** = nothing happened there today — tiles that have no data don't render

That last point IS the "derived insights, not raw data" principle made visual. The grid is never the same twice — it reflects what Waldo thinks matters today.

### Why "Agentic" Bento (Not Static)

Static bento (Apple keynotes) = fixed layout, fixed content.
Agentic bento = **the grid is generated by the agent based on today's context:**

| Context | Grid adapts |
|---|---|
| Depleted (CRS < 50) | Hero tile expands. Other tiles shrink or hide. Reduced density. |
| Peak (CRS 80+) | Hero normal. Opportunity tiles appear: "Deep work window: 3.5h" |
| Stress detected | Fetch Alert tile expands, pulses orange border. Others dim. |
| No data yet | Single tile: Waldo with tilted head. "Wear your Watch tonight." |
| New pattern discovered | "Waldo Learned" tile pulses with celebration micro-animation |
| Phase 2 source connected | New tile slides in: "Calendar connected — unlocking schedule intelligence" |
| Phase 2 source NOT connected | Ghost tile: grayed, "Connect Calendar →" — empty ring as hook |

This is the **A2UI / Generative UI paradigm** applied to a bento layout. The agent declares which tiles exist; the client renders them natively.

---

### The Two-Axis Interaction Model

Each tile has two gesture dimensions that never conflict:

```
HORIZONTAL SWIPE (←→) = Depth into ONE metric
  L1 (What) → L2 (Why) → L3 (Prediction)
  Same topic, increasing transparency

VERTICAL SWIPE (↕) = Cycling between DIFFERENT integrations
  Calendar → Tasks → Mail → Mood
  Different topics stacked in one spatial slot (Apple Smart Stack pattern)

Page scroll is on the OUTER container — never conflicts with tile gestures.
```

#### Horizontal: L1 → L2 → L3 Transparency Layers

Every tile has up to 3 faces. Swipe left/right or tap to advance.

```
FACE 1 (L1 — What):          FACE 2 (L2 — Why):           FACE 3 (L3 — Prediction):
┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
│  Nap Score: 73     │       │  WHY 73?           │       │  WHAT'S NEXT       │
│  STEADY            │  ←→   │  Sleep ████ 81     │  ←→   │  Peak: 11am-1pm    │
│  "Second wind      │       │  HRV  ███░ 68     │       │  Dip: 2:30pm       │
│   ahead."          │       │  Circ ████ 74     │       │  Tomorrow: ~78     │
│  ● ○ ○             │       │  Act  ██░░ 52     │       │  (if bed by 11pm)  │
│  [Why this score?] │       │  ○ ● ○             │       │  ○ ○ ●             │
└────────────────────┘       └────────────────────┘       └────────────────────┘
```

**Discoverability rules (research-validated):**
- Dot indicator (● ○ ○) always visible at bottom — shows current face and total
- "Why this score?" text tap target on L1 — not swipe-only
- First-time animated nudge: tile slides 20px left and bounces back on first visit
- L1 is always the default face. User never lands on L2/L3.

#### Vertical: Smart Stack for Workspace Integrations

One bento slot holds multiple integration sub-cards. Swipe up/down to cycle. Dot-row indicator on the side.

```
┌──────────────────────────────┐
│  CALENDAR                    │  ↕ swipe vertically
│  4 meetings · MLS 6 (heavy)  │
│  Next: Standup in 2h         │
│  ● ○ ○ ○                    │
└──────────────────────────────┘
        ↕ swipe up
┌──────────────────────────────┐
│  TASKS                       │
│  3 overdue · 2 due today     │
│  Velocity: 0.8 (slowing)    │
│  ○ ● ○ ○                    │
└──────────────────────────────┘
        ↕ swipe up
┌──────────────────────────────┐
│  MAIL                        │
│  2 urgent · 5 unread         │
│  Response pressure: 0.4      │
│  ○ ○ ● ○                    │
└──────────────────────────────┘
```

**The smart part:** Waldo rotates which sub-card is on top based on context:
- Morning → Calendar on top (what's your day look like?)
- 3pm → Tasks on top (what still needs doing?)
- After hours → Mood on top (how are you winding down?)

---

### The Full Bento Grid Layout

```
┌─────────────────────────┬────────────┬────────────┐
│                         │            │            │
│      NAP SCORE          │  MORNING   │  SLEEP     │
│      73 · Steady        │  WAG       │  81 · 6h   │
│      [Waldo mood]       │  "Rough    │  12m       │
│      "Second wind       │   night.   │  [stages]  │
│       ahead."           │   Moved    │            │
│                         │   your 9am"│            │
│         2x2             │    1x2     │    1x1     │
├────────────┬────────────┼────────────┤            │
│            │            │            ├────────────┤
│  THE       │  HRV       │  FETCH     │  STRAIN    │
│  PATROL    │  68        │  ALERT     │  9.2       │
│  3 actions │  ↑ trend   │  1 today   │  Light day │
│  today     │  sparkline │  @ 9:47am  │            │
│    1x1     │    1x1     │    1x1     │    1x1     │
├────────────┴────────────┼────────────┴────────────┤
│                         │                         │
│  WALDO LEARNED          │  WORKSPACE STACK ↕      │
│  "Your stress spikes    │  Calendar / Tasks /     │
│   Tuesdays 2-4pm"      │  Mail / Mood            │
│  [3 patterns · 90 days] │  (vertical smart stack) │
│         1x2             │         1x2             │
└─────────────────────────┴─────────────────────────┘
```

**Mobile (375px):** 2-column grid. Hero tile spans full width. All other tiles collapse to 1x1, stacked vertically. Smart stack remains swipeable.

---

### The L1/L2/L3 Per Tile

| Tile | L1 (What) | L2 (Why) | L3 (Prediction) |
|---|---|---|---|
| **Nap Score** | 73 Steady | Component breakdown: Sleep 81, HRV 68, Circ 74, Activity 52 | "Peak window 11am-1pm. Dip at 2:30pm. Tomorrow ~78 if bed by 11pm." |
| **Morning Wag** | Message excerpt | "Triggered by: 5h sleep + CRS below 60 at wake time" | "Tomorrow: aim for 11pm bedtime for a projected 78" |
| **Sleep** | 81 · 6h12m · stage bar | Duration penalty -10, deep% good, efficiency 89%, debt context | "Paying off 0.4h debt. 2 more good nights to clear." |
| **HRV** | 68 · sparkline | "4% below your 7-day baseline. Time-normalized: block 3 (afternoon)" | "Trending up over 7 days. Expect recovery by Wednesday." |
| **Patrol** | "3 actions today" | Full timeline with reasoning per entry | "Quiet afternoon expected. Next check: 6pm." |
| **Fetch Alert** | "1 alert at 9:47am" | "HR +18bpm for 12min while sedentary. Matched 3 previous events." | "Similar pattern last Tuesday 2-4pm. Watching." |
| **Waldo Learned** | "2 patterns this week" | Correlation details + confidence + signal count | "Watching for Tuesday spike. Will alert 30min before." |
| **Workspace Stack** | Calendar: 4 meetings, MLS 6 | Back-to-back count, boundary violations, focus gaps | "Heavy 2-4pm. Protect morning for deep work." |

---

### Onboarding → Layout Generation

Opinionated defaults beat blank canvases. Oura and WHOOP never show a layout builder. Neither does Waldo.

**Onboarding flow (3 questions → default grid):**

```
Step 1: "What should Waldo watch first?"
  [ ] My energy levels    → prioritize Nap Score, Sleep, HRV tiles
  [ ] My stress           → prioritize Fetch Alert, Patrol, HRV tiles
  [ ] My work-life balance → prioritize Workspace Stack, Patrol tiles
  [ ] Everything          → Waldo's default layout

Step 2: "When does your day start?"
  → Sets Morning Wag time + Circadian calculation

Step 3: Connect sources
  → Each connected source unlocks tiles in the grid
```

**Layout presets generated from Step 1:**

| Focus | Hero (2x2) | Medium tiles | Small tiles |
|-------|-----------|--------------|-------------|
| Energy | Nap Score + mood | Sleep (1x2) + Morning Wag (1x2) | HRV, Strain, Debt, Patrol |
| Stress | Nap Score + mood | Fetch Alert (1x2) + Patrol (1x2) | HRV, Sleep Debt, Strain |
| Work-balance | Nap Score + mood | Workspace Stack (1x2) + Patrol (1x2) | Sleep, HRV, Morning Wag |
| Everything | Nap Score + mood | Morning Wag (1x2) + Patrol (1x1) | All small tiles shown |

**No layout picker on launch.** Power users find "Customize dashboard" in Profile → Preferences. 95% of users never touch it.

**Customization (for power users):**
- Drag tiles to rearrange
- Resize tiles (1x1 ↔ 1x2 ↔ 2x2)
- Hide/show tiles
- Pin tiles to always show (override agent's context-based hiding)

---

### The Waldo Chat Sidebar

The agent is always one tap away. Persistent sidebar, collapsed by default.

```
┌────────┬──────────────────────────────────────────┐
│        │                                          │
│ WALDO  │         BENTO GRID DASHBOARD             │
│ CHAT   │                                          │
│        │  ┌──────────┬──────┬──────┐              │
│ [mini  │  │ Nap Score│ Wag  │Sleep │              │
│  thread│  │   73     │      │ 81   │              │
│  here] │  │          │      │      │              │
│        │  ├─────┬────┼──────┤──────┤              │
│        │  │Patrol│HRV │Fetch │Strain│             │
│        │  ├─────┴────┼──────┴──────┤              │
│ "Ask   │  │ Learned  │ Workspace   │              │
│  Waldo │  │          │ Stack       │              │
│  any-  │  └──────────┴─────────────┘              │
│  thing"│                                          │
│  [paw] │                                          │
└────────┴──────────────────────────────────────────┘
```

- Collapsed = paw icon in bottom-right corner
- Click → slides out mini chat panel (320px wide)
- Full chat → separate tab
- **Tile-to-chat:** long-press any tile → "Ask Waldo about this" → opens sidebar with that tile's context pre-loaded (e.g., long-press Sleep tile → "Tell me about last night's sleep")
- Chat supports **inline rich cards** — when you ask "how did I sleep?", Waldo streams a mini sleep stage chart + score directly into the chat bubble, not just text (Generative UI via Vercel AI SDK `streamUI`)

---

### Agentic UI Patterns Encoded in the Bento

These are the 2026 agentic UI paradigms built into Waldo's grid:

| Pattern | Implementation | Research source |
|---|---|---|
| **Activity Feed** | The Patrol tile + expanded Patrol tab | GitHub Copilot Workspace, Linear |
| **Generative UI** | Agent decides which tiles to render based on CRS zone | A2UI (Google), CopilotKit |
| **Ambient / Background** | Morning Wag + Fetch Alert delivered to channel; dashboard shows results | Notion 3.0, Apple Intelligence |
| **Chat + Structured Cards** | Sidebar chat with inline rich cards (CRS gauge, sleep chart in chat) | Vercel AI SDK `streamUI` |
| **Thought Log (Trust Signal)** | L2 face on every tile — "why Waldo did this" | Perplexity, Claude artifacts |
| **Pre-Action Preview** | Phase 3: "I'm about to move your 2pm. [Approve] [Modify] [Skip]" | Copilot Workspace, Devin |
| **Autonomy Receipt** | End-of-day Patrol summary: "4 actions. 2 approved. 0 rejected." | Novel to Waldo |
| **Progressive Disclosure** | L1→L2→L3 swipe depth; tiles appear as data arrives | CHI 2025: Gradual Generation |
| **Smart Stack** | Workspace tile cycles Calendar→Tasks→Mail by time of day | Apple iOS Widget Stack |
| **SAAT Transparency** | L1=what, L2=why, L3=prediction on every tile | DoD SAAT model, Stanford HCI |

### The Three-Protocol Stack (Technical Context for Designers)

Waldo sits at the intersection of three emerging agent protocols:

```
AG-UI  (Agent ↔ Frontend)  → How Waldo streams state to the bento grid in real-time
MCP    (Agent ↔ Tools)     → How Waldo reads health data, calendar, tasks
A2A    (Agent ↔ Agent)     → How Waldo coordinates with other agents (Pack tier)
```

The bento grid is the **AG-UI surface** — each tile reacts to a live event stream from the Durable Object. When Waldo detects stress, the Fetch Alert tile appears in real-time without page refresh. When a Morning Wag is sent, the tile updates. This is not polling — it's event-driven.

---

### Bento Design Rules

1. **One idea per tile.** If you need a subtitle to explain the tile, it's doing too much.
2. **Hero tile is always Nap Score** — 2x2, top-left. Non-negotiable anchor.
3. **Tiles without data don't render.** No "0 stress events today." Absence = nothing happened = grid shrinks.
4. **Max 8-10 tiles on MVP.** Apple keynotes use 6-9 boxes per slide. Same principle.
5. **12-16px uniform gap** between tiles. White space does separation.
6. **Each tile has one primary tap target** — expand in-place or navigate to detail.
7. **Ghost tiles for unconnected sources** — grayed, single CTA. "Connect Calendar →"
8. **Mobile: 2-column.** Hero spans full width. No horizontal scroll.
9. **Animation: staggered tile entrance.** 50ms delay between tiles on load.
10. **Color from the zone, not the tile type.** Hero tile is rose when depleted, mint when peak. The grid's color temperature tells the story before a number is read.
11. **Dot indicators on every swipeable tile.** (● ○ ○) for L1/L2/L3. Vertical dots for smart stacks.
12. **Always provide a tap fallback** for swipe gestures. Gesture-only = undiscoverable.
13. **First-time nudge animation** on swipeable tiles. Slide 20px and bounce back once.

---

### What Makes This a New Pattern (No One Has Shipped This)

| Element | Exists elsewhere? | Waldo's version |
|---|---|---|
| Bento grid dashboard | Apple, Datadog | **Agent-generated, context-adaptive** |
| Horizontal swipe for depth | Rare | **L1→L2→L3 transparency model per tile** |
| Vertical smart stack | Apple iOS widgets | **Agent-rotated by time + CRS zone** |
| AI-generated layout from onboarding | Not in consumer health | **3-question → personalized default grid** |
| Persistent agent chat sidebar | Notion AI, Cursor | **Connected to any tile via long-press** |
| Tiles appear/disappear by context | A2UI spec only | **Depleted = fewer tiles, stress = alert expands** |
| Inline rich cards in chat | Vercel AI SDK | **CRS gauge, sleep chart streamed into conversation** |
| End-of-day autonomy receipt | Novel | **"4 actions taken. 2 approved. 0 rejected."** |

The combination = **Agentic Bento**. A dashboard that is generated by the agent, adapts to biological state, has depth within each tile, has breadth within integration slots, and always has the agent one tap away. This is Waldo's contribution to the agentic UI paradigm.

---

## Visual References — Look at These Before Designing

### Bento Grid References
- **Apple Keynote Bento Slides** — The gold standard for bento as information hierarchy. Study the September 2023 iPhone 15 event slides: https://www.deck.gallery/deck/bento-grid-slides-from-apples-september-23-event
- **43 SaaS Bento Grid Examples (SaaSFrame)** — Production bento patterns across real products: https://www.saasframe.io/patterns/bento-grid
- **Aceternity UI Bento Component** — React bento grid component with hover effects and conditional rendering: https://ui.aceternity.com/components/bento-grid
- **LogRocket: Bite-Sized Bento Grid UX** — Deep dive on when bento works and fails in product UIs: https://blog.logrocket.com/ux-design/bento-grids-ux/
- **SaaSFrame: Designing Bento Grids That Actually Work (2026)** — Anti-patterns, sizing rules, responsive strategies: https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide

### Health Dashboard References
- **WHOOP 4.0 Home Screen** — Recovery score hero, supporting metrics below, progressive disclosure: https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/
- **Oura Ring App** — Readiness/Sleep/Activity rings, daily insight cards, minimal number-forward design
- **Apple Health Summary Tab** — Adaptive card layout, favorites pinning, trend sparklines in compact cards

### Agentic UI References
- **AG-UI Protocol Docs** — The event-streaming standard for agent-to-frontend: https://docs.ag-ui.com/introduction
- **A2UI (Google)** — Agent-driven declarative UI spec: https://a2ui.org/
- **CopilotKit Generative UI Guide (2026)** — Three tiers of generative UI (static, declarative, full surface): https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026
- **Vercel AI SDK: Generative UI** — `streamUI` pattern for tool-to-component: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- **MCP Apps (Anthropic + OpenAI)** — UI inside agent tool responses: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/

### Swipeable Card & Smart Stack References
- **Apple iOS Widget Smart Stack** — Vertical cycling, on-device ML rotation, dot indicators: Study on any iPhone (long-press home screen → add Smart Stack)
- **NN/g: Swipe to Trigger Contextual Actions** — Research on gesture discoverability: https://www.nngroup.com/articles/contextual-swipe/
- **NN/g: Carousels on Mobile** — When horizontal swipe works (and when it fails): https://www.nngroup.com/articles/mobile-carousels/

### Transparency & Trust Research
- **Smashing Magazine: Designing for Agentic AI (2026)** — Practical UX patterns for agent oversight: https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/
- **Google Research: Generative UI** — LLMs generating custom interactive UIs: https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/
- **OrchVis: Multi-Agent Orchestration Visibility** — Goal-level oversight, not action-level: https://arxiv.org/abs/2510.24937
- **Stanford: Proactive AI Interaction Patterns** — "Why now" surface as the critical design gap: https://arxiv.org/html/2601.10253

### Game UI Inspiration
- **Assassin's Creed Black Flag Main Menu** — The original bento-as-game-hub. Each tile = portal into a system with live preview. Study the spatial hierarchy and how tile size communicates importance.
- **Destiny 2 Director Screen** — Node-based navigation where each node is a world/activity. Relevant for Constellation view.

### Animation & Micro-Interaction References
- **Framer Motion** — Production animation library for React. Use for tile entrance stagger, swipe physics, and mood transitions.
- **GSAP ScrollTrigger** — For the landing page bento animation (tiles appear as you scroll).
- **Lottie** — For Waldo mood animations (dalmatian states). Lightweight, vector-based, cross-platform.

---

## What NOT to Design (Yet)

- Dark mode — Phase 2
- iPad / tablet — Phase 3
- Apple Watch companion app — Phase 3
- Voice interface — Phase 3
- Team/enterprise dashboard — Phase 4
- Animations/micro-interactions — after core screens approved
- WhatsApp integration UI — wait until Meta Business verification (1-2 weeks)

---

## Files to Reference

| File | What it contains |
|------|-----------------|
| `Docs/WALDO_NORTHSTAR.md` | Vision, problem, why we win |
| `Docs/WALDO_ONEPAGER.md` | Investor/pitch summary |
| `Docs/WALDO_ADAPTER_ECOSYSTEM.md` | All 32 metrics with exact formulas |
| `Docs/WALDO_AGENT_INTELLIGENCE.md` | Agent personality, Waldo Moods, message types |
| `Docs/MVP_SCOPE.md` | Exact MVP definition, what's IN/OUT |
| `waldo-app/src/screens/DashboardScreen.tsx` | Current functional dashboard (NativeWind) |
| `waldo-app/src/components/CrsGauge.tsx` | Current SVG gauge implementation |
| `waldo-app/src/components/ComponentCard.tsx` | Current component score cards |

---

## Questions? Ask Shivansh.

**The one design principle above all:**
Waldo acts. It doesn't report. Every screen should feel like something already happened — not like you're checking a number.

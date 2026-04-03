# Waldo — Designer Brief
**Version 2.0 — April 2026**
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

## What NOT to Design (Yet)

- Dark mode — Phase 2
- iPad / tablet — Phase 3
- Apple Watch app — Phase 3
- Voice interface — Phase 3
- Team/enterprise dashboard — Phase 4
- Animations/micro-interactions — after core screens approved

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

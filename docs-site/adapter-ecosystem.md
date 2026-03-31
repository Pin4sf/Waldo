# Adapter ecosystem

Waldo uses **10 adapter interfaces** across **6 dimensions** of a person's life. Every external integration goes through an adapter — agent logic never references a specific provider. Adding a new integration = implement the interface. No changes to CRS, prompt builder, or agent reasoning.

## The 10 adapters

```mermaid
graph LR
    subgraph User["User's Life"]
        direction TB
        BODY["🫀 Body"]
        SCHED["📅 Schedule"]
        COMM["💬 Communication"]
        TASK["✅ Tasks"]
        MOOD["🎵 Mood"]
        SCREEN["📱 Screen"]
    end

    subgraph Adapters["Adapter Layer"]
        direction TB
        HDS["HealthDataSource"]
        CAL["CalendarProvider"]
        EMAIL["EmailProvider"]
        TP["TaskProvider"]
        MP["MusicProvider"]
        STP["ScreenTimeProvider"]
        WP["WeatherProvider"]
        SA["StorageAdapter"]
        LLM["LLMProvider"]
        CH["ChannelAdapter"]
    end

    subgraph Providers["Implementations"]
        direction TB
        P1["Apple Watch · Oura · Fitbit · WHOOP"]
        P2["Google Calendar · Outlook · Apple Calendar"]
        P3["Gmail · Outlook — metadata only"]
        P4["Todoist · Notion · Linear · Google Tasks"]
        P5["Spotify · YouTube Music · Apple Music"]
        P6["RescueTime"]
        P7["Open-Meteo weather + AQI"]
        P8["op-sqlite + SQLCipher"]
        P9["Claude Haiku · multi-model"]
        P10["Telegram · WhatsApp · Discord · Slack"]
    end

    BODY --> HDS --> P1
    SCHED --> CAL --> P2
    COMM --> EMAIL --> P3
    TASK --> TP --> P4
    MOOD --> MP --> P5
    SCREEN --> STP --> P6
    HDS -.-> WP --> P7
    HDS -.-> SA --> P8
    HDS -.-> LLM --> P9
    HDS -.-> CH --> P10

    style User fill:#fef3c7,stroke:#f59e0b
    style Adapters fill:#e0f2fe,stroke:#0ea5e9
    style Providers fill:#f0fdf4,stroke:#22c55e
```

## 32 metrics across 6 dimensions

```mermaid
mindmap
  root((Waldo<br/>Intelligence))
    Body
      CRS 0-100
      Sleep Score
      HRV Score
      Circadian Score
      Activity Score
      Day Strain 0-21
      Sleep Debt hours
      Stress Confidence
      Resilience
      Recovery-Load Balance
    Schedule
      Meeting Load Score
      Focus Time Score
      Back-to-Back Count
      Boundary Violations
      Schedule Density
    Communication
      Communication Stress Index
      Response Pressure
      After-Hours Ratio
      Volume Spike
      Thread Depth
    Tasks
      Task Pile-Up
      Completion Velocity
      Procrastination Index
      Urgency Queue
      Task-Energy Match
    Mood and Screen
      Mood Score
      Screen Time Quality
      Late-Night Digital
      Focus Sessions
    Combined
      Daily Cognitive Load
      Burnout Trajectory
      Intelligence Score
```

## How metrics flow into the agent

```mermaid
flowchart TB
    subgraph Sources["Data Sources"]
        AW["Apple Watch"]
        GC["Google Calendar"]
        GM["Gmail"]
        TD["Todoist"]
        SP["Spotify"]
        RT["RescueTime"]
    end

    subgraph Compute["Computation Layer"]
        CRS["CRS Engine<br/>Sleep×0.35 + HRV×0.25<br/>+ Circadian×0.25 + Activity×0.15"]
        STRAIN["Strain Engine<br/>TRIMP → 0-21"]
        DEBT["Sleep Debt<br/>14-day weighted"]
        STRESS["Stress Detector<br/>4-signal confidence"]
        MLS["Meeting Load Score<br/>duration × adjacency × attendees"]
        CSI["Comm Stress Index<br/>volume + pressure + after-hours"]
        TASKS["Task Pressure<br/>pile-up + velocity + urgency"]
        MOOD["Mood Inference<br/>Spotify valence + energy"]
        DCL["Daily Cognitive Load<br/>= MLS + CSI + Tasks + Debt"]
        BTS["Burnout Trajectory<br/>30-day rolling slopes"]
    end

    subgraph Intelligence["Intelligence Layer"]
        PATTERNS["Pattern Detector<br/>375 cross-source correlations"]
        SPOTS["Spots Engine<br/>1,498+ observations"]
        PROFILE["User Intelligence<br/>routines, habits, baselines"]
    end

    subgraph Agent["Agent"]
        PROMPT["Prompt Builder<br/>11 sections, ~2,100 chars"]
        SOUL["Soul File<br/>5 zones × 3 modes"]
        CLAUDE["Claude Haiku"]
    end

    subgraph Output["Waldo Output"]
        MW["Morning Wag"]
        FA["Fetch Alert"]
        NUDGE["Smart Nudge"]
        AUTO["Automation"]
    end

    AW --> CRS & STRAIN & DEBT & STRESS
    GC --> MLS
    GM --> CSI
    TD --> TASKS
    SP --> MOOD
    RT --> DCL

    CRS & STRAIN & DEBT & STRESS & MLS & CSI & TASKS & MOOD --> PATTERNS
    CRS & STRAIN & DEBT & STRESS & MLS & CSI --> SPOTS
    PATTERNS & SPOTS --> PROFILE

    CRS & MLS & CSI & TASKS & MOOD & DCL & BTS --> PROMPT
    PROFILE & PATTERNS --> PROMPT
    SOUL --> CLAUDE
    PROMPT --> CLAUDE

    CLAUDE --> MW & FA & NUDGE & AUTO

    style Sources fill:#eef2ff,stroke:#6366f1
    style Compute fill:#f0fdf4,stroke:#22c55e
    style Intelligence fill:#fef3c7,stroke:#f59e0b
    style Agent fill:#fce7f3,stroke:#ec4899
    style Output fill:#e0f2fe,stroke:#0ea5e9
```

## Key formulas

### CRS (Cognitive Readiness Score)
```
CRS = (Sleep × 0.35) + (HRV × 0.25) + (Circadian × 0.25) + (Activity × 0.15)
Range: 0-100. Zones: Peak (80+), Moderate (50-79), Low (<50)
```

### Day Strain (cardiovascular load)
```
TRIMP = Σ (zone_minutes × zone_weight)
Weights: [1.0, 1.5, 2.5, 4.0, 8.0] for zones 1-5
Strain = min(21, log10(TRIMP + 1) × 7)
```

### Stress Confidence
```
Confidence = 0.35×(HRV drop) + 0.25×(HR elevation) + 0.20×(duration) + 0.20×(sedentary)
Threshold: ≥0.60 fires Fetch Alert. 2h cooldown. Max 3/day.
```

### Meeting Load Score
```
Per meeting: (duration/30min) × adjacency × attendees × time_factor
adjacency: 1.0 (>15min gap), 1.4 (5-15min), 1.8 (back-to-back)
Daily MLS = Σ all meetings
```

### Daily Cognitive Load
```
DCL = normalize(MLS)×0.25 + normalize(CSI)×0.25 + normalize(TaskPileUp)×0.20 + normalize(SleepDebt)×0.30
```

### Burnout Trajectory (30-day)
```
BTS = HRV_slope×0.35 + sleep_debt_trend×0.25 + after_hours_trend×0.20 + MLS_trend×0.20
> 0.6 = burnout trajectory
```

## Cross-source correlation math

```
10 data sources
C(10,2) = 45 two-source pairs
C(10,3) = 120 three-source triples
C(10,4) = 210 four-source combos
Total: 375 unique correlations

Each produces: Spot, Pattern, Nudge, or Automation
Theoretical: 375 × 4 = 1,500 unique agent behaviors
Practical: ~80-100 meaningful behaviors
```

Every new data source multiplies intelligence exponentially, not linearly.

## 23 agent capabilities

### Proactive (11)
| # | Capability | Data sources needed |
|---|-----------|-------------------|
| 1 | Enhanced Morning Wag | Health + Calendar + Tasks |
| 2 | Pre-meeting energy prep | Health + Calendar |
| 3 | Back-to-back circuit breaker | Health + Calendar |
| 4 | Focus block protection | Calendar + Health |
| 5 | Sleep debt alarm | Health |
| 6 | Communication overwhelm | Email/Slack + Health |
| 7 | Weekly pattern breaker | Health + Calendar (pattern) |
| 8 | Burnout trajectory warning | Health + Calendar + Email (30-day) |
| 9 | Post-exercise cognitive boost | Health + Tasks |
| 10 | Evening review | All sources |
| 11 | Weekend recovery forecast | Health + Calendar |

### Task intelligence (8) — adapts HOW, never blocks WHAT
> Waldo never says "don't do this task." Deadlines are real. Waldo helps get it done.

| # | Capability | What Waldo does |
|---|-----------|----------------|
| 12 | Deadline-aware prioritization | Ranks by urgency×0.4 + importance×0.3 + energy_fit×0.3. Due-today always surfaces. |
| 13 | Smart sequencing | Hardest first during peak, admin during trough, momentum starter when depleted |
| 14 | Break-it-down | Low CRS + deadline → "25-min chunks with 5-min breaks. Start with the section you know." |
| 15 | Overdue triage | >10 overdue → "Pick 3 that matter. Defer, delegate, or delete the rest." |
| 16 | Recurring surfacing | Day-of-week match → "It's Monday. Workout: Legs. CRS 71. Good to go?" |
| 17 | Deferral intelligence | Due tomorrow + low today + predicted recovery → "Push through now or hit it fresh?" |
| 18 | Implicit capture | Detects follow-ups from calendar events, stale email threads, patterns |
| 19 | Completion tracking | Learns which energy states are productive for this user over time |

### Automation (5)
| # | Capability | What Waldo does |
|---|-----------|----------------|
| 20 | Meeting rescheduling | "Push 8am to 10am — predicted CRS jumps 52 → 68" |
| 21 | Auto-DND | Sets Slack status during focus/low-CRS |
| 22 | Recovery day enforcement | Marks light-calendar + low-CRS days |
| 23 | Communication batching | Suggests email blocks, not continuous |
| 24 | Sleep optimization | Screen time nudge based on data |

### Task nudge examples

| Situation | CRS | What Waldo says |
|-----------|-----|----------------|
| Deadline today, good energy | 82 | "82 and the deadline is today. Knock it out before noon." |
| Deadline today, low energy | 45 | "45 but this is due today. Three 25-min chunks. Start with what you know. Good enough beats perfect." |
| Deadline tomorrow, depleted | 38 | "Due tomorrow. You're at 38 today, predicted 68 tomorrow morning. Push through or hit it fresh?" |
| 13 tasks overdue | 65 | "13 overdue. That number is the problem. Pick 3 that matter. Defer the rest." |
| No momentum, low energy | 35 | "Start with one thing. Reply to one message. Then see how you feel." |
| Peak + task completed | 82 | "You cleared that during your peak window. That's the pattern — hard stuff before noon." |
| Recurring task detected | 71 | "It's Monday. Your list says 'Workout: Legs'. CRS 71. Good to go?" |

### Learning (6)
| # | Pattern | Cross-source insight |
|---|---------|---------------------|
| 25 | Meeting → stress | "Monday 2pm sync drops your HRV 25%" |
| 26 | Music → mood → CRS | "Low-energy playlists after 3pm → CRS <60 next day" |
| 27 | Coding time vs state | "You commit at 10pm but CRS says that's decline" |
| 28 | Email → sleep | "Emails after 10pm → sleep efficiency drops 8%" |
| 29 | Screen → recovery | "<2h recreational screen → CRS 9 points higher" |
| 30 | Task timing | "72% of completions during CRS 70+" |

## Competitive position

```mermaid
quadrantChart
    title Agent capability vs biological awareness
    x-axis Low biological awareness --> High biological awareness
    y-axis Low agent capability --> High agent capability
    quadrant-1 The goal
    quadrant-2 Smart but body-blind
    quadrant-3 Neither
    quadrant-4 Aware but passive
    Waldo Phase 2: [0.85, 0.80]
    Waldo MVP: [0.75, 0.45]
    Motion: [0.15, 0.75]
    Reclaim: [0.10, 0.60]
    WHOOP: [0.80, 0.15]
    Oura: [0.70, 0.10]
    RISE: [0.55, 0.05]
    Sunsama: [0.20, 0.30]
    Lifestack: [0.60, 0.25]
```

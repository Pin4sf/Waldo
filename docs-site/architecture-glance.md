# Architecture at a Glance

Waldo is a **personal cognitive operating system** built in three layers: Body Intelligence (MVP) → Task Intelligence (Phase 2) → Autonomous Personal OS (Phase 3+). The architecture below shows the full system — MVP components are solid, future components expand on the same foundation.

## The Agent OS — Full System

```mermaid
graph TB
    subgraph Input["Data Input Layer"]
        AW["Apple Watch<br/>(HealthKit)"] -->|Beat-to-beat IBI| NM["Native Modules<br/>(Swift / Kotlin)"]
        GW["Android Watch<br/>(Health Connect)"] -->|HR, Sleep, Steps| NM
    end

    subgraph Phone["On-Phone Processing"]
        NM -->|Encrypted Write| SQL["op-sqlite<br/>+ SQLCipher"]
        SQL -->|Read| CRS["CRS Engine<br/>(TypeScript, Offline)"]
        CRS -->|Score 0-100| SYNC["Supabase Sync"]
    end

    subgraph Cloud["Supabase Backend"]
        SYNC -->|health_snapshots| PG["Postgres + RLS"]
        CRON["pg_cron<br/>(every 15 min)"] -->|check-triggers| EF["Edge Function"]
        EF -->|Rules Pre-Filter| DECIDE{CRS > 60 AND<br/>confidence < 0.3?}
        DECIDE -->|Yes: SKIP| LOG["Log Only<br/>($0)"]
        DECIDE -->|No: INVOKE| AGENT["Agent Loop"]
    end

    subgraph AgentCore["Agent Core"]
        AGENT -->|Prompt Builder<br/>25 fields| HAIKU["Claude Haiku 4.5<br/>(Messages API + tool_use)"]
        HAIKU -->|Tool calls| TOOLS["8 MVP Tools"]
        TOOLS -->|Results| HAIKU
        HAIKU -->|Max 3 iterations<br/>50s timeout| RESPONSE["Generated Message"]
    end

    subgraph Delivery["Delivery + Feedback"]
        RESPONSE -->|Quality Gates<br/>5 checks| GATE{Pass all<br/>gates?}
        GATE -->|Yes| TG["Channel Adapter<br/>(Telegram / WhatsApp /<br/>Discord / Slack)"]
        GATE -->|No| TEMPLATE["Template<br/>Fallback"]
        TG -->|User Feedback| FB["Feedback<br/>Events"]
        FB -->|Learn| MEM["Core Memory"]
    end

    style Input fill:#eef2ff,stroke:#6366f1
    style Phone fill:#f0fdf4,stroke:#22c55e
    style Cloud fill:#fef3c7,stroke:#f59e0b
    style AgentCore fill:#fce7f3,stroke:#ec4899
    style Delivery fill:#e0f2fe,stroke:#0ea5e9
```

## 10 Locked Architecture Decisions

| # | Decision | Why |
|---|---------|-----|
| 1 | Messages API with `tool_use`, not Agent SDK | Edge Functions are stateless |
| 2 | Claude Haiku 4.5 only for MVP | ~$0.90/Pro user/month |
| 3 | Cross-platform from MVP (Android + iOS) | Apple Watch has best data; teammates have both |
| 4 | Channel adapter pattern from Day 1 | Telegram first; WhatsApp, Discord, Slack via adapter |
| 5 | NativeWind v4 | Tailwind for RN, not Gluestack-UI |
| 6 | 8 tools for MVP | Consolidation principle: fewer tools = higher success |
| 7 | 3-step onboarding | Permissions → Messaging channel link → Profile |
| 8 | On-phone CRS computation | Offline-capable, no server round-trip |
| 9 | Rules-based pre-filter before Claude | Saves 60-80% of API calls |
| 10 | op-sqlite + SQLCipher | AES-256 encrypted local health data |

## The 8 MVP Tools

```mermaid
graph LR
    subgraph Read["Read Tools (no side effects)"]
        T1["get_crs<br/>Current score + breakdown"]
        T2["get_sleep<br/>Last night's data"]
        T3["get_stress_events<br/>Recent detections"]
        T4["get_activity<br/>Today's movement"]
        T5["get_user_profile<br/>Age, chronotype, prefs"]
        T6["read_memory<br/>Patterns, goals, insights"]
    end

    subgraph Write["Write Tools (side effects)"]
        T7["update_memory<br/>Store new learnings"]
        T8["send_message<br/>Channel adapter + feedback buttons"]
    end

    style Read fill:#f0fdf4,stroke:#22c55e
    style Write fill:#fef3c7,stroke:#f59e0b
```

**Tool routing per trigger:**

| Trigger | Tools Used | Typical Cost |
|---------|-----------|-------------|
| Stress alert | get_crs, get_stress_events, send_message | ~$0.002 |
| Morning brief | get_crs, get_sleep, read_memory, send_message | ~$0.003 |
| User reply | All 8 tools available | ~$0.004 |
| AI onboarding interview | get_user_profile, update_memory, send_message | ~$0.01 (one-time) |

## AI Onboarding Interview

The agent's first act of intelligence — a dynamic conversation that builds the user profile and calibrates personality before the first morning brief. Same agent, different soul file (`SOUL_ONBOARDING`).

```mermaid
graph TD
    START["User opens app"] --> P["Wearable Permissions"] --> CH["Messaging Channel Link"]
    CH["Channel Link"] --> INT["AI Interview<br/>(SOUL_ONBOARDING)"]
    INT --> Q1["Goals?"]
    Q1 -->|"Better sleep"| SQ["Sleep follow-ups:<br/>Bedtime? Screens? Medications?"]
    Q1 -->|"Reduce stress"| STQ["Stress follow-ups:<br/>Triggers? Meeting load? Recovery?"]
    Q1 -->|"More energy"| EQ["Energy follow-ups:<br/>Exercise? Caffeine? Sleep hours?"]
    SQ --> STYLE["Implicit calibration:<br/>How does user communicate?"]
    STQ --> STYLE
    EQ --> STYLE
    STYLE -->|"Terse answers"| BRIEF["Set: minimal mode"]
    STYLE -->|"Detailed answers"| DATA["Set: data-rich mode"]
    STYLE -->|"Emotional language"| WARM["Set: empathetic mode"]
    BRIEF --> MEM["Write to core_memory"]
    DATA --> MEM
    WARM --> MEM
    MEM --> READY["Agent personalized<br/>from Day 1"]

    READY -.->|"Day 3"| W2["Sleep Deep-Dive<br/>(with real data)"]
    READY -.->|"Day 7"| W3["Stress Calibration<br/>(after first detection)"]
    READY -.->|"Day 14"| W4["Relationship Check-In"]

    style INT fill:#e0e7ff,stroke:#6366f1
    style MEM fill:#dcfce7,stroke:#22c55e
    style READY fill:#dcfce7,stroke:#22c55e
```

## CRS Algorithm

```mermaid
pie title CRS Component Weights
    "Sleep (35%)" : 35
    "HRV (25%)" : 25
    "Circadian (25%)" : 25
    "Activity (15%)" : 15
```

```
CRS = (Sleep * 0.35) + (HRV * 0.25) + (Circadian * 0.25) + (Activity * 0.15)
Range: 0-100 → Zone: Peak (80+) | Moderate (50-79) | Low (<50)
```

Each component outputs 0-100 using **personal baselines, not population norms.**

## Adapter Architecture (Plug & Play) — 10 Adapters

All external boundaries use adapter interfaces — swap any component without rewriting agent logic. **10 adapter interfaces across 6 dimensions of a person's life.**

| Adapter | Phase | Implementations |
|---------|-------|----------------|
| `HealthDataSource` | MVP | Apple Watch (HealthKit), Health Connect, Oura, Fitbit, WHOOP |
| `ChannelAdapter` | MVP | Telegram, WhatsApp, Discord, Slack, In-App |
| `LLMProvider` | MVP | Claude Haiku, multi-model routing |
| `StorageAdapter` | MVP | op-sqlite + SQLCipher |
| `WeatherProvider` | MVP | Open-Meteo (weather + AQI) |
| `CalendarProvider` | Phase 2 | Google Calendar, Outlook (Graph), Apple Calendar |
| `EmailProvider` | Phase 2 | Gmail, Outlook — metadata only, never body content |
| `TaskProvider` | Phase 2 | Todoist, Notion, Linear, Google Tasks, Microsoft To Do |
| `MusicProvider` | Phase 2 | Spotify, YouTube Music, Apple Music |
| `ScreenTimeProvider` | Phase 2 | RescueTime |

```mermaid
graph TB
    subgraph Core["Agent Core (pure TypeScript)"]
        CRS["CRS Engine"]
        STRESS["Stress Detector"]
        STRAIN["Strain Engine"]
        PATTERNS["Pattern Detector"]
        SPOTS["Spots Engine"]
        PROMPT["Prompt Builder<br/>11 sections"]
    end

    subgraph Body["Body Adapters"]
        HDS["HealthDataSource"]
        WP["WeatherProvider"]
    end

    subgraph Life["Life Context Adapters"]
        CAL["CalendarProvider"]
        EMAIL["EmailProvider"]
        TP["TaskProvider"]
        MP["MusicProvider"]
        STP["ScreenTimeProvider"]
    end

    subgraph Infra["Infrastructure Adapters"]
        SA["StorageAdapter"]
        LLM["LLMProvider"]
        CH["ChannelAdapter"]
    end

    HDS -->|"HR, HRV, Sleep, Steps"| CRS & STRESS & STRAIN
    WP -->|"Weather, AQI"| PROMPT
    CAL -->|"MLS, Focus Time"| PROMPT
    EMAIL -->|"CSI, Response Pressure"| PROMPT
    TP -->|"Task Pile-Up, Velocity"| PROMPT
    MP -->|"Mood Score"| PROMPT
    STP -->|"Screen Quality"| PROMPT

    CRS & STRESS & STRAIN --> PATTERNS --> SPOTS --> PROMPT
    PROMPT --> LLM --> CH

    style Core fill:#fce7f3,stroke:#ec4899
    style Body fill:#dcfce7,stroke:#22c55e
    style Life fill:#fef3c7,stroke:#f59e0b
    style Infra fill:#e0f2fe,stroke:#0ea5e9
```

### 32 Metrics → 23 Capabilities → 375 Cross-Source Correlations

See **[Adapter Ecosystem](/adapter-ecosystem)** for complete formulas, all metrics, and capability details.

```mermaid
pie title Data Source Correlation Math
    "2-source pairs: 45" : 45
    "3-source triples: 120" : 120
    "4-source combos: 210" : 210
```

Every new data source multiplies intelligence exponentially, not linearly.

## Defense-in-Depth Security (5 Layers)

Inspired by AtlanClaw's enterprise agent infrastructure, adapted for serverless.

```mermaid
graph LR
    subgraph L1["Layer 1<br/>Credentials"]
        A1["Scoped API Key<br/>+ Spend Alerts"]
    end
    subgraph L2["Layer 2<br/>Input"]
        A2["Template Wrapping<br/>+ Sandwich Defense"]
    end
    subgraph L3["Layer 3<br/>Tools"]
        A3["Per-Trigger Perms<br/>+ Zod Validation"]
    end
    subgraph L4["Layer 4<br/>Egress"]
        A4["URL Allowlist<br/>(safeFetch)"]
    end
    subgraph L5["Layer 5<br/>Audit"]
        A5["Structured Traces<br/>+ Cost Cap"]
    end

    L1 --> L2 --> L3 --> L4 --> L5

    style L1 fill:#dbeafe,stroke:#3b82f6
    style L2 fill:#dcfce7,stroke:#22c55e
    style L3 fill:#fef3c7,stroke:#f59e0b
    style L4 fill:#fce7f3,stroke:#ec4899
    style L5 fill:#eef2ff,stroke:#6366f1
```

> See [Security & Reliability](security-reliability.md) for full details, Mermaid diagrams, and AtlanClaw comparison.

## Agent Self-Evolution (Phase G+)

Behavioral parameters evolve from user feedback. Soul files stay immutable.

```mermaid
graph LR
    FB["Feedback Signals<br/>(👍/👎/dismiss)"] -->|"Rule-based<br/>(no LLM)"| EV["agent_evolutions<br/>table"]
    EV -->|"3+ signals<br/>+ safety gates"| PB["Prompt Builder<br/>(merges on each call)"]
    SOUL["Soul Files<br/>(IMMUTABLE)"] -.-> PB

    style FB fill:#fef3c7,stroke:#f59e0b
    style EV fill:#eef2ff,stroke:#6366f1
    style PB fill:#dcfce7,stroke:#22c55e
    style SOUL fill:#fef2f2,stroke:#ef4444
```

> See [Diagrams](diagrams.md) for full self-evolution flow + safety controls

## LLMProvider: 4-Level Fallback Chain

Reliability lives inside adapters. Core logic stays clean.

```mermaid
graph LR
    L1["Level 1<br/>Claude Haiku<br/>(full context)"] -->|timeout/error| L2["Level 2<br/>Claude Haiku<br/>(L0 only)"]
    L2 -->|fail/circuit open| L3["Level 3<br/>Template +<br/>Real Data"]
    L3 -->|channel fail| L4["Level 4<br/>Silent<br/>(retry next cycle)"]

    style L1 fill:#dcfce7,stroke:#22c55e
    style L2 fill:#fef3c7,stroke:#f59e0b
    style L3 fill:#fce7f3,stroke:#ec4899
    style L4 fill:#f1f5f9,stroke:#94a3b8
```

## Cost Model (Updated with Dynamic Token Budget)

| Tier | Price | AI Cost/User/Mo | Margin |
|------|-------|----------------|--------|
| Free | Rs 0 | ~$0.35 | Acquisition |
| Pro | Rs 399/mo ($4.34) | ~$1.15 | **73%** |
| Team | Rs 999/mo/seat | ~$1.15 | **89%** |

**Break-even:** ~55 Pro subscribers. Comfortable profit at 200.

Token budget is **dynamic per trigger** — the agent gets as much context as it needs:

| Trigger | Budget | Key Reason |
|---------|--------|------------|
| Morning Wag | 4,000 | Sleep detail + evolution params + personality |
| Fetch Alert | 4,500 | Stress context + memory + empathy |
| User Chat | 7,000 | 8-10 turn history + all 8 tools |
| Constellation | 10,000 | Weeks of cross-correlated patterns |

Cost control comes from **prompt caching** (cached tokens cost 0.1x) and the **rules pre-filter** (60-80% of checks skip Claude entirely) — not from limiting context.

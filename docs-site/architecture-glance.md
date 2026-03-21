# Architecture at a Glance

OneSync is a **personal cognitive operating system** built in three layers: Body Intelligence (MVP) → Task Intelligence (Phase 2) → Autonomous Personal OS (Phase 3+). The architecture below shows the full system — MVP components are solid, future components expand on the same foundation.

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
        GATE -->|Yes| TG["Telegram<br/>(grammY)"]
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
| 4 | Telegram only for MVP | 104M users in India, free API |
| 5 | NativeWind v4 | Tailwind for RN, not Gluestack-UI |
| 6 | 8 tools for MVP | Consolidation principle: fewer tools = higher success |
| 7 | 3-step onboarding | Permissions → Telegram link → Profile |
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
        T8["send_message<br/>Telegram + feedback buttons"]
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
    START["User opens app"] --> P["Wearable Permissions"] --> TG["Telegram Link"]
    TG --> INT["AI Interview<br/>(SOUL_ONBOARDING)"]
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

## Cost Model

| Tier | Price | AI Cost/User/Mo | Margin |
|------|-------|----------------|--------|
| Free | Rs 0 | ~$0.27 | Acquisition |
| Pro | Rs 399/mo ($4.34) | ~$0.90 | **79%** |
| Team | Rs 999/mo/seat | ~$0.90 | **92%** |

**Break-even:** ~50 Pro subscribers. Comfortable profit at 200.

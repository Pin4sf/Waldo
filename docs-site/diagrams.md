# Data Flow & Diagrams

## Complete Data Pipeline

```mermaid
graph TB
    subgraph Wearable["Wearable Layer"]
        AW["Apple Watch<br/>Series 7+"]
        GW["Android Watch<br/>(Pixel/Samsung/Fitbit)"]
    end

    subgraph OS["OS Health Store"]
        HK["HealthKit<br/>(iOS)"]
        HC["Health Connect<br/>(Android)"]
    end

    subgraph NativeModule["Native Modules (Expo Modules API)"]
        SW["Swift Module<br/>HKHeartbeatSeriesQuery<br/>→ True RMSSD"]
        KT["Kotlin Module<br/>Health Connect API<br/>+ WorkManager"]
    end

    subgraph LocalDB["Local Encrypted Storage"]
        SQL["op-sqlite + SQLCipher<br/>(AES-256)"]
    end

    subgraph Compute["On-Phone Computation"]
        CRS["CRS Engine<br/>(TypeScript)"]
        STRESS["Stress Detector<br/>(Weighted Confidence)"]
    end

    subgraph Sync["Cloud Sync"]
        SUP["Supabase<br/>(health_snapshots)"]
    end

    subgraph Agent["Agent Pipeline"]
        CRON["pg_cron<br/>(15-min)"]
        PRE["Rules Pre-Filter"]
        HAIKU["Claude Haiku 4.5"]
        HOOKS["Hook Pipeline<br/>(10 hooks)"]
    end

    subgraph Output["Output"]
        TG["Channel Adapter<br/>(Telegram / WhatsApp /<br/>Discord / Slack)"]
        DASH["Dashboard"]
    end

    AW --> HK
    GW --> HC
    HK --> SW
    HC --> KT
    SW --> SQL
    KT --> SQL
    SQL --> CRS
    SQL --> STRESS
    CRS --> DASH
    CRS --> SUP
    STRESS --> SUP
    SUP --> CRON
    CRON --> PRE
    PRE -->|"60-80% SKIP ($0)"| LOG["Log Only"]
    PRE -->|"20-40% INVOKE"| HAIKU
    HAIKU --> HOOKS
    HOOKS --> TG

    style Wearable fill:#eef2ff,stroke:#6366f1
    style LocalDB fill:#dcfce7,stroke:#22c55e
    style Agent fill:#fef3c7,stroke:#f59e0b
    style Output fill:#e0f2fe,stroke:#0ea5e9
```

## Onboarding Flow — AI Interview

```mermaid
sequenceDiagram
    participant U as User
    participant APP as Waldo App
    participant AI as Claude Haiku<br/>(SOUL_ONBOARDING)
    participant MEM as core_memory

    Note over U,MEM: Day 0 — Initial Onboarding (3-5 min)
    U->>APP: Opens app for first time
    APP->>U: Request wearable permissions
    U->>APP: Grants HealthKit / Health Connect
    APP->>U: Link messaging channel (6-digit code)
    U->>APP: Channel connected

    APP->>AI: Start AI interview
    AI->>U: "What's your #1 health goal?"
    U->>AI: "I want to sleep better"
    AI->>MEM: goals: ["sleep 7h+"]
    AI->>U: "What time do you usually go to bed?"
    U->>AI: "Around 1am, I know it's late"
    AI->>MEM: chronotype: "late", bedtime: "1am"
    AI->>U: "Any medications or supplements?"
    U->>AI: "Magnesium before bed"
    AI->>MEM: supplements: ["magnesium"]
    AI->>U: "When I message you, do you prefer short and direct or detailed with data?"
    U->>AI: "Short and direct"
    AI->>MEM: communication_style: "brief", verbosity: "low"
    AI->>U: "You're all set! I'll send your first morning brief tomorrow."

    Note over U,MEM: Day 3 — Sleep Deep-Dive (with real data)
    AI->>U: "You slept 5.8h last night. Is that typical?"
    U->>AI: "Yeah, I struggle to fall asleep"
    AI->>MEM: patterns: ["sleep onset difficulty"]

    Note over U,MEM: Day 7 — Stress Calibration (after first detection)
    AI->>U: "Your HRV dropped at 2pm yesterday. What was happening?"
    U->>AI: "Back-to-back meetings all afternoon"
    AI->>MEM: stress_triggers: ["consecutive meetings"]

    Note over U,MEM: Day 14 — Check-In
    AI->>U: "How's Waldo working for you so far?"
```

## Memory Architecture

```mermaid
graph TB
    subgraph T1["Tier 1: Structured (Always Loaded ~200 tokens)"]
        ID["Identity<br/>name, age, tz, chronotype"]
        HP["Health Profile<br/>conditions, meds, baselines"]
        PR["Preferences<br/>style, timing, interventions"]
        GO["Active Goals<br/>with parent hierarchy"]
        IN["Recent Insights<br/>with temporal validity"]
    end

    subgraph T2["Tier 2: Summaries (On-Demand)"]
        SS["Session Summaries<br/>(per conversation)"]
        WC["Weekly Compaction<br/>(session → insights)"]
        PL["Pattern Log<br/>(append-only, never delete)"]
        PF["Pending Followups<br/>(track suggestion outcomes)"]
    end

    subgraph T3["Tier 3: Semantic Search (Phase 2)"]
        VEC["pgvector Embeddings"]
        KG["Knowledge Graph<br/>(caffeine → sleep_latency)"]
    end

    subgraph Decay["Memory Decay"]
        HOT["HOT (7d)<br/>Full detail, prominent"]
        WARM["WARM (8-30d)<br/>Summary only"]
        COLD["COLD (30d+)<br/>Omitted, but recallable"]
    end

    T1 --> T2
    T2 --> T3
    IN --> Decay

    style T1 fill:#dcfce7,stroke:#22c55e
    style T2 fill:#fef3c7,stroke:#f59e0b
    style T3 fill:#e0e7ff,stroke:#6366f1
    style Decay fill:#f1f5f9,stroke:#94a3b8
```

## Agent Loop Detail

```mermaid
sequenceDiagram
    participant T as Trigger (pg_cron)
    participant PF as Rules Pre-Filter
    participant PB as Prompt Builder
    participant H1 as Pre-Hooks
    participant C as Claude Haiku
    participant TO as Tools
    participant H2 as Post-Hooks
    participant TG as Channel Adapter

    T->>PF: check-triggers fires
    PF->>PF: CRS > 60 AND conf < 0.3?

    alt Skip (60-80% of checks)
        PF->>PF: Log only ($0)
    else Invoke agent
        PF->>PB: Assemble context (25 fields)
        PB->>PB: Select personality zone
        PB->>PB: Dynamic tool subset (3-8)
        PB->>H1: Run pre-hooks
        H1->>H1: Emergency bypass?
        H1->>H1: Quality gates 1,3,4
        H1->>H1: Context injection
        H1->>H1: Compaction check
        H1->>C: Send to Claude

        loop Max 3 iterations (50s timeout)
            C->>TO: tool_use (get_crs, etc.)
            TO->>C: Tool results
        end

        C->>H2: Agent response
        H2->>H2: Health language gate
        H2->>H2: Confidence gate
        H2->>H2: Loop guard (SHA256)
        H2->>H2: Memory update
        H2->>H2: Analytics log
        H2->>TG: Deliver message
    end
```

## Stress Detection Algorithm

```mermaid
graph TD
    START["Health Snapshot<br/>(every 15 min)"] --> HRV{"HRV drop<br/>from baseline?"}
    HRV -->|"Weight: 0.35"| CONF["Confidence<br/>Calculator"]
    START --> HR{"HR elevation<br/>above normal?"}
    HR -->|"Weight: 0.25"| CONF
    START --> DUR{"Sustained<br/>> 10 min?"}
    DUR -->|"Weight: 0.20"| CONF
    START --> ACT{"Low activity<br/>(not exercising)?"}
    ACT -->|"Weight: 0.20"| CONF

    CONF --> CHECK{"Confidence<br/>score?"}
    CHECK -->|">= 0.60"| ALERT["ALERT<br/>Send message"]
    CHECK -->|"0.40-0.59"| LOGONLY["LOG<br/>Don't alert yet"]
    CHECK -->|"< 0.40"| IGNORE["IGNORE"]

    ALERT --> COOL{"Within 2h<br/>cooldown?"}
    COOL -->|Yes| SUPPRESS["Suppress"]
    COOL -->|No| PRIORITY["Risk-Weighted<br/>Priority Score"]
    PRIORITY -->|"> 0.40"| SEND["SEND"]
    PRIORITY -->|"<= 0.40"| LOGONLY2["LOG"]

    style ALERT fill:#fef2f2,stroke:#ef4444
    style SEND fill:#dcfce7,stroke:#22c55e
    style IGNORE fill:#f1f5f9,stroke:#94a3b8
```

## Context Assembly (Token Budget)

```mermaid
pie title Token Budget per Claude Call (2500 max)
    "Soul + Zone + Mode (500)" : 500
    "User Context L0+L1 (600)" : 600
    "Tool Definitions (500)" : 500
    "Conversation History (600)" : 600
    "Headroom for Tool Outputs (300)" : 300
```

## Proactive Intelligence Roadmap

```mermaid
graph LR
    L1["Level 1: REACTIVE<br/>(MVP)"] -->|"Phase G validates"| L2["Level 2: PATTERN-AWARE<br/>(Phase G-H)"]
    L2 -->|"Enough data"| L3["Level 3: PREDICTIVE<br/>(Phase 2)"]
    L3 -->|"Trust established"| L4["Level 4: AUTONOMOUS<br/>(Phase 3+)"]

    L1 --- D1["'Your HRV dropped 22%'"]
    L2 --- D2["'Monday 1:30pm — HRV<br/>typically drops now'"]
    L3 --- D3["'Sleep debt + 4 meetings =<br/>CRS will crash by 2pm'"]
    L4 --- D4["Auto-blocks calendar<br/>for recovery"]

    style L1 fill:#dcfce7,stroke:#22c55e
    style L2 fill:#e0f2fe,stroke:#0ea5e9
    style L3 fill:#fef3c7,stroke:#f59e0b
    style L4 fill:#eef2ff,stroke:#6366f1
```

## Security Layers

```mermaid
graph TB
    subgraph MVP["MVP Security (7 systems)"]
        S1["Output Validation<br/>(banned medical phrases)"]
        S2["Emergency Bypass<br/>(suicidal ideation → safety)"]
        S3["Input Sanitization<br/>(prompt injection)"]
        S4["Row-Level Security<br/>(users see own data only)"]
        S5["SQLCipher Encryption<br/>(AES-256 on device)"]
        S6["Audit Logging<br/>(every agent invocation)"]
        S7["Rate Limiting<br/>(per-user caps)"]
    end

    subgraph Phase2["Phase 2 Security (+5 systems)"]
        S8["Taint Tracking<br/>(label data at source)"]
        S9["Loop Guard<br/>(SHA256 detection)"]
        S10["Prompt Injection Scanner"]
        S11["Approval Gates<br/>(high-stakes recs)"]
        S12["Session Repair<br/>(corrupted state recovery)"]
    end

    style MVP fill:#dcfce7,stroke:#22c55e
    style Phase2 fill:#fef3c7,stroke:#f59e0b
```

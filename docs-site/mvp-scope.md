# MVP Scope — What We Ship

## The Core Loop (What Users Experience)

```mermaid
sequenceDiagram
    participant W as Wearable
    participant P as Phone App
    participant S as Supabase
    participant A as Claude Haiku
    participant T as Telegram
    participant U as User

    Note over W,U: Every 15 minutes (background)
    W->>P: Health data sync
    P->>P: Compute CRS on-phone
    P->>S: Sync health_snapshot

    Note over S,A: pg_cron trigger (every 15 min)
    S->>S: Rules pre-filter
    alt CRS normal, no stress
        S->>S: Skip Claude ($0)
    else Stress detected OR morning brief
        S->>A: Invoke agent (50s timeout)
        A->>A: Tool calls (max 3 iterations)
        A->>T: Send personalized message
    end

    T->>U: "Your HRV dropped 22%...<br/>[Helpful] [Not helpful]"
    U->>T: Taps feedback button
    T->>S: Store feedback
    S->>S: Update thresholds over time
```

## What the MVP Delivers

### Hero Feature: Morning Cognitive Brief

Every morning at your wake time:

```
You slept 6.8h (good!) but your HRV is still recovering.
CRS at 58 — protect your 10-11am slot for deep focus.
→ Move anything optional to after lunch.

[Got it] [More details] [Mute today]
```

### Proactive Stress Alerts

When your body signals stress (gated on Phase G validation):

```
Your HRV dropped 22% in the last 30 minutes.
This usually happens during back-to-back meetings.
→ Take 3 slow breaths. 4 seconds in, 7 seconds out.

[Helpful] [Not helpful] [Too frequent]
```

### Conversational Health Chat

Message the Telegram bot anytime:

```
You: "Why am I so tired today?"

OneSync: "You got 5.2h of sleep last night — that's 1.8h
below your baseline. Plus your HRV hasn't recovered from
yesterday's stress spike at 3pm. The combination puts your
CRS at 41 (low zone). One thing that usually helps you:
an afternoon walk around 2-3pm. Want me to remind you?"
```

## Phase-by-Phase Deliverables

### Phase A: Pre-Code Setup
- Telegram bot via @BotFather
- Supabase project (pg_cron + pgmq enabled)
- Tech spike: op-sqlite + SQLCipher on both platforms
- Wizard of Oz: 5-7 users, 5-7 days of manual CRS via Telegram
- **Gate:** Morning briefs feel useful to 3+ users

### Phase B1: HealthKit Connector (iOS)

```mermaid
graph LR
    AW["Apple Watch"] -->|Observer Query| HK["HealthKit"]
    HK -->|Beat-to-beat IBI| RMSSD["True RMSSD<br/>(HRV gold standard)"]
    HK -->|4-stage sleep| SLEEP["Wake/Light/Deep/REM"]
    HK -->|HR samples| HR["Heart Rate BPM"]
    HK -->|Step count| STEPS["Steps + Distance"]
    RMSSD --> SQL["op-sqlite<br/>+ SQLCipher"]
    SLEEP --> SQL
    HR --> SQL
    STEPS --> SQL

    style AW fill:#e0e7ff,stroke:#6366f1
    style SQL fill:#dcfce7,stroke:#22c55e
```

- **Gate:** CRS updates every 15 min with real Apple Watch data

### Phase B2: Health Connect Connector (Android)

```mermaid
graph LR
    GW["Android Watch"] -->|Health Connect API| HC["Health Connect"]
    HC -->|HR only for Samsung| SAM["Samsung HR Proxy<br/>(NO HRV available)"]
    HC -->|Full data for Pixel/Fitbit| FULL["HR + HRV + Sleep + Steps"]
    SAM --> SQL["op-sqlite<br/>+ SQLCipher"]
    FULL --> SQL
    WM["WorkManager<br/>(15-min sync)"] -->|Background| HC

    style GW fill:#e0e7ff,stroke:#6366f1
    style SAM fill:#fef3c7,stroke:#f59e0b
    style SQL fill:#dcfce7,stroke:#22c55e
```

- **Samsung HRV gap:** Samsung does NOT write HRV to Health Connect. Use HR BPM proxy.
- **Gate:** CRS updates from Health Connect; Samsung users get degraded CRS

### Phase C: Dashboard
- CRS gauge (270-degree SVG arc)
- Sleep card, metric cards, 7-day trend
- **Gate:** Real health data displays with auto-updating CRS

### Phase D: Agent Core + Messaging

```mermaid
graph TB
    subgraph PromptBuilder["Prompt Builder (25 Fields)"]
        SOUL["Soul Base + Zone + Mode"] --> SYS["System Message<br/>(cached, stable)"]
        TOOLS["Tool Definitions<br/>(3-8 dynamic)"] --> SYS
        MEM["Core Memory Excerpt"] --> SYS
        BIO["Biometric Snapshot"] --> USR["User Message<br/>(fresh, dynamic)"]
        CTX["Trigger Context"] --> USR
        LAST["Last Interaction"] --> USR
    end

    subgraph Hooks["Hook Pipeline"]
        PRE["Pre-Reasoning<br/>Emergency | Gates | Inject | Compact | Rate"] --> LOOP
        LOOP["Agent Loop<br/>(3 iter, 50s)"] --> POST["Post-Reasoning<br/>Language | Confidence | Guard | Memory | Analytics"]
    end

    SYS --> PRE
    USR --> PRE
    POST --> DELIVER["Deliver via Telegram"]

    style PromptBuilder fill:#eef2ff,stroke:#6366f1
    style Hooks fill:#fef3c7,stroke:#f59e0b
```

- **Gate:** Message bot, get personalized health-aware response

### Phase E: Proactive Delivery
- Morning brief at wake time
- Stress alerts (rules pre-filter → Claude → Telegram)
- 2h cooldown, max 3 proactive/day
- **Gate:** Wake up to morning brief; agent alerts on stress

### Phase F: Onboarding + AI Interview

```mermaid
graph LR
    S1["Step 1<br/>Wearable<br/>Permissions"] --> S2["Step 2<br/>Telegram<br/>Link"]
    S2 --> S3["Step 3<br/>AI Interview<br/>(3-5 min)"]
    S3 --> PROFILE["core_memory<br/>populated"]
    PROFILE --> AGENT["Agent ready<br/>Day 1"]

    S3 -.->|"Day 3"| W2["Sleep<br/>Deep-Dive"]
    S3 -.->|"Day 7"| W3["Stress<br/>Calibration"]
    S3 -.->|"Day 14"| W4["Relationship<br/>Check-In"]

    style S3 fill:#e0e7ff,stroke:#6366f1
    style PROFILE fill:#dcfce7,stroke:#22c55e
    style W2 fill:#f1f5f9,stroke:#94a3b8
    style W3 fill:#f1f5f9,stroke:#94a3b8
    style W4 fill:#f1f5f9,stroke:#94a3b8
```

- Step 1: Wearable permissions (HealthKit / Health Connect)
- Step 2: Telegram bot link (6-digit code)
- Step 3: **AI-powered onboarding interview** — dynamic questions that adapt based on answers. Learns goals, chronotype, medications, communication style, stress triggers. Writes directly to `core_memory`. Also implicitly calibrates agent personality from HOW the user answers.
- Progressive profiling: follow-up interviews at Day 3 (sleep), Day 7 (stress), Day 14 (check-in) — each using real wearable data as context.
- **Gate:** Non-technical person completes onboarding in < 5 min. Agent has a useful profile from Day 1.

### Phase G: Self-Test (14 Days)
- Daily founder use with logging
- Tune false positive thresholds
- A/B test soul file variants
- **Gate:** 14 days daily use, false positive < 20%

### Phase H: Beta (5-7 Users, 7 Days)
- **Gate:** Product works for external users

## The Personality Spectrum

The agent adapts its voice to your CRS, not just the trigger type:

```mermaid
graph LR
    CRS["Current CRS"] --> ZONE{Zone?}
    ZONE -->|"80+"| E["ENERGIZED<br/>Coach pushing athlete<br/>'Peak zone. Deep work window.'"]
    ZONE -->|"60-79"| S["STEADY<br/>Trusted friend<br/>'Solid night. You've got runway.'"]
    ZONE -->|"40-59"| F["FLAGGING<br/>Wise advisor<br/>'Protect your energy today.'"]
    ZONE -->|"<40"| D["DEPLETED<br/>Caretaker<br/>'Water. Take it slow.'"]
    ZONE -->|"No data"| C["CRISIS<br/>Honest friend<br/>'How are you feeling?'"]

    style E fill:#dcfce7,stroke:#22c55e
    style S fill:#e0f2fe,stroke:#0ea5e9
    style F fill:#fef3c7,stroke:#f59e0b
    style D fill:#fce7f3,stroke:#ec4899
    style C fill:#f1f5f9,stroke:#94a3b8
```

## Quality Gates — No Message Without Passing

```mermaid
graph TD
    MSG["Message Ready"] --> G1{"Gate 1<br/>Data Sufficient?"}
    G1 -->|No| SKIP1["Skip or degrade"]
    G1 -->|Yes| G3{"Gate 3<br/>Timing OK?"}
    G3 -->|No| QUEUE["Queue for later"]
    G3 -->|Yes| G4{"Gate 4<br/>Not fatiguing?"}
    G4 -->|No| REDUCE["Reduce frequency"]
    G4 -->|Yes| CLAUDE["Send to Claude"]
    CLAUDE --> G2{"Gate 2<br/>Health language safe?"}
    G2 -->|No| RETRY["Regenerate (max 2)"]
    RETRY --> G2
    G2 -->|Yes| G5{"Gate 5<br/>Confident enough?"}
    G5 -->|No| OMIT["Omit uncertain claim"]
    G5 -->|Yes| SEND["SEND via Telegram"]

    style SEND fill:#dcfce7,stroke:#22c55e
    style SKIP1 fill:#fef2f2,stroke:#ef4444
    style QUEUE fill:#fef3c7,stroke:#f59e0b
```

## What's NOT in MVP (Deliberately)

| Feature | Why Not | When |
|---------|---------|------|
| WhatsApp | Telegram first, prove the model | Phase 2 |
| Calendar integration | Body signals first, workspace second | Phase 2 |
| Multi-model routing | Haiku-only keeps it simple and cheap | Phase 2 |
| Knowledge graph | Core memory is sufficient for MVP | Phase 2 |
| Predictive intelligence | Need reactive to work first | Phase 2 |
| Samsung Sensor SDK | HC proxy is good enough until CRS quality is the bottleneck | Post-MVP |
| Population learning | Need individual learning to work first | Phase 3+ |
| Autonomous actions | Need trust established first | Phase 3+ |

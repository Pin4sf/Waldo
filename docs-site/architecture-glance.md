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

    subgraph Cloud["Supabase (Health Data)"]
        SYNC -->|health_snapshots| PG["Postgres + RLS"]
    end

    subgraph DO["Cloudflare Durable Object (Phase D+)"]
        PG -->|REST API| DOSQL["DO SQLite<br/>(5-tier memory)"]
        ALARM["DO Alarms<br/>(per-user schedule)"] -->|wake| DECIDE{CRS > 60 AND<br/>confidence < 0.3?}
        DECIDE -->|Yes: SKIP| LOG["Log Only<br/>($0)"]
        DECIDE -->|No: INVOKE| AGENT["Agent Loop"]
    end

    subgraph AgentCore["Agent Core"]
        AGENT -->|Prompt Builder<br/>25 fields| HAIKU["Claude Haiku 4.5<br/>(Messages API + tool_use)"]
        HAIKU -->|Tool calls<br/>reads parallel, writes serial| TOOLS["8 MVP Tools"]
        TOOLS -->|Results<br/>compressed >500 tok| HAIKU
        HAIKU -->|Max 3 iterations| RESPONSE["Generated Message"]
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

## 11 Locked Architecture Decisions

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
| 11 | **Cloudflare Durable Objects for Phase D+** | Per-user persistent agent brain with SQLite, scheduling, WebSocket. Health data stays in Supabase. |

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

## 10-Hook Pipeline (Enhanced with Session 4 Additions)

```mermaid
graph TD
    subgraph Pre["Pre-Reasoning (before Claude call)"]
        H1["1. Emergency Bypass<br/>(chest pain, suicidal → instant escape)"]
        H1B["1.5 Frustration Regex<br/>(detect wtf/ffs/horrible → shift zone)"]
        H2["2. Quality Gates<br/>(data sufficiency, timing, fatigue)"]
        H3["3. Context Injection<br/>(fresh CRS, calendar, session_state)"]
        H4["4. Micro-Compaction<br/>(prune dupes, truncate >500 tok)"]
        H5["5. Rate Limit Check"]
    end

    subgraph Post["Post-Reasoning (before delivery)"]
        H6["6. Health Language Safety<br/>(no diagnosis, no 'you are stressed')"]
        H7["7. Confidence Check<br/>(Fetch: ≥0.60, patterns: ≥3 data points)"]
        H8["8. Loop Guard<br/>(SHA256 duplicate + diminishing-returns:<br/>if last 3 iters <500 tokens → fallback)"]
        H9["9. Memory Update + Verify<br/>(persist facts, verify before assert)"]
        H10["10. Clean State Exit<br/>(trace logged, session_state updated,<br/>no orphaned state)"]
    end

    H1 --> H1B --> H2 --> H3 --> H4 --> H5
    H5 -->|Claude call| H6
    H6 --> H7 --> H8 --> H9 --> H10

    style Pre fill:#fef3c7,stroke:#f59e0b
    style Post fill:#dcfce7,stroke:#22c55e
```

**New in Session 4:** Hook 1.5 (frustration regex), Hook 3 loads `session_state` from DO, Hook 9 verifies memory against fresh data, Hook 10 ensures clean state exit.

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

**Updated cost with all Session 4 optimizations:**

| Cost Component | Per User/Month | Notes |
|---|---|---|
| Cloudflare DO infrastructure | ~$0.01 | Hibernation keeps this negligible |
| LLM (Claude Haiku) | $0.30-0.90 | 5-20 calls/day with pre-filter + caching |
| **Total** | **$0.31-0.91** | Revenue at Rs 399/mo ($4.34) = **73%+ margin** |

## 5-Tier Memory Architecture (Updated April 2026 — R2 Added)

Tiers 1-3 live in Cloudflare DO SQLite (per-user, <1ms). Tier 2 episodes older than 90 days archive to **Cloudflare R2** (cold, zero egress). Tier 4 is Supabase pgvector for semantic constellation search.

```mermaid
graph TB
    subgraph T0["Tier 0: Working Memory<br/>(Context Window — Volatile)"]
        W0["Current conversation + tool results<br/>Rebuilt each invocation. 4K-10K tokens."]
    end

    subgraph T1["Tier 1: Semantic Memory<br/>(DO SQLite — Always Loaded)"]
        S1["Identity, health profile, preferences<br/>Active goals, recent Spots<br/>~200 tokens, structured blocks"]
    end

    subgraph T2["Tier 2: Episodic Memory<br/>(DO SQLite 0-90d → R2 90d+)"]
        E1["Conversation logs, daily observations<br/>Feedback signals, pending followups<br/>7d full → 30d summary → 90d R2 archive"]
    end

    subgraph T3["Tier 3: Procedural Memory<br/>(DO SQLite — Phase G)"]
        P1["Evolution entries, intervention effectiveness<br/>Learned skills (Phase 3)"]
    end

    subgraph R2["R2: Episodic Archive + GDPR Exports<br/>(Cloudflare R2 — Phase E+)"]
        RA["waldo-episodes/{user}/{year}/{month}/<br/>episodes.jsonl  •  $0 egress  •  $0.015/GB/mo"]
    end

    subgraph T4["Tier 4: Archival / Constellation<br/>(Supabase pgvector — Phase 2)"]
        A1["Embeddings + bi-temporal knowledge graph<br/>Months of Spots connected"]
    end

    T0 -.->|reads| T1 & T2
    T2 -->|consolidation| T1
    T2 -->|signals| T3
    T2 -->|"Patrol Agent<br/>weekly archive >90d"| R2
    R2 -.->|semantic index| T4

    style T0 fill:#f1f5f9,stroke:#94a3b8
    style T1 fill:#dcfce7,stroke:#22c55e
    style T2 fill:#fef3c7,stroke:#f59e0b
    style T3 fill:#eef2ff,stroke:#6366f1
    style R2 fill:#e0f2fe,stroke:#0284c7
    style T4 fill:#fce7f3,stroke:#ec4899
```

| Tier | Storage | What | When | Phase |
|------|---------|------|------|-------|
| 0 | Context window | Active conversation | Every call (volatile) | D |
| 1 | DO SQLite | Identity, profile, preferences | Always loaded | D |
| 2 | DO SQLite → R2 | Episodes, observations | On-demand; auto-archive >90d | D→E |
| 3 | DO SQLite | Evolutions, procedures | Selectively loaded | G |
| R2 | Cloudflare R2 | Old episodes + GDPR exports | Cold retrieval + downloads | E+ |
| 4 | Supabase pgvector | Embeddings, Constellation | Semantic search | Phase 2 |

> Raw health values NEVER enter DO SQLite or R2. Supabase only, always encrypted with RLS.

## Three-Stage Context Compaction (From Claude Code)

```mermaid
graph LR
    S1["Stage 1: Micro<br/>(FREE — every turn)<br/>Prune duplicates,<br/>truncate >500 tok"] --> S2["Stage 2: Session<br/>(CHEAP — during chat)<br/>Agent calls update_memory<br/>to persist key facts"]
    S2 --> S3["Stage 3: Full LLM<br/>(EXPENSIVE — Patrol only)<br/>9-section structured<br/>summary overnight"]

    style S1 fill:#dcfce7,stroke:#22c55e
    style S2 fill:#fef3c7,stroke:#f59e0b
    style S3 fill:#fce7f3,stroke:#ec4899
```

## Concurrent Tool Execution (From Claude Code)

Read-only tools run in **parallel**. Write tools run **serially**. Cuts tool execution from ~900ms to ~300ms.

```mermaid
graph TB
    CLAUDE["Claude returns<br/>3 tool calls"] --> PARTITION{"Partition by<br/>read/write"}

    PARTITION -->|"Read-only"| PARALLEL["Run in parallel"]
    PARALLEL --> R1["get_crs<br/>~100ms"]
    PARALLEL --> R2["get_sleep<br/>~100ms"]
    PARALLEL --> R3["get_activity<br/>~100ms"]

    PARTITION -->|"Write"| SERIAL["Run serially"]
    SERIAL --> W1["update_memory"]
    SERIAL --> W2["send_message"]

    R1 & R2 & R3 --> RESULTS["All results<br/>~300ms total"]
    W1 --> W2
    W2 --> RESULTS

    style PARALLEL fill:#dcfce7,stroke:#22c55e
    style SERIAL fill:#fef3c7,stroke:#f59e0b
```

## Patrol Agent — Sleep-Time Compute (Phase G)

Nightly background consolidation via DO alarm. Pre-stages Morning Wag. Result: **<3 second delivery** when user wakes.

```mermaid
graph LR
    ALARM["DO Alarm<br/>(2 AM)"] --> GATE{"≥24h AND<br/>≥3 sessions?"}
    GATE -->|No| SLEEP["Hibernate"]
    GATE -->|Yes| P1["Orient:<br/>Read memory"]
    P1 --> P2["Gather:<br/>Scan for patterns,<br/>corrections, feedback"]
    P2 --> P3["Consolidate:<br/>Promote patterns,<br/>decay old, compress"]
    P3 --> P4["Pre-stage:<br/>Compute CRS,<br/>fetch weather,<br/>cache Morning Wag"]
    P4 --> SLEEP

    style ALARM fill:#eef2ff,stroke:#6366f1
    style P4 fill:#dcfce7,stroke:#22c55e
```

## Buddy System — Waldo Moods (Phase F-G)

Waldo is not an assistant. Waldo is a **buddy**. The dalmatian's visual state reflects your health.

| CRS Zone | Waldo's Mood | Visual |
|----------|-------------|--------|
| 80+ (Energized) | Excited | Tail wagging, running |
| 60-79 (Steady) | Happy | Calm, sitting |
| 40-59 (Flagging) | Concerned | Ears back, watching |
| <40 (Depleted) | Gentle | Curled up, sleeping |
| No data | Curious | Tilted head |

**Gamification:** 7-day streak → hat. 30-day → golden collar. 100 Spots → Constellation Waldo. 1% daily shiny chance.
**Buddy stats = YOUR stats:** SLEEP, RECOVERY, CONSISTENCY, STRESS_MGMT, SELF_AWARENESS.
**Deterministic quirks** from `hash(user_id)` — your Waldo feels uniquely yours.

## Waldo as MCP Server — Ecosystem Strategy (Phase 2)

```mermaid
graph LR
    CURSOR["Cursor"] & LINDY["Lindy"] & CC["Claude Code"] & SLACK["Slack Bot"] -->|MCP query| API["Waldo MCP Server"]
    API -->|getCRS| R1["CRS: 82"]
    API -->|getCognitiveWindow| R2["Peak: 9-11am"]
    API -->|shouldScheduleNow| R3["Yes — sharp"]

    style API fill:#fef3c7,stroke:#f59e0b
```

> **97M MCP installs.** Waldo becomes the biological intelligence layer under every other agent.

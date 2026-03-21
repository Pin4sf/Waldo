# OneSync Agent OS — Definitive Intelligence Architecture

> **What this document is:** The consolidated agent architecture for OneSync — a personal cognitive operating system that combines **body intelligence** (health signals from wearables), **task intelligence** (planning, organization, getting things done), and **proactive agency** (acts before you ask). This is the definitive reference for HOW the agent thinks, learns, communicates, and evolves.
>
> **Sources:** 14 production-grade agent systems — Pi Mono, OpenClaw, PicoClaw, OpenFang, CoPaw, Paperclip, OpenViking (ByteDance), Swarms, Agency-Agents, Agent-Skills-for-Context-Engineering, context-hub (Andrew Ng), Context Engineering (HumanLayer/YC), a **Production Agent Platform** (enterprise-grade Brain + Orchestrator + Execution architecture, running on Pi Mono), and **NemoClaw** (NVIDIA's enterprise agent governance framework — versioned blueprints, declarative policies, operator-in-the-loop escalation, multi-model routing)
>
> **Relationship to Master Reference:** Master Reference defines WHAT to build. This document defines HOW the agent should behave. Use BOTH when building Phase D (Agent Core) and Phase E (Proactive Delivery).
>
> **Last updated:** March 2026

---

## 0. What OneSync Actually Is

OneSync is **not just a health app**. It is a **personal cognitive operating system** with three pillars:

### Pillar 1: Body Intelligence (MVP)
Reads HRV, HR, sleep, activity from any wearable. Computes CRS. Detects stress. Proactively messages you via Telegram before you crash. All health data encrypted, on-device computation, personal baselines.

### Pillar 2: Task Intelligence (Phase 2+)
Connects to your calendar, email, Slack, task manager. Understands your workload. Prioritizes tasks based on your cognitive state. "Your CRS is 87 — tackle the P0 bug now, save admin for the afternoon dip." Reschedules, blocks time, manages your day.

### Pillar 3: Autonomous Personal OS (Phase 3+)
The agent becomes a **full personal operating system** that can perform virtually any task for you — not just health, not just productivity, but anything you'd delegate to a hyper-competent personal chief of staff who also happens to know your biology.

This is the production agent platform philosophy applied to personal life: **Brain thinks → Orchestrator routes → Execution layer does the work.** Once the agent has body intelligence + workspace intelligence, it has the two things no other agent has — it knows your physiology AND your context. From there, it can:

- **Execute arbitrary tasks** — "Research the best standing desks under $500, but only show me results tomorrow morning when my CRS is peak" (the agent researches now, delivers when you're sharp)
- **Learn new skills from you** — "When I say 'prep for standup', pull my Linear tickets, check my sleep score, and draft 3 talking points" (agent stores as a reusable skill)
- **Compose multi-step workflows** — Chain tools into automations: health check → calendar scan → task reranking → Slack status update → morning brief — all triggered by your wake time
- **Delegate to specialist sub-agents** — Sleep agent, productivity agent, research agent, creative agent — each expert in their domain, all coordinated by the brain
- **Connect to any service via MCP** — Each new MCP server = a new domain the agent operates in. Notion, GitHub, Figma, banking, travel, food ordering — the tool ecosystem is unbounded
- **Write and run code** — The agent can spin up ephemeral execution environments (code capsules) to accomplish tasks that don't have pre-built tools (data analysis, report generation, web scraping)
- **Manage other agents** — OneSync becomes the orchestration layer UNDER your other AI tools, providing biological context to Lindy, Manus, Cursor, Claude Code — any agent that would benefit from knowing your cognitive state

**The key insight:** Every AI agent (Lindy, Manus, OpenClaw) can schedule meetings and draft emails. **None know when you're cognitively depleted.** OneSync adds the biological layer that makes every other agent smarter — it's the intelligence layer UNDER all your other tools. And because we build on the same infrastructure patterns (Hands, Heartbeats, Adapters, Skills, Memory) that power enterprise-grade agent platforms, the architecture scales to handle any domain, any task, any persona.

### The Three-Layer Architecture (Production Agent Platform Pattern)

```
Brain Layer                         → OneSync Agent Core
  Thinks, remembers, delegates       Claude Haiku + soul files + memory
  Workspace files as config           IDENTITY + SOUL + CALIBRATION + RULES
  Daily memory + learning flywheel    Session summaries + pattern log

Orchestrator Layer                  → OneSync Edge Functions
  State management + routing          Supabase + pg_cron + RLS
  Adapter pattern (source-agnostic)   HealthKit/HealthConnect/Samsung adapters
  Sub-agent supervisor                Future: specialist agents

Execution Layer                     → OneSync Tool Execution
  Ephemeral task execution            8 MVP tools → 50+ tools
  Workspace connectors                Calendar, email, Slack, tasks, music
  Multi-domain capability             Health + productivity + life management
```

---

## 1. Agent OS Architecture Overview

Synthesized from all 12 repos into OneSync's serverless health agent:

```
┌──────────────────────────────────────────────────────────────┐
│  PROMPT BUILDER (25-field assembly — from OpenFang)           │
│                                                               │
│  Static Block (cached):                                       │
│    soul_base + zone_modifier + mode_template + safety_rules   │
│    + tool_definitions (dynamic subset)                        │
│  User Block (cached per user):                                │
│    user_profile + core_memory_excerpt + health_baselines      │
│  Dynamic Block (fresh per invocation):                        │
│    trigger_context + biometric_snapshot + last_interaction     │
│    + pending_followups + calendar_context                     │
│                                                               │
│  Token budget: 2500 max. U-shaped: critical at START + END.  │
│  Canonical context as SEPARATE user message (cache-friendly). │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  HOOK PIPELINE (from CoPaw + OpenFang)                        │
│                                                               │
│  Pre-Reasoning:                                               │
│    1. Emergency Bypass (chest pain, suicidal → instant escape)│
│    2. Quality Gates 1,3,4 (data sufficiency, timing, fatigue) │
│    3. Context Injection (fresh CRS, calendar if relevant)     │
│    4. Compaction (compress if history > token budget)          │
│    5. Rate Limit (daily cost/message cap check)               │
│                                                               │
│  Post-Reasoning:                                              │
│    1. Quality Gates 2,5 (health language, confidence)         │
│    2. Loop Guard (SHA256 duplicate detection — from OpenFang) │
│    3. Memory Update (persist core_memory changes)             │
│    4. Analytics (log model, tokens, tools, response time)     │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  AGENT LOOP (ReAct — max 3 iterations, 50s timeout)           │
│                                                               │
│  Claude Haiku 4.5 via Messages API + tool_use                 │
│  Model Router: Rules-skip → Haiku (MVP) → Sonnet (Phase 2)   │
│  Provider Failover: Primary → Fallback → Template (PicoClaw)  │
│  Loop Guard: SHA256 hash of (tool+params+result) — block at 3 │
│  Parallel tool execution for independent calls                │
│  Tool result compression for outputs >1000 tokens             │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  MEMORY SYSTEM (Three-Tier — from OpenFang + Paperclip)       │
│                                                               │
│  Tier 1 — Structured (Postgres KV, always loaded):            │
│    core_memory: identity, health_profile, preferences,        │
│    active_goals, recent_insights. Self-modifying via tools.   │
│    Temporal validity: learned_on, confidence_decay, access_ct │
│    Memory decay: hot (7d) → warm (30d) → cold (30d+)         │
│                                                               │
│  Tier 2 — Summaries (Postgres, on-demand):                    │
│    Session summaries (per conversation)                        │
│    Weekly compaction (session summaries → core memory updates) │
│    Append-only pattern log (never delete, only archive)       │
│    Pending followups (track suggestion outcomes)              │
│                                                               │
│  Tier 3 — Semantic Search (Phase 2 — pgvector):               │
│    Embeddings over conversation summaries + pattern log        │
│    Intent-driven retrieval (0-5 typed queries, not monolithic)│
│    Health knowledge graph (entity-relationship: caffeine       │
│      --worsens--> sleep_latency, confidence 0.8)              │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  PROACTIVE HANDS (from OpenFang + Paperclip Heartbeat)        │
│                                                               │
│  Morning Brief Hand — daily at wake time, multi-phase playbook│
│  Stress Monitor Hand — every 15 min, gated on confidence      │
│  Baseline Updater Hand — daily 4 AM, no LLM (pure compute)   │
│  Weekly Review Hand — Sunday evening, Opus (Phase 2)          │
│                                                               │
│  Wakeup coalescing: multiple health events in one window      │
│    → single alert, not many (from Paperclip)                  │
│  Quality gates + risk-weighted priority before every send     │
│  Four-Phase Nudge: signal → meaning → micro-action → buttons │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  DELIVERY + FEEDBACK                                          │
│                                                               │
│  Telegram (grammY) — MVP channel                              │
│  Personality Spectrum: zone selected by CRS + data quality    │
│  Close-every-loop: follow up on suggestions, track outcomes   │
│  Three-tier feedback: implicit (0.2) + buttons (0.5) + rich  │
│  Adapter pattern for future channels (WhatsApp, push, in-app)│
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Prompt Builder — 25-Field Context Assembly

**Source:** OpenFang's `PromptContext` (25 fields, 14 sections). Adapted for OneSync's health agent.

### OneSync Prompt Fields

| # | Field | Source | Cached? | Tokens |
|---|-------|--------|---------|--------|
| 1 | `soul_base` | Hardcoded string | Yes (1h TTL) | ~200 |
| 2 | `zone_modifier` | Computed from CRS | No | ~100 |
| 3 | `mode_template` | Trigger type | Yes (1h TTL) | ~100 |
| 4 | `safety_rules` | Hardcoded | Yes (1h TTL) | ~100 |
| 5 | `tool_definitions` | Dynamic subset (3-8 of 8) | Partially | ~400 |
| 6 | `user_profile` | Supabase `users` table | Yes (5min TTL) | ~150 |
| 7 | `core_memory_excerpt` | Relevant slice of core_memory | Yes (5min TTL) | ~200 |
| 8 | `health_baselines` | Rolling 7d/30d averages | Yes (15min TTL) | ~100 |
| 9 | `current_crs` | On-phone computation | No | ~60 |
| 10 | `biometric_snapshot` | Latest health_snapshot | No | ~150 |
| 11 | `trigger_context` | Why this invocation fired | No | ~100 |
| 12 | `last_interaction` | Previous agent→user exchange | No | ~100 |
| 13 | `pending_followups` | Suggestions awaiting outcome check | No | ~100 |
| 14 | `conversation_history` | Last 3 turns + compressed summary | No | ~400 |
| 15 | `calendar_context` | Today's events (if relevant) | No | ~100 |
| 16 | `data_confidence` | Device tier (high/moderate/low/degraded) | No | ~20 |
| 17 | `chronotype` | early/normal/late | Yes (cached) | ~10 |
| 18 | `current_datetime` | Timestamp + timezone | No | ~20 |
| 19 | `channel_type` | "telegram" (MVP) | Yes | ~10 |
| 20 | `user_name` | From profile | Yes | ~10 |

### Assembly Order (cache-optimized — from OpenFang insight)

**System message** (stable prefix → high cache hit rate):
```
[1] Safety rules + medical disclaimers          (START — highest attention)
[2] Soul base + zone modifier + mode template
[3] Tool definitions (dynamic subset)
[4] Core memory excerpt + health baselines
[5] User profile + chronotype + preferences     (MIDDLE — stable, tolerates attention dip)
```

**User message** (dynamic — separate for cache isolation, from OpenFang):
```
[6] Trigger context + biometric snapshot + CRS  (END — high attention)
[7] Last interaction + pending followups
[8] Conversation history (last 3 turns)
[9] Calendar context (if relevant)
```

**Why separate messages?** Injecting changing data (CRS, biometrics) into the system prompt invalidates the entire cache. By keeping the system prompt stable and putting dynamic data in a user message, we get near-100% cache hits on the system prompt (saves 50%+ on those tokens).

### Token Budget Enforcement

| Component | Budget | Compression Trigger |
|-----------|--------|-------------------|
| System message (fields 1-5) | 1200 tokens | Summarize memory if exceeding |
| User message (fields 6-9) | 800 tokens | Truncate history, drop calendar |
| Tool definitions | 500 tokens | Load only 3-4 most relevant tools |
| **Total input** | **2500 tokens** | Trigger optimization at 70% (1750) |

---

## 3. Personality Spectrum — Context-Adaptive Zones

**Source:** Agency-Agents (Whimsy Injector + Brand Guardian patterns)

Replace 4 static soul files with **5 personality zones × 4 modes**. Zone is selected by CRS + data quality. Mode is selected by trigger type. This gives 20 voice combinations instead of 4.

### The Five Zones

| Zone | CRS Range | Voice | Tone | Message Length |
|------|-----------|-------|------|---------------|
| ENERGIZED | 80+ | Upbeat, challenge-oriented | Coach pushing athlete | Normal (3 lines) |
| STEADY | 60-79 | Warm, informative | Trusted friend | Normal (3 lines) |
| FLAGGING | 40-59 | Honest, protective, concise | Wise advisor | Short (2-3 lines) |
| DEPLETED | <40 | Gentle, minimal, zero pressure | Caretaker | Minimal (1-2 lines) |
| CRISIS/NO DATA | N/A | Transparent, never alarming | Honest friend | Adaptive |

### Zone × Mode Examples

| | Morning Brief | Stress Alert | Conversational |
|---|---|---|---|
| **ENERGIZED** | "CRS 87 — peak zone. This is your deep work window. What's the hardest thing on your plate?" | "Quick flag: HRV dipped 15%. Probably just a passing spike since you're in great shape today." | Full engagement, challenge them |
| **DEPLETED** | "Rough night. CRS 34. One thing: water and take it slow." | "Your body needs a reset. Step away for 2 minutes. Nothing else matters right now." | Short answers, no pressure |

### Implementation

```typescript
const zone = getPersonalityZone(crs, dataCompleteness);
const mode = triggerType;
const systemPrompt = SOUL_BASE + ZONE_MODIFIERS[zone] + MODE_TEMPLATES[mode];
```

### Voice Adaptation to Data Quality

| Confidence | Language Style |
|-----------|---------------|
| HIGH (Apple Watch RMSSD) | "Your HRV dropped 25% from baseline" |
| MODERATE (Pixel/Fitbit) | "Your HRV appears lower than usual" |
| LOW (Samsung HR proxy) | "Based on heart rate patterns (I don't have HRV from your device)..." |
| DEGRADED (missing/stale) | "I'm missing overnight data — did you wear your watch to bed?" |

---

## 4. Hook Pipeline — Pre/Post Reasoning

**Source:** CoPaw (pre-reasoning hooks) + OpenFang (loop guard, output validation)

### Pre-Reasoning Hooks (before Claude call)

```
Hook 1: EMERGENCY BYPASS
  Scan for: "chest pain", "can't breathe", "suicidal", "want to die", "overdose"
  Action: Skip normal loop → return emergency response → log for review
  Source: CoPaw safety hook

Hook 2: QUALITY GATES (1, 3, 4)
  Gate 1 — Data sufficiency: ≥1 health metric from last 6h, CRS used ≥2 components
  Gate 3 — Timing: not during sleep, 2h cooldown, max 3/day, not muted
  Gate 4 — Fatigue: engaged with ≥1 of last 3, no "too frequent" feedback, novel insight
  Action: If fail → queue for later, or send degraded message, or skip
  Source: Agency-Agents NEXUS gates

Hook 3: CONTEXT INJECTION
  Inject: latest CRS + biometric snapshot (if not already in context)
  Inject: calendar events (if morning or meeting in next 2h)
  Inject: pending followups (if morning brief)
  Source: CoPaw context injection hook

Hook 4: COMPACTION
  Check: conversation history token count vs budget (600 tokens)
  Action: If exceeding → compress older messages into structured summary
  Preserve: health facts, user preferences, action items
  Source: Pi Mono auto-compaction + CoPaw memory compaction hook

Hook 5: RATE LIMIT
  Check: daily cost budget, daily message count, per-minute rate
  Action: If exceeded → respond with cached/template message, log
  Source: OpenFang GCRA rate limiter
```

### Post-Reasoning Hooks (after Claude response, before delivery)

```
Hook 6: HEALTH LANGUAGE SAFETY (Gate 2)
  Scan output for banned patterns:
    "You are stressed" → must be "Your body is showing stress signals"
    "You need to..." → must be "You might want to consider..."
    Diagnosis language (anxiety, depression, insomnia, arrhythmia)
    "Always" / "never" about health
    Population comparisons
  Action: If found → regenerate with feedback (max 2 retries) → template fallback
  Source: Agency-Agents healthcare compliance

Hook 7: CONFIDENCE CHECK (Gate 5)
  Stress alerts: confidence ≥ 0.60
  Morning insights: ≥3 data points behind any claimed pattern
  Memory claims: only reference "high" confidence patterns
  Action: If fail → omit uncertain claim (better to say less)

Hook 8: LOOP GUARD
  SHA256 hash of (tool_name + params + result)
  Warn at 2 identical calls, block at 3 (tight — only 3 iterations allowed)
  Outcome-aware: same call + same result 2x → permanently blocked for session
  Source: OpenFang loop_guard.rs

Hook 9: MEMORY UPDATE
  If agent called update_memory → persist to Supabase
  If substantive conversation → trigger async summary generation
  Record first, answer second (from CoPaw proactive recording)
  Source: CoPaw + OpenFang

Hook 10: ANALYTICS
  Log: model, tokens_in, tokens_out, tools_called, response_time_ms
  Log: trigger_type, CRS_at_time, data_confidence, zone, mode
  Fire-and-forget to agent_logs table
  Source: OpenFang + Paperclip cost tracking
```

---

## 5. Memory Architecture — Three-Tier with Decay

**Source:** OpenFang (triple-layer) + Paperclip (PARA + decay) + OpenViking (L0/L1/L2 summaries) + CoPaw (proactive recording)

### Tier 1: Structured Memory (Always Loaded)

PostgreSQL `core_memory` table. ~200 tokens when serialized.

```json
{
  "identity": { "name": "Shivansh", "age": 22, "timezone": "IST", "chronotype": "normal" },
  "health_profile": {
    "conditions": [], "medications": ["magnesium 400mg"],
    "resting_hr": 62, "hrv_baseline_rmssd": 45,
    "device": "Apple Watch Series 9", "device_confidence": "high"
  },
  "preferences": {
    "message_style": "data-driven", "optimal_send_time": "07:15",
    "intervention_preference": "breathing > walks > caffeine reduction",
    "cognitive_load_tolerance": "medium", "alert_aggressiveness": "conservative"
  },
  "active_goals": [
    { "goal": "maintain 7h+ sleep", "status": "in_progress", "parent": "optimize_health" }
  ],
  "recent_insights": [
    { "pattern": "HRV drops 25% on Monday afternoons",
      "learned_on": "2026-03-01", "last_validated": "2026-03-18",
      "validation_count": 8, "confidence": "high", "confidence_decay": "weekly" }
  ]
}
```

**Memory Decay System** (from Paperclip PARA):

| Tier | Recency | Behavior |
|------|---------|----------|
| HOT | Accessed/validated in 7 days | Prominent in context. Full detail. |
| WARM | 8-30 days since last validation | Included but lower priority. Summary only. |
| COLD | 30+ days | Omitted from context. Still in DB. Agent can recall via tool. |

**Rule:** High `validation_count` resists decay. A pattern validated 15 times doesn't go cold as fast as one validated twice. Facts are never deleted — only superseded (`superseded_by` field).

**Proactive Recording** (from CoPaw): When user mentions health info ("started magnesium", "didn't sleep well", "stressed about deadline"), the agent calls `update_memory` BEFORE crafting its response. Context is never lost even if the session drops.

### Tier 2: Summaries + Pattern Log (On-Demand)

**Session Summaries** — When conversation exceeds 10 messages:
```markdown
## Session Summary (March 20, 10:00-10:45 AM)
- User asked about sleep → reported 5.2h, poor deep sleep
- Agent suggested earlier bedtime → user committed to 11 PM target
- User mentioned headache → agent noted correlation with low sleep
- Mood: slightly frustrated. Action items: 11 PM bedtime tonight.
```

**Weekly Compaction** — Via pg_cron Sunday evening:
- Review week's session summaries
- Promote validated patterns to core_memory.recent_insights
- Generate weekly learning digest for user (builds trust)
- Update health baselines if shifted significantly

**Append-Only Pattern Log** (from Agent-Skills-for-Context-Engineering):
```json
{ "timestamp": "2026-03-20T14:30:00Z",
  "type": "intervention_outcome",
  "observation": "5-min breathing exercise → CRS improved 8 points in 1h",
  "confidence": "moderate", "validation_count": 1,
  "source": "measured" }
```
Types: `correlation`, `preference`, `baseline_shift`, `intervention_outcome`
Never delete. Mark as `archived` when superseded. Enables monthly retrospectives.

**Pending Followups** — Track suggestion outcomes:
```json
{ "suggestion": "phone in other room at bedtime",
  "suggested_on": "2026-03-19",
  "metric_to_check": "sleep_efficiency",
  "baseline": 82, "check_after": "next_morning_brief",
  "attempts": 1, "outcomes": [] }
```

### Tier 3: Semantic Search (Phase 2)

- pgvector embeddings over conversation summaries + pattern log
- Intent-driven retrieval: 0-5 typed queries per turn (from OpenViking), not one monolithic search
- Health knowledge graph: entity-relationship model
  - `late_coffee` --worsens--> `sleep_latency` (confidence: 0.8)
  - `afternoon_walk` --improves--> `hrv_recovery` (confidence: 0.9)
  - `back_to_back_meetings` --triggers--> `stress` (confidence: 0.85)

### Health Data L0/L1/L2 Summaries (from OpenViking — 83% token reduction)

Don't stuff raw HRV/sleep/activity data into context. Generate compressed summaries:

| Layer | Content | When Loaded | Tokens |
|-------|---------|-------------|--------|
| L0 (Abstract) | "Day was high-stress, poor sleep, CRS 42" | Always — for quick triage | ~20 |
| L1 (Overview) | Sleep 5.2h, HRV down 18%, 3 stress events, steps 4200 | Default — morning briefs, alerts | ~100 |
| L2 (Detail) | Full minute-by-minute HRV readings, sleep stage transitions, all data points | On-demand — user asks "show me the data" | ~1500 |

**Baseline Updater Hand** generates fresh L0/L1 summaries daily at 4 AM (no LLM — pure computation). These summaries are what the agent loads, not raw sensor data.

---

## 6. Proactive Hands — Multi-Phase Playbooks

**Source:** OpenFang Hands pattern + Paperclip heartbeat execution + CoPaw cron skills

Each proactive feature is a self-contained **Hand** with a manifest, tools, schedule, gate condition, and multi-phase playbook (from OpenFang's numbered-phase system prompts).

### Morning Brief Hand

```
Schedule: Daily at user's estimated wake time (from sleep midpoint)
Model: Claude Haiku 4.5
Gate: Always fire (morning brief is the hero feature)
Tools: get_crs, get_sleep, read_memory, send_message
Wakeup coalescing: If multiple health events overnight, summarize into one brief

PLAYBOOK:
  Phase 0 — Load Context
    Load user profile, CRS, overnight health data, pending followups
    Select personality zone based on CRS

  Phase 1 — Compute Health State
    CRS score + component breakdown
    Sleep quality vs baseline
    Any overnight anomalies (HR spikes, low SpO2)

  Phase 2 — Check Followups
    Did yesterday's suggestion work? (check pending_followups vs today's data)
    Any patterns confirmed or invalidated?

  Phase 3 — Generate Brief
    Apply Four-Phase Nudge structure:
      [Signal] What happened overnight
      [Meaning] What it means for today
      [Action] One specific micro-action for today
    Include followup result if relevant ("yesterday's early bedtime worked — +12% efficiency")

  Phase 4 — Deliver + Log
    Send via Telegram with feedback buttons
    Log: delivery time, CRS, zone, data confidence
    Update last_interaction
```

### Stress Monitor Hand

```
Schedule: Every 15 min via pg_cron (check-triggers Edge Function)
Model: Rules-based pre-filter first → Haiku only if threshold crossed
Gate: Stress confidence ≥ 0.60 AND 2h cooldown AND daily cap not reached
      AND risk-weighted priority > 0.40
Tools: get_crs, get_stress_events, send_message
Wakeup coalescing: Multiple sub-threshold events in one window → single check (from Paperclip)

PLAYBOOK:
  Phase 0 — Rules Pre-Filter (no LLM — $0)
    If CRS > 60 AND stress confidence < 0.30 → SKIP (saves 60-80% of calls)
    If within 2h cooldown → SKIP
    If 3 proactive messages already today → SKIP

  Phase 1 — Evaluate Stress Signal
    Compute risk-weighted priority: Signal × Impact × Timing × Novelty
    If priority < 0.40 → LOG but don't alert

  Phase 2 — Contextualize (Claude Haiku)
    Why is the user stressed? (back-to-back meetings? late night? no data?)
    Is this a known pattern? (check Monday afternoon pattern, etc.)

  Phase 3 — Generate Alert
    Apply Nudge structure: signal → meaning → ONE micro-action
    Cognitive load awareness: CRS < 40 → max 2 lines, simpler language

  Phase 4 — Deliver + Track
    Send via Telegram with [Helpful] [Not helpful] [Too frequent] buttons
    Add to pending_followups (check CRS in 2h to see if it recovered)
    Log everything
```

### Baseline Updater Hand

```
Schedule: Daily 4 AM
Model: NONE (pure TypeScript computation, no LLM)
Gate: Always fire

PLAYBOOK:
  Phase 0 — Compute rolling 7d and 30d baselines (HR, HRV, sleep, steps)
  Phase 1 — Detect significant baseline shifts (>10% change from 30d average)
  Phase 2 — Generate L0/L1 health summaries for yesterday
  Phase 3 — Update health_baselines table
  Phase 4 — If major shift detected → flag for next morning brief
  Phase 5 — Validate/decay memory entries (hot → warm → cold based on recency)
```

### Weekly Review Hand (Phase 2)

```
Schedule: Sunday evening
Model: Claude Opus (complex synthesis justifies cost — ~$0.015/call)
Gate: At least 5 days of data in the week

PLAYBOOK:
  Phase 0 — Aggregate week's health data + session summaries
  Phase 1 — Identify trends (CRS trajectory, sleep debt, stress patterns)
  Phase 2 — Compare to active goals ("maintain 7h+ sleep" — did we?)
  Phase 3 — Discover new patterns → add to core_memory if confidence > moderate
  Phase 4 — Compose weekly summary message for user
  Phase 5 — Update core_memory with validated weekly insights
```

---

## 7. The Four-Phase Nudge System

**Source:** Agency-Agents Behavioral Nudge Engine + Agent-Skills-for-Context-Engineering Digital Brain

**Every proactive message follows this structure:**

### Phase 1: Discover Preference (First 14 Days + Ongoing)

Track and store in `core_memory.preferences`:
- Message style: data-driven vs empathetic vs hybrid
- Optimal timing: when does user read fastest?
- Intervention types: breathing > walks > caffeine reduction (ranked by engagement)
- Cognitive load tolerance: short vs detailed messages
- Celebration response: does user respond well to acknowledgment?

### Phase 2: Deconstruct to Smallest Action

| Instead of | Say |
|-----------|-----|
| "Improve your sleep hygiene" | "Tonight, put your phone in the other room at bedtime" |
| "You need to reduce stress" | "Before your 3pm call, take 3 slow breaths" |
| "Exercise more" | "Could you take the stairs once today?" |

**Micro-sprint rule:** If the action takes >2 minutes or requires willpower, break it down further.

### Phase 3: Deliver One Thing

```
[1 line] What I noticed (the signal)
[1 line] What it means for you (personalized interpretation)
[1 line] One specific micro-action (the nudge)
[buttons] [Do it] [Not now] [Tell me more]
```

**Cognitive Load Awareness:** CRS < 40 → max 2 lines, simpler words, fewer choices.

### Phase 4: Celebrate + Close the Loop

```
T+0:  Send nudge
T+2h: If engaged → log signal, check if CRS improved
T+4h: If CRS improved → "Your HRV recovered 15% since that break. Small resets work for you."
T+24h: In morning brief → "Yesterday's break correlated with faster recovery. Adding to your pattern."
Never: If not engaged → silently reduce that nudge type's frequency
```

**Celebration rule:** Acknowledge EFFORT, not outcomes. "You went to bed 20 min earlier" is a win regardless.
**Off-ramp rule:** Never guilt-trip. Trust > compliance.

---

## 8. Quality Gates — 5 Gates Before Every Message

**Source:** Agency-Agents NEXUS + Evidence Collector

| Gate | Check | Pre/Post | Fail Action |
|------|-------|----------|-------------|
| **1. Data Sufficiency** | ≥1 metric from last 6h, CRS used ≥2 components, stress needs ≥1 cardiac signal | Pre | Skip or send degraded message |
| **2. Health Language** | No diagnosis words, no "you need to", no "always/never", no population comparisons | Post | Regenerate (max 2 retries) → template |
| **3. Timing** | Not during sleep, 2h cooldown, max 3/day, not muted, not during meeting | Pre | Queue for next window |
| **4. Message Fatigue** | Engaged with ≥1 of last 3, no "too frequent" feedback in 7d, novel insight | Pre | Reduce frequency or skip |
| **5. Confidence** | Stress ≥0.60, morning insights ≥3 data points, memory claims high-confidence only | Post | Omit uncertain claim |

### Risk-Weighted Priority (replaces binary threshold)

```
Priority = Signal Confidence × User Impact × Timing Relevance × Novelty
Threshold: > 0.40 to send. The 0.60 stress confidence is still the MINIMUM.
```

---

## 9. Cost Optimization — Every Technique

**Source:** All 12 repos, consolidated

| Technique | Savings | Phase |
|-----------|---------|-------|
| Rules-based pre-filter (no LLM for 60-80% of checks) | ~$8.70/user/month | MVP |
| Prompt caching (stable system msg → high hit rate) | ~60% on cached tokens | MVP |
| Dynamic tool loading (3-4 tools, not 8) | ~300 tokens/call | MVP |
| L0/L1/L2 health summaries (not raw data) | ~83% token reduction on health context | MVP |
| Token budget enforcement (2500 max) | Prevents bloat | MVP |
| Haiku-only for MVP | ~$0.90/Pro user/month | MVP |
| Template fallback on API failure | $0 on failures | MVP |
| Session compaction (summaries, not raw history) | ~50% on conversation tokens | MVP |
| Wakeup coalescing (one alert per event window) | Prevents duplicate calls | MVP |
| Loop guard (block duplicate tool calls at 3) | Saves wasted iterations | MVP |
| MixtureOfAgents (3 specialist Haiku → 1 synthesis) | 88% cheaper than Opus | Phase 2 |
| pgvector semantic search (targeted retrieval) | Load only relevant memories | Phase 2 |
| Model routing by severity (Haiku/Sonnet/Opus) | Right-size cost to task | Phase 2 |

---

## 10. Adapter Pattern — For Wearables and Channels

**Source:** Paperclip adapter pattern

```typescript
// Every data source implements the same interface:
interface HealthAdapter {
  connect(permissions: Permission[]): Promise<void>;
  sync(since: Date): Promise<HealthSnapshot[]>;
  getLatestData(): Promise<HealthSnapshot>;
  getCapabilities(): AdapterCapabilities; // { hasHRV: boolean, hasSleepStages: boolean, ... }
  getConfidenceTier(): 'high' | 'moderate' | 'low';
}

// Implementations:
class HealthKitAdapter implements HealthAdapter { ... }      // iOS — confidence: high
class HealthConnectAdapter implements HealthAdapter { ... }  // Android — confidence: varies by OEM
class SamsungSensorAdapter implements HealthAdapter { ... }  // Post-MVP — confidence: moderate
```

Same pattern for delivery channels:
```typescript
interface ChannelAdapter {
  send(message: string, buttons?: Button[]): Promise<void>;
  onMessage(handler: (msg: UserMessage) => void): void;
  onFeedback(handler: (feedback: FeedbackEvent) => void): void;
}

// MVP: TelegramAdapter
// Phase 2: WhatsAppAdapter, PushNotificationAdapter
// Phase 3: InAppChatAdapter, VoiceAdapter
```

---

## 11. Skills System — Progressive Loading

**Source:** CoPaw + PicoClaw + Agent-Skills-for-Context-Engineering

### Skill Format

```yaml
# skills/sleep-analysis/SKILL.md
---
name: sleep-analysis
description: Analyze sleep data and provide actionable improvement guidance
tools: [get_sleep, get_crs, read_memory, update_memory]
triggers: [sleep, insomnia, tired, exhausted, waking, bedtime, nap]
---

## When to Use
- User asks about sleep quality
- Morning brief includes sleep data below baseline
- Sleep score drops below 60

## Assessment Steps
1. Get last night's sleep (duration, stages, efficiency)
2. Compare to 7d and 30d baselines
3. Check context: stress, caffeine, screen time, exercise
4. Identify patterns (consistent wake times? accumulating debt?)

## Response Guidelines
- Lead with the most actionable insight
- Compare to THEIR baseline, not population norms
- Suggest ONE specific change, not a list
- If sleep debt > 5h over the week, flag prominently
```

### MVP Skills (3)
- `sleep-analysis` — Sleep assessment protocol
- `stress-management` — Stress intervention decision tree (breathing, breaks, reframing)
- `morning-briefing` — Morning report generation protocol

### Progressive Loading (from CoPaw/PicoClaw — 3 levels)
1. **L1 (always):** Skill name + description only (~50 tokens total for 3 skills)
2. **L2 (on trigger):** Full SKILL.md body (~200-500 tokens) loaded when keywords match
3. **L3 (on demand):** Reference files loaded only when actively needed

This converts O(n) static token cost into O(1) per invocation.

---

## 12. AI Onboarding Interview — Cold Start Killer

The agent's first act of intelligence. Not a static form — a dynamic, AI-driven conversation that builds a deep user profile and calibrates the agent's personality before the first morning brief.

### Why This Matters

The cold start problem: the first 7-14 days of any personalized agent are useless because it doesn't know you. The AI interview gives the agent Day-1 context that would otherwise take 2 weeks of wearable data to learn.

### How It Works

Same agent core, different mode. Uses `SOUL_ONBOARDING` (curious, warm, professional, never judgmental) + existing tools (`update_memory`, `get_user_profile`). Writes to `core_memory` in real-time via proactive recording.

**Dynamic branching (not a decision tree):** Questions adapt based on AI understanding of previous answers. User says "better sleep" → agent goes deep on sleep patterns. That user mentions SSRIs → agent knows HRV data will be medication-affected, adjusts baselines. A static form either asks ALL questions (too long) or misses the relevant ones.

### Progressive Profiling (Waves, Not a Wall)

| Wave | When | Duration | What It Asks | Why Now |
|------|------|----------|-------------|---------|
| **Core Interview** | Day 0 (onboarding) | 3-5 min | Goals, device, chronotype, communication style, medications, key health context | Sets up the agent from Day 1 |
| **Sleep Deep-Dive** | Day 3 | 2 min | "You slept 5.8h last night. Is that typical? What usually keeps you up?" | Has 3 nights of real data to make questions contextual |
| **Stress Calibration** | Day 7 | 2 min | "I noticed your HRV dropped at 2pm. What was happening?" | Triggered by first stress detection — real context |
| **Relationship Check-In** | Day 14 | 2 min | "How's OneSync working? What should I do differently?" | Enough history to course-correct |

Each wave has CONTEXT from real data, making questions sharper than Day 0 could ever be.

### Implicit Behavioral Calibration

The interview isn't just collecting answers — it's observing HOW the user answers:

- Terse one-word answers → set personality to minimal/brief mode
- Long detailed responses → set personality to data-rich analytical mode
- Emotional language → set personality to warm empathetic mode
- Questions about the science → set personality to evidence-based mode

The agent learns communication style DURING the interview, before it has any wearable data.

### What the Interview Writes to core_memory

```json
{
  "health_profile": {
    "conditions": ["mild anxiety"],
    "medications": ["SSRI — affects HRV baseline"],
    "supplements": ["magnesium 400mg before bed"],
    "chronotype": "late",
    "exercise_routine": "runs 3x/week, mornings",
    "caffeine": "2 cups before noon",
    "alcohol": "occasional weekends"
  },
  "preferences": {
    "communication_style": "data-driven",
    "message_frequency": "minimal",
    "coaching_approach": "direct, not gentle",
    "morning_brief_detail": "numbers + one action"
  },
  "goals": [
    { "goal": "sleep 7h+ consistently", "priority": "primary" },
    { "goal": "reduce meeting fatigue", "priority": "secondary" }
  ],
  "calibration": {
    "personality_zone_default": "steady",
    "verbosity": "low",
    "data_preference": "high",
    "celebration_response": "neutral"
  }
}
```

### Voice Option (Phase 2)

Voice interview via Whisper STT + Claude + TTS:
- People share more via voice (lower friction than typing)
- Feels like talking to a health coach, not filling a form
- Accessibility for users who struggle with typing
- Agent can adapt pace in real-time

### Medical Safety Through Conversation

A checkbox gets "No" 90% of the time. A conversational AI naturally surfaces:
- "Do you take anything that might affect your heart rate?" → beta-blockers, SSRIs
- "Are you pregnant or planning to be?" → pregnancy changes HRV baselines significantly
- Heart conditions → adjusts HR-based alerts
- Mental health context → ensures emergency bypass is properly calibrated

### Implementation

No new infrastructure. It's the existing agent with:
- Soul file: `SOUL_ONBOARDING`
- Tools: `update_memory` (writes profile in real-time) + `get_user_profile` (reads what we know so far)
- Mode: interview mode (one question at a time, waits, adapts)
- Delivery: Telegram chat (MVP) or voice (Phase 2) or in-app form (Phase 2)

---

## 13. Goal Ancestry — Health Goals Hierarchy

**Source:** Paperclip goal ancestry pattern

Every recommendation traces back to the user's health goals through a parent chain:

```
Top Goal: "Optimize cognitive performance"
  └─ Sub-goal: "Maintain 7h+ sleep"
       └─ Task: "Go to bed by 11 PM tonight"
            └─ Micro-action: "Put phone in other room at 10:45 PM"
  └─ Sub-goal: "Reduce Monday afternoon crashes"
       └─ Task: "Block 15-min break between meetings"
            └─ Micro-action: "Take 3 slow breaths before 3pm call"
```

**Why this matters:** The agent can explain WHY it's recommending something by tracing the ancestry: "I'm suggesting this breathing exercise because your goal is to reduce Monday crashes, and your HRV just dropped 22% — which is the exact pattern we've been working on."

**Implementation:** Store in `core_memory.active_goals` with `parent` field. Morning brief references top-level goals. Stress alerts reference the specific sub-goal at risk.

---

## 13. Proactive Intelligence Escalation

| Level | Phase | What Agent Does | Example |
|-------|-------|----------------|---------|
| **1: Reactive** | MVP (D-E) | Responds to current state | "Your HRV dropped 22% in the last 30 min" |
| **2: Pattern-Aware** | G-H | Recognizes recurring patterns, warns preemptively | "It's Monday 1:30pm — your HRV typically drops now. Take a break before your next meeting." |
| **3: Predictive** | Post-MVP Phase 2 | Predicts future state from trends + manages tasks | "Sleep debt + 4 meetings tomorrow → CRS will crash by 2pm. I've moved your hardest task to 10am." |
| **4: Autonomous OS** | Post-MVP Phase 3+ | Full personal operating system — any task, any domain | See below |

Each level requires the previous to work well. Don't skip.

### Level 4: The Autonomous Personal OS (Full Detail)

Level 4 is where OneSync stops being an "agent" and becomes a **personal operating system**. The agent can perform almost any task because it has three things no other system has: (1) your biological state, (2) your full workspace context, (3) months of learned patterns about how YOU work best.

**Architecture (Brain → Orchestrator → Execution pattern):**

```
Brain (always-on, persistent)
│  Thinks, plans, remembers, decides
│  Knows your CRS, patterns, goals, preferences
│  Maintains the learning flywheel
│
├── Orchestrator (routes to the right execution path)
│   │
│   ├── Health Hands
│   │   ├── Morning Brief Hand (daily)
│   │   ├── Stress Monitor Hand (every 15 min)
│   │   ├── Sleep Coach Hand (nightly)
│   │   └── Activity Nudge Hand (sedentary detection)
│   │
│   ├── Productivity Hands
│   │   ├── Calendar Optimizer Hand (reschedule based on CRS)
│   │   ├── Task Prioritizer Hand (rerank by cognitive state)
│   │   ├── Focus Guard Hand (DND + Slack status)
│   │   └── Email Triage Hand (surface urgent, defer rest)
│   │
│   ├── Life Hands
│   │   ├── Weekly Review Hand (patterns + goals + retrospective)
│   │   ├── Learning Digest Hand (what agent learned about you)
│   │   ├── Social Reminder Hand (relationship maintenance)
│   │   └── Habit Tracker Hand (streaks + gentle nudges)
│   │
│   ├── Skill Execution (user-taught workflows)
│   │   ├── "Prep for standup" → pull tickets + check sleep + draft talking points
│   │   ├── "Wind down" → dim lights + queue sleep playlist + set morning alarm
│   │   └── Any user-defined automation
│   │
│   └── Code Execution (arbitrary tasks via sandboxed capsules)
│       ├── Research tasks → web search + summarize + deliver at peak CRS
│       ├── Data analysis → run Python/JS, generate charts
│       ├── Content creation → draft, review, polish
│       └── Any task that needs ephemeral compute
│
└── MCP Integration Layer (unbounded tool ecosystem)
    ├── Health: HealthKit, Health Connect, Samsung SDK
    ├── Workspace: Google Calendar, Gmail, Slack, Linear, Notion
    ├── Creative: Figma, Canva, Midjourney
    ├── Dev: GitHub, Cursor, Claude Code
    ├── Life: Spotify, Uber, Swiggy, banking APIs
    └── Any new MCP server = new domain unlocked
```

**Skill Learning System:**

The agent doesn't just use pre-built tools — it learns new skills from you:

```
User: "When I say 'board prep', pull my CRS trend for the week,
       summarize my top achievements from Linear, check if I slept
       well last night, and draft 3 talking points."

Agent: Stores as skill: {
  name: "board_prep",
  trigger: "board prep",
  steps: [
    { tool: "get_crs", params: { range: "7d" } },
    { tool: "query_linear", params: { filter: "completed", range: "7d" } },
    { tool: "get_sleep", params: { range: "1d" } },
    { tool: "generate_text", params: { template: "talking_points", count: 3 } }
  ],
  delivery: "compile_and_send",
  learned_on: "2026-04-15"
}

Next time: "Board prep" → agent executes all 4 steps, delivers result.
```

**Cross-Agent Orchestration:**

OneSync becomes the biological intelligence layer that other agents tap into:

```
Cursor (coding agent)
  └── Asks OneSync: "Is the user in a good cognitive state for a complex refactor?"
  └── OneSync: "CRS is 41. Suggest simpler tasks or defer to tomorrow morning."

Lindy (workflow agent)
  └── Asks OneSync: "Should I schedule the investor call for 4pm?"
  └── OneSync: "User's CRS historically crashes at 3pm on Thursdays. Suggest 10am."

Claude Code (dev agent)
  └── Asks OneSync: "User has been coding for 4 hours straight. Should I suggest a break?"
  └── OneSync: "HRV dropped 18% in the last hour. Yes, suggest a 10-min walk."
```

**This is the endgame:** OneSync as the biological substrate that every other AI agent consults before acting. Not competing with Lindy or Manus — powering them with the one signal they don't have.

---

## 14. Security Architecture

**Source:** OpenFang (16 systems) + Agency-Agents quality gates. OneSync-relevant subset:

### MVP (7 systems)
1. **Output validation** — Banned medical phrase scanning before delivery
2. **Emergency bypass** — Suicidal ideation, self-harm, medical emergency → immediate safety response
3. **Input sanitization** — Prevent prompt injection via Telegram messages
4. **RLS** — Supabase Row-Level Security, users only see own data
5. **Encryption at rest** — SQLCipher on device, Supabase default encryption
6. **Audit logging** — Every agent invocation logged (model, tools, tokens, response time)
7. **Rate limiting** — Per-user message + cost limits

### Phase 2 (5 additional systems)
8. **Taint tracking** — Label health data at source (HealthKit/Health Connect), track through pipeline
9. **Loop guard** — SHA256-based duplicate tool call detection
10. **Prompt injection scanner** — Detect override attempts, data exfiltration, role hijacking
11. **Approval gates** — High-stakes recommendations require explicit user confirmation
12. **Session repair** — Recover from corrupted conversation state

---

## 15. Steering and Follow-Up Queues

**Source:** Pi Mono dual-queue pattern

In a Telegram context:
- **Steering:** User sends urgent message while agent is processing → interrupt, escalate immediately
  - Detection: "STOP", "help", "emergency", "chest pain", "actually I meant..."
- **Follow-up:** User sends non-urgent message while agent is processing → queue for after current run
  - Store queued messages in Supabase, check queue at start of each invocation

**Wakeup Coalescing** (from Paperclip): If multiple health events arrive within a 15-min window, coalesce into one alert with merged context — not multiple separate alerts.

---

## 16. Provider Failover Chain

**Source:** PicoClaw + OpenFang

```
Conversation/Morning Brief:
  1. Claude Haiku 4.5 (primary)
  2. Template-based response with actual CRS data (fallback — no AI personality but still useful)

Routine Health Checks:
  1. Rules-based evaluation (no LLM, $0)
  2. Claude Haiku (only if rules are inconclusive)

Error Classification:
  429 (rate limit) → exponential backoff retry
  529 (overloaded) → template fallback
  500+ (server error) → retry once, then template
  Timeout (>50s) → retry with shorter max_tokens, then template
```

---

## Summary: What's Adopted vs Planned

### Adopted (build into MVP — Phases D-E)
- Prompt builder with cache-optimized assembly (separate system/user messages)
- Personality Spectrum (5 zones × 4 modes)
- Pre/post reasoning hook pipeline (10 hooks)
- Two-tier memory with temporal validity + proactive recording
- Morning Brief + Stress Monitor + Baseline Updater Hands with multi-phase playbooks
- Four-Phase Nudge system for every proactive message
- 5 quality gates + risk-weighted priority
- L0/L1/L2 health data summaries (not raw data in context)
- Token budget enforcement (2500 max)
- Loop guard (SHA256, block at 3)
- Provider failover (Haiku → template)
- Adapter pattern for wearables and channels
- 3 MVP skills with progressive loading
- Goal ancestry for health recommendations
- Close-every-loop (pending followups)
- Emergency bypass hook
- All 12 cost optimization techniques

### Phase 2 Additions
- Tier 3 memory (pgvector + knowledge graph)
- Weekly Review Hand (Opus)
- MixtureOfAgents for complex synthesis
- Semantic search over conversation history
- Model routing (Haiku/Sonnet/Opus by severity)
- Taint tracking, prompt injection scanning, approval gates
- Skills marketplace (user-installable health skills)
- Predictive intelligence (Level 3)

### Phase 3+ Additions
- Autonomous actions (calendar blocking, meeting management)
- Population learning (federated across users)
- Adaptive CRS weights per user
- Multi-agent specialists (sleep, stress, activity) with orchestrator
- Voice interface, watch notifications

---

## 17. Context Engine — The Learning Flywheel

**Source:** Production Agent Platform Context Engine pattern. A persistent knowledge vault that makes the agent smarter with every interaction.

### The 3-Layer Context Graph

| Layer | Purpose | OneSync Equivalent |
|-------|---------|-------------------|
| **Knowledge Graph** | What exists — entities and relationships | Health profile, device capabilities, user identity, goal hierarchy |
| **Activity Traces** | What happened — individual event records | Health events, stress detections, intervention outcomes, conversation summaries |
| **Context Graph** | How things typically happen — distilled patterns | Discovered correlations, validated interventions, CRS patterns with confidence scores |

### The Learning Flywheel

```
BEFORE acting: Agent reads past patterns
  → "User's HRV drops on Mondays. Last breathing exercise improved CRS by 8 points."

DURING acting: Agent makes context-aware decisions
  → Chooses breathing exercise (proven) over walk suggestion (untested)

AFTER acting: Agent writes new learnings
  → "Breathing exercise at 2:15pm → CRS improved 11 points by 4pm. Validate count: 4."

3+ validations → Pattern promoted to "high confidence"
  → Future agents use this as established knowledge
```

### Distillation Loop

```
Event 1: Stress at 2pm Monday, breathing helped    → Activity Trace
Event 2: Stress at 2:30pm Monday, breathing helped  → Activity Trace
Event 3: Stress at 1:45pm Monday, breathing helped  → Activity Trace
                    ↓ (3+ events with common pattern)
Distilled Pattern: "Monday afternoon stress (1:45-2:30pm)"
  - Trigger: back-to-back meetings + afternoon circadian dip
  - Intervention: breathing exercise (3/3 successful)
  - Confidence: high
  - Time estimate: 5 min intervention → recovery in ~2h
```

### Workspace Files as Config (from Pi Mono + Production Agent Platform)

Instead of hardcoding behavior, use tunable config files:

| File | Purpose | Tunable Without Code Changes |
|------|---------|-----|
| `SOUL_BASE` | Agent personality, tone, boundaries | Yes — adjust voice without redeployment |
| `CALIBRATION.md` | CRS weights, stress thresholds, cooldown timers | Yes — tune algorithm parameters |
| `RULES.md` | Safety guardrails, banned phrases, medical disclaimers | Yes — update compliance rules |
| `PROFILE.md` | Per-user health profile, preferences, goals | Yes — user-specific via core_memory |

### Immutable Decision Records

Architecture decisions are **never edited, only superseded**. Preserves reasoning history:

```markdown
# Decision 001: On-Device CRS Computation
Status: ACTIVE
Date: 2026-03-18
Context: Need CRS available offline, no server round-trip
Decision: TypeScript CRS engine on phone
Consequences: Works offline, but harder to update algorithm (requires app update)

# Decision 002: Samsung HR Proxy
Status: ACTIVE
Date: 2026-03-20
Context: Samsung doesn't write HRV to Health Connect
Decision: Use HR BPM as proxy with lower confidence tier
Supersedes: None
```

---

## 18. Task Intelligence — Beyond Health

**OneSync is not just a health agent.** It's a personal cognitive OS that manages your tasks, schedule, and work alongside your biology.

### How Body Intelligence Enhances Task Management

| Without OneSync | With OneSync |
|----------------|-------------|
| You schedule the hard meeting at 4pm | Agent knows your CRS crashes at 3pm on Tuesdays — suggests moving it to 10am |
| You grind through email at 9am | Agent knows this is your peak CRS window — suggests deep work first, email at noon |
| You take on 3 more tasks at 2pm | Agent sees your HRV dropping — warns you're overcommitting during a low period |
| You forget to take a break for 4 hours | Agent messages: "You've been in back-to-back meetings since 1pm. 5 min break?" |
| You say yes to a 7pm meeting | Agent knows this disrupts your sleep pattern — suggests an alternative time |

### Task Agent Tools (Phase 2+)

| Tool | What It Does | Body-Aware Enhancement |
|------|-------------|----------------------|
| `get_calendar` | Read today/tomorrow's schedule | Overlay CRS predictions on each time slot |
| `block_time` | Block focus/recovery time | Auto-block when CRS is predicted to dip |
| `prioritize_tasks` | Rerank task list | CRS-aware: hard tasks during peak, admin during dip |
| `get_emails` | Surface urgent emails | Include in morning brief: "3 emails need response before 11am" |
| `set_slack_status` | Auto-DND / custom status | "In deep work — back at 2pm" when CRS is in peak zone |
| `reschedule` | Move meetings | "Your CRS will be 38 at 4pm — move the strategy session to tomorrow morning?" |
| `create_task` | Add to task manager | Break goals into CRS-aware daily tasks |
| `delegate_task` | Reassign work | "You're depleted today. Can this be delegated?" |

### The Unified Morning Brief (Health + Tasks)

```
Good morning, Shivansh. Here's your day:

BODY: You slept 7.1h (good!). HRV recovered. CRS at 72 — solid.
Peak window: 10am-1pm. Afternoon dip expected around 3pm.

WORK: 4 meetings today. Your hardest slot is the 2pm product review.
→ Suggestion: Move the 11am 1:1 to Slack async. Use 10-11am for the P0 bug.

TASKS: 3 items need attention. Ranked by CRS-optimal timing:
  1. [10am] Fix auth bug (deep work — peak CRS)
  2. [1pm] Review PR #234 (moderate focus)
  3. [3pm] Reply to investor email (low-energy OK)

→ Want me to block these on your calendar?

[Block it] [Adjust] [Just the brief]
```

---

## Summary: What's Adopted vs Planned

### Adopted (build into MVP — Phases D-E)
- Prompt builder with cache-optimized assembly (separate system/user messages)
- Personality Spectrum (5 zones × 4 modes)
- Pre/post reasoning hook pipeline (10 hooks)
- Two-tier memory with temporal validity + proactive recording
- Morning Brief + Stress Monitor + Baseline Updater Hands with multi-phase playbooks
- Four-Phase Nudge system for every proactive message
- 5 quality gates + risk-weighted priority
- L0/L1/L2 health data summaries (not raw data in context)
- Token budget enforcement (2500 max)
- Loop guard (SHA256, block at 3)
- Provider failover (Haiku → template)
- Adapter pattern for wearables and channels
- 3 MVP skills with progressive loading
- Goal ancestry for health recommendations
- Close-every-loop (pending followups)
- Emergency bypass hook
- All cost optimization techniques
- Workspace files as config (soul, calibration, rules)
- Context engine learning flywheel (read → act → write → distill)

### Phase 2: Cognitive Co-Pilot (Health + Tasks + Workspace)
- Task intelligence tools (calendar, email, Slack, task manager)
- Unified morning brief (body + work + tasks)
- Tier 3 memory (pgvector + knowledge graph)
- Weekly Review Hand (Opus)
- MixtureOfAgents for complex synthesis
- Immutable decision records
- Model routing (Haiku/Sonnet/Opus by severity)
- Predictive intelligence (Level 3: forecast CRS)
- Skills marketplace (user-installable)

### Phase 3+: Autonomous Personal OS
The agent becomes a full personal operating system that can handle virtually any task:

**Execution Capabilities:**
- Skill learning system — user teaches agent new multi-step workflows via conversation
- Code execution capsules — ephemeral sandboxes for research, analysis, content creation
- MCP integration layer — each new MCP server unlocks a new domain (Notion, GitHub, Figma, Spotify, banking, travel)
- Tool composition — chain existing tools into automated workflows triggered by health state + time + context

**Agent Ecosystem:**
- Multi-agent specialists (sleep, stress, activity, nutrition, productivity, research, creative)
- Cross-agent orchestration — OneSync provides biological context to Cursor, Lindy, Claude Code, any agent
- Sub-agent delegation — brain spawns specialist sub-agents for different tasks, coordinates results
- User-defined automations — "Every Monday at 7am, if CRS > 70, auto-accept the standup; if < 50, send apologies"

**Scaling Across Domains and Personas:**
- Population learning (federated across users — privacy-preserving)
- Adaptive CRS weights per user (ML on personal feedback data)
- Cross-domain personas — same Agent OS, different soul files + tools: students, athletes, executives, remote workers, clinical patients
- Voice interface, watch notifications, smart home integration
- Full life management — music, notes, habits, social, finance, travel

**The Endgame:**
OneSync as the **biological intelligence substrate** that every other AI agent consults before acting. Not competing with Lindy, Manus, or Claude Code — **powering them** with the one signal they don't have: your cognitive state. The agent that makes every other agent smarter.

---

## 19. The Complete Agent OS — Directory, Database & Invocation Reference

This section consolidates the full Agent OS into three views: (1) the file structure that defines the agent, (2) the database that stores what it knows, and (3) the complete flow of a single invocation. Everything above describes the pieces — this shows how they fit together.

### The Three Layers

The agent operates across three layers:

| Layer | What It Is | Where It Lives | What Changes It |
|-------|-----------|---------------|----------------|
| **Brain** (Config Files) | Soul files, rules, calibration, skills, hands — defines WHO the agent is | Git repo, loaded into prompts | Developer edits, A/B tests |
| **Memory** (Database) | core_memory, patterns, baselines, followups — what the agent KNOWS about each user | Supabase Postgres (RLS) + on-phone SQLCipher | Agent self-modifies via tools, daily computation |
| **Hands** (Tools + Integrations) | 8 MVP tools → 16+ Phase 2 → unlimited via MCP — what the agent CAN DO | Edge Functions + external APIs | New phases unlock new tools |

### 19.1 Agent OS File Structure

Every file the agent reads to construct its identity, voice, rules, and capabilities:

```
agent-os/
|
|-- souls/                              # WHO the agent is
|   |-- SOUL_BASE.md                    # Core personality (never changes per-call)
|   |                                   # "You are OneSync, a personal cognitive agent..."
|   |                                   # Voice principles, medical disclaimers, tone
|   |
|   |-- SOUL_ONBOARDING.md             # Day 0 interview mode
|   |                                   # Curious, warm, one-question-at-a-time
|   |                                   # Writes to core_memory in real-time
|   |
|   |-- zones/                          # HOW the voice adapts to CRS
|   |   |-- ENERGIZED.md               # CRS 80+  -- coach pushing athlete
|   |   |-- STEADY.md                  # CRS 60-79 -- trusted friend
|   |   |-- FLAGGING.md               # CRS 40-59 -- wise advisor, short messages
|   |   |-- DEPLETED.md               # CRS <40   -- caretaker, minimal, zero pressure
|   |   +-- CRISIS.md                 # No data   -- honest, transparent, never alarming
|   |
|   +-- modes/                          # WHAT type of message
|       |-- MORNING_BRIEF.md           # Template for daily morning message
|       |-- STRESS_ALERT.md            # Template for stress interventions
|       |-- CONVERSATIONAL.md          # Template for user-initiated chat
|       +-- WEEKLY_REVIEW.md           # Sunday evening summary (Phase 2)
|
|-- rules/                              # BOUNDARIES -- what the agent must never do
|   |-- SAFETY.md                       # Banned medical phrases, emergency keywords
|   |                                   # "never say 'you are stressed'"
|   |                                   # "say 'your body is showing stress signals'"
|   |                                   # Emergency: chest pain, suicidal, can't breathe
|   |
|   |-- HEALTH_LANGUAGE.md             # No "always/never" about health
|   |                                   # No population comparisons
|   |                                   # Confidence-tier language rules
|   |
|   +-- PRIVACY.md                     # What the agent can/can't store or share
|
|-- calibration/                        # TUNING -- numbers that change without code
|   |-- CRS_WEIGHTS.md                 # Sleep: 0.35, HRV: 0.25, Circadian: 0.25, Activity: 0.15
|   |-- STRESS_THRESHOLDS.md           # Confidence >= 0.60, cooldown 2h, max 3/day
|   |-- TIME_OF_DAY_RATIOS.md          # HRV baseline multipliers by 6 time blocks
|   +-- TOKEN_BUDGETS.md              # System: 1200, User: 800, Tools: 500, Total: 2500
|
|-- skills/                             # WHAT the agent knows how to do
|   |-- sleep-analysis/
|   |   +-- SKILL.md                   # When to use, assessment steps, response guidelines
|   |-- stress-management/
|   |   +-- SKILL.md                   # Breathing, breaks, reframing decision tree
|   |-- morning-briefing/
|   |   +-- SKILL.md                   # Morning report generation protocol
|   |
|   |   # Phase 2+:
|   |-- calendar-optimizer/
|   |   +-- SKILL.md                   # CRS-aware scheduling
|   |-- task-prioritizer/
|   |   +-- SKILL.md                   # Rerank by cognitive state
|   |-- email-triage/
|   |   +-- SKILL.md                   # Surface urgent, defer rest
|   |
|   |   # Phase 3+ user-created skills:
|   +-- user-skills/
|       |-- board-prep.yaml            # User-taught: pull CRS + Linear + sleep + talking points
|       |-- wind-down.yaml             # User-taught: dim lights + sleep playlist + alarm
|       +-- standup-prep.yaml          # User-taught: tickets + sleep score + draft 3 points
|
|-- hands/                              # PROACTIVE BEHAVIORS -- scheduled agent actions
|   |-- morning-brief.yaml             # Daily at wake time, always fires
|   |-- stress-monitor.yaml            # Every 15 min, rules pre-filter gated
|   |-- baseline-updater.yaml          # Daily 4 AM, no LLM, pure computation
|   |
|   |   # Phase 2+:
|   |-- weekly-review.yaml             # Sunday evening, Opus
|   |-- calendar-optimizer.yaml        # CRS prediction overlay on schedule
|   |-- focus-guard.yaml               # Auto-DND during peak CRS windows
|   |-- email-triage.yaml              # Morning scan of urgent emails
|   |
|   |   # Phase 3+:
|   |-- sleep-coach.yaml               # Nightly wind-down nudges
|   |-- activity-nudge.yaml            # Sedentary detection
|   +-- social-reminder.yaml           # Relationship maintenance
|
+-- adapters/                           # HOW data gets in and messages get out
    |-- health/
    |   |-- healthkit.ts               # iOS -- confidence: high (beat-to-beat IBI)
    |   |-- health-connect.ts          # Android -- confidence: varies by OEM
    |   +-- samsung-sensor.ts          # Phase 2 -- direct watch SDK
    |
    +-- channels/
        |-- telegram.ts                # MVP -- grammy
        |-- whatsapp.ts                # Phase 2
        |-- push-notification.ts       # Phase 2
        +-- in-app-chat.ts             # Phase 3
```

**How these files are used:** The Prompt Builder (Section 2) assembles a Claude call by loading `SOUL_BASE.md` + the relevant `zones/*.md` + `modes/*.md` into the system message (cached, stable prefix), then loads `SKILL.md` bodies on keyword match (progressive loading — L1 names always, L2 body on trigger). `rules/` files are always in the system message. `calibration/` files are read by the rules pre-filter and CRS engine, not by Claude directly.

### 19.2 Complete Database Schema — All Phases

Every table the agent reads from or writes to, organized by phase:

```
SUPABASE POSTGRES (per user, RLS enforced: auth.uid() = user_id)

MVP TABLES (Phase B-E)
=====================

core_memory                          # TIER 1 -- always loaded (~200 tokens)
  |-- identity                       # name, age, timezone, chronotype
  |-- health_profile                 # conditions, medications, baselines, device, confidence tier
  |-- preferences                    # message style, timing, intervention ranking, verbosity
  |-- active_goals                   # with parent hierarchy (goal ancestry)
  |                                  # "optimize_health" > "sleep 7h+" > "bed by 11pm"
  +-- recent_insights               # validated patterns with confidence + decay
                                     # { pattern, learned_on, validation_count, confidence }
                                     # HOT (7d) -> WARM (30d) -> COLD (30d+)

health_snapshots                     # Raw health data, every 15 min
  |-- hr_bpm, hrv_rmssd, steps
  |-- crs_score, crs_components (sleep, hrv, circadian, activity sub-scores)
  |-- stress_confidence
  +-- UNIQUE(user_id, timestamp)     # Idempotent upsert for background sync

sleep_sessions                       # One record per night
  |-- duration, efficiency
  |-- stages: { rem_min, deep_min, light_min, wake_min }
  |-- bedtime_consistency_deviation
  +-- sleep_debt_rolling_7d

stress_events                        # Every detected stress episode
  |-- confidence (0.0-1.0)
  |-- signals_used: { hrv_drop, hr_elevation, duration, activity_context }
  |-- context_note (what was happening, if known)
  +-- outcome (did intervention help? null until followup)

baseline_history                     # Rolling baselines, updated daily at 4 AM
  |-- avg_7d, avg_30d for: hr, hrv, sleep_duration, steps
  |-- time_of_day_ratios (6 blocks)
  +-- trend_direction (improving/stable/declining)

conversation_history                 # Chat messages
  |-- role (user/assistant), content, timestamp
  +-- compressed_summary (generated when > 10 messages)

feedback_events                      # Every thumbs up/down/too-frequent
  |-- message_id, feedback_type
  +-- context: { crs_at_time, trigger_type, zone, data_confidence }

agent_logs                           # Every agent invocation (NO health values!)
  |-- model, tokens_in, tokens_out, tools_called[], response_time_ms
  |-- trigger_type, zone, mode, data_confidence
  +-- cost_usd


PHASE 2 TABLES (Cognitive Co-Pilot)
====================================

session_summaries                    # TIER 2 -- on-demand
  |-- per-conversation summary       # "User asked about sleep, committed to 11pm"
  +-- weekly_compaction              # Sessions -> insights, runs Sunday evening

pattern_log                          # TIER 2 -- append-only, NEVER deleted
  |-- type: correlation | preference | baseline_shift | intervention_outcome
  |-- observation, confidence, validation_count
  +-- archived: boolean (superseded but preserved)

pending_followups                    # Track suggestion outcomes
  |-- suggestion, metric_to_check, baseline_value
  |-- check_after (next_morning_brief, +2h, +24h)
  +-- attempts, outcomes[]

knowledge_graph                      # Entity-relationship model
  |-- entity_a, relationship, entity_b
  |-- confidence (0.0-1.0)
  +-- examples:
       "late_coffee"    --worsens-->  "sleep_latency"    (0.8)
       "afternoon_walk" --improves--> "hrv_recovery"     (0.9)
       "3+_meetings"    --triggers--> "stress"           (0.85)

embeddings (pgvector)                # TIER 3 -- semantic search
  |-- conversation summary embeddings
  +-- pattern log embeddings


PHASE 3 TABLES (Autonomous OS)
==============================

learned_skills                       # User-taught automations
  |-- name, trigger_phrase
  |-- steps: [{ tool, params }]      # Tool chain to execute
  +-- learned_on, usage_count, last_used

decision_records                     # Immutable -- never edited, only superseded
  |-- decision, context, consequences
  +-- status: ACTIVE | SUPERSEDED, superseded_by

distilled_patterns                   # Learning flywheel output
  |-- raw events -> grouped -> distilled into high-confidence pattern
  |-- trigger, intervention, success_rate, confidence
  +-- promoted to core_memory when validation_count >= 3
```

### 19.3 Consolidated Tools — All Phases

Every tool the agent can call, across all phases:

| # | Tool | Phase | Read/Write | What It Does |
|---|------|-------|-----------|-------------|
| 1 | `get_crs` | MVP | Read | Current CRS score + 4 component sub-scores + zone |
| 2 | `get_sleep` | MVP | Read | Last night's sleep: duration, stages, efficiency, debt |
| 3 | `get_stress_events` | MVP | Read | Recent stress detections with confidence scores |
| 4 | `get_activity` | MVP | Read | Today's steps, distance, exercise, sedentary time |
| 5 | `get_user_profile` | MVP | Read | Age, chronotype, device, preferences |
| 6 | `read_memory` | MVP | Read | Patterns, goals, insights from core_memory |
| 7 | `update_memory` | MVP | Write | Store new learnings, update preferences/goals |
| 8 | `send_message` | MVP | Write | Telegram message with inline feedback buttons |
| 9 | `get_calendar` | Phase 2 | Read | Today/tomorrow's schedule with event details |
| 10 | `block_time` | Phase 2 | Write | Block focus/recovery time on calendar |
| 11 | `reschedule` | Phase 2 | Write | Move meetings to CRS-optimal windows |
| 12 | `get_emails` | Phase 2 | Read | Surface urgent emails for morning brief |
| 13 | `set_slack_status` | Phase 2 | Write | Auto-DND, custom status based on CRS zone |
| 14 | `prioritize_tasks` | Phase 2 | Read | Rerank task list by cognitive state |
| 15 | `create_task` | Phase 2 | Write | Add task to Linear/Notion/Jira |
| 16 | `search_memory` | Phase 2 | Read | Semantic search over conversation history (pgvector) |
| 17 | `delegate_task` | Phase 3 | Write | Assign task to specialist sub-agent |
| 18 | `execute_code` | Phase 3 | Write | Run sandboxed code capsule (research, analysis) |
| 19 | `create_skill` | Phase 3 | Write | Learn new user-taught multi-step workflow |
| 20+ | `[any MCP tool]` | Phase 3+ | Varies | Notion, GitHub, Figma, Spotify, banking, travel... |

**Tool routing per trigger type:**

| Trigger | Tools Loaded | Why Not All |
|---------|-------------|------------|
| Stress alert | get_crs, get_stress_events, send_message (3) | Minimal context needed, speed matters |
| Morning brief | get_crs, get_sleep, read_memory, send_message (4) | Overnight data + memory for personalization |
| User conversation | All 8 available, 3-4 selected dynamically | Agent picks based on user's question |
| Morning brief + calendar (Phase 2) | get_crs, get_sleep, get_calendar, get_emails, read_memory, send_message (6) | Full day planning |

### 19.4 Integrations Map — All Data Sources and Channels

```
HEALTH DATA IN (what the agent reads about your body)
=====================================================
MVP:
  Apple Watch  --> HealthKit    --> Swift Native Module   --> SQLCipher
    Beat-to-beat IBI (true RMSSD), 4-stage sleep,           Confidence: HIGH
    HR, SpO2, respiratory rate, wrist temp

  Android Watch --> Health Connect --> Kotlin Native Module --> SQLCipher
    Pixel/Fitbit: HR + HRV (RMSSD) + sleep + steps          Confidence: MODERATE
    Samsung: HR + sleep + steps (NO HRV)                     Confidence: LOW

Phase 2:
  Samsung Galaxy Watch --> Samsung Sensor SDK --> Companion Watch App --> SQLCipher
    Raw IBI (1Hz), HR, PPG, skin temp, EDA (GW8+)           Confidence: MODERATE

Phase 3 (Cloud APIs):
  Oura Ring    --> Oura API      --> Supabase Edge Function  (nightly HRV, sleep)
  Fitbit       --> Fitbit Web API --> Supabase Edge Function  (HR, HRV, sleep, SpO2)
  WHOOP        --> WHOOP API     --> Supabase Edge Function  (recovery, strain, RMSSD)
  Garmin       --> Connect IQ SDK --> On-watch app            (raw IBI, HR, SpO2)


MESSAGES OUT (how the agent reaches the user)
=============================================
MVP:     Telegram (grammy on Deno)            -- free forever
Phase 2: WhatsApp Cloud API                    -- free 1K msgs/mo, then ~$0.02/msg
Phase 2: FCM/APNs Push Notifications           -- free
Phase 3: In-app Chat (React Native)            -- no external cost
Phase 3: Voice (Whisper STT + TTS)             -- per-minute cost


WORKSPACE INTEGRATIONS (what the agent knows about your world)
==============================================================
Phase 2:
  Google Calendar / Outlook       -- free API, 1M queries/day
  Gmail / Outlook                 -- free API, generous quota
  Slack / Teams                   -- free bot tokens, rate-limited
Phase 3:
  Linear / Notion / Jira          -- free APIs for personal use
  Zoom / Google Meet              -- meeting join/leave detection


MCP SERVERS (unbounded tool ecosystem, Phase 3+)
================================================
  Each MCP server = a new domain the agent operates in:
  GitHub, Figma, Canva, Spotify, Uber, food delivery,
  banking APIs, smart home, travel booking...
  Any future MCP server unlocks new capabilities without
  changing the agent core architecture.
```

### 19.5 One Agent Invocation — Complete Flow

What happens when pg_cron fires or a user sends a Telegram message. Every step, in order:

```
STEP 1: TRIGGER
  Source: pg_cron (every 15 min) OR Telegram webhook (user message)
  Input: user_id + trigger_type (scheduled_check | stress_alert | morning_brief | user_message)

STEP 2: RULES PRE-FILTER (no LLM, $0)
  Reads: health_snapshots (latest CRS + stress confidence)
  Reads: calibration/STRESS_THRESHOLDS.md
  Decision tree:
    IF trigger = scheduled_check AND CRS > 60 AND stress_confidence < 0.30 --> SKIP ($0)
    IF within 2h cooldown of last proactive message                        --> SKIP
    IF 3 proactive messages already sent today                             --> SKIP
    IF trigger = morning_brief AND user hasn't woken yet                   --> DEFER
    IF trigger = user_message                                              --> ALWAYS PROCEED
  Result: 60-80% of scheduled checks are skipped here. $0 cost.

STEP 3: PROMPT BUILDER (25-field assembly)
  System message (cached, stable prefix -- high cache hit rate):
    [1] rules/SAFETY.md + medical disclaimers            (START -- highest attention)
    [2] souls/SOUL_BASE.md + zones/{CRS_ZONE}.md + modes/{TRIGGER}.md
    [3] skills/{matched}/SKILL.md body (L2 loaded on keyword match)
    [4] Tool definitions (3-4 selected dynamically, not all 8)
    [5] core_memory excerpt + health_baselines           (MIDDLE -- stable, tolerates attention dip)

  User message (dynamic -- separate for cache isolation):
    [6] Trigger context + biometric snapshot + current CRS  (END -- high attention)
    [7] Last interaction + pending followups
    [8] Conversation history (last 3 turns + compressed summary)
    [9] Calendar context (if morning brief or meeting in next 2h)

  Token budget: 2500 max. System: 1200, User: 800, Tools: 500.

STEP 4: PRE-REASONING HOOKS (5 hooks, before Claude call)
  Hook 1 -- EMERGENCY BYPASS
    Scan user message for: "chest pain", "can't breathe", "suicidal", "overdose"
    If found --> skip normal loop, return emergency response, log for review

  Hook 2 -- QUALITY GATES (1, 3, 4)
    Gate 1: >= 1 health metric from last 6h, CRS used >= 2 components
    Gate 3: Not during user's sleep, 2h cooldown, max 3/day, not muted
    Gate 4: Engaged with >= 1 of last 3 messages, no "too frequent" in 7d
    If fail --> queue for later, or send degraded message, or skip

  Hook 3 -- CONTEXT INJECTION
    Inject latest CRS + biometric snapshot if not already in context
    Inject calendar events if morning brief or meeting in next 2h
    Inject pending followups if morning brief

  Hook 4 -- COMPACTION
    If conversation history > 600 token budget --> compress older messages
    Preserve: health facts, user preferences, action items

  Hook 5 -- RATE LIMIT
    Check daily cost budget, daily message count, per-minute rate
    If exceeded --> respond with template message, log

STEP 5: CLAUDE HAIKU AGENT LOOP (max 3 iterations, 50s hard timeout)
  Call: anthropic.messages.create() with tool_use
  Loop:
    Iteration 1: Claude reasons, calls tool (e.g., get_crs)
    Iteration 2: Receives tool result, calls another tool (e.g., get_sleep)
    Iteration 3: Receives result, generates final response with send_message
  Guards:
    Loop guard: SHA256 hash of (tool_name + params + result) -- block at 3 identical calls
    Timeout: 50s hard limit on Edge Function
    Provider failover: Haiku --> template fallback with actual CRS data

STEP 6: POST-REASONING HOOKS (5 hooks, after Claude response)
  Hook 6 -- HEALTH LANGUAGE SAFETY (Gate 2)
    Scan output for banned patterns:
      "You are stressed"       --> must be "Your body is showing stress signals"
      "You need to..."         --> must be "You might want to consider..."
      Diagnosis words (anxiety, depression, insomnia, arrhythmia)
    If found --> regenerate with feedback (max 2 retries) --> template fallback

  Hook 7 -- CONFIDENCE CHECK (Gate 5)
    Stress alerts: confidence >= 0.60
    Morning insights: >= 3 data points behind any claimed pattern
    Memory claims: only reference "high" confidence patterns
    If fail --> omit uncertain claim (better to say less)

  Hook 8 -- LOOP GUARD
    SHA256 hash of (tool_name + params + result)
    Warn at 2 identical calls, block at 3
    Outcome-aware: same call + same result 2x --> permanently blocked for session

  Hook 9 -- MEMORY UPDATE
    If agent called update_memory --> persist to Supabase core_memory
    If substantive conversation --> trigger async session summary generation
    Rule: record first, answer second (from CoPaw proactive recording)

  Hook 10 -- ANALYTICS
    Log to agent_logs (fire-and-forget):
      model, tokens_in, tokens_out, tools_called[], response_time_ms
      trigger_type, CRS_at_time, data_confidence, zone, mode, cost_usd

STEP 7: DELIVERY
  Channel adapter (Telegram for MVP) sends message with inline buttons:
    Morning brief: [Got it] [More details] [Mute today]
    Stress alert:  [Helpful] [Not helpful] [Too frequent]
    Conversation:  context-appropriate buttons

  Writes:
    conversation_history: agent's response
    pending_followups: if suggestion made, schedule outcome check
    Updates last_interaction timestamp

STEP 8: FEEDBACK LOOP (async, when user taps button)
  Telegram webhook receives button tap
  Writes to feedback_events: { message_id, feedback_type, context }
  Over time:
    "Helpful" --> reinforces current thresholds
    "Not helpful" --> increases threshold for that trigger type
    "Too frequent" --> extends cooldown, reduces daily cap
    Feedback tunes the rules pre-filter, NOT the CRS algorithm directly
```

### 19.6 How It Scales Across Phases

The same architecture handles everything. What changes per phase:

| Component | MVP | Phase 2 | Phase 3+ |
|-----------|-----|---------|----------|
| **Soul files** | 1 base + 5 zones + 3 modes | + weekly review mode | + per-domain personas |
| **Skills** | 3 (sleep, stress, morning) | + calendar, tasks, email | + user-created, marketplace |
| **Hands** | 3 (brief, stress, baseline) | + weekly, calendar, focus, email | + sleep coach, activity, social |
| **Tools** | 8 | 16+ | Unlimited (MCP) |
| **Memory** | Tier 1 (core_memory) + Tier 2 (summaries) | + Tier 3 (pgvector, knowledge graph) | + learned skills, decision records |
| **Integrations** | HealthKit + Health Connect + Telegram | + Calendar, Gmail, Slack, WhatsApp | + MCP servers, sub-agents, code capsules |
| **Model** | Haiku only | Haiku + Sonnet + Opus (routed by severity) | + MixtureOfAgents, specialist sub-agents |
| **Intelligence** | Level 1: Reactive | Level 3: Predictive | Level 4: Autonomous |

The engine (prompt builder, hook pipeline, agent loop, feedback system) stays the same. The data it operates on grows. Each new soul file, skill, hand, tool, or adapter plugs into the existing architecture without changing it.

---

**None of these patterns change the locked MVP architecture decisions.** They all work within: Messages API + tool_use, Claude Haiku 4.5, 8 tools, 3-step onboarding, rules-based pre-filter, on-phone CRS, Telegram delivery, op-sqlite + SQLCipher, Supabase + RLS. Everything in Phase 2 and 3+ builds ON TOP of the MVP foundation — same architecture, expanded capabilities.

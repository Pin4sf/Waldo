# OneSync -- Agent OS Deep Dive & Architecture Report

Last updated: March 7, 2026

This document synthesizes deep codebase analysis of 6 open-source agent projects and advanced context engineering research, mapping their patterns to OneSync's health AI co-pilot vision.

---

## REPOSITORIES ANALYZED

| Project | Language | Stars | What It Is | Key Insight for OneSync |
|---------|----------|-------|-----------|------------------------|
| **Pi Mono** (badlogic) | TypeScript | -- | Modular coding agent toolkit (Claude Code competitor) | Layered architecture, auto-compaction, extension system, steering queues |
| **OpenClaw** (openclaw) | TypeScript | -- | Multi-channel AI assistant gateway (22+ channels) | Context engine, plugin SDK, multi-channel routing, session compaction |
| **PicoClaw** (sipeed) | Go | 12K+ | Ultra-lightweight agent (<10MB RAM) | File-based MEMORY.md, provider failover chains, system prompt caching |
| **OpenFang** (RightNow-AI) | Rust | -- | Agent Operating System (137K LOC, 14 crates) | Autonomous "Hands", triple-layer memory, 16 security systems, prompt builder |
| **CoPaw** (agentscope-ai) | Python | -- | Personal agent workstation by Alibaba | Two-tier memory, pre-reasoning hooks, skills system, proactive recording |
| **Context Engineering** (HumanLayer) | Markdown | -- | Y Combinator talk on context engineering | FIC framework, 40-60% utilization rule, compaction patterns, human leverage pyramid |

---

## EXECUTIVE SUMMARY: What OneSync Should Adopt

### The 10 Critical Patterns

| # | Pattern | Source | OneSync Application |
|---|---------|--------|---------------------|
| 1 | **Layered Agent Architecture** | Pi Mono | Separate LLM layer, agent-core, and health-app into independent modules |
| 2 | **Context Assembly Pipeline** | All repos + HumanLayer | Build a deterministic pipeline that assembles the perfect context window per invocation |
| 3 | **Structured Compaction** | Pi Mono, OpenClaw, CoPaw | Summarize old conversations into structured health summaries, never lose critical data |
| 4 | **File-Based Evolving Memory** | PicoClaw, CoPaw | MEMORY.md + SOUL.md + PROFILE.md pattern for persistent user knowledge |
| 5 | **Pre-Reasoning Hooks** | CoPaw | Safety hook, context injection hook, compaction hook before each agent reasoning step |
| 6 | **Autonomous Hands/Cron Tasks** | OpenFang, CoPaw | Scheduled health agents that run without user prompting (morning brief, trend analysis) |
| 7 | **Skills System** | All repos | Domain-specific SKILL.md files for health protocols (nutrition, sleep, stress, exercise) |
| 8 | **Triple-Layer Memory** | OpenFang | Structured (health metrics KV) + Semantic (conversation search) + Knowledge Graph (health relationships) |
| 9 | **Dynamic Tool Loading** | HumanLayer, OpenFang | Only load relevant tool schemas per message intent, not all 18 |
| 10 | **Provider Failover Chain** | PicoClaw, OpenFang | Automatic LLM fallback (Sonnet -> Haiku -> cached response) for reliability |

---

## PART 1: AGENT ARCHITECTURE -- WHAT TO BUILD

### 1.1 Layered Module Design (from Pi Mono)

Pi Mono's clean separation: `ai` -> `agent-core` -> `coding-agent`. Each layer depends only on the one below.

**OneSync equivalent:**

```
Layer 1: onesync-llm (LLM abstraction)
  - Claude Messages API wrapper
  - Model routing (Haiku/Sonnet/Opus)
  - Prompt caching management
  - Streaming support
  - Provider failover (primary -> fallback -> cached response)
  - Token counting and cost tracking

Layer 2: onesync-agent-core (Agent runtime)
  - Agent loop (ReAct with tool_use)
  - Hook system (pre-reasoning, post-reasoning)
  - Context assembly pipeline
  - Memory manager interface
  - Tool registry and execution
  - Event system for observability

Layer 3: onesync-health-agent (Health application)
  - 18 health-specific tools
  - Health-specific skills (SKILL.md files)
  - CRS computation integration
  - Stress detection integration
  - Channel adapters (Telegram, WhatsApp)
  - Proactive task scheduler
```

**Why this matters:** If you later want to swap Claude for Gemini, or add a new channel, or change the agent loop strategy, you change ONE layer without touching the others. This is how Pi Mono, OpenClaw, and OpenFang all structure their code.

### 1.2 The Agent Loop (Synthesized from All Repos)

Every repo implements a variant of the same pattern. Here's the optimal design for OneSync's Edge Function constraints:

```
OneSync Agent Loop (per Edge Function invocation):

1. ASSEMBLE CONTEXT
   - Load system prompt (personality + safety rules)
   - Load user profile + core memory (PROFILE.md equivalent)
   - Load health baselines + current biometrics
   - Load relevant tool schemas (dynamic, not all 18)
   - Load recent conversation (last 5 messages + compressed summary)
   - Load trigger context (why was this invocation triggered?)
   - Run pre-reasoning hooks (safety check, context injection)

2. REASON + ACT (max 5 iterations, 140s timeout)
   - Send context to Claude
   - If Claude returns tool_use:
     - Validate tool arguments (schema validation)
     - Execute tools in parallel if independent
     - Compress large tool results before feeding back
     - Check timeout budget before next iteration
   - If Claude returns text response:
     - Run output validation (banned medical phrases)
     - Break loop

3. POST-PROCESS
   - Log interaction (model, tools, tokens, response)
   - Update conversation history
   - Trigger memory update if needed (async)
   - Deliver message via channel adapter
   - Update last_interaction timestamp
```

**Key differences from a generic agent loop:**
- **Stateless per invocation** (Edge Function constraint) -- context assembled fresh each time
- **Timeout-aware** -- checks remaining time before each Claude call
- **Health-safe** -- output validation as mandatory post-processing step
- **Cost-tracked** -- every call logged with token usage for cost monitoring

### 1.3 Steering and Follow-Up Queues (from Pi Mono)

Pi Mono's dual-queue pattern is elegant:
- **Steering messages**: Interrupt the current agent run (e.g., user sends "STOP" or "actually, I meant...")
- **Follow-up messages**: Queued for after the current run completes (e.g., "also check my sleep")

**OneSync adaptation:** In a messaging context (Telegram/WhatsApp), this maps to:
- If user sends a new message while the agent is processing: queue it as follow-up
- If the new message contains urgency signals ("help", "emergency", "chest pain"): treat as steering, interrupt current processing, escalate immediately
- Edge Function implementation: store queued messages in Supabase, check queue at start of each invocation

---

## PART 2: CONTEXT ENGINEERING -- THE CORE CHALLENGE

### 2.1 The Context Assembly Pipeline

This is the single most important engineering challenge for OneSync. Every repo confirms: **context quality determines output quality**.

**The HumanLayer framework** (from Y Combinator talk):
- Context is the ONLY lever for LLM output quality
- Optimize for: Correctness > Completeness > Minimize Noise > Trajectory
- Keep utilization at 40-60% -- above that, quality degrades

**OneSync's Context Assembly Pipeline:**

```
Step 1: STATIC CONTEXT (cached, ~2000 tokens)
  [CACHED BLOCK 1]
  - Agent personality and safety rules
  - Tool definitions (ONLY relevant ones -- see dynamic loading)
  - Health domain guidelines
  - Output format instructions

Step 2: USER CONTEXT (cached per user, ~1000 tokens)
  [CACHED BLOCK 2]
  - User profile (PROFILE.md equivalent)
  - Core memory (key health facts, preferences, goals)
  - Active health baselines (7d/30d averages)
  - Current medications and conditions
  - Communication preferences

Step 3: DYNAMIC CONTEXT (fresh per invocation, ~1500-2500 tokens)
  [NOT CACHED]
  - Current timestamp and timezone
  - Latest biometric snapshot (HR, HRV, CRS, stress confidence)
  - Trigger context: WHY this invocation happened
    - "User sent message: 'how am I doing?'"
    - "Stress detected: confidence 0.72, HRV dropped 25% from adjusted baseline"
    - "Scheduled morning briefing"
    - "Sleep data just synced: 5.2h total, 45min deep"
  - Today's calendar events (if relevant)
  - Recent conversation (last 5 messages + compressed summary)
  - Pending action items

TOTAL: ~4500-5500 tokens input (well within 40-60% utilization for Sonnet)
```

### 2.2 Dynamic Tool Loading (from HumanLayer + OpenFang)

Loading all 18 tool schemas into every context wastes ~1500 tokens. Instead:

```
Intent Classification -> Tool Subset Selection

"How did I sleep?"        -> [get_sleep_summary, get_health_history, get_current_biometrics]
"I'm stressed"            -> [get_current_biometrics, get_stress_events, suggest_breathing_exercise]
"What's my day look like?" -> [get_upcoming_events, get_sleep_summary, get_current_biometrics]
"Remember that I..."       -> [update_core_memory, read_core_memory]
User sends casual message  -> [read_core_memory, get_current_biometrics, send_message]
Proactive stress alert     -> [get_current_biometrics, get_stress_events, get_upcoming_events, suggest_breathing_exercise, suggest_break]
Morning briefing           -> [get_sleep_summary, get_upcoming_events, get_recent_emails, get_current_biometrics]
```

**Implementation:** Simple keyword/intent classification (no LLM needed):
- Always include: get_current_biometrics, read_core_memory, send_message
- Add health tools if message mentions: sleep, stress, heart, exercise, steps, HRV
- Add calendar/email tools if message mentions: schedule, meeting, day, morning, calendar, email
- Add memory tools if message mentions: remember, forget, preference, goal
- Add intervention tools if stress is detected or user asks for help

This keeps tool schemas to 5-8 per call (~500-700 tokens instead of ~1500).

### 2.3 Structured Compaction (from Pi Mono + CoPaw + HumanLayer)

All repos agree: raw conversation history is toxic to context quality. Compress it.

**OneSync's Two-Tier Compaction:**

**Tier 1 -- Session Compaction (within a conversation session):**
When conversation exceeds 10 messages, compress older messages into a structured summary:

```
## Conversation Summary (March 7, 10:00-10:45 AM)
- User asked about sleep quality -> reported 5.2h, poor deep sleep
- Agent suggested earlier bedtime -> user committed to 11 PM target
- User mentioned headache -> agent noted, advised monitoring
- Mood: slightly frustrated about sleep patterns
- Action items: 11 PM bedtime tonight, log headache if persists
```

Store this summary. On next invocation, load summary + last 5 raw messages.

**Tier 2 -- Long-Term Memory Compaction (across sessions):**
Weekly (via pg_cron), run an Opus call that reviews the week's session summaries and updates core memory:

```
## Weekly Health Insights (Week of March 3-7)
- Sleep averaging 5.8h (target: 7h), deep sleep consistently low
- HRV baseline trending down 8% over the week
- Stress events correlate with afternoon meetings (Mon, Wed)
- User responds well to breathing exercises, less to break suggestions
- New pattern: headaches on low-sleep days
-> Updated core memory: added headache-sleep correlation
-> Updated preferences: breathing > breaks for stress intervention
```

### 2.4 The "Proactive Recording" Pattern (from CoPaw)

CoPaw's AGENTS.md instructs: **"Record first, answer second."** When the user mentions something important, save it to memory BEFORE responding.

**OneSync application:** When a user says "I started taking magnesium supplements" or "I've been waking up at 3am lately":
1. Immediately call `update_core_memory` to record this
2. THEN reason about it and respond
3. This ensures critical health context is never lost even if the conversation gets compacted

Implement via pre-reasoning hook or explicit instruction in system prompt.

---

## PART 3: MEMORY ARCHITECTURE

### 3.1 Triple-Layer Memory (from OpenFang, adapted for health)

OpenFang's memory substrate is the most sophisticated: structured + semantic + knowledge graph. Adapted for OneSync:

**Layer 1 -- Structured Memory (Key-Value in Postgres)**
Fast, deterministic lookups. Always loaded into context.

```
core_memory: {
  identity: { name, age, timezone, chronotype },
  health_profile: { conditions, medications, allergies, resting_hr, typical_sleep },
  preferences: { communication_style, intervention_preferences, notification_times },
  active_goals: ["improve sleep to 7h", "reduce afternoon stress"],
  recent_insights: ["HRV drops on meeting-heavy days", "magnesium helps sleep quality"]
}
```

**Layer 2 -- Semantic Memory (Conversation History with Embeddings)**
Searchable via similarity. Used when agent needs to recall past discussions.

```
conversation_summaries: [
  { date, summary_text, embedding_vector, topics: ["sleep", "stress"] },
  ...
]

Search: "What did we discuss about headaches?"
-> Vector similarity finds relevant past sessions
-> Returns compressed summaries, not raw messages
```

**For MVP:** Skip embeddings. Use simple full-text search on conversation summaries stored in Postgres. Add pgvector embeddings in Phase 2 when conversation volume justifies it.

**Layer 3 -- Health Knowledge Graph (Phase 2)**
Entities and relationships. For pattern discovery.

```
Entities: [magnesium, sleep_quality, headache, afternoon_meetings, stress]
Relations: [
  magnesium --improves--> sleep_quality,
  low_sleep --correlates--> headache,
  afternoon_meetings --triggers--> stress,
  stress --reduces--> HRV
]
```

**For MVP:** Skip knowledge graph entirely. Core memory + conversation summaries are sufficient. Add when you have 3+ months of user data and want to surface complex health patterns.

### 3.2 File-Based Memory Pattern (from PicoClaw + CoPaw)

Both PicoClaw and CoPaw use a simple, powerful pattern:
- `MEMORY.md` -- Long-term curated facts (always loaded)
- `memory/YYYY-MM-DD.md` -- Daily logs (loaded on demand)

**OneSync adaptation for Supabase:**
- `core_memory` table (key-value, always loaded) = MEMORY.md equivalent
- `conversation_summaries` table (date-indexed) = daily logs equivalent
- `health_snapshots` table (time-series) = raw health data

The file-based approach works for PicoClaw because it runs locally. For OneSync (serverless), the Postgres equivalent gives the same pattern with better concurrent access.

### 3.3 Self-Modifying Memory (from CoPaw)

CoPaw's agent uses file tools to read/write its own MEMORY.md and PROFILE.md. The agent evolves its own context over time.

**OneSync equivalent:** The agent has `read_core_memory` and `update_core_memory` tools. But add a key enhancement from CoPaw:

**Proactive memory evolution:** In the system prompt, instruct the agent:
```
After every meaningful interaction, consider if any core memory should be updated:
- New health pattern observed? Add to recent_insights
- User expressed a preference? Update preferences
- Health baseline shifting? Note the trend
- User started/stopped a medication? Update health_profile immediately
```

This makes the agent a learning system, not just a Q&A bot.

---

## PART 4: HOOK SYSTEM (from CoPaw + Pi Mono)

### 4.1 Pre-Reasoning Hooks

CoPaw's hook system runs checks BEFORE each reasoning step. Pi Mono's extensions fire on every tool call. Combine both:

**OneSync Hook Pipeline:**

```
1. SAFETY HOOK (before reasoning)
   - Scan user message for emergency keywords ("chest pain", "can't breathe", "suicidal")
   - If detected: bypass normal agent loop, return emergency response immediately
   - Log emergency event for review

2. CONTEXT INJECTION HOOK (before reasoning)
   - Inject latest biometric snapshot if not already in context
   - Inject today's calendar if relevant (morning, or meeting in next 2 hours)
   - Inject any pending medication reminders

3. COMPACTION HOOK (before reasoning)
   - Check if conversation history exceeds token budget
   - If so: compress older messages into summary
   - Ensure critical health facts survive compaction

4. RATE LIMIT HOOK (before reasoning)
   - Check if user has exceeded message rate limit
   - Check if daily AI cost budget exceeded
   - If so: respond with cached/templated message instead of Claude call
```

### 4.2 Post-Reasoning Hooks

```
5. OUTPUT VALIDATION HOOK (after reasoning, before delivery)
   - Scan for banned medical phrases
   - Ensure disclaimer present for health-related advice
   - Check response tone (not dismissive of symptoms)

6. MEMORY UPDATE HOOK (after reasoning)
   - If agent called update_core_memory, persist changes
   - If conversation is substantive, trigger async summary generation
   - Update last_interaction timestamp

7. ANALYTICS HOOK (after reasoning)
   - Log: model used, tokens consumed, tools called, response time
   - Track: intervention effectiveness (was breathing exercise accepted?)
   - Feed into cost monitoring dashboard
```

---

## PART 5: SKILLS SYSTEM (from All Repos)

Every analyzed project has a skills system. The pattern is universal: **SKILL.md files with YAML frontmatter**.

### 5.1 OneSync Health Skills

```
skills/
  builtin/
    sleep-analysis/
      SKILL.md          # Sleep assessment protocol
      references/       # Sleep hygiene guidelines, chronotype info
    stress-management/
      SKILL.md          # Stress intervention decision tree
      references/       # Breathing techniques, break activities
    nutrition-basics/
      SKILL.md          # Meal logging, basic nutrition guidance
    exercise-recovery/
      SKILL.md          # Activity balance, recovery recommendations
    morning-briefing/
      SKILL.md          # Morning report generation protocol
    medication-tracking/
      SKILL.md          # Medication reminders, interaction awareness
```

**SKILL.md format (example):**
```yaml
---
name: sleep-analysis
description: Analyze sleep data and provide actionable sleep improvement guidance
tools: [get_sleep_summary, get_health_history, get_current_biometrics, update_core_memory]
triggers: [sleep, insomnia, tired, exhausted, waking up, bedtime, nap]
---

# Sleep Analysis Protocol

## When to Use
- User asks about sleep quality
- Morning briefing includes sleep data
- Sleep score drops below 60

## Assessment Steps
1. Get last night's sleep summary (duration, stages, efficiency)
2. Compare to 7-day and 30-day baselines
3. Check for patterns (consistent wake times, sleep debt accumulation)
4. Consider context: stress events, exercise, caffeine, screen time

## Response Guidelines
- Lead with the most actionable insight
- Compare to THEIR baseline, not population norms
- Suggest ONE specific change, not a list of 10
- If sleep debt > 5h over the week, flag it prominently
- Never say "you should sleep more" -- suggest specific strategies
```

### 5.2 Skill Loading Strategy

Don't load all skills into every context. Match skills to intent:

```
User message analysis -> Trigger matching -> Load 1-2 relevant skills

"I only slept 4 hours"     -> triggers: [sleep]     -> load: sleep-analysis
"I'm so stressed at work"  -> triggers: [stress]    -> load: stress-management
"What should I eat?"        -> triggers: [nutrition] -> load: nutrition-basics
Morning briefing            -> always load: morning-briefing + sleep-analysis
```

Skills add ~200-500 tokens each to the context. Loading 1-2 targeted skills is far better than loading 6 generic ones.

---

## PART 6: AUTONOMOUS OPERATIONS (from OpenFang + CoPaw)

### 6.1 The "Hands" Pattern (from OpenFang)

OpenFang's most distinctive pattern: **Hands are pre-built autonomous agent packages** that run on schedules without user prompting. Each Hand has:
- A manifest (tools needed, settings, dashboard metrics)
- A skill file (domain expertise, multi-phase operational playbook)
- A cron schedule

**OneSync Autonomous Hands:**

```
Hand 1: Morning Briefing Hand
  Schedule: Daily at user's wake time (estimated from sleep data)
  Tools: get_sleep_summary, get_upcoming_events, get_recent_emails, get_current_biometrics
  Playbook:
    Phase 1: Gather overnight data (sleep, resting HR, HRV)
    Phase 2: Check today's calendar
    Phase 3: Scan important emails
    Phase 4: Compose personalized morning message
  Output: Single message via Telegram/WhatsApp

Hand 2: Stress Monitor Hand
  Schedule: Every 15 min (triggered by background sync data arrival)
  Tools: get_current_biometrics, get_stress_events, get_upcoming_events
  Playbook:
    Phase 1: Evaluate stress confidence score
    Phase 2: If confidence > 0.60: check calendar context
    Phase 3: Select appropriate intervention
    Phase 4: Compose empathetic, actionable message
  Gate: Only fires if confidence > 0.60 AND cooldown expired (no alert in last 2h)

Hand 3: Weekly Review Hand
  Schedule: Sunday evening
  Tools: get_health_history, read_core_memory, update_core_memory
  Playbook:
    Phase 1: Aggregate week's health data
    Phase 2: Identify trends and patterns
    Phase 3: Compare to goals
    Phase 4: Update core memory with new insights
    Phase 5: Compose weekly summary message
  Model: Opus (complex analysis justifies the cost)

Hand 4: Baseline Updater Hand
  Schedule: Daily at 4 AM
  Tools: get_health_history (internal, no user-facing message)
  Playbook:
    Phase 1: Compute rolling 7d and 30d baselines
    Phase 2: Detect significant baseline shifts
    Phase 3: Update health_baselines table
    Phase 4: If major shift detected, flag for next morning briefing
  Model: No LLM needed -- pure computation in Edge Function
```

### 6.2 Proactive vs Reactive Balance

From CoPaw's "heartbeat" pattern and OpenFang's Hands, the key insight: **the agent should come to the user, not wait to be asked.** But over-messaging kills engagement.

**OneSync proactive messaging rules:**
```
ALWAYS send:
  - Morning briefing (1x daily)
  - Medication reminders (if configured)

CONDITIONALLY send:
  - Stress intervention (max 2x per day, confidence > 0.60, 2h cooldown)
  - Sleep alert (if sleep < 5h, 1x after wake detected)
  - Activity nudge (if sedentary > 4h during daytime, max 1x per day)

NEVER proactively send:
  - Generic "check-in" messages (annoying)
  - Congratulations on normal metrics (patronizing)
  - Multiple alerts for the same event
```

---

## PART 7: SECURITY PATTERNS (from OpenFang)

OpenFang has 16 discrete security systems. For a health AI, these are relevant:

### 7.1 Must-Have for MVP

| Security Pattern | OneSync Implementation |
|-----------------|----------------------|
| **Output validation** | Scan for banned medical phrases before delivery |
| **Input sanitization** | Prevent prompt injection via user messages |
| **RLS (Row-Level Security)** | Supabase RLS ensures users only access own data |
| **Encryption at rest** | SQLCipher on device, Supabase default encryption |
| **Audit logging** | Log every agent interaction with model, tools, tokens |
| **Rate limiting** | Per-user message and cost limits |
| **Disclaimer injection** | Auto-append health disclaimer to relevant responses |

### 7.2 Add in Phase 2

| Security Pattern | OneSync Implementation |
|-----------------|----------------------|
| **Taint tracking** | Track which data came from user input vs. verified sources |
| **Approval gates** | Require explicit confirmation before sharing health data externally |
| **Session repair** | Recover gracefully from corrupted conversation state |
| **Loop guard** | Detect and break agent tool-call loops (SHA256-based, from OpenFang) |

---

## PART 8: PROVIDER FAILOVER (from PicoClaw + OpenFang)

Both PicoClaw and OpenFang implement LLM provider failover chains. Critical for a health app where reliability matters.

**OneSync Failover Strategy:**

```
Primary chain (for user conversations):
  1. Claude Sonnet (primary)
  2. Claude Haiku (fallback -- faster, cheaper, slightly less capable)
  3. Cached/templated response (last resort)

Routine checks chain:
  1. Rules-based evaluation (no LLM, $0)
  2. Claude Haiku (if rules are inconclusive)

Morning briefing chain:
  1. Claude Sonnet (primary)
  2. Claude Haiku (fallback)
  3. Template-based briefing from data (no AI personality, but still useful)

Error classification (from PicoClaw):
  - 429 (rate limit): wait and retry with exponential backoff
  - 529 (overloaded): switch to fallback model
  - 500+ (server error): retry once, then fallback
  - 401 (auth): alert developer, use fallback
  - Timeout: retry once with shorter max_tokens, then fallback
```

---

## PART 9: REVISED AGENT ARCHITECTURE FOR ONESYNC

Combining all learnings, here's the finalized Agent OS design:

```
ONESYNC AGENT OS ARCHITECTURE

+------------------------------------------------------------------+
|  CONTEXT ASSEMBLY PIPELINE                                         |
|                                                                    |
|  Static Context (cached) ----+                                     |
|  User Context (cached) ------+--> Context Window (~5000 tokens)    |
|  Dynamic Context (fresh) ----+    [40-60% utilization target]      |
|  Dynamic Tools (intent-based) +                                    |
|  Matched Skills (1-2 max) ---+                                     |
+------------------------------------------------------------------+
                    |
                    v
+------------------------------------------------------------------+
|  HOOK PIPELINE                                                     |
|                                                                    |
|  Pre-Reasoning: Safety -> Context Injection -> Compaction -> Rate  |
|  Post-Reasoning: Output Validation -> Memory Update -> Analytics   |
+------------------------------------------------------------------+
                    |
                    v
+------------------------------------------------------------------+
|  AGENT LOOP (ReAct, max 5 iterations, 140s timeout)               |
|                                                                    |
|  Claude API (Messages + tool_use)                                  |
|  Model Router: Skip / Haiku / Sonnet / Opus                       |
|  Provider Failover: Primary -> Fallback -> Cached                  |
|  Parallel tool execution for independent calls                     |
|  Tool result compression for large responses                       |
+------------------------------------------------------------------+
                    |
                    v
+------------------------------------------------------------------+
|  MEMORY SYSTEM (Two-Tier for MVP)                                  |
|                                                                    |
|  Tier 1: Core Memory (always loaded, structured KV in Postgres)    |
|    - User profile, health facts, preferences, goals, insights      |
|    - Self-modifying via update_core_memory tool                     |
|                                                                    |
|  Tier 2: Conversation Summaries (date-indexed in Postgres)         |
|    - Session compaction: raw messages -> structured summary         |
|    - Weekly compaction: session summaries -> core memory updates    |
|    - Full-text search for recall (pgvector embeddings in Phase 2)  |
+------------------------------------------------------------------+
                    |
                    v
+------------------------------------------------------------------+
|  AUTONOMOUS OPERATIONS (Hands Pattern)                             |
|                                                                    |
|  Morning Briefing Hand (daily, at wake time)                       |
|  Stress Monitor Hand (every 15 min, gated)                         |
|  Weekly Review Hand (Sunday evening, Opus)                         |
|  Baseline Updater Hand (daily 4 AM, no LLM)                       |
+------------------------------------------------------------------+
                    |
                    v
+------------------------------------------------------------------+
|  CHANNEL ADAPTERS (Unified Message Interface)                      |
|                                                                    |
|  MVP:                                                              |
|    Telegram (grammy) <--> Channel Router                           |
|    WhatsApp (Cloud API) <--> Channel Router                        |
|                                                                    |
|  Phase 2 (Priority):                                               |
|    Push Notifications (FCM) <--> Channel Router                    |
|    In-App Chat (Supabase Realtime) <--> Channel Router             |
|    Voice Interface (Whisper STT + TTS) <--> Channel Router         |
|                                                                    |
|  Phase 3:                                                          |
|    Email Digest (SendGrid/Resend) <--> Channel Router              |
|    Watch Notifications (Wear OS) <--> Channel Router               |
|    Smart Display / Widget <--> Channel Router                      |
+------------------------------------------------------------------+
```

---

## PART 10: WHAT THIS CHANGES FROM THE MARCH 6 PLAN

| Area | March 6 Plan | Revised (Post Agent OS Research) |
|------|-------------|----------------------------------|
| Agent loop | Simple while loop with tool_use | **Layered architecture with hook pipeline, failover, dynamic tool loading** |
| Context management | Stuff last 10 messages + system prompt | **Context assembly pipeline with 40-60% utilization target, dynamic tool/skill loading** |
| Memory | Core memory (50 KV pairs) + last 10 messages | **Two-tier: structured core memory + conversation summaries with compaction** |
| Proactive operations | check-triggers Edge Function | **Autonomous Hands pattern with multi-phase playbooks** |
| Skills | Not planned | **ADD: SKILL.md files for health domains (sleep, stress, nutrition, exercise)** |
| Safety | System prompt instructions | **ADD: Hook-based safety pipeline (pre + post reasoning)** |
| Tool loading | All 18 tools always loaded | **Dynamic tool loading by intent classification (5-8 tools per call)** |
| Provider reliability | Single provider (Claude) | **ADD: Failover chain with error classification** |
| Conversation history | Raw last 10 messages | **Structured compaction: summaries + recent raw messages** |
| Learning | Agent updates core memory | **Self-modifying memory + weekly reflection + proactive recording** |
| Cost optimization | Prompt caching + model routing | **ADD: Rules-based pre-filter + dynamic tool loading + intent-based model selection** |

---

## PART 11: MVP SCOPE vs FULL VISION

### What to Build for MVP (12 weeks)

| Component | MVP Implementation |
|-----------|-------------------|
| Context assembly | Static + user + dynamic context blocks with prompt caching |
| Hook pipeline | Safety hook (emergency keywords) + output validation hook |
| Agent loop | ReAct with tool_use, max 5 iterations, timeout management |
| Memory | Core memory (structured KV) + last 5 raw messages + session summaries |
| Dynamic tools | Simple keyword-based intent -> tool subset mapping |
| Skills | 3 built-in: sleep-analysis, stress-management, morning-briefing |
| Autonomous ops | Morning briefing (pg_cron) + stress monitor (data-triggered) |
| Failover | Sonnet -> Haiku -> template fallback |
| Security | Output validation, RLS, audit logging, rate limiting |
| Compaction | Session summary after 10 messages (Haiku-generated) |

### What to Add in Phase 2

| Component | Phase 2 Enhancement |
|-----------|-------------------|
| Memory | pgvector embeddings for semantic search over conversation history |
| Knowledge graph | Health entity-relationship tracking |
| Skills | Skills marketplace / user-installable health skills |
| Hooks | Full hook pipeline with context injection, compaction, analytics |
| Autonomous ops | Weekly review hand (Opus), baseline anomaly detection |
| Dynamic tools | LLM-based intent classification (more accurate than keywords) |
| Channels | Push notifications, in-app chat |
| Security | Taint tracking, approval gates, loop guard |

---

## PART 12: KEY DEPENDENCIES TO ADD

Based on what these repos use that OneSync should adopt:

| Dependency | Purpose | Used By |
|-----------|---------|---------|
| `@sinclair/typebox` | JSON Schema type builder for tool parameter validation | Pi Mono, OpenClaw |
| `ajv` | JSON Schema validation (validate tool inputs at runtime) | Pi Mono, OpenClaw |
| `croner` | Lightweight cron scheduler (alternative to pg_cron for Edge Functions) | OpenClaw |
| `partial-json` | Parse streaming incomplete JSON from Claude tool calls | Pi Mono |
| `zod` | Schema validation for config and user input | OpenClaw |

**Note:** Most repos build their own agent loop rather than using LangChain/LangGraph. OneSync should do the same -- direct Claude API with a custom loop gives full control and transparency.

---

## REFERENCES

| Source | Key Contribution |
|--------|-----------------|
| Pi Mono (`badlogic/pi-mono`) | Layered architecture, auto-compaction algorithm, extension/hook system, steering queues |
| OpenClaw (`openclaw/openclaw`) | Context engine, multi-channel routing, plugin SDK, session management |
| PicoClaw (`sipeed/picoclaw`) | File-based memory (MEMORY.md), provider failover chains, system prompt caching, lightweight design |
| OpenFang (`RightNow-AI/openfang`) | Autonomous Hands, triple-layer memory, 16 security systems, prompt builder with 25+ fields, loop guard |
| CoPaw (`agentscope-ai/CoPaw`) | Two-tier memory, pre-reasoning hooks, skills system, proactive recording, bootstrap onboarding |
| Context Engineering (`humanlayer`) | FIC framework, 40-60% utilization rule, compaction as first-class pattern, human leverage pyramid |

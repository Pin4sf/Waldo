# OneSync -- Agent OS & Backend Architecture

Last updated: March 15, 2026

> Claude agent architecture, Agent OS design, messaging channels, Supabase backend.
> Synthesizes research from 8 open-source agent projects + context engineering best practices.

---

## Repositories Analyzed

| Project | Language | What It Is | Key Insight for OneSync |
|---------|----------|-----------|------------------------|
| **Pi Mono** (badlogic) | TypeScript | Modular coding agent toolkit | Layered architecture, auto-compaction, steering queues |
| **OpenClaw** (openclaw) | TypeScript | Multi-channel AI assistant gateway (22+ channels) | Context engine, plugin SDK, session compaction |
| **PicoClaw** (sipeed) | Go | Ultra-lightweight agent (<10MB RAM) | File-based MEMORY.md, provider failover chains |
| **OpenFang** (RightNow-AI) | Rust | Agent Operating System (137K LOC, 14 crates) | Autonomous "Hands", triple-layer memory, 16 security systems |
| **CoPaw** (agentscope-ai) | Python | Personal agent workstation by Alibaba | Two-tier memory, pre-reasoning hooks, skills system |
| **Paperclip** (paperclipai) | TypeScript | Orchestration platform for AI-agent-run companies | Heartbeat-based execution, PARA memory, adapter pattern, goal ancestry, session persistence across heartbeats |
| **Agent Skills for CE** (muratcankoylan) | Markdown | Curated skill library for context engineering in AI agents | Four-bucket context management, progressive disclosure, tool consolidation, context degradation taxonomy, BDI mental states |
| **Context Engineering** (HumanLayer) | Markdown | Y Combinator talk on context engineering | FIC framework, 40-60% utilization rule, compaction patterns |
| **OpenViking** (volcengine) | Python/Rust | Context Database for AI agents — filesystem-paradigm memory | L0/L1/L2 tiered context loading; 83% token reduction + 49% task completion improvement |
| **Swarms** (kyegomez) | Python | Enterprise multi-agent orchestration framework | MixtureOfAgents pattern; SwarmRouter; HierarchicalSwarm for Hands architecture |
| **Agency-Agents** (msitarzewski) | Markdown | 44k-star curated library of specialized AI agent personas | Specialized soul files per interaction mode; "when to use" conditions; persona-driven design |

---

## Design Decision: Raw Messages API, Not Agent SDK

OneSync's agent is a **serverless health co-pilot**, not a general-purpose assistant. It wakes on triggers, processes, responds, and sleeps. The Messages API with `tool_use` fits this pattern perfectly.

| Factor | Messages API | Agent SDK |
|--------|-------------|-----------|
| Runtime | Edge Functions (Deno) | Long-running process |
| Control | Full control over tool loop | SDK manages loop |
| Cost | Pay per call, no idle | Persistent process |
| Serverless fit | Perfect | Poor |

---

## Agent OS Architecture

### Layered Module Design (from Pi Mono)

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

If you later want to swap Claude for Gemini, add a new channel, or change the agent loop strategy, you change ONE layer without touching the others.

### Full Architecture Diagram

```
ONESYNC AGENT OS

+------------------------------------------------------------------+
|  CONTEXT ASSEMBLY PIPELINE                                        |
|  Static Context (cached) ----+                                    |
|  User Context (cached) ------+--> Context Window (~5000 tokens)   |
|  Dynamic Context (fresh) ----+    [40-60% utilization target]     |
|  Dynamic Tools (intent-based) +                                   |
|  Matched Skills (1-2 max) ---+                                    |
+------------------------------------------------------------------+
                    |
+------------------------------------------------------------------+
|  HOOK PIPELINE                                                    |
|  Pre: Safety -> Context Injection -> Compaction -> Rate Limit     |
|  Post: Output Validation -> Memory Update -> Analytics            |
+------------------------------------------------------------------+
                    |
+------------------------------------------------------------------+
|  AGENT LOOP (ReAct, max 5 iterations, 140s timeout)              |
|  Model Router: Skip / Haiku / Sonnet / Opus                      |
|  Provider Failover: Primary -> Fallback -> Cached                 |
|  Parallel tool execution for independent calls                    |
+------------------------------------------------------------------+
                    |
+------------------------------------------------------------------+
|  MEMORY SYSTEM (Two-Tier for MVP)                                |
|  Tier 1: Core Memory (structured KV, self-modifying)             |
|  Tier 2: Conversation Summaries (date-indexed, compactable)      |
+------------------------------------------------------------------+
                    |
+------------------------------------------------------------------+
|  AUTONOMOUS OPERATIONS (Hands Pattern)                            |
|  Morning Briefing | Stress Monitor | Weekly Review | Baselines   |
+------------------------------------------------------------------+
                    |
+------------------------------------------------------------------+
|  CHANNEL ADAPTERS                                                 |
|  Telegram (grammy) | WhatsApp (Cloud API) | Push (Phase 2)       |
|  In-App Chat (Phase 2) | Voice (Phase 2) | Email (Phase 3)       |
+------------------------------------------------------------------+
```

---

## Agent Loop

```typescript
async function agentLoop(userId: string, triggerType: string, triggerData: any): Promise<string> {
  const model = selectModel(triggerType, triggerData.severity);
  const systemPrompt = await buildSystemPrompt(userId);
  const messages = await buildMessages(userId, triggerType, triggerData);
  const tools = getToolsForIntent(triggerType, triggerData); // Dynamic loading

  let response;
  let iterations = 0;
  const MAX_ITERATIONS = 5;
  const startTime = Date.now();

  while (iterations < MAX_ITERATIONS) {
    // Timeout check
    if (Date.now() - startTime > 140_000) break;

    response = await anthropic.messages.create({
      model, max_tokens: 1024, system: systemPrompt, messages, tools,
    });

    const toolUseBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolUseBlock) break;

    const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input);
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(toolResult) }] });
    iterations++;
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
```

**Key differences from generic agent loops:**
- **Stateless per invocation** (Edge Function constraint) -- context assembled fresh each time
- **Timeout-aware** -- checks remaining time before each Claude call
- **Health-safe** -- output validation as mandatory post-processing step
- **Cost-tracked** -- every call logged with token usage for cost monitoring

### Steering and Follow-Up Queues (from Pi Mono)

- If user sends a new message while agent is processing: queue as follow-up
- If message contains urgency signals ("help", "emergency", "chest pain"): treat as steering, interrupt current processing, escalate immediately
- Edge Function implementation: store queued messages in Supabase, check queue at start of each invocation

---

## Model Routing

```typescript
function selectModel(triggerType: string, severity: number): string {
  if (severity > 0.8) return "claude-opus-4-6";
  if (triggerType === "user_message" || severity > 0.4) return "claude-sonnet-4-6";
  return "claude-haiku-4-5-20251001";
}
```

### Routing Matrix

| Trigger | Severity | Model | Approx Cost/Call |
|---------|----------|-------|------------------|
| Scheduled health check (normal) | 0-0.3 | Haiku | ~$0.001 |
| Scheduled health check (mild stress) | 0.3-0.4 | Haiku | ~$0.001 |
| User sends a message | any | Sonnet | ~$0.01 |
| Moderate stress detected | 0.4-0.8 | Sonnet | ~$0.01 |
| High stress / safety concern | 0.8+ | Opus | ~$0.05 |
| Morning briefing | 0 | Sonnet | ~$0.01 |
| Proactive scheduler | 0 | Haiku | ~$0.001 |

### [CRITICAL] Rules-Based Pre-Filter

```typescript
function shouldInvokeClaude(data): boolean {
  if (data.crs_score > 60 && data.stress_confidence < 0.3) return false;
  return true;
}
```

Saves 60-80% of API costs. Most 15-min checks are normal.

### Provider Failover Chain

```
Primary chain (user conversations):
  1. Claude Sonnet (primary)
  2. Claude Haiku (fallback -- faster, cheaper)
  3. Cached/templated response (last resort)

Routine checks chain:
  1. Rules-based evaluation (no LLM, $0)
  2. Claude Haiku (if rules inconclusive)

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

## Context Assembly Pipeline

### The HumanLayer Framework

Context is the ONLY lever for LLM output quality:
- Optimize for: Correctness > Completeness > Minimize Noise > Trajectory
- Keep utilization at 40-60% -- above that, quality degrades

### Structure

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

### Prompt Caching Implementation

```typescript
async function buildSystemPrompt(userId: string): Promise<SystemMessage[]> {
  const userProfile = await getUserProfile(userId);
  const coreMemory = await getCoreMemory(userId);
  const freshBiometrics = await getLatestBiometrics(userId);

  return [
    {
      // CACHED BLOCK (~3000 tokens, stable across calls)
      type: "text",
      text: `${PERSONALITY_AND_RULES}\n\n${USER_PROFILE_AND_PREFERENCES(userProfile)}\n\n${CORE_MEMORY(coreMemory)}`,
      cache_control: { type: "ephemeral" }
      // Default TTL: 5 minutes. For 1-hour TTL: requires anthropic-beta header
    },
    {
      // FRESH BLOCK (~500-1500 tokens, changes every call)
      type: "text",
      text: `Current time: ${new Date().toISOString()}\n\nLatest biometrics:\n${JSON.stringify(freshBiometrics)}\n\nRecent conversation context:\n${recentMessages}`,
    },
  ];
}
```

**Cost savings:** ~80-85% on cached tokens (cache hit rate ~95% with 15-min intervals).

### Dynamic Tool Loading

Don't load all 18 tools. Map intent to 5-8 tools per call:

```
Intent Classification -> Tool Subset Selection

"How did I sleep?"        -> [get_sleep_summary, get_health_history, get_current_biometrics]
"I'm stressed"            -> [get_current_biometrics, get_stress_events, suggest_breathing_exercise]
"What's my day look like?" -> [get_upcoming_events, get_sleep_summary, get_current_biometrics]
"Remember that I..."       -> [update_core_memory, read_core_memory]
Proactive stress alert     -> [get_current_biometrics, get_stress_events, get_upcoming_events, suggest_breathing_exercise]
Morning briefing           -> [get_sleep_summary, get_upcoming_events, get_recent_emails, get_current_biometrics]
```

**Implementation:** Simple keyword/intent classification (no LLM needed):
- Always include: `get_current_biometrics`, `read_core_memory`, `send_message`
- Add health tools if message mentions: sleep, stress, heart, exercise, steps, HRV
- Add calendar/email tools if message mentions: schedule, meeting, day, morning
- Add memory tools if message mentions: remember, forget, preference, goal
- Add intervention tools if stress detected or user asks for help

Saves ~800 tokens per call vs loading all 18.

---

## 18 Agent Tools

### Health Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_current_biometrics` | Latest health snapshot | HR, HRV, steps, sleep, CRS |
| `get_health_history` | Historical data for date range | Array of snapshots |
| `get_sleep_summary` | Last night's sleep details | Duration, stages, efficiency |
| `get_stress_events` | Recent stress triggers | Array with timestamps, severity |

### Memory Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `read_core_memory` | User's persistent profile | Preferences, goals, context |
| `update_core_memory` | Add/modify user profile | Confirmation |
| `search_conversation_history` | Find past conversations | Matching messages |

### Communication Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `send_message` | Send proactive message | Delivery confirmation |
| `schedule_message` | Schedule future message | Schedule ID |

### Calendar/Email Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_upcoming_events` | Next N calendar events | Event list with times |
| `suggest_reschedule` | Propose moving an event | Suggestion sent |
| `get_recent_emails` | Summarize recent inbox | Email summaries |
| `search_emails` | Find emails by query | Matching summaries |

### Intervention Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `suggest_breathing_exercise` | Recommend specific exercise | Exercise with instructions |
| `suggest_break` | Recommend taking a break | Break suggestion with context |
| `suggest_activity` | Recommend movement/activity | Activity recommendation |

### Utility Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_current_time` | Current time in user's timezone | ISO timestamp |
| `log_interaction` | Log this interaction for analytics | Confirmation |

### Tool Definition Format

```typescript
const tools = [
  {
    name: "get_current_biometrics",
    description: "Get the user's latest health biometrics including heart rate, HRV, steps, sleep summary, and current CRS score.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_health_history",
    description: "Get historical health data for a specific date range. Use to identify trends or compare current state to history.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "ISO date string" },
        end_date: { type: "string", description: "ISO date string" },
        metrics: {
          type: "array",
          items: { type: "string", enum: ["hr", "hrv", "steps", "sleep", "crs"] },
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  // ... remaining 16 tools follow same pattern
];
```

---

## Memory Architecture

### Tier 1: Core Memory (Structured KV in Postgres)

Always loaded into context. Self-modifying via agent tools.

```json
{
  "identity": { "name": "Shivansh", "age": 24, "chronotype": "late" },
  "health_profile": { "resting_hr": 62, "typical_sleep": "1am-8am", "conditions": [], "medications": [] },
  "preferences": { "style": "direct", "interventions": ["breathing", "walks"] },
  "patterns": { "stress_triggers": ["deadlines"], "recovery_aids": ["gym"] },
  "active_goals": ["improve sleep consistency"],
  "recent_insights": ["HRV drops on Monday afternoons"]
}
```

**Rules:** Agent can ADD or MODIFY, never delete. Max 50 KV pairs. Agent must explain what it's remembering.

### Tier 2: Conversation Summaries

**Session Compaction:** When conversation exceeds 10 messages, compress older messages:
```
## Conversation Summary (March 7, 10:00-10:45 AM)
- User asked about sleep quality -> reported 5.2h, poor deep sleep
- Agent suggested earlier bedtime -> user committed to 11 PM target
- Mood: slightly frustrated about sleep patterns
- Action items: 11 PM bedtime tonight, log headache if persists
```

Store this summary. On next invocation, load summary + last 5 raw messages.

**Weekly Compaction:** Opus reviews week's session summaries, updates core memory:
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

### Tier 3: Health Knowledge Graph (Phase 2+)

```
Entities: [magnesium, sleep_quality, headache, afternoon_meetings, stress]
Relations: [
  magnesium --improves--> sleep_quality,
  low_sleep --correlates--> headache,
  afternoon_meetings --triggers--> stress,
  stress --reduces--> HRV
]
```

Skip for MVP. Add when you have 3+ months of user data and want to surface complex health patterns.

### Proactive Recording (from CoPaw pattern)

When user mentions something important ("I started taking magnesium"), save to memory BEFORE responding. Critical health context must never be lost to compaction.

In system prompt:
```
After every meaningful interaction, consider if any core memory should be updated:
- New health pattern observed? Add to recent_insights
- User expressed a preference? Update preferences
- Health baseline shifting? Note the trend
- User started/stopped a medication? Update health_profile immediately
```

---

## Hook Pipeline

### Pre-Reasoning Hooks (before each agent call)

```
1. SAFETY HOOK
   - Scan user message for emergency keywords ("chest pain", "can't breathe", "suicidal")
   - If detected: bypass normal agent loop, return emergency response immediately
   - Log emergency event for review

2. CONTEXT INJECTION HOOK
   - Inject latest biometric snapshot if not already in context
   - Inject today's calendar if relevant (morning, or meeting in next 2 hours)
   - Inject any pending medication reminders

3. COMPACTION HOOK
   - Check if conversation history exceeds token budget
   - If so: compress older messages into summary
   - Ensure critical health facts survive compaction (allergies, medications NEVER lost)

4. RATE LIMIT HOOK
   - Check if user has exceeded message rate limit9
   - Check if daily AI cost budget exceeded
   - If so: respond with cached/templated message instead of Claude call
```

### Post-Reasoning Hooks (after agent response)

```
5. OUTPUT VALIDATION HOOK
   - Scan for banned medical phrases
   - Ensure disclaimer present for health-related advice
   - Check response tone (not dismissive of symptoms)

6. MEMORY UPDATE HOOK
   - If agent called update_core_memory, persist changes
   - If conversation is substantive, trigger async summary generation
   - Update last_interaction timestamp

7. ANALYTICS HOOK
   - Log: model used, tokens consumed, tools called, response time
   - Track: intervention effectiveness (was breathing exercise accepted?)
   - Feed into cost monitoring dashboard
```

---

## Skills System

### Directory Structure

```
skills/builtin/
  sleep-analysis/
    SKILL.md          # Sleep assessment protocol
    references/       # Sleep hygiene guidelines, chronotype info
  stress-management/
    SKILL.md          # Stress intervention decision tree
    references/       # Breathing techniques, break activities
  morning-briefing/
    SKILL.md          # Morning report generation protocol
  nutrition-basics/       # Phase 2
  exercise-recovery/      # Phase 2
  medication-tracking/    # Phase 2
```

### SKILL.md Format (Example)

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

### Skill Loading Strategy

Don't load all skills. Match to intent:
```
"I only slept 4 hours"     -> triggers: [sleep]     -> load: sleep-analysis
"I'm so stressed at work"  -> triggers: [stress]    -> load: stress-management
Morning briefing            -> always load: morning-briefing + sleep-analysis
```

Skills add ~200-500 tokens each. Loading 1-2 targeted skills is far better than loading 6 generic ones.

---

## Autonomous Operations (Hands Pattern)

From OpenFang: **Hands are pre-built autonomous agent packages** that run on schedules without user prompting. Each Hand has a manifest (tools, settings), a skill file (domain expertise), and a cron schedule.

### OneSync Hands

| Hand | Schedule | Model | Tools | Gate |
|------|----------|-------|-------|------|
| Morning Briefing | Daily at estimated wake time | Sonnet | sleep, calendar, emails, biometrics | Always |
| Stress Monitor | Every 15 min (data-triggered) | Haiku/Sonnet | biometrics, stress_events, calendar | Confidence > 0.60, 2h cooldown |
| Weekly Review | Sunday evening | Opus | health_history, core_memory | Always |
| Baseline Updater | Daily 4 AM | None (pure computation) | health_history | Always |

### Hand Playbooks

**Morning Briefing Hand:**
```
Phase 1: Gather overnight data (sleep, resting HR, HRV)
Phase 2: Check today's calendar
Phase 3: Scan important emails
Phase 4: Compose personalized morning message
Output: Single message via preferred channel
```

**Stress Monitor Hand:**
```
Phase 1: Evaluate stress confidence score
Phase 2: If confidence > 0.60: check calendar context
Phase 3: Select appropriate intervention
Phase 4: Compose empathetic, actionable message
Gate: Only fires if confidence > 0.60 AND cooldown expired (no alert in last 2h)
```

**Weekly Review Hand:**
```
Phase 1: Aggregate week's health data
Phase 2: Identify trends and patterns
Phase 3: Compare to goals
Phase 4: Update core memory with new insights
Phase 5: Compose weekly summary message
Model: Opus (complex analysis justifies the cost)
```

### Proactive Messaging Rules

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

## Safety Guardrails

### Hard Rules (In System Prompt)

```
SAFETY RULES -- NEVER VIOLATE:
1. You are NOT a doctor. Never diagnose conditions.
2. Never say "you are having a heart attack/stroke/panic attack."
3. If biometrics suggest emergency (HR > 180 sustained, SpO2 < 90):
   "Your readings are unusual. If you feel unwell, contact a doctor or emergency services."
4. Never recommend stopping prescribed medication.
5. Never provide specific medical advice beyond general wellness.
6. Always frame suggestions as "you might try..." not "you should..."
7. If user expresses suicidal ideation, provide crisis helpline numbers immediately.
8. Never share user health data with anyone, including in suggestions.
```

### Rate Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max proactive messages/day | 5 | Prevent notification fatigue |
| Max agent loop iterations | 5 | Prevent runaway tool calls |
| Max tokens per response | 1024 | Keep responses concise |
| Cooldown between stress alerts | 2 hours | Prevent spam |
| Max Opus calls/day per user | 3 | Cost control |

### Fallback Behavior

- If Claude API fails: queue message, retry with exponential backoff
- If all retries fail: send pre-written fallback ("I noticed some changes in your vitals. How are you feeling?")
- If user doesn't respond to 3 consecutive proactive messages: reduce frequency for 24h

### Security Patterns (from OpenFang)

**Must-Have for MVP:**

| Security Pattern | OneSync Implementation |
|-----------------|----------------------|
| Output validation | Scan for banned medical phrases before delivery |
| Input sanitization | Prevent prompt injection via user messages |
| RLS (Row-Level Security) | Supabase RLS ensures users only access own data |
| Encryption at rest | SQLCipher on device, Supabase default encryption |
| Audit logging | Log every agent interaction with model, tools, tokens |
| Rate limiting | Per-user message and cost limits |
| Disclaimer injection | Auto-append health disclaimer to relevant responses |

**Add in Phase 2:**

| Security Pattern | OneSync Implementation |
|-----------------|----------------------|
| Taint tracking | Track which data came from user input vs. verified sources |
| Approval gates | Require explicit confirmation before sharing health data externally |
| Session repair | Recover gracefully from corrupted conversation state |
| Loop guard | Detect and break agent tool-call loops (SHA256-based, from OpenFang) |

---

## Orchestration Patterns (from Paperclip)

**Repo:** [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip) — TypeScript monorepo. An orchestration platform for "zero-human companies" — not an agent framework, but a **control plane** that coordinates external AI agents (Claude Code, Codex, Cursor, etc.) the way a corporate OS coordinates employees. Express 5 + PostgreSQL + Drizzle ORM + React 19 UI.

### Heartbeat-Based Execution

Instead of running agents continuously (expensive), Paperclip wakes agents on a **configurable interval** (e.g., every 300 seconds) or on **event triggers** (task assignment, @-mentions). Each wake creates a "heartbeat run" record in the DB. The run goes through: `queued -> running -> succeeded/failed`. Concurrency control via `maxConcurrentRuns` per agent (default 1, max 10) with atomic claiming (optimistic locking via `WHERE status='queued'`).

**OneSync application:** This is exactly how our health agent should work. Wake on biometric triggers (stress spike, CRS threshold crossed), scheduled check-ins (morning brief, evening review), or user messages. No idle compute. Maps to our existing Supabase Edge Function serverless model — the heartbeat pattern validates our "wake, process, respond, sleep" architecture.

### Session Persistence Across Heartbeats

Paperclip maintains **per-task sessions** across heartbeats via an `agent_task_sessions` table storing serialized session params keyed by `(companyId, agentId, adapterType, taskKey)`. On each wake, the previous session is restored so the agent resumes context rather than starting from scratch. Sessions reset on specific triggers (new task, timer wake, manual invoke).

**OneSync application:** We need this for health context continuity. When the agent wakes at 7 AM for a morning brief, it should resume the user's health narrative — not re-read everything. Store session state (last CRS discussed, pending follow-ups, active health goals, conversation tone) in Supabase, keyed by `(userId, agentSessionType)`. Reset on: new day, user-initiated conversation, major health event.

### Adapter Pattern for Agent Runtimes

Each agent type is a separate package implementing a `ServerAdapterModule` interface with `execute()`, `testEnvironment()`, and optional `sessionCodec`. Unknown types fall back to a generic `process` adapter. Adding a new agent type = writing one adapter package.

**OneSync application:** Our channel adapters (Telegram, WhatsApp, push notification) should follow this pattern. Each channel implements a `ChannelAdapter` interface with `send()`, `receiveWebhook()`, `formatMessage()`. Adding a new channel (e.g., Slack, email) = writing one adapter. We already have this direction in the Messaging Architecture section below — Paperclip validates the approach.

### Goal Ancestry (Context Hierarchy)

Every task carries full **goal ancestry** so agents understand not just "what" but "why": Company Mission → Goals → Projects → Issues → Subtasks. The GET endpoint returns the full ancestor chain. Agent skill instructions explicitly require reading the ancestor chain before working.

**OneSync application:** Health recommendations need "why" context too. When the agent suggests "take a 15-minute walk," the user should be able to trace: User Goal ("improve focus") → Health Area ("stress management") → Current State ("elevated HRV + sedentary 3 hours") → Intervention ("walk"). Store goal hierarchy in Supabase. Include relevant ancestor context in every agent prompt — not just the immediate trigger.

### PARA Memory System

Paperclip's `para-memory-files` skill uses the PARA method (Projects/Areas/Resources/Archives) with YAML facts, daily notes, and tacit knowledge. Includes "memory decay" handling so stale data gets flagged.

**OneSync application:** Maps directly to health domains:
- **Projects**: Active health goals (marathon training, sleep improvement, stress reduction)
- **Areas**: Ongoing health domains (nutrition, sleep, exercise, mental health, cognitive performance)
- **Resources**: Reference material (exercise routines, dietary guidelines, breathing techniques)
- **Archives**: Completed goals, historical CRS trends, past interventions and outcomes

This is richer than our current two-tier memory (episodic + semantic). Consider adding a goal-structured layer on top.

### Governance & Approval Gates

Paperclip has first-class governance: approval gates for agent actions, config revisions with versioning and rollback, budget hard-stops (agents auto-pause at 100% utilization), and activity logging for all mutations.

**OneSync application:** Map to health safety:
- **Approval gates**: High-stakes recommendations (suggesting medication timing changes, extreme exercise modifications) require user confirmation before the agent acts
- **Budget control**: Token spend tracking per user (already planned) — Paperclip validates this as a pattern
- **Audit trail**: Every recommendation logged with trigger data, CRS at time of recommendation, and user response. Critical for the IIT Ropar validation study and any future clinical credibility

### Skills as Injected Markdown

Rather than fine-tuning, Paperclip injects structured markdown "skills" into agent prompts at runtime. The main skill is essentially a "new employee onboarding guide" for AI agents — procedural instructions for how to behave within the system.

**OneSync application:** We already planned this (Skills System section above). Paperclip confirms the pattern at production scale. Their skill injection is runtime-only, no training needed — same as our approach with health-specific SKILL.md files.

### Other Notable Patterns

| Pattern | Paperclip Implementation | OneSync Relevance |
|---------|-------------------------|-------------------|
| **Embedded Postgres** | Zero-config dev via `embedded-postgres` npm package | We use Supabase (hosted Postgres), but for local dev/testing this is worth noting |
| **WebSocket streaming** | Run logs stream via WS with EventEmitter pub/sub, 8KB chunk cap | Real-time CRS updates to the app could use similar pattern via Supabase Realtime |
| **Orphan run reaping** | On startup + every 5 min, detects dead agent processes and marks runs as failed | Our Edge Functions have built-in timeouts, but we should handle stuck/incomplete agent runs in the DB |
| **Atomic issue checkout** | Single-assignee checkout with 409 Conflict on contention | Not directly applicable (single-user agent), but relevant if we ever have multi-agent coordination (e.g., separate sleep agent + stress agent) |
| **Company portability** | Full export/import of org configs with secret scrubbing | User data export (GDPR compliance, data portability) should follow similar pattern |

---

## Context Engineering Patterns (from Agent-Skills-for-Context-Engineering)

**Repo:** [github.com/muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) — A curated knowledge base of structured "Agent Skills" (markdown instruction documents) that teach AI agents how to manage context, memory, tools, and multi-agent coordination. Distributed as a Claude Code Plugin Marketplace. Cited in academic research (Peking University, arXiv:2601.21557). Zero runtime dependencies — the skills ARE the product.

### The Four-Bucket Approach to Context Management

The repo codifies context engineering as four operations on a finite attention budget:

| Bucket | Operation | OneSync Application |
|--------|-----------|---------------------|
| **Write** | Save context outside the window (filesystem, DB) | Health logs, conversation history, CRS time-series → stored in Supabase + local SQLite, not in context |
| **Select** | Pull only relevant context via retrieval/filtering | Load only the health domain relevant to current interaction (sleep question loads sleep data, not nutrition) |
| **Compress** | Reduce tokens while preserving signal | Weekly health summaries replace raw daily logs. Session compaction (already planned in Tier 2 memory) |
| **Isolate** | Split context across sub-agents with independent windows | Separate Hands (Morning Brief, Stress Monitor, Weekly Review) already have isolated contexts |

**OneSync validation:** Our architecture already implements all four buckets. The four-bucket framing is a useful mental model for auditing context decisions — every piece of information entering the agent should pass through one of these.

### Progressive Disclosure (Most Important Pattern)

Information loads in layers, not all at once:
- **L1:** Skill names + brief descriptions (~50 tokens each) — always loaded
- **L2:** Module-level instructions — loaded on-demand when task matches
- **L3:** Data files — loaded only when specific information is needed

**OneSync application:** This directly validates our Dynamic Tool Loading and Skill Loading Strategy. Extend it to health data:
- **L1 (always in context):** User name, chronotype, active conditions, current CRS — ~200 tokens
- **L2 (loaded per interaction type):** Relevant SKILL.md (sleep-analysis, stress-management) + recent health baselines — ~500 tokens
- **L3 (loaded only when asked):** Full sleep session details, 30-day HRV trend, conversation history search results — variable

This is more granular than our current two-block (cached + fresh) approach. Consider splitting the fresh block into L2 (always-relevant health context) and L3 (on-demand via tool calls).

### Context Degradation Taxonomy

Context degradation is predictable and classifiable. Five failure modes:

| Degradation Type | What Happens | OneSync Risk | Mitigation |
|-----------------|--------------|-------------|------------|
| **Lost-in-middle** | Model ignores information positioned in the middle of long context (U-shaped attention curve, 10-40% lower recall) | Health facts buried between conversation history and tool definitions | Put critical health data at START and END of context, never in the middle. CRS and active alerts → top. User preferences → bottom. |
| **Context poisoning** | Errors compound through repeated reference — one wrong CRS interpretation gets echoed in future summaries | Agent misinterprets a stress spike as chronic → carries false narrative forward | Weekly Opus review (already planned) must explicitly challenge accumulated beliefs. Add a "verify before echoing" rule. |
| **Context distraction** | Irrelevant info consumes attention budget | Loading full 30-day history when user just asks "how did I sleep last night?" | Dynamic tool loading + intent classification (already planned) handles this. Resist loading "just in case" data. |
| **Context confusion** | Model can't determine which context applies when multiple similar items exist | Multiple sleep sessions, overlapping stress events, contradictory self-reports | Timestamp everything. When loading multiple health records, always include explicit date/time markers. |
| **Context clash** | Accumulated contradictions (user said "I feel fine" but CRS shows 35) | Subjective self-report vs. objective biometrics | Explicit instruction in system prompt: "When self-report contradicts biometrics, acknowledge both. Never dismiss either." |

### Tool Consolidation Principle

"If a human engineer cannot definitively say which tool should be used in a given situation, an agent cannot be expected to do better." Evidence from the repo: reducing from 17 specialized tools to 2 primitives achieved 3.5x faster execution.

**OneSync application:** We have 18 tools. Review for consolidation:

| Current (Separate) | Consolidated | Rationale |
|--------------------|-------------|-----------|
| `get_current_biometrics` + `get_health_history` + `get_sleep_summary` + `get_stress_events` | `get_health_data(type, timerange?)` | One tool with a `type` param ("current", "history", "sleep", "stress"). Agent already knows what data it needs. |
| `suggest_breathing_exercise` + `suggest_break` + `suggest_activity` | `suggest_intervention(type?)` | One tool. Let the agent decide which intervention based on context, not force it to pick the right tool name. |
| `send_message` + `schedule_message` | `send_message(schedule_at?)` | Optional param for scheduling. Same delivery mechanism. |

This could reduce from 18 tools to ~10-12, saving ~300 tokens per call and reducing tool selection errors.

### Skills-as-Instructions (Not Skills-as-Code)

The repo's core insight: skills are structured markdown documents injected into agent context, not Python libraries. The "runtime" is the LLM itself. Each skill stays under 500 lines for optimal performance.

**OneSync validation:** Exactly matches our SKILL.md approach. The 500-line limit is a useful hard constraint we should adopt. Our current skill template doesn't specify a size limit — add one.

### Append-Only JSONL for Health Tracking

The digital-brain example uses JSONL files with schema-first lines as append-only data stores:
```json
{"_schema": "health_log", "_version": "1.0", "_description": "Daily health tracking"}
{"id": "log_001", "date": "2026-03-07", "mood": 7, "sleep_hours": 7.5, "exercise": "30min walk"}
```

**OneSync application:** Our health data is in Postgres (append-only `health_snapshots` table), which is equivalent. But for agent-side context, consider formatting health data as JSONL in the context window — it's more token-efficient than markdown tables and easier for the model to parse.

### BDI Mental States (Belief-Desire-Intention)

The most conceptually novel skill — formalizing agent cognition: Beliefs motivate Desires, Desires are fulfilled by Intentions, Intentions specify Plans with ordered Tasks. Enables explainable reasoning chains.

**OneSync application (Phase 2+):** When the agent recommends an intervention, it should be able to trace:
- **Belief:** "User's HRV dropped 25% from baseline and they have a presentation in 2 hours"
- **Desire:** "Reduce user's stress before presentation"
- **Intention:** "Suggest a 5-minute breathing exercise"
- **Plan:** "1. Acknowledge the stress. 2. Offer breathing exercise. 3. Remind about the presentation timing."

This improves transparency for the IIT Ropar validation study — researchers can audit WHY the agent made each recommendation. Not MVP, but worth designing the logging schema to support this.

### Probe-Based Evaluation for Compression Quality

Instead of ROUGE/embedding similarity, test compression by asking specific questions:
- **Recall probes:** "What was the user's HRV yesterday?" (checks fact retention)
- **Artifact probes:** "Was the user's sleep score mentioned as 85 or 58?" (checks for hallucinated inversions)
- **Continuation probes:** "What should the agent recommend next?" (checks reasoning preservation)
- **Decision probes:** "Should the agent escalate to Opus?" (checks decision context)

**OneSync application:** Use this to validate our conversation compaction. After compressing a week of conversations into a summary, run probe questions to ensure critical health facts survived. Automate this as a quality check in the Weekly Review Hand.

### File-System Memory vs. Specialized Tools

Benchmark insight from the repo: Letta's filesystem agents scored 74% on LoCoMo using basic file operations, beating Mem0's specialized memory tools at 68.5%. The recommendation: **start with simple, then add complexity only when retrieval quality demands it.**

**OneSync validation:** Our two-tier memory (Core Memory KV + Conversation Summaries) is deliberately simple. This benchmark confirms: don't rush to add a knowledge graph (Tier 3) or vector search until we have evidence that simple retrieval is failing.

---

## Messaging Architecture

### Channels

| Channel | Library | Runtime | Why |
|---------|---------|---------|-----|
| Telegram | grammY (Deno-native) | Supabase Edge Functions | Free, instant setup, rich formatting, no approval |
| WhatsApp | Raw HTTP (Cloud API v21.0) | Supabase Edge Functions | 2.9B users, enterprise credibility |

### Telegram (grammy)

```typescript
import { Bot, webhookCallback, InlineKeyboard } from "https://deno.land/x/grammy/mod.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN")!);

// Text messages
bot.on("message:text", async (ctx) => {
  const userId = await resolveUser(ctx.from.id, "telegram");
  const response = await processMessage(userId, ctx.message.text, "telegram");
  await ctx.reply(response);
});

// Callback queries from inline keyboards
bot.callbackQuery(/^feedback_/, async (ctx) => {
  const data = ctx.callbackQuery.data; // e.g., "feedback_good"
  await ctx.answerCallbackQuery({ text: "Recorded!" });
  // Store in Supabase
});

// Catch-all (MUST always answer to clear loading spinner)
bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery();
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return await webhookCallback(bot, "std/http")(req);
});
```

**Sending rich messages with buttons:**

```typescript
const keyboard = new InlineKeyboard()
  .text("Good", "mood_good").text("Okay", "mood_okay").text("Bad", "mood_bad").row()
  .text("Skip", "mood_skip");

await bot.api.sendMessage(chatId, "*How are you feeling today?*", {
  parse_mode: "MarkdownV2",
  reply_markup: keyboard,
});
```

**Rate limiting:** Telegram enforces 30 msg/s global, 1 msg/s per chat. grammY has auto-retry:
```typescript
import { autoRetry } from "https://deno.land/x/grammy_auto_retry/mod.ts";
bot.api.config.use(autoRetry());
```

### WhatsApp Cloud API

**Sending text messages:**

```typescript
const WA_API_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
const WA_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");

async function sendWhatsAppMessage(to: string, text: string) {
  const response = await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  return response.json();
}
```

**Sending interactive button messages (max 3 buttons):**

```typescript
async function sendWhatsAppButtons(to: string, bodyText: string, buttons: Array<{id: string, title: string}>) {
  await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    }),
  });
}
```

**Sending list messages (for >3 options, up to 10 items):**

```typescript
async function sendWhatsAppList(to: string, bodyText: string, buttonText: string, sections: any[]) {
  await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: buttonText, // e.g., "View Options"
          sections: sections   // Up to 10 items across sections
        }
      }
    }),
  });
}
```

**Processing incoming webhook messages:**

```typescript
async function handleWhatsAppWebhook(body: any) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return; // Could be a status update, not a message

  const message = value.messages[0];
  const from = message.from; // Phone number
  const messageType = message.type;

  switch (messageType) {
    case "text":
      const text = message.text.body;
      // Route to AI agent
      break;
    case "interactive":
      if (message.interactive.type === "button_reply") {
        const buttonId = message.interactive.button_reply.id;
        const buttonTitle = message.interactive.button_reply.title;
      } else if (message.interactive.type === "list_reply") {
        const listId = message.interactive.list_reply.id;
      }
      break;
  }
}
```

### WhatsApp -- 24-Hour Rule

- Within 24h of user's last message: free-form text (free)
- Outside 24h: pre-approved UTILITY template messages only
- Strategy: templates prompt reply to re-open 24h window

### Template Messages (Pre-Approved)

| Template | Category | Body | Purpose |
|----------|----------|------|---------|
| `stress_checkin` | UTILITY | "Hey {{1}}, I noticed some changes in your vitals. How are you feeling? Reply to let me know." | Stress alert |
| `morning_brief` | UTILITY | "Good morning {{1}}! Your sleep score was {{2}}/100. Want your full morning briefing?" | Morning brief |
| `weekly_summary` | UTILITY | "{{1}}, your weekly health summary is ready. Reply 'yes' to see it." | Weekly report |
| `medication_reminder` | UTILITY | "Hi {{1}}, this is a reminder to take your {{2}}. Reply 'done' when complete." | Medication adherence |
| `inactivity_nudge` | UTILITY | "Hey {{1}}, you've been sitting for {{2}} hours. A short walk might help." | Movement nudge |

**Template approval tips:** Keep templates factual and non-promotional. Use UTILITY category (cheaper, higher delivery). Include "Reply to..." to re-open 24h window.

### Platform Comparison

| Feature | Telegram | WhatsApp |
|---------|----------|----------|
| Bot initiation | User must /start the bot | User must message first OR opt-in |
| Proactive messaging | Anytime after /start | Only within 24-hour window (or templates) |
| Buttons per message | Unlimited inline keyboard | Max 3 reply buttons |
| Extended choices | Inline keyboard rows | List messages (max 10 items) |
| Formatting | MarkdownV2, HTML | Bold (*), Italic (_), Strike (~), Mono (```) |
| Message editing | Supported | Not supported |
| Library support (Deno) | grammY (excellent) | Raw HTTP (no mature library) |
| Webhook auth | secret_token header | HMAC-SHA256 signature |
| Rate limits | 30 msg/s global | 80 msg/s (business tier dependent) |

---

## Unified Message Abstraction

### Core Types

```typescript
interface AgentMessage {
  userId: string;
  text: string;
  buttons?: AgentButton[];
  media?: AgentMedia;
  isProactive: boolean;
  templateId?: string;       // WhatsApp template name (required if proactive + outside window)
  templateParams?: string[];
  priority: "low" | "normal" | "high" | "urgent";
}

interface AgentButton {
  id: string;
  label: string;   // Max 20 chars for WhatsApp
  type: "quick_reply" | "url" | "call";
}

interface IncomingMessage {
  userId: string;
  platform: "telegram" | "whatsapp";
  platformUserId: string;
  text?: string;
  callbackData?: string;
  mediaUrl?: string;
  timestamp: number;
}
```

### Channel Adapter Interface

```typescript
interface ChannelAdapter {
  send(platformUserId: string, message: AgentMessage): Promise<void>;
  normalize(rawPayload: any): IncomingMessage;
  canSendProactive(platformUserId: string): Promise<boolean>;
}
```

### Message Router

```typescript
class MessageRouter {
  private adapters: Map<string, ChannelAdapter>;

  constructor() {
    this.adapters = new Map();
    this.adapters.set("telegram", new TelegramAdapter());
    this.adapters.set("whatsapp", new WhatsAppAdapter());
  }

  async send(message: AgentMessage): Promise<void> {
    const userChannels = await getUserChannels(message.userId);

    for (const channel of userChannels) {
      const adapter = this.adapters.get(channel.platform);
      if (!adapter) continue;

      try {
        await adapter.send(channel.platformUserId, message);
      } catch (error) {
        await queueFailedMessage(channel, message, error);
      }
    }
  }

  normalize(platform: string, rawPayload: any): IncomingMessage {
    const adapter = this.adapters.get(platform);
    return adapter!.normalize(rawPayload);
  }
}
```

### Button Adaptation (Platform-Specific)

```typescript
// TelegramAdapter: AgentButtons -> InlineKeyboard
function toTelegramKeyboard(buttons: AgentButton[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  buttons.forEach((btn, i) => {
    kb.text(btn.label, btn.id);
    if ((i + 1) % 3 === 0) kb.row();
  });
  return kb;
}

// WhatsAppAdapter: AgentButtons -> interactive message
function toWhatsAppButtons(buttons: AgentButton[]): any {
  if (buttons.length <= 3) {
    return {
      type: "button",
      action: {
        buttons: buttons.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.label.substring(0, 20) }
        }))
      }
    };
  } else {
    return {
      type: "list",
      action: {
        button: "Choose",
        sections: [{
          title: "Options",
          rows: buttons.map(b => ({ id: b.id, title: b.label.substring(0, 24) }))
        }]
      }
    };
  }
}
```

### Formatting Abstraction

```typescript
const telegramFormatter = {
  bold: (t: string) => `*${t}*`,
  italic: (t: string) => `_${t}_`,
  code: (t: string) => `\`${t}\``,
  link: (t: string, url: string) => `[${t}](${url})`,
};

const whatsappFormatter = {
  bold: (t: string) => `*${t}*`,
  italic: (t: string) => `_${t}_`,
  code: (t: string) => "```" + t + "```",
  link: (t: string, url: string) => `${t}: ${url}`, // WhatsApp doesn't support hyperlinks
};
```

---

## Interactive Health Feedback UX

### Mood Check (3 buttons, works on both platforms)

```typescript
const moodCheck: AgentMessage = {
  userId: "user123",
  text: "How are you feeling right now?",
  buttons: [
    { id: "mood_good", label: "Good", type: "quick_reply" },
    { id: "mood_okay", label: "Okay", type: "quick_reply" },
    { id: "mood_bad",  label: "Not great", type: "quick_reply" },
  ],
  isProactive: false,
  priority: "normal",
};
```

### Multi-Choice Symptom Checker (list on WhatsApp)

```typescript
const symptomCheck: AgentMessage = {
  userId: "user123",
  text: "Which of these have you experienced today?",
  buttons: [
    { id: "sym_headache",  label: "Headache", type: "quick_reply" },
    { id: "sym_fatigue",   label: "Fatigue", type: "quick_reply" },
    { id: "sym_insomnia",  label: "Poor sleep", type: "quick_reply" },
    { id: "sym_anxiety",   label: "Anxiety", type: "quick_reply" },
    { id: "sym_none",      label: "None of these", type: "quick_reply" },
  ],
  isProactive: false,
  priority: "normal",
};
// Router: Telegram renders as 5 inline buttons; WhatsApp renders as list message
```

### Storing Callback Responses

```sql
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  platform TEXT NOT NULL,           -- 'telegram' | 'whatsapp'
  interaction_type TEXT NOT NULL,   -- 'mood_check' | 'feedback' | 'symptom'
  callback_data TEXT NOT NULL,      -- 'mood_good' | 'fb_yes' | 'sym_headache'
  message_id TEXT,                  -- Platform message ID for reference
  context JSONB,                    -- Additional context (what triggered this)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX idx_interactions_type ON user_interactions(interaction_type, created_at DESC);
```

### Callback Handler Pattern

```typescript
async function handleCallback(incoming: IncomingMessage): Promise<AgentMessage | null> {
  const callbackData = incoming.callbackData;
  if (!callbackData) return null;

  // Parse callback: "mood_good" -> type="mood", value="good"
  const [type, ...rest] = callbackData.split("_");
  const value = rest.join("_");

  // Store interaction
  await supabase.from("user_interactions").insert({
    user_id: incoming.userId,
    platform: incoming.platform,
    interaction_type: type,
    callback_data: callbackData,
  });

  // Generate response based on callback
  switch (type) {
    case "mood":
      if (value === "bad") {
        return {
          userId: incoming.userId,
          text: "I'm sorry to hear that. Would you like to try a quick breathing exercise or talk about what's going on?",
          buttons: [
            { id: "action_breathe", label: "Breathing exercise", type: "quick_reply" },
            { id: "action_talk",    label: "Talk about it", type: "quick_reply" },
          ],
          isProactive: false,
          priority: "high",
        };
      }
      return { userId: incoming.userId, text: "Great, glad to hear it!", isProactive: false, priority: "low" };

    case "fb":
      return { userId: incoming.userId, text: "Thanks for the feedback!", isProactive: false, priority: "low" };

    default:
      return null;
  }
}
```

---

## Webhook Security

### Telegram: Secret Token Header

```typescript
// Setting webhook with secret token
await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `https://${PROJECT_ID}.supabase.co/functions/v1/telegram-bot`,
    secret_token: WEBHOOK_SECRET, // 1-256 chars, A-Z a-z 0-9 _ -
  }),
});

// Verifying in the Edge Function
Deno.serve(async (req) => {
  const secretHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secretHeader !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return await handleUpdate(req);
});
```

Better than query-parameter approach because the secret never appears in URL logs.

### WhatsApp: HMAC-SHA256 Signature (Deno-Native)

```typescript
import { crypto } from "https://deno.land/std/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std/encoding/hex.ts";

async function verifyWhatsAppSignature(req: Request): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("X-Hub-Signature-256");
  if (!signature) return { valid: false, body: "" };

  const rawBody = await req.text();
  const appSecret = Deno.env.get("WA_APP_SECRET")!;

  // Compute HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedSignature = "sha256=" + encodeHex(new Uint8Array(sig));

  // Constant-time comparison
  const valid = signature === expectedSignature;
  return { valid, body: rawBody };
}

// Usage in Edge Function
Deno.serve(async (req) => {
  if (req.method === "POST") {
    const { valid, body } = await verifyWhatsAppSignature(req);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }
    const payload = JSON.parse(body);
    await handleWhatsAppWebhook(payload);
    return new Response("OK", { status: 200 });
  }
});
```

**Critical:** Verify signature against raw body string BEFORE parsing JSON. If you parse first and re-stringify, the signature will not match.

---

## Message Queuing (pgmq)

### Why Queue?

- Edge Functions can fail (cold start timeout, API error)
- WhatsApp rate limits (80 messages/second)
- Telegram occasionally has API downtime
- Need retry logic without losing messages

### Acknowledge Fast, Process Async Pattern

```
Webhook arrives
  -> Edge Function receives
  -> 1. Verify signature (fast)
  -> 2. Insert raw payload into Supabase queue table (fast)
  -> 3. Return 200 OK immediately
  -> Separate worker function (triggered by pg_notify or cron)
  -> Processes queued messages with full error handling and retries
```

### Implementation

```sql
-- Enable pgmq
SELECT pgmq.create('incoming_messages');
SELECT pgmq.create('outgoing_messages');
```

**Webhook handler (fast, just enqueues):**

```typescript
Deno.serve(async (req) => {
  // Verify signature...
  const body = await req.json();

  await supabase.schema("pgmq_public").rpc("send", {
    queue_name: "incoming_messages",
    message: {
      platform: "telegram",
      payload: body,
      received_at: new Date().toISOString(),
    },
  });

  return new Response("OK", { status: 200 });
});
```

**Worker function (processes the queue):**

```typescript
Deno.serve(async (req) => {
  const { data: messages } = await supabase
    .schema("pgmq_public")
    .rpc("read", {
      queue_name: "incoming_messages",
      sleep_seconds: 0,
      n: 10,
    });

  for (const msg of messages ?? []) {
    try {
      await processMessage(msg.message);
      await supabase.schema("pgmq_public").rpc("delete", {
        queue_name: "incoming_messages",
        msg_id: msg.msg_id,
      });
    } catch (error) {
      console.error("Processing failed, will retry:", error);
      // Message stays in queue; pgmq makes it visible again after visibility timeout
    }
  }

  return new Response("OK");
});
```

**Outgoing message queue with retries:**

```typescript
await supabase.schema("pgmq_public").rpc("send", {
  queue_name: "outgoing_messages",
  message: {
    userId: "user123",
    agentMessage: { text: "Your morning brief...", buttons: [...] },
    retryCount: 0,
    maxRetries: 3,
  },
});

// Worker: if send fails and retryCount < maxRetries, re-enqueue with incremented count
// After maxRetries: log to failed_messages table
```

**Dead letter queue:** After 3 failed attempts, move to dead letters for manual review.

---

## Auth Linking (6-Digit Code)

```
1. User opens OneSync app -> Settings -> Link Telegram/WhatsApp
2. App generates 6-digit code, stores in linking_codes table (expires 5 min)
3. User sends code to bot: "/link 482917"
4. Bot looks up code in linking_codes table
5. If valid and not expired: stores mapping (telegram_chat_id -> user_id)
6. User is now linked
```

```sql
create table linking_codes (
  code text primary key,
  user_id uuid references auth.users(id),
  channel text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '5 minutes',
  used boolean default false
);

create table channel_links (
  user_id uuid references auth.users(id),
  channel text not null,
  channel_user_id text not null, -- telegram chat_id or whatsapp phone
  linked_at timestamptz default now(),
  primary key (user_id, channel)
);
```

---

## Supabase Backend

### Why Supabase

- Postgres with full SQL power (pg_cron, pg_net, pgmq, pgvector)
- Edge Functions (Deno runtime) -- serverless, same language as app
- Built-in Auth (email, OAuth, anonymous)
- Realtime subscriptions (for future live dashboard updates)
- Free tier: 500MB DB, 2GB bandwidth, 500K Edge Function invocations/month
- Row Level Security built into Postgres

### Database Schema (Core Tables)

```sql
-- User profiles (extends auth.users)
create table user_profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  chronotype text default 'normal',    -- 'early', 'normal', 'late'
  timezone text default 'Asia/Kolkata',
  preferred_channel text default 'telegram',
  onboarding_complete boolean default false,
  crs_weights jsonb default '{"sleep":0.35,"hrv":0.25,"circadian":0.25,"activity":0.15}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Health snapshots (every 15 min from background sync)
create table health_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  recorded_at timestamptz not null,
  source text not null, -- 'health_connect', 'samsung_sensor', 'garmin_ciq', etc.
  heart_rate int, hrv_rmssd real, spo2 real, skin_temp real,
  respiratory_rate real, steps_total int, steps_last_2h int, calories int,
  crs_score real, crs_components jsonb, stress_level real,
  raw_ibi jsonb,
  created_at timestamptz default now()
);

-- Sleep sessions
create table sleep_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  sleep_start timestamptz not null, sleep_end timestamptz not null,
  duration_minutes int, deep_minutes int, rem_minutes int,
  light_minutes int, awake_minutes int, efficiency real,
  avg_hr real, avg_hrv real, sleep_score real, source text not null,
  created_at timestamptz default now()
);

-- Personal baselines (rolling averages)
create table health_baselines (
  user_id uuid references auth.users(id) primary key,
  resting_hr real, hrv_7day real, hrv_30day real,
  avg_steps_7day real, avg_sleep_duration_7day real,
  avg_sleep_score_7day real, avg_crs_7day real,
  time_of_day_hrv_ratios jsonb, -- [1.30, 1.10, 1.00, 0.85, 0.90, 1.05]
  updated_at timestamptz default now()
);

-- Core memory (agent-managed persistent profile)
create table core_memory (
  user_id uuid references auth.users(id) not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- Conversation history
create table conversation_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  channel text not null,
  role text not null, -- 'user' or 'assistant'
  content text not null,
  metadata jsonb, -- trigger_type, model_used, etc.
  created_at timestamptz default now()
);

-- Stress events
create table stress_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  detected_at timestamptz not null,
  severity text not null, -- 'mild', 'moderate', 'high'
  hrv_drop_pct real, hr_elevation_pct real, persist_minutes int,
  intervention_sent boolean default false,
  user_feedback text, -- 'helpful', 'not_helpful', null
  created_at timestamptz default now()
);

-- Connected devices
create table connected_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  device_type text not null, -- 'samsung_watch', 'garmin', 'fitbit', 'oura', 'whoop'
  device_name text,
  connection_type text not null, -- 'sensor_sdk', 'connect_iq', 'cloud_api', 'health_connect'
  oauth_tokens jsonb, -- encrypted, for cloud APIs
  last_sync_at timestamptz,
  created_at timestamptz default now()
);
```

### Indexes

```sql
create index idx_health_user_time on health_snapshots(user_id, recorded_at desc);
create index idx_sleep_user_start on sleep_sessions(user_id, sleep_start desc);
create index idx_convo_user_time on conversation_history(user_id, created_at desc);
create index idx_stress_user_time on stress_events(user_id, detected_at desc);
create index idx_channel_links_channel on channel_links(channel, channel_user_id);
```

### Row Level Security

```sql
-- FAST pattern: (select auth.uid()) cached via initPlan, evaluated once not per-row
alter table health_snapshots enable row level security;

create policy "Users read own health data"
  on health_snapshots for select
  using ((select auth.uid()) = user_id);

create policy "Users insert own health data"
  on health_snapshots for insert
  with check ((select auth.uid()) = user_id);

-- DO NOT use: using (auth.uid() = user_id)  -- this is slow (evaluated per row)
-- DO use:     using ((select auth.uid()) = user_id)  -- cached, fast
```

Edge Functions use `service_role` key (bypasses RLS) for webhook/background tasks:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Bypasses RLS
);
```

### Edge Functions

| Function | Trigger | Rate | Purpose |
|----------|---------|------|---------|
| `telegram-webhook` | Telegram POST | Per message | Verify + enqueue to pgmq |
| `whatsapp-webhook` | WhatsApp GET/POST | Per message | Verify signature + enqueue |
| `message-processor` | pg_cron/pg_notify | Per event | Run agent loop, enqueue reply |
| `message-sender` | pg_cron (1 min) + pg_notify | 6/min | Deliver outbound messages |
| `check-triggers` | pg_cron (1 min) | 1/min | Evaluate stress gates |
| `morning-brief` | pg_cron (per user) | 1/user/day | Generate morning briefing |
| `compute-baselines` | pg_cron (daily 4am) | 1/day | Recompute rolling baselines |
| `process-health-data` | Invoked by app | Per sync | Compute CRS, detect stress |
| `adjust-crs-weights` | pg_cron (weekly) | 1/week | Adjust CRS weights from feedback |

**Edge Function Limits (Free Tier):**

| Limit | Value |
|-------|-------|
| Invocations/month | 500,000 |
| Execution time | 150s wall clock |
| Memory | 256MB |
| Payload size | 6MB request/response |
| Concurrent | 10 (free), 100+ (pro) |

### pg_cron + pg_net Setup

```sql
-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Check stress triggers every minute
select cron.schedule(
  'check-triggers',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-triggers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('time', now())
  );
  $$
);

-- Process message queue every minute
select cron.schedule(
  'process-message-queue',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/message-sender',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Compute baselines daily at 4am IST (22:30 UTC)
select cron.schedule(
  'compute-baselines',
  '30 22 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/compute-baselines',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Storing secrets in Vault:**

```sql
select vault.create_secret('service_role_key', 'eyJ...');
-- Reference in pg_cron jobs via current_setting() with app.settings
```

### Data Retention

| Table | Retention | Reason |
|-------|-----------|--------|
| health_snapshots | 90 days detailed, daily summaries forever | Storage management |
| sleep_sessions | Forever | Long-term trends |
| conversation_history | 30 days full, summaries forever | Context window management |
| stress_events | Forever | Pattern analysis |
| raw_ibi in snapshots | 7 days | Large payload, only for recomputation |

```sql
-- Daily cleanup job
select cron.schedule(
  'data-retention',
  '0 3 * * *',
  $$
  UPDATE health_snapshots SET raw_ibi = NULL
  WHERE recorded_at < now() - interval '7 days' AND raw_ibi IS NOT NULL;
  $$
);
```

### Free Tier Capacity (100 users)

| Resource | Free Tier | Usage | Headroom |
|----------|-----------|-------|----------|
| Database | 500MB | ~200MB | 60% |
| Bandwidth | 2GB/month | ~500MB | 75% |
| Edge Function calls | 500K/month | ~330K | 34% |
| Auth users | 50K MAU | 100 | 99.8% |
| Realtime | 200 concurrent | 10-20 | 90% |
| Storage | 1GB | ~50MB | 95% |

**Upgrade trigger:** ~200-300 users -> Supabase Pro ($25/month).

**Cost estimate at 100 users:**
- Health syncs: 100 users * 96/day = 288,000/month
- User messages: ~10/user/day = 30,000/month
- Proactive messages: ~3/user/day = 9,000/month
- Background checks: ~4,320/month
- **Total: ~331,320/month -- within free tier (500K)**

### Auth & Google OAuth

```typescript
// Email/password for MVP
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
});

// Google OAuth (future, enables Calendar + Gmail)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
  },
});
```

**Google Calendar integration (in Edge Functions):**

```typescript
async function getUpcomingEvents(userId: string) {
  const tokens = await getOAuthTokens(userId, 'google');
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({
      timeMin: new Date().toISOString(),
      timeMax: endOfDay().toISOString(),
      maxResults: '10',
      orderBy: 'startTime',
      singleEvents: 'true',
    }),
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );
  return response.json();
}
```

---

## Offline-First Data Layer

### Custom SQLite Sync (Replaces PowerSync)

Health sensor readings are **append-only immutable facts**. No conflicts possible. PowerSync's bidirectional sync is overkill at $49+/month.

```
UPLOAD (phone -> server):
  Health Connect read -> Write to local SQLite (op-sqlite + SQLCipher)
  Background task -> SELECT unsynced -> POST batch to Supabase -> Mark synced

DOWNLOAD (server -> phone):
  On app open: fetch baselines + core_memory from Supabase -> write to local SQLite
```

### State Management Stack

| Layer | Choice | Role |
|-------|--------|------|
| Zustand | Client state | Dashboard, UI prefs, onboarding |
| TanStack Query | Server state | Fetching baselines, API calls |
| MMKV | Key-value store | Auth tokens, last sync timestamp |
| op-sqlite + SQLCipher | Local DB | Health time-series, encrypted at rest |

---

## Trigger Flows

### 1. User Sends Message

```
User messages bot in Telegram/WhatsApp
  --> Webhook Edge Function receives
  --> Verify signature/secret
  --> Enqueue to pgmq (fast, return 200)
  --> message-processor dequeues
  --> Resolve user from telegram_id/phone
  --> Context assembly pipeline builds context
  --> Agent loop processes with tools
  --> Enqueue response to outbound_messages
  --> message-sender delivers via same channel
  --> Save exchange to conversation_history
```

### 2. Stress Detected (Background)

```
Background sync writes new health data to Supabase
  --> pg_cron triggers check-triggers Edge Function
  --> Evaluates multi-signal stress gate (confidence score)
  --> If triggered: calls message-processor with trigger_type='stress_detected'
  --> Agent loop (Sonnet/Opus based on severity)
  --> Reads biometrics, calendar, generates contextual message
  --> Enqueue to outbound_messages with priority='high'
  --> message-sender delivers immediately
```

### 3. Morning Briefing (Scheduled)

```
pg_cron triggers at user's preferred time
  --> morning-brief Edge Function
  --> Agent loop (Sonnet): reads sleep, calendar, generates summary
  --> Sends via preferred channel
```

---

## Personality Configuration

Stored in `config/soul.md`, loaded into system prompt:

```
You are OneSync, a cognitive co-pilot.

Voice: Warm but not overly cheerful. Direct but caring. Like a knowledgeable
friend who happens to understand biometrics, not a clinical system.

Do:
- Use the user's name naturally (not every message)
- Reference specific data points ("Your HRV is 15% below your usual")
- Acknowledge context ("I know you have a presentation at 3pm")
- Keep messages short (2-3 sentences for proactive, longer for conversations)
- Use simple language, not medical jargon

Don't:
- Be preachy or lecture about health
- Use emojis excessively (one per message max, if any)
- Start every message with "Hey!" or "Hi there!"
- Apologize unnecessarily
- Be vague ("your vitals look off" -- instead say what specifically)
```

---

## What This Changes from the March 6 Plan

| Area | March 6 Plan | Revised (Post Agent OS Research) |
|------|-------------|----------------------------------|
| Agent loop | Simple while loop with tool_use | Layered architecture with hook pipeline, failover, dynamic tool loading |
| Context management | Stuff last 10 messages + system prompt | Context assembly pipeline with 40-60% utilization, dynamic tool/skill loading |
| Memory | Core memory (50 KV pairs) + last 10 messages | Two-tier: structured core memory + conversation summaries with compaction |
| Proactive operations | check-triggers Edge Function | Autonomous Hands pattern with multi-phase playbooks |
| Skills | Not planned | SKILL.md files for health domains (sleep, stress, nutrition, exercise) |
| Safety | System prompt instructions | Hook-based safety pipeline (pre + post reasoning) |
| Tool loading | All 18 tools always loaded | Dynamic tool loading by intent classification (5-8 tools per call) |
| Provider reliability | Single provider (Claude) | Failover chain with error classification |
| Conversation history | Raw last 10 messages | Structured compaction: summaries + recent raw messages |
| Learning | Agent updates core memory | Self-modifying memory + weekly reflection + proactive recording |
| Cost optimization | Prompt caching + model routing | + Rules-based pre-filter + dynamic tool loading + intent-based model selection |

---

## Key Dependencies

| Dependency | Purpose | Used By |
|-----------|---------|---------|
| `@sinclair/typebox` | JSON Schema type builder for tool parameter validation | Pi Mono, OpenClaw |
| `ajv` | JSON Schema validation (validate tool inputs at runtime) | Pi Mono, OpenClaw |
| `croner` | Lightweight cron scheduler (alt to pg_cron for Edge Functions) | OpenClaw |
| `partial-json` | Parse streaming incomplete JSON from Claude tool calls | Pi Mono |
| `zod` | Schema validation for config and user input | OpenClaw |

Most repos build their own agent loop rather than using LangChain/LangGraph. OneSync does the same -- direct Claude API with custom loop gives full control and transparency.

---

## Edge Functions Directory Structure

```
supabase/functions/
  telegram-webhook/index.ts     # Receives + enqueues Telegram updates
  whatsapp-webhook/index.ts     # Receives + enqueues WhatsApp updates
  message-processor/index.ts    # Dequeues, normalizes, routes to AI agent
  message-sender/index.ts       # Sends outgoing messages via adapters
  proactive-scheduler/index.ts  # Cron-triggered proactive messaging
  _shared/
    adapters/
      telegram.ts               # TelegramAdapter (uses grammY Bot.api)
      whatsapp.ts               # WhatsAppAdapter (raw fetch)
      types.ts                  # AgentMessage, IncomingMessage, etc.
    router.ts                   # MessageRouter
    formatter.ts                # Platform-specific text formatting
    security.ts                 # Signature verification helpers
    queue.ts                    # pgmq helpers
```

---

## Tiered Memory Loading (from OpenViking)

> Source: github.com/volcengine/OpenViking — 11.3k stars, by ByteDance's Volcengine team.
> Benchmark: +49% task completion, **83% reduction in input tokens** vs flat memory storage.

### The Problem OpenViking Solves (and OneSync Will Hit)

OneSync's BODY.md grows every day. After 30 days, a user's health history is thousands of tokens. Stuffing it all into every agent call wastes context and money. The solution: don't load what you don't need.

### L0/L1/L2 Tiered Context Architecture

```
L0 (~50–100 tokens) — ALWAYS loaded. One-sentence summary for quick relevance.
L1 (~300–500 tokens) — Loaded for planning/decision. Key facts and patterns.
L2 (full data)       — Loaded ON DEMAND only when agent explicitly needs detail.
```

**Applied to OneSync's BODY context:**

```
BODY_L0: "CRS: 71 (Moderate). Sleep: 6h40m. HRV trend: flat. No active stress event."
         → Always in every prompt. ~60 tokens.

BODY_L1: Today's component scores, last 3 days CRS trend, last 3 stress events,
         sleep breakdown (deep/REM/light), HRV 7-day baseline vs today.
         → Loaded for all proactive messages and conversations. ~400 tokens.

BODY_L2: Full 30-day history, all raw snapshots, all past interventions and user responses.
         → Loaded ONLY when user asks "how have I been this month?" or agent needs trend.
         → Use `get_health_history` tool to pull L2 on demand, not on every call.
```

**Applied to conversation memory:**

```
MEMORY_L0: "Last interaction: 3h ago (stress alert). User replied positively."
           → Always loaded. ~40 tokens.

MEMORY_L1: Last 7 days of key exchanges, user feedback patterns, preferences discovered.
           → Loaded for personalized responses. ~500 tokens.

MEMORY_L2: Full conversation history.
           → Retrieved only for "what did we talk about last week?" type queries.
```

### Implementation in OneSync's Supabase Schema

```sql
-- Add L0/L1 columns to core_memory (L2 is existing full text)
ALTER TABLE core_memory ADD COLUMN body_l0 text;  -- ~60 tokens, always cached
ALTER TABLE core_memory ADD COLUMN body_l1 text;  -- ~400 tokens, cached per session
-- body_l2 is the existing 'content' column, loaded on demand via tool
```

```typescript
// Context assembly: load L0 always, L1 by default, L2 only when tool is called
const systemPrompt = [
  { type: "text", text: soulMd, cache_control: { type: "ephemeral" } },        // Block 1: soul
  { type: "text", text: bodyL0 + memoryL0, cache_control: { type: "ephemeral" } }, // Block 2: L0 always
  { type: "text", text: bodyL1 + memoryL1 }                                     // Block 3: L1 per session
];
// L2 data is fetched by the get_health_history tool only when needed
```

**Token savings estimate:** Current flat approach ~2,000 tokens/call for context. Tiered approach: ~600 tokens/call (L0+L1). L2 added only ~15% of calls. Net: ~65–70% reduction in context tokens.

### OpenViking Hash Collision Warning

OpenViking discovered a real bug: hashing `user_id + agent_id` without a separator lets `("alice", "bot")` and `("aliceb", "ot")` produce identical hashes. If OneSync ever uses composite keys for agent spaces or cache keys, always include a separator: `${userId}:${agentId}`.

---

## Specialized Soul Files Per Interaction Mode (from Agency-Agents)

> Source: github.com/msitarzewski/agency-agents — 44.4k stars.
> Key insight: one monolithic system prompt is the wrong architecture when an agent has multiple distinct interaction modes.

### The Problem

OneSync's SOUL.md is one file that tries to cover: morning briefs (warm, energizing), stress alerts (calm, non-alarmist), user conversations (curious, responsive), and weekly summaries (analytical). A single personality optimized for all four ends up mediocre at each.

Agency-Agents solves this by defining each specialist as its own markdown file with: core mission, tone, workflows, and success criteria. OneSync should adopt the same pattern.

### Soul File Architecture

```
agent/souls/
  soul-base.md            → Shared identity, safety rules, "not a medical device" guardrail
  soul-morning-brief.md   → Warm, energizing, brief; "co-pilot starting your day"
  soul-stress-alert.md    → Calm, never alarmist; suggests not prescribes; one concrete action
  soul-conversational.md  → Curious, warm, responsive; remembers last exchange tone
  soul-weekly-report.md   → Analytical, honest, pattern-focused; celebrates improvements
```

**soul-base.md** (~300 tokens, always Block 1 — shared cache):
```markdown
You are OneSync, a personal health co-pilot. You read biometric signals and help
users understand their body's patterns. You suggest, never prescribe. You are not
a medical device and never diagnose. When uncertain, express uncertainty clearly.
You are concise — health insights in plain language, not jargon.
```

**soul-stress-alert.md** (~200 tokens, Block 2 — mode-specific cache, 5-min TTL):
```markdown
CONTEXT: You are sending a proactive stress alert. The user has not asked for this.
TONE: Calm, non-alarmist, warm. Like a friend who noticed something, not a warning system.
FORMAT: 2-3 sentences max. State what you noticed → what it might mean → one concrete option.
NEVER: Use words like "danger", "concerning", "urgent", "immediately".
SUCCESS: User reads it, finds it useful, not annoying. Thumbs up rate > 60%.
```

**soul-morning-brief.md** (~200 tokens):
```markdown
CONTEXT: Good morning message. User hasn't seen their data yet.
TONE: Warm, energizing, optimistic-but-honest. Like a supportive coach starting the day.
FORMAT: 3-4 sentences. Sleep quality → CRS for today → one focus or caution → encouragement.
START WITH: The most important signal, not a greeting.
SUCCESS: User feels prepared and motivated for the day. Engagement rate > 70%.
```

### Context Assembly With Soul Files

```typescript
const soulFile = getSoulFile(triggerType); // "morning-brief" | "stress-alert" | "conversational" | "weekly-report"

const systemPrompt = [
  { type: "text", text: soulBase, cache_control: { type: "ephemeral" } },    // Block 1: shared, long-lived cache
  { type: "text", text: soulFile, cache_control: { type: "ephemeral" } },    // Block 2: mode-specific, 5-min TTL
  { type: "text", text: bodyL0 + bodyL1 }                                     // Block 3: fresh data, no cache
];
```

**Why this works:** Block 1 (soul-base) is identical for all users — very high cache hit rate. Block 2 (soul-file) is identical for the same trigger type across users — still high hit rate. Only Block 3 varies per user. Total cached tokens: ~500. Fresh tokens: ~500. 50% cache ratio built-in.

---

## MixtureOfAgents for Phase 2 Morning Brief (from Swarms)

> Source: github.com/kyegomez/swarms — 5.9k stars.
> Key architecture: MixtureOfAgents (MoA) — run N specialist agents in parallel, synthesize outputs.

### Why This Matters for Phase 2

A morning brief has three genuinely separate analytical lenses: sleep recovery, HRV/stress trajectory, and circadian timing. A single Claude Haiku call handles all three for MVP — good enough. For Phase 2, the MoA pattern produces better briefs at lower cost by using cheap models for the specialist lenses and a single synthesis call.

### Phase 2 Morning Brief Architecture

```
TRIGGER: pg_cron at 7am
           │
           ├── [Parallel, Haiku 4.5]
           │    ├── Sleep Analyst: reads sleep data → "Sleep story + recovery insight" (300 tok)
           │    ├── HRV Analyst: reads HRV/stress events → "Autonomic state + stress risk" (300 tok)
           │    └── Circadian Advisor: reads wake time + CRS curve → "Peak window today" (200 tok)
           │
           └── [Sequential, Haiku 4.5]
                └── Synthesizer: takes 3 analyst outputs → composes final 3-sentence brief

Cost comparison:
  Current (1 Opus call):  ~2,500 tokens in, ~200 out = ~$0.052/brief
  MoA (3 Haiku + 1 Haiku): ~1,200 tokens in × 4 calls, ~200 out × 1 = ~$0.006/brief
  Savings: ~88% per morning brief
```

### SwarmRouter Pattern for Trigger Handling

Swarms' `SwarmRouter` concept is a clean formalization of what OneSync's `check-triggers` Edge Function already does informally. Instead of nested `if/else` on trigger types, a router table maps trigger conditions to response strategies:

```typescript
const triggerRouter = {
  "stress_alert":     { soul: "stress-alert",    model: "haiku", tools: ["get_current_biometrics", "send_message"] },
  "morning_brief":    { soul: "morning-brief",   model: "haiku", tools: ["get_sleep_summary", "get_current_biometrics", "get_current_time", "send_message"] },
  "user_reply":       { soul: "conversational",  model: "haiku", tools: ALL_TOOLS },
  "weekly_report":    { soul: "weekly-report",   model: "sonnet", tools: ["get_health_history", "send_message"] },
  "learning_message": { soul: "conversational",  model: "haiku", tools: ["get_current_biometrics", "send_message"] },
};

function routeTrigger(triggerType: string) {
  const config = triggerRouter[triggerType] ?? triggerRouter["user_reply"];
  return buildAgentCall(config);
}
```

This eliminates the hard-coded tool list problem from the current 8-MVP-tools approach — each trigger only sees the tools it needs. Reduces per-call token overhead and prevents the agent from calling irrelevant tools.

### HierarchicalSwarm Validates the "Hands" Architecture

Swarms' `HierarchicalSwarm` (director agent creates plan → worker agents execute) validates OneSync's existing "Hands" pattern from OpenFang. Each Hand (Morning Brief Hand, Stress Monitor Hand, Conversation Hand) is a Swarms-style worker with a focused scope. The `check-triggers` Edge Function is the director. This architecture is correct — keep it.

---

## NOTES & RECOMMENDATIONS

### 1. Edge Function Timeout Risk with Opus
Opus with extended thinking can take 3-15s per call. A 5-iteration loop with Opus could hit the 150s Edge Function limit. For deep analysis (weekly review, user asks for month analysis), route to a dedicated worker (Railway/Fly.io) instead of Edge Functions. Budget this for Phase 2.

### 2. The "Record First, Answer Second" Pattern
From CoPaw's research: when a user mentions health-relevant info ("I started taking magnesium", "I've been waking at 3am"), the agent should call `update_core_memory` BEFORE reasoning about the response. This ensures critical context survives conversation compaction.

### 3. Idempotent Webhook Processing
Both Telegram and WhatsApp retry failed webhooks (Telegram for 24h, WhatsApp for 7 days with backoff). The message-processor must be idempotent -- use message IDs to deduplicate. Store processed message IDs in a short-lived set (Postgres with TTL).

### 4. WhatsApp Template Approval Timeline
Templates take 24-48h for Meta review. Submit all templates in Week 1 of development. If rejected, iterate quickly. Common rejection reasons: too vague, looks promotional, missing personalization variables.

### 5. Agent Loop Observability
Log every agent invocation with: trigger type, model used, tools called, token count, response time, message delivered. Essential for debugging false alerts, tracking costs, and optimizing model routing. Use a simple `agent_logs` table with JSONB metadata.

### 6. Conversation Context Window Strategy
MVP: stuff last 5-10 raw messages. Phase 2: session summaries (Haiku summarizes each session to 2-3 sentences). Phase 3: RAG with pgvector for long-term semantic search. Don't over-engineer memory in MVP -- 5 raw messages + core memory is sufficient.

### 7. In-App Chat as Phase 2 Priority
The single highest-impact Phase 2 feature is in-app chat via Supabase Realtime. It makes OneSync a self-contained product instead of depending on Telegram/WhatsApp. Users who don't use Telegram currently have no way to interact with the agent.

### 8. Build Custom Agent Loop, Not LangChain
Every analyzed repo builds its own agent loop. Direct Claude API with tool_use gives full control, transparent debugging, and no dependency bloat. LangChain/LangGraph abstractions hide critical details and add unnecessary complexity for a serverless health agent.

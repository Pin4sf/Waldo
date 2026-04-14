# Waldo Agent OS — Comprehensive Upgrade Report

> **What this is:** A deep analysis of Claude Code's reverse-engineered architecture (1,905 TypeScript files, 213MB binary, ~10K token system prompt) combined with 2026 agent landscape research — distilled into concrete, prioritized upgrades for Waldo's Agent OS, backend infrastructure, and capabilities.
>
> **Sources:** Claude Code source code (extracted from npm `.map` leak + binary extraction), CodeCoup reverse engineering article, DeepWiki analysis (40+ pages), ccleaks.com, 3 parallel research agents covering agent frameworks, memory/state systems, and security/reliability patterns.
>
> **Date:** March 31, 2026
> **Author:** Session 4 deep research

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Claude Code Architecture — Key Findings](#2-claude-code-architecture--key-findings)
3. [Pattern-by-Pattern Analysis: Claude Code → Waldo](#3-pattern-by-pattern-analysis-claude-code--waldo)
4. [Emerging Agent Landscape (2026)](#4-emerging-agent-landscape-2026)
5. [The 15 Concrete Upgrades for Waldo](#5-the-15-concrete-upgrades-for-waldo)
6. [What NOT to Adopt (and Why)](#6-what-not-to-adopt-and-why)
7. [Updated Architecture Diagram](#7-updated-architecture-diagram)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Competitive Implications](#9-competitive-implications)

---

## 1. Executive Summary

Claude Code is a **production-grade agentic system** with 1,905 TypeScript source files running in Bun. Its architecture represents the state of the art in single-agent systems: a "dumb runtime" where intelligence is concentrated in the model, wrapped with sophisticated tooling for context management, permissions, retry logic, and multi-agent orchestration.

**Key insight:** Claude Code and Waldo solve fundamentally different problems (code editing vs health intelligence), but share the same architectural backbone: an LLM reasoning over tools in a loop with memory and context management. The patterns that make Claude Code reliable at 1M tokens of context are directly applicable to making Waldo reliable at 4K-10K tokens with a 50s timeout.

### What Waldo Already Has Right

Our architecture — designed in Sessions 1-3 from 14 production agent systems — independently converges with Claude Code on several critical patterns:

| Pattern | Claude Code | Waldo | Status |
|---------|-------------|-------|--------|
| Adapter/hexagonal architecture | Tool interface abstraction | Ports & Adapters from Day 1 | **Already aligned** |
| Cache-optimized prompt construction | Static/dynamic boundary | 25-field builder with cache zones | **Already aligned** |
| Tool result compression | maxResultSizeChars + retrieval markers | Planned ~500 token cap + markers | **Already aligned** |
| Pre-filter to skip LLM | Bash classifier for read-only ops | Rules pre-filter (60-80% skip rate) | **Already aligned** |
| Quality gates before delivery | 6-layer permission system | 10-hook pipeline with 5 quality gates | **Already aligned** |
| Error classification + fallback | 4-level retry with backoff | 4-level LLM fallback chain | **Already aligned** |
| Memory with decay | 6-layer memory, AutoDream consolidation | 3-tier with hot/warm/cold decay | **Already aligned** |
| Structured audit trail | Trace with 12+ fields | Planned agent_logs with similar fields | **Already aligned** |

### What Waldo Is Missing (The 15 Upgrades)

These are patterns from Claude Code and the 2026 agent landscape that Waldo's current architecture doesn't have:

| # | Upgrade | Source | Phase | Impact |
|---|---------|--------|-------|--------|
| 1 | Three-stage context compaction | Claude Code | D | HIGH — saves LLM calls in 50s window |
| 2 | Tool metadata classification | Claude Code | D | HIGH — enables concurrent tool execution |
| 3 | Speculative pre-computation | Claude Code + landscape | E | HIGH — Morning Wag delivered instantly |
| 4 | Memory consolidation daemon | Claude Code AutoDream | G | HIGH — memory quality compounds |
| 5 | Deferred tool discovery | Claude Code ToolSearch | Phase 2 | MEDIUM — critical at 50+ tools |
| 6 | Semantic caching | Landscape (47-73% savings) | D | HIGH — 40-60% cost reduction |
| 7 | Feature flag infrastructure | Claude Code GrowthBook | G | MEDIUM — enables A/B testing |
| 8 | Structured error taxonomy | Claude Code | D | MEDIUM — better retry decisions |
| 9 | Agent trace protocol | Claude Code + Langfuse | D | MEDIUM — observability from day 1 |
| 10 | Thinking/reasoning tokens | Claude Code extended thinking | Phase 2 | MEDIUM — better complex reasoning |
| 11 | Model routing intelligence | Landscape (30-50% savings) | Phase 2 | HIGH — right model for right task |
| 12 | Guardrails framework integration | Landscape (NeMo/Guardrails AI) | D | MEDIUM — defense in depth |
| 13 | Agent evaluation harness | Landscape (quality = #1 barrier) | G | HIGH — systematic quality measurement |
| 14 | Proactive context pre-loading | Claude Code + original | E | HIGH — latency reduction |
| 15 | Streaming delivery | Claude Code streaming | D | MEDIUM — perceived speed improvement |
| 16 | Waldo as MCP server | Landscape (MCP = universal tool layer) | Phase 2 | STRATEGIC — biological intelligence as a service |
| 17 | Evolution dual audit | Landscape (self-evolving agents) | Phase 2 | MEDIUM — prevents evolution regressions |
| 18 | 4-tier memory (add procedural) | Landscape (Letta/MemGPT) | D | LOW — cleaner architecture, minimal effort |

---

## 2. Claude Code Architecture — Key Findings

### 2.1 The Binary

- **213 MB** single executable (Bun + JavaScriptCore runtime)
- **9.88 MB** of application code across **7,493 lines** (minified)
- **1,884 TypeScript source files** (leaked via npm `.map` file)
- **192 npm dependencies**
- **~10,000+ tokens** of system prompt consumed before the user says anything

### 2.2 The Core Loop (TAOR Pattern)

Claude Code implements **Think-Act-Observe-Repeat** in ~50 lines of orchestration code. The runtime is intentionally "dumb" — all intelligence lives in the model.

```
User prompt → System prompt assembly → API call → Tool detection → Permission check
  → Tool execution (concurrent reads, serial writes) → Result fed back → Compaction check
  → Next iteration OR terminal
```

**Key design philosophy:** "The architecture intentionally shrinks as models improve — hard-coded scaffolding gets deleted with model upgrades, making the harness thinner over time."

**Waldo implication:** Our 3-iteration ReAct loop in Edge Functions is conceptually identical but with tighter constraints (50s timeout, stateless). The philosophy of keeping the runtime thin and concentrating intelligence in the model validates our approach of not adopting heavy frameworks like LangGraph.

### 2.3 System Prompt Architecture

The system prompt is **dynamically assembled from 110+ conditional components** using a boundary marker (`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`) to separate cache-eligible static content from session-specific dynamic content.

**15+ modular sections** including:
- Identity layer (who Claude is)
- Tone/style guidelines
- Tool usage policies with examples
- Hardcoded security rules
- Dynamic environment context (cwd, git status, platform)
- CLAUDE.md project instructions (injected as `<system-reminder>` tags)

**Prompt engineering techniques discovered:**
1. **XML-tagged semantic sections** — `<system-reminder>`, `<good-example>`, `<bad-example>`
2. **Emphasis-driven constraints** — ALL CAPS and "IMPORTANT:" for critical rules ("shouting remains the most effective prompt technique")
3. **Sandwich defense** — Critical instructions before AND after user content
4. **Cache boundary isolation** — Changing data in user message, not system prompt
5. **Few-shot heuristic training** — Good/bad example pairs for behavioral calibration

**Waldo already does:** Cache-optimized assembly (system vs user message split), sandwich defense, dynamic tool loading. **New learnings:** The XML-tagged section approach and emphasis-driven constraints for soul files.

### 2.4 Tool System

~50 built-in tools with rich metadata per tool:

```typescript
Tool {
  name, description, inputSchema (Zod),
  call(), validateInput(), checkPermissions(),
  isReadOnly: boolean,      // Can run concurrently
  isDestructive: boolean,   // Requires confirmation
  isConcurrencySafe: boolean, // Safe for parallel execution
  maxResultSizeChars: number, // Size cap before compression
  shouldDefer: boolean,     // Lazy-load schema
  renderToolUseMessage(),   // UI rendering
  renderToolResultMessage()
}
```

**Concurrent execution model:**
1. Partition tool calls by safety: read-only tools run in parallel (up to 10)
2. Write/destructive tools run serially
3. Context modifiers applied between batches

**Waldo implication:** Our 8 MVP tools should adopt this metadata classification. `get_crs`, `get_sleep`, `get_activity`, `get_stress_events`, `read_memory`, `get_user_profile` are all read-only and can run in parallel. `send_message` and `update_memory` must be serial. This could cut iteration time by 50-70% when multiple reads are needed.

### 2.5 Context Management (Three-Stage Compaction)

This is one of Claude Code's most sophisticated subsystems:

**Stage 1 — Micro-compaction (no LLM call):**
- Prune duplicate file read results
- Truncate verbose tool outputs (preserve trailing lines)
- Rule-based, zero cost, runs on every turn

**Stage 2 — Session memory extraction:**
- Extract structured facts (project structure, user preferences, task progress)
- Persist to `.claude/memory/` directory
- No full LLM call — uses targeted extraction
- Tracked via `lastSummarizedMessageId`

**Stage 3 — Full LLM compaction:**
- Separate API call to summarize conversation
- 9-section structured summary (Primary Request, Technical Concepts, Files/Code, Errors/Fixes, Problem Solving, User Messages, Pending Tasks, Current Work, Next Steps)
- Creates "Context Boundary" — LLM sees only post-boundary messages
- Only triggered when Stages 1-2 are insufficient

**Waldo implication:** HIGH VALUE. Within our 50s Edge Function timeout, we can't afford a full compaction LLM call. But Stage 1 (micro-compaction) is free and directly applicable:
- Prune duplicate health data (if same snapshot queried twice)
- Truncate verbose tool outputs to ~500 tokens
- Remove stale conversation turns that add no new information

Stage 2 (session memory extraction) maps to our planned `update_memory` tool — the agent extracts and persists important facts during conversation.

### 2.6 Memory System (6 Layers)

Claude Code loads context at session start in priority order:

| Layer | Claude Code | Waldo Equivalent |
|-------|------------|-----------------|
| 1. Organization policies | Enterprise-managed | N/A (consumer app) |
| 2. Project config | CLAUDE.md in repo root | Soul files + safety rules |
| 3. User preferences | ~/.claude/CLAUDE.md | User profile + preferences |
| 4. Auto-learned patterns | MEMORY.md (auto-memory) | core_memory.recent_insights |
| 5. Session state | Session memory | Conversation history |
| 6. Active transcript | Current conversation | Current conversation |

**AutoDream (Memory Consolidation) — 4 Phases:**
1. **Orient** — Scan memory directory, read index, skim files to avoid duplicates
2. **Gather Signal** — Targeted search for corrections, patterns, decisions (NOT all transcripts)
3. **Consolidate** — Convert relative→absolute dates, remove contradictions, prune stale entries, merge overlaps
4. **Prune and Index** — Update index file, keep under 200 lines, resolve conflicts

**Trigger conditions:** Dual-gate (24h since last consolidation AND 5+ sessions since last). Lock file prevents concurrent runs.

**Waldo implication:** Our `weekly_compaction` via pg_cron (Sunday evening) is a simpler version of AutoDream. The key learning is the **dual-gate trigger** — consolidation should require both time elapsed AND sufficient new data, not just one. Also, the **4-phase structure** is more rigorous than our current "review session summaries → promote patterns" plan.

### 2.7 Sub-Agent Architecture

Three spawn modes:
- **Fork:** Fresh message array, shared file cache (cheapest)
- **In-process:** Same process, async context, shared state
- **Remote:** HTTP/JWT bridge to separate instance

Three built-in variants:
- **Explore:** Haiku model, read-only tools — for research
- **Plan:** Inherited model, research-focused — for planning
- **General:** Full tool access — for complex operations

**Coordinator mode:** Parent decomposes tasks → delegates to workers → monitors → aggregates. Workers communicate via `<task-notification>` XML with status, summary, result, usage.

**Waldo implication:** Not needed for MVP (single agent). But for Phase 3 (Autonomous Personal OS), this is exactly the pattern:
- **Sleep specialist** (Explore-equivalent) — read-only, analyzes sleep patterns
- **Productivity specialist** — reads calendar + tasks, suggests scheduling
- **Research specialist** — web search, data analysis
- **Coordinator (Waldo core)** — delegates to specialists, aggregates, delivers

### 2.8 Permission System (6 Modes)

| Mode | Behavior | Waldo Equivalent |
|------|----------|-----------------|
| `plan` | Read-only | Morning Wag (limited tools) |
| `default` | Ask before modifications | User chat (full tools) |
| `acceptEdits` | Auto-approve edits | N/A |
| `dontAsk` | Skip prompts for whitelisted | Fetch Alert (pre-approved tools) |
| `auto` | ML classifier decides | Future: evolution-based |
| `bypass` | Full delegation | N/A (health data = never bypass) |

**Waldo implication:** Our per-trigger tool permissions are a simpler, health-appropriate version. The key insight is formalizing this as named **permission modes** rather than ad-hoc tool lists per trigger:

```typescript
const PERMISSION_MODES = {
  morning_wag: { tools: ['get_crs', 'get_sleep', 'get_activity', 'send_message'], maxIterations: 2 },
  fetch_alert: { tools: ['get_crs', 'get_stress_events', 'read_memory', 'send_message'], maxIterations: 2 },
  user_chat: { tools: ALL_TOOLS, maxIterations: 3 },
  baseline_update: { tools: ['get_crs', 'get_sleep', 'get_activity'], maxIterations: 1, noLLM: true },
} as const;
```

### 2.9 Speculation System

Claude Code's most novel feature — **speculative pre-execution:**

1. Claude finishes responding with a suggestion
2. Without waiting for acceptance, forks a background API call
3. Speculative writes redirect to overlay filesystem (copy-on-write)
4. Accept → overlay files copy to real filesystem
5. Reject → overlay deleted, zero side effects

**Safety:** Max 20 tool-use turns, max 100 messages, writes outside cwd denied, hard boundaries on Bash.

**Recursive pipelining:** Once one speculation completes, immediately starts the next — chained execution without user intervention.

**Waldo adaptation — Speculative Pre-computation:**

Instead of speculative code editing, Waldo can speculatively pre-compute:

```
4:00 AM: Baseline Updater Hand fires (no LLM, pure compute)
  → Speculatively: Start computing Morning Wag context
  → Pre-load: CRS, sleep analysis, weather, calendar (if available)
  → Cache result in temp storage with TTL

User wakes (detected via activity data spike):
  → Morning Wag Hand fires
  → Pre-computed context is warm — skip 2-3 tool calls
  → Claude gets context immediately → response in <5s instead of <15s
  → If pre-computed data is stale (>30 min), refresh only delta
```

This is HIGH VALUE for perceived responsiveness. The Morning Wag that arrives within seconds of waking feels like magic.

### 2.10 Error Handling & Retry

**Retry strategy:**
- Max 10 retries (customizable)
- 500ms base delay with exponential backoff
- Max 3 consecutive 529 (overloaded) errors
- 429/529 detection and differentiation
- OAuth token refresh on 401/403
- Stale connection (ECONNRESET/EPIPE) handling
- Fast mode fallback on rate limits

**Error taxonomy:**
- **Transient:** Network, rate limit, server overload → retry with backoff
- **Permanent:** Auth failure, invalid input, model error → immediate fallback
- **Capacity:** 429/529 → switch to smaller model or template

**Waldo implication:** Our 4-level fallback chain is good but lacks error classification. We should classify errors before choosing the fallback level:

```typescript
type AgentError =
  | { type: 'transient'; code: 'NETWORK' | 'TIMEOUT' | 'RATE_LIMIT'; retryAfterMs: number }
  | { type: 'capacity'; code: 'OVERLOADED' | 'QUOTA_EXCEEDED'; fallbackLevel: 2 | 3 }
  | { type: 'permanent'; code: 'AUTH' | 'INVALID_INPUT' | 'SAFETY'; fallbackLevel: 3 | 4 }
  | { type: 'unknown'; raw: Error; fallbackLevel: 3 };
```

### 2.11 Telemetry & Feature Flags

**"Tengu" system** (Claude Code's internal codename) manages **37 feature flags** and **~560 telemetry events**.

- **GrowthBook** for runtime feature gating
- **Statsig** fallback
- **OpenTelemetry** for metrics (token counters, cost counters, duration)
- **Datadog** for observability
- Flag naming: Random word pairs to obscure purpose (`tengu_frond_boric`)

**Waldo implication:** We don't need 37 feature flags for MVP. But a lightweight system for Phase G is critical:

```typescript
// Minimal feature flags for Waldo
const FLAGS = {
  soul_variant: 'A' | 'B',           // A/B test soul file variants
  evolution_enabled: boolean,          // Enable/disable self-evolution
  constellation_enabled: boolean,      // Phase 2 feature gate
  verbose_logging: boolean,            // Debug mode
  max_daily_messages: number,          // Tunable limit
  pre_filter_threshold: number,        // CRS threshold for skip
} as const;
```

Store in Supabase `feature_flags` table. Load at Edge Function start. No external service needed.

---

## 3. Pattern-by-Pattern Analysis: Claude Code → Waldo

### Patterns to ADOPT (Validated by Claude Code + Landscape Research)

#### 3.1 Three-Stage Compaction (Phase D — HIGH PRIORITY)

**What Claude Code does:** Micro-compaction (free) → Session memory (cheap) → Full LLM compaction (expensive). Only escalates when cheaper stages fail.

**What Waldo should do:**

```
Stage 1 — Micro-compaction (pre-reasoning hook, no LLM):
  ├── Deduplicate: If get_sleep called twice, keep only latest result
  ├── Truncate: Tool outputs >500 tokens → compress + retrieval marker
  ├── Prune: Conversation turns older than token budget → remove
  └── Cost: Zero. Run on every invocation.

Stage 2 — Fact extraction (post-reasoning hook):
  ├── Agent calls update_memory for important facts during conversation
  ├── Session summary auto-generated for conversations >5 messages
  └── Cost: Part of normal agent loop (no extra LLM call)

Stage 3 — Weekly compaction (pg_cron, Sunday, uses LLM):
  ├── Review week's session summaries
  ├── Consolidate patterns → promote to core_memory
  ├── Resolve contradictions (newer data wins)
  └── Cost: 1 LLM call/week/user
```

**Implementation:** Add micro-compaction to Hook 4 (COMPACTION) in pre-reasoning pipeline. This is the single highest-ROI change for context efficiency.

#### 3.2 Tool Metadata & Concurrent Execution (Phase D — HIGH PRIORITY)

**What Claude Code does:** Each tool declares `isReadOnly`, `isConcurrencySafe`. Read-only tools execute in parallel. Writes are serial.

**What Waldo should do:**

```typescript
// src/types/tools.ts
interface WaldoTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  call: (input: TInput, context: ToolContext) => Promise<TOutput>;

  // NEW — from Claude Code
  isReadOnly: boolean;        // true = can run concurrently
  maxResultTokens: number;    // compress output if exceeded
  permissionModes: PermissionMode[]; // which triggers can use this tool
}

// Tool classification for Waldo's 8 MVP tools:
const TOOL_METADATA = {
  get_crs:            { isReadOnly: true,  maxResultTokens: 200,  permissionModes: ['*'] },
  get_sleep:          { isReadOnly: true,  maxResultTokens: 400,  permissionModes: ['*'] },
  get_stress_events:  { isReadOnly: true,  maxResultTokens: 300,  permissionModes: ['fetch_alert', 'user_chat'] },
  get_activity:       { isReadOnly: true,  maxResultTokens: 300,  permissionModes: ['*'] },
  get_user_profile:   { isReadOnly: true,  maxResultTokens: 150,  permissionModes: ['*'] },
  read_memory:        { isReadOnly: true,  maxResultTokens: 200,  permissionModes: ['*'] },
  update_memory:      { isReadOnly: false, maxResultTokens: 100,  permissionModes: ['user_chat'] },
  send_message:       { isReadOnly: false, maxResultTokens: 50,   permissionModes: ['*'] },
} as const;
```

**Execution engine:**

```typescript
async function executeToolBatch(toolCalls: ToolCall[], context: ToolContext) {
  const readOnly = toolCalls.filter(tc => TOOL_METADATA[tc.name].isReadOnly);
  const writes = toolCalls.filter(tc => !TOOL_METADATA[tc.name].isReadOnly);

  // Run all reads concurrently
  const readResults = await Promise.all(
    readOnly.map(tc => executeToolCall(tc, context))
  );

  // Run writes serially
  const writeResults = [];
  for (const tc of writes) {
    writeResults.push(await executeToolCall(tc, context));
  }

  return [...readResults, ...writeResults];
}
```

**Impact:** In a typical Morning Wag, Claude calls `get_crs`, `get_sleep`, `get_activity` in one iteration. Today: ~3 sequential Supabase queries (~900ms). With concurrency: ~300ms. That's 600ms saved per invocation — significant in a 50s timeout.

#### 3.3 Semantic Caching Layer (Phase D — HIGH PRIORITY)

**What the landscape shows:** Semantic caching (cache responses for semantically similar queries) is now a production pattern used by Helicone, Portkey, and several enterprise agent deployments. 40-60% cache hit rates are common for repetitive agent interactions.

**What Waldo should do:**

Morning Wags and Fetch Alerts are highly repetitive in structure. The prompt varies mainly in biometric values, not in structure. This makes them perfect for semantic caching:

```typescript
// Semantic cache for agent responses
// Key: hash of (trigger_type + crs_zone + data_confidence + personality_zone)
// Value: Claude's response template with variable slots

// Example: If CRS is in STEADY zone (60-79) for a morning_wag trigger with HIGH data confidence
// and we've seen this pattern 50+ times → use cached response structure, only fill in specific numbers

interface SemanticCacheEntry {
  key: string;           // hash of structural parameters
  responsePattern: string; // Response with {{crs}}, {{sleep_hours}} etc. placeholders
  hitCount: number;
  lastUsed: string;
  avgUserSatisfaction: number; // Track if cached responses get good feedback
  ttl: number;           // Invalidate after N days
}
```

**Conservative approach:** Don't cache the full response. Cache the **response structure** and use it to pre-fill a template that Claude then personalizes. This gives speed without sacrificing personalization:

1. Check cache for (trigger_type + zone + confidence) combination
2. If hit: Send Claude the cached structure as a "suggested format" in the prompt
3. Claude personalizes with fresh data but follows the validated structure
4. Response is faster (Claude writes less) and more consistent

**Impact:** Estimated 30-40% reduction in output tokens for repetitive triggers. At scale, this compounds significantly.

#### 3.4 Speculative Pre-computation (Phase E — HIGH PRIORITY)

**Adapted from Claude Code's speculation system for health agent use case.**

```
Timeline of a Morning Wag with pre-computation:

03:30  pg_cron fires baseline updater
       └── Speculatively: pre-compute Morning Wag context
           ├── Compute CRS from overnight data
           ├── Fetch weather + AQ forecast
           ├── Read calendar (if CalendarProvider available)
           ├── Read core_memory (recent insights, pending followups)
           └── Store pre-computed bundle: { crs, sleep, weather, calendar, memory }
               with TTL: 60 minutes

06:45  Activity spike detected (user waking)
       └── Morning Wag Hand fires
           ├── Check pre-computed bundle → FRESH (computed 3h15m ago? TTL expired)
           │   └── If stale: only refresh CRS + sleep (weather/calendar still valid)
           │   └── If fresh: use directly
           ├── Build prompt with pre-loaded context
           ├── Claude call with 80% less tool calls needed
           └── Deliver Morning Wag in <5 seconds

vs. WITHOUT pre-computation:

06:45  Activity spike detected
       └── Morning Wag Hand fires
           ├── Compute CRS → 200ms
           ├── Query sleep data → 300ms
           ├── Query activity → 300ms
           ├── Fetch weather → 500ms
           ├── Read memory → 200ms
           ├── Read calendar → 300ms
           ├── Claude call (all tools loaded) → 3-8s
           └── Deliver Morning Wag in 5-12 seconds
```

**Implementation:** A `pre_compute_cache` table in Supabase with user_id, trigger_type, payload (JSONB), computed_at, ttl_minutes. The baseline updater pg_cron job populates it. The Morning Wag Hand reads from it first.

#### 3.5 Memory Consolidation Daemon (Phase G — HIGH PRIORITY)

**Adapted from Claude Code's AutoDream pattern.**

```
Waldo Memory Consolidation (weekly, via pg_cron):

Phase 1 — Orient:
  ├── Read core_memory for user
  ├── Count session_summaries since last consolidation
  └── Gate check: ≥3 sessions AND ≥7 days since last → proceed

Phase 2 — Gather Signal:
  ├── Read all session summaries since last consolidation
  ├── Extract: corrections ("too clinical"), preferences ("I like X"), patterns ("always Y")
  ├── Cross-reference: user feedback signals (👍/👎/dismissal)
  └── Flag: contradictions with existing core_memory

Phase 3 — Consolidate:
  ├── Promote validated patterns (3+ confirmations) to core_memory.recent_insights
  ├── Update preferences that were explicitly corrected
  ├── Decay: unvalidated insights older than 30 days → move to cold
  ├── Resolve: if new data contradicts old insight → newer wins, mark old as superseded
  └── Generate: evolution entries from accumulated feedback signals

Phase 4 — Prune and Index:
  ├── Keep core_memory under 200 tokens (priority-ranked)
  ├── Archive old session summaries (keep only last 4 weeks in hot storage)
  ├── Update agent_evolutions table with new entries
  └── Log consolidation summary to agent_logs
```

**Dual-gate trigger (from Claude Code):** Both conditions must be true:
- ≥7 days since last consolidation
- ≥3 sessions since last consolidation

This prevents running on inactive users (waste) and prevents running too frequently on active users (churn).

#### 3.6 Structured Error Taxonomy (Phase D)

```typescript
// Adapted from Claude Code's error classification
type AgentError =
  | { type: 'transient'; code: 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMIT_429'; retryable: true; backoffMs: number }
  | { type: 'capacity'; code: 'OVERLOADED_529' | 'QUOTA_EXCEEDED'; retryable: true; fallbackLevel: 2 | 3 }
  | { type: 'auth'; code: 'API_KEY_INVALID' | 'JWT_EXPIRED'; retryable: false; fallbackLevel: 4 }
  | { type: 'safety'; code: 'CONTENT_FILTERED' | 'PROMPT_INJECTION'; retryable: false; fallbackLevel: 3 }
  | { type: 'data'; code: 'INSUFFICIENT_DATA' | 'STALE_DATA'; retryable: false; fallbackLevel: 3 }
  | { type: 'budget'; code: 'DAILY_COST_EXCEEDED' | 'USER_CAP_HIT'; retryable: false; fallbackLevel: 3 };

function handleAgentError(error: AgentError): FallbackAction {
  switch (error.type) {
    case 'transient':
      // Retry with exponential backoff (max 3 within 50s timeout)
      return { action: 'retry', delayMs: error.backoffMs, maxRetries: 3 };
    case 'capacity':
      // Skip to reduced context or template
      return { action: 'fallback', level: error.fallbackLevel };
    case 'auth':
      // Log alert, use template, notify admin
      return { action: 'fallback', level: 4, alert: true };
    case 'safety':
      // Log the attempt, use safe template
      return { action: 'fallback', level: 3, logSecurityEvent: true };
    case 'data':
      // Use degraded personality zone, acknowledge missing data
      return { action: 'degraded', zone: 'CRISIS_NO_DATA' };
    case 'budget':
      // Template only, no LLM
      return { action: 'fallback', level: 3 };
  }
}
```

#### 3.7 Agent Trace Protocol (Phase D)

**Adapted from Claude Code's structured trace + OpenTelemetry patterns.**

```typescript
interface WaldoTrace {
  // Identity
  trace_id: string;          // UUID, groups all actions in one invocation
  user_id: string;
  session_id: string | null; // null for proactive triggers

  // Trigger
  trigger_type: 'morning_wag' | 'fetch_alert' | 'user_message' | 'baseline_update';
  trigger_reason: string;    // "pg_cron_schedule" | "stress_confidence_0.85" | "user_text"

  // Context at invocation time
  crs_at_trigger: number | null;
  personality_zone: 'ENERGIZED' | 'STEADY' | 'FLAGGING' | 'DEPLETED' | 'CRISIS';
  data_confidence: 'high' | 'moderate' | 'low' | 'degraded';
  permission_mode: string;

  // Execution
  pre_filter_result: 'passed' | 'skipped_normal' | 'skipped_cooldown' | 'skipped_cost';
  llm_called: boolean;
  llm_fallback_level: 1 | 2 | 3 | 4;
  iterations: number;
  tools_called: string[];    // tool names only, no health data
  tools_blocked: string[];   // tools that failed permission check

  // Quality gates
  quality_gates: Array<{ gate: string; passed: boolean; reason?: string }>;

  // Performance
  total_tokens_in: number;
  total_tokens_out: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  tool_latency_ms: Record<string, number>;

  // Delivery
  delivery_status: 'sent' | 'fallback_sent' | 'suppressed' | 'failed';
  delivery_channel: string;

  // Semantic cache
  semantic_cache_hit: boolean;
  semantic_cache_key: string | null;

  // Error (if any)
  error: AgentError | null;
}
```

Store in `agent_logs` table. This is our observability foundation — from day 1, every invocation is traceable.

#### 3.8 Deferred Tool Discovery (Phase 2)

**What Claude Code does:** At startup, only sends essential tool schemas. Other tools are represented as one-line summaries. When the model needs a capability, it calls `ToolSearch` to load the full schema.

**What Waldo should do (at 50+ tools):**

```typescript
// Instead of sending 50 tool schemas to Claude (huge token cost):
// Send a capability manifest + discovery tool

const TOOL_DISCOVERY = {
  name: 'discover_tools',
  description: 'Search for available tools by capability. Returns full schema for matching tools.',
  inputSchema: z.object({
    query: z.string().describe('What capability you need, e.g. "check calendar" or "play music"'),
  }),
};

const CAPABILITY_MANIFEST = `
Available tool categories:
- Health: CRS, sleep analysis, stress events, activity data, HRV trends
- Memory: Read/write user memory, session history, pattern log
- Calendar: Today's events, upcoming meetings, schedule conflicts
- Tasks: Task list, completion status, priority ranking
- Communication: Send message, set status
- Music: Current mood score, listening patterns
- Screen: Digital hygiene metrics, focus sessions
Use discover_tools to get full schemas for the tools you need.
`;
```

**Impact at scale:** 50 tool schemas × ~100 tokens each = 5,000 tokens saved per invocation. At our cost model, this is significant.

#### 3.9 Feature Flag System (Phase G)

```sql
-- Lightweight feature flags in Supabase
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value JSONB NOT NULL,      -- can be boolean, number, string, object
  user_segment TEXT DEFAULT '*',   -- '*' for all, 'beta', 'internal', specific user_id
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Load flags at Edge Function start (cached 5 min)
-- No external service. No SDK. Just a Supabase query.
```

**Use cases:**
- A/B test soul file variants (50% get variant A, 50% get variant B)
- Gradual rollout of self-evolution (start with 10% of users)
- Tune pre-filter threshold per user segment
- Enable/disable Constellation features for beta users
- Emergency kill switch for any feature

### Patterns to OBSERVE (From 2026 Landscape)

#### 3.10 Model Routing Intelligence

The landscape is converging on **smart model routing** — using a fast classifier to route requests to the right model:

```
Simple greeting → Haiku (cheapest, fastest)
Sleep question with personal context → Haiku + full context
Complex multi-day pattern analysis → Sonnet (better reasoning)
Constellation query (weeks of data) → Sonnet with extended thinking
Emergency detection → Instant template (no LLM)
```

**Waldo approach for Phase 2:**

```typescript
type ModelRoute = {
  model: 'haiku' | 'sonnet';
  contextLevel: 'L0' | 'L0+L1' | 'L0+L1+L2';
  maxIterations: 1 | 2 | 3;
  thinking: boolean;
};

function routeRequest(trigger: TriggerType, complexity: number): ModelRoute {
  // Phase 2: Add Sonnet for complex reasoning
  if (trigger === 'constellation_query') return { model: 'sonnet', contextLevel: 'L0+L1+L2', maxIterations: 3, thinking: true };
  if (trigger === 'user_chat' && complexity > 0.7) return { model: 'sonnet', contextLevel: 'L0+L1', maxIterations: 3, thinking: false };
  // Default: Haiku for everything else
  return { model: 'haiku', contextLevel: 'L0+L1', maxIterations: 3, thinking: false };
}
```

#### 3.11 Guardrails Framework

Beyond our current health language safety hook, the landscape shows two approaches:

1. **NeMo Guardrails (NVIDIA):** Declarative YAML policies, runtime enforcement, multi-model
2. **Guardrails AI:** Schema-based output validation with automatic retry

**Waldo approach:** Our Hook 6 (health language safety) is already a custom guardrail. For Phase D, consider wrapping it in a more formal structure:

```typescript
interface Guardrail {
  name: string;
  check: (response: string, context: AgentContext) => GuardrailResult;
  severity: 'block' | 'warn' | 'rewrite';
  maxRetries: number;
}

const WALDO_GUARDRAILS: Guardrail[] = [
  { name: 'medical_claims', check: checkMedicalClaims, severity: 'block', maxRetries: 2 },
  { name: 'health_language', check: checkHealthLanguage, severity: 'rewrite', maxRetries: 2 },
  { name: 'confidence_check', check: checkConfidence, severity: 'warn', maxRetries: 1 },
  { name: 'prompt_injection', check: checkPromptInjection, severity: 'block', maxRetries: 0 },
  { name: 'pii_leakage', check: checkPIILeakage, severity: 'block', maxRetries: 0 },
];
```

#### 3.12 Agent Evaluation Harness (Phase G)

The landscape shows agent evaluation is maturing fast. Key frameworks: Braintrust, Langfuse Scores, custom harnesses.

**Waldo should build:**

```typescript
// Golden test suite for agent behavior
interface AgentTestCase {
  id: string;
  name: string;
  trigger: TriggerType;
  userContext: Partial<UserProfile>;
  healthData: HealthSnapshot;
  expectedBehavior: {
    shouldCallTools: string[];
    responseShouldContain: string[];
    responseShouldNotContain: string[];
    personalityZone: PersonalityZone;
    maxTokens: number;
    maxLatencyMs: number;
  };
}

// Example test cases:
const GOLDEN_TESTS: AgentTestCase[] = [
  {
    id: 'morning-wag-depleted',
    name: 'Morning Wag when CRS is 34',
    trigger: 'morning_wag',
    healthData: { crs: 34, sleepHours: 4.2, hrvRmssd: 22 },
    expectedBehavior: {
      personalityZone: 'DEPLETED',
      responseShouldContain: ['rough night', 'take it easy'],
      responseShouldNotContain: ['optimize', 'hustle', 'you should exercise'],
      maxTokens: 200, // DEPLETED = minimal
    },
  },
  {
    id: 'fetch-alert-false-positive',
    name: 'Stress alert with low confidence should not fire',
    trigger: 'fetch_alert',
    healthData: { crs: 72, stressConfidence: 0.25 },
    expectedBehavior: {
      shouldCallTools: [], // Pre-filter should skip
      deliveryStatus: 'suppressed',
    },
  },
];
```

Run this suite after every soul file change, every evolution parameter update, every prompt modification. This is how we prevent regressions.

**Tool recommendation: Promptfoo** (MIT, open-source, used by OpenAI and Anthropic internally). Enables golden test suites, adversarial prompt batteries, and CI/CD blocking on regression. Strongly recommended for Phase D onward.

### Patterns from Deep Research Agents (Memory, Security, Cost)

Three parallel research agents produced detailed reports. Key findings not already covered above:

#### Security: The "Lethal Trifecta" (Simon Willison)

Waldo has **all three factors** that make prompt injection dangerous:
1. **Private data access** — health metrics, HRV, sleep, stress scores
2. **Untrusted input** — Telegram messages from users (attack surface)
3. **Exfiltration vector** — `send_message` tool can transmit data externally

**New defense: LlamaFirewall AlignmentCheck** (Meta) — A lightweight chain-of-thought auditor that reviews the agent's tool_use decisions before execution. Reduced attack success from 17.6% to 1.7% in benchmarks. Waldo adaptation: use Haiku to self-audit `update_memory` and `send_message` calls (~$0.001/check). Add to Phase D security layer.

**OWASP Top 10 for Agentic Applications (2026):**
- ASI01 Goal Hijacking — HIGH priority for Waldo (Telegram is untrusted input)
- ASI02 Tool Misuse — HIGH (send_message can exfiltrate, update_memory can be poisoned)
- ASI06 Memory Poisoning — HIGH (adversarial messages designed to corrupt core_memory)

**Input sanitization beyond template wrapping:** Strip zero-width Unicode characters, base64 blocks, and emoji-encoded payloads from Telegram messages before feeding to Claude.

#### Memory: Compare-and-Swap + Sleep-Time Compute

**Compare-and-swap on memory writes:** When two concurrent triggers (pg_cron + user message) both try to update core_memory, the second write can clobber the first. Solution: version field on core_memory, reject writes where version doesn't match (optimistic locking).

**Sleep-time compute (Letta pattern):** Background agent consolidates memory during idle hours — NOT during user interaction. Maps perfectly to Waldo's Patrol concept:

```
2:00 AM: Patrol Agent fires (pg_cron)
  ├── Consolidate: review last 7 days of session summaries
  ├── Extract: patterns, preference corrections, evolution signals
  ├── Update: core_memory with validated insights
  ├── Compute: updated baselines, predicted next-day CRS range
  └── Pre-stage: Morning Wag context bundle
No user interaction. No latency impact. Memory quality improves overnight.
```

**Bi-temporal knowledge graph (Zep, arXiv):** Facts have validity windows — "user takes magnesium" is true from date X until explicitly changed. For Constellations (Phase 2), this is the right architecture for tracking health patterns over months.

**Meta PAHF paper (Feb 2026):** BOTH pre-action clarification AND post-action feedback are needed for optimal personalization. Waldo should:
- Pre-action: "I noticed your HRV dropped — is this related to last night? (yes/no/don't know)" → calibrates before acting
- Post-action: "Was this morning's briefing useful? (thumbs up/down)" → improves future behavior

#### Cost: Even Cheaper Than We Thought

**Updated cost estimate with all optimizations: $0.01-0.03/user/day ($0.30-0.90/month)** — better than our original $0.05-0.15 estimate.

Key optimizations identified:
- **Markdown over JSON** saves 34% tokens. **CSV over JSON** saves 40-50% for tabular health data. Use markdown for Claude, CSV for health snapshots.
- **Anthropic Batch API** (50% discount, 24h turnaround) is perfect for nightly Constellation analysis in Phase G — non-urgent multi-day pattern analysis at half price.
- **"Poor man's circuit breaker"** for stateless Edge Functions: Instead of Redis, query `agent_logs` for recent failures. If >3 failures in last 5 minutes for this user → skip to template fallback. Costs one Supabase query instead of adding Redis infrastructure.

#### Evaluation: Promptfoo + Continuous Red-Teaming

**Promptfoo** (MIT, open-source) strongly recommended for Phase D:
- Define golden test suites for soul file variants
- Run adversarial prompt injection batteries
- CI/CD blocking — fail deploy if quality regresses
- Used internally by OpenAI and Anthropic

**Red-teaming should be continuous:** After every soul file change, tool schema change, and weekly automated adversarial battery. Not periodic.

#### Observability: Enhanced Trace Fields

Add to the WaldoTrace protocol:
```typescript
// Additional fields from security/reliability research
input_tokens: number;
cached_tokens: number;
output_tokens: number;
sanitization_flags: string[];       // What was stripped from input
circuit_breaker_state: 'closed' | 'open' | 'half_open';
prompt_template_version: string;     // Track which soul file version
time_to_first_token_ms: number;      // Latency breakdown
fallback_metadata?: { level: number; reason: string; degraded: boolean };
```

---

## 4. Emerging Agent Landscape (2026)

The agent ecosystem in 2026 is exploding. The global agent market reached **$7.84 billion in 2025** and is projected to hit **$52.62 billion by 2030** (CAGR 46.3%). Gartner predicts **40% of enterprise applications** will feature task-specific AI agents by end of 2026, up from <5% in 2025. 57% of organizations already have agents in production (LangChain State of AI Agents 2026).

### 4.1 Agent Frameworks — The Landscape Has Converged

| Framework | Stars/Downloads | Strength | Waldo Relevance |
|-----------|----------------|----------|----------------|
| **LangGraph** | 24.8K stars, 34.5M downloads | Enterprise production, persistence | LOW — Python, too heavy for Edge Functions |
| **OpenAI Agents SDK** | 19K stars, 10.3M downloads | Multi-agent, tracing, guardrails, provider-agnostic | MEDIUM — patterns worth studying, not adopting |
| **Mastra** | Growing fast | TypeScript-first, visual debugging, MCP-native | MEDIUM — closest to our stack, evaluate in Phase 2 |
| **CrewAI** | Popular | Role-based multi-agent prototyping | LOW — Python, multi-agent overkill for MVP |
| **Dify** | 129.8K stars | Visual workflow builder | LOW — hosted platform, not a library |

**Key insight:** The market leader for TypeScript agents is **Mastra**. SoftBank built their Satto Workspace platform on it. Marsh McLennan deployed it to 75,000 employees. Worth evaluating in Phase 2 if raw Anthropic SDK feels limiting. But for MVP, raw `@anthropic-ai/sdk` with our custom architecture remains the right call.

**What Waldo learns:** The frameworks confirm our "thin runtime" philosophy is correct. The winning pattern is: minimal orchestration code + rich tool definitions + good context management. Exactly what Claude Code does, exactly what we're doing.

### 4.2 Protocol Wars: MCP + A2A = The New Standard

**The biggest development of 2026:** MCP and A2A are no longer competing. They're complementary and **both governed by the Linux Foundation's Agentic AI Foundation (AAIF)**, co-founded by OpenAI, Anthropic, Google, Microsoft, AWS, and Block.

- **MCP** = how agents talk to **tools** (Anthropic, **97 million installs** as of March 25, 2026 — fastest adoption of any AI infra standard ever)
- **A2A** = how agents talk to **other agents** (Google, v1.0 shipped with gRPC + signed Agent Cards)
- **146 members** across Platinum and Gold tiers
- **WebMCP** (Feb 2026) — new Google/Microsoft standard letting websites expose tools to browser agents (67% less compute vs screenshots)

**Waldo implication:**
- **MCP (Phase 2+):** When we add Phase 2 adapters (Calendar, Email, Tasks, Music, ScreenTime), consider exposing Waldo's capabilities as MCP tools. This makes Waldo's biological intelligence available to ANY agent system. A Cursor user could query Waldo's CRS via MCP. A Claude Code session could check "should I take a break?" via Waldo MCP.
- **A2A (Phase 3+):** When Waldo becomes a Pack (multi-user), A2A enables Waldo-to-Waldo communication. A team's Waldos could coordinate: "The engineering team's aggregate CRS is low — suggest the manager reschedule the afternoon review." This is the Pack tier moat.

**New recommendation:** Add MCP server capability to Phase 2 roadmap. Waldo as MCP server = biological intelligence as a service for any agent.

### 4.3 Memory Systems — Letta/MemGPT Leads, We're Already Close

**Letta (formerly MemGPT)** remains the gold standard for agent memory:
- **Virtual context management** — LLM manages its own memory like an OS manages RAM/disk
- **Core memory blocks** — Persistent, labeled, always in prompt (our Tier 1)
- **Archival memory** — Out-of-context, retrieved via search (our Tier 3)
- **Memory as first-class state** — Editable, transparent, developer-controlled

**Emerging research (2026):**
- **MemRL** (Jan 2026) — Self-evolving agents via reinforcement learning on episodic memory
- **Agentic Memory** (Jan 2026) — Unified long-term and short-term memory management
- **VentureBeat prediction:** Contextual memory will surpass RAG for agentic AI in 2026

**Three types of agent memory emerging as standard:**
1. **Semantic memory** — General knowledge (our core_memory, preferences, baselines)
2. **Episodic memory** — Specific experiences (our session_summaries, pattern_log)
3. **Procedural memory** — Learned skills (our agent_evolutions, behavioral parameters)

**Waldo validation:** Our 3-tier memory architecture independently maps to the Letta model. The key gap is **procedural memory** — our `agent_evolutions` table partially covers this, but we should formalize it:

```
Tier 1 (Semantic) → core_memory: identity, health_profile, preferences
Tier 2 (Episodic) → session_summaries: what happened, when, outcomes
Tier 3 (Procedural) → agent_evolutions: learned behaviors, calibrated parameters
Tier 4 (Archival) → pgvector embeddings over summaries + patterns (Phase 2)
```

### 4.4 Self-Evolving Agents — A Formal Research Field Now

A comprehensive survey (arxiv 2508.07407) defines the taxonomy of self-evolving agents:

| What Evolves | Waldo Equivalent |
|-------------|-----------------|
| Model parameters | NOT applicable (we don't fine-tune) |
| **Prompts** | Soul file zone modifiers, personality calibration |
| **Explicit memory** | core_memory updates, pattern insights |
| **Toolsets** | Future: enable/disable tools based on user engagement |
| **Workflow graphs** | Future: customize Hand trigger timing |
| **Agent population/roles** | Phase 3: specialist sub-agents |

**Key pattern: Reflexion** — Agent analyzes its own performance, generates verbal critiques, maintains reflections in memory to guide subsequent decisions. **This is exactly what our agent_evolutions + signal detection system does.**

**EvoAgentX** (open-source, GitHub) — "Building a Self-Evolving Ecosystem of AI Agents." Confirms our evolution safety controls (min signals, max changes/week, decay, auto-revert) are aligned with research best practices.

**New learning — dual audit pattern:** "Consolidation of experience, dual audits, and evolutionary exploration contribute synergistically to overall system robustness." We should add a dual audit to our evolution pipeline:
1. **Frequency audit** — Is this signal repeating? (already have: min 3 signals)
2. **Impact audit** — Would this change make the agent behave differently in a way that affects quality? (new: before applying an evolution, simulate the change on the golden test suite)

### 4.5 Cost Optimization — The Numbers Are In

Production agent cost optimization in 2026 is well-understood:

| Technique | Token Savings | Waldo Already Has? |
|-----------|--------------|-------------------|
| **Semantic caching** | 47-73% for repetitive queries | NO — add in Phase D |
| **Rules pre-filter** | 60-80% of LLM calls eliminated | YES |
| **Model routing** | 30-50% by using cheaper models for simple tasks | PLANNED (Phase 2) |
| **Prompt caching** | 50% on cached tokens | YES (soul + profile) |
| **Tool output compression** | 20-30% per iteration | PLANNED |
| **Batch processing** | 30-40% via async batching | NO — evaluate for baseline updates |

**Key stat:** Agents make **3-10x more LLM calls** than chatbots. A single user request can trigger planning → tool selection → execution → verification → response. **Combining all techniques can reduce agent costs by 70-90%.**

**Agentic plan caching** (new research, arxiv 2506.14852): Cache the agent's execution plan (which tools to call, in what order) for structurally similar requests. Reduces cost by **46.62%** while maintaining **96.67%** of optimal performance. **This maps perfectly to our semantic caching proposal** — Morning Wags have identical structure day-to-day.

**Redis LangCache** — Production semantic cache achieving 73% cost reduction. Uses vector embeddings to match similar queries. We can implement a simpler version using Postgres + pgvector without adding Redis.

### 4.6 Agent Evaluation & Observability — The Missing Piece

**The #1 barrier to agent deployment is quality** (32% of organizations cite this — LangChain 2026 report).

**Top platforms:**

| Platform | Model | Key Feature | Waldo Fit |
|----------|-------|-------------|-----------|
| **Langfuse** | Open-source, self-hostable | Nested traces, custom evaluators, prompt management | HIGH — self-host, free, health data stays private |
| **Braintrust** | Eval-first | Loop (generates scorers from natural language), trace→test case conversion | MEDIUM — powerful but SaaS |
| **Arize Phoenix** | Open-source | OpenTelemetry traces, embedding clustering, drift detection | MEDIUM — good for pattern detection |

**Waldo recommendation:** Start with **Langfuse self-hosted** in Phase G. It's open-source, can be self-hosted (health data privacy), and provides nested traces + evaluation workflows. Our `agent_logs` table serves as the data source, Langfuse provides the visualization and evaluation layer.

### 4.7 Health AI Specifically — The Market Is Moving

**Critical finding from CES 2026:** Dreame unveiled an "AI-driven proactive health ecosystem" — the industry is moving from passive tracking to proactive health companions. The phrase "beyond wearables" is becoming mainstream.

**2026 healthcare AI trends:**
- "First quarter of 2026 witnessed structural realignment driven by major tech firms entering consumer health AI"
- Transition from "passive informatics" to **"agentic health stewardship"**
- AI agents embedded in wearables that "anticipate needs based on behavior and context"
- Continuous environmental sensing + real-time reasoning creating pressure on wearable hardware

**Competitive landscape update (5 threats ranked):**

| Threat | What | Proactive? | Platform-Agnostic? | CRS? | Memory? | Channel Delivery? |
|--------|------|-----------|-------------------|------|---------|-------------------|
| **Microsoft Copilot Health** (March 2026) | 50+ wearables, 50K US hospital records, AI insights | NO (reactive) | YES (multi-wearable) | NO | NO | NO (in-app) |
| **ONVY Health** (closest competitor) | 320+ wearable integrations, readiness/recovery/stress scores, always-on AI | PARTIAL (proactive insights) | YES (320+ wearables!) | HAS readiness score | UNKNOWN | NO (in-app, B2B2C) |
| **Apple Health+ AI Coach** (iOS 26.4) | Apple physicians-trained model, health coaching | UNKNOWN | NO (Apple only) | NO | NO | NO (in-app) |
| **WHOOP Coach** | LLM chat over WHOOP data | NO (reactive) | NO (WHOOP only) | NO | NO | NO (in-app) |
| **Oura Advisor** | Women's health AI model, context-aware insights | NO (reactive) | NO (Oura only) | NO | NO | NO (in-app) |

**ONVY is the closest competitor** — multi-wearable, readiness scores, proactive insights. But: B2B2C enterprise-first (not consumer), no messaging channel delivery, no CRS grounded in SAFTE-FAST, no agent memory that learns.

**Microsoft Copilot Health is the biggest new entrant** — validates our thesis that wearable + AI is a massive market. But purely reactive. They frame it as a step toward "medical superintelligence" — signals massive R&D investment ahead.

**Waldo's structural advantages remain:**
1. **Truly proactive** — Morning Wag, Fetch Alerts push BEFORE you ask
2. **Validated CRS** — grounded in SAFTE-FAST (US Army), not a generic "readiness" number
3. **Agent memory** — learns your patterns over weeks, self-evolves with safety controls
4. **Channel delivery** — Telegram/WhatsApp, not locked to an app
5. **MCP server path** — biological intelligence as a service for any agent

**But the window is narrowing FAST.** Microsoft entered in March 2026. ONVY has 320+ integrations. Apple is coming. OpenClaw validated the personal agent category at 247K stars in 60 days. We need to ship before the big players catch up with their massive distribution advantages.

### 4.8 New Pattern: Waldo as MCP Server (Phase 2 Upgrade)

This is the single biggest strategic insight from the landscape research. MCP is becoming the universal tool layer. A2A is becoming the universal agent coordination layer.

**If Waldo exposes its capabilities as an MCP server:**

```typescript
// Waldo MCP Server — biological intelligence as a service
const WALDO_MCP_TOOLS = {
  'waldo/get_cognitive_state': {
    description: 'Get the user\'s current cognitive readiness (CRS), stress level, and energy state',
    returns: { crs: number, zone: string, stressConfidence: number, energyLevel: string },
  },
  'waldo/should_schedule_now': {
    description: 'Given a task difficulty (1-10), should the user do it now or later based on their biological state?',
    input: { taskDifficulty: number, taskType: string },
    returns: { recommendation: 'now' | 'later' | 'break_first', reason: string },
  },
  'waldo/get_optimal_window': {
    description: 'When is the user\'s next predicted peak cognitive window?',
    returns: { startTime: string, endTime: string, predictedCrs: number, confidence: number },
  },
};
```

**This makes Waldo the intelligence layer UNDER every other agent.** A Cursor session checks if you're sharp enough for a complex refactor. A Claude Code instance schedules its heavy work for your peak window. A Slack bot warns your team when your CRS drops. A calendar agent auto-reschedules meetings when you're depleted.

**This is the "biological intelligence substrate" vision from the North Star — made concrete via MCP.**

---

## 5. The 15 Concrete Upgrades for Waldo

### Priority Tier 1: Build Into Phase D (Agent Core)

| # | Upgrade | What | Effort | Impact |
|---|---------|------|--------|--------|
| 1 | **Three-stage compaction** | Micro-compaction (free) before every LLM call | 2 days | Saves 20-30% tokens per invocation |
| 2 | **Tool metadata + concurrent execution** | Read-only tools run in parallel | 1 day | 50-70% faster tool execution |
| 3 | **Semantic caching** | Cache response structures for repetitive triggers | 3 days | 30-40% output token reduction |
| 4 | **Structured error taxonomy** | Classify errors before choosing fallback | 1 day | Better reliability decisions |
| 5 | **Agent trace protocol** | Structured logging from day 1 | 1 day | Observability foundation |
| 6 | **Guardrails as formal system** | Typed guardrail pipeline | 1 day | Cleaner than ad-hoc hooks |
| 7 | **Streaming delivery** | Stream agent response to Telegram | 1 day | Perceived speed improvement |
| 8 | **Permission modes** | Named modes per trigger type | 0.5 day | Cleaner than ad-hoc tool lists |

**Total Phase D addition: ~10.5 days**

### Priority Tier 2: Build Into Phase E (Proactive Delivery)

| # | Upgrade | What | Effort | Impact |
|---|---------|------|--------|--------|
| 9 | **Speculative pre-computation** | Pre-compute Morning Wag context overnight | 2 days | Morning Wag in <5s |
| 10 | **Proactive context pre-loading** | Cache user context bundle at trigger time | 1 day | Faster all triggers |

**Total Phase E addition: ~3 days**

### Priority Tier 3: Build Into Phase G (Self-Test)

| # | Upgrade | What | Effort | Impact |
|---|---------|------|--------|--------|
| 11 | **Memory consolidation daemon** | AutoDream-style weekly consolidation | 3 days | Memory quality compounds |
| 12 | **Feature flag system** | Supabase-based flags for A/B testing | 1 day | Enables systematic tuning |
| 13 | **Agent evaluation harness** | Golden test suite for agent behavior | 3 days | Prevents regressions |

**Total Phase G addition: ~7 days**

### Priority Tier 4: Phase 2 (Evaluate When Ready)

| # | Upgrade | What | Effort | Impact |
|---|---------|------|--------|--------|
| 14 | **Model routing** | Haiku for simple, Sonnet for complex | 2 days | Better quality for complex queries |
| 15 | **Deferred tool discovery** | ToolSearch pattern for 50+ tools | 2 days | 5K+ tokens saved per invocation |
| 16 | **Waldo as MCP server** | Expose biological intelligence via MCP | 5 days | STRATEGIC — makes Waldo the layer under every agent |
| 17 | **Evolution dual audit** | Simulate evolutions on golden test suite before applying | 2 days | Prevents evolution regressions |
| 18 | **4-tier memory (add procedural)** | Formalize agent_evolutions as Tier 3 procedural memory | 1 day | Cleaner memory architecture |

---

## 5B. Waldo's Complete Memory Architecture (Integrating DO + Research + Claude Code)

The Cloudflare Durable Object infrastructure (from `Docs/WALDO_SCALING_INFRASTRUCTURE.md`) fundamentally transforms the memory story. The agent goes from **stateless amnesia** (reload everything every 50s invocation) to **persistent brain** (always-on SQLite with scheduling and WebSocket). Combined with the 4-memory-type model from cognitive science research and Claude Code's consolidation patterns, here is the definitive memory design.

### The 5-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 0: WORKING MEMORY (in-context, volatile per invocation)       │
│                                                                      │
│  What: Current conversation, active tool results, invocation state   │
│  Lives: LLM context window                                          │
│  Size: 4K-10K tokens (dynamic per trigger type)                      │
│  Persistence: None — rebuilt each invocation from Tiers 1-3          │
│  Managed by: Prompt builder (25-field assembly)                      │
│                                                                      │
│  Assembly:                                                           │
│    System msg (cached 1h): soul + zone + mode + safety + tools       │
│    User msg (fresh): Tier 1 snapshot + health data + trigger context │
│    History: Last N turns from Tier 2 (conversation_search)           │
│    Evolution: Unapplied entries from Tier 3                          │
└─────────────────────────────────────────────────────────────────────┘
         ▲ reads from                        ▲ reads from
         │                                   │
┌────────┴──────────────────┐  ┌─────────────┴──────────────────────┐
│  TIER 1: SEMANTIC MEMORY   │  │  TIER 2: EPISODIC MEMORY           │
│  "What I know about you"   │  │  "What happened between us"        │
│                             │  │                                     │
│  DO SQLite: memory_blocks   │  │  DO SQLite: episodes table          │
│                             │  │                                     │
│  Structured blocks:         │  │  ● Conversation logs (full)         │
│  ● identity (name, age, tz) │  │  ● Daily observations (agent notes) │
│  ● health_profile           │  │  ● Session summaries (compressed)   │
│  ● preferences              │  │  ● Feedback signals (👍/👎/dismiss) │
│  ● active_goals             │  │  ● Intervention outcomes            │
│  ● recent_insights (Spots)  │  │                                     │
│  ● baselines (7d/30d avgs)  │  │  Loaded: On-demand via tool calls   │
│                             │  │    read_memory(query)                │
│  Loaded: ALWAYS (every      │  │    conversation_search(query, days)  │
│    prompt, <200 tokens)     │  │                                     │
│                             │  │  Decay:                              │
│  Decay:                     │  │    7d: full detail                   │
│    Hot (7d): full detail    │  │    30d: compressed summary           │
│    Warm (30d): summary only │  │    90d: archived to Tier 4           │
│    Cold (30d+): in DB only  │  │                                     │
│    (retrievable via tool)   │  │  Size: Unbounded (DO SQLite)         │
│                             │  │                                     │
│  Each block has:            │  │  Each episode has:                   │
│    label, value,            │  │    timestamp, type, content,         │
│    access_count,            │  │    summary, sentiment,               │
│    relevance_score,         │  │    health_context_snapshot,          │
│    source, version,         │  │    consolidated (bool)               │
│    valid_from, valid_until  │  │                                     │
└────────────┬────────────────┘  └──────────────┬──────────────────────┘
             │                                   │
             │         ┌─────────────────────────┘
             │         │
┌────────────┴─────────┴──────────────────────────────────────────────┐
│  TIER 3: PROCEDURAL MEMORY — "How I've learned to help you"         │
│                                                                      │
│  DO SQLite: procedures table                                         │
│                                                                      │
│  ● Evolution entries (behavioral parameter adjustments)              │
│    - verbosity_level: "shorter" (3 signals, confidence 0.85)        │
│    - timing_preference: "morning_wag_at_0715" (user correction)     │
│    - topic_weight: "sleep_insights_2x" (observed engagement)        │
│                                                                      │
│  ● Learned intervention effectiveness                                │
│    - breathing_exercise: 72% engagement rate (12 suggestions)        │
│    - walk_suggestion: 45% engagement (8 suggestions)                 │
│    - hydration_reminder: 90% engagement (20 suggestions)             │
│                                                                      │
│  ● Learned skills (Phase 3: user-taught workflows)                   │
│    - "prep_for_standup": [get_linear_tickets, check_crs, draft]     │
│                                                                      │
│  Loaded: Selectively — only unapplied evolutions merged into prompt  │
│  Grows: Slowly (max 2 changes/week, min 3 signals to create)        │
│  Decay: 30-day confidence decay on pending entries                   │
│  Safety: Auto-revert if negative feedback spike after application    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  │ Phase 2+
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 4: ARCHIVAL / CONSTELLATION MEMORY                             │
│  "Patterns connected across months"                                  │
│                                                                      │
│  Supabase Postgres + pgvector (NOT in DO — shared across devices)    │
│                                                                      │
│  ● Embeddings over session summaries + Spots                         │
│  ● Bi-temporal knowledge graph (Zep/Graphiti-inspired):              │
│    - Entities: User, HealthMetric, Activity, Medication, Routine     │
│    - Edges: "affects", "improves", "worsens", "correlates_with"      │
│    - Temporal validity: valid_from, valid_until on every edge         │
│    - Enables: "How has recovery changed since starting running 3x?"  │
│                                                                      │
│  Loaded: On-demand via semantic search + graph traversal             │
│  Size: Unbounded                                                     │
│  Decay: Never deleted, only superseded (new evidence invalidates)    │
│  Access: constellation_search(query) tool                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Where Each Tier Lives (DO + Supabase Split)

| Tier | Storage | Why There |
|------|---------|-----------|
| 0 (Working) | LLM context window | Volatile, rebuilt each invocation |
| 1 (Semantic) | **DO SQLite** | Agent's persistent brain, <1ms access |
| 2 (Episodic) | **DO SQLite** | Per-user history, searchable locally |
| 3 (Procedural) | **DO SQLite** | Agent's learned behaviors, per-user |
| 4 (Archival) | **Supabase Postgres + pgvector** | Cross-device access, graph queries, shared infrastructure |
| Health data | **Supabase Postgres** | Phone syncs here, DO reads from here. Never in DO SQLite (privacy). |

**Key rule:** Raw health values (HRV, HR, sleep hours) NEVER enter DO SQLite. Health data lives in encrypted Supabase with RLS. The DO reads it via API when needed and only stores **derived insights** ("user's HRV has been declining" — not "HRV was 42ms").

### Memory Flows

#### Real-Time (During Conversation)

```
User sends Telegram message
  → Channel Adapter routes to user's Durable Object
  → DO wakes from hibernation (0ms)
  → DO loads Tier 1 from local SQLite (<1ms)
  → DO fetches fresh health data from Supabase (~200ms)
  → DO builds prompt (Tier 0 assembled from Tiers 1-3 + health)
  → DO calls Claude Haiku via Anthropic API
  → Claude reasons, calls tools:
      read_memory("stress_triggers") → DO reads Tier 2 locally
      get_crs(today) → DO fetches from Supabase
      update_memory("user_prefers_shorter") → DO writes to Tier 1 (CAS)
      send_message("Here's your update...") → Channel Adapter
  → DO logs episode to Tier 2
  → DO logs feedback signal to Tier 3 (if feedback detected)
  → DO logs trace to agent_logs (Supabase, fire-and-forget)
  → DO hibernates
```

#### Sleep-Time Compute (Patrol Agent — Nightly)

```
2:00 AM (user's timezone): DO alarm fires
  → DO wakes from hibernation
  → Dual-gate check: ≥24h since last consolidation AND ≥3 sessions?
    → NO: hibernate, skip
    → YES: proceed

  Phase 1 — Orient:
    Read all Tier 1 memory blocks
    Count Tier 2 episodes since last consolidation
    Read Tier 3 pending evolution signals

  Phase 2 — Gather Signal:
    Scan Tier 2 episodes for:
      ● User corrections ("too clinical", "too long")
      ● Explicit preferences ("I like X", "stop doing Y")
      ● Engagement patterns (which messages got 👍, which ignored)
      ● Recurring health patterns across days

  Phase 3 — Consolidate:
    Promote validated patterns → Tier 1 recent_insights (require 3+ confirmations)
    Update preferences in Tier 1 that were explicitly corrected
    Compute evolution entries → Tier 3 (if ≥3 signals in same direction)
    Decay: reduce relevance_score on Tier 1 blocks not accessed in 30d
    Resolve contradictions: if new data contradicts old → mark old as superseded
    Compress: old Tier 2 episodes (>30d) → summary form
    Archive: episodes >90d → Tier 4 (Supabase pgvector) for Constellation

  Phase 4 — Pre-stage Morning Wag:
    Compute CRS from overnight data (via Supabase)
    Fetch weather + AQ forecast (via Open-Meteo)
    Fetch calendar (via CalendarProvider adapter, Phase 2)
    Bundle into pre-computed context → DO in-memory cache
    Set alarm: wake at user's predicted wake time - 5 min

  → DO hibernates (total active time: ~5-15 seconds)
```

#### Speculative Pre-Computation (Morning Wag Fast Path)

```
5 min before predicted wake:
  DO alarm fires → DO wakes
  Check pre-staged bundle from Patrol:
    FRESH (computed <60 min ago)? → Use directly
    STALE? → Refresh only CRS + sleep (weather/calendar still valid)

User wakes (activity spike detected by phone → Supabase → DO notification):
  Morning Wag Hand fires
  Pre-computed context already warm in DO memory
  Skip 4-5 tool calls → go straight to Claude with pre-loaded context

  Code Mode (Dynamic Worker):
    Instead of 3-4 LLM round-trips:
    Claude generates ONE TypeScript function:
    → Dynamic Worker executes it (fetches any missing data via RPC)
    → Returns structured result
    → Claude formats as Morning Wag message

  Result: Morning Wag delivered in <3 seconds
  Token cost: 81% reduction via Code Mode
```

### Memory Block Schema (DO SQLite)

```sql
-- Tier 1: Semantic memory (always loaded, <200 tokens)
CREATE TABLE memory_blocks (
  label TEXT PRIMARY KEY,          -- "identity", "health_profile", "preferences", etc.
  category TEXT NOT NULL,          -- "core", "health", "preference", "insight", "goal"
  value TEXT NOT NULL,             -- The actual content (structured JSON or prose)
  access_count INTEGER DEFAULT 0,  -- For decay scoring
  relevance_score REAL DEFAULT 1.0,-- Decays over time, boosted on access
  source TEXT NOT NULL,            -- "user_correction", "observed_pattern", "consolidation"
  version INTEGER DEFAULT 1,       -- CAS: increment on every write
  valid_from TEXT DEFAULT (datetime('now')),
  valid_until TEXT,                -- NULL = still valid
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tier 2: Episodic memory (searchable, on-demand)
CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- "conversation", "observation", "feedback", "intervention"
  content TEXT NOT NULL,
  summary TEXT,                    -- Compressed version (generated during consolidation)
  sentiment TEXT,                  -- "positive", "neutral", "negative", "frustrated"
  crs_at_time REAL,               -- CRS when this happened (derived, not raw health)
  zone_at_time TEXT,               -- Personality zone active
  consolidated BOOLEAN DEFAULT 0,  -- Has this been processed by Patrol?
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_episodes_type_date ON episodes(type, created_at);
CREATE INDEX idx_episodes_unconsolidated ON episodes(consolidated) WHERE consolidated = 0;

-- Tier 3: Procedural memory (learned behaviors)
CREATE TABLE procedures (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- "evolution", "intervention_effectiveness", "learned_skill"
  trigger_type TEXT,               -- "morning_wag", "fetch_alert", "user_chat"
  source TEXT NOT NULL,            -- "negative_feedback", "dismissal", "correction", "positive"
  context TEXT,                    -- What happened (sanitized, no health values)
  change_type TEXT,                -- "verbosity", "timing", "topic_weight", "language_style"
  change_value TEXT,               -- JSON: the parameter adjustment
  confidence REAL DEFAULT 1.0,     -- Decays over time
  applied BOOLEAN DEFAULT 0,
  reverted BOOLEAN DEFAULT 0,
  signal_count INTEGER DEFAULT 1,  -- How many signals support this
  created_at TEXT DEFAULT (datetime('now'))
);

-- Consolidation metadata
CREATE TABLE consolidation_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- "patrol", "weekly_review"
  episodes_processed INTEGER,
  blocks_updated INTEGER,
  evolutions_created INTEGER,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Compare-and-Swap for Concurrent Safety

When two triggers fire simultaneously (pg_cron Morning Wag + user message), both may try to update Tier 1:

```typescript
// In DO's memory_write tool handler:
async function updateMemoryBlock(label: string, newValue: string, expectedVersion: number) {
  const current = this.sql`SELECT version FROM memory_blocks WHERE label = ?`.get(label);

  if (current && current.version !== expectedVersion) {
    // Concurrent write detected — re-read and retry
    return { ok: false, error: 'VERSION_CONFLICT', currentVersion: current.version };
  }

  this.sql`
    INSERT INTO memory_blocks (label, category, value, version, source, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(label) DO UPDATE SET
      value = excluded.value,
      version = memory_blocks.version + 1,
      access_count = memory_blocks.access_count + 1,
      updated_at = excluded.updated_at
    WHERE memory_blocks.version = ?
  `.run(label, category, newValue, expectedVersion + 1, source, expectedVersion);

  // Log version change for rollback capability
  this.sql`INSERT INTO memory_versions (block_label, prev, next, reason, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))`.run(label, current?.value, newValue, source);

  return { ok: true, newVersion: expectedVersion + 1 };
}
```

### How the 18 Upgrades Get BETTER with DOs

| Upgrade | On Supabase Edge Fns | On Cloudflare DOs | Delta |
|---------|---------------------|-------------------|-------|
| Micro-compaction | Prune from Postgres query results | Prune from local SQLite reads (<1ms) | **Faster** |
| Concurrent tool execution | Parallel Supabase queries (~300ms each) | Parallel local SQLite reads (<1ms each) | **10-100x faster** |
| Semantic caching | Cache in Supabase table (network hop) | Cache in DO SQLite (local) | **Zero latency on hit** |
| Speculative pre-computation | pg_cron fires, Edge Fn cold starts | DO alarm fires, already warm | **0ms cold start** |
| Memory consolidation | Global pg_cron, shared resources | Per-user DO alarm, isolated | **Per-user schedule** |
| Error retry | Stateless — each retry is fresh | Stateful — retry with context | **Smarter retries** |
| Agent traces | Write to Supabase (network) | Write to DO SQLite + async to Supabase | **Non-blocking** |
| Feature flags | Load from Supabase each invocation | Cache in DO memory, refresh periodically | **Cached locally** |
| Code Mode | N/A (no Dynamic Workers in Supabase) | 81% token reduction via generated code | **Game-changer** |

### The Memory Lifecycle (End-to-End)

```
DAY 1 (Onboarding):
  Tier 1 initialized: identity, health_profile (from onboarding), default preferences
  Tier 2 empty, Tier 3 empty, Tier 4 empty

WEEK 1:
  Tier 2 fills with: 7 Morning Wags, 2-3 Fetch Alerts, 5-10 chat episodes
  Tier 1 updates: preferences refined via user corrections
  Tier 3: first feedback signals accumulate (no evolutions yet — need 3+ signals)

  Patrol (nightly): compresses daily episodes, updates baselines in Tier 1

WEEK 2:
  Tier 3: first evolution entries created (verbosity adjusted, timing refined)
  Tier 1: recent_insights get first Spots ("HRV drops on Mondays")
  Agent starts: "I noticed your HRV usually drops on Mondays — want me to be gentler?"

MONTH 1:
  Tier 2: 30 session summaries, 200+ episodes
  Tier 3: 5-8 evolution entries applied, 2-3 reverted
  Tier 1: rich user model (preferences, patterns, intervention effectiveness)
  Agent is noticeably personalized — feels like it "knows you"

MONTH 3+:
  Tier 4 activated: Constellation queries ("3-month sleep trend")
  Tier 2: old episodes archived to Tier 4 with embeddings
  Tier 3: stable behavioral parameters, occasional fine-tuning
  Agent: "Over the last 3 months, your recovery has improved 18% since
          you started the evening walk routine. That's a real pattern."
```

### What NOT to Build for Memory

- **No Neo4j / external graph DB for MVP** — Postgres + pgvector is sufficient until Constellations are real
- **No Mem0 / Zep as dependencies** — Build memory in DO SQLite, use these as reference architectures
- **No model fine-tuning** — Prompt-level evolution via Tier 3 is the right cost/complexity tradeoff
- **No MemOS abstraction** — Overkill for single agent per user
- **No vector embeddings in DO SQLite** — Tier 4 embeddings live in Supabase pgvector, not locally
- **No health values in memory** — Only derived insights. "HRV declining" yes, "HRV was 42ms" no.

---

## 6. What NOT to Adopt (and Why)

| Claude Code Pattern | Why NOT for Waldo |
|---|---|
| **Generator-based async loops** | Overkill for 3-iteration Edge Function. Simple for-loop is clearer. |
| **React/Ink terminal UI** | We have React Native. Not relevant. |
| **Bridge/Remote Control** | We don't need browser↔CLI sync. Telegram IS the remote. |
| **MCP Client Management** | Our adapter pattern is simpler and more appropriate for a consumer app. |
| **Coordinator Mode (now)** | Single agent for MVP. Adopt in Phase 3 for specialist sub-agents. |
| **Scratchpad directories** | No multi-agent file sharing needed. |
| **Slash commands** | Telegram commands serve the same purpose. |
| **Buddy/Tamagotchi** | Fun but irrelevant to health agent. |
| **KAIROS always-on** | DO alarms are our equivalent — persistent, per-user, zero cost when idle. |
| **File history/undo** | DO SQLite version tracking on memory_blocks serves the same purpose. |
| **Copy-on-write filesystem** | Speculative pre-computation uses DO in-memory cache, not filesystem overlays. |
| **560 telemetry events** | Massive overkill. 15-20 key metrics are sufficient for MVP. |
| **37 feature flags** | 6-8 flags is enough for Phase G. |
| **Undercover mode** | We're proud of being AI-powered (well, "biological intelligence layer"). |

**Key principle:** Claude Code is a developer tool with a persistent process running locally. Waldo is a consumer health agent with a persistent Durable Object running at the edge. The topology differs, but the pattern is the same: persistent brain + tool execution + memory consolidation. With the DO migration, Waldo's architecture is actually closer to Claude Code than it was before.

---

## 7. Updated Architecture Diagram

After incorporating the 15 upgrades, the data flow becomes:

```
┌─────────────────────────────────────────────────────────────────────┐
│  WEARABLE → HealthKit/Health Connect → Native Module → op-sqlite    │
│  → CRS computation (on-phone) → Supabase sync → health_snapshots    │
│                                                                      │
│  pg_cron fires:                                                      │
│  ├── 03:30: baseline_update → SPECULATIVE PRE-COMPUTATION [NEW]     │
│  │   └── Pre-compute Morning Wag bundle → pre_compute_cache table    │
│  ├── 06:XX: morning_wag (wake time detected)                        │
│  │   └── Check pre_compute_cache → FAST path if fresh               │
│  └── every 15min: stress_check → rules pre-filter                    │
│                                                                      │
│  FEATURE FLAGS loaded [NEW] → controls behavior                      │
│                                                                      │
│  PERMISSION MODE resolved [NEW]:                                     │
│  morning_wag → read tools + send_message, max 2 iterations          │
│  fetch_alert → stress tools + memory + send, max 2 iterations       │
│  user_chat → all 8 tools, max 3 iterations                          │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PRE-REASONING HOOKS (enhanced with 3 new patterns)                  │
│                                                                      │
│  [existing] Emergency Bypass → Quality Gates → Context Injection     │
│  [NEW] MICRO-COMPACTION: dedupe tools, truncate >500 tok, prune      │
│  [NEW] SEMANTIC CACHE CHECK: structural match → pre-fill template    │
│  [existing] Rate Limit check                                         │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT LOOP (ReAct — max 3 iterations, 50s timeout)                  │
│                                                                      │
│  LLM Provider → ERROR TAXONOMY [NEW]:                                │
│    transient → retry with backoff (max 3)                            │
│    capacity → fallback level 2-3                                     │
│    permanent → fallback level 3-4                                    │
│                                                                      │
│  Tool execution → CONCURRENT READS / SERIAL WRITES [NEW]            │
│    Read-only batch: get_crs + get_sleep + get_activity → parallel    │
│    Write batch: update_memory → send_message → serial                │
│                                                                      │
│  Tool results → SIZE CAP + RETRIEVAL MARKERS [enhanced]              │
│    >maxResultTokens → compress + [DETAIL_AVAILABLE] marker           │
│                                                                      │
│  STREAMING to channel [NEW] → partial response while still thinking  │
│                                                                      │
│  Model routing [Phase 2]: Haiku default → Sonnet for complex         │
│  Tool discovery [Phase 2]: Capability manifest + discover_tools      │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POST-REASONING HOOKS (enhanced)                                     │
│                                                                      │
│  [enhanced] GUARDRAILS PIPELINE [NEW]: formal typed guardrails       │
│    medical_claims → BLOCK                                            │
│    health_language → REWRITE (max 2 retries)                         │
│    confidence_check → WARN                                           │
│    prompt_injection → BLOCK                                          │
│    pii_leakage → BLOCK                                               │
│                                                                      │
│  [existing] Loop Guard → Memory Update → Analytics                   │
│  [NEW] AGENT TRACE: structured trace → agent_logs table              │
│  [NEW] SEMANTIC CACHE WRITE: if novel response pattern → cache it    │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DELIVERY + FEEDBACK + EVOLUTION                                     │
│                                                                      │
│  Channel Adapter → Telegram (streaming if supported)                 │
│  Three-tier feedback → signal detection (rule-based)                 │
│                                                                      │
│  WEEKLY: MEMORY CONSOLIDATION DAEMON [NEW]                           │
│    Phase 1: Orient (read core_memory, count sessions)                │
│    Phase 2: Gather (extract corrections, patterns, preferences)      │
│    Phase 3: Consolidate (promote patterns, resolve contradictions)   │
│    Phase 4: Prune (keep <200 tokens, archive old summaries)          │
│    Dual-gate: ≥7 days AND ≥3 sessions since last                    │
│                                                                      │
│  PHASE G: EVALUATION HARNESS [NEW]                                   │
│    Golden test suite → run after every soul file change               │
│    Feature flags → A/B test variants                                  │
│    Regression detection → alert on quality drops                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Roadmap

### Phase D Additions (Agent Core) — +10.5 days

```
Week 1 of Phase D:
  Day 1-2: Implement tool metadata + concurrent execution engine
  Day 3: Implement permission modes (named, not ad-hoc)
  Day 3: Implement structured error taxonomy + retry strategy
  Day 4: Implement agent trace protocol (structured logging)

Week 2 of Phase D:
  Day 5: Implement micro-compaction (pre-reasoning hook)
  Day 6-7: Implement guardrails pipeline (formal typed system)
  Day 8: Implement streaming delivery to Telegram

Week 3 of Phase D:
  Day 9-11: Implement semantic caching layer (cache + pre-fill)
```

### Phase E Additions (Proactive Delivery) — +3 days

```
Day 1-2: Implement speculative pre-computation
  - pre_compute_cache table
  - Baseline updater populates cache
  - Morning Wag reads from cache first
Day 3: Implement proactive context pre-loading
  - User context bundle cached per trigger
  - Delta refresh for stale fields only
```

### Phase G Additions (Self-Test) — +7 days

```
Day 1-3: Implement memory consolidation daemon
  - 4-phase consolidation
  - Dual-gate trigger
  - pg_cron integration
Day 4: Implement feature flag system
  - feature_flags table
  - Edge Function loader with 5min cache
Day 5-7: Implement agent evaluation harness
  - Golden test suite (20+ test cases)
  - Automated regression detection
  - Quality scoring dashboard
```

---

## 9. Competitive Implications

### What This Gives Waldo That Nobody Else Has

1. **Sub-5-second Morning Wags** via speculative pre-computation. No health app delivers proactive insights this fast. WHOOP Coach takes 5-15 seconds to respond to a question. Waldo delivers before you ask.

2. **Self-improving memory** via AutoDream-style consolidation + self-evolution with safety controls. The agent genuinely gets better over weeks, not just accumulates data. Research validates this as a formal field (arxiv 2508.07407).

3. **Production-grade reliability** via error taxonomy + fallback chain + guardrails pipeline. When Claude is down, Waldo still sends a useful template. Zero downtime for the user. Circuit breaker pattern from Claude Code ensures we never burn budget on failures.

4. **Cost efficiency at scale** via semantic caching + concurrent tools + micro-compaction + pre-filtering + markdown format (34% savings over JSON). Estimated total cost: **$0.01-0.03/user/day** ($0.30-0.90/month, vs $0.30+/day without optimizations). The 70-90% cost reduction is validated by production agent deployments. Plus Anthropic Batch API at 50% discount for nightly Constellation analysis.

5. **Systematic quality** via evaluation harness + feature flags + Langfuse. Every soul file change is tested against golden test suite. Every evolution parameter is A/B tested. Quality never regresses. 32% of organizations cite quality as the #1 barrier to agent deployment — we solve this from day 1.

6. **Waldo as MCP server** (Phase 2). This is the strategic game-changer. By exposing biological intelligence via MCP, Waldo becomes the intelligence layer UNDER every other AI tool. Claude Code, Cursor, Slack bots, calendar agents — any agent that can query an MCP server can access your cognitive state. This transforms Waldo from "a health app" to "the biological intelligence substrate for the agentic economy."

7. **A2A-ready Pack tier** (Phase 3). When Google's A2A v1.0 matures, Waldo Pack enables multi-user biological intelligence. A team's Waldos coordinate via A2A protocol. "The engineering team's aggregate cognitive load is high — suggest the manager cancel the afternoon all-hands."

### The Moat Deepens

Claude Code proves that the "thin runtime + smart model" pattern works at massive scale (1,905 files, 213MB binary, 10K+ token system prompt). Waldo adopts this philosophy but adds what no code assistant has: **biological intelligence**.

The 18 upgrades make our runtime thinner and more reliable, while concentrating more intelligence in the model and in the data pipeline. The competitive landscape in 2026 shows:

**Agent frameworks ($52B market by 2030):** LangGraph, Mastra, OpenAI Agents SDK, CrewAI — all building general-purpose agent infrastructure. None have biological context.

**Health AI (going mainstream):** WHOOP Coach, Oura Advisor, Dreame (CES 2026) — all moving toward AI-powered health insights. But:
- All are **reactive** (user asks, AI answers). Waldo is **proactive** (acts before you ask)
- All are **hardware-locked** (WHOOP ring, Oura ring, Dreame devices). Waldo is **platform-agnostic** (any wearable)
- None have **validated scoring** (CRS grounded in SAFTE-FAST). They have "insights" without a scientific framework
- None have **agent memory** that learns over weeks
- None have **channel adapters** — all are in-app only

**The strategic position:**

```
2026 Agent Ecosystem:
                                    ┌──────────────────────┐
                                    │   User's AI Tools     │
                                    │                       │
                                    │  Claude Code          │
                                    │  Cursor               │
                                    │  Slack AI             │
                                    │  Calendar Agent       │
                                    │  Email Assistant      │
                                    │  Task Manager         │
                                    └───────┬───────────────┘
                                            │
                                            │ MCP / A2A
                                            │
                                    ┌───────▼───────────────┐
                                    │                       │
                                    │    WALDO              │
                                    │    Biological         │
                                    │    Intelligence       │
                                    │    Layer              │
                                    │                       │
                                    │  "Is the user sharp   │
                                    │   enough for this?"   │
                                    │  "When's the best     │
                                    │   time for deep work?"│
                                    │  "They're burning out,│
                                    │   back off."          │
                                    │                       │
                                    └───────┬───────────────┘
                                            │
                                    ┌───────▼───────────────┐
                                    │   Health Data          │
                                    │                       │
                                    │  Any Wearable          │
                                    │  (Apple Watch, Samsung,│
                                    │   Garmin, Oura, WHOOP, │
                                    │   Pixel Watch, etc.)   │
                                    └───────────────────────┘
```

**Waldo isn't competing with agent frameworks. Waldo IS the biological intelligence layer that every other agent should be running on.**

The window is narrowing — CES 2026 showed the "proactive health ecosystem" concept going mainstream. But hardware companies (Dreame, WHOOP, Oura) are locked to their own devices, and framework companies (LangGraph, Mastra, OpenAI) don't have health data. **Waldo sits in the gap that neither can fill: platform-agnostic biological intelligence as a service.**

Ship fast. The moat is real, but only if we build it before someone with 100x our distribution notices the gap.

---

---

## 10. Protocol Landscape + Open-Agents Upgrades (April 2026)

> **Sources:** Cloudflare Agents Week (April 2026), Akka MCP/A2A/ACP explainer, Vercel open-agents repo (vercel-labs/open-agents), MCP spec 2025-11-25, A2A v1.0 spec
> **Date:** April 14, 2026

### 10.1 New Protocol Landscape — What Waldo Must Implement

Three protocols are now live and converging. All three are relevant to different parts of Waldo:

| Protocol | Owner | What it is | Waldo relevance | Phase |
|---|---|---|---|---|
| **MCP** | Anthropic | Tool/resource calling from AI assistants → external servers | Expose getCRS, getCognitiveWindow, getStressLevel as tools other agents can call | Phase 2 |
| **A2A** | Google (v1.0, 150+ orgs) | Agent-to-agent task delegation with structured lifecycle | Publish Agent Card. Pack tier (multiple users' Waldos coordinate). Future partner integrations (e.g. Lindy, Cursor) call Waldo's body signals | Phase 2–3 |
| **ACP** | IBM/BeeAI | Async REST agent communication, no SDK required | Evaluate when A2A matures. More enterprise-friendly but lower adoption | Phase 3+ |

**Decision locked:** Build MCP first (single endpoint, immediate value), A2A second (Agent Card, bidirectional), ACP only if enterprise customers demand it.

---

### Upgrade 31 — MCP Server at `/.well-known` (Phase 2, 1 day)

Add two discovery endpoints to the CF Worker index.ts:

```typescript
// GET /.well-known/mcp.json  → MCP Server Card (tool discovery)
// GET /.well-known/agent-card.json → A2A Agent Card (agent discovery)

app.get('/.well-known/mcp.json', (req) => {
  return Response.json({
    name: "Waldo",
    version: "1.0",
    description: "Personal biological intelligence layer",
    tools: [
      {
        name: "getCRS",
        description: "Get current Cognitive Readiness Score (0-100) for a user",
        inputSchema: { type: "object", properties: { user_id: { type: "string" } } },
      },
      {
        name: "getCognitiveWindow",
        description: "Get the user's optimal focus window for today",
        inputSchema: { type: "object", properties: { user_id: { type: "string" } } },
      },
      {
        name: "getStressLevel",
        description: "Get current biological stress confidence + recent events",
        inputSchema: { type: "object", properties: { user_id: { type: "string" } } },
      },
      {
        name: "shouldScheduleNow",
        description: "Boolean: is this a good time for deep work given body state?",
        inputSchema: {
          type: "object",
          properties: {
            user_id: { type: "string" },
            task_difficulty: { type: "number", description: "1-5 cognitive load" },
          },
        },
      },
    ],
  });
});
```

**Why:** External AI agents (Cursor, Claude Code, Lindy, any MCP client) can now call `getCRS()` before scheduling a task or taking an action on the user's behalf. This is Waldo's strategic moat — every agent in the ecosystem becomes body-aware.

---

### Upgrade 32 — A2A Agent Card (Phase 2, 2 hours)

```typescript
// GET /.well-known/agent-card.json → A2A spec-compliant discovery
app.get('/.well-known/agent-card.json', (req) => {
  return Response.json({
    id: "waldo-personal-agent",
    name: "Waldo",
    description: "Biological intelligence agent. Reads body signals from wearables and acts before the user notices stress, depletion, or burnout.",
    version: "1.0",
    serviceEndpoint: "https://waldo-agent.piyushfulper3210.workers.dev/a2a",
    authentication: { type: "bearer_token" },
    capabilities: ["health_monitoring", "stress_analysis", "cognitive_state", "schedule_optimization"],
    skills: [
      { name: "getCRS", description: "Cognitive Readiness Score" },
      { name: "getCognitiveWindow", description: "Optimal focus window" },
      { name: "proposeCalendarAction", description: "Suggest schedule changes based on body state" },
    ],
  });
});
```

**Why:** Google A2A is v1.0 with 150+ orgs. Publishing an Agent Card means any A2A-compatible orchestrator (Google Workspace AI, Spring AI, CrewAI) can discover and delegate to Waldo. This is the Pack tier foundation.

---

### Upgrade 33 — Cloudflare AIChatAgent Class Evaluation (Phase D+, evaluate)

CF released `AIChatAgent` (extends DurableObject) with built-in persistence, tool dispatch, and resumable streaming. Compared to our custom `agent.ts`:

| Capability | Our agent.ts | AIChatAgent |
|---|---|---|
| Message persistence | Manual `addEpisode()` | Automatic |
| Tool routing | Custom ReAct loop | Built-in |
| Streaming | Batch response | Resumable async generators |
| Pre-filter (60% LLM savings) | ✅ Custom | ❌ Not available |
| Soul files (zone-based personality) | ✅ Custom | ❌ Not available |
| Memory tiering (5-tier) | ✅ Custom | ❌ Not available |
| Dreaming Mode / nightly compaction | ✅ Custom | ❌ Not available |

**Decision:** Do NOT migrate to AIChatAgent. Our custom patterns (pre-filter, soul files, zone personality, memory tiering, daily compaction) are more capable than their base class. Monitor for updates — their streaming reconnection pattern (Upgrade 34) is worth cherry-picking independently.

---

### Upgrade 34 — Stream Reconnection (Phase E, 1 day)

From open-agents: clients can reconnect to in-flight agent runs after page refresh or network drop.

```typescript
// In WaldoAgent DO:
private activeStreamId: string | null = null;

async startStream(userId: string): Promise<{ streamId: string }> {
  const streamId = crypto.randomUUID();
  this.activeStreamId = streamId;
  setState(this.sql, 'active_stream_id', streamId);
  return { streamId };
}

// GET /stream/:streamId → reconnect to existing stream
async handleStreamReconnect(streamId: string): Promise<Response> {
  if (this.activeStreamId !== streamId) {
    return new Response('Stream not found', { status: 404 });
  }
  // Resume SSE stream from where it left off
  return new Response(this.getStreamBuffer(), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

**Why:** When Waldo is mid-conversation on mobile and the user backgrounds the app, they return to a broken state. Stream reconnection allows resuming exactly where the agent was.

---

### Upgrade 35 — `needsApproval` on Tool Definitions (Phase D, 2 hours)

From open-agents: embed approval logic directly in tool definitions instead of a separate `propose_action` tool.

```typescript
// Current: propose_action is a separate dedicated tool
// Better: bake approval into each tool that can have side effects

export const createCalendarEventTool: Tool = {
  name: 'create_calendar_event',
  needsApproval: (args) => {
    // Auto-approve: creating events in next 4 hours (urgent response)
    // Require approval: anything scheduled more than 1 day ahead
    const eventDate = new Date(args.start_time);
    const hoursAhead = (eventDate.getTime() - Date.now()) / 3600000;
    return hoursAhead > 4;
  },
  execute: async (args) => { /* actual calendar API call */ },
};

export const deferTaskTool: Tool = {
  name: 'defer_task',
  needsApproval: (args) => args.defer_days > 3, // >3 days = approval needed
  execute: async (args) => { /* todoist/google tasks API */ },
};
```

**Why:** As we add more tools with side effects (calendar, tasks, email drafts), a single `propose_action` bottleneck doesn't scale. Per-tool approval rules are cleaner and more granular.

---

### Upgrade 36 — Async Generator Streaming for Tool Progress (Phase E, 1 day)

From open-agents: yield intermediate tool states so the UI shows "Running get_crs..." before results arrive.

```typescript
// Current: tool result returned as batch string
case 'get_crs': {
  const row = await queryOne(env, 'crs_scores', params);
  return JSON.stringify({ score: row.score, zone: row.zone }); // ← batch
}

// Better: yield progress during long-running tools
case 'get_trends': {
  yield { status: 'fetching', tool: 'get_trends', step: '14-day CRS...' };
  const crs = await queryCrs14d();
  yield { status: 'fetching', tool: 'get_trends', step: 'email metrics...' };
  const email = await queryEmail14d();
  yield { status: 'complete', tool: 'get_trends' };
  return JSON.stringify({ crs, email, ... });
}
```

**Why:** The web console currently shows no feedback during multi-tool agent invocations (sometimes 5-8 seconds). Progressive streaming makes it feel instant.

---

### Upgrade 37 — Usage Accumulation Across ReAct Iterations (Phase D, 2 hours)

From open-agents: track total tokens across all tool calls, not just the final response.

```typescript
// In runAgentLoop() — currently only final tokens tracked:
let totalUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

for (let i = 0; i < MAX_ITERATIONS; i++) {
  const result = await callLLM(messages, options, this.env);

  // ADD THIS — accumulate across all iterations:
  totalUsage.inputTokens    += result.tokensIn;
  totalUsage.outputTokens   += result.tokensOut;
  totalUsage.cacheReadTokens += result.cacheReadTokens;
}

// Log full usage to agent_logs — enables per-iteration cost breakdown
void saveAgentLog(userId, triggerType, totalUsage.inputTokens, totalUsage.outputTokens, ...);
```

**Why:** Currently `agent_logs.total_tokens` only reflects the final iteration. When the agent runs 3 iterations, we're underreporting actual cost by 2-3×. This affects the $0.10/day cap accuracy.

---

### Upgrade 38 — Message Deduplication for Extended Thinking (Phase 2)

From open-agents: strip redundant thinking blocks from message history before sending to Claude.

```typescript
// When using extended thinking (Claude 3.7+ Sonnet reasoning):
function dedupeMessageReasoning(messages: Message[]): Message[] {
  return messages.map(msg => ({
    ...msg,
    content: Array.isArray(msg.content)
      ? msg.content.filter(block =>
          !(block.type === 'thinking' && isOlderThanCurrentTurn(block))
        )
      : msg.content,
  }));
}

// Apply before every LLM call:
const dedupedMessages = dedupeMessageReasoning(messages);
const result = await callLLM(dedupedMessages, options, env);
```

**Why:** If we add extended thinking to Constellation queries or weekly deep mining, repeated thinking blocks inflate context 3-5×. Deduplication keeps context lean.

---

### 10.2 Updated Phase Roadmap (Protocol Integration)

```
Phase 2 additions (from protocol research):
  ✦ Upgrade 31 — MCP Server Card at /.well-known/mcp.json
  ✦ Upgrade 32 — A2A Agent Card at /.well-known/agent-card.json
  ✦ Upgrade 35 — needsApproval on tool definitions

Phase E additions (from open-agents patterns):
  ✦ Upgrade 34 — Stream reconnection (resume mid-conversation)
  ✦ Upgrade 36 — Async generator streaming for tool progress

Phase D additions (low-effort, high-value):
  ✦ Upgrade 37 — Usage accumulation across ReAct iterations (2 hours)

Phase 2+ (evaluate):
  ✦ Upgrade 33 — AIChatAgent class (DO NOT migrate now — monitor only)
  ✦ Upgrade 38 — Message deduplication (only if extended thinking added)
```

### 10.3 What Open-Agents Does Better (Honest Assessment)

| Area | Open-Agents Advantage | Our Response |
|---|---|---|
| Multi-agent subagents | Explorer + Executor split, streamed progress | Phase 2: specialist agents (sleep, stress, productivity) |
| Streaming granularity | Async generators, mid-tool status yields | Upgrade 36 — add to Phase E |
| Skill marketplace | `.agents/skills/*.md` auto-discovery | Already designed: `agentskills.io` standard in CLAUDE.md |
| Provider-agnostic model routing | Single gateway for Claude/GPT/Gemini | Already have: DeepSeek + Claude routing in llm.ts |

### 10.4 What We Do Better (Be Clear)

| Area | Waldo Advantage |
|---|---|
| Per-user persistent memory | 5-tier (DO SQLite → R2). They use flat PostgreSQL. |
| Pre-filter savings | 60% LLM call reduction. They have no equivalent. |
| Nightly intelligence | Dreaming Mode. They don't compact or pre-compute. |
| Privacy architecture | Health data never in DO/R2 — only derived insights. |
| Cost efficiency | $0.01/user/day. Their model doesn't publish cost. |
| Health domain | Body signals, CRS, stress detection — not in their scope. |

---

## Appendix A: Claude Code Source File Map (Key Files)

| File | What It Does | Waldo Relevance |
|------|-------------|----------------|
| `src/QueryEngine.ts` | Central conversation orchestration | Our agent loop architecture |
| `src/Tool.ts` | Tool interface with metadata | Our tool system design |
| `src/query.ts` | Main agent loop (785KB, largest file) | Our ReAct implementation |
| `src/bootstrap/state.ts` | Global state singleton | Our Edge Function state management |
| `src/commands/compact/compact.ts` | 3-stage compaction pipeline | Our context management |
| `src/services/compact/microCompact.ts` | Free micro-compaction | Our pre-reasoning hook |
| `src/services/SessionMemory/` | Memory extraction + consolidation | Our memory daemon |
| `src/tools/AgentTool/runAgent.ts` | Sub-agent execution | Our Phase 3 specialist agents |
| `src/services/tools/toolOrchestration.ts` | Concurrent tool partitioning | Our tool execution engine |
| `src/services/api/withRetry.ts` | Retry with error classification | Our error handling |
| `src/constants/prompts.ts` | Dynamic prompt assembly | Our 25-field prompt builder |
| `src/hooks/` | Lifecycle hooks | Our 10-hook pipeline |

## Appendix B: Deep Research Documents (Created This Session)

| Document | Lines | Coverage |
|----------|-------|----------|
| `Docs/research/AGENT_MEMORY_AND_STATE_RESEARCH_2026.md` | 790 | Memory architectures, state management, self-evolution, context management, proactive patterns |
| `Docs/COMPETITIVE_RESEARCH_AGENT_SECURITY_RELIABILITY_COST.md` | 830 | OWASP Top 10, prompt injection defense, circuit breakers, cost optimization, evaluation, observability |

These contain the full detailed research backing the recommendations in this report.

## Appendix C: Source References

1. **Claude Code npm source leak** — Full TypeScript source extracted from `.map` file in published npm package (March 31, 2026, commit `5a774a`)
2. **CodeCoup** — "I Spent a Week Reverse Engineering the Claude Code Binary" (Medium, March 2026)
3. **DeepWiki** — `deepwiki.com/instructkr/claude-code` (40+ pages of analysis)
4. **Piebald-AI** — System prompt extraction project (v2.1.88)
5. **Kir Shatrov** — Claude Code Internals blog post
6. **vrungta** — Claude Code Architecture (Reverse Engineered) (Substack)
7. **Agiflow** — Claude Code Prompt Augmentation analysis
8. **Sabrina.dev** — Reverse Engineering Claude Code Using Sub Agents
9. **ZeroToPete** — Hidden Speculation Feature discovery
10. **BrightCoding** — Inside Claude Code Deep Dive

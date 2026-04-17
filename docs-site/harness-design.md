# Waldo Harness Design — Patterns from 17 Production Agent Systems

> **Sources:** Claude Code (1,905 TS files) · OpenHarness/HKUDS (337 Python files) · Hermes Agent · MemPalace · Cloudflare Project Think · JiuwenClaw · AtlanClaw + 11 others
> **Purpose:** Canonical reference for every architectural decision in `cloudflare/waldo-worker/src/agent.ts`

---

## The Harness Philosophy

> "The model is the agent. The code is the harness."
> — OpenHarness README

The harness is everything except the LLM's reasoning. It:
1. Assembles context (what the LLM sees)
2. Executes tools (what the LLM does)
3. Manages memory (what the LLM remembers)
4. Enforces safety (what the LLM can't do)
5. Handles failure (what happens when it breaks)

Waldo's LLM (Claude Haiku) is a commodity. The harness is the product.

---

## Part 1: The Agent Loop

### Current Waldo Implementation

```typescript
// agent.ts — runAgentLoop()
while (iteration < MAX_ITERATIONS) {
  const result = await callLLM(messages, { system, tools, maxTokens });
  if (result.stopReason === 'end_turn') break;
  for (const toolCall of result.toolCalls) {
    const output = await executeTool(toolCall.name, toolCall.input, ...);
    messages.push(toolResultMessage(toolCall.id, output));
  }
  iteration++;
}
```

### OpenHarness Pattern (More Robust)

Three improvements over our current implementation:

**1. Concurrent tool execution for read-only tools**

```typescript
// OpenHarness: asyncio.gather(return_exceptions=True) for multiple tool calls
// Our equivalent (TypeScript):
if (toolCalls.length > 1) {
  const results = await Promise.allSettled(
    toolCalls.map(tc => executeTool(tc.name, tc.input, ...))
  );
  // IMPORTANT: return_exceptions=True / allSettled — Anthropic API requires
  // a ToolResultBlock for EVERY ToolUseBlock or the next request is rejected
  for (const [i, result] of results.entries()) {
    messages.push(toolResultMessage(
      toolCalls[i].id,
      result.status === 'fulfilled' ? result.value : `Error: ${result.reason}`,
      result.status === 'rejected'
    ));
  }
}
```

**2. Pending continuation detection**

```typescript
// Before starting a new loop, check if previous one was interrupted
function hasPendingContinuation(messages: Message[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return false;
  return last.content.some(b => b.type === 'tool_result');
  // ToolResultBlocks in last user message = model never saw the results
}
// In alarm handler, before runPatrol():
if (hasPendingContinuation(getConversationHistory(this.sql, 5))) {
  await this.resumeFromCheckpoint();
  return;
}
```

**3. MaxTurnsExceeded as explicit exception, not silent stop**

```typescript
class MaxIterationsExceeded extends Error {
  constructor(iterations: number) {
    super(`Agent loop exceeded ${iterations} iterations`);
  }
}
// In runAgentLoop() — throw, don't silently return
if (iteration >= MAX_ITERATIONS) throw new MaxIterationsExceeded(MAX_ITERATIONS);
```

---

## Part 2: The 5-Stage Compaction Cascade

### Why This Matters

Our current nightly compaction calls Claude Haiku every time (stage 4 of 5). OpenHarness runs 3 free stages first, and stages 1-3 handle ~50-60% of cases without any LLM call.

```
Token budget:
  Context window: 200,000 tokens
  Max output: 600 tokens
  Auto-compact threshold: 200,000 - 600 - 13,000 = ~186,400 tokens

Reality: Morning Wag loop = ~3,000 tokens per run
30 days of episodes = ~90,000 tokens
Nightly compaction fires when episodes > 186,400 tokens
  → Currently calling LLM every time
  → Should use free stages first
```

### Implementation

```typescript
// In runDailyCompaction() — replace current LLM-first approach:

async function cascadeCompact(sql: SqlStorage): Promise<{ tokensFreed: number; method: string }> {
  const episodes = getRecentEpisodes(sql, 200);
  const currentTokens = estimateTokens(episodes);
  const THRESHOLD = 80_000; // tokens before compaction needed

  if (currentTokens < THRESHOLD) return { tokensFreed: 0, method: 'none' };

  // Stage 1: Microcompact (free) — strip old tool results
  const COMPACTABLE = ['get_crs', 'get_health', 'get_schedule', 'get_communication',
                       'get_tasks', 'get_mood', 'get_master_metrics'];
  const KEEP_RECENT = 5;
  let microFreed = 0;
  const toCompact = episodes.slice(0, -KEEP_RECENT)
    .filter(e => COMPACTABLE.includes(e.type ?? ''));
  for (const ep of toCompact) {
    const saved = estimateTokens(ep.content);
    markEpisodeContent(sql, ep.id, '[tool result cleared by microcompact]');
    microFreed += saved;
  }
  if (currentTokens - microFreed < THRESHOLD) {
    return { tokensFreed: microFreed, method: 'microcompact' };
  }

  // Stage 2: Context collapse (free) — truncate long text blocks
  const HEAD = 900, TAIL = 500;
  let collapseFreed = 0;
  for (const ep of episodes.slice(0, -12)) { // protect last 12
    if (ep.content.length > HEAD + TAIL + 200) {
      const collapsed = ep.content.slice(0, HEAD) +
        `\n...[${ep.content.length - HEAD - TAIL} chars collapsed]...\n` +
        ep.content.slice(-TAIL);
      const saved = estimateTokens(ep.content) - estimateTokens(collapsed);
      if (saved > 0) {
        markEpisodeContent(sql, ep.id, collapsed);
        collapseFreed += saved;
      }
    }
  }
  if (currentTokens - microFreed - collapseFreed < THRESHOLD) {
    return { tokensFreed: microFreed + collapseFreed, method: 'context_collapse' };
  }

  // Stage 3: Session memory summary (free) — replace bulk of history
  const recentEpisodes = episodes.slice(-12);
  const oldEpisodes = episodes.slice(0, -12);
  const sessionSummary = oldEpisodes
    .slice(-48) // max 48 lines
    .map(ep => `[${ep.created_at?.slice(0, 10)}] ${ep.role}: ${ep.content.slice(0, 160)}`)
    .join('\n')
    .slice(0, 4000);
  const sessionFreed = oldEpisodes.reduce((s, ep) => s + estimateTokens(ep.content), 0)
                       - estimateTokens(sessionSummary);
  // Archive old episodes, keep only summary + last 12
  archiveEpisodes(sql, oldEpisodes.map(e => e.id));
  addEpisode(sql, 'system', `[Session memory compacted]\n${sessionSummary}`, 'system', {});
  if (currentTokens - microFreed - collapseFreed - sessionFreed < THRESHOLD) {
    return { tokensFreed: microFreed + collapseFreed + sessionFreed, method: 'session_memory' };
  }

  // Stage 4: Full LLM compact (expensive) — only reaches here if free stages insufficient
  const summaryPrompt = buildStructuredCompactPrompt(recentEpisodes);
  const summary = await callLLMCompact(summaryPrompt);
  return { tokensFreed: currentTokens * 0.7, method: 'llm_compact' };
}
```

### Structured Compaction Prompt (Fix for Thin Workspace Files)

The root cause of `profile.md` being 26 bytes: open-ended prompts produce vague outputs.

```typescript
const COMPACT_PROMPT_TEMPLATE = `
You are compacting Waldo's memory. Produce EXACTLY the output format specified below.
Do NOT add sections. Do NOT use generic language. Use exact numbers from the data.

=== SECTION: COMPILED TRUTH ===
Write 2-3 sentences. Use exact values. Use this format:
"[METRIC] is [EXACT NUMBER/RANGE]. [TREND DIRECTION] vs [COMPARISON PERIOD]. [DRIVER IF KNOWN]."

EXAMPLE (follow this level of specificity):
"HRV drops 22-30% on Monday mornings (avg 38ms vs 54ms baseline). Worst day of week by 
18 points. Primary driver: short Sunday sleep (-1.3h below 6.8h weekday average)."

=== SECTION: TIMELINE ENTRY ===
One line: "[DATE]: [WHAT HAPPENED with exact values]"
Example: "2026-04-10: CRS 44 (low). 4 meetings. HRV alert at 9:47am. Email 58% after-hours."

Data to process:
${episodes.map(e => `[${e.created_at}] ${e.type}: ${e.content.slice(0, 200)}`).join('\n')}
`;
```

---

## Part 3: Capped LRU Carryover Buckets

### The Problem

Our `memory_blocks` KV store doesn't track:
- What tools were called this session (working context)
- What actions were verified complete (anti-hallucination)
- What's actively being worked on (focus anchor)

After compaction, the agent loses this working focus.

### Implementation

```typescript
// Add to agent.ts — after each tool execution in runAgentLoop():

const BUCKET_CAPS = {
  recent_work_log: 10,
  recent_verified_work: 10,
  active_focus: 5,
} as const;

function appendCappedUnique<T>(list: T[], item: T, cap: number): T[] {
  // LRU: remove if exists (any position), append to end, trim to cap
  const filtered = list.filter(x => JSON.stringify(x) !== JSON.stringify(item));
  return [...filtered, item].slice(-cap);
}

function updateCarryover(sql: SqlStorage, toolName: string, result: string, targetDate: string): void {
  const workLog = JSON.parse(getState(sql, 'recent_work_log') ?? '[]');
  const entry = {
    tool: toolName,
    date: targetDate,
    summary: result.slice(0, 160),
    ts: new Date().toISOString()
  };
  setState(sql, 'recent_work_log',
    JSON.stringify(appendCappedUnique(workLog, entry, BUCKET_CAPS.recent_work_log))
  );
}

// In runAgentLoop(), after executeTool():
for (const toolCall of result.toolCalls) {
  const output = await executeTool(toolCall.name, toolCall.input, ...);
  updateCarryover(this.sql, toolCall.name, output, targetDate);  // ← ADD THIS
  messages.push(toolResultMessage(toolCall.id, output));
}
```

### Surviving Compaction as Compact Attachments

```typescript
// In runDailyCompaction(), after session memory stage:
const carryover = {
  recent_work_log: JSON.parse(getState(sql, 'recent_work_log') ?? '[]'),
  active_focus: JSON.parse(getState(sql, 'active_focus') ?? '{}'),
};
// Inject as system note that survives compaction
addEpisode(sql, 'system',
  `[Carryover context]\nRecent work: ${JSON.stringify(carryover.recent_work_log.slice(-3))}\nFocus: ${JSON.stringify(carryover.active_focus)}`,
  'system', { is_carryover: true }
);
```

---

## Part 4: Per-Turn Synthetic Context Injection

### Problem

Our narrative builder queries all 6 dimensions at the start of `runAgentLoop()`. But on iteration 2+ of the ReAct loop, the model is working from the original snapshot — even if 30 seconds have passed and something changed. Also, the full narrative context gets embedded in history and never cleaned up.

### Pattern (from OpenHarness coordinator context)

```typescript
// In runAgentLoop() — before each LLM call:
const SYNTHETIC_CONTEXT_MARKER = '__synthetic__';

async function buildTurnMessages(
  baseMessages: Message[],
  freshNarrative: string
): Promise<Message[]> {
  // Inject fresh context as synthetic first user message
  const syntheticMsg: Message = {
    role: 'user',
    content: `<turn-context>\n${freshNarrative}\n</turn-context>`,
    _synthetic: SYNTHETIC_CONTEXT_MARKER,  // marker for removal
  };
  return [syntheticMsg, ...baseMessages.filter(m => !(m as any)._synthetic)];
}

// In the loop — rebuild context each iteration:
for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
  const freshNarrative = await buildNarrativeContext(userId, targetDate, this.env);
  const turnMessages = await buildTurnMessages(messages, freshNarrative);
  const result = await callLLM(turnMessages, { system, tools, maxTokens });
  // Only push tool results to REAL messages — not the synthetic wrapper
  for (const tc of result.toolCalls) {
    const output = await executeTool(tc.name, tc.input, ...);
    messages.push(toolResultMessage(tc.id, output));
  }
}
```

---

## Part 5: Safety Architecture

### Current Waldo Safety Layers (from `agent.ts`)

```
L1: Emergency keyword detection → immediate abort + static response
L2: Medical claim detection → rephrase → add disclaimer
L3: Per-trigger tool permissions → scoped tool set per trigger type
L4: Memory injection detection → reject update_memory with blocked patterns
L5: URL allowlist in safeFetch() → no outbound calls to unlisted hosts
L6: Cost cap gate → silence after $0.10/user/day
```

### What OpenHarness Adds (Adopt These)

**Hardcoded sensitive path block (L7):**

OpenHarness `SENSITIVE_PATH_PATTERNS` — paths that are absolutely denied regardless of any config:
```typescript
// In tools.ts executeTool() — add before ANY tool execution:
const WALDO_BLOCKED_PATHS = [
  'agent/soul/**',      // soul files — read-only via file system
  'agent/identity/**',  // identity — immutable
  '.env',
  '.env.*',
];
function isSensitivePath(input: Record<string, unknown>): boolean {
  const path = (input?.path ?? input?.file ?? '') as string;
  return WALDO_BLOCKED_PATHS.some(p => minimatch(path, p));
}
```

**Prompt hook for action gates (L8):**

Before executing `propose_action` or `execute-proposal`:
```typescript
// Lightweight safety LLM call (~50 tokens):
async function promptHookSafetyCheck(action: ProposedAction): Promise<{ok: boolean; reason?: string}> {
  const result = await callLLM([{
    role: 'user',
    content: `Is this agent action safe and reversible? Answer {ok: true} or {ok: false, reason: "..."}\n
    Action: ${JSON.stringify(action)}`
  }], { system: 'Return strict JSON only: {"ok": true} or {"ok": false, "reason": "string"}', maxTokens: 50 });
  try { return JSON.parse(result.text); }
  catch { return { ok: false, reason: 'parse error' }; }
}
```

**`return_exceptions` pattern for concurrent tool calls (L9):**

```typescript
// When running multiple tools concurrently, ALWAYS use allSettled:
const results = await Promise.allSettled(toolCalls.map(tc => executeTool(tc.name, tc.input)));
// Never use Promise.all() — one failure would leave orphaned ToolUseBlocks
```

---

## Part 6: Tool Architecture

### Tool Registration Pattern

```typescript
// Current: tools are a flat array passed to getToolsForTrigger()
// Better: typed registry with metadata

interface ToolRegistration {
  definition: Tool;           // Anthropic API schema
  execute: ExecutorFn;        // async (input, ctx) => string
  isReadOnly: boolean;        // for parallel execution decision
  triggers: TriggerMode[];    // which triggers can access this tool
  requiresConfirmation?: boolean; // for prompt hook
}

const TOOL_REGISTRY: Map<string, ToolRegistration> = new Map([
  ['get_crs', {
    definition: GET_CRS_TOOL,
    execute: executeCrs,
    isReadOnly: true,
    triggers: ['morning_wag', 'fetch_alert', 'evening_review', 'conversational'],
  }],
  ['propose_action', {
    definition: PROPOSE_ACTION_TOOL,
    execute: executePropose,
    isReadOnly: false,
    triggers: ['morning_wag', 'evening_review', 'conversational'],
    requiresConfirmation: true,  // triggers prompt hook
  }],
]);
```

### Tool Output Compression

From OpenHarness — tool outputs are always strings, capped before injection:

```typescript
const TOOL_OUTPUT_MAX_TOKENS = 500;

function compressToolOutput(name: string, output: string): string {
  const tokens = estimateTokens(output);
  if (tokens <= TOOL_OUTPUT_MAX_TOKENS) return output;
  // Keep head + tail with retrieval marker
  const head = output.slice(0, 800);
  const tail = output.slice(-200);
  return `${head}\n...[${tokens - TOOL_OUTPUT_MAX_TOKENS} tokens compressed — call ${name}(detail=true) for full output]...\n${tail}`;
}
// Apply in executeTool() before returning
return compressToolOutput(name, rawOutput);
```

---

## Part 7: Memory Architecture

### Tier Map (5 tiers, current implementation)

| Tier | Storage | Where | Latency | When Loaded |
|---|---|---|---|---|
| 0 | Working | LLM context window | 0ms | Each invocation (volatile) |
| 1 | Semantic | DO SQLite `memory_blocks` | <1ms | Always (<200 tokens) |
| 2 | Episodic | DO SQLite `episodes` (0-90d) | <5ms | On-demand (search_episodes) |
| 3 | Workspace | R2 markdown files | ~50ms | Always (profile + baselines + today) |
| 4 | Archival | Supabase pgvector | ~100ms | On-demand (semantic search, Phase 2) |

### The 6 Memory Halls (hall_type column in memory_blocks)

```sql
-- Current schema already has hall_type, but values are underutilized
-- hall_type values and their load policy:
hall_facts       → loaded ALWAYS (identity, baselines, device) — ~50 tokens
hall_events      → loaded for morning_wag + evening_review — ~100 tokens
hall_discoveries → loaded for conversational + deep queries — ~200 tokens
hall_preferences → loaded ALWAYS (communication style) — ~50 tokens
hall_advice      → loaded for fetch_alert (what works for this user) — ~80 tokens
hall_insights    → loaded for morning_wag synthesis — ~100 tokens
```

### Compiled Truth + Timeline (Future Migration, Phase F)

Currently `memory_blocks.value` is a flat string. Migration target:

```sql
-- Phase F migration
ALTER TABLE memory_blocks ADD COLUMN compiled_truth TEXT;  -- rewriteable
ALTER TABLE memory_blocks ADD COLUMN timeline TEXT;        -- append-only
ALTER TABLE memory_blocks ADD COLUMN valid_from TIMESTAMPTZ DEFAULT now();
ALTER TABLE memory_blocks ADD COLUMN valid_to TIMESTAMPTZ;  -- NULL = still valid
ALTER TABLE memory_blocks ADD COLUMN superseded_by TEXT;    -- links to replacement

-- Never DELETE memory pages — mark as ended:
UPDATE memory_blocks SET valid_to = now(), superseded_by = $new_key
WHERE key = $old_key AND user_id = $user_id;
```

---

## Part 8: Error Handling & Recovery

### Error Taxonomy (from OpenHarness + Claude Code)

```typescript
type ErrorCategory =
  | 'transient'        // Network blip, retry immediately
  | 'capacity'         // 429/503, retry with backoff
  | 'permanent'        // 400 invalid input, don't retry
  | 'prompt_too_long'  // Context overflow, compact then retry
  | 'compaction_fail'; // Compaction itself failed, deliver without fresh context

// In callLLM():
function classifyError(err: unknown): ErrorCategory {
  if (err instanceof NetworkError) return 'transient';
  const status = (err as any)?.status;
  if (status === 429 || status === 503) return 'capacity';
  if (status === 400) {
    const msg = (err as any)?.message ?? '';
    if (msg.includes('prompt is too long') || msg.includes('max_tokens')) return 'prompt_too_long';
    return 'permanent';
  }
  return 'transient';
}

// Retry strategy by category:
const RETRY_STRATEGY: Record<ErrorCategory, RetryConfig> = {
  transient:        { maxRetries: 3, delayMs: 1000, backoff: 2.0 },
  capacity:         { maxRetries: 3, delayMs: 1000, backoff: 2.0 }, // honor Retry-After header
  permanent:        { maxRetries: 0, delayMs: 0, backoff: 1.0 },
  prompt_too_long:  { maxRetries: 1, delayMs: 0, backoff: 1.0, compactFirst: true },
  compaction_fail:  { maxRetries: 0, delayMs: 0, backoff: 1.0, fallbackToTemplate: true },
};
```

### Compaction Circuit Breaker

```typescript
// In runDailyCompaction():
const consecutiveFailures = parseInt(getState(this.sql, 'compaction_failures') ?? '0');
if (consecutiveFailures >= 3) {
  // Don't let compaction block Morning Wag delivery
  log('warn', 'compaction_suppressed', { consecutiveFailures });
  return; // Deliver without fresh context
}
try {
  await cascadeCompact(this.sql);
  setState(this.sql, 'compaction_failures', '0');
} catch (err) {
  setState(this.sql, 'compaction_failures', String(consecutiveFailures + 1));
  log('error', 'compaction_failed', { error: String(err), attempt: consecutiveFailures + 1 });
}
```

---

## Part 9: Observability (Structured Traces)

Every agent invocation produces a complete trace (already partially implemented):

```typescript
interface AgentTrace {
  trace_id: string;              // UUID — groups all actions in one invocation
  user_id: string;
  trigger_type: TriggerMode;
  tools_called: string[];        // tool names only, no health values
  iterations: number;
  total_tokens_in: number;
  total_tokens_out: number;
  cache_read_tokens: number;     // prompt caching savings
  latency_ms: number;
  delivery_status: 'sent' | 'fallback' | 'suppressed' | 'failed' | 'cost_capped';
  llm_provider: 'anthropic' | 'deepseek' | 'template';
  compaction_method?: 'microcompact' | 'context_collapse' | 'session_memory' | 'llm_compact' | 'none';
  estimated_cost_usd: number;
  workspace_context_loaded: boolean;
  workspace_age_hours: number;   // how fresh were the R2 files?
  pre_filter_fired: boolean;
  carryover_bucket_sizes: Record<string, number>;
}
// Stored in agent_logs table (already exists)
// Queryable for: cost per trigger, cache hit rates, compaction frequency, pre-filter effectiveness
```

---

## Part 10: The Coordinator Pattern (Phase 2+)

### When to Spawn a Sub-Agent

From OpenHarness coordinator system prompt (directly applicable to Waldo's specialist agents):

| Query type | Handle in Brain DO | Spawn SleepAgent Facet | Spawn ProductivityAgent Facet |
|---|---|---|---|
| "How am I today?" | ✅ | — | — |
| "Analyze my sleep patterns over 3 months" | — | ✅ (deep sleep analysis) | — |
| "Help me optimize next week's calendar" | — | — | ✅ (task + schedule) |
| "Why do I crash on Mondays?" | — | ✅ + WaldoBrain synthesizes | ✅ + WaldoBrain synthesizes |

### Coordinator System Prompt Anti-Pattern

From OpenHarness — the hardest-to-learn rule:

> ❌ **Wrong:** "Based on your findings about the user's sleep patterns, suggest improvements."
> ✅ **Right:** "The user's sleep debt is 3.2 hours (vs 7.5h target), with Monday sleep averaging 5.1h (-1.3h below weekday baseline). 14 Monday crashes detected across 85 days. Propose exactly 2 interventions that address Sunday evening directly."

The coordinator synthesizes before delegating. Workers receive specific prompts with exact values and dates. They never receive "based on your analysis" — that's the coordinator's job.

---

## Summary: Where Waldo's Harness Is Strong and Where It's Weak

### ✅ Strong (production-grade)
- Per-trigger tool permissions (better than OpenHarness's flat set)
- Memory context fencing (`<memory-context>` tags, Upgrade #19)
- Pre-filter bypass (CRS > 60 && stress < 0.3 → template)
- Domain-specific tools (get_crs, get_master_metrics, get_correlations)
- R2 workspace (persistent LLM wiki, OpenHarness has nothing equivalent)
- Cost cap gate ($0.10/user/day)
- Multi-provider fallback (Anthropic → DeepSeek)

### ❌ Weak (gaps vs OpenHarness)
- Compaction: LLM-first instead of cascade (Upgrade #39, #44)
- No pending continuation recovery (Upgrade #41)
- No capped carryover buckets — working focus lost across resets (Upgrade #40)
- Narrative context pollutes history — no synthetic injection/removal (Upgrade #42)
- No structured error taxonomy — same fallback for all failures
- Single LLMClient interface — Anthropic and DeepSeek are parallel functions, not polymorphic
- Workspace files too thin — open-ended compaction prompts (Upgrade #44)

### Prioritized Harness Fixes (3-4 days total)

| Day | Fix | Impact |
|---|---|---|
| Day 1 | Structured compaction templates (Upgrade #44) | Fixes thin workspace files immediately |
| Day 1 | Pending continuation recovery (Upgrade #41) | Fixes silent Morning Wag failures |
| Day 2 | 5-stage compaction cascade (Upgrade #39) | 40-60% fewer nightly LLM calls |
| Day 2-3 | Capped carryover buckets (Upgrade #40) | Agent focus persists across resets |
| Day 3 | Per-turn synthetic context injection (Upgrade #42) | Agent always sees fresh data |

---

> **See also:**
> - [upgrade-report.md](./upgrade-report.md) — All 44 upgrades from 17 agent systems
> - [second-brain-architecture.md](./second-brain-architecture.md) — LLM wiki, memory model, self-improvement
> - [cloudflare-agents-week-analysis.md](./cloudflare-agents-week-analysis.md) — Project Think, Dynamic Workers, AI Gateway
> - [scaling-infrastructure.md](./scaling-infrastructure.md) — DO + R2 + Sandbox architecture

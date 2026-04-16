# Cloudflare Agents Week + Project Think — Waldo Architecture Analysis

> **Date:** April 2026
> **Sources:** [Project Think](https://blog.cloudflare.com/project-think/), [Agents Week](https://blog.cloudflare.com/welcome-to-agents-week/)
> **Purpose:** Map what's useful, what we already built, and what to adopt — in exact priority order.

---

## The Core Insight

Project Think is Cloudflare building **general-purpose agent infrastructure**. Waldo's moat is **domain-specific health + life intelligence** layered on top. These don't compete — they compose. Cloudflare handles the plumbing. Waldo handles the soul, the CRS engine, the cross-domain intelligence, and the 12-adapter data flywheel.

The right question is not "should we use Think?" — it's "which Think primitives unlock us faster than building them ourselves?"

---

## What Cloudflare Announced

| Product | Status | What It Is |
|---|---|---|
| **Dynamic Workers** | **Open Beta** | V8 isolates spawned at runtime in milliseconds. Core Code Mode primitive. |
| **Container Sandboxes** | **GA** | Full OS containers (git, python, bash). The Sandbox we already documented. |
| **Project Think SDK** | **Preview** | Opinionated base class: Think = DO + Fibers + Sessions Tree + Facets + Extensions |
| **Browser Run** | **GA** | Headless browser for agent web interaction |
| **AI Gateway** | **GA** | Proxy layer: caching, observability, fallbacks, rate limits for all LLM calls |
| **Workers AI** | **GA** | Cloudflare-hosted inference (Kimi K2.5, Llama, etc.) |
| **MCP Infrastructure** | **In development** | Cloudflare-hosted remote MCP servers + open-source implementations |
| **x402** | **Standard published** | HTTP 402 payment for agent-to-agent service consumption |

---

## Deep Comparison: Waldo vs Project Think Primitives

### 1. Durable Execution (Fibers) — WE DON'T HAVE THIS ❌

**What Think has:**
```typescript
void this.runFiber("morning-patrol", async (ctx) => {
  const result = await callLLM(...);  // Can take 10-30s
  ctx.stash({ result });              // Checkpoint BEFORE next step
  await deliverViaTelegram(result);
});
// If DO restarts mid-call → auto-resumes from stash
```

**What we have:** Raw async calls with no checkpointing. If the DO is evicted during a 25-second Morning Wag (common for large prompts), the user never gets it. No recovery, no replay.

**Impact today:** Silent Morning Wag failures. Bootstrap pipeline (~25s) can fail halfway. Nightly compaction has no durability guarantee.

**Action:** Wrap our core DO operations (`runPatrol`, `runDailyCompaction`, `handleProvision`) in a fiber-compatible pattern. When Think hits GA, migrate to `runFiber()`. Until then: implement retry logic with agent_state checkpointing as a stopgap.

---

### 2. Sub-agent Facets — WE PLANNED BUT NOT BUILT ⚠️

**What Think has:**
```typescript
const sleepAnalyst = await this.subAgent(SleepAgent, "sleep");
const productivityAgent = await this.subAgent(ProductivityAgent, "productivity");
const [sleep, schedule] = await Promise.all([
  sleepAnalyst.analyze(userId),
  productivityAgent.optimize(userId)
]);
return this.synthesize(sleep, schedule);
```
Each sub-agent = isolated DO with own SQLite, own conversation tree, own tools, own model.

**What we have:** Single monolithic `WaldoAgent` DO handling all 6 dimensions. The agent's 15 tools cover everything but there's no isolation or specialization. Context gets crowded when all dimensions are active.

**What we need this for (from our vision doc):**
- `SleepAgent` — 90-day HRV/sleep pattern depth, sleep debt modeling
- `ProductivityAgent` — task reshaping, calendar optimization, The Handoff
- `BioIntelAgent` — exposes CRS/stress/cognitive load to external MCP clients
- `WaldoBrain` — coordinator DO that delegates and synthesizes

**Action:** Design the Facets architecture now. Implement in Phase 2 once Think hits GA.

---

### 3. Sessions Tree — WE HAVE A FLAT TABLE ⚠️

**What Think has:**
```typescript
const session = this.sessions.create("main");
// Later:
const fork = this.sessions.fork(session.id, messageId, "alternative-route");
// FTS5 search:
const hits = session.search("Monday crash HRV");
```
Conversations are trees, not lists. Non-destructive compaction. Fork for "what if?" branches.

**What we have:** Flat `conversation_history` table in Supabase. Linear. Can't branch. Compaction deletes. No FTS across history (only DO SQLite episodes have FTS5 via `search_episodes` tool).

**Why the tree matters for Waldo:**
- Morning Wag should branch separately from chat (right now it pollutes conversational context)
- "What if I reschedule my 9am?" → fork → simulate → return without affecting real history
- The Constellation is TODAY built from spots; a sessions tree would make it richer
- `search_episodes` (our custom FTS5 on DO episodes) is the right instinct — but only covers DO, not Supabase history

**Action:** Plan the sessions tree migration for Phase F. Add `parent_id` to `conversation_history` table. Separate morning_wag / fetch_alert branches from conversational branches.

---

### 4. Context Blocks — WE HAVE THIS (AS WORKSPACE) ✅

**What Think has:**
```typescript
.withContext("soul", { provider: { get: async () => soulContent } })
.withContext("memory", { description: "Important facts...", maxTokens: 2000 })
.withCachedPrompt();
```

**What we have:** `loadWorkspaceContext()` in `workspace.ts` loads `profile.md + baselines.md + today.md + capabilities.md` from R2 and injects them into the system prompt as `<workspace-context type="...">` tagged sections.

**Difference:** Think uses `withCachedPrompt()` to cache the system prompt automatically. We manually set `cache_control: { type: 'ephemeral' }` on system blocks. Functionally equivalent, slightly more verbose.

**Action:** We're already doing this well. When we migrate to Think, `configureSession()` is the mapping point.

---

### 5. Self-Authored Extensions / Dynamic Workers — PLANNED, NOT BUILT ❌

**What Think has:**
```json
{
  "name": "cognitive-load-engine",
  "tools": ["compute_load", "predict_tomorrow"],
  "permissions": { "network": [], "workspace": "read-only" }
}
```
Agent writes TypeScript, Think bundles it, executes in Dynamic Worker (2ms startup, V8 isolate). Zero network by default. Grant explicit capabilities.

**What we have:** Our ReAct loop calls 15 tools. Deterministic math (cognitive load formula, trend calculation, sleep debt) runs as LLM tool calls — expensive, variable, token-heavy.

**This is Code Mode.** Dynamic Workers are **now in Open Beta.**

The full execution ladder Think describes maps to exactly what we planned in `scaling-infrastructure.md`:

| Think Tier | Our Name | Status |
|---|---|---|
| Tier 0: Workspace | R2 workspace (profile.md etc.) | ✅ Built |
| Tier 1: Dynamic Worker | Code Mode | ❌ Not built (Open Beta available) |
| Tier 2: + npm | Code Mode with libraries | ❌ Future |
| Tier 3: Browser Run | Not needed for Waldo | Skip |
| Tier 4: Cloudflare Sandbox | Phase E+ (Python analytics) | ❌ Documented, not built |

**Dynamic Workers are Open Beta. This is Phase E. We should ship Code Mode NOW.**

---

### 6. Think Base Class — DON'T MIGRATE YET ⚠️

**What Think provides as a base class:**
- ReAct loop management (we have our own, ~500 lines)
- Streaming and abort semantics
- Message persistence after each turn
- Lifecycle hooks (beforeTurn, afterToolCall, onStepFinish)
- `getModel()` using AI SDK provider format (works with Workers AI, Anthropic via adapter)

**What we'd lose by migrating prematurely:**
- Soul files (SOUL_BASE, zone modifiers, mode templates) — not in Think's model
- CRS-aware pre-filter (skip Claude when CRS > 60) — not in Think's model
- Per-trigger tool permissions (morning_wag ≠ fetch_alert ≠ conversational) — not in Think's model
- Cross-domain narrative builder (our 6-dimension pre-query before ReAct) — not in Think's model
- Health-specific architecture (health data stays in Supabase, DO only has derived insights)

**Think is Preview — APIs will change.** Migrating a working production agent to an experimental base class is high risk, low reward right now.

**Action:** Design our agent to be Think-compatible (modular hooks, clear lifecycle). Migrate `WaldoAgent extends DurableObject<Env>` → `WaldoAgent extends Think<Env>` when Think hits GA. Map our patterns:

| Waldo Pattern | Think Equivalent |
|---|---|
| `loadWorkspaceContext()` | `configureSession().withContext()` |
| `buildSystemPrompt()` | `getSystemPrompt()` override |
| `getToolsForTrigger()` | `getTools()` override |
| Soul prompt | `withContext("soul", ...)` |
| `runPatrol()` | `runFiber("patrol", ...)` |
| `runDailyCompaction()` | `runFiber("compaction", ...)` |

---

## What We Should Adopt RIGHT NOW

### 1. ✅ AI Gateway — 1-line change, massive observability gain

**What:** Route all LLM calls through `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/anthropic` instead of `https://api.anthropic.com/v1/messages`.

**Zero behavior change. Gains:**
- Full dashboard: every LLM call, tokens, cost, latency, model
- Semantic caching: Cloudflare caches semantically similar prompts (30-40% reduction for Morning Wag patterns)
- Automatic fallback: if Anthropic is slow → reroute to DeepSeek automatically
- Rate limit monitoring: alerts before you hit API limits
- Cost alerts: spend tracking per model

**Change needed in `llm.ts` line 71:**
```typescript
// Before:
const res = await fetch('https://api.anthropic.com/v1/messages', ...);
// After:
const res = await fetch('https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/waldo/anthropic/v1/messages', ...);
```

Same for DeepSeek endpoint. That's it.

---

### 2. ✅ Dynamic Workers for Code Mode — Phase E, NOW POSSIBLE

**Current cost per Morning Wag:**
- 3 ReAct iterations × ~2,500 tokens = ~7,500 tokens per invocation
- Cost: ~$0.01/call → ~$0.30/user/month

**Code Mode cost per Morning Wag:**
- 1 LLM call (narrative generation) = ~1,500 tokens
- Deterministic work (cognitive load, trend direction, sleep debt) runs in Dynamic Worker ($0.0000001/call)
- Cost: ~$0.002/call → ~$0.06/user/month

**81% reduction. At 10K users: $3,000/month → $600/month.**

**Implementation (3-4 days):**

```typescript
// In agent.ts — instead of ReAct loop for morning_wag:
if (triggerType === 'morning_wag' && canUseCodeMode(crsScore)) {
  const preComputed = await runCodeMode({
    script: MORNING_WAG_COMPUTE_SCRIPT,  // Static TypeScript function
    data: { crs, health, calendar, email, tasks, masterMetrics },
    permissions: { network: [] },        // Zero network access
  }, env);
  // preComputed: { cognitiveLoad, sleepDebt, focusWindow, taskPriority, ... }
  // Then 1 Claude call: "Write Morning Wag given these facts: ..."
}
```

The `MORNING_WAG_COMPUTE_SCRIPT` is a pure TypeScript function:
```typescript
function computeMorningContext(data) {
  const cogLoad = (data.calendar.mls / 15) * 30 + data.email.afterHoursRatio * 25 + ...;
  const focusWindow = data.calendar.focusGaps.sort((a,b) => b.durationMinutes - a.durationMinutes)[0];
  const urgentTask = data.tasks.urgent_titles[0];
  const trend = data.crs.trend === 'improving' ? 'momentum is building' : 'take it steady';
  return { cogLoad, focusWindow, urgentTask, trend, sleepDebt: data.masterMetrics.sleep_debt };
}
```

---

### 3. ✅ MCP Infrastructure — Use Cloudflare's framework for our MCP server

**What we have:** `supabase/functions/mcp-server/index.ts` — scaffold only, no protocol.

**What Cloudflare is providing:** Open-source MCP server framework on Workers. We should build our MCP server on this instead of from scratch.

**Why this matters (strategic moat):** Every AI agent ecosystem (Claude Code, Cursor, OpenAI Agents SDK, Lindy, Manus) is adopting MCP. When external agents call:
```
mcp.heywaldo.in/getCRS → returns { score: 74, zone: "steady" }
mcp.heywaldo.in/getStressLevel → returns { confidence: 0.78, recommendation: "breathe" }
mcp.heywaldo.in/getCognitiveWindow → returns { peak: "10am-12pm", dip: "2pm-3pm" }
```
They're not building a health app. They're using Waldo as their biological intelligence layer. This is the 10x platform moat.

---

## What We Can Plan Now and Ship in Phase F-G

### 4. Sessions Tree Migration (Phase F)

Add `parent_id UUID` to `conversation_history` table. Separate triggers into branches:
```
[conversation tree root]
├── [branch: morning_wag_2026_04_14]    ← Morning Wag is its own branch
├── [branch: fetch_alert_2026_04_14_2]  ← Each Fetch Alert is isolated
└── [branch: chat]                       ← Conversational thread
    ├── "how am I doing?"
    └── "what about my meetings?"
```

Morning Wag no longer pollutes chat context. "What if?" forks don't destroy real history.

### 5. Sub-agent Facets Architecture (Phase 2)

When Think hits GA:
```typescript
export class WaldoBrain extends Think<Env> {
  async handleComplexQuery(query: string, userId: string) {
    const sleep = await this.subAgent(SleepAnalystAgent, `sleep-${userId}`);
    const productivity = await this.subAgent(ProductivityAgent, `prod-${userId}`);
    // Each sub-agent has isolated SQLite, own conversation history, own tools
    const [sleepInsight, scheduleOptimization] = await Promise.all([
      sleep.analyze(userId),
      productivity.optimize(userId)
    ]);
    return this.synthesize(sleepInsight, scheduleOptimization, query);
  }
}
```

**Specialist sub-agents map to our vision doc:**
- `SleepAnalystAgent` — deep sleep analysis, HRV correlation, sleep debt modeling
- `ProductivityAgent` — task reshaping, calendar optimization, focus windows
- `BioIntelAgent` — biological intelligence MCP server surface
- `WaldoBrain` — coordinator and user-facing interface

### 6. x402 Integration (Phase 3)

When Waldo is an MCP server, external agents pay for biological intelligence queries:
- `getCRS()` → $0.0001 per call (Waldo reads from Supabase, returns score)
- `getStressLevel()` → $0.0002 per call
- `getCognitiveWindow()` → $0.0005 per call (requires inference)

Using x402 (HTTP 402 + Coinbase payment): external agents can consume Waldo intelligence programmatically and pay per-query. This creates a new revenue stream at zero marginal cost.

---

## What We Already Have That Think Doesn't

Project Think is general-purpose. Waldo has domain-specific advantages Think can't replicate:

| Waldo Has | Why It Matters |
|---|---|
| **CRS 3-pillar engine** (Recovery/CASS/ILAS) | Science-grounded readiness score with pillar drag attribution |
| **12-adapter data flywheel** | 32 metrics across 6 life dimensions — no general agent has this |
| **Cross-domain correlation engine** | "After-hours email → worse sleep next day" — unique to Waldo |
| **R2 workspace (bootstrapped)** | Claude-analyzed historical intelligence loaded on every invocation |
| **Soul files** (SOUL_BASE, zone modifiers) | Warm, specific, non-clinical voice — competitive differentiation |
| **Per-trigger tool permissions** | Morning Wag ≠ Fetch Alert ≠ Conversational — no wasted tokens |
| **Health data privacy architecture** | Raw health values never leave Supabase with RLS — compliance-ready |
| **Waldo Moods** (mascot SVGs for 8 zones) | Brand personality tied to biological state |

These are Waldo's moat. Think handles the runtime plumbing. We own the intelligence and the data.

---

## Priority Decision Matrix

| Action | Effort | Impact | When | Why |
|---|---|---|---|---|
| **AI Gateway routing** | 2 lines of code | High (observability + caching) | **This week** | Zero risk, free gains |
| **Dynamic Workers / Code Mode** | 3-4 days | Very High (81% cost reduction) | **Phase E, NOW** | Open Beta = ship it |
| **Fiber checkpointing stopgap** | 1 day | Medium (reliability) | This sprint | Morning Wag failures are silent |
| **MCP server on CF infrastructure** | 1 week | Very High (platform moat) | Phase 2 | Cloudflare is building the framework |
| **Sessions tree migration** | 3 days | Medium (branch isolation, FTS) | Phase F | Dependent on schema migration |
| **Sub-agent Facets architecture** | 2-3 weeks | Very High (specialist intelligence) | Phase 2 | Requires Think GA |
| **Think base class migration** | 1 week | Medium (future-proofing) | Phase F/G | Wait for GA, not Preview |
| **x402 monetization** | 2 days | High (revenue from platform moat) | Phase 3 | Requires MCP server first |

---

## Immediate Code Changes (This Session)

### Change 1: Route through AI Gateway

In `cloudflare/waldo-worker/src/llm.ts`:

```typescript
// BEFORE
'https://api.anthropic.com/v1/messages'

// AFTER — set CLOUDFLARE_AI_GATEWAY_URL as a secret
const gatewayBase = env.CLOUDFLARE_AI_GATEWAY_URL ?? 'https://api.anthropic.com';
`${gatewayBase}/v1/messages`
```

Set secret: `wrangler secret put CLOUDFLARE_AI_GATEWAY_URL` → `https://gateway.ai.cloudflare.com/v1/{account_id}/waldo/anthropic`

### Change 2: Dynamic Worker binding in wrangler.toml

```toml
[[unsafe.bindings]]
name = "AI"
type = "ai"

[durable_objects.sqlite_classes]
WaldoAgent = "WaldoAgent"
```

Then in agent.ts, Code Mode pre-compute for morning_wag/evening_review before the ReAct loop.

---

## Architecture After Adopting This

```
┌─────────────────────────────────────────────────────────────────┐
│  Request arrives at Waldo Worker                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
            ┌───────────▼────────────┐
            │   WaldoAgent DO         │  (extends DurableObject today)
            │   + R2 workspace        │  (extends Think<Env> in Phase F)
            │   + SQLite memory       │
            └───────────┬────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
   SOUL PROMPT    NARRATIVE       CODE MODE
   (context       BUILDER         (Dynamic Worker)
   blocks from    (6-dimension    - cognitive load math
   workspace)     parallel        - trend direction
                  Supabase        - sleep debt
                  queries)        - focus window
          │             │             │
          └─────────────┼─────────────┘
                        │
            ┌───────────▼────────────┐
            │   AI GATEWAY            │  ← NEW
            │   (Anthropic + DeepSeek │
            │   with caching + alerts)│
            └───────────┬────────────┘
                        │
            ┌───────────▼────────────┐
            │   Claude Haiku 4.5      │
            │   OR DeepSeek (fallback)│
            └────────────────────────┘
```

---

> **Summary:** Project Think is building the general agent runtime. We adopt what's GA/Beta (AI Gateway, Dynamic Workers). We plan Think migration for Phase F when it's stable. We keep Waldo's domain-specific intelligence — the CRS engine, the soul, the 12-adapter data flywheel — as our permanent differentiation. No other agent has both body signals AND life context. That's the moat.

---

*See also:*
- [scaling-infrastructure.md](./scaling-infrastructure.md) — DO + R2 + Sandbox architecture
- [architecture-roadmap.md](./architecture-roadmap.md) — Phase-by-phase status
- [upgrade-report.md](./upgrade-report.md) — 18 upgrades from agent landscape research

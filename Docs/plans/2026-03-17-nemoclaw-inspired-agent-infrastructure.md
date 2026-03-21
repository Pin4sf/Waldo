# NemoClaw-Inspired Agent Infrastructure for OneSync

**Date:** March 17, 2026
**Status:** Implementation Plan
**Inspired by:** [NVIDIA NemoClaw](https://github.com/NVIDIA/NemoClaw) architecture patterns
**Cross-references:** AGENT_AND_BACKEND.md, COSTS_AND_ROADMAP.md, MVP_ENGINEERING_PRD.md

> Five infrastructure systems that make OneSync's AI agent versioned, observable, safe, and rollback-capable. Adapted from NemoClaw's production patterns for NVIDIA's autonomous agent sandboxing.

---

## Table of Contents

1. [Blueprint / Versioned Agent Configurations](#1-blueprint--versioned-agent-configurations)
2. [Transparent Inference Middleware](#2-transparent-inference-middleware)
3. [Declarative Policy System for Agent Permissions](#3-declarative-policy-system-for-agent-permissions)
4. [Operator-in-the-Loop Escalation](#4-operator-in-the-loop-escalation)
5. [Plan-Apply-Rollback Lifecycle](#5-plan-apply-rollback-lifecycle)
6. [Implementation Timeline](#6-implementation-timeline)
7. [Supabase Schema Additions](#7-supabase-schema-additions)
8. [Claude Code Project Setup](#8-claude-code-project-setup)

---

## 1. Blueprint / Versioned Agent Configurations

### What NemoClaw Does

NemoClaw packages all orchestration logic into versioned, digest-verified "blueprint" artifacts. Each blueprint is immutable once deployed, fetched from OCI registries, and supports plan/apply/rollback. The agent inside the sandbox has no idea which blueprint version created it.

### Why OneSync Needs This

OneSync's agent behavior depends on scattered config: soul files, tool definitions, CRS thresholds, model routing rules, prompt templates, stress confidence gates, and cooldown values. Currently, changing any of these is a raw file edit with no versioning, no rollback, no A/B testing, and no way to trace which config produced a given conversation.

With 5 beta testers giving feedback in Week 7-8, you need to iterate on agent personality and thresholds fast -- and roll back instantly when something breaks trust.

### Architecture

```
supabase/
  functions/
    _shared/
      blueprints/           # Blueprint storage (version-controlled)
        v0.1.0/
          manifest.json     # Version metadata, digest, compatibility
          souls/
            base.md         # Always-loaded personality (Block 1 cache)
            stress-alert.md # Mode: proactive stress intervention
            morning-brief.md# Mode: morning briefing
            conversational.md # Mode: user-initiated chat
            weekly-review.md  # Mode: weekly analysis (Phase 2)
          tools/
            definitions.json  # All tool schemas (8 MVP, expandable)
            routing.json      # Trigger type -> tool subset mapping
          thresholds/
            stress.json       # Confidence thresholds, cooldowns, gates
            crs-weights.json  # Component weights (sleep 0.35, hrv 0.25, etc.)
          models/
            routing.json      # Severity -> model mapping, fallback chains
          prompts/
            body-l0.template  # BODY_L0 template (~60 tokens)
            body-l1.template  # BODY_L1 template (~400 tokens)
        v0.1.1/             # Next iteration...
```

### manifest.json

```json
{
  "version": "0.1.0",
  "created_at": "2026-03-17T00:00:00Z",
  "digest": "sha256:a1b2c3d4e5f6...",
  "min_app_version": "1.0.0",
  "changelog": "Initial MVP agent config: Haiku-only, 8 tools, Telegram delivery",
  "author": "shivansh",
  "compatibility": {
    "min_supabase_schema": "001",
    "required_edge_functions": ["check-triggers", "telegram-webhook", "message-sender", "morning-brief"]
  }
}
```

### Supabase Storage

Blueprints live as JSON in the `agent_blueprints` table (not filesystem), making them queryable and deployable from any Edge Function:

```sql
CREATE TABLE agent_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,          -- "0.1.0"
  manifest JSONB NOT NULL,               -- Full manifest.json
  souls JSONB NOT NULL,                  -- { "base": "...", "stress-alert": "...", ... }
  tools JSONB NOT NULL,                  -- { "definitions": [...], "routing": {...} }
  thresholds JSONB NOT NULL,             -- { "stress": {...}, "crs_weights": {...} }
  models JSONB NOT NULL,                 -- { "routing": {...}, "fallback_chains": {...} }
  prompts JSONB NOT NULL,                -- { "body_l0_template": "...", "body_l1_template": "..." }
  digest TEXT NOT NULL,                  -- SHA-256 of entire config
  is_active BOOLEAN DEFAULT FALSE,       -- Only one active at a time (global default)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ               -- NULL until activated
);

-- Per-user blueprint overrides (for A/B testing)
CREATE TABLE user_blueprint_assignments (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blueprint_version TEXT REFERENCES agent_blueprints(version),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,                           -- "ab-test-stress-tone", "beta-group-1"
  PRIMARY KEY (user_id)
);
```

### Blueprint Resolution at Runtime

Every Edge Function that invokes the agent resolves the blueprint first:

```typescript
// _shared/blueprint.ts

interface ResolvedBlueprint {
  version: string;
  soul: string;           // Mode-specific soul file content
  tools: ToolDefinition[];
  thresholds: ThresholdConfig;
  modelRouting: ModelRoutingConfig;
  bodyL0Template: string;
  bodyL1Template: string;
}

async function resolveBlueprint(
  userId: string,
  triggerType: string
): Promise<ResolvedBlueprint> {
  const supabase = getSupabaseClient();

  // 1. Check per-user override (A/B test)
  const { data: assignment } = await supabase
    .from("user_blueprint_assignments")
    .select("blueprint_version")
    .eq("user_id", userId)
    .single();

  // 2. Resolve blueprint version
  let blueprint;
  if (assignment?.blueprint_version) {
    const { data } = await supabase
      .from("agent_blueprints")
      .select("*")
      .eq("version", assignment.blueprint_version)
      .single();
    blueprint = data;
  } else {
    // Use global active blueprint
    const { data } = await supabase
      .from("agent_blueprints")
      .select("*")
      .eq("is_active", true)
      .single();
    blueprint = data;
  }

  if (!blueprint) throw new Error("No active blueprint found");

  // 3. Select mode-specific soul file
  const soulKey = mapTriggerToSoul(triggerType);
  const soul = `${blueprint.souls.base}\n\n${blueprint.souls[soulKey] ?? ""}`;

  // 4. Select tools for this trigger type
  const toolSubset = blueprint.tools.routing[triggerType] ?? blueprint.tools.routing.default;
  const tools = blueprint.tools.definitions.filter(
    (t: ToolDefinition) => toolSubset.includes(t.name)
  );

  return {
    version: blueprint.version,
    soul,
    tools,
    thresholds: blueprint.thresholds,
    modelRouting: blueprint.models,
    bodyL0Template: blueprint.prompts.body_l0_template,
    bodyL1Template: blueprint.prompts.body_l1_template,
  };
}

function mapTriggerToSoul(triggerType: string): string {
  const soulMap: Record<string, string> = {
    stress_alert: "stress-alert",
    morning_brief: "morning-brief",
    user_reply: "conversational",
    weekly_review: "weekly-review",
  };
  return soulMap[triggerType] ?? "conversational";
}
```

### Recording Blueprint Version in Conversations

Every conversation row records which blueprint produced it:

```sql
-- Add to existing conversation_history table
ALTER TABLE conversation_history ADD COLUMN blueprint_version TEXT;
```

This enables:
- **Performance tracking**: "Blueprint v0.1.1 has 72% thumbs-up vs v0.1.0 at 58%"
- **Regression detection**: "After deploying v0.2.0, stress alert response rate dropped 15%"
- **Rollback decision**: Hard data on which version performed better

### A/B Testing Flow

```
1. Deploy v0.2.0 (new stress tone) alongside v0.1.0 (current)
2. Assign 50% of beta users to v0.2.0:
   INSERT INTO user_blueprint_assignments (user_id, blueprint_version, reason)
   SELECT id, '0.2.0', 'ab-test-stress-tone-march-2026'
   FROM users
   WHERE id IN (SELECT id FROM users ORDER BY random() LIMIT 3);
3. Run for 7 days
4. Compare: SELECT blueprint_version, AVG(CASE WHEN helpful THEN 1 ELSE 0 END)
            FROM feedback_events fe
            JOIN conversation_history ch ON fe.conversation_id = ch.id
            GROUP BY blueprint_version;
5. If v0.2.0 wins: make it active, remove assignments
   If v0.1.0 wins: remove assignments, delete v0.2.0
```

### Rollback

```sql
-- Instant rollback: one query
UPDATE agent_blueprints SET is_active = FALSE WHERE version = '0.2.0';
UPDATE agent_blueprints SET is_active = TRUE WHERE version = '0.1.0';

-- Next agent invocation automatically uses v0.1.0
```

### Phase Mapping

| Feature | Phase | Effort |
|---------|-------|--------|
| Blueprint table + resolution + recording | MVP (Week 4) | 3-4 hours |
| A/B testing with user assignments | MVP (Week 7) | 2 hours |
| Blueprint deployment CLI/script | MVP (Week 7) | 1 hour |
| Blueprint digest verification | Phase 2 | 1 hour |
| Blueprint migration tooling | Phase 2 | 2 hours |

---

## 2. Transparent Inference Middleware

### What NemoClaw Does

NemoClaw intercepts all model API calls through an OpenShell gateway without the agent knowing. The agent makes normal API calls; the gateway transparently routes them to the configured provider, handles auth, and enforces rate limits. Provider switching happens at runtime without restarting anything.

### Why OneSync Needs This

OneSync's cost model depends on routing 85% of calls to cheap models (DeepSeek V3, Qwen, GPT-4o mini) while reserving Claude for critical interactions. The current `selectModel()` function is tightly coupled to the agent loop. Adding new providers, switching models, handling rate limits, implementing fallback chains, and tracking costs per model all require touching agent code.

The middleware separates **what the agent wants** (a completion) from **how it gets it** (which provider, model, auth, retry logic).

### Architecture

```
Agent Loop                    Inference Middleware                Providers
   |                               |                                |
   |--- create(model, messages) -->|                                |
   |                               |--- resolve provider --------->|
   |                               |--- check rate limits -------->|
   |                               |--- check cost budget -------->|
   |                               |--- call provider API -------->| Claude
   |                               |    (with retry + fallback)    | DeepSeek
   |                               |<-- response ------------------|  Qwen
   |                               |--- log usage + cost --------->|  GPT-4o
   |<-- response (transparent) ----|--- update budget ------------->|
```

### Implementation

```typescript
// _shared/inference-middleware.ts

interface InferenceRequest {
  intent: "routine_check" | "stress_alert" | "user_reply" | "morning_brief" | "weekly_review";
  severity: number;          // 0.0 - 1.0
  messages: Message[];
  system: SystemMessage[];
  tools?: ToolDefinition[];
  max_tokens?: number;
  userId: string;
}

interface InferenceResponse {
  content: ContentBlock[];
  model: string;              // Actual model used (may differ from requested)
  provider: string;           // "anthropic" | "deepseek" | "openai" | "qwen"
  usage: { input_tokens: number; output_tokens: number; cache_read_tokens?: number };
  cost_usd: number;           // Computed cost for this call
  latency_ms: number;
}

interface ProviderConfig {
  name: string;
  base_url: string;
  api_key_env: string;
  models: {
    id: string;
    cost_per_mtok_in: number;
    cost_per_mtok_out: number;
    max_tokens: number;
    supports_tools: boolean;
    supports_cache: boolean;
  }[];
}

// Provider registry (from blueprint.models)
const PROVIDER_REGISTRY: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic",
    base_url: "https://api.anthropic.com/v1",
    api_key_env: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-haiku-4-5-20251001", cost_per_mtok_in: 1.00, cost_per_mtok_out: 5.00, max_tokens: 8192, supports_tools: true, supports_cache: true },
      { id: "claude-sonnet-4-6", cost_per_mtok_in: 3.00, cost_per_mtok_out: 15.00, max_tokens: 8192, supports_tools: true, supports_cache: true },
      { id: "claude-opus-4-6", cost_per_mtok_in: 5.00, cost_per_mtok_out: 25.00, max_tokens: 8192, supports_tools: true, supports_cache: true },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    base_url: "https://api.deepseek.com/v1",
    api_key_env: "DEEPSEEK_API_KEY",
    models: [
      { id: "deepseek-chat", cost_per_mtok_in: 0.28, cost_per_mtok_out: 0.42, max_tokens: 4096, supports_tools: true, supports_cache: false },
    ],
  },
  openai: {
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    api_key_env: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o-mini", cost_per_mtok_in: 0.15, cost_per_mtok_out: 0.60, max_tokens: 4096, supports_tools: true, supports_cache: false },
    ],
  },
};

// The middleware function -- this is what the agent loop calls instead of anthropic.messages.create()
async function infer(request: InferenceRequest, blueprint: ResolvedBlueprint): Promise<InferenceResponse> {
  const startTime = Date.now();

  // 1. Resolve model from blueprint routing config
  const route = resolveRoute(request.intent, request.severity, blueprint.modelRouting);

  // 2. Check per-user daily cost budget
  const budgetOk = await checkCostBudget(request.userId, route.estimated_cost);
  if (!budgetOk) {
    // Return cached/templated response instead of making an API call
    return templateFallback(request.intent, request.severity);
  }

  // 3. Try primary provider, then fallback chain
  let lastError: Error | null = null;
  for (const candidate of route.chain) {
    try {
      const provider = PROVIDER_REGISTRY[candidate.provider];
      if (!provider) continue;

      const response = await callProvider(provider, candidate.model, request);
      const cost = computeCost(provider, candidate.model, response.usage);

      // 4. Log usage asynchronously (don't block response)
      logUsage(request.userId, candidate.provider, candidate.model, response.usage, cost, Date.now() - startTime);

      return {
        content: response.content,
        model: candidate.model,
        provider: candidate.provider,
        usage: response.usage,
        cost_usd: cost,
        latency_ms: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err as Error;
      // Classify error and decide whether to retry or fallback
      if (isRetryable(err)) {
        await sleep(1000); // Single retry
        continue;
      }
      // Non-retryable: move to next in chain
      continue;
    }
  }

  // 5. All providers failed -- return template fallback
  console.error(`All providers failed for ${request.intent}:`, lastError);
  return templateFallback(request.intent, request.severity);
}

// Route resolution from blueprint config
function resolveRoute(
  intent: string,
  severity: number,
  config: ModelRoutingConfig
): { chain: { provider: string; model: string }[]; estimated_cost: number } {
  // MVP: simple severity-based routing
  // Phase 2+: intent-specific routing with cost optimization
  if (severity > 0.8) {
    return {
      chain: [
        { provider: "anthropic", model: "claude-opus-4-6" },
        { provider: "anthropic", model: "claude-sonnet-4-6" },
        { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
      ],
      estimated_cost: 0.05,
    };
  }
  if (intent === "user_reply" || severity > 0.4) {
    return {
      chain: [
        { provider: "anthropic", model: "claude-sonnet-4-6" },
        { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
      ],
      estimated_cost: 0.01,
    };
  }
  // Routine: Haiku for MVP, DeepSeek/Qwen in Phase 2
  return {
    chain: [
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
    estimated_cost: 0.001,
  };
}

// Template fallback when all providers fail or budget exceeded
function templateFallback(intent: string, severity: number): InferenceResponse {
  const templates: Record<string, string> = {
    stress_alert: "I noticed some changes in your vitals. How are you feeling right now?",
    morning_brief: "Good morning! Your health data is syncing. I'll have your briefing ready shortly.",
    user_reply: "I'm having trouble connecting right now. I'll get back to you in a few minutes.",
  };
  return {
    content: [{ type: "text", text: templates[intent] ?? templates.user_reply }],
    model: "template",
    provider: "local",
    usage: { input_tokens: 0, output_tokens: 0 },
    cost_usd: 0,
    latency_ms: 0,
  };
}

// Cost computation
function computeCost(provider: ProviderConfig, modelId: string, usage: any): number {
  const model = provider.models.find(m => m.id === modelId);
  if (!model) return 0;
  const inputCost = (usage.input_tokens / 1_000_000) * model.cost_per_mtok_in;
  const outputCost = (usage.output_tokens / 1_000_000) * model.cost_per_mtok_out;
  // Cache discount: cached tokens cost 10% of input
  const cacheSavings = usage.cache_read_tokens
    ? ((usage.cache_read_tokens / 1_000_000) * model.cost_per_mtok_in * 0.9)
    : 0;
  return inputCost + outputCost - cacheSavings;
}

// Async usage logging (fire and forget)
async function logUsage(
  userId: string,
  provider: string,
  model: string,
  usage: any,
  cost: number,
  latencyMs: number
) {
  const supabase = getSupabaseClient();
  await supabase.from("agent_logs").insert({
    user_id: userId,
    provider,
    model_used: model,
    tokens_in: usage.input_tokens,
    tokens_out: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens ?? 0,
    cost_usd: cost,
    response_time_ms: latencyMs,
  });
}
```

### Agent Loop Integration

The agent loop changes from calling `anthropic.messages.create()` directly to calling `infer()`:

```typescript
// Before (tightly coupled):
const response = await anthropic.messages.create({
  model: selectModel(triggerType, severity),
  max_tokens: 1024,
  system: systemPrompt,
  messages,
  tools,
});

// After (middleware):
const blueprint = await resolveBlueprint(userId, triggerType);
const response = await infer({
  intent: triggerType,
  severity: triggerData.severity,
  messages,
  system: systemPrompt,
  tools: blueprint.tools,
  userId,
}, blueprint);
```

The agent loop no longer knows or cares about provider selection, cost tracking, or fallback logic.

### Cost Budget Enforcement

```typescript
async function checkCostBudget(userId: string, estimatedCost: number): Promise<boolean> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("agent_logs")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00Z`);

  const todaySpend = (data ?? []).reduce((sum, row) => sum + row.cost_usd, 0);
  const DAILY_BUDGET_USD = 0.50; // ~$15/month per user max

  return (todaySpend + estimatedCost) < DAILY_BUDGET_USD;
}
```

### Phase 2: Multi-Provider Routing

When adding DeepSeek/Qwen in Phase 2, only the `resolveRoute()` function and provider registry change. The agent loop and all Edge Functions remain untouched:

```typescript
// Phase 2 routing: cheap models for routine, Claude for critical
function resolveRouteV2(intent: string, severity: number, config: ModelRoutingConfig) {
  if (severity > 0.8) return { chain: [{ provider: "anthropic", model: "claude-opus-4-6" }, ...] };
  if (intent === "user_reply") return { chain: [{ provider: "anthropic", model: "claude-sonnet-4-6" }, ...] };
  if (intent === "morning_brief") return { chain: [{ provider: "anthropic", model: "claude-haiku-4-5-20251001" }, ...] };
  // Routine checks: cheapest first
  return {
    chain: [
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "openai", model: "gpt-4o-mini" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
    estimated_cost: 0.0005,
  };
}
```

### Phase Mapping

| Feature | Phase | Effort |
|---------|-------|--------|
| Middleware with Anthropic-only + fallback templates | MVP (Week 4) | 4-5 hours |
| Cost tracking + daily budget enforcement | MVP (Week 4) | 2 hours |
| Provider registry as blueprint config | MVP (Week 4) | 1 hour |
| Multi-provider routing (DeepSeek, OpenAI, Qwen) | Phase 2 | 3-4 hours |
| Per-user cost dashboard (admin view) | Phase 2 | 3 hours |
| Dynamic provider switching without redeploy | Phase 2 | 2 hours |

---

## 3. Declarative Policy System for Agent Permissions

### What NemoClaw Does

NemoClaw enforces four-layer security through declarative YAML policies: network (per-binary endpoint allowlists), filesystem (Landlock read-only/read-write), process (seccomp + user isolation), and inference (gateway routing). Policies are deny-by-default and hot-reloadable at runtime.

### Why OneSync Needs This

OneSync handles **sensitive health data** (HRV, sleep, stress events) via an AI agent that has 8-18 tools. Without explicit policies:
- The `send_message` tool could theoretically be called by any trigger type, including the baseline updater (which should never message users)
- The `update_core_memory` tool could overwrite critical health baselines during a routine check
- A compromised or hallucinating agent could access data outside its intended scope
- No audit trail of which tools accessed which data categories

Declarative policies define **what each Hand/trigger can do** and enforce it at the tool execution layer.

### Policy Definition

```json
// In blueprint: thresholds/policies.json

{
  "version": "1.0",
  "default_policy": "deny",

  "hand_policies": {
    "stress_monitor": {
      "description": "Proactive stress alert - minimal tool access",
      "allowed_tools": ["get_current_biometrics", "get_stress_events", "send_message"],
      "denied_tools": ["update_core_memory", "get_health_history", "search_conversation_history"],
      "data_access": {
        "health_snapshots": "read:latest_only",
        "stress_events": "read:last_24h",
        "conversation_history": "none",
        "core_memory": "read_only"
      },
      "constraints": {
        "max_messages_per_invocation": 1,
        "max_tool_calls": 3,
        "max_tokens_output": 512,
        "cooldown_minutes": 120,
        "requires_confidence_above": 0.60
      }
    },

    "morning_brief": {
      "description": "Daily morning briefing",
      "allowed_tools": ["get_current_biometrics", "get_sleep_summary", "send_message", "read_core_memory"],
      "denied_tools": ["update_core_memory"],
      "data_access": {
        "health_snapshots": "read:last_24h",
        "sleep_sessions": "read:last_night",
        "core_memory": "read_only"
      },
      "constraints": {
        "max_messages_per_invocation": 1,
        "max_tool_calls": 4,
        "max_tokens_output": 1024
      }
    },

    "user_reply": {
      "description": "User-initiated conversation - full tool access",
      "allowed_tools": "all",
      "denied_tools": [],
      "data_access": {
        "health_snapshots": "read:all",
        "sleep_sessions": "read:all",
        "stress_events": "read:all",
        "conversation_history": "read:all",
        "core_memory": "read_write"
      },
      "constraints": {
        "max_messages_per_invocation": 3,
        "max_tool_calls": 5,
        "max_tokens_output": 1024
      }
    },

    "baseline_updater": {
      "description": "Daily baseline computation - NO messaging, NO AI",
      "allowed_tools": [],
      "denied_tools": "all",
      "data_access": {
        "health_snapshots": "read:last_30d",
        "core_memory": "write:health_baseline_only"
      },
      "constraints": {
        "max_messages_per_invocation": 0,
        "requires_ai": false
      }
    },

    "weekly_review": {
      "description": "Phase 2: Opus-powered weekly analysis",
      "allowed_tools": ["get_health_history", "get_stress_events", "get_sleep_summary", "read_core_memory", "update_core_memory", "send_message"],
      "denied_tools": [],
      "data_access": {
        "health_snapshots": "read:last_7d",
        "sleep_sessions": "read:last_7d",
        "stress_events": "read:last_7d",
        "conversation_history": "read:last_7d",
        "core_memory": "read_write"
      },
      "constraints": {
        "max_messages_per_invocation": 1,
        "max_tool_calls": 8,
        "max_tokens_output": 2048,
        "allowed_models": ["claude-opus-4-6", "claude-sonnet-4-6"]
      }
    }
  },

  "global_rules": {
    "banned_medical_phrases": [
      "you are having", "diagnose", "heart attack", "stroke",
      "stop taking", "prescription", "you should take"
    ],
    "required_disclaimer_triggers": ["medication", "supplement", "treatment", "therapy"],
    "emergency_keywords": ["chest pain", "cant breathe", "suicidal", "kill myself", "overdose"],
    "max_opus_calls_per_day": 3,
    "max_proactive_messages_per_day": 5
  }
}
```

### Policy Enforcement Layer

```typescript
// _shared/policy-enforcer.ts

interface PolicyViolation {
  type: "tool_denied" | "data_scope_exceeded" | "constraint_violated" | "banned_phrase" | "rate_limit";
  detail: string;
  hand: string;
  tool?: string;
}

class PolicyEnforcer {
  private policy: HandPolicy;
  private globalRules: GlobalRules;
  private hand: string;
  private violations: PolicyViolation[] = [];

  constructor(blueprint: ResolvedBlueprint, hand: string) {
    this.policy = blueprint.thresholds.policies.hand_policies[hand];
    this.globalRules = blueprint.thresholds.policies.global_rules;
    this.hand = hand;

    if (!this.policy) {
      throw new Error(`No policy defined for hand: ${hand}. Deny by default.`);
    }
  }

  // Called BEFORE tool execution
  validateToolCall(toolName: string, toolInput: any): PolicyViolation | null {
    // Check explicit deny list
    if (this.policy.denied_tools === "all" || this.policy.denied_tools.includes(toolName)) {
      return {
        type: "tool_denied",
        detail: `Tool "${toolName}" is denied for hand "${this.hand}"`,
        hand: this.hand,
        tool: toolName,
      };
    }

    // Check allow list (if not "all")
    if (this.policy.allowed_tools !== "all" && !this.policy.allowed_tools.includes(toolName)) {
      return {
        type: "tool_denied",
        detail: `Tool "${toolName}" is not in allowed list for hand "${this.hand}"`,
        hand: this.hand,
        tool: toolName,
      };
    }

    // Check data scope for health data tools
    if (toolName === "get_health_history" && toolInput.start_date) {
      const scopeViolation = this.checkDataScope(toolName, toolInput);
      if (scopeViolation) return scopeViolation;
    }

    return null; // Allowed
  }

  // Called AFTER agent response, BEFORE delivery
  validateOutput(text: string): PolicyViolation | null {
    // Check banned medical phrases
    for (const phrase of this.globalRules.banned_medical_phrases) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        return {
          type: "banned_phrase",
          detail: `Response contains banned phrase: "${phrase}"`,
          hand: this.hand,
        };
      }
    }
    return null;
  }

  // Check message count constraint
  validateMessageCount(currentCount: number): PolicyViolation | null {
    const max = this.policy.constraints.max_messages_per_invocation;
    if (currentCount >= max) {
      return {
        type: "constraint_violated",
        detail: `Max messages (${max}) exceeded for hand "${this.hand}"`,
        hand: this.hand,
      };
    }
    return null;
  }

  // Check tool call count constraint
  validateToolCallCount(currentCount: number): PolicyViolation | null {
    const max = this.policy.constraints.max_tool_calls;
    if (currentCount >= max) {
      return {
        type: "constraint_violated",
        detail: `Max tool calls (${max}) exceeded for hand "${this.hand}"`,
        hand: this.hand,
      };
    }
    return null;
  }

  private checkDataScope(toolName: string, input: any): PolicyViolation | null {
    // Implementation: validate date ranges against policy's data_access rules
    // E.g., stress_monitor can only read last 24h of health_snapshots
    return null; // Simplified for plan
  }
}
```

### Integration with Agent Loop

```typescript
// In the agent loop:
const enforcer = new PolicyEnforcer(blueprint, triggerType);

// Before each tool call:
const violation = enforcer.validateToolCall(toolUseBlock.name, toolUseBlock.input);
if (violation) {
  // Log violation and return a safe tool result
  await logPolicyViolation(userId, violation);
  messages.push({
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUseBlock.id,
      content: JSON.stringify({ error: "This action is not available right now." }) }],
  });
  continue; // Skip tool execution, let agent adjust
}

// Before delivery:
const outputViolation = enforcer.validateOutput(responseText);
if (outputViolation) {
  await logPolicyViolation(userId, outputViolation);
  responseText = sanitizeResponse(responseText, outputViolation);
}
```

### Policy Violation Logging

```sql
CREATE TABLE policy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  blueprint_version TEXT,
  hand TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  tool_name TEXT,
  was_blocked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monitoring dashboard
CREATE INDEX idx_policy_violations_created ON policy_violations(created_at DESC);
```

### Phase Mapping

| Feature | Phase | Effort |
|---------|-------|--------|
| Policy schema in blueprint | MVP (Week 4) | 2 hours |
| PolicyEnforcer class with tool validation | MVP (Week 4) | 3 hours |
| Output validation (banned phrases) | MVP (Week 4) | 1 hour |
| Policy violation logging | MVP (Week 4) | 1 hour |
| Data scope enforcement (date range limits) | Phase 2 | 3 hours |
| Runtime policy reload (hot-swap) | Phase 2 | 2 hours |

---

## 4. Operator-in-the-Loop Escalation

### What NemoClaw Does

When NemoClaw's sandbox agent tries to reach an unlisted network endpoint, OpenShell blocks the request and surfaces it in the TUI for operator approval. The operator can approve or deny in real time. Approved endpoints persist only for the session, not the baseline policy -- preventing policy drift.

### Why OneSync Needs This

OneSync's agent operates proactively (stress alerts, morning briefs) and will eventually make higher-stakes recommendations (suggesting schedule changes, flagging concerning health patterns, emergency contacts). Some actions should require explicit user confirmation before the agent establishes them as patterns.

Current architecture has no escalation path -- the agent either acts or doesn't. There's no "ask first, then act" middle ground.

### Escalation Categories

```json
// In blueprint: thresholds/escalation.json

{
  "escalation_rules": {
    "always_ask": {
      "description": "Always require user confirmation before acting",
      "triggers": [
        "suggest_medication_timing_change",
        "suggest_exercise_intensity_change",
        "alert_emergency_contact",
        "share_health_data_externally",
        "recommend_doctor_visit"
      ]
    },

    "ask_first_time": {
      "description": "Ask once, then remember preference",
      "triggers": [
        "suggest_breathing_exercise",
        "suggest_break",
        "send_stress_alert_during_meeting",
        "send_activity_nudge"
      ]
    },

    "never_ask": {
      "description": "Always allowed without confirmation",
      "triggers": [
        "morning_brief",
        "respond_to_user_message",
        "update_core_memory",
        "log_interaction"
      ]
    }
  },

  "escalation_timeout_minutes": 30,
  "max_pending_escalations": 3,
  "fallback_on_timeout": "skip"
}
```

### Implementation

```sql
-- Pending escalation requests
CREATE TABLE escalation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,              -- "suggest_breathing_exercise"
  action_payload JSONB NOT NULL,          -- The full action the agent wants to take
  agent_reasoning TEXT,                   -- Why the agent wants to do this
  status TEXT DEFAULT 'pending',          -- "pending", "approved", "denied", "expired"
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL         -- created_at + escalation_timeout
);

-- User preferences learned from escalation responses
CREATE TABLE user_action_preferences (
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  preference TEXT NOT NULL,               -- "always_allow", "always_deny", "ask_each_time"
  learned_from_escalation_id UUID REFERENCES escalation_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, action_type)
);
```

### Escalation Flow

```typescript
// _shared/escalation.ts

async function checkEscalation(
  userId: string,
  actionType: string,
  actionPayload: any,
  agentReasoning: string,
  blueprint: ResolvedBlueprint
): Promise<"proceed" | "pending" | "denied"> {
  const rules = blueprint.thresholds.escalation.escalation_rules;

  // 1. Check if this action is in "never_ask" -- always proceed
  if (rules.never_ask.triggers.includes(actionType)) return "proceed";

  // 2. Check if this action is in "always_ask" -- always escalate
  if (rules.always_ask.triggers.includes(actionType)) {
    await createEscalationRequest(userId, actionType, actionPayload, agentReasoning);
    return "pending";
  }

  // 3. Check if this is "ask_first_time" -- check user preference
  if (rules.ask_first_time.triggers.includes(actionType)) {
    const preference = await getUserPreference(userId, actionType);

    if (preference === "always_allow") return "proceed";
    if (preference === "always_deny") return "denied";

    // No preference yet -- ask
    await createEscalationRequest(userId, actionType, actionPayload, agentReasoning);
    return "pending";
  }

  // Default: proceed (unlisted actions are allowed)
  return "proceed";
}

async function createEscalationRequest(
  userId: string,
  actionType: string,
  payload: any,
  reasoning: string
) {
  const supabase = getSupabaseClient();
  const timeoutMinutes = 30;

  const { data: request } = await supabase.from("escalation_requests").insert({
    user_id: userId,
    action_type: actionType,
    action_payload: payload,
    agent_reasoning: reasoning,
    expires_at: new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString(),
  }).select().single();

  // Send Telegram message asking for permission
  await sendEscalationMessage(userId, request);
}

// Send the escalation as a Telegram inline keyboard
async function sendEscalationMessage(userId: string, request: any) {
  const message = formatEscalationMessage(request);

  // Using grammy inline keyboard for yes/no + "always allow" / "always deny"
  const keyboard = {
    inline_keyboard: [
      [
        { text: "Yes, do it", callback_data: `esc_approve_${request.id}` },
        { text: "No, skip", callback_data: `esc_deny_${request.id}` },
      ],
      [
        { text: "Always allow this", callback_data: `esc_always_${request.id}` },
        { text: "Never do this", callback_data: `esc_never_${request.id}` },
      ],
    ],
  };

  await sendTelegramMessage(userId, message, keyboard);
}
```

### User Experience

When the agent wants to suggest a breathing exercise for the first time:

```
OneSync: I noticed your HRV dropped 22% in the last 30 minutes
and your heart rate is elevated. You might benefit from a
5-minute breathing exercise.

[Yes, do it]  [No, skip]
[Always allow this]  [Never do this]
```

If user taps "Always allow this" → future stress alerts with breathing suggestions go through without asking. Stored in `user_action_preferences`.

If user taps "Never do this" → agent learns to suggest breaks or walks instead.

### Session Isolation (from NemoClaw)

Critical: escalation approvals in the "always_ask" category are **session-only** (they don't persist). Only "ask_first_time" preferences persist permanently. This prevents:
- A one-time approval of "alert my emergency contact" becoming permanent
- Accidental "always allow" on high-stakes actions

### Phase Mapping

| Feature | Phase | Effort |
|---------|-------|--------|
| Escalation rules in blueprint | MVP (Week 5-6) | 1 hour |
| Basic escalation for stress alerts (Telegram buttons) | MVP (Week 5-6) | 3 hours |
| User preference learning | MVP (Week 6) | 2 hours |
| Full escalation flow with timeout/expiry | Phase 2 | 3 hours |
| In-app escalation UI (Phase 2, replaces Telegram buttons) | Phase 2 | 4 hours |

---

## 5. Plan-Apply-Rollback Lifecycle

### What NemoClaw Does

NemoClaw follows a Terraform-inspired lifecycle for all configuration changes: **Plan** (validate + preview), **Apply** (execute), **Status** (verify), **Rollback** (revert). Each operation creates a run record with a unique ID. The Python blueprint runner communicates progress via structured stdout protocol.

### Why OneSync Needs This

OneSync has multiple configuration surfaces that need coordinated changes:
- Agent blueprint (soul files, tools, thresholds, model routing)
- Supabase schema (migrations)
- Edge Function deployments
- CRS algorithm weights
- User-facing settings (notification preferences, quiet hours)

Without a lifecycle, changes are ad-hoc: edit a file, deploy an Edge Function, hope nothing breaks. With the lifecycle, every change is planned, previewed, applied with a run ID, and rollback-capable.

### Run System

```sql
CREATE TABLE config_runs (
  id TEXT PRIMARY KEY,                    -- "run-20260317-143022-a1b2c3d4"
  run_type TEXT NOT NULL,                 -- "blueprint_deploy", "threshold_update", "weight_adjustment"
  status TEXT DEFAULT 'planned',          -- "planned", "applying", "applied", "rolled_back", "failed"
  plan JSONB NOT NULL,                    -- What will change
  previous_state JSONB,                   -- Snapshot before apply (for rollback)
  applied_state JSONB,                    -- Snapshot after apply
  initiated_by TEXT DEFAULT 'shivansh',   -- Who initiated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  error TEXT                              -- Error message if failed
);
```

### Lifecycle Implementation

```typescript
// _shared/config-lifecycle.ts

function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const hex = crypto.randomUUID().slice(0, 8);
  return `run-${ts}-${hex}`;
}

interface ConfigPlan {
  run_id: string;
  run_type: string;
  changes: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
  estimated_impact: string;
}

// Step 1: PLAN
async function planBlueprintDeploy(newVersion: string): Promise<ConfigPlan> {
  const supabase = getSupabaseClient();
  const runId = generateRunId();

  // Get current active blueprint
  const { data: current } = await supabase
    .from("agent_blueprints")
    .select("*")
    .eq("is_active", true)
    .single();

  // Get new blueprint
  const { data: next } = await supabase
    .from("agent_blueprints")
    .select("*")
    .eq("version", newVersion)
    .single();

  if (!next) throw new Error(`Blueprint ${newVersion} not found`);

  // Compute diff
  const changes = computeBlueprintDiff(current, next);

  const plan: ConfigPlan = {
    run_id: runId,
    run_type: "blueprint_deploy",
    changes,
    estimated_impact: summarizeImpact(changes),
  };

  // Save plan to DB
  await supabase.from("config_runs").insert({
    id: runId,
    run_type: "blueprint_deploy",
    status: "planned",
    plan,
    previous_state: current,
  });

  return plan;
}

// Step 2: APPLY
async function applyRun(runId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Get the plan
  const { data: run } = await supabase
    .from("config_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run || run.status !== "planned") {
    throw new Error(`Run ${runId} is not in planned state (current: ${run?.status})`);
  }

  // Mark as applying
  await supabase.from("config_runs")
    .update({ status: "applying" })
    .eq("id", runId);

  try {
    if (run.run_type === "blueprint_deploy") {
      await applyBlueprintDeploy(run);
    } else if (run.run_type === "threshold_update") {
      await applyThresholdUpdate(run);
    } else if (run.run_type === "weight_adjustment") {
      await applyWeightAdjustment(run);
    }

    // Capture applied state
    const appliedState = await captureCurrentState(run.run_type);

    await supabase.from("config_runs").update({
      status: "applied",
      applied_state: appliedState,
      applied_at: new Date().toISOString(),
    }).eq("id", runId);

  } catch (err) {
    await supabase.from("config_runs").update({
      status: "failed",
      error: (err as Error).message,
    }).eq("id", runId);
    throw err;
  }
}

// Step 3: STATUS
async function getRunStatus(runId: string): Promise<any> {
  const supabase = getSupabaseClient();
  const { data: run } = await supabase
    .from("config_runs")
    .select("*")
    .eq("id", runId)
    .single();

  return {
    id: run.id,
    type: run.run_type,
    status: run.status,
    changes: run.plan.changes.length,
    impact: run.plan.estimated_impact,
    created: run.created_at,
    applied: run.applied_at,
  };
}

// Step 4: ROLLBACK
async function rollbackRun(runId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: run } = await supabase
    .from("config_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run || run.status !== "applied") {
    throw new Error(`Run ${runId} cannot be rolled back (current: ${run?.status})`);
  }

  // Restore previous state
  if (run.run_type === "blueprint_deploy") {
    const prevVersion = run.previous_state.version;
    await supabase.from("agent_blueprints")
      .update({ is_active: false })
      .neq("version", prevVersion);
    await supabase.from("agent_blueprints")
      .update({ is_active: true, deployed_at: new Date().toISOString() })
      .eq("version", prevVersion);
  }

  await supabase.from("config_runs").update({
    status: "rolled_back",
    rolled_back_at: new Date().toISOString(),
  }).eq("id", runId);
}

// Helper: compute diff between two blueprints
function computeBlueprintDiff(current: any, next: any): any[] {
  const changes: any[] = [];

  // Compare souls
  for (const key of Object.keys(next.souls)) {
    if (current?.souls?.[key] !== next.souls[key]) {
      changes.push({
        field: `souls.${key}`,
        old_value: current?.souls?.[key] ? "(exists, changed)" : "(new)",
        new_value: "(updated)",
      });
    }
  }

  // Compare thresholds
  if (JSON.stringify(current?.thresholds) !== JSON.stringify(next.thresholds)) {
    changes.push({
      field: "thresholds",
      old_value: current?.thresholds?.stress?.confidence_threshold,
      new_value: next.thresholds?.stress?.confidence_threshold,
    });
  }

  // Compare model routing
  if (JSON.stringify(current?.models) !== JSON.stringify(next.models)) {
    changes.push({
      field: "models.routing",
      old_value: "(previous routing)",
      new_value: "(updated routing)",
    });
  }

  return changes;
}
```

### Usage (CLI or Admin Script)

```typescript
// deploy-blueprint.ts (run locally or as admin Edge Function)

// 1. Plan
const plan = await planBlueprintDeploy("0.2.0");
console.log(`Run ${plan.run_id}: ${plan.changes.length} changes`);
console.log(`Impact: ${plan.estimated_impact}`);
// Output: Run run-20260317-143022-a1b2c3d4: 3 changes
//         Impact: Soul file updated (stress-alert), stress threshold changed (0.60 -> 0.55), model routing unchanged

// 2. Review plan, then apply
await applyRun(plan.run_id);
// Output: Blueprint v0.2.0 is now active

// 3. Monitor
const status = await getRunStatus(plan.run_id);
// Output: { id: "run-...", status: "applied", changes: 3, applied: "2026-03-17T14:30:45Z" }

// 4. If things go wrong
await rollbackRun(plan.run_id);
// Output: Rolled back to v0.1.0
```

### CRS Weight Adjustment Lifecycle

The same lifecycle applies to CRS algorithm weight changes:

```typescript
// Plan a weight adjustment
const plan = await planWeightAdjustment({
  sleep: 0.40,    // was 0.35
  hrv: 0.25,      // unchanged
  circadian: 0.20, // was 0.25
  activity: 0.15,  // unchanged
});
// Shows: sleep weight +0.05, circadian weight -0.05

await applyRun(plan.run_id);
// All new CRS calculations use updated weights

// After 7 days, if CRS thumbs-up rate drops:
await rollbackRun(plan.run_id);
// Reverts to original weights
```

### Phase Mapping

| Feature | Phase | Effort |
|---------|-------|--------|
| config_runs table + basic plan/apply/rollback | MVP (Week 4) | 3 hours |
| Blueprint deploy lifecycle | MVP (Week 4) | 2 hours |
| CRS weight adjustment lifecycle | MVP (Week 7) | 2 hours |
| Threshold update lifecycle | MVP (Week 7) | 1 hour |
| Admin dashboard for run history | Phase 2 | 4 hours |
| Automated rollback on metric degradation | Phase 3 | 6 hours |

---

## 6. Implementation Timeline

### Integration with 8-Week MVP Plan

These five systems integrate into the existing build plan without adding weeks. They are **infrastructure that the agent needs anyway** -- the choice is between ad-hoc implementation or structured implementation.

| Week | Existing Plan | NemoClaw Systems Added |
|------|--------------|----------------------|
| 1 | Expo + Kotlin modules + Health Connect + Supabase schema | Add blueprint tables, config_runs table, policy_violations table to schema migration |
| 2 | CRS engine + stress detection + SQLite + WorkManager | CRS weights stored in blueprint (not hardcoded) |
| 3 | Dashboard (CRS gauge, metric cards, sleep card) | No changes |
| 4 | **Agent Core** -- Claude agent, tools, Telegram webhook | Blueprint resolution, inference middleware, policy enforcer, plan/apply lifecycle -- all built as part of agent core |
| 5 | Proactive -- morning brief, stress trigger, message delivery | Escalation rules for stress alerts (Telegram inline keyboards) |
| 6 | Onboarding + 7-day learning messages | User action preferences from escalation responses |
| 7 | Self-test -- 2 weeks daily use, false positive tuning | A/B test blueprint versions, tune thresholds via plan/apply/rollback |
| 8 | Beta -- 3-5 testers, iterate on agent quality | Full lifecycle in use: deploy v0.1.1 with adjusted tone, track per-blueprint metrics, rollback if needed |

### Total Additional Effort

| System | MVP Hours | Phase 2 Hours |
|--------|-----------|---------------|
| 1. Blueprint / Versioned Configs | 6 | 3 |
| 2. Inference Middleware | 7 | 9 |
| 3. Declarative Policies | 7 | 5 |
| 4. Operator-in-the-Loop | 6 | 7 |
| 5. Plan-Apply-Rollback | 8 | 10 |
| **Total** | **34 hours** | **34 hours** |

34 MVP hours across 5 weeks (Week 1 + 4-7) = ~7 hours/week additional. Manageable for a solo founder using Claude Code.

---

## 7. Supabase Schema Additions

All new tables for the five systems, consolidated:

```sql
-- ================================================================
-- NEMOCLAW-INSPIRED INFRASTRUCTURE TABLES
-- Added to OneSync MVP Supabase schema
-- ================================================================

-- 1. BLUEPRINT SYSTEM
-- ================================================================

CREATE TABLE agent_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  manifest JSONB NOT NULL,
  souls JSONB NOT NULL,
  tools JSONB NOT NULL,
  thresholds JSONB NOT NULL,
  models JSONB NOT NULL,
  prompts JSONB NOT NULL,
  digest TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_active_blueprint
  ON agent_blueprints(is_active) WHERE is_active = TRUE;

CREATE TABLE user_blueprint_assignments (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blueprint_version TEXT REFERENCES agent_blueprints(version),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  PRIMARY KEY (user_id)
);

-- Add blueprint_version to conversation_history
ALTER TABLE conversation_history ADD COLUMN blueprint_version TEXT;
ALTER TABLE conversation_history ADD COLUMN provider TEXT;

-- 2. INFERENCE MIDDLEWARE
-- ================================================================
-- (Uses existing agent_logs table, add columns)

ALTER TABLE agent_logs ADD COLUMN provider TEXT;
ALTER TABLE agent_logs ADD COLUMN cache_read_tokens INT DEFAULT 0;

-- 3. POLICY SYSTEM
-- ================================================================

CREATE TABLE policy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  blueprint_version TEXT,
  hand TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  tool_name TEXT,
  was_blocked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_violations_created
  ON policy_violations(created_at DESC);

-- 4. ESCALATION SYSTEM
-- ================================================================

CREATE TABLE escalation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  agent_reasoning TEXT,
  status TEXT DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_escalation_pending
  ON escalation_requests(user_id, status) WHERE status = 'pending';

CREATE TABLE user_action_preferences (
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  preference TEXT NOT NULL,
  learned_from_escalation_id UUID REFERENCES escalation_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, action_type)
);

-- 5. CONFIG LIFECYCLE
-- ================================================================

CREATE TABLE config_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  plan JSONB NOT NULL,
  previous_state JSONB,
  applied_state JSONB,
  initiated_by TEXT DEFAULT 'shivansh',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_config_runs_status
  ON config_runs(status, created_at DESC);

-- ================================================================
-- RLS POLICIES (all tables user-scoped)
-- ================================================================

ALTER TABLE agent_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_runs ENABLE ROW LEVEL SECURITY;

-- Blueprints: readable by all authenticated users (they're shared config)
CREATE POLICY "Blueprints readable by authenticated"
  ON agent_blueprints FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy violations: users see only their own
CREATE POLICY "Users see own violations"
  ON policy_violations FOR SELECT
  USING (auth.uid() = user_id);

-- Escalation requests: users see and update only their own
CREATE POLICY "Users see own escalations"
  ON escalation_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users respond to own escalations"
  ON escalation_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- User preferences: users manage only their own
CREATE POLICY "Users manage own preferences"
  ON user_action_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Config runs: admin only (service role)
CREATE POLICY "Config runs admin only"
  ON config_runs FOR ALL
  USING (auth.role() = 'service_role');
```

---

## 8. Claude Code Project Setup

Based on patterns from [everything-claude-code](https://github.com/affaan-m/everything-claude-code), here's how to structure OneSync for optimal Claude Code development:

### CLAUDE.md (Keep Lean, <200 Lines)

The root CLAUDE.md should contain only what Claude needs to operate in the repo:

```markdown
# OneSync

AI health co-pilot: wearable biometrics -> CRS -> Claude agent -> Telegram interventions.

## Architecture
- `app/` — React Native + Expo (Android-first)
- `modules/` — Kotlin native modules (Health Connect, WorkManager, WearOS)
- `supabase/` — Edge Functions (Deno), migrations, seed data
- `supabase/functions/_shared/` — Shared agent infrastructure
  - `blueprint.ts` — Blueprint resolution
  - `inference-middleware.ts` — Provider routing + cost tracking
  - `policy-enforcer.ts` — Declarative tool/data policies
  - `escalation.ts` — Operator-in-the-loop flow
  - `config-lifecycle.ts` — Plan/apply/rollback
- `Docs/` — All planning and design documents

## Key Commands
- `npx expo start` — Start dev server
- `npx expo run:android` — Build and run on device
- `supabase functions serve` — Local Edge Functions
- `supabase db push` — Apply migrations
- `npm test` — Run tests

## Development Notes
- Edge Functions use Deno (not Node.js)
- Health data is encrypted (SQLCipher on-device, RLS on Supabase)
- Agent blueprint is versioned — never hardcode thresholds or soul text
- All agent calls go through inference middleware, never direct API calls
- Policy enforcer validates every tool call before execution

## Testing
- `npm test` for unit tests
- `supabase functions test` for Edge Function tests
- Manual: Telegram bot testing with @BotFather test bot
```

### Hooks (from everything-claude-code)

```json
// .claude/hooks.json (start minimal, add as needed)
{
  "hooks": [
    {
      "id": "post:edit:typecheck",
      "event": "PostToolUse",
      "matcher": { "tool": "Edit", "glob": "**/*.ts" },
      "command": "npx tsc --noEmit --pretty 2>&1 | head -20"
    },
    {
      "id": "pre:bash:no-dev-server",
      "event": "PreToolUse",
      "matcher": { "tool": "Bash", "command_pattern": "npx expo start" },
      "command": "echo 'Use npx expo start in a separate terminal, not here.' && exit 2"
    }
  ]
}
```

### Agent Configs (for Claude Code subagents)

```
.claude/
  agents/
    planner.md        # Read-only research agent (Glob, Grep, Read only)
    reviewer.md       # Code review agent (Read, Grep only)
  settings.local.json # Project-specific permissions
```

### Context Modes

```
.claude/
  contexts/
    dev.md      # "Write code first, explain after."
    research.md # "Read widely before concluding."
    review.md   # "Read thoroughly before commenting."
```

### Key Principles (from everything-claude-code)

1. **CLAUDE.md stays lean** — detailed instructions go in skills, rules, agents
2. **Hooks for deterministic automation** — TypeScript check after edits, not probabilistic
3. **Route model by task** — Use Haiku subagents for exploration, Sonnet for coding
4. **Compact strategically** — At logical boundaries (after research, before implementation)
5. **Separate author and reviewer** — Never review your own code with the same context
6. **Keep MCP servers under 10** — Each consumes context budget
7. **Conventional commits** — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

---

## Summary: What These Five Systems Give OneSync

| System | Before | After |
|--------|--------|-------|
| **Blueprint** | Scattered config files, no versioning | Immutable versioned configs, A/B testing, instant rollback |
| **Inference Middleware** | `anthropic.messages.create()` in agent loop | Provider-agnostic, cost-tracked, budget-enforced, fallback-capable |
| **Declarative Policies** | Implicit trust in agent behavior | Explicit per-hand tool/data permissions, violation logging |
| **Escalation** | Agent acts or doesn't (binary) | "Ask first, then act" with learned preferences |
| **Plan-Apply-Rollback** | Ad-hoc config changes | Terraform-style lifecycle with run IDs and rollback |

These systems transform OneSync's agent from a **prototype** into **production infrastructure** -- observable, safe, versioned, and rollback-capable. Total MVP investment: ~34 hours across Weeks 1-7, integrated into the existing build plan.

---

*This document is the implementation reference for NemoClaw-inspired agent infrastructure. Cross-reference with [AGENT_AND_BACKEND.md](../AGENT_AND_BACKEND.md) for the full agent architecture and [MVP_SCOPE.md](../MVP_SCOPE.md) for scope boundaries.*

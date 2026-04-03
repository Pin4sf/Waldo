# Architecture Rules

These decisions are locked. Do NOT change without explicit discussion.

## Locked Decisions
1. **Messages API with tool_use** — not Agent SDK (Edge Functions are stateless)
2. **Claude Haiku 4.5 only** for MVP — no Sonnet/Opus in production paths
3. **iOS-first, then Android** — HealthKit/Swift first (team has Apple Watch), Health Connect/Kotlin second. Architecture remains cross-platform (React Native + Expo).
4. **Channel adapter pattern from Day 1** — Telegram is the first implementation. Agent logic never references a specific channel directly.
5. **NativeWind v4** — not Gluestack-UI, not StyleSheet
6. **8 tools for MVP** — get_crs, get_sleep, get_stress_events, get_activity, send_message, read_memory, update_memory, get_user_profile
7. **3-step onboarding** — wearable permissions, messaging channel link, basic profile
8. **On-phone CRS** — TypeScript, offline-capable, no server round-trip for CRS
9. **Rules-based pre-filter** — skip Claude when CRS > 60 and stress confidence < 0.3
10. **op-sqlite + SQLCipher** for local DB — not WatermelonDB, not Realm
11. **Cloudflare Durable Objects for Phase D+ agent runtime** — Each user gets a dedicated DO with SQLite (memory, patterns, preferences, conversation history). Health data stays in Supabase (phone syncs there, DO reads via REST). Agent brain moves from stateless Edge Functions to persistent DOs. See `Docs/WALDO_SCALING_INFRASTRUCTURE.md`.

## Data Flow (Do Not Deviate)
```
Phase B-C (Supabase MVP):
Wearable → HealthKit/Health Connect → Native Module → op-sqlite (encrypted)
  → CRS computation (on-phone, TypeScript) → Supabase sync (health_snapshots)
  → pg_cron trigger check → rules pre-filter → LLM Provider [Claude Haiku] (if needed)
  → Channel Adapter → user feedback → agent learns

Phase D+ (Cloudflare DO):
Wearable → HealthKit/Health Connect → Native Module → op-sqlite (encrypted)
  → CRS computation (on-phone) → Supabase sync (health_snapshots)
  → DO alarm/webhook → DO loads context from SQLite + fetches health from Supabase
  → rules pre-filter → LLM Provider [Claude Haiku] (if needed)
  → Channel Adapter → DO writes memory to SQLite → user feedback → agent evolves
```

## Build Order
Data parser + CRS validation FIRST (Phase A0), then data connectors (Phase B), dashboard (Phase C), agent (Phase D).
Never build agent features before the data pipeline is solid.

## HRV Processing
- Apple exports SDNN, but CRS spec uses RMSSD. Both are available: SDNN from the value field, RMSSD computable from raw InstantaneousBeatsPerMinute beats embedded in each HRV record.
- Always apply time-of-day normalization (6-block ratios: 1.30/1.10/1.00/0.85/0.90/1.05) before comparing HRV to baselines.
- Use HR motion context metadata (HKMetadataKeyHeartRateMotionContext) to filter exercise from stress.

## Cost Constraints
- Rules pre-filter eliminates ~60-80% of Claude calls
- Max 3 agent iterations per invocation
- 50s hard timeout on Edge Functions
- Dynamic tool loading: 3-4 tools per call, not all 8
- Prompt caching: 1h TTL for soul files, 5min for profiles

## Adapter Pattern (All External Integrations)
All external boundaries use adapter interfaces. Agent logic calls the adapter, never the provider directly.

### Core Adapters (MVP)
- `ChannelAdapter` — messaging delivery (Telegram first, then WhatsApp/Discord/Slack/in-app)
- `LLMProvider` — AI model calls (Claude Haiku first, then multi-model routing)
- `HealthDataSource` — wearable data (HealthKit + Health Connect first, then cloud APIs)
- `StorageAdapter` — local persistence (op-sqlite + SQLCipher first)
- `WeatherProvider` — environmental context (Open-Meteo, built)

### Phase 2 Adapters (Productivity + Life Context)
- `CalendarProvider` — schedule intelligence (Google Calendar, Outlook via Graph, Apple Calendar)
- `EmailProvider` — communication load (Gmail, Outlook — metadata only, never body content)
- `TaskProvider` — work queue (Google Tasks, Todoist, Notion, Linear, Microsoft To Do)
- `MusicProvider` — mood inference (Spotify, YouTube Music, Apple Music)
- `ScreenTimeProvider` — digital hygiene (RescueTime)

### 10 adapters total. Each swappable. Agent logic never references a provider directly.

This ensures any component can be swapped without rewriting agent logic. "Plug and play, not rip and replace."

## Waldo's 32 Metrics (6 Dimensions)
See `Docs/WALDO_ADAPTER_ECOSYSTEM.md` for full formulas. Summary:
- **Body** (10 metrics): CRS, Sleep Score, HRV Score, Circadian, Activity, Day Strain, Sleep Debt, Stress Confidence, Resilience, Recovery-Load Balance
- **Schedule** (5): Meeting Load Score, Focus Time, Back-to-Back Count, Boundary Violations, Schedule Density
- **Communication** (5): CSI, Response Pressure, After-Hours Ratio, Volume Spike, Thread Depth
- **Tasks** (5): Task Pile-Up, Completion Velocity, Procrastination Index, Urgency Queue, Task-Energy Match
- **Mood & Screen** (4): Mood Score, Screen Time Quality, Late-Night Digital, Focus Sessions
- **Combined** (3): Daily Cognitive Load, Burnout Trajectory Score, Waldo Intelligence Score

## Agent Security Hardening (Defense-in-Depth)

Security is layered. No single defense is sufficient. Implement all layers — inspired by AtlanClaw's 5-layer model, adapted for serverless.

### Layer 1: Credential Protection
- Use **project-scoped Anthropic API key** with spend limits (not account-level key)
- Set up **Anthropic dashboard alerts** for unusual spend (catches prompt injection loops)
- Never pass API keys as tool arguments, in logs, or in any tool response
- Evaluate **Supabase Vault** for secrets management in Phase 2
- Telegram bot token is a critical secret — exposure = full message history access

### Layer 2: Input Sanitization (Prompt Injection Defense)
- **Template-wrap ALL external content** before feeding to Claude:
  ```
  ---BEGIN USER MESSAGE---
  {content}
  ---END USER MESSAGE---
  ```
- **Prompt ordering**: System instructions FIRST → user profile MIDDLE → external input LAST
- **Sandwich defense**: Repeat critical safety instructions AFTER user content
- **Canary tokens**: Embed unique tokens in system prompt; if they appear in output, terminate session
- Apply to: Telegram messages, webhook payloads, any user-provided text

### Layer 3: Tool-Use Safety
- **Per-invocation tool permissions** — restrict tools by trigger type:
  - Morning Wag: `get_crs`, `get_sleep`, `get_activity`, `send_message`
  - Fetch Alert: `get_crs`, `get_stress_events`, `read_memory`, `send_message`
  - User-initiated chat: all 8 tools
- **Zod-validate every tool argument** before execution (not just at boundaries)
- **Memory write validation**: reject `update_memory` content containing URLs, code blocks, or instruction-like patterns
- **Rate limit write tools**: `send_message` enforces 2h cooldown at tool level; `update_memory` max 3 writes per invocation

### Layer 4: Egress Control (Code-Level)
- **URL allowlist** for all outbound `fetch()` calls in Edge Functions:
  - `api.anthropic.com`, `api.telegram.org`, `api.open-meteo.com`, Supabase project URL
- Adding a new allowed domain requires a code change + review
- Block all outbound requests to unlisted hosts

### Layer 5: Audit Trail
- **Agent action log**: every tool call logged with `trace_id`, tool name, input summary (NOT health values), outcome, latency
- **Cost tracking**: per-user daily spend tracked; hard cap at configurable limit
- **Memory audit**: every `update_memory` call logged with before/after diff summary

## Reliability Patterns (Build Into Adapters)

These patterns live INSIDE adapter implementations. Core logic stays clean.

### LLMProvider: Circuit Breaker + Fallback Chain
```
Level 1: Claude Haiku (full context) → personalized response
Level 2: Claude Haiku (reduced context, L0 only) → faster, cheaper
Level 3: Template with real data ("Nap Score is 43. Rough night — take it easy.")
Level 4: Silent (log error, retry next pg_cron cycle)
```
- Circuit breaker: after 3 consecutive failures, skip to Level 3 for cooldown period
- Each level is a fallback, not a replacement — always try Level 1 first

### ChannelAdapter: Idempotent Delivery
- Generate `idempotency_key` = hash(user_id + trigger_type + 15min_time_bucket)
- Check `sent_messages` table before sending — skip if key exists
- Prevents duplicate messages on Edge Function retries or pg_cron re-fires

### Cost Circuit Breaker
- Daily per-user cost cap (configurable, default ~$0.10/day)
- When hit: switch to template-only responses, log warning
- Prevents prompt injection loops from burning budget

## Observability (Structured Traces)

Every agent invocation produces a trace:
```typescript
{
  trace_id: string;        // UUID, groups all actions in one invocation
  user_id: string;
  trigger_type: 'morning_wag' | 'fetch_alert' | 'user_message';
  tools_called: string[];  // tool names only
  iterations: number;
  total_tokens: number;
  cache_hit_rate: number;
  latency_ms: number;
  quality_gates: { gate: string; pass: boolean }[];
  delivery_status: 'sent' | 'fallback' | 'suppressed' | 'failed';
  llm_fallback_level: 1 | 2 | 3 | 4;
  estimated_cost_usd: number;
}
```
Store in `agent_logs` table. Query with Supabase SQL for dashboards. Evaluate Langfuse for Phase G.

## Agent Self-Evolution (Phase G: core feedback loop | Phase 2: advanced patterns + Constellation)

Inspired by JiuwenClaw's "living skills" pattern. The agent's behavioral parameters evolve based on accumulated feedback signals — but the identity (soul files) stays immutable.

### The Closed Loop
```
User feedback (👍/👎/dismissal/engagement) → signal detection (rule-based, no LLM)
  → evolution entries accumulate in agent_evolutions table
  → prompt builder merges unapplied evolutions on each invocation
  → agent behavior gradually adapts to this specific user
```

### What Evolves (Behavioral Parameters)
- **Verbosity level**: user consistently ignores long messages → shorten
- **Timing preferences**: Fetch Alerts at 2pm always dismissed → adjust window
- **Topic preferences**: user engages with sleep insights, ignores activity → weight sleep
- **Language style**: user corrects clinical language → use warmer framing
- **Metric display**: user says "too many numbers" → hide raw values

### What NEVER Evolves (Identity — Immutable)
- Soul files (SOUL_BASE, SOUL_STRESS, SOUL_MORNING)
- Safety rules (medical disclaimers, emergency detection)
- CRS algorithm weights (these are science, not preference)
- Tool definitions and permissions

### Evolution Safety Controls
- **Minimum signals**: 3+ signals in same direction before evolving (prevents single bad day from warping behavior)
- **Decay on pending evolutions**: unapplied entries lose confidence after 30 days
- **Evolution cap**: max 2 parameter changes per week per user
- **Auto-revert**: if evolution → subsequent negative feedback spike → revert and log
- **Transparency**: agent can explain why it changed ("I noticed you prefer shorter messages")

### Signal Detection (Rule-Based, No LLM)
Cheap pattern matching on feedback + behavior — no Claude call needed:
- 👎 reaction or "not helpful" reply → negative signal
- Morning Wag not opened within 2 hours → implicit disengagement
- Fetch Alert dismissed without reading → timing/relevance signal
- Enthusiastic reply with detail → positive signal
- User correction ("no, I meant..." / "too clinical" / "not that") → explicit correction

### Data Model
```sql
CREATE TABLE agent_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT,            -- 'morning_wag', 'fetch_alert', 'user_chat'
  source TEXT NOT NULL,         -- 'negative_feedback', 'dismissal', 'correction', 'positive_signal'
  context TEXT,                 -- what happened (sanitized, no health values)
  change_type TEXT NOT NULL,    -- 'verbosity', 'timing', 'topic_weight', 'language_style'
  change_value JSONB NOT NULL,  -- the parameter adjustment
  confidence REAL DEFAULT 1.0,  -- decays over time
  applied BOOLEAN DEFAULT false,
  reverted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tool Output Compression (Also from JiuwenClaw)
When tool results are large (detailed sleep breakdown, multi-day activity data):
- Cap tool output at ~500 tokens before returning to Claude
- Summarize large health payloads into structured summaries
- Leave retrieval markers: `[DETAIL_AVAILABLE: call get_sleep(detail=true) for full breakdown]`
- Agent can request full detail in next iteration if needed — lazy loading for context

## 5-Tier Memory Architecture (Phase D-G Progression)

| Tier | Type | Storage | Loaded | Phase |
|------|------|---------|--------|-------|
| 0 | Working Memory | LLM context window | Every invocation (volatile) | D |
| 1 | Semantic Memory | DO SQLite `memory_blocks` | Always (<200 tokens) | D |
| 2 | Episodic Memory | DO SQLite `episodes` (0-90d) → **R2** (90d+) | On-demand; R2 via `retrieve_archived_episodes` tool | D → E |
| 3 | Procedural Memory | DO SQLite `procedures` | Selectively (unapplied evolutions) | G |
| 4 | Archival Memory | Supabase pgvector | Semantic search for Constellations | Phase 2 |

**Key rule:** Raw health values (HRV, HR, sleep hours) NEVER enter DO SQLite or R2. Health data lives in encrypted Supabase with RLS. DO stores only derived insights. R2 stores episodic archives and GDPR exports (no raw health values).

**R2 archival:** Episodes older than 90 days are moved from DO SQLite to Cloudflare R2 (`waldo-episodes/{user_id}/{year}/{month}/episodes.jsonl`) during Patrol Agent weekly consolidation. Separate `waldo-exports` bucket for user data exports with signed URLs (24h expiry). R2 egress is free. See `Docs/WALDO_SCALING_INFRASTRUCTURE.md` Section 11 for full design.

Full 5-tier schema with DO SQLite DDL: `Docs/WALDO_AGENT_UPGRADE_REPORT.md` Section 5B.

## 6 Agent Loop Refinements (from ccunpacked.dev + deepwiki, April 2026)

Source: Claude Code production patterns discovered via ccunpacked.dev and deepwiki/zackautocracy analysis.

### 1. Diminishing-Returns Loop Guard (enhance existing Loop Guard)
Add to Loop Guard (Hook 8): if the last 3 iterations each produced <500 tokens of output, stop the loop immediately and fall back to template. Agent is stuck — more iterations won't help.
```typescript
const recentOutputTokens = lastThreeIterations.map(i => i.outputTokens);
if (recentOutputTokens.every(t => t < 500)) {
  return { action: 'fallback', level: 3, reason: 'diminishing_returns' };
}
```

### 2. Skip Already-Summarized Episodes in Patrol Agent
Patrol Agent consolidation must check `consolidated: boolean` on each episode before processing. Skip any episode where `consolidated = true`. Only ever process new, unconsolidated data. Prevents re-summarizing the same content on every nightly run.

### 3. Compaction Circuit Breaker
Separate from the LLM circuit breaker: if the Patrol Agent's consolidation fails 3 consecutive times, skip consolidation and proceed without it. The Morning Wag still fires — just without freshly consolidated context. Log as `compaction_failure` in the error taxonomy. Never let consolidation block delivery.

### 4. Partial Response Retry (max_output_tokens recovery)
If Claude truncates a response due to hitting output token limits, retry up to 3 times by appending the partial response and asking Claude to continue. Only relevant for long Constellation queries (Phase 2). Between Level 1 and Level 2 of the fallback chain.

### 5. Message Smooshing
When loading Tier 2 episodic memory into context, merge consecutive same-role message sequences into one before sending to Claude. Reduces turn count overhead. Small but consistent token saving every invocation.

### 6. KAIROS Tick-and-Decide for Patrol Agent
Patrol Agent should not always run consolidation when it wakes. It should assess first, then decide:
```typescript
async function patrolTick(do: DurableObject) {
  const unconsolidated = await countUncollectedEpisodes(do);
  const hoursSinceLast = await getTimeSinceLastConsolidation(do);
  // Agent decides — only run if worth it
  if (unconsolidated < 3 && hoursSinceLast < 48) return; // hibernate
  await runConsolidation(do);
}
```
This matches KAIROS's tick-and-decide pattern: wake, assess, decide, act or skip.

## Tools to Evaluate (Not Locked — Keep Flexible)

These are NOT locked decisions. Evaluate when the time comes — swap in if they add value, skip if they don't.

| Tool | What | Evaluate When | Current Alternative |
|------|------|--------------|-------------------|
| Trigger.dev | Durable TypeScript background jobs | Phase 2 | pg_cron + pg_net |
| Langfuse | Open-source LLM observability | Phase G | agent_logs table |
| Portkey | AI Gateway with provider failover | Phase 2 (multi-model) | Manual failover in LLMProvider |
| Vercel AI SDK | TypeScript AI SDK with tool loops | Phase D spike | Raw @anthropic-ai/sdk |
| Helicone | LLM proxy with caching | Phase D | Anthropic prompt caching |
| Inngest | Event-driven durable execution | Phase D (inside DO) | Manual agent loop |
| Mastra | TypeScript-first agent framework | Phase D (if raw SDK feels limiting) | Raw @anthropic-ai/sdk |
| Open Wearables SDK | React Native wearable data API (MIT) | Phase B (could save weeks) | Custom native modules |
| Promptfoo | Agent evaluation + red-teaming (MIT) | Phase D (security tests) | Manual testing |

## Source of Truth
When in doubt, read these docs (in priority order):
1. `Docs/WALDO_MASTER_REFERENCE.md`
2. `Docs/WALDO_NORTHSTAR.md`
3. `Docs/WALDO_ONEPAGER.md`
4. `Docs/WALDO_RESEARCH_AND_ALGORITHMS.md`

Anything in `Docs/archive/` is superseded by these four.

> **Note:** File paths still use the `WALDO_` prefix for historical reasons. The product is now called **Waldo**.

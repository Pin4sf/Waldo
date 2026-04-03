# Waldo Scaling Infrastructure — Multi-User Agent Architecture

**Date:** March 31, 2026
**Status:** Brainstorm / Architecture Proposal
**Context:** How to give every user their own Waldo at maximum capability without linear cost growth

---

## 1. The Problem

Waldo today is a **single-tenant demo**. One hardcoded user. Supabase Edge Functions are stateless — they spin up, fetch data, call Claude, respond, die. The agent has no persistent brain, no workspace, no memory between invocations beyond what's in Postgres rows.

**AtlanClaw** (Atlan's internal agent platform) solves this by giving each agent team a full K8s namespace with a Linux container, 5Gi PVC filesystem, persistent MEMORY.md/SOUL.md/skills/, and a claw-proxy sidecar for credential isolation. The agent's workspace IS its brain. But this costs ~$15-30/user/month and requires dedicated K8s infrastructure — it doesn't scale to 10K-100K consumer users.

**The question:** How do we give every user workspace-level agent power (the thing that makes AtlanClaw agents 100x more capable) at consumer economics ($0.01-0.10/user/day)?

### What "Workspace-Level Agent Power" Means

When an agent has a workspace, it can:
- Write daily logs and observations to files it organizes itself
- Build up structured knowledge over weeks/months (like MEMORY.md accumulating context)
- Create and modify its own skill definitions
- Maintain conversation context across sessions
- Schedule its own tasks and reminders
- React to events in real-time (WebSocket, not polling)
- Organize its knowledge structure — the agent decides HOW to remember

Without a workspace, the agent is a **stateless function** that gets pre-fetched data shoved into its context window. It's the difference between a person with a notebook and filing system vs. someone with amnesia who reads a summary card each morning.

### What We Have Today

| Component | Current State | Multi-Tenant Ready? |
|---|---|---|
| Database schema | 17 tables, all have `user_id` | Data model: YES. RLS enforcement: NO |
| Authentication | None (hardcoded `DEMO_USER_ID`) | NO |
| Agent runtime | Supabase Edge Functions (stateless, 50s timeout) | Shared pool: YES. Per-user state: NO |
| Agent memory | `core_memory` table (key-value, not actively used) | Schema exists, not populated |
| Scheduling | pg_cron every 15min (single user) | NO — doesn't scale per-user |
| Channel delivery | Telegram bot (single chat ID) | NO — needs per-user routing |
| Web dashboard | Hardcoded to demo user | NO — needs auth |
| Agent workspace | None — agent is stateless | NO |
| Cost tracking | Per-invocation logging exists | YES (agent_logs table) |

---

## 2. Industry Landscape (March 2026)

### Per-User Agent Sandboxes

| Platform | Model | Boot Time | Persistence | Cost/User/Month | Best For |
|---|---|---|---|---|---|
| **E2B** | Firecracker microVMs | 200ms | Up to 24h sessions | ~$5-20 (usage-based) | Code execution sandboxes |
| **Fly.io Sprites** | Persistent VMs | Seconds | Indefinite, scale-to-zero | ~$5-15 | Full Linux agent environments |
| **Modal Labs** | Serverless containers | 1s | Ephemeral | Usage-based | GPU/ML workloads |
| **Agent-Sandbox** | K8s containers (E2B-compatible) | Seconds | Stateful, multi-session | Self-hosted | Enterprise self-hosted |
| **Cloudflare Durable Objects** | Stateful serverless (SQLite) | Instant (0ms) | Indefinite, hibernate when idle | **~$0.001-0.01** | Per-user persistent agents |
| **Daytona** | Dev environment orchestration | Seconds | Stateful | Self-hosted | Development environments |

### Multi-Tenant Agent Frameworks

| Framework | State Model | Deployment | Multi-User | Relevant? |
|---|---|---|---|---|
| **Letta (MemGPT)** | Tiered memory (core/recall/archival) in DB | Self-hosted REST API | Yes, via agent IDs | Memory model is excellent; runtime is Python |
| **Cloudflare Agents SDK** | Durable Object per agent + SQLite | Cloudflare Workers | Native (millions of agents) | **Perfect fit** — TypeScript, stateful, serverless |
| **LangGraph Cloud** | State checkpointing | LangSmith hosted | Via thread IDs | Python, vendor lock-in |
| **OpenAI Assistants API** | Thread-based state | OpenAI hosted | Via thread/assistant IDs | Locked to OpenAI models |

### Agent Frameworks (Multi-User Relevant)

| Framework | Stars | State Model | Multi-User | Relevant? |
|---|---|---|---|---|
| **OpenClaw** | 180K+ | SQLite + MEMORY.md + sessions | Self-hosted single-user (multi via channels) | Study architecture deeply |
| **Letta (MemGPT)** | ~30K | Tiered memory (core/recall/archival) in DB | Yes, via agent IDs + REST API | Memory model excellent; Python runtime |
| **Cloudflare Agents SDK** | Growing | Durable Object per agent + SQLite | Native (millions of agents) | **Perfect fit** |
| **LangGraph Cloud** | Large | State checkpointing per thread | Via thread IDs | Python, vendor lock-in |
| **CrewAI** | 44K+ | Multi-agent orchestration | Via crew instances | Multi-agent overkill for Waldo |

### Sandbox Technologies (State of the Art, March 2026)

| Technology | Boot Time | Isolation | Used By |
|---|---|---|---|
| **Firecracker microVMs** | ~125ms (28ms snapshot) | Hardware (KVM) | E2B, AWS Lambda, Fly.io |
| **Kata Containers** | ~200ms | VM-grade via K8s | Northflank |
| **gVisor** | Fast (no VM boot) | User-space kernel | Google, K8s Agent Sandbox CRD |
| **Cloudflare Durable Objects** | 0ms (hibernation wake) | V8 isolate per DO | Cloudflare Agents SDK |

### Durable Execution Platforms

| Platform | Pattern | Relevant Use | Cost |
|---|---|---|---|
| **Temporal.io** | Workflow orchestration | Durable agent loops, retry logic | Self-hosted or cloud |
| **Inngest** | Event-driven functions | Health event triggers, scheduled jobs | Free tier generous |
| **Trigger.dev** | Background TypeScript jobs | Long-running agent tasks | Open source |
| **Restate.dev** | Durable execution | Exactly-once agent actions | Self-hosted |

---

## 3. Three Architecture Proposals

### Proposal A: Cloudflare Agents + Supabase Hybrid (RECOMMENDED)

**The Insight:** Cloudflare Durable Objects are literally "per-user persistent stateful agents with built-in SQLite, scheduling, and WebSocket" — this is EXACTLY what we need. Supabase stays as the health data layer (it's great at that). The agent brain moves to Cloudflare.

```
                        ┌─────────────────────────────────┐
                        │     CLOUDFLARE EDGE NETWORK      │
                        │                                   │
   ┌──────────┐         │  ┌───────────────────────────┐   │
   │ User's   │◄────────┤  │  Waldo Worker (Router)    │   │
   │ Phone    │ WebSocket│  │  Routes requests to the   │   │
   │ (App)    │─────────►│  │  correct Durable Object   │   │
   └──────────┘         │  └─────────┬─────────────────┘   │
                        │            │                       │
   ┌──────────┐         │  ┌─────────▼─────────────────┐   │
   │ Telegram │◄────────┤  │  Durable Object: Waldo-U1 │   │
   │ WhatsApp │─────────►│  │  ┌─────────────────────┐ │   │
   │ Discord  │         │  │  │ SQLite (per-user)     │ │   │
   └──────────┘         │  │  │ - memory/MEMORY.md    │ │   │
                        │  │  │ - daily/2026-03-31.md │ │   │
   ┌──────────┐         │  │  │ - patterns/sleep.md   │ │   │
   │ Web      │◄────────┤  │  │ - preferences.json    │ │   │
   │ Dashboard│ SSE/WS  │  │  │ - conversation_log    │ │   │
   └──────────┘         │  │  │ - evolution_params     │ │   │
                        │  │  └─────────────────────┘ │   │
                        │  │  ┌─────────────────────┐ │   │
                        │  │  │ Scheduler            │ │   │
                        │  │  │ - 6:30am Morning Wag │ │   │
                        │  │  │ - Every 15m: patrol  │ │   │
                        │  │  │ - Custom user alarms │ │   │
                        │  │  └─────────────────────┘ │   │
                        │  │  ┌─────────────────────┐ │   │
                        │  │  │ State Machine        │ │   │
                        │  │  │ - Current CRS zone   │ │   │
                        │  │  │ - Cooldown timers    │ │   │
                        │  │  │ - Active patterns    │ │   │
                        │  │  │ - Nudge state        │ │   │
                        │  │  └─────────────────────┘ │   │
                        │  └─────────┬─────────────────┘   │
                        │            │                       │
                        └────────────┼───────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │  Supabase    │ │  Claude API  │ │  Channel     │
           │  (Health DB) │ │  (Haiku 4.5) │ │  Adapters    │
           │              │ │              │ │  (Telegram,  │
           │ Postgres RLS │ │  Reasoning   │ │   WhatsApp)  │
           │ health_snap  │ │  only — no   │ │              │
           │ crs_scores   │ │  state here  │ │  Delivery    │
           │ stress_events│ │              │ │  only        │
           └──────────────┘ └──────────────┘ └──────────────┘
```

**How Each User's Waldo Works:**

1. **Identity:** Each user gets a Durable Object with a deterministic ID derived from their `user_id`. The DO is their Waldo — it persists indefinitely, hibernates when idle.

2. **Brain (SQLite):** The DO's built-in SQLite stores the agent's workspace:
   - `memory` table — structured memories (replaces `core_memory` in Supabase)
   - `daily_logs` table — agent's daily observations and notes
   - `patterns` table — discovered patterns with evidence
   - `evolution_params` table — learned behavioral adjustments
   - `conversation_history` table — full chat history
   - `preferences` table — user preferences and agent personality adjustments
   - `files` table — virtual filesystem (`path`, `content`, `updated_at`) for any agent-organized knowledge

3. **Scheduling:** The DO uses Cloudflare's built-in `alarm()` API:
   - Morning Wag scheduled at user's preferred wake time (not global cron)
   - Patrol checks every 15 minutes (only while health data is flowing)
   - Fetch Alert cooldown timers
   - Custom reminders the agent sets for itself

4. **Health Data Flow:**
   - Phone still syncs health data to Supabase (Postgres with RLS)
   - When the DO wakes (scheduled or triggered), it calls Supabase via REST to fetch latest health data
   - CRS computation can happen either on-phone (current) or in the DO
   - Health data stays in Supabase — the DO only reads it, never stores raw health values

5. **Agent Reasoning:**
   - DO builds the prompt from its own SQLite (memory, patterns, preferences) + fetched health data
   - Calls Claude Haiku via Anthropic API
   - Processes tool calls locally (most tools read from DO's SQLite or Supabase)
   - Writes results back to SQLite (memory updates, daily log entries)
   - Sends messages via Channel Adapter

6. **Real-Time:**
   - Web dashboard connects via WebSocket to the user's DO
   - Agent can push updates in real-time (not polling)
   - Chat interface is live bidirectional

**What This Gives Us That Supabase Can't:**

| Capability | Supabase Edge Fn | Cloudflare DO |
|---|---|---|
| Per-user scheduling | pg_cron (global, not per-user) | Per-DO alarms (user-specific wake times) |
| Agent state between invocations | None (stateless) | Full SQLite + in-memory state |
| Real-time push to client | Polling or pg_notify hack | Native WebSocket per user |
| Agent self-organization | Pre-structured tables only | Virtual filesystem + free-form storage |
| Invocation timeout | 50 seconds hard limit | 30 seconds per request, but can chain |
| Concurrent users | Shared Edge Function pool | Each user = isolated DO |
| Cold start | ~200ms Edge Function | 0ms (DO wakes from hibernation) |
| Cost at 10K users | ~$25/mo (Supabase Pro) | ~$5-25/mo (Durable Objects) |

**Cost Model (10K users):**

| Component | Monthly Cost | Notes |
|---|---|---|
| Cloudflare Workers Paid | $5 (minimum) | Includes 10M requests, 30M GB-s CPU |
| Durable Object requests | ~$0.30 | 10K users × 10 wakes/day × 30 days = 3M requests |
| Durable Object duration | ~$0 | Hibernation means minimal active time |
| Durable Object storage | ~$2 | 10K users × ~1MB SQLite each = 10GB |
| Supabase Pro | $25 | Health data, auth, file storage |
| Claude Haiku API | ~$50-200 | Usage-dependent, ~5-20 calls/user/day |
| Telegram/WhatsApp | ~$0-20 | API costs |
| **Total** | **~$85-250/month** | **$0.008-0.025/user/month infra** |

Compare to AtlanClaw approach (K8s): $15-30/user/month × 10K = $150K-300K/month.

**Migration Path:**
1. Phase B-C: Stay on Supabase Edge Functions (current architecture works for MVP)
2. Phase D: Build agent core as a Cloudflare Durable Object
3. Phase E: Move scheduling from pg_cron to DO alarms
4. Phase F: Add WebSocket for real-time dashboard
5. Phase G: Agent self-evolution lives entirely in DO's SQLite

**Risks:**
- Cloudflare vendor dependency (mitigated: health data stays in Supabase, agent logic is TypeScript that could move)
- DO compute limits (30s per request — but can chain multiple requests in a conversation)
- No GPU access (not needed — we call Claude API externally)
- SQLite size limits (currently 10GB per DO — more than enough)

---

### Proposal B: Enhanced Supabase + Virtual Workspace (Conservative)

**The Idea:** Stay entirely on Supabase but give the agent a virtual filesystem through database tables. The agent thinks it has files; it's actually Postgres rows underneath.

```
┌──────────────────────────────────────────────────────┐
│                  SUPABASE (ENHANCED)                   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │  Edge Function: invoke-agent (stateless)        │   │
│  │                                                  │   │
│  │  1. Auth check (Supabase Auth JWT)              │   │
│  │  2. Load user workspace from agent_files        │   │
│  │  3. Load health data from health_snapshots      │   │
│  │  4. Build prompt (workspace + health + soul)    │   │
│  │  5. Call Claude Haiku (3 iterations max)         │   │
│  │  6. Execute tools (including file write tools)   │   │
│  │  7. Persist workspace changes to agent_files     │   │
│  │  8. Send via Channel Adapter                     │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │  NEW: agent_files table                         │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ user_id │ path              │ content     │  │   │
│  │  │─────────┼───────────────────┼─────────────│  │   │
│  │  │ u1      │ /memory/MEMORY.md │ # Waldo's.. │  │   │
│  │  │ u1      │ /daily/03-31.md   │ Morning...  │  │   │
│  │  │ u1      │ /patterns/sleep   │ Pattern:... │  │   │
│  │  │ u1      │ /prefs.json       │ {"verbose.. │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │  RLS: auth.uid() = user_id                      │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │  NEW: Agent File Tools                          │   │
│  │  - read_file(path) → content                    │   │
│  │  - write_file(path, content) → ok               │   │
│  │  - list_files(directory) → [paths]              │   │
│  │  - delete_file(path) → ok                       │   │
│  │  (Agent sees paths like /memory/MEMORY.md)      │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  pg_cron → check-triggers (every 15 min, all users)   │
│  Supabase Auth → JWT on every request                  │
│  RLS → auth.uid() = user_id on ALL tables              │
└──────────────────────────────────────────────────────┘
```

**What This Gets Us:**
- Agent can organize its own knowledge (create files, write daily logs)
- Per-user memory persists across invocations
- Minimal infrastructure change from current architecture
- Supabase handles auth, RLS, storage, scheduling

**What It Doesn't Get Us:**
- Still stateless invocations (no in-memory state between calls)
- Still 50s timeout per invocation
- No real-time WebSocket push (polling only)
- No per-user scheduling (pg_cron is global, not "wake User 7 at 6:30am")
- Agent can't self-schedule reminders or follow-ups
- Virtual filesystem has no real execution capability

**Cost Model (10K users):**

| Component | Monthly Cost |
|---|---|
| Supabase Pro | $25 |
| Additional storage (agent files) | ~$5-10 |
| Claude Haiku API | ~$50-200 |
| **Total** | **~$80-235/month** |

**When to Choose This:**
- If we want minimum infrastructure complexity
- If we're not ready to add Cloudflare to the stack
- As a stepping stone: build the virtual filesystem tools now, migrate the backing store to Cloudflare DO later

**Risks:**
- pg_cron doesn't scale for per-user scheduling (10K users × different wake times)
- 50s Edge Function timeout constrains deep reasoning
- No real-time capability limits the "proactive agent" experience
- Agent state reload every invocation = token cost + latency

---

### Proposal C: Tiered Hybrid — Supabase Free + Dedicated Environments Premium

**The Idea:** Two-tier architecture. Free (Pup) users get Supabase-only lightweight Waldo. Premium (Pro) users get a dedicated agent environment with full workspace power.

```
┌─────────────────────────────────────────────────────────────┐
│                        USER TIERS                            │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │  PUP TIER (Free)     │    │  PRO TIER ($9.99/mo)      │   │
│  │                       │    │                            │   │
│  │  Supabase Edge Fn    │    │  Cloudflare Durable Object │   │
│  │  + Virtual Workspace  │    │  OR Fly.io Sprite          │   │
│  │                       │    │                            │   │
│  │  - Morning Wag only  │    │  - Full Patrol (24/7)     │   │
│  │  - Basic Spots       │    │  - Fetch Alerts           │   │
│  │  - No real-time      │    │  - Real-time WebSocket    │   │
│  │  - Shared scheduling │    │  - Per-user scheduling    │   │
│  │  - Limited memory    │    │  - Full workspace         │   │
│  │  - 3 msg/day max     │    │  - Unlimited messages     │   │
│  │                       │    │  - Constellation analysis │   │
│  └─────────────────────┘    │  - Agent self-evolution    │   │
│                              └──────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PACK TIER ($19.99/mo per family)                     │   │
│  │  Shared Cloudflare DO or Fly.io Sprite                │   │
│  │  Multiple users, shared Constellation                  │   │
│  │  Cross-user pattern detection                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Cost Model:**

| Tier | Infra Cost/User | Revenue | Margin |
|---|---|---|---|
| Pup (free) | ~$0.005/mo | $0 | -$0.005 |
| Pro | ~$0.02/mo (CF DO) or ~$7/mo (Fly.io) | $9.99 | $9.97 or $2.99 |
| Pack | ~$0.05/mo (CF DO) or ~$10/mo (Fly.io) | $19.99 | $19.94 or $9.99 |

**When to Choose This:**
- If we want to gate premium agent features behind a paywall
- If the business model requires differentiated tiers
- If Fly.io Sprites or E2B become the right fit for premium (full Linux power)

**Risks:**
- Two different agent runtimes to maintain and test
- Feature disparity creates complex codebase
- Premature optimization of business model before PMF

---

## 4. Recommendation: Start B, Build Toward A

### Phase B-C (Now → MVP): Proposal B (Enhanced Supabase)

1. **Enforce Supabase Auth + RLS** — flip `true` policies to `auth.uid() = user_id`
2. **Add `agent_files` table** — virtual workspace for the agent
3. **Add file tools** — `read_file`, `write_file`, `list_files` to the agent's 8-tool set
4. **Fix pg_cron** — iterate over all active users, not hardcoded single user
5. **Per-user Telegram linking** — 6-digit code flow (already designed)

This gets us to multi-user MVP with minimal infrastructure change.

### Phase D-E (Agent Core): Migrate to Proposal A (Cloudflare Agents)

1. **Build Waldo as a Cloudflare Durable Object** — the agent IS the DO
2. **Move agent memory/workspace from Supabase to DO's SQLite** — lower latency, true persistence
3. **Move scheduling from pg_cron to DO alarms** — per-user wake times
4. **Add WebSocket** — real-time dashboard and chat
5. **Health data stays in Supabase** — phone syncs there, DO reads from there
6. **Channel Adapters called from DO** — Telegram, WhatsApp delivery

### Phase G+ (Scale): Evaluate Proposal C (Tiered)

Once we have 1K+ users and understand usage patterns:
1. Decide if tier differentiation adds value
2. If Fly.io Sprites or E2B add capabilities that Cloudflare DOs can't match (unlikely given our use case)
3. Build Pack tier features (shared Constellations, cross-user patterns)

---

## 5. AtlanClaw Patterns to Adopt (Adapted for Serverless)

AtlanClaw's K8s architecture won't work at consumer scale, but the **patterns** are gold:

| AtlanClaw Pattern | Waldo Adaptation | Where It Lives |
|---|---|---|
| **Phantom Tokens** | Anthropic API key in Cloudflare secret store, not in DO | Cloudflare Secrets |
| **Read-only Identity** | Soul files immutable in DO initialization, not writable by agent | DO constructor |
| **Writable Memory** | Agent's SQLite in DO — full read/write | DO SQLite |
| **Egress Allowlist** | Cloudflare Service Bindings — DO can only call allowed origins | Worker config |
| **Credential Proxy** | Not needed — DO calls APIs via Worker with injected secrets | Worker middleware |
| **Per-team Namespace** | Per-user Durable Object (stronger isolation — separate state entirely) | CF Durable Objects |
| **PVC Workspace** | DO's SQLite (virtual filesystem in `files` table) | DO SQLite |
| **ArgoCD GitOps** | Wrangler deploy from GitHub Actions | CI/CD |
| **seccomp Audit** | Agent action logging in DO's SQLite + Supabase agent_logs | DO + Supabase |
| **Input Sanitization** | Template wrapping in Worker before routing to DO | Worker middleware |

---

## 6. The Adapter Pattern Holds

This is the beauty of Waldo's adapter architecture. The agent core doesn't change — only the **StorageAdapter** and **scheduling** implementations swap:

```typescript
// Phase B-C: Supabase implementation
class SupabaseStorageAdapter implements StorageAdapter {
  async readFile(userId: string, path: string): Promise<string> {
    // SELECT content FROM agent_files WHERE user_id = $1 AND path = $2
  }
  async writeFile(userId: string, path: string, content: string): Promise<void> {
    // UPSERT INTO agent_files ...
  }
}

// Phase D: Cloudflare DO implementation
class DurableObjectStorageAdapter implements StorageAdapter {
  async readFile(userId: string, path: string): Promise<string> {
    // this.ctx.storage.sql`SELECT content FROM files WHERE path = ?`
  }
  async writeFile(userId: string, path: string, content: string): Promise<void> {
    // this.ctx.storage.sql`INSERT OR REPLACE INTO files ...`
  }
}
```

Same agent logic. Same tools. Same soul file. Different backing store. Plug and play.

---

## 7. Key Insight: Why Cloudflare DOs ARE the Middle Ground

The spectrum of agent infrastructure:

```
LIGHTWEIGHT                                                    HEAVYWEIGHT
(cheap, limited)                                              (powerful, expensive)
     │                                                              │
     ▼                                                              ▼
  Supabase          Cloudflare           Fly.io              K8s/AtlanClaw
  Edge Fns          Durable Objects      Sprites             Full Container
  ─────────────────────────────────────────────────────────────────────
  Stateless         Stateful             Full VM              Full VM
  50s timeout       30s/request          Unlimited            Unlimited
  No scheduling     Built-in alarms      Full cron            Full cron
  No WebSocket      Built-in WS          Full networking      Full networking
  No filesystem     SQLite per user      Real filesystem      Real filesystem
  $0.001/user/mo    $0.01/user/mo        $5-15/user/mo       $15-30/user/mo

  Good for:         Good for:            Good for:            Good for:
  Simple API        Personal agents      Dev agents           Enterprise agents
  proxy             Health + scheduling  Code execution       Internal teams
                    Real-time push       Package install
                    Memory + learning    Browser automation
```

Cloudflare DOs hit the sweet spot:
- **Stateful** like a container, but **serverless** like Edge Functions
- **Per-user** isolation without per-user infrastructure management
- **Persistent SQLite** gives workspace power without filesystem complexity
- **Built-in scheduling** eliminates pg_cron scaling problems
- **WebSocket** enables the real-time "proactive agent" experience
- **Hibernate** = zero cost when inactive (consumer economics)
- **TypeScript native** = matches our entire stack
- **Global edge network** = low latency everywhere

Waldo doesn't need to install packages, run code, or browse the web. It needs to **remember, reason, schedule, and communicate**. That's exactly what a Durable Object provides.

---

## 8. Competitive Intelligence — How Others Solve This

### OpenClaw (180K+ Stars — Study This)

The fastest-growing OSS project in GitHub history has architecture remarkably similar to Waldo's planned design:

- **Gateway** (WebSocket server, Node.js) — single source of truth, coordinates channels
- **Multi-channel adapters** — 25+ channels (WhatsApp, Telegram, Slack, Discord, Signal, iMessage)
- **Session-based trust boundaries** — DMs = full capabilities, group chats = restricted (like our per-trigger tool permissions)
- **Hybrid memory** — vector + BM25 search in SQLite, MEMORY.md for long-term, daily logs, auto-reindexing
- **Tool sandboxing** — main sessions run tools natively, DM/group sessions default to ephemeral Docker containers

**Waldo's advantage over OpenClaw:** OpenClaw is a general-purpose personal agent. Waldo is biology-first — CRS, health data, circadian intelligence. OpenClaw can't compute a Nap Score because it has no health data pipeline.

### Coding Agents (Devin, Cursor, Codex) — Not Our Model

All coding agents use **task-based sandboxes**: spin up VM, do work, tear down. Each gets isolated Ubuntu VM or Firecracker microVM. This is the wrong model for Waldo — we need **persistent** agents that live 24/7 and learn over months, not ephemeral agents that complete tasks.

| Agent | Sandbox | Persistence | Per-User Cost | Model |
|---|---|---|---|---|
| Devin | Cloud sandbox (proprietary) | Per-session only | ACU-based | Task-based |
| Cursor Background Agents | Isolated Ubuntu VMs (AWS) | Git worktrees | Subscription | Task-based |
| OpenAI Codex | Cloud containers (GitHub Actions) | None | Usage-based | Task-based |
| Waldo (proposed) | Cloudflare Durable Object | **Indefinite** | ~$0.003/user/mo | **Persistent** |

### Kubernetes Agent Sandbox CRD (Brand New — March 2026)

The Kubernetes SIG Apps released a declarative API for deploying stateful AI agents:
- **Sandbox CRD**: single-container custom resource with gVisor/Kata runtime
- **SandboxWarmPool**: pre-provisioned pods to eliminate cold starts
- **SandboxClaim**: request mechanism to grab pre-warmed sandbox instantly
- **Suspend/resume** with state preservation, scale-to-zero

Worth watching for Phase 2+ if Cloudflare DOs hit limits. Could power the Pack (team) tier with heavier workloads.

### Anthropic's Effective Harness Pattern

Anthropic published guidance for long-running agents (the pattern Claude Code uses):
- **Two-agent system**: Initializer sets up environment, Coding agent runs repeatedly
- **Cross-session state via artifacts**: progress files, structured status, Git history
- **Key insight**: "Finding a way for agents to quickly understand the state of work when starting with a fresh context window"

This validates our approach: the Durable Object IS the harness. Its SQLite IS the cross-session state. No cold-start context assembly needed — the DO just wakes up with everything in memory.

### The Unsolved Problem (Validated)

Research confirms: **No one has solved "persistent personal agent for thousands of users" as a consumer product yet.**

- Coding agents are task-based (spin up, work, tear down)
- LangGraph checkpointing is the closest to per-user state, but it's a framework
- OpenClaw is self-hosted single-user
- Enterprise agents (AtlanClaw) have per-team containers that don't scale

**Whoever solves this has the moat.** Waldo with Cloudflare DOs could be first.

---

## 9. The Real Cost Problem: LLM, Not Infrastructure

Research from production deployments (47Billion, ZeroClaw) makes one thing clear: **LLM API costs dominate infrastructure costs by 10-100x.**

| Cost Component | 10K Users/Month | Notes |
|---|---|---|
| Cloudflare DO infrastructure | ~$5-25 | Hibernation keeps this tiny |
| Supabase Pro | $25 | Fixed |
| **Claude Haiku API** | **$50-500** | 5-20 calls/user/day × $0.001-0.005/call |
| Telegram/WhatsApp delivery | $0-20 | API costs |
| **Total** | **$80-570** | LLM is 50-90% of total |

This validates our existing optimizations as the highest-ROI work:
- **Rules pre-filter** (skip Claude when CRS > 60, stress < 0.3) — eliminates 60-80% of calls
- **Prompt caching** (soul files 1h TTL, profiles 5min) — 90% savings on cached portions
- **Tiered fallback** (Haiku → reduced context → template → silent)
- **Tool output compression** (~500 token cap with retrieval markers)
- **Per-user daily cost cap** ($0.10/day default)

The infrastructure decision (Cloudflare vs Supabase vs K8s) matters less than the LLM cost management. But Cloudflare DOs enable BETTER cost management because the agent has persistent state — it doesn't need to re-fetch and re-assemble context every invocation.

### Inngest / Restate as Durable Execution Layer

Within the Cloudflare DO, complex multi-step agent workflows (Morning Wag generation, pattern analysis, Constellation building) may benefit from a durable execution layer:

- **Inngest**: Event-driven, TypeScript-first, "harness not framework." AgentKit for multi-step. MCP integration. Works with Cloudflare Workers. Best fit.
- **Restate**: Durable journal, crash recovery, human-in-the-loop suspension. Also works with Cloudflare.
- **Temporal**: Overkill. OpenAI-scale infrastructure for teams with dedicated DevOps.

**Decision:** Evaluate Inngest in Phase D when building the agent loop inside the DO. The DO provides persistence; Inngest could provide durability for multi-step reasoning chains.

---

## 10. Dynamic Workers — The Missing Piece (March 2026)

**Source:** [Cloudflare Blog: Dynamic Workers](https://blog.cloudflare.com/dynamic-workers/)

Dynamic Workers are runtime-instantiated V8 isolates — new Worker sandboxes created on-demand with code specified at invocation time. This completes the Cloudflare architecture for Waldo:

```
┌─────────────────────────────────────────────────────────────┐
│                    PER-USER WALDO                            │
│                                                              │
│  Durable Object (persistent brain)                           │
│  ├── SQLite: memory, patterns, preferences, conversation     │
│  ├── Scheduler: Morning Wag alarm, Patrol timer              │
│  ├── WebSocket: real-time dashboard + chat                   │
│  ├── State machine: CRS zone, cooldowns, nudge phase         │
│  │                                                            │
│  │   When Waldo needs to ACT (reason, analyze, generate):    │
│  │                                                            │
│  │   ┌───────────────────────────────────────────────┐       │
│  │   │  Dynamic Worker (ephemeral execution sandbox)  │       │
│  │   │  - Spins up in milliseconds                    │       │
│  │   │  - Has ONLY the tools/APIs it needs (RPC)      │       │
│  │   │  - globalOutbound: null (no internet!)         │       │
│  │   │  - Executes agent code, returns result         │       │
│  │   │  - Dies immediately after                      │       │
│  │   └───────────────────────────────────────────────┘       │
│  │                                                            │
│  └── Writes results back to SQLite, sends via Channel        │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

**Isolates vs Containers:**
- Container: ~100ms start, ~50MB memory, vulnerable to breakouts
- V8 Isolate: ~2ms start, ~2MB memory, 9 years of Cloudflare security hardening
- **100x faster, 10-100x more memory efficient**

**No limits:** No global concurrency limits. No rate-of-creation limits. Every user can have multiple Dynamic Workers running simultaneously.

### Code Mode — 81% Token Reduction

This is the killer feature. Instead of the traditional ReAct loop (Claude calls tools one-by-one, each requiring an LLM round-trip), **Code Mode** has Claude write a single TypeScript function that chains all the API calls:

**Traditional (current Waldo, 3-4 LLM round-trips):**
```
Claude: "I need to check CRS" → tool_use: get_crs → result →
Claude: "Now sleep data" → tool_use: get_sleep → result →
Claude: "And schedule" → tool_use: get_schedule → result →
Claude: "Here's your Morning Wag..."
```
= 4 LLM calls, ~2000 input tokens each = ~8000 tokens total

**Code Mode (1 LLM call):**
```typescript
// Claude generates this ONCE:
async () => {
  const crs = await tools.getCrs(userId, today);
  const sleep = await tools.getSleep(userId, today);
  const schedule = await tools.getSchedule(userId, today);
  const memory = await tools.readMemory(userId, "preferences");

  return {
    score: crs.score,
    narrative: buildNarrative(crs, sleep, schedule),
    recommendations: prioritize(crs.zone, schedule.meetings, memory)
  };
}
```
= 1 LLM call + 1 Dynamic Worker execution = ~1500 tokens total

**Cloudflare measured 81% token reduction** with this pattern. For Waldo at 10K users, that's the difference between $500/month and $95/month in LLM costs.

### How It Maps to Waldo

| Waldo Trigger | Current (ReAct) | Code Mode |
|---|---|---|
| Morning Wag | 3-4 tool calls, 3-4 LLM round-trips | 1 generated function, 1 Dynamic Worker |
| Fetch Alert | 2-3 tool calls, 2-3 LLM round-trips | 1 generated function, 1 Dynamic Worker |
| Conversational | 1-3 tool calls (dynamic) | Hybrid: Code Mode for data fetch, LLM for response |

### Security Model (Matches AtlanClaw's Phantom Tokens)

Dynamic Workers have built-in security that mirrors what AtlanClaw built with claw-proxy:

| AtlanClaw Pattern | Dynamic Worker Equivalent |
|---|---|
| Phantom tokens (fake API keys) | RPC stubs (agent gets TypeScript interfaces, not raw API access) |
| iptables redirect (all traffic through proxy) | `globalOutbound: null` (no internet access at all) |
| Read-only root filesystem | V8 isolate (no filesystem access) |
| Egress allowlist | Capabilities passed via `env` (only what you bind) |
| seccomp audit logging | Cloudflare analytics + custom logging |

The Dynamic Worker **cannot access the internet**. It can only call the RPC stubs you pass to it. This is STRONGER isolation than AtlanClaw's proxy pattern — there's nothing to exfiltrate because there's no network path.

### Architecture: DO + Dynamic Worker + Code Mode

```typescript
// Inside the Durable Object (Waldo's brain)
export class WaldoAgent extends DurableObject {

  async handleMorningWag() {
    // 1. Load context from DO's SQLite
    const userPrefs = this.ctx.storage.sql`SELECT * FROM preferences`;
    const recentPatterns = this.ctx.storage.sql`SELECT * FROM patterns WHERE confidence > 0.7`;

    // 2. Ask Claude to generate a Code Mode function (1 LLM call)
    const agentCode = await this.generateAgentCode("morning_wag", userPrefs, recentPatterns);

    // 3. Execute in isolated Dynamic Worker
    const worker = this.env.LOADER.load({
      mainModule: "agent.js",
      modules: { "agent.js": agentCode },
      env: {
        HEALTH: this.healthDataRpc,     // RPC to Supabase health data
        MEMORY: this.memoryRpc,         // RPC to DO's SQLite
        WEATHER: this.weatherRpc,       // RPC to Open-Meteo
      },
      globalOutbound: null,             // NO internet access
    });

    const result = await worker.getEntrypoint().run();

    // 4. Write results back to DO + send via channel
    this.ctx.storage.sql`INSERT INTO daily_logs ...`;
    await this.sendViaChannel(result.message);
  }
}
```

### Cost Impact (Revised with Code Mode)

| Component | Without Code Mode | With Code Mode | Savings |
|---|---|---|---|
| Claude Haiku API (10K users) | $200-500/mo | **$40-100/mo** | 80% |
| Cloudflare infrastructure | $30-50/mo | $35-55/mo | ~same |
| Supabase | $25/mo | $25/mo | same |
| **Total** | **$255-575/mo** | **$100-180/mo** | **60-70%** |

Code Mode turns the LLM cost problem (Section 9) into a solved problem.

### When to Build This

- **Phase D (Agent Core):** Build the Durable Object + standard tool_use first (proven pattern)
- **Phase E-F:** Introduce Code Mode for Morning Wag and Fetch Alert (predictable, template-able)
- **Phase G:** Evaluate Code Mode for conversational (harder — dynamic tool needs)

Code Mode works best for **predictable workflows** where the set of tools is known upfront. Morning Wag and Fetch Alert are perfect candidates. Conversational chat may stay on traditional tool_use for flexibility.

---

## 11. Cloudflare R2 — Archival Storage Layer (Phase E+)

**Status:** Not yet in the architecture. Researched April 2026.
**Decision:** Add R2 as a cold-storage overflow tier alongside DO SQLite. Not required for Phase D. Becomes important at Phase E+ when conversation history grows past 30 days per user.

---

### Why R2 Matters for Waldo

Durable Objects with SQLite give each user a persistent brain. The problem: every row in DO SQLite costs compute (query reads are billed). Conversation history, episodic memory, and old observations accumulate fast. Without archival, you either:
- Delete old context (loses agent learning over months)
- Keep it all in SQLite (costs scale with history length, not just active users)

R2 is Cloudflare's object storage — zero egress, $0.015/GB/month, accessible from DOs via binding. It's the natural cold tier for anything older than 30-90 days.

**The key number:** DO SQLite caps at **10 GB per DO**. For a health AI generating 5-20 KB of episodic memory per day, that's 136-550 years of headroom — more than enough. R2 is less about capacity and more about **cost and compliance**: archiving old episodes to R2 reduces DO query costs, and R2 signed URLs enable GDPR-compliant data exports with zero engineering overhead.

---

### Storage Decision Matrix

| Data | Hot (0-30 days) | Warm (30-90 days) | Cold (90+ days) | Never |
|------|-----------------|-------------------|-----------------|-------|
| Semantic memory (memory_blocks) | DO SQLite | DO SQLite | DO SQLite (stays forever, tiny) | — |
| Episodic memory (episodes) | DO SQLite | DO SQLite (compressed) | **R2 archival** | — |
| Procedural memory (procedures/evolutions) | DO SQLite | DO SQLite | DO SQLite (small, keep forever) | — |
| Raw health values (HRV, HR, sleep) | **Supabase only** | Supabase | Supabase | DO, R2 |
| Derived health insights | DO SQLite | DO SQLite | DO SQLite | Raw values |
| CRS scores | Supabase | Supabase | Supabase | — |
| Conversation exports (GDPR) | — | — | **R2 exports bucket** | Supabase, DO |
| Monthly health snapshots | Supabase | Supabase | **R2 backups** (optional) | — |

**Key invariant:** Raw health values never touch R2. Health data is Supabase-only (RLS, encryption, compliance). R2 is for **agent memory** (episodic) and **user-facing exports**.

---

### DO SQLite vs R2: When to Use Each

```
Use DO SQLite when:
  ✓ Data accessed on most invocations (memory_blocks always loaded)
  ✓ Data needs SQL queries (filter by date, join with other tables)
  ✓ Data is <30 days old (high likelihood of being needed)
  ✓ Data drives real-time decisions (current zone, cooldown state)

Use R2 when:
  ✓ Data >90 days old and accessed <1x/month (old episodes)
  ✓ Large blobs (conversation exports, health data dumps)
  ✓ User-facing downloads (signed URLs, GDPR exports)
  ✓ Cross-region backups (R2 automatic replication)
  ✗ Never for real-time decisions
  ✗ Never for raw health values
```

---

### The Archival Pattern: DO SQLite → R2

**Trigger:** Patrol Agent's weekly consolidation (already in HEARTBEAT_WEEKLY.md). After compacting old episodes into summaries, archive the raw episodes to R2.

**R2 bucket structure:**
```
waldo-episodes/
  {user_id}/
    {year}/
      {month}/
        episodes_{timestamp}.jsonl   ← raw episodes, newline-delimited JSON
        summary_{timestamp}.md       ← Patrol Agent's weekly summary
```

**DO SQLite schema addition** (add to `episodes` table):
```sql
ALTER TABLE episodes ADD COLUMN archived_to_r2 BOOLEAN DEFAULT false;
ALTER TABLE episodes ADD COLUMN r2_key TEXT;  -- full R2 path for retrieval
```

**Patrol Agent archival logic** (TypeScript, runs inside DO):
```typescript
// 1. Find episodes older than 90 days, not yet archived
const oldEpisodes = await this.ctx.storage.sql`
  SELECT * FROM episodes
  WHERE created_at < datetime('now', '-90 days')
    AND archived_to_r2 = false
  ORDER BY created_at
`.all();

if (oldEpisodes.length === 0) return;

// 2. Serialize as JSONL
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const month = new Date().toISOString().slice(0, 7);
const r2Key = `${userId}/${new Date().getFullYear()}/${month}/episodes_${timestamp}.jsonl`;
const body = oldEpisodes.map(e => JSON.stringify(e)).join('\n');

// 3. Write to R2 (env.R2 = R2Bucket binding)
await this.env.WALDO_R2.put(r2Key, body, {
  httpMetadata: { contentType: 'application/jsonl' },
  customMetadata: {
    user_id: userId,
    episode_count: String(oldEpisodes.length),
    date_range_start: oldEpisodes[0].created_at,
    date_range_end: oldEpisodes[oldEpisodes.length - 1].created_at,
  },
});

// 4. Mark episodes as archived, then delete from SQLite
const ids = oldEpisodes.map(e => e.id);
await this.ctx.storage.sql`
  UPDATE episodes
  SET archived_to_r2 = true, r2_key = ${r2Key}
  WHERE id IN (${ids.join(',')})
`;
await this.ctx.storage.sql`
  DELETE FROM episodes WHERE archived_to_r2 = true
`;

// 5. Store the archive index in memory_blocks so agent knows what's archived
await this.ctx.storage.sql`
  INSERT OR REPLACE INTO memory_blocks (key, value, updated_at)
  VALUES (
    'archived_episodes_index',
    json_patch(
      COALESCE((SELECT value FROM memory_blocks WHERE key = 'archived_episodes_index'), '{}'),
      json_object(${r2Key}, json_object(
        'count', ${oldEpisodes.length},
        'archived_at', ${new Date().toISOString()}
      ))
    ),
    datetime('now')
  )
`;
```

**Retrieval (if agent needs old context):** The `constellation_search()` tool (Phase 2) fetches from Supabase pgvector. For episodic archival lookup, a new tool `retrieve_archived_episodes(date_range)` reads the R2 key from memory_blocks index and streams the JSONL.

---

### GDPR Export Pattern

When a user requests their data (right to access, right to portability), generate a complete export and store in R2 with a signed URL:

```typescript
// New tool: export_user_data()
async function exportUserData(userId: string, env: Env): Promise<string> {
  // 1. Pull from Supabase (health data — never in DO)
  const healthData = await fetchAllUserHealthData(userId);

  // 2. Pull from DO SQLite (memory, patterns, episodes summary)
  const agentMemory = await getFullAgentMemory(userId);

  // 3. Compile export
  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    health_data: healthData,        // CRS scores, health snapshots
    agent_memory: agentMemory,      // Memory blocks, patterns, calibrations
    disclaimer: 'Not a medical device. For informational purposes only.',
  };

  // 4. Upload to R2 exports bucket
  const exportKey = `exports/${userId}/waldo_export_${Date.now()}.json`;
  await env.WALDO_R2.put(exportKey, JSON.stringify(exportData, null, 2), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { user_id: userId, type: 'gdpr_export' },
  });

  // 5. Generate signed URL (valid 24 hours)
  const signedUrl = await env.WALDO_R2.createSignedUrl(exportKey, {
    expiresIn: 86400,
    method: 'GET',
  });

  return signedUrl;  // Send to user via Telegram or email
}
```

**R2 Lifecycle rule** (set in Cloudflare dashboard):
- `exports/` prefix: delete after 7 days (download window)
- `{user_id}/` archive prefix: move to Infrequent Access class after 30 days, delete after 2 years

---

### Wrangler Configuration (Phase E)

Add to `cloudflare/waldo-agent/wrangler.toml`:
```toml
[[r2_buckets]]
binding = "WALDO_R2"
bucket_name = "waldo-episodes"
preview_bucket_name = "waldo-episodes-preview"  # for local dev

# Separate bucket for user-facing exports
[[r2_buckets]]
binding = "WALDO_EXPORTS"
bucket_name = "waldo-exports"
preview_bucket_name = "waldo-exports-preview"
```

**Note:** Two buckets — one for internal archival (episodes, summaries), one for user-facing exports. Different lifecycle rules, different access patterns.

---

### Cost Model

**For 10,000 users at Phase D-E:**

| Layer | Data Size | Monthly Cost |
|---|---|---|
| DO SQLite (Tier 1-3, active memory) | 10K users × 500 KB avg = 5 GB | ~$5-10/month |
| R2 archival (episodic, >90 days) | 10K users × 2 MB/month accumulation = 20 GB after 1yr | **$0.30/month** |
| R2 exports (GDPR, temporary) | 10K users × 5 MB, deleted after 7d | **<$0.10/month** |
| Supabase health data (unchanged) | Existing Supabase plan | $25/month |
| **Total storage** | | **~$35-45/month** |

**R2 egress: $0.00/GB** — This is the killer advantage. If users download health exports or Waldo retrieves archived episodes, there's no egress charge. Compare to S3 at $0.09/GB which makes large exports expensive at scale.

**Break-even vs keeping everything in DO SQLite:** R2 is cheaper past ~100 MB per user. Below that, the operational overhead isn't worth it. Start archiving at Phase E (100+ users, 6+ months of data per user).

---

### Open Questions for R2 Integration

1. **R2 bindings in DOs** — R2 bucket access from a DO requires a Worker binding (`env.WALDO_R2`). The binding is passed to the DO constructor. Verify the Cloudflare Agents SDK supports this natively (it should — it's a standard Worker env pattern).

2. **Privacy of archived episodes** — Archived episodes are user's conversation history and agent observations. They do NOT contain raw health values (per architecture rule), but they contain personal context ("user mentioned they're stressed about deadline"). Apply at-rest encryption using Cloudflare R2's SSE-C option or encrypt before writing.

3. **Cross-region data residency** — If your Supabase is in eu-west and Cloudflare routes the DO to a US datacenter, archived R2 objects are written from that US DO. R2 auto-replicates globally anyway. May need `jurisdiction` setting on R2 bucket for EU data residency compliance.

4. **Retrieval latency** — R2 reads from a DO are ~50-150ms (R2 is designed for low-latency). Acceptable for archival retrieval (not on the critical path of Morning Wag generation). Only trigger R2 reads when user explicitly asks about historical context.

---

## 12. Open Questions

1. **Supabase Auth integration with Cloudflare Workers** — how do we validate Supabase JWTs in Workers? (Answer: verify JWT signature against Supabase JWKS endpoint)

2. **Health data sync trigger** — when the phone writes new health data to Supabase, how does the DO know? Options:
   - Supabase webhook on INSERT → calls DO
   - Phone calls DO directly after Supabase sync
   - DO polls Supabase on its own schedule (simplest, slight delay)

3. **Offline/on-phone CRS** — CRS computation stays on-phone (offline-capable). But the DO also needs CRS for scheduling decisions. Dual computation? Or phone pushes CRS to both Supabase and DO?

4. **Cloudflare Workers AI vs external Claude** — Cloudflare offers Workers AI with various models. For MVP we stick with Claude Haiku via API, but could use Workers AI for lightweight tasks (classification, summarization) to reduce costs.

5. **Data residency** — Cloudflare DOs run at the edge, closest to the user. Health data in Supabase is in a fixed region. Is the cross-region latency acceptable? (Likely yes — it's a REST call, not real-time streaming.)

---

## Sources

- [Cloudflare Agents SDK](https://github.com/cloudflare/agents) — TypeScript framework for persistent stateful agents on Durable Objects
- [Cloudflare Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) — $0.15/M requests, free hibernation
- [Cloudflare R2 Overview](https://developers.cloudflare.com/r2/) — zero-egress object storage, S3-compatible API
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) — $0.015/GB/month, $0 egress
- [Cloudflare Storage Options Guide](https://developers.cloudflare.com/workers/platform/storage-options/) — DO vs R2 vs KV vs D1 decision matrix
- [SQLite in Durable Objects GA](https://blog.cloudflare.com/sqlite-in-durable-objects/) — 10 GB per DO limit, billing model
- [Fly.io Sprites](https://devclass.com/2026/01/13/fly-io-introduces-sprites-lightweight-persistent-vms-to-isolate-agentic-ai/) — persistent VMs for AI agents
- [E2B Sandboxes](https://e2b.dev/docs) — Firecracker microVMs, 200ms boot, 15M sessions/month
- [Agent-Sandbox](https://github.com/agent-sandbox/agent-sandbox) — E2B-compatible, K8s-based, self-hosted
- [Letta (MemGPT)](https://github.com/letta-ai/letta) — tiered memory architecture for persistent agents
- [Supabase Multi-Tenant RLS](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — RLS patterns for per-user isolation
- [AtlanClaw Deployment Doc](file:///Users/shivansh.fulper/Github/ship/mothership/docs/knowledge-base/atlanclaw-deployment.html) — K8s centralized deployment, phantom tokens, claw-proxy sidecar

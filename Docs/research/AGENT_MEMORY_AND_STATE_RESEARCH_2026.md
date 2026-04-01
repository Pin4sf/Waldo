# Agent Memory Systems & State Management Research (March 2026)

Deep research into emerging patterns for agent memory, state management, self-evolution, context engineering, and proactive intelligence. Conducted for Waldo's Phase D-E architecture decisions.

---

## Table of Contents

1. [Memory Architectures for AI Agents](#1-memory-architectures)
2. [Agent State Management](#2-state-management)
3. [Agent Self-Evolution and Learning](#3-self-evolution)
4. [Context Window Management](#4-context-management)
5. [Proactive Agent Patterns](#5-proactive-patterns)
6. [Framework Landscape](#6-framework-landscape)
7. [Implications for Waldo](#7-waldo-implications)

---

## 1. Memory Architectures

### 1.1 The Four Memory Types (Cognitive Science Mapping)

The field has converged on four memory types drawn from cognitive science:

| Memory Type | Analogy | What It Stores | Persistence | Implementation |
|---|---|---|---|---|
| **Working Memory** | Current thought | Active conversation, tool outputs, recent reasoning | In-context window | Message buffer, system prompt |
| **Episodic Memory** | "What happened" | Past interactions, timestamped events, conversation logs | External DB | Vector store + timestamps |
| **Semantic Memory** | "What I know" | Accumulated facts, user preferences, domain knowledge | External DB | Knowledge graph or structured KV |
| **Procedural Memory** | "How I do things" | Decision logic, learned workflows, skill patterns | Prompt/code | System prompts, tool definitions, learned skills |

**Key insight for Waldo**: For a personal health AI assistant, **episodic memory is most important** (remembering past health events, user reactions, what worked). Semantic memory is second (user preferences, baselines, patterns). Procedural memory is third (learned intervention strategies). This is different from domain-expert agents where semantic memory dominates.

**Memory consolidation** -- the transformation from episodic ("Tuesday your HRV dropped after a late night") to semantic ("User's HRV consistently drops after sleeping past midnight") -- is what makes agents get smarter over time. This maps directly to Waldo's Spots-to-Constellation pipeline.

### 1.2 Letta (MemGPT) -- Tiered Memory Architecture

Letta implements the "LLM as Operating System" paradigm where the model manages its own memory like a traditional OS manages RAM and disk.

**Three-tier hierarchy:**

```
Tier 1: Core Memory (in-context "RAM")
  - Structured memory blocks pinned to the context window
  - Each block has: label, description, value, character limit
  - Agent reads/writes these directly via tool calls
  - Small, fast, always available

Tier 2: Recall Memory (searchable "disk cache")
  - Full conversation history stored externally
  - Searchable via semantic similarity
  - Agent queries via tool calls when it needs conversation context

Tier 3: Archival Memory (long-term "cold storage")
  - Explicitly formulated knowledge in vector/graph databases
  - Retrieved via tool calls on demand
  - Unlimited capacity
```

**How agents manage their own memory:**
- The agent has explicit tool calls: `core_memory_append`, `core_memory_replace`, `archival_memory_insert`, `archival_memory_search`, `conversation_search`
- The LLM decides when to move data between tiers -- writing important facts to core memory, archiving old context to archival, searching recall when it needs history
- This is "agentic memory" -- the agent decides what to remember, not the developer

**Message eviction and summarization:**
When context capacity is reached, Letta performs recursive summarization -- older messages get proportionally less representation. Recent exchanges stay verbatim while older content compresses into summary form.

**2025-2026 innovations:**
- **Sleep-Time Compute**: A background "sleep-time agent" shares memory blocks with the primary agent. While the primary agent is idle (waiting for user input), the sleep-time agent consolidates, cleans, and refines memory asynchronously. This produces higher-quality memory blocks without blocking conversation latency. The primary agent can read the evolving memory anytime without waiting.
- **Context Repositories**: Git-based memory versioning for coding agents
- **Continual Learning**: Learning "in token space" so memories persist across model generations

**Waldo relevance**: Letta's dual-agent architecture (primary + sleep-time) maps well to Waldo's pg_cron background processing. A "Patrol Agent" could run during off-hours to consolidate daily health observations into refined patterns (Spots into Constellations), clean up memory blocks, and prepare context for the next Morning Wag.

### 1.3 Mem0 -- Universal Memory Layer

Mem0 is a memory orchestration layer that sits between AI agents and storage, managing the full memory lifecycle.

**Architecture:**

```
Agent Interaction
  |
  v
Memory Extraction (LLM identifies salient info from conversation)
  |
  v
Memory Storage (dual-store: vector embeddings + optional knowledge graph)
  |       |
  |       v
  |   Graph Layer (Pro tier):
  |     - Entity Extractor -> nodes
  |     - Relations Generator -> labeled edges
  |     - Conflict Detector -> overlap resolution
  |     - Update Resolver -> add/merge/invalidate/skip
  |
  v
Memory Retrieval (semantic similarity + graph traversal)
  |
  v
Context Injection (relevant memories injected into prompt)
```

**Key capabilities:**
- **Intelligent filtering**: Priority scoring + contextual tagging decide what gets stored (avoids memory bloat)
- **Dynamic forgetting**: Low-relevance entries decay over time, freeing space and attention
- **Memory consolidation**: Information moves between short-term and long-term based on usage patterns, recency, significance
- **Adaptive updates**: Modifies existing memories rather than creating duplicates
- **Scoping**: user-level, session-level, and agent-level memory

**Performance**: 26% higher accuracy vs OpenAI's memory on LOCOMO benchmark. 91% lower p95 latency. 90%+ token cost savings vs full-context approaches.

**Waldo relevance**: Mem0's intelligent filtering and dynamic forgetting are exactly what Waldo's `update_memory` tool needs. Rather than the agent just appending text to a memory store, Mem0's pattern of extracting salient info, checking for conflicts with existing memories, and consolidating -- this is a production-ready implementation of what Waldo's architecture doc describes conceptually.

### 1.4 Zep/Graphiti -- Temporal Knowledge Graphs

Zep's core innovation is a **temporally-aware knowledge graph** built on Graphiti, stored in Neo4j.

**Three-tier subgraph hierarchy:**

```
Episode Subgraph (raw data)
  - Stores original messages, text, JSON as episodic nodes
  - Non-lossy data store -- preserves everything
  - Source of truth for extraction
      |
      v (entities and relationships extracted)
Semantic Entity Subgraph (structured knowledge)
  - Entity nodes represent concepts
  - Semantic edges capture relationships
  - Entities are resolved against existing graph (deduplication)
      |
      v (community detection)
Community Subgraph (high-level patterns)
  - Clusters of strongly connected entities
  - Summarizations providing comprehensive views
  - Highest abstraction level
```

**Bi-temporal tracking** -- every edge carries four timestamps:
- `t_created`, `t_expired` (system tracking: when ingested)
- `t_valid`, `t_invalid` (fact validity: when the fact was actually true/false)

This enables queries like "What was the user's sleep pattern BEFORE they started the new medication?" -- something flat vector search cannot do.

**Conflict resolution**: When new info contradicts existing facts, the system uses an LLM to compare edges, detect contradictions, and invalidate old edges by setting `t_invalid` to the `t_valid` of the new contradicting edge. Old information is never deleted -- just marked as no longer valid.

**Retrieval** uses three complementary methods (NO LLM calls during retrieval):
1. Cosine similarity (semantic vector matching)
2. BM25 full-text search (keyword matching)
3. Breadth-first graph traversal (structural/contextual similarity)

Followed by Reciprocal Rank Fusion + Maximal Marginal Relevance reranking. P95 retrieval latency: 300ms.

**Performance**: On LongMemEval (115K-token conversations): Zep reduces context from 115K tokens to 1.6K tokens while improving accuracy by 18.5% (with gpt-4o). Response time drops from ~30s to ~3s. Temporal reasoning improves by +48.2%.

**Waldo relevance**: This is the most compelling architecture for Waldo's Constellation system. Health facts have temporal validity (sleep patterns change, stress triggers evolve, medications start/stop). The bi-temporal model lets Waldo answer "How has the user's recovery changed since they started running 3x/week?" -- a query that requires understanding temporal relationships between entities. The three-tier hierarchy also maps to Waldo's existing concepts: Episodes = individual health snapshots, Semantic Entities = Spots, Communities = Constellations.

### 1.5 Memory Indexing: Vector vs Graph vs Hybrid

| Approach | Strengths | Weaknesses | Best For |
|---|---|---|---|
| **Vector** | Fast semantic search, simple to implement, scales well | No temporal reasoning, no multi-hop queries, flat structure | Single-hop preference recall, semantic similarity |
| **Knowledge Graph** | Temporal reasoning, multi-hop queries, explicit relationships | Complex to build/maintain, higher infra cost | Entity evolution, temporal queries, relationship reasoning |
| **Hybrid (Vector + Graph)** | Combines both, most robust | More complex architecture, dual storage | Production agents needing both types of queries |

**Independent benchmark (LongMemEval):**
- Mem0 (vector-based): 49.0%
- Zep (graph-based): 63.8%
- Full-context baseline: 55.4%

The 15-point gap reflects a real architectural difference: graph-native structure excels at queries requiring relationship traversal and temporal reasoning.

**Recommendation**: Start with vector (simpler), add graph when temporal reasoning becomes critical. For Waldo, this means:
- MVP (Phase D): Vector-based memory via `update_memory` / `read_memory` tools
- Phase 2: Add temporal knowledge graph for Constellation-level insights

### 1.6 Memory Decay and Consolidation

**Decay strategies:**
- **Recency-weighted scoring**: `relevance_score = semantic_similarity * exp(-lambda * time_since_last_access)` -- memories not recalled recently lose salience gradually
- **TTL-based expiration**: Context-specific knowledge expires faster than core operational knowledge
- **Access-frequency weighting**: Memories strengthen when recalled, weaken when unused
- **Category-aware decay rates**: Health baselines decay slowly (30-day rolling), daily observations decay faster (7-day), contextual notes decay fastest (48h)

**Consolidation triggers:**
- Periodic (daily recommended as starting point, adjust based on volume)
- Threshold-based (when memory count exceeds limit)
- Event-driven (after significant interaction clusters)

**Consolidation process:**
1. Extract salient information from recent episodic memories
2. Merge redundant entries (same fact stated multiple ways)
3. Promote recurring patterns to semantic memory
4. Discard irrelevant details
5. Update knowledge graph edges with new temporal validity

**Waldo relevance**: Map decay rates to Waldo's data types. CRS baselines: 30-day rolling window (slow decay). Stress event context: 7-day window (medium decay). Morning Wag acknowledgments: 48h window (fast decay). Constellation patterns: no decay (permanent until invalidated by new evidence).

---

## 2. State Management

### 2.1 Stateful vs Stateless Agent Patterns

**The core tension**: Most LLM APIs (Claude, GPT-4) are stateless by default. They don't remember anything between API calls unless you explicitly pass context back in. But agents need to remember.

**Stateless pattern** (what Waldo uses via Supabase Edge Functions):
```
Request arrives -> Load state from DB -> Construct prompt -> Call LLM -> Update state in DB -> Return response
```

**Stateful pattern** (persistent process):
```
Agent process keeps state in memory -> Receives event -> Processes with full context -> Updates internal state
```

**Hybrid pattern** (emerging best practice):
```
Stateless inference frontends (scalable)
  + Stateful orchestrators (durable state management)
  + External state stores (Postgres, Redis, vector DB)
```

**For Waldo's Edge Functions**: The stateless-with-external-state pattern is correct. Each Edge Function invocation loads user state from Supabase, constructs context, calls Claude, then writes updated state back. The key is making the state loading/saving efficient.

### 2.2 State Categories to Persist

| Category | Storage | TTL | Example |
|---|---|---|---|
| Conversation history | Postgres + summaries | Session-based | Recent messages |
| User preferences | Postgres KV | Permanent | Language style, timing preferences |
| Intermediate workflow | Postgres | Per-workflow | Pending Fetch Alert evaluation |
| Extracted facts | Vector store | Decay-based | "User sleeps poorly on Sundays" |
| Tool execution outputs | Ephemeral | Per-invocation | get_crs result |
| Agent behavioral params | Postgres | Per-evolution | Verbosity level, preferred topics |

### 2.3 Production Failure Modes

| Failure | Cause | Mitigation |
|---|---|---|
| Stale state | Concurrent pg_cron + user message | Version state with timestamps; compare-and-swap writes |
| Partial updates | Crash between memory write and message send | Atomic transactions; event logs as source of truth |
| Prompt drift | Accumulated summaries diverge from ground truth | Validate against raw data periodically; store raw events |
| Lost state on retry | Edge Function timeout mid-execution | Checkpoint at each state transition; idempotent operations |
| Memory poisoning | Bad data enters memory | Validation rules on memory writes; memory versioning with rollback |

### 2.4 Durable Execution for Agents

Two frameworks have emerged for making agent operations survive failures:

**Restate:**
- Records every step in a durable journal
- If process crashes, replays recorded results (not re-executes)
- Sits as a proxy in front of serverless functions
- LLM calls are persisted so responses aren't re-fetched on recovery
- Tool executions wrapped in `run`-blocks to persist side effects
- Supports suspend/resume for human-in-the-loop (agent sleeps while waiting for approval)

**Inngest:**
- Event-driven durable workflow engine
- Code-based durable workflows with conditionals, loops, dynamic branching
- `step.ai.infer` offloads inference requests with durability
- Each LLM call paid for exactly once (cached on retry)
- Runs on edge, serverless, or traditional infra

**Waldo relevance**: Waldo's Edge Functions have a 50s hard timeout and max 3 agent iterations. This is currently managed by the loop guard in the agent code. If Waldo ever needs longer-running agent operations (multi-step interventions, complex Constellation analysis), durable execution via Restate or Inngest would be the path. For MVP, the current approach (stateless Edge Functions with Postgres state) is sufficient. Evaluate Restate for Phase 2 when multi-step workflows emerge.

### 2.5 LangGraph Checkpointing Patterns

LangGraph's approach to state persistence is instructive even if Waldo doesn't use LangGraph:

- **Thread-scoped checkpoints**: Every graph execution step saves a snapshot (conversation state, tool outputs, reasoning). Enables resume from any point.
- **Cross-thread memory stores**: MongoDB/Redis stores enable learning across conversations (user preferences persist beyond single threads).
- **Reducer-driven state schemas**: TypedDict with reducer functions ensure state updates don't lose data in concurrent scenarios.

**Checkpointer hierarchy:**
1. MemorySaver (RAM -- dev only)
2. SqliteSaver (local -- single server)
3. PostgresSaver (distributed -- production)
4. RedisSaver (distributed + vector search -- advanced)

**Waldo mapping**: Waldo's `health_snapshots` + `agent_logs` + user memory tables in Supabase Postgres already implement a form of this. The insight is to add explicit version tracking to memory writes (compare-and-swap) to prevent concurrent pg_cron and user-message triggers from corrupting state.

---

## 3. Self-Evolution and Learning

### 3.1 Evolution Taxonomy

Research identifies three axes of agent self-evolution:

| Axis | Options | Cost | Speed |
|---|---|---|---|
| **What evolves** | Prompts, memory, toolsets, workflows, model parameters | Prompts cheapest, parameters most expensive | Prompts fastest, parameters slowest |
| **When to evolve** | Intra-task (within one interaction) or inter-task (across interactions) | Intra-task is free, inter-task needs pipeline | Intra-task immediate, inter-task batch |
| **How to evolve** | In-context learning, supervised fine-tuning, RL, evolutionary algorithms | ICL free, SFT moderate, RL expensive | ICL instant, SFT hours, RL days |

**For Waldo**: The right combination is **prompt evolution** (cheapest, fastest) + **memory evolution** (accumulates knowledge) happening **inter-task** (across interactions) via **in-context learning** (no model retraining needed). This is exactly what Waldo's `agent_evolutions` table already describes.

### 3.2 OpenAI Self-Evolving Agents Pattern

OpenAI's cookbook describes a production-ready feedback loop:

```
1. Agent produces output against production workload
2. Feedback collected (human reviewers OR LLM-as-judge)
3. Structured evaluation with composite scores
4. Meta-prompting: a separate "metaprompt agent" receives:
   - Original prompt text
   - Failed output + input
   - Specific grader feedback explaining failures
5. Metaprompt agent synthesizes improved system message
6. New prompt replaces baseline once performance threshold exceeded
```

**Four complementary graders:**
- Rule-based checkers (domain entity presence, length constraints)
- Embedding similarity (semantic fidelity to source)
- LLM-as-judge (rubric-driven holistic quality)
- Composite scoring with "lenient pass" thresholds

**Key insight**: The system tracks `PromptVersionEntry` with version number, timestamp, and eval run IDs. Supports rollback if regressions occur. Up to 3 optimization cycles before escalating to human engineers.

**Waldo mapping**: This is more sophisticated than Waldo needs for MVP. But the grader pattern is useful: Waldo's quality gates (medical safety, personality consistency, actionability) already serve as graders. The evolution loop could be:
1. User feedback (thumbs up/down, dismissal, correction)
2. Rule-based signal detection (already in Waldo's spec)
3. Accumulated signals trigger behavioral parameter changes (verbosity, timing, topic weight)
4. Changes tracked in `agent_evolutions` with version history and rollback capability

### 3.3 PAHF: Personalized Agents from Human Feedback (Meta, Feb 2026)

PAHF introduces a three-step loop for continual personalization:

```
1. Pre-Action Interaction:
   - Agent queries memory for relevant preferences
   - When ambiguity detected, proactively asks clarification BEFORE acting
   - Resolves "known uncertainty" upfront

2. Action Execution:
   - Synthesizes instruction + observation + retrieved preferences + clarification
   - Executes grounded in stated preferences

3. Post-Action Feedback Integration:
   - If outcomes incorrect, user provides corrective feedback
   - Salience detector (LLM-as-judge) identifies important signals
   - Summarize into preference notes
   - Similarity-based merging or addition to memory
```

**Memory**: Per-user memory using dense retrieval (SQLite or FAISS) storing natural-language preference notes with embeddings. A detect-summarize-integrate pipeline processes feedback.

**vs Traditional RLHF**: PAHF treats interaction itself as the learning signal (not a static training dataset). Handles three things RLHF can't: immediate adaptation to new users, real-time corrective feedback, and non-stationary preferences (preferences that change over time).

**Mathematical result**: Pre-action feedback eliminates O(gamma*T) errors from partial observability. Post-action feedback prevents Omega(T) errors from preference drift. Both channels together achieve O(K+gamma) dynamic regret.

**Waldo relevance**: The pre-action clarification pattern is powerful for health contexts. Instead of Waldo assuming the user wants clinical detail in a Morning Wag, it could (rarely, not every time) ask: "I've been giving you the numbers -- would you prefer I just tell you what to do differently today?" The post-action feedback integration is what Waldo's evolution system needs. The key insight is that BOTH pre-action and post-action feedback channels are needed for optimal personalization.

### 3.4 Implicit Feedback Signal Detection

For rule-based signal detection (no LLM needed):

| Signal | Detection Method | Strength |
|---|---|---|
| Thumbs down / "not helpful" | Explicit UI action or NLP pattern match | Strong negative |
| Message not opened within 2h | Delivery status + time check | Medium negative (implicit) |
| Alert dismissed without reading | Read receipt + time-to-dismiss | Medium negative |
| Enthusiastic reply with detail | NLP sentiment + message length | Strong positive |
| User correction ("no, I meant...") | Pattern match on correction phrases | Strong negative (specific) |
| Repeated similar question | Semantic similarity to recent queries | Signal of confusion/failure |
| Quick acknowledgment ("ok", "thanks") | Short positive reply | Weak positive |
| Follow-up question asking for more | Message length + question marks | Strong positive |

**Waldo's spec already has this** in the `agent_evolutions` section. The research confirms the approach: accumulate 3+ signals in the same direction before evolving, decay unapplied changes after 30 days, max 2 changes per week, auto-revert on negative feedback spikes.

---

## 4. Context Window Management

### 4.1 The Context Engineering Paradigm

"Context engineering" has replaced "prompt engineering" as the key discipline. It's the art of curating what tokens enter the limited context window from the constantly evolving universe of possible information.

**What competes for context space:**
- System prompt (soul files, safety rules)
- Tool definitions (each schema: 100-500+ tokens)
- Retrieved documents (memory, health data)
- Conversation history
- Tool outputs (can be large)
- Space reserved for reasoning/output

**Critical failure modes:**
1. **Context Poisoning**: Errors compound through reuse (bad memory entry keeps getting retrieved)
2. **Context Distraction**: Too much history causes over-reliance on irrelevant past behavior
3. **Context Confusion**: Irrelevant tools/documents misdirect the model
4. **Context Clash**: Contradictory information creates conflicting assumptions

**The attention degradation curve**: As context grows, precision drops, reasoning weakens, and the model starts missing information. This is not a hard cliff but a gradient -- every token competes for attention with every other token (n-squared pairwise relationships).

### 4.2 Strategies Comparison

| Strategy | How It Works | Pros | Cons | Best For |
|---|---|---|---|---|
| **Sliding Window** | Keep last N messages, drop oldest | Simple, predictable | Loses important early context | Short conversations |
| **Summarization/Compaction** | Compress older messages into summaries | Preserves key info, extends effective length | Lossy (nuance lost), requires LLM call | Long single-session tasks |
| **RAG (Retrieval)** | Store externally, retrieve relevant pieces | Scales to unlimited history, precise | Can miss context, retrieval quality varies | Cross-session knowledge |
| **Hybrid (Summary + RAG)** | Summarize recent + retrieve from long-term | Best of both worlds | Complex to implement, dual infra | Production agents |
| **Sub-agent decomposition** | Delegate to specialized agents with clean windows | Each agent has focused context | Coordination overhead | Complex multi-step tasks |
| **Just-in-time loading** | Keep identifiers, load full data via tools | Minimal context footprint | Extra tool calls add latency | Large data payloads |

### 4.3 What Claude Code Does (Instructive Reference)

Claude Code's compaction system:
- **CLAUDE.md files**: Survive compaction completely (re-read from disk after /compact)
- **Auto memory**: Claude saves notes for itself (build commands, debugging insights, architecture notes, preferences) in MEMORY.md + topic files
- **Compaction**: Takes entire conversation, creates summary preserving identifiers, values, context, citations. Starts fresh session with summary preloaded.
- **Session memory**: Continuous updates with every message (title + status). Powers instant compaction.
- **Key insight**: Information loss happens -- specific variable names, exact error messages, nuanced decisions get compressed. The system prioritizes preserving identifiers (IDs, paths, URLs) and values (numbers, dates, configs) over narrative.

### 4.4 Anthropic's Context Engineering Best Practices

From Anthropic's engineering blog:

1. **System prompt calibration**: Balance specificity with flexibility. Use XML tags or Markdown headers for structure.
2. **Tool definition efficiency**: Minimize overlap, return token-efficient info, self-contained scope. Avoid bloated toolsets.
3. **Few-shot examples**: Diverse, canonical examples as compressed behavioral guidance (not exhaustive edge-case docs).
4. **Just-in-time retrieval**: Maintain lightweight identifiers, dynamically load via tools. Progressive disclosure where agents incrementally discover context.
5. **Compaction**: Preserve architectural decisions, unresolved bugs, implementation details. Discard redundant outputs. Start with high recall, then optimize precision.
6. **Structured note-taking**: External notes (NOTES.md, memory tools) that persist across context resets. Enable multi-hour coherence.
7. **Sub-agent architectures**: Each subagent explores extensively but returns only 1,000-2,000 token condensed summaries.

**Tool definition overhead is real**: A single complex schema can consume 500+ tokens. Connect a few MCP servers and you hit 50,000+ tokens before reasoning starts. Waldo's dynamic tool loading (3-4 tools per call, not all 8) is already the right pattern.

### 4.5 Waldo-Specific Context Budget

For a Haiku 4.5 invocation within Waldo's 50s timeout and cost constraints:

```
Available context: ~200K tokens (Haiku 4.5)
Practical budget (for quality reasoning): ~8-12K tokens input

Allocation:
  Soul files (SOUL_BASE + trigger-specific):     ~1,500 tokens (cached, 1h TTL)
  Tool definitions (3-4 dynamic):                 ~800 tokens
  User profile + memory:                          ~1,000 tokens
  Health context (CRS, recent data):              ~1,500 tokens
  Recent conversation (if user-initiated):        ~2,000 tokens
  System instructions (safety, formatting):       ~500 tokens
  Reserved for reasoning + output:                ~4,000 tokens
  ---
  Total: ~11,300 tokens per invocation
```

This maps to Waldo's existing 11-section prompt builder. The research confirms: keep tool outputs compressed (~500 tokens, already in spec), use just-in-time retrieval for detailed health data, and use the rules pre-filter to avoid Claude calls entirely when context isn't needed.

---

## 5. Proactive Agent Patterns

### 5.1 The Ambient Agent Paradigm

Ambient agents are systems that operate continuously in the background, responding to events rather than user prompts. Key characteristics:

- **Continuous** (not episodic): Always running, not activated by user
- **Environmental** (not device-bound): Connected to multiple signal sources
- **Proactive** (not reactive): Acts when data warrants, not when asked
- **Multimodal**: Across sensors, voice, logs, calendars, etc.

**Architecture:**

```
Signal Sources (webhooks, APIs, sensors, cron jobs)
  |
  v
Event Fabric (message queue, event stream)
  |
  v
Signal Assessment (rule-based pre-filter + LLM evaluation)
  |
  v
Priority Scoring (threshold system)
  |
  v
Action Decision:
  - Below threshold: Log and monitor
  - Above threshold, low-risk: Suggest to user
  - Above threshold, high-confidence: Act with notification
  - Emergency: Act immediately, notify after
  |
  v
Delivery (right channel, right time, right tone)
  |
  v
Feedback Loop (track engagement, adjust thresholds)
```

### 5.2 Trigger and Scheduling Intelligence

**Event-driven triggers**: Webhooks from health data sync, calendar changes, or environmental shifts activate immediate evaluation.

**Batch processing**: Schedule-based collection (pg_cron in Waldo's case) prevents API cost explosion while maintaining freshness.

**Threshold systems**: Score-based filtering determines which signals warrant human attention. Surface top 3-5 opportunities rather than overwhelming users.

**Timing intelligence for health agents:**
- Fuse biometrics + motion + location + calendar to understand user's situation
- Silence alerts during meetings while capturing data
- Proactive nudges use haptic signals or notifications at contextually appropriate moments
- Personalized thresholds prevent both over-alerting (fatigue) and under-detection (missed events)

### 5.3 Alert Fatigue Reduction

The single biggest risk for proactive health agents. Mechanisms:

1. **Multi-sensor validation**: Require confluence of signals before alerting (HRV + HR + sleep quality all degraded, not just one metric)
2. **Personal baseline thresholds**: What's alarming for User A might be normal for User B
3. **Contextual suppression**: Don't alert about elevated HR during a workout
4. **Cooldown periods**: Waldo's 2h cooldown between Fetch Alerts
5. **Graduated autonomy**: Start with suggestions, increase automation as trust builds
6. **Channel-appropriate delivery**: Urgent via push notification, informational via Telegram, reflective via Morning Wag

**Waldo already has most of these** in the architecture spec. The research confirms: the rules pre-filter (CRS > 60 and stress confidence < 0.3 = skip Claude) is the correct pattern. The cooldown, quality gates, and 5-zone personality spectrum are all aligned with best practices.

### 5.4 The Sense-Understand-Decide-Act-Learn Cycle

For wearable AI agents specifically:

```
SENSE: Collect physiological + motion + environmental signals
  |
UNDERSTAND: ML interpretation of patterns (CRS computation, stress detection)
  |
DECIDE: Rule-based pre-filter -> LLM evaluation -> action selection
  |
ACT: Deliver insight via appropriate channel at appropriate time
  |
LEARN: Capture engagement feedback -> update preferences -> refine thresholds
```

This maps 1:1 to Waldo's data flow: Wearable -> HealthKit -> CRS -> Pre-filter -> Claude -> Channel Adapter -> Feedback -> Agent learns.

---

## 6. Framework Landscape

### 6.1 Memory Frameworks Comparison (2026)

| Framework | Architecture | Best For | Self-Hosted | Latency |
|---|---|---|---|---|
| **Mem0** | Vector + Graph + KV | Personalized assistants, preference retention | Yes (Apache 2.0) | Low |
| **Zep/Graphiti** | Temporal Knowledge Graph (Neo4j) | Temporal reasoning, entity evolution, compliance | Partial (Community deprecated) | P95: 300ms |
| **Letta** | OS-inspired tiered memory | Long-running agents, unlimited context needs | Yes | Varies |
| **Cognee** | KG from unstructured data | RAG workflows, institutional knowledge | Yes | Moderate |
| **LangChain Memory** | Multiple pluggable types | Teams in LangChain ecosystem | Yes | Varies |
| **LlamaIndex Memory** | Doc + conversation unified | Document-heavy retrieval | Yes | Varies |
| **MemOS** | Memory operating system | Complex multi-agent systems | Yes | Low |
| **AWS AgentCore Memory** | Managed episodic + semantic | Enterprise AWS agents | No (managed) | Low |

### 6.2 Durable Execution Frameworks

| Framework | Model | Best For | Serverless Support |
|---|---|---|---|
| **Restate** | Journal-based replay | Long-running agents with human-in-the-loop | AWS Lambda, Vercel, Cloudflare |
| **Inngest** | Event-driven durable workflows | Multi-step AI workflows | Edge, serverless, traditional |
| **Temporal** | Workflow-as-code | Complex enterprise orchestration | Containers (not serverless-native) |
| **LangGraph** | Graph-based state machine | Agent state management | With external checkpointer |

### 6.3 What's New: MemOS (Memory Operating System)

MemOS treats memory as a first-class system resource with kernel-level abstractions:

- **MemCube**: Standardized memory abstraction enabling tracking, fusion, migration of heterogeneous memory
- **MemOperator**: Retrieves relevant memory for current context
- **MemScheduler**: Determines optimal invocation path for memory operations
- **MemLifecycle**: Updates memory states and manages decay/consolidation
- **MemGovernance**: Access control, retention policies, audit logging, sensitive content handling
- **MemVault**: Manages multiple memory repositories with standardized access

**Performance**: 159% boost in temporal reasoning vs OpenAI. 38.9% overall improvement on LOCOMO. Up to 94% latency reduction. Multi-agent memory sharing. Multi-modal support (text, images, tool traces).

---

## 7. Implications for Waldo

### 7.1 What Waldo's Architecture Already Gets Right

Based on this research, Waldo's current architecture spec aligns with best practices in several areas:

- **Rules-based pre-filter**: Eliminates 60-80% of LLM calls. This is exactly what production agents do.
- **Agent evolution via feedback signals**: The `agent_evolutions` table with 3+ signal threshold, 30-day decay, 2/week cap, auto-revert matches the research.
- **Dynamic tool loading**: 3-4 tools per call, not all 8. Matches Anthropic's context engineering advice.
- **Prompt caching**: 1h TTL for soul files. Standard practice.
- **Cooldown periods**: 2h between Fetch Alerts. Aligns with alert fatigue research.
- **Quality gates**: Medical safety, personality consistency, actionability. Maps to grader patterns.
- **Tool output compression**: ~500 token cap. Matches context engineering best practices.
- **Adapter pattern**: All external integrations through interfaces. Standard for swappable memory backends.

### 7.2 Recommended Enhancements (By Phase)

#### Phase D (Agent Core) -- Implement These

1. **Structured memory blocks instead of free-text memory**: Instead of `update_memory` writing arbitrary text, implement memory as structured blocks (inspired by Letta):
   ```typescript
   interface MemoryBlock {
     label: string;        // "sleep_preferences", "stress_triggers", "communication_style"
     value: string;        // The actual content
     updated_at: string;   // ISO timestamp
     access_count: number; // For decay scoring
     source: string;       // "user_correction", "observed_pattern", "explicit_preference"
   }
   ```
   This makes memory queryable, scorable, and decay-able.

2. **Memory read with relevance scoring**: When loading memory for a prompt, score each block by `semantic_relevance * recency_weight * access_frequency`. Only include top-K blocks in context. This prevents context poisoning from stale or irrelevant memories.

3. **Version tracking on memory writes**: Every `update_memory` call creates a version entry (before/after). Enables rollback if memory is poisoned. Use compare-and-swap to prevent concurrent pg_cron + user message from corrupting state.

4. **Pre-action clarification** (from PAHF): Rare but powerful. Waldo occasionally asks preference-clarifying questions: "I've been including your HRV numbers -- would you prefer I just tell you what to do?" This is NOT every interaction -- only when confidence about a preference is low.

#### Phase E (Proactive Delivery) -- Implement These

5. **Multi-signal validation before alerting**: Require confluence of signals (HRV + HR + sleep + activity) before triggering a Fetch Alert. Single-metric anomalies go to the log, not the user.

6. **Timing intelligence layer**: Before delivering any proactive message, check: Is the user in a meeting? Is it their Do Not Disturb window? Did they just dismiss a similar alert? Calendar + time + recent-dismissal context should gate delivery.

#### Phase G (Self-Test) -- Evaluate These

7. **Sleep-time compute pattern**: Use pg_cron to run a "Patrol Agent" during off-hours (2-4 AM local time) that consolidates daily health observations. This agent has access to all user data but runs with a stronger model (if budget allows) or longer timeout. It refines memory blocks, identifies emerging patterns (Spots -> Constellations), and prepares context for the next Morning Wag.

8. **Temporal knowledge graph for Constellations**: When the Constellation feature becomes real, implement Zep/Graphiti-style bi-temporal tracking. Health facts have validity windows. "User's HRV baseline was X from Jan-Mar, then shifted to Y after they started the new routine." This is the technical substrate for "Waldo spotted something over months."

#### Phase 2+ -- Consider These

9. **Mem0-style intelligent extraction**: Instead of the agent deciding what to remember (agentic memory via tool calls), add a background extraction pipeline that processes every interaction and extracts salient facts, resolves conflicts with existing memory, and consolidates. This removes the burden from the real-time agent loop.

10. **Graph memory layer**: Add a knowledge graph (Neo4j or Supabase pg_graphql) for entity relationships. Entities: User, HealthMetric, Activity, TimeOfDay, Medication, Routine. Edges: "affects", "improves", "worsens", "correlates_with". This enables multi-hop queries like "What activities improve User's HRV after stressful workdays?"

11. **Durable execution** (Restate or Inngest): If Waldo's agent needs multi-step workflows (e.g., "detect stress -> check calendar -> reschedule meeting -> notify user"), durable execution ensures the full sequence completes even if an Edge Function times out mid-step.

### 7.3 What NOT to Do

- **Don't add a knowledge graph for MVP**. Vector-based memory with structured blocks is sufficient. Graph adds operational complexity (Neo4j) that's not justified until Constellations are real.
- **Don't implement full RLHF or model fine-tuning**. Prompt-level evolution via `agent_evolutions` is the right cost/complexity tradeoff.
- **Don't use Mem0 or Zep as a dependency for MVP**. Build the memory layer in Postgres (structured blocks, version tracking, decay scoring). These frameworks are useful as reference architectures, not as dependencies for a product that needs to stay lean.
- **Don't over-engineer context management**. Waldo's 11-section prompt builder with ~11K token budget is appropriate. The research confirms: start simple, add complexity based on observed failures.
- **Don't build a MemOS-style abstraction layer**. This is for multi-agent systems at enterprise scale. Waldo is one agent per user with a well-defined tool set.

### 7.4 Recommended Memory Schema (Phase D)

```sql
-- Replace single memory text field with structured blocks
CREATE TABLE user_memory_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,            -- "sleep_pattern", "stress_trigger", "preference_verbosity"
  category TEXT NOT NULL,         -- "health_pattern", "preference", "context", "relationship"
  value TEXT NOT NULL,            -- The actual memory content
  embedding VECTOR(384),          -- For semantic search (optional, Phase 2)
  access_count INTEGER DEFAULT 0, -- Tracks retrieval frequency
  relevance_score REAL DEFAULT 1.0, -- Decays over time
  source TEXT NOT NULL,           -- "user_correction", "observed_pattern", "explicit_statement"
  version INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,        -- NULL = still valid
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, label)          -- One block per label per user
);

-- Memory version history for rollback
CREATE TABLE user_memory_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES user_memory_blocks(id),
  user_id UUID NOT NULL,
  previous_value TEXT,
  new_value TEXT NOT NULL,
  change_reason TEXT,             -- "user_correction", "consolidation", "evolution"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users only see their own memories
ALTER TABLE user_memory_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_blocks_policy ON user_memory_blocks
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_memory_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_versions_policy ON user_memory_versions
  FOR ALL USING (auth.uid() = user_id);
```

### 7.5 Key Takeaways

1. **Memory is the moat**. The longer Waldo runs for a user, the better it gets. This is not about having better algorithms -- it's about having better memory architecture that accumulates, consolidates, and retrieves the right context at the right time.

2. **Temporal awareness is Waldo's secret weapon**. Health data is inherently temporal. "Your HRV was 45 last night" is less useful than "Your HRV has been declining for 3 days since you stopped your evening walks." Bi-temporal tracking (when something happened + when we learned about it) enables this.

3. **The sleep-time compute pattern is Waldo's Patrol**. Background processing during idle time to consolidate, clean, and prepare -- this is what makes the Morning Wag smart. Don't do all memory work in the real-time agent loop.

4. **Start vector, graduate to graph**. Structured memory blocks in Postgres for MVP. Add vector embeddings when semantic search is needed. Add knowledge graph when Constellations require relationship reasoning.

5. **Both pre-action and post-action feedback are needed**. Asking the user occasionally (pre-action) + observing their behavior always (post-action) = optimal personalization. Neither alone is sufficient.

6. **Context engineering > prompt engineering**. What tokens enter the context window matters more than how you phrase the instructions. Waldo's 11-section prompt builder with dynamic tool loading is the right approach.

---

## Sources

### Memory Architecture
- [Agent Memory: How to Build Agents that Learn and Remember | Letta](https://www.letta.com/blog/agent-memory)
- [Stateful AI Agents: A Deep Dive into Letta (MemGPT) Memory Models | Medium](https://medium.com/@piyush.jhamb4u/stateful-ai-agents-a-deep-dive-into-letta-memgpt-memory-models-a2ffc01a7ea1)
- [Mem0 vs Letta (MemGPT): AI Agent Memory Compared (2026)](https://vectorize.io/articles/mem0-vs-letta)
- [Top 6 AI Agent Memory Frameworks for Devs (2026) | DEV Community](https://dev.to/nebulagg/top-6-ai-agent-memory-frameworks-for-devs-2026-1fef)
- [MemGPT: Towards LLMs as Operating Systems | arXiv](https://arxiv.org/abs/2310.08560)
- [Intro to Letta | Letta Docs](https://docs.letta.com/concepts/memgpt/)
- [Mem0 - The Memory Layer for your AI Apps](https://mem0.ai/)
- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory | arXiv](https://arxiv.org/abs/2504.19413)
- [Graph Memory for AI Agents (January 2026) | Mem0](https://mem0.ai/blog/graph-memory-solutions-ai-agents)
- [AI Agent Memory: Types, Implementation, Challenges & Best Practices 2026](https://47billion.com/blog/ai-agent-memory-types-implementation-best-practices/)

### Episodic/Semantic/Procedural Memory
- [Beyond Short-term Memory: The 3 Types of Long-term Memory AI Agents Need | MachineLearningMastery](https://machinelearningmastery.com/beyond-short-term-memory-the-3-types-of-long-term-memory-ai-agents-need/)
- [Memory Types in Agentic AI: A Breakdown | Medium](https://medium.com/@gokcerbelgusen/memory-types-in-agentic-ai-a-breakdown-523c980921ec)
- [Making Sense of Memory in AI Agents | Leonie Monigatti](https://www.leoniemonigatti.com/blog/memory-in-ai-agents.html)
- [ICLR 2026 Workshop: MemAgents | OpenReview](https://openreview.net/pdf?id=U51WxL382H)
- [Exploring Agent Procedural Memory | arXiv](https://arxiv.org/html/2508.06433v2)

### Temporal Knowledge Graphs
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory | arXiv](https://arxiv.org/abs/2501.13956)
- [Graphiti: Knowledge Graph Memory for an Agentic World | Neo4j](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- [Mem0 vs Zep (Graphiti): AI Agent Memory Compared (2026)](https://vectorize.io/articles/mem0-vs-zep)
- [MAGMA: A Multi-Graph based Agentic Memory Architecture | arXiv](https://arxiv.org/pdf/2601.03236)
- [Vector Databases vs. Graph RAG for Agent Memory | MachineLearningMastery](https://machinelearningmastery.com/vector-databases-vs-graph-rag-for-agent-memory-when-to-use-which/)

### Memory Decay and Consolidation
- [Building smarter AI agents: AgentCore long-term memory deep dive | AWS](https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/)
- [How to Build AI Agents with Redis Memory Management](https://redis.io/blog/build-smarter-ai-agents-manage-short-term-and-long-term-memory-with-redis/)
- [How to Build Memory Consolidation | OneUptime](https://oneuptime.com/blog/post/2026-01-30-memory-consolidation/view)
- [Mastering Memory Consistency in AI Agents: 2025 Insights | Sparkco](https://sparkco.ai/blog/mastering-memory-consistency-in-ai-agents-2025-insights)

### State Management
- [Stateful vs Stateless AI Agents: Architecture Guide | Tacnode](https://tacnode.io/post/stateful-vs-stateless-ai-agents-practical-architecture-guide-for-developers)
- [Effectively building AI agents on AWS Serverless | AWS](https://aws.amazon.com/blogs/compute/effectively-building-ai-agents-on-aws-serverless/)
- [AI Agents should be serverless and durable | Restate](https://www.restate.dev/blog/resilient-serverless-agents)
- [Building Durable AI Agents with Restate + Vercel AI SDK | Restate](https://www.restate.dev/blog/building-durable-agents-with-vercel-and-restate)
- [Durable Execution: The Key to Harnessing AI Agents | Inngest](https://www.inngest.com/blog/durable-execution-key-to-harnessing-ai-agents)
- [Mastering LangGraph State Management in 2025 | Sparkco](https://sparkco.ai/blog/mastering-langgraph-state-management-in-2025)
- [LangGraph Persistence | Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/persistence)

### Self-Evolution
- [Self-Evolving Agents: A Cookbook for Autonomous Agent Retraining | OpenAI](https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining)
- [A Comprehensive Survey of Self-Evolving AI Agents | arXiv](https://arxiv.org/abs/2508.07407)
- [Learning Personalized Agents from Human Feedback (PAHF) | Meta Research](https://ai.meta.com/research/publications/learning-personalized-agents-from-human-feedback/)
- [Self-Evolving Agents: Open-Source Projects Redefining AI in 2026 | Medium](https://evoailabs.medium.com/self-evolving-agents-open-source-projects-redefining-ai-in-2026-be2c60513e97)
- [EvoAgentX: Building a Self-Evolving Ecosystem | GitHub](https://github.com/EvoAgentX/EvoAgentX)

### Context Engineering
- [Effective context engineering for AI agents | Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Engineering - LLM Memory and Retrieval for AI Agents | Weaviate](https://weaviate.io/blog/context-engineering)
- [State of Context Engineering in 2026 | SwirlAI Newsletter](https://www.newsletter.swirlai.com/p/state-of-context-engineering-in-2026)
- [The LLM context problem in 2026 | LogRocket](https://blog.logrocket.com/llm-context-problem-strategies-2026)
- [Agent Context Windows in 2026 | Sparkco](https://sparkco.ai/blog/agent-context-windows-in-2026-how-to-stop-your-ai-from-forgetting-everything)
- [The Context Window Problem: Scaling Agents Beyond Token Limits | Factory.ai](https://factory.ai/news/context-window-problem)

### Claude Code Memory
- [How Claude remembers your project | Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Compaction | Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/compaction)
- [Session memory compaction | Claude API Cookbook](https://platform.claude.com/cookbook/misc-session-memory-compaction)

### Proactive Agents and Ambient Intelligence
- [Proactive AI Agent Guide 2025](https://www.emilingemarkarlsson.com/blog/proactive-ai-agents-guide-2025/)
- [Ambient Agents: The Next Frontier in Context-Aware AI | DigitalOcean](https://www.digitalocean.com/community/tutorials/ambient-agents-context-aware-ai)
- [What Is an Ambient Agent? | Moveworks](https://www.moveworks.com/us/en/resources/blog/what-is-an-ambient-agent)
- [AI Agents in Wearables: 8 Use Cases for Health & Work (2026) | Digiqt](https://digiqt.com/blog/ai-agents-in-wearables/)
- [Ambient Agents and the Future of Always-On Intelligence | Medium](https://medium.com/@fahey_james/ambient-agents-and-the-future-of-always-on-intelligence-85c21137d070)
- [From Reactive to Proactive: How to Build AI Agents That Take Initiative | Medium](https://medium.com/@manuedavakandam/from-reactive-to-proactive-how-to-build-ai-agents-that-take-initiative-10afd7a8e85d)

### Sleep-Time Compute
- [Sleep-time Compute | Letta](https://www.letta.com/blog/sleep-time-compute)
- [Sleep-time agents | Letta Docs](https://docs.letta.com/guides/agents/architectures/sleeptime)

### MemOS
- [MemOS: A Memory OS for AI System | arXiv](https://arxiv.org/abs/2507.03724)
- [MemoryOS | GitHub (EMNLP 2025 Oral)](https://github.com/BAI-LAB/MemoryOS)
- [MemOS by MemTensor | GitHub](https://github.com/MemTensor/MemOS)

### AWS AgentCore
- [Amazon Bedrock AgentCore | AWS](https://aws.amazon.com/bedrock/agentcore/)
- [Building smarter AI agents: AgentCore long-term memory deep dive | AWS](https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/)

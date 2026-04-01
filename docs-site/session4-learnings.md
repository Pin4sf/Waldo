# Session 4 Learnings — Quick Reference

> Everything we learned from reverse-engineering Claude Code (1,905 TypeScript files) + 2026 agent landscape research + startup competitive analysis. March 31, 2026.

---

## Finalized Decisions (Building These)

| Decision | What | Phase | Why |
|----------|------|-------|-----|
| **Cloudflare Durable Objects** | Per-user persistent agent brain with SQLite, scheduling, WebSocket | D | Solves stateless amnesia. $0.01/user/month. Per-user Morning Wag times. |
| **5-tier memory** | Working → Semantic → Episodic → Procedural → Archival | D-Phase 2 | Maps to cognitive science. Tiers 0-2 in Phase D, 3 in G, 4 in Phase 2. |
| **Buddy system (Waldo Moods)** | Dalmatian visual state tied to CRS zone + health streaks + achievements | F-G | Waldo is a buddy, not an assistant. Retention through character attachment. |
| **Three-stage compaction** | Micro (free) → session memory → full LLM (Patrol only) | D | Saves 20-30% tokens per invocation. Stage 1 costs nothing. |
| **Concurrent tool execution** | Read-only tools parallel, writes serial | D | 50-70% faster tool execution (300ms vs 900ms). |
| **Semantic caching** | Cache response structures for repetitive triggers | D | 30-40% output token reduction. Morning Wags are structurally identical. |
| **Patrol Agent (sleep-time compute)** | Nightly DO alarm: consolidate memory, pre-stage Morning Wag | G | <3 second Morning Wag delivery. Memory quality compounds overnight. |
| **Speculative pre-computation** | Compute Morning Wag context before user wakes | E | Feels like magic. Waldo is already ready when you open your eyes. |
| **Morning Wag = daily plan** | Not just "your CRS is 72" — structured plan with time blocks | D | Stolen from Nori. "Deep work 9-11am. Walk at 1:45. Dip at 2pm." |
| **Weekly review** | "Here's what changed this week and why" | D | Users love retrospectives. Builds trust. |
| **Code Mode + Dynamic Workers** | Claude generates 1 TypeScript function instead of 4 tool calls | E | 81% token reduction. $500 → $95/month at 10K users. |
| **Waldo as MCP server** | Expose getCRS, getStressLevel, getCognitiveWindow to other agents | Phase 2 | 97M MCP installs. Biological intelligence as a service. Strategic moat. |
| **Agent trace protocol** | 15+ field structured trace on every invocation | D | Observability from day 1. Debug anything. |
| **Structured error taxonomy** | Classify transient/capacity/permanent before fallback | D | Better retry decisions. Don't waste retries on permanent failures. |
| **Feature flags** | Lightweight Supabase table for A/B testing | G | Test soul file variants. Gradual rollout. Emergency kill switches. |
| **Evaluation harness (Promptfoo)** | Golden test suite run after every soul file change | D | Quality is #1 barrier to agent deployment (32% of orgs cite this). |
| **"Clinical drift" language** | "Your recovery has been drifting down for 12 days" | D | Stolen from Prana (YC). More powerful than "pattern detected." |
| **A2A protocol** | Agent-to-agent communication for Pack tier | Phase 3 | Team's Waldos coordinate via Google's A2A standard. |

---

## Interesting Features from Claude Code (Future Inspiration)

These are cool things we found in Claude Code's source that aren't immediately needed but are worth knowing about for Phase 3+.

| Claude Code Feature | What It Does | Waldo Adaptation | Phase |
|---|---|---|---|
| **BUDDY (Tamagotchi)** | 18 species, 5 rarities, deterministic from identity, ASCII art, stats (DEBUGGING/PATIENCE/CHAOS/WISDOM/SNARK 0-100), 1% shiny rate | **Waldo Moods** — our health-adapted version with CRS-tied visual states, health streaks, achievement variants | F-G |
| **KAIROS (always-on daemon)** | Background agent with append-only daily logs, 15s blocking budget, webhook subscriptions, exclusive tools (SendUserFile, PushNotification) | **Patrol Agent** is our version — DO alarm, nightly consolidation, pre-staging. Could add webhook subscriptions for calendar events in Phase 2 | D-E |
| **ULTRAPLAN (remote expensive thinking)** | Offloads 30-minute planning sessions to remote Opus instances. Browser-based approval UI. Result "teleported" back. | **Anthropic Batch API** for Constellation analysis. Overnight, 50% discount, deep multi-week pattern reasoning. No real-time pressure. | G-Phase 2 |
| **Speculation (pre-execution)** | Predicts what you'll do next and starts executing BEFORE you confirm. Copy-on-write overlay filesystem. Accept/reject. Recursive pipelining. | **Speculative pre-computation** — Patrol → pre-CRS → pre-Morning Wag → pre-generate. Chained pre-computation so everything is ready when you wake. | E |
| **Voice mode** | Push-to-talk, wake word detection ("Claude", "Submit"), continuous listening loop, streaming STT | "Hey Waldo, how'd I sleep?" Ambient voice interface. Natural for health queries while making coffee. | Phase 3 |
| **Topic detection** | Every user message classified: "Is this a new topic? Extract 2-3 word title." Used to organize history and reset context. | Detect conversation shifts, swap memory context. Sleep question → load sleep data instead of activity data. Smarter context assembly. | D |
| **Three-stage dispatch** | Quota check (Haiku) → Topic detection (Haiku) → Main reasoning (Sonnet). Most requests never reach the expensive model. | Our rules pre-filter is Stage 1. Could add topic detection as Stage 2 before Claude reasoning for smarter routing. | Phase 2 |
| **Fault injection framework** | Dev tool that intentionally breaks things. `BridgeFault` with method/kind/status/count. FIFO fault queue. | **"Chaos mode"** for Phase G testing: simulate API down, Telegram timeout, stale health data, empty sleep, Samsung HRV gap. Systematic resilience testing. | G |
| **Coordinator mode** | Parent agent decomposes tasks → delegates to worker agents → monitors → aggregates. Workers communicate via XML task notifications. Shared scratchpad. | **Specialist sub-agents** — sleep agent, productivity agent, research agent. Waldo core as coordinator. Shared prompt cache prefix for efficiency. | Phase 3 |
| **AutoDream (memory consolidation)** | Background 4-phase process: Orient → Gather Signal → Consolidate → Prune Index. Dual-gate trigger (24h + 5 sessions). Lock file prevents concurrent runs. | **Patrol Agent** consolidation is directly adapted from this. 4 phases, dual-gate, nightly schedule. The process that makes Waldo get smarter over time. | G |
| **Deferred tool loading (ToolSearch)** | With 50+ tools, only sends capability summaries. Model calls ToolSearch to load full schemas on demand. Saves thousands of tokens. | When we scale to 50+ tools (Phase 2), adopt this pattern. Send capability manifest + discovery tool. Agent finds what it needs. | Phase 2 |
| **Content replacement for large outputs** | Tool results exceeding max size stored to disk with preview + pointer. Model can request full detail in next iteration. | Our `[DETAIL_AVAILABLE: call get_sleep(detail=true)]` retrieval markers. Same pattern, health-adapted. | D |
| **Prompt cache boundary** | Static system prompt above `DYNAMIC_BOUNDARY` marker gets cached. Dynamic content below it. Cache invalidation is surgical. | Our system/user message split already does this. Soul files in system message (cached 1h). Health data in user message (fresh). | Already done |
| **Feature flags (GrowthBook)** | 37 flags with randomized codenames. A/B testing, gradual rollout, kill switches. Runtime gating without redeployment. | 6-8 lightweight flags in Supabase table. A/B test soul variants, toggle features per user segment, emergency kill switches. | G |
| **Undercover mode** | For Anthropic employees on public repos: "Do not blow your cover." Strip AI attribution. Write commits as human. | Not applicable to Waldo, but interesting that even Anthropic thinks about AI identity framing. Waldo is proudly a buddy. |  |
| **Computer Use module** | Screenshots + model calls + GUI actions. Swift binaries for macOS screen recording. Concurrency lock for exclusive GUI control. | Not applicable. But shows the level of native module work Anthropic does — same kind of Swift/Kotlin work we're doing for HealthKit/Health Connect. | |
| **Keychain prefetch** | Auth tokens in macOS Keychain (~40ms to read). Async background prefetch at startup so token is ready before needed. | Pre-fetch Supabase auth + Anthropic API key at DO wake, before agent loop starts. 40ms matters in a 30s window. | D |
| **BoundedUUIDSet (dedup)** | Ring buffer of last N message UUIDs. Prevents duplicate processing on WebSocket reconnection. | Cleaner in-memory dedup for Telegram webhook retries in DO (supplement our idempotency_key approach). | D |
| **SerialBatchEventUploader** | Batches events, retries with exponential backoff, enforces maxQueueSize for backpressure. | Batch agent_logs writes to Supabase instead of one-by-one. Lower latency, fewer connections. | D |
| **StreamAccumulator** | Coalesces text_delta events so mid-stream reconnections get full snapshots, not partial. | If streaming agent responses to Telegram and connection drops mid-stream, resume cleanly without re-generating. | E |

---

## Final Round: Harness Philosophy + 5 Phase D Additions

From VentureBeat deep dive, Reddit/HN community analysis (489 Reddit comments, 366 HN comments), Anthropic's official harness engineering blog, and Alex Kim's technical analysis.

### The Core Philosophy (Validated Across All Sources)

> **"The agent is never the surrounding code. The agent is always the model."**
> — Repeated across VentureBeat, Reddit, shareAI, Anthropic's engineering blog

80% of Claude Code is harness (tools, permissions, context, error recovery). 20% is model interaction. The harness gets THINNER as the model gets smarter. Don't build elaborate orchestration — build excellent plumbing.

### 5 Small Additions for Phase D

| # | Addition | What | Cost | Source |
|---|---------|------|------|--------|
| 1 | **Frustration regex** | Detect user frustration via regex BEFORE sending to Claude. Shift personality toward empathetic. Log as negative signal for Tier 3. Never mention detecting it. | Zero (regex) | Claude Code `userPromptKeywords.ts` |
| 2 | **Memory verification** | Before asserting a remembered pattern ("HRV drops on Mondays"), verify against last 2 weeks of fresh data. Don't trust stale memory. | 1 Supabase query | Claude Code "self-healing memory" |
| 3 | **Session state record** | DO SQLite record: `last_morning_wag`, `last_consolidation`, `pending_followups`, `active_patterns`, `streak_days`. Rapid context restoration. | ~50 tokens | Anthropic's `claude-progress.txt` |
| 4 | **Clean state exit** | Every invocation ends: memory persisted, trace logged, session_state updated, no orphaned state. Add to post-reasoning hook. | Zero | Anthropic harness guidance |
| 5 | **"One thing" rule** | Soul file reinforces: "Address the single most important thing. ONE actionable insight." | Zero | Anthropic's failure mode: "agent tried to do too much" |

### Additional Technical Notes

| Finding | Detail | Waldo Action |
|---------|--------|-------------|
| **Token-efficient tool schemas** | Anthropic beta header `token-efficient-tools-2026-03-28` reduces tool definition tokens | Use in Phase D tool definitions |
| **Prompt-shape surgery** | Claude can stop generating when prompt resembles turn boundary after tool results. Fix: force safe boundary markers. | Watch for in agent loop testing |
| **`DANGEROUS_` prefix convention** | Name cache-breaking prompt sections with obvious danger prefix | Adopt in prompt builder |
| **Stale-is-acceptable caching** | `getFeatureValue_CACHED_MAY_BE_STALE()` — don't block main loop for freshness on non-critical reads | Use for feature flag loading in DO |
| **250K wasted API calls/day** | Fixed by 3 lines: `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3`. Compaction retried infinitely. | Our max-3-iteration limit prevents this |
| **Build ahead, release incrementally** | Anthropic has 6+ months of features behind flags. "They release every 2 weeks because everything is already done." | Aspire to: build Phase D-G, gate them, release incrementally |
| **Prompt-as-orchestration** | Multi-agent coordinator uses natural language instructions to manage workers, not code state machines | For Phase 3 specialist sub-agents: coordinate via prompts |

### Stack Validation (Confirmed Correct)

| What Claude Code Uses | What Waldo Uses | Match? |
|---|---|---|
| TypeScript + `@anthropic-ai/sdk` + tool_use | TypeScript + `@anthropic-ai/sdk` + tool_use | Identical |
| Custom tools with Zod + permissions | Custom tools with Zod + permissions | Identical |
| Lifecycle hooks (shell scripts) | 10-hook pipeline (pre/post reasoning) | Same pattern, ours richer |
| Memory index + on-demand retrieval | 5-tier with index + on-demand | Same pattern, ours richer |
| Bun (persistent local process) | Cloudflare DO (persistent cloud per-user) | Different runtime, same concept. Ours scales to millions. |
| Filesystem (MEMORY.md) | DO SQLite + Supabase Postgres | Ours is better for multi-user + health privacy |

**The stack is right. The differences are justified by "cloud multi-user health agent" vs "local single-user CLI tool."**

---

## Competitive Intelligence (Key Numbers)

| Metric | Value | Source |
|--------|-------|--------|
| Agent market size (2025) | $7.84 billion | Industry reports |
| Agent market projected (2030) | $52.62 billion (CAGR 46.3%) | Gartner |
| Enterprise apps with agents by end 2026 | 40% (up from <5% in 2025) | Gartner |
| MCP installs | 97 million (Mar 2026) | AAIF |
| ChatGPT Health weekly health queries | 230 million | OpenAI |
| Orgs with agents in production | 57% | LangChain 2026 |
| Quality as #1 barrier to agent deployment | 32% of orgs cite this | LangChain 2026 |
| Semantic caching cost reduction | 47-73% | Production deployments |
| Code Mode token reduction | 81% | Cloudflare measurements |
| Combined optimization savings | 70-90% | Multiple sources |
| Waldo cost with all optimizations | $0.01-0.03/user/day | Session 4 analysis |
| Nori status | **Shipped** (App Store) | YC |
| Prana status | **Building** (YC W26) | YC |
| ONVY wearable integrations | 320+ | ONVY |
| Open Wearables GitHub stars | 1,000+ | GitHub |

---

## The Audit Result

**Are things coming together?** YES. Strong convergence — every pattern validated by production systems.

**Are we overengineering?** On documentation, partially. On architecture, no. Every decision is grounded.

**What kills us?** Not complexity. **Speed.** Nori is live. Prana is building. ChatGPT Health has 230M users. Ship Phase D.

> See [Architecture at a Glance](architecture-glance.md) for updated diagrams. See [18 Upgrades](upgrade-report.md) for full implementation roadmap. See [Startup Landscape](startup-landscape.md) for competitive details.

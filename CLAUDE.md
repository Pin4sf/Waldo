# Waldo — Claude Code Instructions

## What This Project Is

Waldo is the biological intelligence layer for the agentic economy — a personal AI agent (dalmatian mascot) that reads body signals from wearables and proactively acts before the user notices they're stressed, depleted, or about to burn out. Not a health tracker. Not a productivity tool. The intelligence substrate every agent in your life should be running on.

**Brand:** Waldo (dalmatian). Tagline: "Already on it."
**Status:** Pre-code. Planning finalized. Rebranding complete. Ready to build.

## Brand Naming (Use These Everywhere)

| Internal/Technical | Waldo Brand Name | What It Is |
|---|---|---|
| Morning brief | **Morning Wag** | Daily biological briefing |
| Stress alert | **Fetch Alert** / **Fetch** | Proactive intervention |
| CRS (keep for technical) | **Nap Score** (consumer-facing) | Daily readiness number |
| Health pattern detected | **Spot** | Single data pattern ("Waldo spotted something") |
| Background analysis | **The Patrol** | 24/7 continuous analysis ("The Patrol never sleeps") |
| Long-term pattern map | **The Constellation** | Months of Spots connected — premium insight layer |
| Stress detection engine | **The Sniff** | "Dogs smell what you can't see" |
| Free tier | **Pup** | Morning Wag + basic Spots |
| Pro tier | **Pro** | Full Patrol, Fetches, interventions |
| Team/Family tier | **Pack** | Multiple Waldos, shared Constellations |
| Buddy mood system | **Waldo Moods** | Dalmatian visual state tied to CRS zone (tail wagging → curled up) |

**Banned words:** wellness, mindfulness, optimize, hustle, AI-powered, health tracker, health app, unlock your potential, empower

## Source-of-Truth Documents

Read these BEFORE doing anything:

1. **`Docs/WALDO_MASTER_REFERENCE.md`** — THE build reference. Schema, tools, algorithms, phases A-H, cost model. **Build from this.** (Being renamed to Waldo internally; file names stay for now.)
2. **`Docs/WALDO_NORTHSTAR.md`** — Vision and "why."
3. **`Docs/WALDO_ONEPAGER.md`** — Pitch, ICP, competitive landscape, business model.
4. **`Docs/WALDO_RESEARCH_AND_ALGORITHMS.md`** — CRS algorithm science, validation plan.
5. **`Docs/WALDO_AGENT_INTELLIGENCE.md`** — **The Agent OS.** 25-field prompt builder, 10-hook pipeline, 5-zone personality spectrum, 5-tier memory with decay, buddy system (Waldo Moods), multi-phase Hand playbooks, 4-phase nudge system, 5 quality gates, adapter pattern, skills system, goal ancestry, loop guard, provider failover. **Use alongside Master Reference when building Phase D-E.**
6. **`Docs/MVP_SCOPE.md`** — Definitive MVP scope. IN/OUT of scope, success criteria, constraints.
7. **`Docs/MVP_ENGINEERING_PRD.md`** — Engineering PRD with detailed technical specs.
8. **`Docs/WALDO_ADAPTER_ECOSYSTEM.md`** — **All 10 adapters, 32 metrics, 23 capabilities, cross-source correlation math.** The full integration spec.
9. **`Docs/WALDO_DESIGNER_BRIEF.md`** — Designer-friendly overview of backend capabilities, screens, brand, competitive position. **Share this with your designer.**

10. **`Docs/WALDO_SCALING_INFRASTRUCTURE.md`** — Cloudflare Durable Objects architecture, Dynamic Workers, Code Mode, multi-user cost model, migration path.
11. **`Docs/WALDO_AGENT_UPGRADE_REPORT.md`** — Session 4: 18 upgrades from Claude Code reverse engineering + 2026 landscape, 5-tier memory architecture, competitive implications.
12. **`Docs/WALDO_EMAIL_INFRASTRUCTURE.md`** — **Loops as the email platform.** Transactional + event sequences + campaigns. Stripe lifecycle integration. **Loops MCP via Composio for Phase D+ agent email delivery.** Waldo agent enriches Loops contacts with biological data for personalised emails. Full event catalogue, segment strategy, implementation checklist.
13. **`Docs/WALDO_ROLLOUT_STRATEGY.md`** — Phase 0-4 distribution strategy. Email sequence content plan. UGC strategy. Channel strategy. The "Waldo did a thing" moment.

**These override everything in `Docs/archive/`.**

## Tech Stack

React Native + Expo SDK 53+ | Kotlin (Android) | Swift (iOS) | op-sqlite + SQLCipher | NativeWind v4 | Supabase (Postgres + Edge Functions + Auth + RLS) | Cloudflare Workers + Durable Objects (Phase D+ agent runtime) | Claude Haiku 4.5 via @anthropic-ai/sdk | grammY (first channel adapter, Deno) | pg_cron (Phase B-C) → DO alarms (Phase D+)

## Commands

- `npx expo start` — Dev server
- `npx expo run:android` / `npx expo run:ios` — Build and run
- `supabase functions serve` — Local Edge Functions
- `supabase db push` — Apply migrations

## Rules & Agents

Detailed rules, review agents, and orchestration live in `.claude/` — loaded automatically:

### Rules
- **`.claude/rules/architecture.md`** — 10 locked architecture decisions, data flow, cost constraints
- **`.claude/rules/coding-standards.md`** — TypeScript, React Native, native modules, Edge Functions, git conventions
- **`.claude/rules/health-data-security.md`** — Encryption, RLS, logging, secrets, privacy (NON-NEGOTIABLE)
- **`.claude/rules/phase-orchestration.md`** — Which agents to run per phase, Dev-QA loop, handoff templates

### Agents (Planning)
- **`planner`** (opus) — Phase planning, risk identification, task breakdown
- **`workflow-mapper`** (sonnet) — Maps ALL data flow paths + failure modes BEFORE building

### Agents (Review)
- **`health-data-reviewer`** (sonnet) — Null handling, personal baselines, Samsung HRV gap, edge cases
- **`native-module-reviewer`** (sonnet) — Kotlin/Swift correctness, Expo Modules API, platform quirks
- **`security-reviewer`** (sonnet) — Encryption, RLS, secrets, prompt injection, privacy compliance
- **`crs-validator`** (sonnet) — CRS algorithm validation against spec formulas
- **`soul-file-reviewer`** (sonnet) — Waldo's personality, conversation quality, prompt safety, medical claims

### Agents (Testing)
- **`qa-breaker`** (sonnet) — Adversarial QA, defaults to NEEDS WORK, tries to break every feature
- **`e2e-pipeline-tester`** (sonnet) — Full wearable → CRS → Claude → Channel Adapter pipeline validation

### Skills (invoke with `/skill-name`)
- **`/phase-handoff`** — Generate phase handoff document from template
- **`/break-feature`** — Run workflow-mapper → qa-breaker sequence on a feature
- **`/review-all`** — Run security + health-data + native-module reviewers in parallel
- **`/new-adapter`** — Scaffold a new adapter implementation (ChannelAdapter, LLMProvider, etc.)

### Hooks (automatic)
- **PreToolUse**: Blocks `--no-verify` on git commits
- **PostToolUse**: Auto-formats JS/TS with Prettier, runs TypeScript typecheck after edits
- **Stop**: Warns about `console.log` in modified files
- **Notification**: macOS alert when Claude needs input

## Build Phases

Data connectors FIRST, agent SECOND. iOS FIRST, Android SECOND. See Master Reference Section 2.3.

A0 (Data Parser + CRS Validation) ✅ → B1 (HealthKit/iOS) → B2 (Health Connect/Android) → C (Dashboard) → D (Agent Core + Cloudflare DO migration) → E (Proactive Delivery + Code Mode) → F (Onboarding + WebSocket + Waldo Moods) → G (Self-test + Evolution in DO) → H (Beta)

**Phase D is the critical gate.** Agent runtime migrates from Supabase Edge Functions to Cloudflare Durable Objects. Each user gets a persistent DO with SQLite (memory, patterns, preferences). Health data stays in Supabase. See `Docs/WALDO_SCALING_INFRASTRUCTURE.md`.

**Current phase: A0 complete.** 7,818 lines built. CRS validated on 856 days of real data. Ready for Phase B.

## Development Philosophy

**Build → Break → Fix → Repeat. Nothing is sacred.**

1. Build end-to-end
2. Break it — null HRV, watch disconnect, 0 sleep data, 3 Fetch alerts in 10 min, OEM battery kills
3. Fix root cause, not symptoms
4. Update docs immediately if a fix changes the spec

## Waldo's Voice (for soul files)

**Product voice (user-facing):** Warm, specific, actionable. Not clinical, not coaching. "Already on it."
- Good: "Bit of a rough night — your sleep was short by about 40 minutes. I've nudged your 9am to 10:30. Nothing drastic."
- Bad: "CRS 47. Your HRV ran 12% below your 30-day baseline overnight." (too clinical)

**Investor/enterprise voice:** Data-driven, CRS, SAFTE-FAST, adapter architecture. Waldo as brand wrapper.

## Important Notes

- Edge Functions (Phase B-C): 150s idle timeout, 50s hard computation limit, max 3 agent iterations. Phase D+: Cloudflare DO (30s per request, chainable, hibernates when idle)
- Health data: SQLCipher locally, RLS on Supabase, never log health values
- Never diagnose medical conditions. Always "not a medical device" disclaimers.
- Supabase free tier pauses after 7 days — set up keep-alive
- Samsung does NOT write HRV to Health Connect — HR BPM proxy for Samsung users
- CRS grounded in SAFTE-FAST (US Army validated). Consumer name: Nap Score.
- Adapter pattern: All external integrations (messaging, AI model, health data, storage) go through adapter interfaces. Never hardcode provider-specific calls in agent logic.
- Waldo is a plug-and-play platform — works with any wearable, any sensor, any hardware. This is the moat.

## Security & Reliability (From AtlanClaw + Ecosystem Research, March 2026)

Defense-in-depth, adapted for serverless. Details in `.claude/rules/architecture.md` and `.claude/rules/health-data-security.md`.

**P0 (Build into Phase D):**
- Template-wrap ALL external input before feeding to Claude (prompt injection defense)
- Per-trigger tool permissions (Morning Wag gets fewer tools than user chat)
- Zod-validate every tool argument before execution
- Project-scoped Anthropic API key with spend alerts
- `safeFetch()` wrapper with URL allowlist in Edge Functions

**P1 (Build into Phase D-E):**
- Circuit breaker + 4-level fallback chain in LLMProvider adapter
- Idempotent message delivery in ChannelAdapter
- Agent action audit trail (trace_id, tool calls, tokens, latency, outcome)
- Cost circuit breaker (daily per-user cap)
- Memory write validation (reject injection patterns in update_memory)

**P2 (Phase G: core evolution | Phase 2: ecosystem expansion):**
- Agent self-evolution: `agent_evolutions` table with feedback-driven behavioral parameter tuning (from JiuwenClaw)
- Rule-based signal detection on feedback (👍/👎/dismissal/correction) — no LLM needed
- Evolution safety: min 3 signals, max 2 changes/week, 30-day decay, auto-revert
- Tool output compression: cap at ~500 tokens, leave retrieval markers for lazy loading
- Identity stays immutable (soul files, safety rules, CRS algorithm NEVER auto-modified)
- **Waldo as MCP server** — expose biological intelligence (getCRS, getStressLevel, getCognitiveWindow) to external agents via Model Context Protocol
- **A2A protocol** support for cross-agent orchestration (Pack tier, agent-to-agent delegation)
- **Code Mode + Dynamic Workers** — 81% token reduction for predictable workflows (Morning Wag, Fetch Alert)

**P3 (Phase 3: Autonomous OS — evaluate when needed):**
- Langfuse for LLM observability (self-hosted, open-source — or stick with agent_logs)
- Portkey AI Gateway for multi-provider failover
- A/B testing infrastructure for soul file variants (feature flags in Phase G)
- **Waldo Moods** — buddy system with dalmatian visual states tied to CRS, health streaks, achievements
- **Voice interface** — ambient health queries ("Hey Waldo, how'd I sleep?")
- **Specialist sub-agents** via coordinator pattern (sleep agent, productivity agent, research agent)
- **ULTRAPLAN-style background analysis** — offload expensive Constellation reasoning to Anthropic Batch API overnight

## Session 4 Research (March 31, 2026)

Deep research session: reverse-engineered Claude Code's 1,905-file TypeScript codebase + comprehensive 2026 agent landscape + startup competitive analysis. Key outputs:

- **`Docs/WALDO_AGENT_UPGRADE_REPORT.md`** — 18 upgrades from Claude Code patterns + landscape. 5-tier memory architecture on DOs. Implementation roadmap.
- **`Docs/WALDO_STARTUP_COMPETITIVE_LANDSCAPE.md`** — Nori (YC, closest threat, shipped), Prana (YC W26), Galen AI, ChatGPT Health (230M users), Open Wearables (OSS MCP server).
- **`Docs/research/AGENT_MEMORY_AND_STATE_RESEARCH_2026.md`** — Letta/MemGPT, Zep temporal graphs, sleep-time compute, Meta PAHF paper. 90+ sources.
- **`Docs/COMPETITIVE_RESEARCH_AGENT_SECURITY_RELIABILITY_COST.md`** — OWASP Top 10 for agents, LlamaFirewall, circuit breakers, Promptfoo, Langfuse.
- **`Docs/handoffs/COMPETITIVE_RESEARCH_2026.md`** — Full 2026 landscape, 14 frameworks, MCP (97M installs), A2A, protocols.

**Key decisions from research:**
- Cloudflare Durable Objects locked as Phase D+ agent runtime (health data stays in Supabase)
- 5-tier memory: Working (context) → Semantic (DO SQLite `memory_blocks`) → Episodic (DO SQLite `episodes`) → Procedural (Phase G `procedures`) → Archival (R2 after 90d)
- Waldo as MCP server = strategic moat (biological intelligence as a service, Phase 2)
- Cost: $0.01-0.03/user/day with all optimizations (semantic caching, Code Mode, pre-filter, prompt caching)

**Memory architecture (AtlanClaw-validated pattern — April 2026):**
- Soul files (`agent/SOUL_*.md`, `agent/IDENTITY.md`) = READ-ONLY (ConfigMap equivalent). Never writable at runtime. Changes require git PR. This is a security boundary — not a convenience.
- `memory_blocks` = MEMORY.md equivalent (persistent compact summary, always in context)
- `episodes` = memory/YYYY-MM-DD.md equivalent (raw daily event log, accumulates per day)
- **Daily compaction is a Phase D requirement, not Phase G.** Nightly at 2 AM local: episodes → diary entry in memory_blocks → promotes validated patterns. Without it, memory_blocks drifts stale between weekly compaction cycles. See `docs-site/agent-intelligence.md` Section 5 for implementation.
- Memory poisoning gap: DO's `provision` handler needs a startup diff against known-good memory state before Phase H (beta).

**Competitive urgency:** Nori (YC, 2 exits) is live on App Store. Prana (YC W26) is building. ChatGPT Health has 230M weekly health users. **Ship Phase D.**

## Session 9 Research: Hermes Agent + Full Vision + Connector Ecosystem (April 8-9, 2026)

**Hermes Agent reverse-engineering (15th agent system) + MemPalace (16th):**
Nous Research's open-source agent (38K+ stars, MIT). Key adoptions for Waldo:
- **Dreaming Mode** — comprehensive nightly intelligence cycle (consolidate → promote → pre-compute → evolve → deep mine → self-improve). Full spec in `docs-site/agent-intelligence.md` Section 5. Phase D starts with consolidation; Phase G adds evolution; Phase 3+ adds GEPA self-improvement.
- **Memory context fencing** — `<memory-context>` tags prevent model from treating recalled memory as user instructions. Ship in Phase D.
- **FTS5 cross-session search** — SQLite FTS5 on episodes table for keyword-based recall. Cheaper than pgvector for exact queries.
- **Structured context compression** — Goal/Progress/Decisions/Next Steps template for compacting long sessions.
- **Skills as agentskills.io standard** — markdown skill files with effectiveness tracking. Enables Phase 4 marketplace.
- **GEPA evolutionary self-improvement** (ICLR 2026 Oral) — reads execution traces, proposes targeted mutations, evaluates against golden tests. $2-10 per run. Applied to behavioral params only (identity stays immutable).
- **Approval buttons on messaging** — native inline buttons for L2 autonomy on Telegram/Slack.
- **Voice memo transcription** — faster-whisper for Telegram voice input.
- **MemPalace** (28.5K stars, MIT) — spatial memory via Method of Loci. 96.6% recall on LongMemEval at 170-token wake-up cost. Adoptions: typed memory halls (facts/events/discoveries/preferences/advice) for memory_blocks, 170-token wake-up budget, cross-domain tunnels for Constellation analysis, temporal fact invalidation with valid_from/valid_to/superseded_by.
- Upgrade report expanded to 30 items. See `docs-site/upgrade-report.md`.

**Full Vision Brainstorm:**
- `Docs/WALDO_FULL_VISION_BRAINSTORM.md` — 9 parts + research appendix. 7 life domains, 15 demographics, 67 micro-automations, communication framework, competitive moat, new capability ideas.
- Key finding: "The ceiling isn't health. The ceiling is LIFE." + emotional JTBD > functional JTBD + social permission job is Waldo's hidden superpower.
- Universal tagline: "Waldo knows how you're really doing."

**Connector Ecosystem:**
- `Docs/WALDO_CONNECTOR_ECOSYSTEM.md` — 213+ tools across 27 categories. 196 with APIs, 47 with MCP servers.
- A2A protocol is LIVE (v1.0, March 2026, 150+ orgs). Waldo can publish an Agent Card.
- Open Wearables SDK has React Native support (v0.4, March 2026, MIT).
- Zapier MCP server = 8,000+ apps through one integration.
- APIAgent (Agoda, OSS) converts any REST API → MCP server with zero code.

## Product Vision — Non-Negotiable Frames (April 2026)

**"Already on it"** — Every user-facing Waldo surface must echo this phrase. Not "Waldo noticed X." Already on it. Relentless consistency across every message, onboarding step, loading state, fallback. This is our positioning frame. LittleBird owns "already knows your work" consistently — we own "already on it" the same way.

**"Derived insights, not raw data"** — Privacy positioning: "Waldo doesn't store your HRV readings or sleep staging data. It stores what they mean for you, today." Our DO architecture already does this. Make it explicit everywhere — stronger than any competitor's privacy claim because it's active intelligence, not format preference.

**New trigger types to build (from LittleBird competitive research, April 2026):**
- **Pre-Activity Spot (Phase E):** Calendar-aware Waldo message 30 min before high-stakes meetings. "Board call in 35 min. Running lower than usual today." Uses CalendarProvider + CRS + sleep debt.
- **User-Configurable Routines (Phase G+):** Users write natural language prompts on cadences. Waldo runs them against biological data. "Every Sunday, tell me my recovery outlook for next week."
- **Contextual follow-up threading:** Every proactive message (Morning Wag, Fetch Alert) should embed reply buttons — "Tell me more" / "What should I do?" — not just 👍/👎.

**LittleBird is a complement, not a competitor.** They know your work. We know your body. Together = an agent that knows when your body can handle your work. Future integration partner candidate. Full competitive analysis: `docs-site/competitive-landscape.md`.

## Learnings
- Always update your learning, and whenever we try to solve or resolve anything, be a proactive learner. Keep a log of this in the memories, and keep a hard won lessons file also.

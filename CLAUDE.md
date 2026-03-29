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

**Banned words:** wellness, mindfulness, optimize, hustle, AI-powered, health tracker, health app, unlock your potential, empower

## Source-of-Truth Documents

Read these BEFORE doing anything:

1. **`Docs/WALDO_MASTER_REFERENCE.md`** — THE build reference. Schema, tools, algorithms, phases A-H, cost model. **Build from this.** (Being renamed to Waldo internally; file names stay for now.)
2. **`Docs/WALDO_NORTHSTAR.md`** — Vision and "why."
3. **`Docs/WALDO_ONEPAGER.md`** — Pitch, ICP, competitive landscape, business model.
4. **`Docs/WALDO_RESEARCH_AND_ALGORITHMS.md`** — CRS algorithm science, validation plan.
5. **`Docs/WALDO_AGENT_INTELLIGENCE.md`** — **The Agent OS.** 25-field prompt builder, 10-hook pipeline, 5-zone personality spectrum, 3-tier memory with decay, multi-phase Hand playbooks, 4-phase nudge system, 5 quality gates, adapter pattern, skills system, goal ancestry, loop guard, provider failover. **Use alongside Master Reference when building Phase D-E.**
6. **`Docs/MVP_SCOPE.md`** — Definitive MVP scope. IN/OUT of scope, success criteria, constraints.
7. **`Docs/MVP_ENGINEERING_PRD.md`** — Engineering PRD with detailed technical specs.
8. **`Docs/WALDO_ADAPTER_ECOSYSTEM.md`** — **All 10 adapters, 32 metrics, 23 capabilities, cross-source correlation math.** The full integration spec.
9. **`Docs/WALDO_DESIGNER_BRIEF.md`** — Designer-friendly overview of backend capabilities, screens, brand, competitive position. **Share this with your designer.**

**These seven override everything in `Docs/archive/`.**

## Tech Stack

React Native + Expo SDK 53+ | Kotlin (Android) | Swift (iOS) | op-sqlite + SQLCipher | NativeWind v4 | Supabase (Postgres + Edge Functions + Auth + RLS) | Claude Haiku 4.5 via @anthropic-ai/sdk | grammY (first channel adapter, Deno) | pg_cron + pgmq

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

A0 (Data Parser + CRS Validation on real Apple Health exports) → A (pre-code + WoO) → B1 (HealthKit/iOS) → B2 (Health Connect/Android) → C (Dashboard) → D (Agent + Messaging) → E (Proactive Delivery) → F (Onboarding) → G (Self-test) → H (Beta)

**Current phase: A0** — Building `tools/health-parser/` to parse Ark's Apple Health export, validate CRS algorithm on real data, and simulate agent behavior.

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

- Edge Functions: 150s idle timeout, 50s hard timeout, max 3 agent iterations
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

**P2 (Phase G → Phase 2, self-evolution):**
- Agent self-evolution: `agent_evolutions` table with feedback-driven behavioral parameter tuning (from JiuwenClaw)
- Rule-based signal detection on feedback (👍/👎/dismissal/correction) — no LLM needed
- Evolution safety: min 3 signals, max 2 changes/week, 30-day decay, auto-revert
- Tool output compression: cap at ~500 tokens, leave retrieval markers for lazy loading
- Identity stays immutable (soul files, safety rules, CRS algorithm NEVER auto-modified)

**P3 (Phase 2+, evaluate when needed):**
- Langfuse for LLM observability (or stick with agent_logs if sufficient)
- Trigger.dev for durable background jobs (or stick with pg_cron if reliable)
- Portkey AI Gateway for multi-provider failover
- A/B testing infrastructure for soul file variants
- GitOps deployment (GitHub Actions + Supabase CLI)

## Learnings
- Always update your learning, and whenever we try to solve or resolve anything, be a proactive learner. Keep a log of this in the memories, and keep a hard won lessons file also.

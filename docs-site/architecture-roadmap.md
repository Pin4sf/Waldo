# Waldo Architecture Roadmap — Current State vs Envisioned Final

> **Last updated:** April 13, 2026 (Session 11)
> **Purpose:** Map what's built today against the final Waldo vision across all phases. Reference for every architectural decision.

---

## Executive Summary

**Where we are:** Phase D (Agent Core) complete. Phase E (Proactive Delivery) at ~70%. Backend is production-ready for beta testing.

**Where we're going:** Autonomous personal operating system — health as the wedge, life context as the moat, agent intelligence as the platform.

**Gap:** Phases F-H (Onboarding polish, Self-evolution, Beta) + execution layer (Sandbox/Code Mode) for cost-optimized scale.

---

## The Three Pillars of Final Waldo

From `Docs/WALDO_FULL_VISION_BRAINSTORM.md`:

| Pillar | What It Is | Current Status |
|---|---|---|
| **1. Body Intelligence** | Biological readiness via CRS, stress detection, recovery | ✅ **85% built** — CRS engine, stress detector, baselines all live |
| **2. Task Intelligence** | Adapts HOW (not WHETHER) based on energy + schedule | ⚠️ **40% built** — task_metrics sync works, agent has get_tasks tool, but not reshaping work |
| **3. Autonomous Personal OS** | Cross-agent orchestration, user routines, full life context | ❌ **5% built** — MCP server scaffold, proposal approval pipeline only |

---

## Current Architecture (Built)

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                    │
│  ├── Web Console (waldo-sigma.vercel.app) — 12,645 lines React │
│  ├── Landing (heywaldo.in) — Vercel                             │
│  └── Mobile App (React Native + Expo SDK 53) — Android shipped  │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────────┐
│  EDGE COMPUTE LAYER                                              │
│  ├── Supabase Edge Functions (34 functions, 10,427 lines Deno)  │
│  │   • OAuth flows × 6 providers                                │
│  │   • Sync functions × 10 adapters                             │
│  │   • check-triggers (15-min pg_cron)                          │
│  │   • health-import, build-intelligence, bootstrap              │
│  │   • invoke-agent (L1 fallback)                               │
│  │   • execute-proposal, mcp-server, telegram-bot               │
│  └── Cloudflare Worker + Durable Objects (2,789 lines TS)       │
│      • WaldoAgent DO per user                                    │
│      • 5-tier SQLite memory                                      │
│      • R2 workspace (profile, baselines, patterns, etc.)         │
│      • 15-tool ReAct loop with cross-domain narrative             │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  DATA LAYER                                                      │
│  ├── Supabase Postgres (22 tables, 20 migrations, RLS)          │
│  │   • Health: snapshots, crs_scores, stress_events             │
│  │   • Cross-domain: calendar, email, tasks, mood, screen_time  │
│  │   • Intelligence: spots, patterns, master_metrics             │
│  │   • Memory: core_memory, conversation_history                 │
│  │   • Auth: users, oauth_tokens, sync_log                      │
│  └── Cloudflare R2 (waldo-workspace bucket)                     │
│      • Per-user markdown files (agent brain storage)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase-by-Phase Status

### ✅ Phase A0: Data Parser + CRS Validation (100%)

**Built:**
- Streaming XML parser (289MB in 2.2s)
- 12 extractors (heart rate, HRV, sleep stages, steps, etc.)
- CRS engine — spec-accurate 3-pillar formula (Recovery, CASS, ILAS)
- Pillar drag analysis (attributes score to primary drag)
- Stress detector (219 events across 149 days validated)
- Day Strain, Sleep Debt, Spots engine (1,498 observations)
- Weather + AQ enrichment

### ✅ Phase B: Data Connectors (95%)

**Built (12 adapters):**
| Adapter | Status |
|---|---|
| Apple Health (XML) | ✅ |
| Google Calendar | ✅ |
| Gmail | ✅ |
| Google Tasks | ✅ |
| Google Fit (Android) | ✅ |
| YouTube Music | ✅ |
| Spotify | ✅ |
| Strava | ✅ |
| Todoist | ✅ |
| Notion | ✅ |
| Linear | ✅ |
| RescueTime | ✅ |

**Missing:**
- HealthKit live sync on iOS (native module planned Phase B1 — currently XML-only)
- Mobile app → Supabase auto-sync (Android Health Connect module exists, sync loop pending)

### ✅ Phase C: Dashboard v2 (100%)

**Built (20 components):**
- 3-column layout (Dashboard.tsx)
- FormCard (radial gauge + pillar breakdown + energy curve)
- SleepCard (Figma-accurate hypnogram)
- LoadCard (bullet graph + HR zone bars)
- MorningWag, TheBrief, TheHandoff, ThePatrol, TheClose
- Phase2Cards, WaldoCalendar, DailyScheduleCard
- ConstellationView (force-directed graph)
- RangeView (7d/30d/3m aggregations)
- Sidebar, FetchCard, SignalDepthCard, Tier2Cards

### ✅ Phase D: Agent Core (100%)

**Built:**
- Cloudflare DO per user (SQLite + R2)
- 15 tools: get_crs, get_health, get_trends, get_schedule, get_communication, get_mood, get_tasks, get_spots, get_patterns, read_memory, update_memory, search_episodes, read_workspace, propose_action, render_chart (planned)
- Soul prompt + zone modifiers + mode templates
- Cross-domain narrative builder (all 6 dimensions pre-loaded)
- Pre-filter (skip Claude when CRS > 60 && stress < 0.3)
- Memory context fencing (prompt injection defense)
- Per-trigger tool permissions
- Bootstrap pipeline (30d Google history + Claude analysis → R2)
- Daily compaction (episodes → diary)
- 5-tier memory architecture

### ⚠️ Phase E: Proactive Delivery (70%)

**Built:**
- Morning Wag at wake time ✅
- Fetch Alert on stress ✅
- Evening Review ✅
- Patrol loop (15-min DO alarm) ✅
- Telegram delivery ✅
- propose_action + execute-proposal (L2 autonomy) ✅
- Master metrics: cognitive load, burnout trajectory, sleep debt ✅

**Missing:**
- **Code Mode** (deterministic TS functions in Dynamic Workers) → **Cloudflare Sandbox enables this**
- **Pre-Activity Spot** ("Board call in 35min, running low")
- **WhatsApp delivery** (scaffold only, not wired)
- **Chart rendering tool** (`render_chart`) — needs Sandbox for matplotlib
- **Idempotent delivery** (currently best-effort)

### ⚠️ Phase F: Onboarding + Polish (40%)

**Built:**
- Login by name/email/UUID ✅
- Apple Health XML upload with persistence ✅
- Google OAuth with immediate first-sync ✅
- Bootstrap auto-trigger on upload ✅
- Dashboard layout ✅
- Mascot SVGs in 8 moods (Waldo Moods) ✅

**Missing:**
- **Guided onboarding wizard** — no step-by-step UI yet
- **Onboarding interview** (5 questions built in DO, no web UI)
- **WebSocket real-time** — dashboard uses polling
- **Permission pre-education** for HealthKit/Health Connect
- **Empty states** for each card when data is missing

### ❌ Phase G: Self-Test + Evolution (5%)

**Built:**
- `agent_evolutions` table scaffold
- `procedures` SQLite table in DO

**Missing:**
- **Feedback signal detection** (👍/👎, dismissal, correction rules)
- **Behavioral parameter tuning** (verbosity, timing, topic weight)
- **Evolution safety controls** (min 3 signals, max 2/week, auto-revert)
- **A/B test soul file variants**
- **GEPA evolutionary optimization** ($2-10/run, Phase 3+) → **needs Sandbox**

### ❌ Phase H: Beta (0%)

Pending Phase F completion + real user testing protocol.

### ❌ Phase 2: Autonomous OS (5%)

**Built:**
- MCP server Edge Function (expose biological intelligence as MCP tools) ✅
- Proposal → approval → execute pipeline ✅

**Missing:**
- **Waldo as MCP server** for external agents (strategic moat)
- **A2A protocol** (agent-to-agent for Pack tier)
- **Calendar writes** (currently read-only)
- **Email draft generation** (needs additional scopes)
- **Task creation/deferral automation**
- **Voice interface** ("Hey Waldo")
- **Specialist sub-agents** (sleep agent, productivity agent)

---

## The Execution Layer Gap — Where Cloudflare Sandbox Fits

We currently have 2 compute tiers. The final architecture needs 3:

| Tier | Role | Status |
|---|---|---|
| **Edge Functions** (Deno) | OAuth, webhooks, scheduled batch jobs | ✅ Built |
| **Workers/DO** (V8 isolate) | Agent reasoning, tool calls, SQLite memory | ✅ Built |
| **Sandbox** (container) | Python analytics, chart rendering, user routines, GEPA | ❌ **Not yet adopted** |

**Adding Sandbox enables:**
1. Code Mode → 60-75% per-user LLM cost reduction
2. Real chart generation in chat (pandas + matplotlib)
3. Advanced health file parsing (Garmin `.fit`, Oura, Whoop)
4. User-configurable routines (Phase G)
5. GEPA evolutionary optimization (Phase 3+)

**When to adopt:** When per-user LLM cost crosses $0.50/month at scale, OR when users request visualizations, OR when we ship personalization (whichever comes first).

See: [scaling-infrastructure.md § Cloudflare Sandbox](./scaling-infrastructure.md#cloudflare-sandbox--execution-layer-phase-e)

---

## 32 Metrics — Computation vs Agent Awareness

From `Docs/WALDO_ADAPTER_ECOSYSTEM.md`. **Updated Session 11 — 24/32 now agent-aware.**

| Dimension | Metrics Planned | Computed | Agent Uses | New in S11 |
|---|---|---|---|---|
| **Body** (health) | 10 | 7 | 7 ✅ | — |
| **Schedule** (calendar) | 5 | 4 | **4** ✅ | focus_time_score, schedule_density |
| **Communication** (email) | 5 | 3 | **3** ✅ | CSI, response_pressure |
| **Tasks** | 5 | 4 | **4** ✅ | procrastination_index, task_energy_match |
| **Mood/Screen** | 4 | 4 | **4** ✅ | mood_score, screen_quality, focus_sessions |
| **Combined Masters** | 3 | 2 (cognitive load, burnout) | **2** ✅ | get_master_metrics tool (new) |
| **TOTAL** | **32** | **24** | **24** ✅ | +9 from Session 11 |

**Remaining gap — not yet computed (8 metrics):**
- Circadian Score (needs bedtime consistency algorithm)
- Resilience (14-day stability index)
- Recovery-Load Balance (as dedicated computed field)
- Meeting Cognitive Cost (needs meeting transcript analysis)
- Thread Depth (needs email thread parsing)
- Waldo Intelligence Score (meta-metric from all 32)

**New tools added Session 11:** `get_screen_time`, `get_master_metrics`, `get_correlations`

---

## 23 Agent Capabilities — Status

From `Docs/WALDO_ADAPTER_ECOSYSTEM.md` (23 capabilities across 4 categories):

**Proactive (11):**
- ✅ Morning Wag, Fetch Alert, Evening Review
- ✅ Spot generation (88 active)
- ✅ Pattern detection (5 promoted)
- ⚠️ Pre-Activity Spot (not built)
- ⚠️ Weekly constellation summary (manual trigger only)
- ❌ Meeting transcription correlation
- ❌ Circadian window recommendations
- ❌ Recovery-time suggestions
- ❌ Boundary violation alerts (computed, not surfaced)

**Task Intelligence (8):**
- ✅ Urgency queue (via get_tasks)
- ⚠️ Task-energy matching (data exists, not applied)
- ❌ Automatic deferral suggestions
- ❌ Time-block optimization
- ❌ Deadline reshaping
- ❌ Task → calendar linking
- ❌ Dependency tracking
- ❌ Velocity forecasting

**Automation (5):**
- ✅ Calendar move proposals (via propose_action)
- ⚠️ Task creation proposals (tool exists, not tested)
- ❌ Email draft generation
- ❌ Focus block auto-creation
- ❌ Meeting decline/reschedule

**Learning (6):**
- ✅ Memory updates (update_memory tool)
- ✅ Workspace file evolution (nightly)
- ⚠️ Pattern promotion (works, no user confirmation loop)
- ❌ Behavioral parameter tuning (Phase G)
- ❌ A/B soul file variants
- ❌ GEPA optimization (Phase 3+)

**Total: 9 of 23 capabilities fully functional. 6 partial. 8 not started.**

---

## Final Waldo — Distance from Vision

```
FINAL WALDO VISION (from Full Vision Brainstorm):

User wakes → Waldo already moved 9am meeting that conflicted with sleep debt
User opens phone → Morning Wag: body + day plan + music mood + task priority
User goes to work → Waldo schedules focus blocks around circadian peak
User has meeting → Post-meeting recovery time auto-suggested based on HRV delta
User feels off → Fetch Alert with specific intervention from learned patterns
User ends day → Evening Review + tomorrow pre-computed
User sleeps → Dreaming Mode (consolidate, evolve, self-improve)

Underneath:
- Waldo as MCP server → other agents query biological state
- A2A protocol → family/team Waldos coordinate
- Voice interface → ambient queries
- Specialist sub-agents → sleep coach, productivity coach, research coach
- GEPA → Waldo literally gets smarter per-user every week
```

**What's working:** Morning Wag, Fetch Alert, Evening Review, cross-domain narrative, proposal approval, 15 tools, R2 workspace, bootstrap pipeline.

**What's missing:** Automation tier (calendar writes, email drafts), voice, specialist agents, A2A, self-evolution, Code Mode cost optimization, comprehensive onboarding.

**Ballpark:** **~60% of MVP vision shipped. ~25% of final autonomous OS vision shipped.**

---

## Priority Roadmap (Updated April 2026 — Post Agents Week)

### 🔴 Immediate (this sprint — days, not weeks)

| # | Item | Effort | Unlock |
|---|---|---|---|
| 1 | **AI Gateway routing** | 2 lines in llm.ts | Observability + semantic caching + fallback. Zero risk. |
| 2 | **Guided onboarding wizard** | 2-3 days | Critical for first-user experience. Beta blocker. |
| 3 | **Fiber checkpoint stopgap** | 1 day | Fix silent Morning Wag failures on DO eviction. |

### 🟡 Phase E — Cost & Reliability (1-2 weeks)

| # | Item | Effort | Unlock |
|---|---|---|---|
| 4 | **Dynamic Workers / Code Mode** | 3-4 days | 81% token reduction. Morning Wag math off the LLM. **Open Beta — ship it.** |
| 5 | **Mobile app Supabase sync** | 3-5 days | Health Connect background sync loop. Live data. |
| 6 | **WhatsApp active delivery** | 1 day | Double delivery surface. |
| 7 | **Pre-Activity Spot** | 2 days | Calendar-aware proactive ("Board call in 35min, running low"). |

### 🟢 Phase F — Onboarding & Sessions (2-4 weeks)

| # | Item | Effort | Unlock |
|---|---|---|---|
| 8 | **Sessions tree migration** | 3 days | Add parent_id to conversation_history. Branch isolation. |
| 9 | **WebSocket real-time dashboard** | 3-4 days | Live updates without polling. |
| 10 | **Circadian Score + Resilience** | 2 days | Remaining body metrics. |
| 11 | **Chart generation tool** (`render_chart` via Sandbox) | 3 days | Agent draws real charts. |
| 12 | **Behavioral self-evolution** | 2 weeks | Phase G — feedback → parameter tuning. |

### ⚪ Phase 2 — Platform (1-3 months)

| # | Item | Effort | Unlock |
|---|---|---|---|
| 13 | **MCP server on CF infrastructure** | 1 week | Use Cloudflare's open-source MCP framework. Platform moat. |
| 14 | **Sub-agent Facets** (when Think GA) | 2-3 weeks | SleepAgent + ProductivityAgent + WaldoBrain coordinator. |
| 15 | **Think base class migration** | 1 week | When Think hits GA. Adopts fibers, sessions tree natively. |
| 16 | **Calendar + email writes** | 1 week | Execute actions, not just propose. |
| 17 | **Voice interface** | 2 days | faster-whisper STT. "Hey Waldo..." |

### 🔮 Phase 3 — Autonomous OS

| # | Item | When |
|---|---|---|
| 18 | **x402 MCP monetization** | After MCP server ships |
| 19 | **GEPA self-improvement** | After Sandbox Python analytics |
| 20 | **A2A protocol (Pack tier)** | After MCP server |
| 21 | **Specialist sub-agents** | After Think GA |

---

## Cost Trajectory

| Milestone | Per-User/Month | 10K Users | What Changes |
|---|---|---|---|
| **Current** | $0.32–0.56 | $3,200–5,600 | — |
| **+ AI Gateway** (this sprint) | $0.22–0.40 | $2,200–4,000 | Semantic caching 30-40% |
| **+ Code Mode** (Phase E) | $0.08–0.15 | $800–1,500 | 81% token reduction |
| **+ Sandbox Python analytics** | $0.06–0.12 | $600–1,200 | Charts + file parsing off LLM |
| **+ Anthropic Batch API** | $0.04–0.08 | $400–800 | 50% discount overnight |
| **Phase 3 full autonomous** | $0.50–1.00 | $5,000–10,000 | Voice + specialists + GEPA |

---

## The Three Moats

From `Docs/WALDO_STARTUP_COMPETITIVE_LANDSCAPE.md`:

1. **Data moat** — 12 adapters, 24/32 metrics agent-aware, cross-domain correlations ✅ **Built**
2. **Intelligence moat** — R2 workspace + bootstrap + patterns + self-evolution ⚠️ **Partial**
3. **Platform moat** — Waldo as MCP server + A2A + x402 monetization ❌ **Phase 2**

**The platform moat is the 10x one.** Cloudflare is building general agent infrastructure (Project Think). We own domain-specific health + life intelligence. These compose. Adopt Think for the plumbing. Keep the soul, the CRS engine, and the data flywheel as permanent differentiation.

---

> **See also:**
> - [Scaling Infrastructure](./scaling-infrastructure.md) — DO + R2 + Sandbox architecture
> - [Agent Intelligence](./agent-intelligence.md) — ReAct loop, memory, hooks
> - [**Cloudflare Agents Week Analysis**](./cloudflare-agents-week-analysis.md) — Project Think + Dynamic Workers + AI Gateway adoption plan (April 2026)
> - [Upgrade Report](./upgrade-report.md) — 18 upgrades from agent landscape research
> - [Master Reference](./master-reference.md) — Complete MVP PRD

# Waldo as the True Second Brain — Architecture Vision

> **Research basis:** Meta HyperAgents (facebookresearch/Hyperagents), Karpathy LLM Wiki (gist 442a6bf), GStack agent skills (garrytan/gstack), GBrain knowledge system (garrytan/gbrain), DuckDB analytical layer, Cloudflare Vectorize
> **Date:** April 2026

---

## The Second Brain Problem

Tiago Forte's "Building a Second Brain" (2022) spawned a movement of people using Obsidian, Notion, Roam to capture thoughts and knowledge externally. But every second brain built so far has three fundamental failures:

1. **Passive** — only stores what you explicitly put in. Requires constant manual effort.
2. **Incomplete** — knows your thoughts, not your body. Zero signals from your biology.
3. **Static** — accumulates documents, not intelligence. Can't tell you *when* to think.

**Waldo is the True Second Brain:**

| Traditional Second Brain | Waldo |
|---|---|
| You must remember to capture | Waldo captures automatically |
| Stores text and notes | Stores body signals + life context + behavioral patterns |
| Knows what you thought | Knows if you CAN think right now |
| Passive retrieval | Proactive intelligence ("Already on it") |
| Searches your notes | Learns from your patterns and evolves |
| Forgets when you stop writing | Learns every night while you sleep |

The exact analogy:
- **First brain**: neurons, synapses, biological memory. Remembers your experiences but can't see its own patterns.
- **Traditional second brain**: digital notes. Captures what you DECIDE to write.
- **Waldo**: The brain that knows your body AND your world AND your history AND what comes next. Self-improving. Always on.

This is the narrative. Not a health tracker. Not a productivity tool. **The intelligence substrate that makes every other system smarter by knowing what the human operating them is actually capable of.**

---

## Part 1: The LLM Wiki Architecture (Karpathy Pattern)

### Core Principle

Instead of RAG (rediscovering knowledge from scratch every query), Waldo maintains a **persistent, self-updating wiki** — an LLM-maintained knowledge base that grows smarter over time without user effort.

From Karpathy: *"The LLM reads raw sources, extracts key information, and integrates it into the existing wiki — updating entity pages, revising topic summaries. Humans handle the sourcing and analysis; LLMs handle everything else: cross-referencing, consistency, and maintenance overhead."*

### Three-Layer Architecture for Waldo

```
LAYER 1: RAW SOURCES (immutable — Supabase)
  health_snapshots    ← Apple Watch, Health Connect
  crs_scores          ← CRS engine output
  calendar_metrics    ← Google Calendar
  email_metrics       ← Gmail (metadata only)
  task_metrics        ← Todoist, Linear, Tasks
  mood_metrics        ← Spotify, YouTube Music
  stress_events       ← stress detector output
  conversation_history ← every Waldo interaction
                ↓ INGEST operation (LLM + build-intelligence)
LAYER 2: THE WIKI (LLM-maintained — R2 workspace)
  profile.md          ← identity, baselines, top insights
  baselines.md        ← rolling averages + trend directions
  patterns.md         ← cross-domain correlations discovered
  constellation.md    ← relationship map across dimensions
  today.md            ← pre-computed daily context
  diary/YYYY-MM-DD.md ← daily diary (from episode compaction)
  capabilities.md     ← what Waldo can do for this user
  soul/voice.md       ← learned communication preferences
                ↓ QUERY operation (semantic retrieval)
LAYER 3: SCHEMA (rules — soul files, read-only)
  agent/soul/         ← SOUL_BASE, zone modifiers, mode templates
  agent/identity/     ← IDENTITY.md (immutable)
  agent/rules/        ← safety rules, medical disclaimers
```

### Three Operations

**INGEST** (runs after every new data batch):
```
new health data OR new calendar/email → build-intelligence EF
  → computeBaselines() → update baselines.md
  → generateSpots() → update patterns.md
  → On nightly cycle: update diary/{date}.md
  → Update constellation.md with new cross-domain connections
```

**QUERY** (on every agent invocation):
```
Morning Wag fires →
  1. loadWorkspaceContext() → profile.md + baselines.md + today.md + capabilities.md
  2. FTS5 search → search_episodes("current state context")
  3. Vectorize semantic search → find similar past moments
  4. Synthesize into narrative + file valuable explorations back
```

**LINT** (nightly compaction — Dreaming Mode):
```
2 AM local time → runDailyCompaction()
  → Check for contradictions in memory_blocks
  → Identify stale baselines (7d+ without data)
  → Promote recurring spots → patterns
  → Pre-compute tomorrow's today.md
  → Update log.md (chronological action trail)
```

### Index and Log Files

Following Karpathy's pattern, two special wiki files enable navigation:

**`index.md`** — Content-oriented catalog:
```markdown
# Waldo Wiki — Index
Updated: 2026-04-10

## Health Baselines
- [Profile](./profile.md) — identity, chronotype, devices
- [Baselines](./baselines.md) — HRV 54ms, sleep 4.8h, RHR 68bpm

## Patterns (5 active)
- [Patterns](./patterns.md) — cross-domain correlations
- [Constellation](./constellation.md) — relationship map

## Daily Diary
- [2026-04-10](./diary/2026-04-10.md)
- [2026-04-09](./diary/2026-04-09.md)
```

**`log.md`** — Append-only action trail (parseable timestamps):
```markdown
[2026-04-10T02:00:00Z] COMPACTION: 8 episodes → diary entry. Promoted 1 pattern.
[2026-04-10T07:15:00Z] MORNING_WAG: CRS 44 (low). Fetch Alert suppressed (below 0.6).
[2026-04-10T09:47:00Z] FETCH_ALERT: HRV 18ms (58% below baseline). Box breathing sent.
[2026-04-10T22:30:00Z] EVENING_REVIEW: 4 meetings, 3 tasks completed.
```

---

## Part 2: Enhanced Memory Model (GBrain Pattern)

### The Problem with Our Current memory_blocks

Today: flat key-value pairs.
```
hrv_baseline_7d → "54.34"
sleep_avg_7d → "3.40"
baselines_established → "true"
```

This is primitive. No history, no context, no rollback, no cross-linking.

### Compiled Truth + Timeline (The Right Model)

From gbrain: every memory page has two sections:
- **Compiled truth** (above `---`): current best understanding, rewriteable as new evidence emerges
- **Timeline** (below `---`): append-only evidence trail, never edited, infinite history

**Memory page example for Waldo:**
```markdown
---
type: hall_discoveries
title: Monday Crash Pattern
tags: [sleep, circadian, work-pattern]
confidence: 0.87
evidence_count: 14
---

HRV drops 22-30% on Monday mornings vs weekly average. Form averages 41 on Mondays 
vs 59 rest of week. Primary driver: shorter sleep Sunday nights (avg -1.3h below baseline).
Likely cause: weekend rhythm shift + Sunday email activity (43% after-hours).
[Last updated: 2026-04-08, confirmed by 14 Monday observations]

---

- 2026-02-01: First Monday crash detected. HRV 31ms vs 54ms baseline.
- 2026-02-08: Repeat. HRV 29ms. Email Monday 9am: 12 messages.
- 2026-02-22: Form 37. Worst Monday yet. Ark went to bed at 1am Sunday.
- 2026-03-01: Pattern stabilizing. Sunday sleep avg 5.1h vs weekday 6.8h.
...
[14 timeline entries]
```

### The 6 Memory Halls

Extending our existing `hall_type` column to follow gbrain's taxonomy:

| Hall | What It Stores | Example | Loaded When |
|---|---|---|---|
| `hall_facts` | Stable truths: devices, chronotype, baselines, timezone | "Resting HR: 62bpm. Apple Watch Series 9. IST timezone. Early riser (6:45am avg)." | Every invocation (tiny, ~50 tokens) |
| `hall_events` | Timestamped diary entries, daily summaries | "2026-04-10: CRS 44. 4 meetings. HRV alert 9:47am." | Morning Wag, Evening Review |
| `hall_discoveries` | Cross-domain correlations, patterns, Constellation insights | Monday crash pattern, sleep→CRS correlation | Conversational, complex queries |
| `hall_preferences` | Learned communication style, timing, verbosity | "Prefers 2-line messages. Gets morning wag at 7:15am exactly." | Every invocation (evolves via Phase G) |
| `hall_advice` | Intervention effectiveness history | "Box breathing works 72%. Short walk 45%. Calendar blocks: never tried." | Fetch Alert, Evening Review |
| `hall_insights` | What Waldo has concluded about this person | "The main lever for this user is Sunday sleep. Protect it → protect the whole week." | Morning Wag synthesis, big-picture questions |

### Compiled Truth Update Protocol

When new evidence contradicts existing compiled truth:

```typescript
// On nightly compaction, for each memory page:
async function updateCompiledTruth(page: MemoryPage, newEvidence: Episode[]): Promise<void> {
  // 1. Snapshot current compiled truth (page_versions entry)
  await snapshotPage(page);
  
  // 2. Check if evidence contradicts current truth
  const contradiction = detectContradiction(page.compiled_truth, newEvidence);
  if (!contradiction) return;
  
  // 3. LLM rewrites compiled truth (small call, ~200 tokens)
  const newTruth = await callLLM([
    { role: 'user', content: `Update this compiled truth based on new evidence:\n
    CURRENT: ${page.compiled_truth}\n
    NEW EVIDENCE: ${newEvidence.map(e => e.content).join('\n')}\n
    Write the new compiled truth (1-3 sentences):` }
  ], { maxTokens: 150, triggerType: 'compaction' });
  
  // 4. Append to timeline, never delete
  await appendTimeline(page.id, `[${today}] Compiled truth updated based on ${newEvidence.length} new observations.`);
  
  // 5. Write new compiled truth
  await writeCompiledTruth(page.id, newTruth);
}
```

### Iron Law: Back-Links

From gbrain: every entity mention must create a bidirectional link. For Waldo:

Every Spot that mentions a pattern → link to the pattern's memory page.
Every diary entry that references a discovery → link back.

This creates the Constellation graph automatically — it's not built from scratch, it emerges from back-links.

### Page Versions (Rollback Safety)

```sql
-- Already in our migration 20260412000002_waldo_actions.sql
-- Need to add page_versions:
CREATE TABLE memory_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_key TEXT NOT NULL,         -- same as memory_blocks.key
  compiled_truth_snapshot TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

When memory is poisoned (agent evolution goes wrong, false signal) → revert to last good snapshot.

---

## Part 3: Self-Improving Agent (HyperAgents Pattern)

### How HyperAgents Works

Meta's HyperAgents runs a **generate loop**:
1. **MetaAgent** reads the entire agent codebase (soul files + tools + behavior parameters)
2. MetaAgent proposes edits (behavioral diffs) targeting observed failure patterns
3. SafetyEval runs the proposed changes on golden tests
4. If score improves → apply to production
5. Lineage tracked in `archive.jsonl` (which evolutions descended from which)

Parent selection uses `score_child_prop`: score × exploration bonus (penalizes over-explored directions).

### Waldo's Self-Improvement Architecture

The HyperAgents pattern maps perfectly to our `agent_evolutions` table:

```
Signal detected: User dismisses 3 consecutive Morning Wags (too long)
  ↓
Evolution proposed: { change_type: 'verbosity', change_value: { max_sentences: 3 }, source: 'dismissal' }
  ↓
SafetyEval: Run proposed change on last 10 Morning Wag golden tests
  - Does it still cover all 6 dimensions? ✓
  - Does it remain non-clinical? ✓  
  - Does it still mention the most important signal? ✓
  Score: 0.87 (threshold: 0.75) → PASS
  ↓
Apply to production: update procedures table with { verbosity: 'short' }
  ↓
Track lineage: evolution_id → parent_evolution_id (chain)
```

### Lineage Architecture

```sql
-- agent_evolutions table (already exists) + add:
ALTER TABLE agent_evolutions ADD COLUMN parent_evolution_id UUID REFERENCES agent_evolutions(id);
ALTER TABLE agent_evolutions ADD COLUMN golden_test_score REAL;   -- 0-1, before applying
ALTER TABLE agent_evolutions ADD COLUMN lineage_path TEXT[];      -- array of ancestor IDs
```

Lineage chain: `evolution_5 → evolution_3 → evolution_1 → (root)` — traceable back to the original behavioral parameter.

### Evolution Parent Selection

Adapted from HyperAgents `score_child_prop`:

```typescript
function selectNextEvolutionToApply(candidates: Evolution[]): Evolution {
  const scores = candidates.map(e => e.golden_test_score ?? 0);
  const midpoint = mean(topN(scores, 3));
  
  return maxBy(candidates, (e) => {
    const scoreSigmoid = 1 / (1 + Math.exp(-10 * (e.golden_test_score - midpoint)));
    const childCount = countChildren(e.id);  // how many evolutions built on this
    const explorationBonus = Math.exp(-Math.pow(childCount / 8, 3));
    return scoreSigmoid * explorationBonus;
  });
}
```

This prevents getting stuck in a local optimum (e.g., always making messages shorter) by penalizing over-explored branches.

### Fail-Improve Loop (GStack Pattern)

From gstack: track every LLM fallback, compute deterministic rate, auto-generate test cases.

For Waldo's pre-filter (rules-based skip):

```typescript
// In agent.ts, pre-filter check:
const shouldSkipLLM = preFilter(crsScore, stressConfidence);
if (shouldSkipLLM) {
  // Log to fail-improve for pre-filter accuracy tracking
  await logPreFilterDecision({
    userId, crsScore, stressConfidence, 
    decision: 'template',
    was_correct: null  // filled in later via feedback
  });
  return { message: getTemplate(zone), method: 'template' };
}

// If user gives thumbs-down to a template response:
// was_correct = false → this was a false skip
// Log to fail-improve → compute deterministic accuracy rate
// "Pre-filter accuracy: 87% → 73% this week (misconfigured threshold for low-HRV users)"
```

### What NEVER Self-Improves (Identity = Immutable)

Following HyperAgents' safety model:

- Soul files (SOUL_BASE, zone modifiers, mode templates) — git-controlled only
- CRS algorithm weights — science-grounded, needs human review to change
- Safety rules (medical disclaimers, emergency detection) — immutable
- Privacy architecture (health data never in DO SQLite) — immutable

Only behavioral parameters evolve: verbosity, timing, topic priority, language style, message length.

---

## Part 4: DuckDB for Constellation Analytics (Phase 2)

### Why DuckDB, Not SQLite or Postgres

DO SQLite: optimized for per-user point lookups (memory_blocks, episodes). Row-oriented. Bad at "scan all episodes from 2025 and find Monday patterns."

Supabase Postgres: health data with RLS. Can handle analytical queries but:
- Health data can't leave Supabase (privacy architecture)
- pgvector handles semantic search
- Complex aggregations across R2 JSONL archives are not in its wheelhouse

DuckDB: analytical engine that reads R2 JSONL/Parquet directly. Ideal for:
- "How has my sleep changed over 12 months?"
- "What was the HRV-meeting correlation in Q4 vs Q1?"
- Weekly Constellation deep mining (full archive scan)

### Architecture

```
DO alarm fires → Weekly Patrol
  ↓
DO calls CF Container Worker (DuckDB)
  ↓
DuckDB queries R2: SELECT ... FROM read_ndjson('r2://waldo-episodes/{userId}/**/*.jsonl')
  ↓
Aggregated insights JSON returned
  ↓
DO writes to memory_blocks.hall_discoveries
  ↓
bootstrap re-runs → constellation.md updated
```

### Example Constellation Query

```sql
-- "What's my best week pattern?"
-- Runs against all archived episodes in R2
SELECT
  strftime('%A', episode_date) AS day_of_week,
  round(avg(crs_score), 1) AS avg_form,
  round(avg(hrv), 1) AS avg_hrv,
  round(avg(sleep_hours), 1) AS avg_sleep,
  round(avg(meeting_load), 1) AS avg_meetings,
  count(*) AS sample_size
FROM read_ndjson(
  'r2://waldo-episodes/{userId}/**/*.jsonl',
  format = 'newline_delimited'
)
WHERE episode_type = 'hall_events'
GROUP BY day_of_week
ORDER BY avg_form DESC;

-- "Does after-hours email predict worse sleep?"
SELECT
  CASE WHEN email_after_hours_ratio > 0.4 THEN 'high_ah' ELSE 'low_ah' END AS email_load,
  round(avg(next_day_sleep_hours), 1) AS avg_sleep_after,
  round(avg(next_day_hrv), 1) AS avg_hrv_after,
  count(*) AS n
FROM (
  SELECT e.*, 
    lead(sleep_hours) OVER (ORDER BY episode_date) AS next_day_sleep_hours,
    lead(hrv) OVER (ORDER BY episode_date) AS next_day_hrv
  FROM read_ndjson('r2://waldo-episodes/{userId}/**/*.jsonl', format='newline_delimited') e
  WHERE email_after_hours_ratio IS NOT NULL
)
GROUP BY email_load;
```

### When to Build This

**Not for MVP.** DuckDB Constellation queries are Phase 2+. The trigger:
- User has >90 days of archived episodes in R2
- Weekly Patrol takes >10 seconds because it's loading all SQLite episodes
- Users are asking questions like "how did my sleep change since I started tracking?"

---

## Part 5: Semantic Memory (Vectorize + pgvector)

### The Use Case

The LLM wiki (R2 workspace files) handles Waldo's *structured* knowledge. But there's unstructured knowledge in episodes:

**"When did I last feel like this?"** — semantic similarity search across 365+ days of diary entries.

**"Find patterns similar to this current state"** — "CRS 44, Monday, after heavy Sunday email load, meeting day ahead" → find matching past episodes.

These require vector embeddings, not keyword search.

### Architecture

```
Phase D: pgvector (Supabase) ← already in stack
  - DO calls Supabase REST: POST /rest/v1/rpc/match_episodes
  - Adds ~50-100ms cross-cloud latency
  - Free at Supabase (existing instance)
  - Good for: infrequent deep queries, Constellation SQL joins

Phase D+: Cloudflare Vectorize ← native DO binding
  - env.WALDO_VECTORS.query() — zero latency from DO, same CF network
  - $3-6/month at 10K users (negligible)
  - Good for: real-time "similar past moments" in Morning Wag context
  - Workers AI @cf/baai/bge-base-en-v1.5 for embedding (768d, free tier)
```

### Embedding What

| Content | Dimensions | When | Cost |
|---|---|---|---|
| Daily diary summaries | 768 | On episode compaction (nightly) | ~$0.000002/episode |
| Spot titles + details | 768 | On spot generation | ~$0.000002/spot |
| hall_discoveries pages | 768 | On discovery write | ~$0.000002/page |
| Morning Wag messages | Skip | Too specific, changes daily | — |

Total embedding cost at 10K users × 365 episodes: ~$0.07/day → **~$2/month embedding generation.**

### Semantic Memory Query Example

```typescript
// In agent.ts, morning_wag trigger:
async function findSimilarPastMoments(currentContext: string, userId: string): Promise<string> {
  // 1. Embed current context
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: `CRS: ${crs.score}, zone: ${crs.zone}, sleep: ${sleep?.hours}h, ` +
          `meetings: ${cal?.events} today, mood: ${mood?.dominant_mood}`
  });
  
  // 2. Find similar past moments
  const matches = await env.WALDO_VECTORS.query(embedding.data[0], {
    topK: 3,
    filter: { userId },
    returnMetadata: 'all'
  });
  
  // 3. Returns: "3 similar days in your history: ..."
  if (matches.matches.length > 0) {
    return `Similar past moments: ${
      matches.matches.map(m => m.metadata?.date + ': ' + m.metadata?.summary).join('; ')
    }`;
  }
  return '';
}
```

---

## Part 6: The Full Second Brain Stack

### Complete Architecture

```
┌─────────────────── WALDO SECOND BRAIN ──────────────────────────┐
│                                                                   │
│  PERCEPTION (data in)                                             │
│  ├── Apple Watch → health_snapshots (Supabase)                   │
│  ├── Google Calendar → calendar_metrics (Supabase)               │
│  ├── Gmail → email_metrics (Supabase)                            │
│  ├── Spotify/YouTube → mood_metrics (Supabase)                   │
│  └── User conversations → conversation_history (Supabase)        │
│                   ↓                                               │
│  KNOWLEDGE ENGINE (build-intelligence + bootstrap)                │
│  ├── Spots: 88 cross-domain observations                         │
│  ├── Patterns: 5 promoted cross-domain correlations              │
│  ├── Master metrics: cognitive load, burnout trajectory           │
│  └── LLM wiki: profile.md, baselines.md, patterns.md...          │
│                   ↓                                               │
│  BRAIN (WaldoAgent DO — per user, persistent)                    │
│  ├── SQLite memory (6 halls: facts/events/discoveries/...)        │
│  ├── R2 workspace (LLM wiki files)                                │
│  ├── Vectorize (semantic episode search — Phase D+)               │
│  └── Patrol alarm (15-min awakeness check)                       │
│                   ↓                                               │
│  REASONING (ReAct loop — 15 tools)                                │
│  ├── L0: Template (zero cost) — pre-filter deterministic          │
│  ├── L1: invoke-agent EF — single Haiku call (fallback)           │
│  └── L2: CF Worker DO — full ReAct + memory + workspace           │
│                   ↓                                               │
│  ANALYTICS LAYER (Phase 2 — DuckDB + pgvector)                   │
│  ├── DuckDB in CF Container → R2 JSONL/Parquet scan               │
│  └── pgvector on Supabase → SQL-joined semantic queries           │
│                   ↓                                               │
│  SELF-IMPROVEMENT (Phase G — HyperAgents pattern)                 │
│  ├── Fail-Improve loop → deterministic rate tracking              │
│  ├── Evolution proposals → golden test evaluation → apply         │
│  └── Lineage archive → rollback safety                            │
│                   ↓                                               │
│  DELIVERY (channels)                                              │
│  ├── Telegram: Morning Wag, Fetch Alert, Evening Review           │
│  ├── Web console: Dashboard, chat, Constellation                  │
│  └── MCP server (Phase 2): getCRS, getStressLevel → any agent    │
│                                                                   │
│  IMMUTABLE CORE (never self-modifies)                             │
│  ├── Soul files: SOUL_BASE, zone modifiers, mode templates        │
│  ├── CRS algorithm: 3-pillar formula + pillar drag                │
│  └── Privacy architecture: health values never leave Supabase     │
└───────────────────────────────────────────────────────────────────┘
```

### The Second Brain Advantage Over Every Competitor

| Competitor | What They Know | Waldo Knows |
|---|---|---|
| Obsidian / Notion / Roam | What you write | What your BODY says + what you write |
| Apple Health / WHOOP / Oura | Body signals | Body signals + ALL life context |
| ChatGPT Health | Conversation history | Conversation + biology + patterns + evolution |
| Nori (YC) | Activity + sleep | Activity + sleep + schedule + communication + tasks + mood + SELF-IMPROVING |
| Lindy / Manus / Cursor | Work context | Work context (but queries Waldo for biology) |

**The moat:** Waldo is the first system that knows both dimensions — biological AND life context — and maintains a self-updating wiki that improves over time without user effort.

---

## Part 7: Phase-by-Phase Implementation

### Phase D (Current — Complete)
- ✅ LLM wiki (R2 workspace files)
- ✅ 6-hall memory model (hall_type column exists)
- ✅ FTS5 on episodes (search_episodes tool)
- ✅ Cross-domain narrative builder (all 6 dimensions)
- ✅ Daily compaction (Dreaming Mode Phase 1)

**Missing from current Phase D:**
- ❌ Compiled truth + timeline structure (memory_blocks is still flat KV)
- ❌ Back-links between spots and patterns
- ❌ Index.md + log.md wiki files
- ❌ Page versions (rollback safety)

### Phase E (Next Sprint — 2-3 weeks)
- **AI Gateway** routing (2 lines, ship now)
- **Dynamic Workers / Code Mode** (81% token reduction, Open Beta)
- **Vectorize** binding for semantic search (Phase D+ capability)
- **today.md pre-compute** (nightly, Dreaming Mode Phase 2)
- **Fail-Improve loop** for pre-filter accuracy tracking

### Phase F (Onboarding — 1 month)
- **Sessions tree** migration (add parent_id to conversation_history)
- **Compiled truth + timeline** migration for memory_blocks
- **Back-links** between spots and patterns (Iron Law)
- **Index.md + log.md** wiki files
- **Page versions** table for rollback safety

### Phase G (Self-Evolution — 2-3 months)
- **Evolution proposals** with golden test evaluation
- **Lineage archive** (parent_evolution_id)
- **Score-based parent selection** (score_child_prop)
- **Fail-Improve** metrics dashboard

### Phase 2 (Autonomous OS — 3-6 months)
- **DuckDB in CF Container** for Constellation deep mining
- **pgvector** for SQL-joined semantic search
- **MCP server** exposing biological intelligence
- **Sub-agent Facets** (SleepAgent, ProductivityAgent via Think)
- **x402 monetization** on MCP queries

---

## Part 8: What "Waldo as Second Brain" Means for the Dashboard

The dashboard is not a health tracker. It is the **window into your second brain.**

### New Card: The Wiki (What Waldo Knows)

Add a "What Waldo Knows" panel that shows:
- Last updated timestamp
- How many discoveries (patterns)
- Most important current insight (from hall_insights)
- Button: "See your full constellation"

### The Constellation Becomes the Second Brain Index

Today: force-directed graph of spots and patterns.
Future: navigable knowledge graph — click a discovery → see compiled truth + timeline + evidence.

The Constellation IS the second brain's index.md, visualized.

### Morning Wag = The Second Brain's Daily Briefing

Not just "your CRS is 73." It's: *"The second brain read everything overnight. Here's what you need to know for today."*

The Waldo voice in morning messages should echo this: "Based on your patterns..." / "Waldo learned..." / "Your brain says X, your body says Y."

---

> **See also:**
> - [cloudflare-agents-week-analysis.md](./cloudflare-agents-week-analysis.md) — Project Think, Dynamic Workers, AI Gateway
> - [scaling-infrastructure.md](./scaling-infrastructure.md) — DO + R2 + Sandbox architecture
> - [architecture-roadmap.md](./architecture-roadmap.md) — Phase-by-phase status and priorities

---

## Appendix: OpenHarness Patterns to Adopt

> **Source:** HKUDS/OpenHarness — 337-file Python harness. Full analysis April 2026.

### 5-Stage Compaction Cascade (We Only Do Stage 4)

OpenHarness compaction is cheap-to-expensive:
1. **Microcompact** (free) — strip old tool results from `compactable_tools`, keep last 5
2. **Context collapse** (free) — truncate old TextBlocks to head(900) + tail(500) chars
3. **Session memory** (free) — 48-line textual summary replaces old messages, keeps 12 recent
4. **Full LLM compact** (expensive) — only if stages 1-3 didn't solve it
5. **PTL retry** — drop oldest 20% of rounds, retry up to 3 times

We call LLM compact every night. Stages 1-3 would handle many cases for free. **~40-60% of nightly compaction calls eliminated.**

### Capped Carryover Buckets (LRU Working Memory)

OpenHarness threads `tool_metadata` with capped buckets through every tool call:
- `read_file_state` (cap 6) — recent file reads with preview
- `recent_work_log` (cap 10) — chronological action log
- `recent_verified_work` (cap 10) — confirmed completed steps
- `async_agent_state` (cap 8) — spawned worker summaries

These survive compaction as `CompactAttachment` objects. **The agent's working focus persists across context resets.**

For Waldo: add `recent_work_log` and `recent_verified_work` buckets to our `tool_metadata` in `runAgentLoop()`. Update after each tool call. Include in compact attachments during nightly compaction.

### Pending Continuation Recovery

`has_pending_continuation()` detects if the conversation ended mid-tool-loop (ToolResultBlocks as last message with no follow-up). `continue_pending()` resumes without injecting a new user message.

For Waldo: before normal patrol, check `agent_state.agent_loop_interrupted`. If set, resume from partial state. Fixes silent Morning Wag failures when DO is evicted during iteration 2 of 3.

### Per-Turn Synthetic Context Injection + Removal

For coordinator turns, OpenHarness injects a synthetic "Coordinator User Context" message listing worker capabilities, then removes it after the model responds — never in conversation history.

For Waldo: inject fresh narrative context (calendar, email, tasks) at the start of each Morning Wag turn without accumulating in episode history. The agent always sees fresh data; episodes remain clean.

### SupportsStreamingMessages Protocol (Provider Abstraction)

OpenHarness depends on a protocol (`SupportsStreamingMessages`) not a concrete class. Any LLM client with `stream_message()` works.

For Waldo: in `llm.ts`, introduce an `LLMClient` interface. Both `callAnthropic()` and `callDeepSeek()` implement it. Future providers (Workers AI, DeepSeek V3, etc.) are drop-ins. This is the LLMProvider adapter pattern from our architecture docs — currently partially implemented.

### Compaction Prompt: Template Output, Not Open-Ended Summarization

OpenHarness coordinator rule: *"Never write 'based on your findings, do X.' Synthesize yourself first, then give specific prompts with exact values and dates."*

Applied to Waldo's bootstrap/nightly compaction: don't give Claude "summarize this data." Give it a structured output template:
```
You are analyzing [N] days of health data for [USER].
Write a compiled truth entry for this memory page:
  Title: [SPECIFIC TITLE]
  Format: 1-2 sentences stating the CURRENT UNDERSTANDING with exact numbers.
  Example: "HRV drops 22-30% on Monday mornings (vs 59 weekly avg). Primary driver: short Sunday sleep (-1.3h). Confirmed across 14 Mondays."
```
This is why profile.md is showing 26 bytes — the prompt was too open-ended.

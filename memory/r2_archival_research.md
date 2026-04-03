---
name: R2 Archival Storage Research
description: Cloudflare R2 as cold-storage tier for DO episodic memory. Not in architecture yet. Documented in Section 11 of WALDO_SCALING_INFRASTRUCTURE.md.
type: project
---

R2 added to architecture docs April 2026. Key decisions:

- **DO SQLite**: Tiers 1-3 (semantic, procedural, active episodic 0-90 days). 10 GB per DO limit.
- **R2**: Episodes >90 days old, GDPR user exports. Buckets: `waldo-episodes` + `waldo-exports`.
- **Supabase**: Health data only. Never in R2 or DO.

**Why:** R2 egress is $0. $0.015/GB/month. At 10K users, archival costs <$1/month. Free for user exports.

**When to build:** Phase E (after DO migration). Not needed Phase D. Starts mattering at 6+ months of conversation history per user.

**How:** Patrol Agent weekly consolidation archives episodes >90d to R2 JSONL. DO SQLite schema needs `archived_to_r2 BOOLEAN` + `r2_key TEXT` columns on episodes table.

**Key rule preserved:** Raw health values NEVER go to R2. R2 is for agent memory (episodic archives) and compliance exports only.

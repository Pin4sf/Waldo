# Waldo — Weekly Compaction Hand
> Trigger: Sunday at 20:00 local
> Phase 2+. Uses Claude (Haiku for summary, Sonnet for pattern discovery).
> This is the intelligence that compounds over months.

---

## What it does
Takes 7 days of data, interactions, and feedback → extracts what matters → updates Ark's memory files.

## Steps

### Step 1: Session summary compaction (no LLM)
Compress the week's conversation_history into a 200-token summary.
Archive raw conversation_history entries older than 30 days.

### Step 2: Pattern scan (Claude Haiku)
Look for new correlations across the last 30 days:
- Cross-source correlations that reached 0.60+ confidence
- Patterns that held for 3+ consecutive weeks
- Patterns that previously held but broke (note the break)

Prompt: compact, structured. Output: JSON list of pattern candidates.

### Step 3: Intelligence summary update (Claude Haiku)
Regenerate `intelligence-summary.md` based on all current memory files.
Target: <500 tokens, natural language, the most important facts about this user.

### Step 4: Pattern promotion (no LLM)
- emerging_pattern with evidence_count ≥ 20 AND confidence ≥ 0.70 → promote to validated
- validated_pattern not seen in 90 days → move to cold, note decay
- rejected_pattern after 180 days → archive (keep in learning-log, remove from active)

### Step 5: Goals update (if feedback suggests)
If user has mentioned goal progress in chat → update MEMORY_GOALS.md

### Step 6: Calibration check (no LLM)
Review feedback_events from the week:
- 3+ dismissals of messages with high verbosity → queue CALIBRATION_VERBOSITY update
- 3+ dismissals of messages in specific time window → queue CALIBRATION_TIMING update
These are queued as EVOLUTION_PENDING, not applied immediately.

## Output files updated
- `intelligence-summary.md` (regenerated)
- `patterns.json` (patterns promoted/archived)
- `learning-log.md` (week's milestone appended)
- `MEMORY_PATTERNS.md` (natural language version synced)
- `evolution/EVOLUTION_PENDING.md` (calibration changes queued)

## Cost estimate
~2,000 tokens per weekly compaction per user. ~$0.001 at Haiku rates.
Phase 2: upgrade to Sonnet for pattern discovery on power users ($0.005/week).

/**
 * Waldo — weekly-compaction Edge Function
 *
 * Runs Sunday at 20:00 UTC (pg_cron scheduled in 20260402000002_additional_pg_cron.sql).
 * The intelligence engine that compounds over months.
 *
 * Per user:
 * 1. Compact conversation history → 200-token weekly summary in core_memory
 * 2. Promote patterns with evidence_count ≥ 20 AND confidence ≥ 0.70 (rule-based, no LLM)
 * 3. Update user_intelligence summary (no LLM for MVP — structured from core_memory)
 * 4. Queue calibration evolutions based on feedback signal patterns
 * 5. Archive conversation_history older than 30 days (delete to keep DB lean)
 *
 * NO LLM in MVP — Phase G adds Claude Haiku for pattern discovery + summary generation.
 * Cost today: $0.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PATTERN_PROMOTE_CONFIDENCE_THRESHOLD = 0.70;
const PATTERN_PROMOTE_EVIDENCE_THRESHOLD = 20;
const CONVERSATION_ARCHIVE_DAYS = 30;

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'weekly-compaction', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Step 1: Compact conversation history ─────────────────────
// Reads last 7 days, builds a compact summary, writes to core_memory.
// No LLM: structured extraction of what happened this week.
async function compactConversationHistory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ messagesRead: number; summary: string }> {
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: messages } = await supabase
    .from('conversation_history')
    .select('role, content, mode, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff7d)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) {
    return { messagesRead: 0, summary: 'No messages this week.' };
  }

  // Count by trigger type
  const modeCounts: Record<string, number> = {};
  let userMessages = 0;
  for (const m of messages) {
    if (m.role === 'user') userMessages++;
    if (m.mode) modeCounts[m.mode] = (modeCounts[m.mode] ?? 0) + 1;
  }

  const parts: string[] = [`Week ${new Date().toISOString().slice(0, 10)}: ${messages.length} messages total.`];
  if (modeCounts['morning_wag']) parts.push(`${modeCounts['morning_wag']} Morning Wags.`);
  if (modeCounts['evening_review']) parts.push(`${modeCounts['evening_review']} Evening Reviews.`);
  if (modeCounts['fetch_alert']) parts.push(`${modeCounts['fetch_alert']} Fetch Alerts.`);
  if (userMessages > 0) parts.push(`${userMessages} user replies.`);

  const summary = parts.join(' ');
  return { messagesRead: messages.length, summary };
}

// ─── Step 2: Update pattern evidence + promote ─────────────────
// Scan last 7 days of health data and bump evidence counts.
// Promote patterns that meet the threshold.
async function updatePatterns(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ updated: number; promoted: number }> {
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Get active patterns for this user
  const { data: patterns } = await supabase
    .from('patterns')
    .select('id, confidence, evidence_count, last_seen, type')
    .eq('user_id', userId);

  if (!patterns || patterns.length === 0) return { updated: 0, promoted: 0 };

  let updated = 0;
  let promoted = 0;

  // Check how many valid CRS days exist in the last 7 days
  const { count: recentDays } = await supabase
    .from('crs_scores')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', cutoff7d);

  const hasWeekOfData = (recentDays ?? 0) >= 5;

  for (const pattern of patterns) {
    const updates: Record<string, unknown> = { last_seen: today };

    // Bump evidence count if this week had good data
    if (hasWeekOfData) {
      updates['evidence_count'] = (pattern.evidence_count ?? 0) + 1;
    }

    // Promote if meets threshold
    const conf = typeof pattern.confidence === 'string'
      ? parseFloat(pattern.confidence)
      : (pattern.confidence as number) ?? 0;
    const newEvidence = (pattern.evidence_count ?? 0) + (hasWeekOfData ? 1 : 0);

    if (conf >= PATTERN_PROMOTE_CONFIDENCE_THRESHOLD && newEvidence >= PATTERN_PROMOTE_EVIDENCE_THRESHOLD) {
      updates['confidence'] = Math.min(0.95, conf + 0.02); // Gradually increase confidence
      promoted++;
    }

    const { error } = await supabase
      .from('patterns')
      .update(updates)
      .eq('id', pattern.id)
      .eq('user_id', userId);

    if (!error) updated++;
  }

  return { updated, promoted };
}

// ─── Step 3: Rebuild user_intelligence summary ─────────────────
// Structured summary from core_memory keys. No LLM for MVP.
async function rebuildUserIntelligence(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: memRows } = await supabase
    .from('core_memory')
    .select('key, value')
    .eq('user_id', userId);

  if (!memRows || memRows.length === 0) return;

  const mem: Record<string, string> = {};
  for (const row of memRows) mem[row.key] = row.value;

  const parts: string[] = [];

  // Build natural-language summary from memory keys
  if (mem['days_of_data']) parts.push(`${mem['days_of_data']} days of data collected.`);
  if (mem['hrv_baseline']) parts.push(`HRV baseline: ${mem['hrv_baseline']} (30d: ${mem['hrv_baseline_30d'] ?? '—'}).`);
  if (mem['hrv_trend'] && mem['hrv_trend'] !== 'stable') parts.push(`HRV trending ${mem['hrv_trend']}.`);
  if (mem['sleep_avg_7d']) parts.push(`7d avg sleep: ${mem['sleep_avg_7d']}.`);
  if (mem['sleep_debt'] && parseFloat(mem['sleep_debt']) > 0.5) parts.push(`Sleep debt: ${mem['sleep_debt']}.`);
  if (mem['avg_bedtime']) parts.push(`Avg bedtime ${mem['avg_bedtime']}, wake ${mem['avg_wake_time'] ?? '—'}.`);
  if (mem['resting_hr_baseline']) parts.push(`Resting HR baseline: ${mem['resting_hr_baseline']}.`);
  if (mem['chronotype']) parts.push(`Chronotype: ${mem['chronotype']}.`);
  if (mem['steps_avg_7d']) parts.push(`7d avg steps: ${mem['steps_avg_7d']}.`);

  const summary = parts.length > 0 ? parts.join(' ') : 'Building user profile — not enough data yet.';

  await supabase
    .from('user_intelligence')
    .upsert(
      {
        user_id: userId,
        summary,
        baselines: {
          hrv_ema_7d: mem['hrv_baseline'] ? parseFloat(mem['hrv_baseline']) : null,
          hrv_sma_30d: mem['hrv_baseline_30d'] ? parseFloat(mem['hrv_baseline_30d']) : null,
          sleep_avg_7d: mem['sleep_avg_7d'] ? parseFloat(mem['sleep_avg_7d']) : null,
          resting_hr: mem['resting_hr_baseline'] ? parseFloat(mem['resting_hr_baseline']) : null,
          steps_avg_7d: mem['steps_avg_7d'] ? parseInt(mem['steps_avg_7d']) : null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
}

// ─── Step 4: Queue calibration evolutions ─────────────────────
// Check recent agent_evolutions for pending signals. No LLM.
async function queueCalibrationEvolutions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ queued: number }> {
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Count unapplied feedback signals by change_type in the last 7 days
  const { data: evolutions } = await supabase
    .from('agent_evolutions')
    .select('change_type, source, applied')
    .eq('user_id', userId)
    .eq('applied', false)
    .gte('created_at', cutoff7d);

  if (!evolutions || evolutions.length === 0) return { queued: 0 };

  const counts: Record<string, number> = {};
  for (const ev of evolutions) {
    counts[ev.change_type] = (counts[ev.change_type] ?? 0) + 1;
  }

  let queued = 0;

  // If 3+ dismissals of verbosity → queue CALIBRATION_VERBOSITY tighten
  if ((counts['verbosity'] ?? 0) >= 3) {
    const existing = await supabase
      .from('core_memory')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'calibration_verbosity_queued')
      .maybeSingle();

    if (!existing.data) {
      await supabase.from('core_memory').upsert({
        user_id: userId,
        key: 'calibration_verbosity_queued',
        value: 'tighten',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });
      queued++;
    }
  }

  // If 3+ timing-related dismissals → queue CALIBRATION_TIMING review
  if ((counts['timing'] ?? 0) >= 3) {
    const existing = await supabase
      .from('core_memory')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'calibration_timing_queued')
      .maybeSingle();

    if (!existing.data) {
      await supabase.from('core_memory').upsert({
        user_id: userId,
        key: 'calibration_timing_queued',
        value: 'review',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });
      queued++;
    }
  }

  return { queued };
}

// ─── Step 5: Archive old conversation history ──────────────────
async function archiveOldConversations(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - CONVERSATION_ARCHIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('conversation_history')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .lt('created_at', cutoff);
  return count ?? 0;
}

// ─── Compact one user ─────────────────────────────────────────
async function compactUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  userId: string;
  ok: boolean;
  conversationSummary?: string;
  patternsUpdated?: number;
  patternsPromoted?: number;
  evolutionsQueued?: number;
  archivedMessages?: number;
  error?: string;
}> {
  try {
    const [historyResult, patternResult, evolutionResult] = await Promise.all([
      compactConversationHistory(supabase, userId),
      updatePatterns(supabase, userId),
      queueCalibrationEvolutions(supabase, userId),
    ]);

    // Rebuild intelligence after patterns are updated
    await rebuildUserIntelligence(supabase, userId);

    // Write weekly summary to core_memory
    if (historyResult.messagesRead > 0) {
      await supabase.from('core_memory').upsert({
        user_id: userId,
        key: 'last_weekly_summary',
        value: historyResult.summary,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });
    }

    const archivedMessages = await archiveOldConversations(supabase, userId);

    return {
      userId,
      ok: true,
      conversationSummary: historyResult.summary,
      patternsUpdated: patternResult.updated,
      patternsPromoted: patternResult.promoted,
      evolutionsQueued: evolutionResult.queued,
      archivedMessages,
    };
  } catch (err) {
    return {
      userId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const startMs = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetUserId: string | null = body.user_id ?? null;

    const query = supabase.from('users').select('id').eq('active', true);
    if (targetUserId) query.eq('id', targetUserId);

    const { data: users, error: usersError } = await query;

    if (usersError) {
      log('error', 'users_fetch_failed', { error: usersError.message });
      return json({ error: usersError.message }, 500);
    }

    if (!users || users.length === 0) {
      return json({ compacted: 0, reason: 'No active users' });
    }

    log('info', 'weekly_compaction_start', { user_count: users.length });

    const results = await Promise.allSettled(
      users.map(u => compactUser(supabase, u.id)),
    );

    let successCount = 0;
    let totalArchived = 0;
    let totalPromoted = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        successCount++;
        totalArchived += r.value.archivedMessages ?? 0;
        totalPromoted += r.value.patternsPromoted ?? 0;
      }
    }

    const latencyMs = Date.now() - startMs;
    log('info', 'weekly_compaction_complete', {
      users_compacted: successCount,
      patterns_promoted: totalPromoted,
      messages_archived: totalArchived,
      latency_ms: latencyMs,
    });

    return json({
      users_compacted: successCount,
      patterns_promoted: totalPromoted,
      messages_archived: totalArchived,
      latency_ms: latencyMs,
    });
  } catch (err) {
    log('error', 'run_failed', { error: err instanceof Error ? err.message : String(err) });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

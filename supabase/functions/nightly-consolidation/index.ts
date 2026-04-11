/**
 * Waldo — nightly-consolidation Edge Function (Dreaming Mode Lite)
 *
 * Runs nightly at 2:00 AM UTC (pg_cron). The agent "dreams" about yesterday.
 *
 * Pipeline (pure TypeScript, no LLM cost):
 *   Phase 1: CONSOLIDATE — Summarize yesterday's conversations + spots into diary entry
 *   Phase 2: PROMOTE — Check for 3+ recurring patterns, promote to patterns table
 *   Phase 3: UPDATE — Rebuild user_intelligence summary from core_memory + patterns
 *   Phase 4: PRE-COMPUTE — Cache tomorrow's Morning Wag context highlights
 *
 * Cost: $0.00 per user per night (no Claude calls — pure computation)
 *
 * This is the "Dreaming Mode" that makes Waldo compound over time.
 * "Your agent dreams about your day while you sleep, and wakes up smarter."
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'nightly-consolidation', level, event, ...data }));
}

function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Phase 1: Consolidate yesterday's episodes into diary entry ────
async function consolidateEpisodes(supabase: SupabaseClient, userId: string): Promise<string> {
  const date = yesterday();

  // Fetch yesterday's conversations
  const { data: conversations } = await supabase
    .from('conversation_history')
    .select('role, content, mode, created_at')
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${today()}T00:00:00`)
    .order('created_at', { ascending: true });

  // Fetch yesterday's spots
  const { data: spots } = await supabase
    .from('spots')
    .select('type, severity, title')
    .eq('user_id', userId)
    .eq('date', date);

  // Fetch yesterday's stress events
  const { data: stressEvents } = await supabase
    .from('stress_events')
    .select('confidence, severity, duration_minutes')
    .eq('user_id', userId)
    .eq('date', date);

  // Fetch yesterday's CRS
  const { data: crs } = await supabase
    .from('crs_scores')
    .select('score, zone')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  // Build structured diary entry (no LLM — pure template)
  const parts: string[] = [];
  parts.push(`## ${date}`);

  if (crs) {
    parts.push(`CRS: ${crs.score} (${crs.zone})`);
  }

  // Conversations summary
  const convos = conversations ?? [];
  const waldoMsgs = convos.filter((c: any) => c.role === 'waldo');
  const userMsgs = convos.filter((c: any) => c.role === 'user');
  const modes = [...new Set(convos.map((c: any) => c.mode))];

  if (convos.length > 0) {
    parts.push(`Interactions: ${convos.length} messages (${waldoMsgs.length} from Waldo, ${userMsgs.length} from user)`);
    parts.push(`Modes: ${modes.join(', ')}`);
  }

  // Spots
  const spotList = spots ?? [];
  if (spotList.length > 0) {
    const warnings = spotList.filter((s: any) => s.severity === 'warning' || s.severity === 'critical');
    parts.push(`Spots: ${spotList.length} (${warnings.length} warnings)`);
    for (const s of spotList.slice(0, 3)) {
      parts.push(`  - [${(s as any).type}] ${(s as any).title}`);
    }
  }

  // Stress events
  const stress = stressEvents ?? [];
  if (stress.length > 0) {
    const highStress = stress.filter((s: any) => s.severity === 'high');
    const totalMin = stress.reduce((s: number, e: any) => s + (e.duration_minutes ?? 0), 0);
    parts.push(`Stress: ${stress.length} events (${highStress.length} high), ${totalMin} total min`);
  }

  // User feedback themes (from conversations)
  const userFeedback = userMsgs.filter((m: any) =>
    /thanks|good|helpful|not helpful|wrong|too|don't/i.test(m.content ?? '')
  );
  if (userFeedback.length > 0) {
    parts.push(`User feedback signals: ${userFeedback.length}`);
  }

  const diary = parts.join('\n');

  // Store as core_memory diary entry
  await supabase.from('core_memory').upsert({
    user_id: userId,
    key: `diary_${date}`,
    value: diary.slice(0, 500), // Cap at 500 chars
    hall_type: 'events',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,key' });

  return diary;
}

// ─── Phase 2: Promote recurring patterns ─────────────────────────
async function promotePatterns(supabase: SupabaseClient, userId: string): Promise<number> {
  // Get last 14 days of spots
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: recentSpots } = await supabase
    .from('spots')
    .select('type, title, date')
    .eq('user_id', userId)
    .gte('date', cutoff);

  if (!recentSpots || recentSpots.length < 3) return 0;

  // Count title occurrences (normalized)
  const titleCounts = new Map<string, { count: number; dates: string[]; type: string }>();
  for (const s of recentSpots) {
    const key = (s as any).title?.toLowerCase().trim();
    if (!key) continue;
    const existing = titleCounts.get(key) ?? { count: 0, dates: [], type: (s as any).type };
    existing.count++;
    existing.dates.push((s as any).date);
    titleCounts.set(key, existing);
  }

  // Promote patterns with 3+ occurrences
  let promoted = 0;
  for (const [title, info] of titleCounts) {
    if (info.count < 3) continue;

    const confidence = Math.min(0.9, 0.5 + info.count * 0.05);
    const firstSeen = info.dates.sort()[0];
    const lastSeen = info.dates.sort().reverse()[0];

    // Check if pattern already exists
    const { data: existing } = await supabase
      .from('patterns')
      .select('id, evidence_count')
      .eq('user_id', userId)
      .ilike('summary', `%${title.slice(0, 30)}%`)
      .maybeSingle();

    if (existing) {
      // Update evidence count
      await supabase.from('patterns').update({
        evidence_count: Math.max(existing.evidence_count, info.count),
        confidence,
        last_seen: lastSeen,
      }).eq('id', existing.id);
    } else {
      // Create new pattern
      await supabase.from('patterns').insert({
        user_id: userId,
        type: info.type === 'health' ? 'correlation' : 'weekly',
        confidence,
        summary: title.slice(0, 200),
        evidence_count: info.count,
        first_seen: firstSeen,
        last_seen: lastSeen,
      });
      promoted++;
    }
  }

  return promoted;
}

// ─── Phase 3: Update user intelligence summary ──────────────────
async function updateIntelligence(supabase: SupabaseClient, userId: string): Promise<void> {
  // Gather all sources
  const [{ data: memories }, { data: patterns }, { data: health7d }, { data: crs7d }] = await Promise.all([
    supabase.from('core_memory').select('key, value, hall_type').eq('user_id', userId),
    supabase.from('patterns').select('summary, confidence, evidence_count').eq('user_id', userId).gte('confidence', 0.5),
    supabase.from('health_snapshots').select('date, sleep_duration_hours, hrv_rmssd, steps').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('crs_scores').select('date, score, zone').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(7),
  ]);

  const avgCrs = (crs7d ?? []).reduce((s: number, c: any) => s + c.score, 0) / Math.max(1, (crs7d ?? []).length);
  const avgSleep = (health7d ?? [])
    .filter((h: any) => h.sleep_duration_hours)
    .reduce((s: number, h: any) => s + h.sleep_duration_hours, 0) / Math.max(1, (health7d ?? []).filter((h: any) => h.sleep_duration_hours).length);

  const highConfPatterns = (patterns ?? []).filter((p: any) => p.confidence >= 0.7);

  const summary = [
    `7d CRS avg: ${avgCrs.toFixed(0)}`,
    `7d sleep avg: ${avgSleep.toFixed(1)}h`,
    `Patterns discovered: ${(patterns ?? []).length} (${highConfPatterns.length} high confidence)`,
    `Memory entries: ${(memories ?? []).length}`,
  ].join('. ');

  await supabase.from('user_intelligence').upsert({
    user_id: userId,
    summary,
    crs_patterns: { avg_7d: +avgCrs.toFixed(0), trend: (crs7d ?? []).map((c: any) => ({ date: c.date, score: c.score })) },
    sleep_patterns: { avg_7d: +avgSleep.toFixed(1) },
    baselines: (memories ?? []).filter((m: any) => m.key?.includes('baseline') || m.key?.includes('7d_')),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// ─── Phase 4: Pre-compute Morning Wag context ───────────────────
async function preComputeMorning(supabase: SupabaseClient, userId: string): Promise<void> {
  const todayStr = today();

  // Get today's calendar metrics
  const { data: cal } = await supabase.from('calendar_metrics')
    .select('meeting_load_score, event_count, back_to_back_count, focus_gaps')
    .eq('user_id', userId).eq('date', todayStr).maybeSingle();

  // Get task urgency
  const { data: tasks } = await supabase.from('task_metrics')
    .select('pending_count, overdue_count, pending_titles')
    .eq('user_id', userId).eq('date', todayStr).maybeSingle();

  // Get yesterday's mood
  const { data: mood } = await supabase.from('mood_metrics')
    .select('dominant_mood, late_night_listening')
    .eq('user_id', userId).eq('date', yesterday()).maybeSingle();

  const highlights: string[] = [];

  if (cal) {
    if ((cal as any).meeting_load_score > 8) highlights.push(`Heavy meeting day (MLS ${(cal as any).meeting_load_score})`);
    if ((cal as any).back_to_back_count > 2) highlights.push(`${(cal as any).back_to_back_count} back-to-back meetings`);
    const gaps = (cal as any).focus_gaps as any[] ?? [];
    if (gaps.length > 0) highlights.push(`Focus window: ${gaps[0]?.durationMinutes ?? '?'}min gap`);
  }

  if (tasks) {
    if ((tasks as any).overdue_count > 0) highlights.push(`${(tasks as any).overdue_count} overdue tasks`);
    if ((tasks as any).pending_count > 5) highlights.push(`${(tasks as any).pending_count} tasks pending`);
  }

  if (mood) {
    if ((mood as any).late_night_listening) highlights.push('Late night music session detected');
    if ((mood as any).dominant_mood === 'melancholic') highlights.push('Yesterday mood: low energy music');
  }

  if (highlights.length > 0) {
    await supabase.from('core_memory').upsert({
      user_id: userId,
      key: 'pre_compute_morning',
      value: highlights.join('. '),
      hall_type: 'events',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
  }
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('active', true);

  if (!users || users.length === 0) {
    log('info', 'no_active_users');
    return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  log('info', 'dreaming_start', { users: users.length });

  let processed = 0;
  let errors = 0;

  for (const user of users.slice(0, 20)) { // Cap at 20 users per run
    try {
      // Phase 1: Consolidate
      await consolidateEpisodes(supabase, user.id);

      // Phase 2: Promote patterns
      const promoted = await promotePatterns(supabase, user.id);

      // Phase 3: Update intelligence
      await updateIntelligence(supabase, user.id);

      // Phase 4: Pre-compute morning
      await preComputeMorning(supabase, user.id);

      processed++;
      if (promoted > 0) {
        log('info', 'patterns_promoted', { userId: user.id, count: promoted });
      }
    } catch (err) {
      errors++;
      log('error', 'user_consolidation_failed', { userId: user.id, error: (err as Error).message });
    }
  }

  log('info', 'dreaming_complete', { processed, errors });
  return new Response(JSON.stringify({ processed, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

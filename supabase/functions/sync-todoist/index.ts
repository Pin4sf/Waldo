/**
 * Waldo — sync-todoist Edge Function
 *
 * Runs nightly at 3:50 AM UTC (pg_cron). Syncs Todoist tasks for all users
 * who have connected Todoist.
 *
 * Computes: task pile-up, completion velocity, overdue count, urgency queue.
 * Writes to: task_metrics table (same table as Google Tasks, with provider='todoist').
 *
 * Todoist REST API v2: https://developer.todoist.com/rest/v2
 * Todoist tokens don't expire — no refresh needed.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const TODOIST_API = 'https://api.todoist.com/rest/v2';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-todoist', level, event, ...data }));
}

interface TodoistTask {
  id: string;
  content: string;
  is_completed: boolean;
  due: { date: string; datetime?: string; is_recurring: boolean } | null;
  priority: number; // 1 = normal, 4 = urgent
  created_at: string;
  completed_at?: string;
  labels: string[];
}

async function todoistFetch(path: string, token: string): Promise<{ ok: boolean; data: any }> {
  const resp = await fetch(`${TODOIST_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return { ok: false, data: null };
  return { ok: true, data: await resp.json() };
}

async function syncUserTodoist(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: boolean; tasksProcessed: number; error?: string }> {
  // Get token (Todoist tokens don't expire)
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('user_id', userId).eq('provider', 'todoist').maybeSingle();

  if (!tokenRow) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'todoist',
      last_sync_status: 'no_token', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, tasksProcessed: 0, error: 'no_token' };
  }

  const token = tokenRow.access_token;

  // Fetch all active tasks
  const { ok: tasksOk, data: activeTasks } = await todoistFetch('/tasks', token);
  if (!tasksOk) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'todoist',
      last_sync_status: 'error', last_error: 'API fetch failed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, tasksProcessed: 0, error: 'api_error' };
  }

  const tasks = (activeTasks as TodoistTask[]) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Compute metrics
  const pending = tasks.filter(t => !t.is_completed);
  const overdue = pending.filter(t => t.due && t.due.date < today);
  const dueToday = pending.filter(t => t.due && t.due.date === today);
  const dueTomorrow = pending.filter(t => t.due && t.due.date === tomorrow);

  // Urgency queue: tasks due today or tomorrow, sorted by priority (4=urgent, 1=normal)
  const urgentTasks = [...dueToday, ...dueTomorrow]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map(t => t.content);

  // Fetch completed tasks (last 7 days) for velocity
  // Todoist Sync API for completed items
  let completedToday = 0;
  try {
    const completedResp = await fetch('https://api.todoist.com/sync/v9/completed/get_all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        since: `${today}T00:00:00`,
        limit: '50',
      }),
    });
    if (completedResp.ok) {
      const completedData = await completedResp.json() as { items: { completed_at: string }[] };
      completedToday = (completedData.items ?? []).filter(
        i => i.completed_at?.startsWith(today)
      ).length;
    }
  } catch {
    // Non-critical — velocity will be 0 if this fails
  }

  const pendingCount = pending.length;
  const overdueCount = overdue.length;
  const velocity = pendingCount + overdueCount > 0
    ? +(completedToday / (pendingCount + overdueCount + 1)).toFixed(2)
    : 0;

  // Upsert task_metrics
  await supabase.from('task_metrics').upsert({
    user_id: userId,
    date: today,
    pending_count: pendingCount,
    overdue_count: overdueCount,
    completed_today: completedToday,
    velocity,
    completion_rate: velocity,
    pending_titles: urgentTasks,
    provider: 'todoist',
  }, { onConflict: 'user_id,date' });

  // Record sync
  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'todoist',
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced: tasks.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  return { ok: true, tasksProcessed: tasks.length };
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Check if specific user requested
  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    targetUserId = (body['user_id'] as string) ?? null;
  } catch { /* no body */ }

  // Get all users with Todoist connected
  let query = supabase
    .from('oauth_tokens')
    .select('user_id')
    .eq('provider', 'todoist');

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data: tokenUsers } = await query;
  if (!tokenUsers || tokenUsers.length === 0) {
    log('info', 'no_todoist_users');
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  log('info', 'sync_start', { users: tokenUsers.length });

  let synced = 0;
  let errors = 0;

  // Process users (cap at 10 to stay within 50s timeout)
  const batch = tokenUsers.slice(0, 10);
  const results = await Promise.allSettled(
    batch.map(u => syncUserTodoist(supabase, u.user_id))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) synced++;
    else errors++;
  }

  log('info', 'sync_complete', { synced, errors });
  return new Response(JSON.stringify({ synced, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

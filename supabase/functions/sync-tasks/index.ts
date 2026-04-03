/**
 * Waldo — sync-tasks Edge Function
 *
 * Runs nightly at 3:45 AM UTC (pg_cron). Syncs Google Tasks for all users
 * who have connected Google.
 *
 * Computes: task pile-up, completion velocity, overdue count, urgency queue.
 * Writes to: task_metrics table.
 *
 * Privacy rules: task titles may contain sensitive project names.
 * We store task_count and computed scores — NOT individual task titles.
 * Exception: the urgency_queue stores titles for tasks due today/tomorrow (needed by agent).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, recordSync, googleFetch } from '../_shared/google-auth.ts';

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-tasks', level, event, ...data }));
}

interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;           // RFC 3339 (date only for all-day tasks)
  completed?: string;     // RFC 3339
  updated: string;        // RFC 3339
}

interface GoogleTaskList {
  id: string;
  title: string;
}

// ─── Sync tasks for one user ─────────────────────────────────────
async function syncUserTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: boolean; tasksProcessed: number; error?: string }> {
  const token = await getValidGoogleToken(supabase, userId);
  if (!token) {
    await recordSync(supabase, userId, 'google_tasks', 'no_token');
    return { ok: false, tasksProcessed: 0, error: 'no_token' };
  }

  // Get all task lists
  const listsResult = await googleFetch(`${TASKS_API}/users/@me/lists`, token, { maxResults: '20' });
  if (!listsResult.ok) {
    const status = listsResult.status === 401 ? 'token_expired' : 'error';
    await recordSync(supabase, userId, 'google_tasks', status, 0, `Lists API ${listsResult.status}`);
    return { ok: false, tasksProcessed: 0, error: `API ${listsResult.status}` };
  }

  const taskLists: GoogleTaskList[] = ((listsResult.data as { items?: GoogleTaskList[] }).items ?? []);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const allTasks: GoogleTask[] = [];

  // Fetch tasks from all lists (updated in last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await Promise.allSettled(
    taskLists.map(async (list) => {
      const r = await googleFetch(`${TASKS_API}/lists/${list.id}/tasks`, token, {
        updatedMin: since,
        showCompleted: 'true',
        showHidden: 'false',
        maxResults: '200',
        fields: 'items(id,title,status,due,completed,updated)',
      });
      if (r.ok) {
        const tasks = ((r.data as { items?: GoogleTask[] }).items ?? []);
        allTasks.push(...tasks);
      }
    }),
  );

  // ─── Compute today's task_metrics ───────────────────────────
  const pending = allTasks.filter(t => t.status === 'needsAction');
  const completed30d = allTasks.filter(t => t.status === 'completed' && t.completed);

  // Overdue: past due date + not completed
  const overdue = pending.filter(t => t.due && t.due.slice(0, 10) < today);

  // Due today / tomorrow: urgency queue (title stored — user's own task, not PII from external)
  const dueToday = pending.filter(t => t.due?.slice(0, 10) === today);
  const dueTomorrow = pending.filter(t => t.due?.slice(0, 10) === tomorrow);
  const urgencyQueue = [...dueToday, ...dueTomorrow].slice(0, 10).map(t => ({
    title: t.title.slice(0, 100),
    due: t.due?.slice(0, 10),
  }));

  // Completion velocity: tasks completed in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const completedThisWeek = completed30d.filter(t => t.completed && t.completed.slice(0, 10) >= sevenDaysAgo).length;

  // Procrastination index: tasks with due date > 7 days past overdue
  const procrastinationCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const procrastinatedCount = overdue.filter(t => t.due && t.due.slice(0, 10) < procrastinationCutoff).length;
  const procrastinationIndex = pending.length > 0 ? Math.round((procrastinatedCount / pending.length) * 100) / 100 : 0;

  await supabase.from('task_metrics').upsert({
    user_id: userId,
    date: today,
    pending_count: pending.length,
    overdue_count: overdue.length,
    completed_today: completed30d.filter(t => t.completed?.slice(0, 10) === today).length,
    velocity: completedThisWeek / 7,               // tasks/day (matches schema field)
    completion_rate: allTasks.length > 0 ? completedThisWeek / allTasks.length : 0,
    pending_titles: urgencyQueue,                   // schema has pending_titles JSONB
  }, { onConflict: 'user_id,date' });

  await recordSync(supabase, userId, 'google_tasks', 'ok', allTasks.length);
  return { ok: true, tasksProcessed: allTasks.length };
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const startMs = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetUserId: string | null = body.user_id ?? null;

    const query = supabase
      .from('oauth_tokens')
      .select('user_id, users!inner(active)')
      .eq('provider', 'google')
      .eq('users.active', true);
    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: tokenRows, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ synced: 0, reason: 'No users with Google connected' }), { headers: { 'Content-Type': 'application/json' } });
    }

    log('info', 'tasks_sync_start', { user_count: tokenRows.length });

    const results = await Promise.allSettled(
      tokenRows.map(row => syncUserTasks(supabase, row.user_id)),
    );

    let synced = 0;
    for (const r of results) if (r.status === 'fulfilled' && r.value.ok) synced++;

    log('info', 'tasks_sync_complete', { synced, latency_ms: Date.now() - startMs });
    return new Response(JSON.stringify({ synced, latency_ms: Date.now() - startMs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});

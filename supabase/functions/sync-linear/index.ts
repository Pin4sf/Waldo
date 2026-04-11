/**
 * Waldo — sync-linear Edge Function
 *
 * Runs nightly at 4:15 AM UTC (pg_cron). Syncs Linear issues via GraphQL.
 * Computes: pending, overdue, velocity, urgency queue.
 * Writes to: task_metrics (provider='linear').
 *
 * Linear GraphQL API: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const LINEAR_GQL = 'https://api.linear.app/graphql';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-linear', level, event, ...data }));
}

async function linearQuery(token: string, query: string, variables?: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  const resp = await fetch(LINEAR_GQL, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) return { ok: false, data: null };
  const json = await resp.json() as { data: any; errors?: any[] };
  if (json.errors?.length) return { ok: false, data: json.errors };
  return { ok: true, data: json.data };
}

interface LinearIssue {
  id: string;
  title: string;
  state: { name: string; type: string }; // type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  dueDate: string | null;
  priority: number; // 0=none, 1=urgent, 2=high, 3=medium, 4=low
  completedAt: string | null;
}

async function syncUserLinear(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; issues: number; error?: string }> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('user_id', userId).eq('provider', 'linear').maybeSingle();

  if (!tokenRow) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'linear',
      last_sync_status: 'no_token', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, issues: 0, error: 'no_token' };
  }

  const token = tokenRow.access_token;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Fetch assigned issues (active — not completed or canceled)
  const { ok: activeOk, data: activeData } = await linearQuery(token, `
    query {
      viewer {
        assignedIssues(
          filter: { state: { type: { nin: ["completed", "canceled"] } } }
          first: 100
        ) {
          nodes {
            id title
            state { name type }
            dueDate
            priority
          }
        }
      }
    }
  `);

  if (!activeOk) {
    log('error', 'graphql_failed', { userId });
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'linear',
      last_sync_status: 'error', last_error: 'GraphQL query failed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, issues: 0, error: 'graphql_failed' };
  }

  const activeIssues: LinearIssue[] = activeData?.viewer?.assignedIssues?.nodes ?? [];

  // Fetch recently completed issues (today)
  const { ok: completedOk, data: completedData } = await linearQuery(token, `
    query($after: DateTime!) {
      viewer {
        assignedIssues(
          filter: { completedAt: { gte: $after } }
          first: 50
        ) {
          nodes {
            id title completedAt
          }
        }
      }
    }
  `, { after: `${today}T00:00:00.000Z` });

  const completedToday = completedOk
    ? (completedData?.viewer?.assignedIssues?.nodes ?? []).length
    : 0;

  // Compute metrics
  const pending = activeIssues.length;
  const overdue = activeIssues.filter(i => i.dueDate && i.dueDate < today).length;

  // Urgency queue: issues due today/tomorrow, sorted by priority (1=urgent ... 4=low)
  const urgentIssues = activeIssues
    .filter(i => i.dueDate && i.dueDate <= tomorrow)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 10)
    .map(i => i.title);

  // Add high-priority issues even without due date
  const highPriority = activeIssues
    .filter(i => i.priority <= 2 && !urgentIssues.includes(i.title))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5)
    .map(i => `[P${i.priority}] ${i.title}`);

  const allUrgent = [...urgentIssues, ...highPriority].slice(0, 10);

  const velocity = pending + overdue > 0
    ? +(completedToday / (pending + overdue + 1)).toFixed(2)
    : 0;

  await supabase.from('task_metrics').upsert({
    user_id: userId,
    date: today,
    pending_count: pending,
    overdue_count: overdue,
    completed_today: completedToday,
    velocity,
    completion_rate: velocity,
    pending_titles: allUrgent,
    provider: 'linear',
  }, { onConflict: 'user_id,date' });

  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'linear',
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced: activeIssues.length + completedToday,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('info', 'sync_complete', { userId, pending, overdue, completedToday, total: activeIssues.length });
  return { ok: true, issues: activeIssues.length };
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

  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    targetUserId = (body['user_id'] as string) ?? null;
  } catch { /* no body */ }

  let query = supabase.from('oauth_tokens').select('user_id').eq('provider', 'linear');
  if (targetUserId) query = query.eq('user_id', targetUserId);

  const { data: tokenUsers } = await query;
  if (!tokenUsers || tokenUsers.length === 0) {
    return new Response(JSON.stringify({ synced: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  let synced = 0, errors = 0;
  const results = await Promise.allSettled(
    tokenUsers.slice(0, 10).map(u => syncUserLinear(supabase, u.user_id))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) synced++;
    else errors++;
  }

  return new Response(JSON.stringify({ synced, errors }), { headers: { 'Content-Type': 'application/json' } });
});

/**
 * Waldo — sync-notion Edge Function
 *
 * Runs nightly at 4:10 AM UTC (pg_cron). Syncs Notion databases that look
 * like task boards (have Status/Due/Priority properties).
 *
 * Computes: pending, overdue, completed, velocity. Writes to task_metrics.
 * Notion tokens don't expire — no refresh logic needed.
 *
 * Challenge: Notion databases have user-defined schemas. We use heuristics
 * to detect task-like databases and extract relevant metrics.
 *
 * Notion API: https://developers.notion.com/reference
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-notion', level, event, ...data }));
}

async function notionFetch(path: string, token: string, body?: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  const resp = await fetch(`${NOTION_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) return { ok: false, data: null };
  return { ok: true, data: await resp.json() };
}

// Heuristics to detect task-like properties
const STATUS_NAMES = ['status', 'state', 'stage', 'progress', 'done'];
const DUE_NAMES = ['due', 'due date', 'deadline', 'date', 'target date'];
const DONE_VALUES = ['done', 'complete', 'completed', 'finished', 'closed', 'resolved'];

function findProperty(properties: Record<string, any>, names: string[]): [string, any] | null {
  for (const [key, prop] of Object.entries(properties)) {
    if (names.some(n => key.toLowerCase().includes(n))) return [key, prop];
  }
  return null;
}

async function syncUserNotion(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; tasks: number; error?: string }> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('user_id', userId).eq('provider', 'notion').maybeSingle();

  if (!tokenRow) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'notion',
      last_sync_status: 'no_token', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, tasks: 0, error: 'no_token' };
  }

  const token = tokenRow.access_token;
  const today = new Date().toISOString().slice(0, 10);

  // Search for databases the user shared with the integration
  const { ok: searchOk, data: searchData } = await notionFetch('/search', token, {
    filter: { property: 'object', value: 'database' },
    page_size: 10,
  });

  if (!searchOk || !searchData?.results) {
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'notion',
      last_sync_status: 'error', last_error: 'Search failed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: false, tasks: 0, error: 'search_failed' };
  }

  let totalPending = 0;
  let totalOverdue = 0;
  let totalCompleted = 0;
  const urgentTitles: string[] = [];
  let taskDbFound = false;

  for (const db of searchData.results) {
    const properties = db.properties ?? {};

    // Check if this looks like a task database
    const statusProp = findProperty(properties, STATUS_NAMES);
    if (!statusProp) continue; // Not a task database

    taskDbFound = true;
    const dueProp = findProperty(properties, DUE_NAMES);

    // Query all pages from this database
    const { ok: queryOk, data: pages } = await notionFetch(`/databases/${db.id}/query`, token, {
      page_size: 100,
    });

    if (!queryOk || !pages?.results) continue;

    for (const page of pages.results) {
      const props = page.properties ?? {};
      const statusVal = props[statusProp[0]];
      const dueVal = dueProp ? props[dueProp[0]] : null;

      // Determine status
      let isDone = false;
      if (statusVal?.status?.name) {
        isDone = DONE_VALUES.includes(statusVal.status.name.toLowerCase());
      } else if (statusVal?.checkbox !== undefined) {
        isDone = statusVal.checkbox === true;
      } else if (statusVal?.select?.name) {
        isDone = DONE_VALUES.includes(statusVal.select.name.toLowerCase());
      }

      // Determine due date
      let dueDate: string | null = null;
      if (dueVal?.date?.start) {
        dueDate = dueVal.date.start.slice(0, 10);
      }

      // Get title
      let title = 'Untitled';
      for (const [, prop] of Object.entries(props)) {
        const p = prop as any;
        if (p.type === 'title' && p.title?.[0]?.plain_text) {
          title = p.title[0].plain_text;
          break;
        }
      }

      if (isDone) {
        // Check if completed today (using last_edited_time as proxy)
        if (page.last_edited_time?.startsWith(today)) {
          totalCompleted++;
        }
      } else {
        totalPending++;
        if (dueDate && dueDate < today) totalOverdue++;
        if (dueDate && (dueDate === today || dueDate <= new Date(Date.now() + 86400000).toISOString().slice(0, 10))) {
          urgentTitles.push(title);
        }
      }
    }
  }

  if (!taskDbFound) {
    log('info', 'no_task_databases', { userId });
    await supabase.from('sync_log').upsert({
      user_id: userId, provider: 'notion',
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok', last_error: 'No task databases found',
      records_synced: 0, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    return { ok: true, tasks: 0 };
  }

  const velocity = totalPending + totalOverdue > 0
    ? +(totalCompleted / (totalPending + totalOverdue + 1)).toFixed(2)
    : 0;

  await supabase.from('task_metrics').upsert({
    user_id: userId,
    date: today,
    pending_count: totalPending,
    overdue_count: totalOverdue,
    completed_today: totalCompleted,
    velocity,
    completion_rate: velocity,
    pending_titles: urgentTitles.slice(0, 10),
    provider: 'notion',
  }, { onConflict: 'user_id,date' });

  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'notion',
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'ok',
    records_synced: totalPending + totalCompleted,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('info', 'sync_complete', { userId, pending: totalPending, overdue: totalOverdue, completed: totalCompleted });
  return { ok: true, tasks: totalPending + totalCompleted };
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

  let query = supabase.from('oauth_tokens').select('user_id').eq('provider', 'notion');
  if (targetUserId) query = query.eq('user_id', targetUserId);

  const { data: tokenUsers } = await query;
  if (!tokenUsers || tokenUsers.length === 0) {
    return new Response(JSON.stringify({ synced: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  let synced = 0, errors = 0;
  const results = await Promise.allSettled(
    tokenUsers.slice(0, 10).map(u => syncUserNotion(supabase, u.user_id))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) synced++;
    else errors++;
  }

  return new Response(JSON.stringify({ synced, errors }), { headers: { 'Content-Type': 'application/json' } });
});

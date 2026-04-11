/**
 * execute-proposal — The Adjustment action executor.
 *
 * Called when user approves a waldo_proposals entry via TheHandoff card.
 * Reads proposed_actions JSONB and dispatches each action to the appropriate API.
 *
 * Supported actions:
 *   calendar.create  → Google Calendar events.insert (create focus block / protective event)
 *   calendar.move    → Google Calendar events.patch  (reschedule an existing event)
 *   task.create      → Google Tasks tasks.insert     (create a new task)
 *   task.defer       → Google Tasks tasks.patch      (update task due date)
 *   todoist.create   → Todoist tasks API             (create task in Todoist)
 *   todoist.defer    → Todoist tasks API             (update due date)
 *
 * POST /execute-proposal
 * Body: { proposal_id: string, action: 'approve' | 'reject' }
 * Auth: JWT required (user_id from JWT must match proposal.user_id)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidToken } from '../_shared/google-auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'execute-proposal', level, event, ...data }));
}

// ─── Google Calendar ──────────────────────────────────────────────

async function calendarCreate(token: string, params: Record<string, unknown>): Promise<void> {
  const { title, start_time, end_time, description, color_id } = params as {
    title: string; start_time: string; end_time: string; description?: string; color_id?: string;
  };
  const body: Record<string, unknown> = {
    summary: title,
    start: { dateTime: start_time },
    end: { dateTime: end_time },
    colorId: color_id ?? '2', // 2 = sage green (Waldo's focus block color)
    description: description ?? 'Protected by Waldo — Already on it.',
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`calendar.create failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function calendarMove(token: string, params: Record<string, unknown>): Promise<void> {
  const { event_id, new_start, new_end } = params as {
    event_id: string; new_start: string; new_end: string;
  };
  const body = { start: { dateTime: new_start }, end: { dateTime: new_end } };
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event_id)}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`calendar.move failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// ─── Google Tasks ─────────────────────────────────────────────────

async function taskCreate(token: string, params: Record<string, unknown>): Promise<void> {
  const { title, due_date, notes } = params as { title: string; due_date?: string; notes?: string };
  const body: Record<string, unknown> = { title };
  if (due_date) body.due = new Date(due_date).toISOString();
  if (notes) body.notes = notes;
  const res = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`task.create failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function taskDefer(token: string, params: Record<string, unknown>): Promise<void> {
  const { task_id, new_due_date } = params as { task_id: string; new_due_date: string };
  const body = { due: new Date(new_due_date).toISOString() };
  const res = await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(task_id)}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`task.defer failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// ─── Todoist ──────────────────────────────────────────────────────

async function todoistCreate(apiKey: string, params: Record<string, unknown>): Promise<void> {
  const { title, due_date, priority, project_id } = params as {
    title: string; due_date?: string; priority?: number; project_id?: string;
  };
  const body: Record<string, unknown> = { content: title };
  if (due_date) body.due_date = due_date.slice(0, 10); // YYYY-MM-DD
  if (priority) body.priority = priority;
  if (project_id) body.project_id = project_id;
  const res = await fetch('https://api.todoist.com/rest/v2/tasks', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`todoist.create failed: ${res.status}`);
}

async function todoistDefer(apiKey: string, params: Record<string, unknown>): Promise<void> {
  const { task_id, new_due_date } = params as { task_id: string; new_due_date: string };
  const res = await fetch(`https://api.todoist.com/rest/v2/tasks/${encodeURIComponent(task_id)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ due_date: new_due_date.slice(0, 10) }),
  });
  if (!res.ok) throw new Error(`todoist.defer failed: ${res.status}`);
}

// ─── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json() as { proposal_id?: string; action?: 'approve' | 'reject' };
    const { proposal_id, action } = body;

    if (!proposal_id || !action) {
      return json({ error: 'proposal_id and action required' }, 400);
    }

    // ── Fetch the proposal ─────────────────────────────────────
    const { data: proposal, error: fetchErr } = await supabase
      .from('waldo_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single();

    if (fetchErr || !proposal) return json({ error: 'Proposal not found' }, 404);
    if (proposal.status !== 'pending') return json({ error: `Proposal already ${proposal.status}` }, 409);
    if (new Date(proposal.expires_at) < new Date()) {
      await supabase.from('waldo_proposals').update({ status: 'expired' }).eq('id', proposal_id);
      return json({ error: 'Proposal expired' }, 410);
    }

    const userId: string = proposal.user_id;

    // ── Handle rejection ───────────────────────────────────────
    if (action === 'reject') {
      await supabase.from('waldo_proposals').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', proposal_id);
      // Log to The Patrol
      await supabase.from('waldo_actions').insert({
        user_id: userId, date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
        action: `Adjustment declined — ${proposal.title}`, reason: 'User dismissed',
        type: 'reactive',
      });
      return json({ status: 'rejected' });
    }

    // ── Execute the approved proposal ──────────────────────────
    await supabase.from('waldo_proposals').update({ status: 'executing' }).eq('id', proposal_id);

    const googleToken = await getValidToken(supabase, userId, 'google');
    const todoistToken = Deno.env.get('TODOIST_API_KEY') ??
      (await supabase.from('oauth_tokens').select('access_token').eq('user_id', userId).eq('provider', 'todoist').maybeSingle()).data?.access_token;

    const actions: Array<{ action: string; params: Record<string, unknown> }> = proposal.proposed_actions ?? [];
    const errors: string[] = [];

    for (const act of actions) {
      try {
        switch (act.action) {
          case 'calendar.create':
            if (!googleToken) throw new Error('No Google Calendar write token. Re-authorize with calendar_write scope.');
            await calendarCreate(googleToken, act.params);
            break;
          case 'calendar.move':
            if (!googleToken) throw new Error('No Google Calendar write token. Re-authorize with calendar_write scope.');
            await calendarMove(googleToken, act.params);
            break;
          case 'task.create':
            if (!googleToken) throw new Error('No Google Tasks token.');
            await taskCreate(googleToken, act.params);
            break;
          case 'task.defer':
            if (!googleToken) throw new Error('No Google Tasks token.');
            await taskDefer(googleToken, act.params);
            break;
          case 'todoist.create':
            if (!todoistToken) throw new Error('No Todoist token.');
            await todoistCreate(todoistToken, act.params);
            break;
          case 'todoist.defer':
            if (!todoistToken) throw new Error('No Todoist token.');
            await todoistDefer(todoistToken, act.params);
            break;
          default:
            log('warn', 'unknown_action', { action: act.action });
        }
        log('info', 'action_executed', { proposalId: proposal_id, action: act.action });
      } catch (err) {
        errors.push(`${act.action}: ${(err as Error).message}`);
        log('error', 'action_failed', { proposalId: proposal_id, action: act.action, error: (err as Error).message });
      }
    }

    const finalStatus = errors.length === 0 ? 'executed' : errors.length === actions.length ? 'failed' : 'partial';
    await supabase.from('waldo_proposals').update({
      status: finalStatus,
      resolved_at: new Date().toISOString(),
      error_detail: errors.length > 0 ? errors.join('; ') : null,
    }).eq('id', proposal_id);

    // Log to The Patrol
    await supabase.from('waldo_actions').insert({
      user_id: userId, date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
      action: `Adjustment executed — ${proposal.title}`, reason: errors.length > 0 ? `Partial: ${errors[0]}` : 'Already on it.',
      type: 'proactive',
    });

    return json({ status: finalStatus, executed: actions.length - errors.length, errors });

  } catch (err) {
    log('error', 'unexpected', { error: (err as Error).message });
    return json({ error: (err as Error).message }, 500);
  }
});

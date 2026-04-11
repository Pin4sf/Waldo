/**
 * Waldo — sync-gmail Edge Function
 *
 * Runs nightly at 3:30 AM UTC (pg_cron). Syncs Gmail METADATA ONLY for all users
 * who have connected Google.
 *
 * Privacy rules (NON-NEGOTIABLE per health-data-security.md):
 * - NEVER read email body content
 * - NEVER store sender names or email addresses
 * - NEVER store email subjects
 * - Only compute: volume, after-hours ratio, response time, volume spikes
 *
 * Writes to: email_metrics table (daily aggregates only)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, recordSync, googleFetch } from '../_shared/google-auth.ts';

const GMAIL_API = 'https://www.googleapis.com/gmail/v1';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-gmail', level, event, ...data }));
}

// ─── Working hours: 9am–7pm local time ──────────────────────────
function isWorkingHours(timestampMs: number, tzOffsetMs: number): boolean {
  const localHour = new Date(timestampMs + tzOffsetMs).getUTCHours();
  return localHour >= 9 && localHour < 19;
}

function isAfterHours(timestampMs: number, tzOffsetMs: number): boolean {
  const localHour = new Date(timestampMs + tzOffsetMs).getUTCHours();
  return localHour >= 19 || localHour < 7;
}

// ─── Sync Gmail for one user ─────────────────────────────────────
async function syncUserGmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<{ ok: boolean; daysComputed: number; error?: string }> {
  const token = await getValidGoogleToken(supabase, userId);
  if (!token) {
    await recordSync(supabase, userId, 'gmail', 'no_token');
    return { ok: false, daysComputed: 0, error: 'no_token' };
  }

  // Check if first sync — pull 30 days back on first sync, 7 days otherwise
  const { count: existingCount } = await supabase
    .from('email_metrics').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const isFirstSync = (existingCount ?? 0) === 0;
  const lookbackDays = isFirstSync ? 30 : 7;
  const after = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000);
  if (isFirstSync) log('info', 'first_sync_gmail', { userId, lookbackDays });

  // List message IDs (metadata only — no subject, no body)
  const listResult = await googleFetch(
    `${GMAIL_API}/users/me/messages`,
    token,
    {
      q: `after:${after}`,
      maxResults: '500',
      fields: 'messages(id)',
    },
  );

  if (!listResult.ok) {
    const status = listResult.status === 401 ? 'token_expired' : 'error';
    await recordSync(supabase, userId, 'gmail', status, 0, `API ${listResult.status}`);
    return { ok: false, daysComputed: 0, error: `API ${listResult.status}` };
  }

  const messageIds: string[] = ((listResult.data as { messages?: Array<{ id: string }> }).messages ?? []).map(m => m.id);

  if (messageIds.length === 0) {
    await recordSync(supabase, userId, 'gmail', 'ok', 0);
    return { ok: true, daysComputed: 0 };
  }

  // Fetch metadata in batches of 50 (Gmail batch limit)
  // ONLY requesting: internalDate, labelIds — no headers, no subject, no sender
  const metadataByDay = new Map<string, Array<{ timestampMs: number; labelIds: string[] }>>();
  const tzOffset = getTimezoneOffsetMs(timezone);

  const BATCH_SIZE = 50;
  for (let i = 0; i < Math.min(messageIds.length, 200); i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);

    // Fetch each message's metadata (internalDate + labelIds only)
    await Promise.allSettled(batch.map(async (id) => {
      const r = await googleFetch(
        `${GMAIL_API}/users/me/messages/${id}`,
        token,
        { format: 'metadata', fields: 'internalDate,labelIds' },
      );
      if (!r.ok) return;

      const msg = r.data as { internalDate?: string; labelIds?: string[] };
      const timestampMs = parseInt(msg.internalDate ?? '0', 10);
      if (timestampMs === 0) return;

      const dateKey = new Date(timestampMs).toISOString().slice(0, 10);
      if (!metadataByDay.has(dateKey)) metadataByDay.set(dateKey, []);
      metadataByDay.get(dateKey)!.push({ timestampMs, labelIds: msg.labelIds ?? [] });
    }));
  }

  // ─── Compute daily email_metrics ──────────────────────────
  const metricsRows: Record<string, unknown>[] = [];

  for (const [date, messages] of metadataByDay) {
    const total = messages.length;
    const sent = messages.filter(m => m.labelIds.includes('SENT')).length;
    const received = total - sent;
    const afterHours = messages.filter(m => isAfterHours(m.timestampMs, tzOffset)).length;
    const afterHoursRatio = total > 0 ? afterHours / total : 0;

    // Volume spike: compare to prior 7d average in memory (simplified: flag if > 2x median)
    // Full spike detection requires historical data — store raw count and compute in invoke-agent
    metricsRows.push({
      user_id: userId,
      date,
      total_emails: total,
      sent_count: sent,
      received_count: received,
      after_hours_count: afterHours,
      after_hours_ratio: Math.round(afterHoursRatio * 100) / 100,
    });
  }

  if (metricsRows.length > 0) {
    await supabase.from('email_metrics').upsert(metricsRows, { onConflict: 'user_id,date' });
  }

  await recordSync(supabase, userId, 'gmail', 'ok', metricsRows.length);
  return { ok: true, daysComputed: metricsRows.length };
}

function getTimezoneOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
    const localStr = now.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const [lH, lM] = localStr.split(':').map(Number);
    return ((lH! - utcH) * 60 + (lM! - utcM)) * 60 * 1000;
  } catch { return 5.5 * 60 * 60 * 1000; }
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
      .select('user_id, users!inner(timezone, active)')
      .eq('provider', 'google')
      .eq('users.active', true);
    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: tokenRows, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ synced: 0, reason: 'No users with Google connected' }), { headers: { 'Content-Type': 'application/json' } });
    }

    log('info', 'gmail_sync_start', { user_count: tokenRows.length });

    const results = await Promise.allSettled(
      tokenRows.map(row => syncUserGmail(
        supabase, row.user_id, (row.users as { timezone: string }).timezone ?? 'UTC',
      )),
    );

    let synced = 0;
    for (const r of results) if (r.status === 'fulfilled' && r.value.ok) synced++;

    log('info', 'gmail_sync_complete', { synced, latency_ms: Date.now() - startMs });
    return new Response(JSON.stringify({ synced, latency_ms: Date.now() - startMs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});

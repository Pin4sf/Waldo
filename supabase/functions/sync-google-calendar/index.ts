/**
 * Waldo — sync-google-calendar Edge Function
 *
 * Runs every 30 min (pg_cron). Syncs Google Calendar events for all users
 * who have connected Google. Computes calendar_metrics (MLS, focus gaps, etc.)
 * and stores in calendar_events + calendar_metrics tables.
 *
 * Syncs: yesterday + today + next 7 days (rolling window — enough for Morning Wag context)
 *
 * POST /sync-google-calendar
 *   body: { user_id?: string }  — omit to sync all users
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, recordSync, googleFetch } from '../_shared/google-auth.ts';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST as default — user timezone used when available

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-google-calendar', level, event, ...data }));
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; responseStatus?: string }>;
  recurrence?: string[];
  location?: string;
  status?: string;
  transparency?: string;
}

// ─── MLS computation (mirrors calendar-parser.ts logic) ─────────
function computeMLS(events: Array<{
  startMs: number; endMs: number; durationMinutes: number;
  attendeeCount: number; isFree: boolean;
}>, userTimezoneOffset = IST_OFFSET_MS): number {
  const busy = events.filter(e => !e.isFree);
  if (busy.length === 0) return 0;

  const sorted = [...busy].sort((a, b) => a.startMs - b.startMs);
  let mls = 0;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const durationFactor = ev.durationMinutes / 30;

    let adjacencyFactor = 1.0;
    if (i > 0) {
      const gap = (ev.startMs - sorted[i - 1]!.endMs) / 60000;
      if (gap < 5) adjacencyFactor = 1.8;
      else if (gap < 15) adjacencyFactor = 1.4;
    }

    const attendeeFactor = 1.0 + 0.05 * Math.max(ev.attendeeCount - 3, 0);
    const localHour = new Date(ev.startMs + userTimezoneOffset).getUTCHours();
    const timeFactor = localHour >= 8 && localHour < 12 ? 0.8
      : localHour >= 13 && localHour < 15 ? 1.2
      : localHour >= 18 ? 1.1
      : 1.0;

    mls += durationFactor * adjacencyFactor * attendeeFactor * timeFactor;
  }

  return Math.round(mls * 10) / 10;
}

// ─── Compute focus gaps (>= 45 min blocks of free time 8am–7pm) ─
function computeFocusGaps(
  events: Array<{ startMs: number; endMs: number; isFree: boolean }>,
  dateStr: string,
  userTimezoneOffset = IST_OFFSET_MS,
): Array<{ start: string; end: string; durationMinutes: number; quality: number }> {
  const dayStart = new Date(`${dateStr}T08:00:00Z`).getTime() - userTimezoneOffset;
  const dayEnd = new Date(`${dateStr}T19:00:00Z`).getTime() - userTimezoneOffset;

  const busy = events
    .filter(e => !e.isFree && e.startMs < dayEnd && e.endMs > dayStart)
    .sort((a, b) => a.startMs - b.startMs);

  const gaps: Array<{ start: string; end: string; durationMinutes: number; quality: number }> = [];
  let cursor = dayStart;

  for (const ev of busy) {
    const gapEnd = Math.min(ev.startMs, dayEnd);
    const gapDuration = (gapEnd - cursor) / 60000;
    if (gapDuration >= 45) {
      const quality = gapDuration >= 120 ? 3 : gapDuration >= 90 ? 2 : 1;
      gaps.push({
        start: new Date(cursor).toISOString(),
        end: new Date(gapEnd).toISOString(),
        durationMinutes: Math.round(gapDuration),
        quality,
      });
    }
    cursor = Math.max(cursor, ev.endMs);
  }

  const trailingGap = (dayEnd - cursor) / 60000;
  if (trailingGap >= 45) {
    gaps.push({
      start: new Date(cursor).toISOString(),
      end: new Date(dayEnd).toISOString(),
      durationMinutes: Math.round(trailingGap),
      quality: trailingGap >= 120 ? 3 : trailingGap >= 90 ? 2 : 1,
    });
  }

  return gaps;
}

// ─── Sync calendar for one user ──────────────────────────────────
async function syncUserCalendar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  backfill = false,
): Promise<{ ok: boolean; eventsInserted: number; daysComputed: number; error?: string }> {
  const token = await getValidGoogleToken(supabase, userId);
  if (!token) {
    await recordSync(supabase, userId, 'google_calendar', 'no_token');
    return { ok: false, eventsInserted: 0, daysComputed: 0, error: 'no_token' };
  }

  // Backfill: fetch full history (no timeMin); Daily sync: yesterday → +7 days
  const timeMin = backfill ? undefined : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Paginate to get all events (Google Calendar returns nextPageToken for > 250 events)
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500',
      fields: 'items(id,summary,start,end,attendees,recurrence,location,status,transparency),nextPageToken',
      timeMax,
    };
    if (timeMin) params['timeMin'] = timeMin;
    if (pageToken) params['pageToken'] = pageToken;

    const result = await googleFetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, token, params);

    if (!result.ok) {
      const status = result.status === 401 ? 'token_expired' : 'error';
      await recordSync(supabase, userId, 'google_calendar', status, 0, `API error ${result.status}`);
      return { ok: false, eventsInserted: 0, daysComputed: 0, error: `API ${result.status}` };
    }

    const page = result.data as { items?: GoogleEvent[]; nextPageToken?: string };
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  // ─── Group events by date and compute metrics ──────────────
  const byDate = new Map<string, GoogleEvent[]>();
  const tzOffset = getTimezoneOffsetMs(timezone);

  for (const ev of events) {
    const startStr = ev.start.dateTime ?? ev.start.date;
    if (!startStr || ev.status === 'cancelled') continue;
    const dateKey = new Date(startStr).toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(ev);
  }

  const eventRows: Record<string, unknown>[] = [];
  const metricsRows: Record<string, unknown>[] = [];

  for (const [date, dayEvents] of byDate) {
    const processed = dayEvents.map(ev => {
      const startMs = new Date(ev.start.dateTime ?? `${ev.start.date}T00:00:00Z`).getTime();
      const endMs = new Date(ev.end.dateTime ?? `${ev.end.date}T00:00:00Z`).getTime();
      return {
        startMs,
        endMs,
        durationMinutes: Math.round((endMs - startMs) / 60000),
        attendeeCount: ev.attendees?.length ?? 0,
        isFree: ev.transparency === 'transparent',
      };
    });

    const busyEvents = processed.filter(e => !e.isFree);
    let backToBack = 0;
    const sorted = [...busyEvents].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i]!.startMs - sorted[i - 1]!.endMs) < 5 * 60 * 1000) backToBack++;
    }

    // Boundary violations (outside 8am–7pm local)
    const boundary = busyEvents.filter(e => {
      const h = new Date(e.startMs + tzOffset).getUTCHours();
      return h < 8 || h >= 19;
    }).length;

    const mls = computeMLS(processed, tzOffset);
    const totalMeetingMinutes = busyEvents.reduce((s, e) => s + e.durationMinutes, 0);
    const focusGaps = computeFocusGaps(processed, date, tzOffset);

    metricsRows.push({
      user_id: userId,
      date,
      meeting_load_score: mls,
      event_count: busyEvents.length,
      total_meeting_minutes: totalMeetingMinutes,
      back_to_back_count: backToBack,
      boundary_violations: boundary,
      focus_gaps: focusGaps,
    });

    for (const ev of dayEvents) {
      if (ev.status === 'cancelled') continue;
      const startMs = new Date(ev.start.dateTime ?? `${ev.start.date}T00:00:00Z`).getTime();
      const endMs = new Date(ev.end.dateTime ?? `${ev.end.date}T00:00:00Z`).getTime();
      eventRows.push({
        user_id: userId,
        date,
        summary: (ev.summary ?? 'Untitled').slice(0, 200), // never log full titles (may contain PII)
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        duration_minutes: Math.round((endMs - startMs) / 60000),
        attendee_count: ev.attendees?.length ?? 0,
        is_recurring: Array.isArray(ev.recurrence) && ev.recurrence.length > 0,
        location: ev.location?.slice(0, 100) ?? null,
      });
    }
  }

  // Batch upsert
  let inserted = 0;
  if (eventRows.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < eventRows.length; i += BATCH) {
      const { error } = await supabase.from('calendar_events').upsert(eventRows.slice(i, i + BATCH), { onConflict: 'user_id,start_time' });
      if (!error) inserted += Math.min(BATCH, eventRows.length - i);
    }
  }
  if (metricsRows.length > 0) {
    await supabase.from('calendar_metrics').upsert(metricsRows, { onConflict: 'user_id,date' });
  }

  await recordSync(supabase, userId, 'google_calendar', 'ok', inserted);
  return { ok: true, eventsInserted: inserted, daysComputed: byDate.size };
}

function getTimezoneOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString('en-CA', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
    const localStr = now.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const [utcH, utcM] = utcStr.split(':').map(Number);
    const [localH, localM] = localStr.split(':').map(Number);
    return ((localH! - utcH!) * 60 + (localM! - utcM!)) * 60 * 1000;
  } catch {
    return IST_OFFSET_MS;
  }
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
    const backfill: boolean = body.backfill === true;

    // Get users who have Google tokens
    const query = supabase
      .from('oauth_tokens')
      .select('user_id, users!inner(timezone, active)')
      .eq('provider', 'google')
      .eq('users.active', true);

    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: tokenRows, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ synced: 0, reason: 'No users with Google connected' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log('info', 'calendar_sync_start', { user_count: tokenRows.length });

    const results = await Promise.allSettled(
      tokenRows.map(row => syncUserCalendar(
        supabase,
        row.user_id,
        (row.users as { timezone: string }).timezone ?? 'UTC',
        backfill,
      )),
    );

    let synced = 0, totalEvents = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        synced++;
        totalEvents += r.value.eventsInserted;
      }
    }

    log('info', 'calendar_sync_complete', { synced, total_events: totalEvents, latency_ms: Date.now() - startMs });

    return new Response(JSON.stringify({ synced, total_events: totalEvents, latency_ms: Date.now() - startMs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});

/**
 * Remote Supabase queries for the Waldo mobile app.
 * All queries are user-scoped via the waldo_user_id() RPC.
 * Never logs health values — only event types, counts, and error codes.
 */
import { supabase, getWaldoUserId } from './supabase-client';

const today = () => new Date().toISOString().slice(0, 10);

// ─── Day Activity (morning wag, evening review, spots) ──────────

export interface DayActivityData {
  morningWag: string | null;
  eveningReview: string | null;
  spots: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    detail: string;
  }>;
}

export async function fetchTodayActivity(): Promise<DayActivityData | null> {
  const userId = await getWaldoUserId();
  if (!userId) return null;

  const { data } = await supabase
    .from('day_activity')
    .select('morning_wag, evening_review, spots_json')
    .eq('user_id', userId)
    .eq('date', today())
    .maybeSingle();

  if (!data) return null;
  return {
    morningWag: data.morning_wag ?? null,
    eveningReview: data.evening_review ?? null,
    spots: (data.spots_json ?? []).slice(0, 5), // Cap at 5 for mobile
  };
}

// ─── Calendar / Email / Tasks (productivity context) ─────────────

export interface ProductivityContext {
  meetingLoadScore: number | null;
  eventCount: number | null;
  totalEmails: number | null;
  afterHoursRatio: number | null;
  pendingTasks: number | null;
  overdueTasks: number | null;
}

export async function fetchTodayProductivity(): Promise<ProductivityContext> {
  const userId = await getWaldoUserId();
  if (!userId) return { meetingLoadScore: null, eventCount: null, totalEmails: null, afterHoursRatio: null, pendingTasks: null, overdueTasks: null };

  const [{ data: cal }, { data: email }, { data: tasks }] = await Promise.all([
    supabase.from('calendar_metrics').select('meeting_load_score, event_count').eq('user_id', userId).eq('date', today()).maybeSingle(),
    supabase.from('email_metrics').select('total_emails, after_hours_ratio').eq('user_id', userId).eq('date', today()).maybeSingle(),
    supabase.from('task_metrics').select('pending_tasks, overdue_tasks').eq('user_id', userId).eq('date', today()).maybeSingle(),
  ]);

  return {
    meetingLoadScore: cal?.meeting_load_score ?? null,
    eventCount: cal?.event_count ?? null,
    totalEmails: email?.total_emails ?? null,
    afterHoursRatio: email?.after_hours_ratio ?? null,
    pendingTasks: tasks?.pending_tasks ?? null,
    overdueTasks: tasks?.overdue_tasks ?? null,
  };
}

// ─── Sync status ──────────────────────────────────────────────────

export interface SyncSummary {
  googleConnected: boolean;
  calendarLastSync: string | null;
  gmailLastSync: string | null;
}

export async function fetchSyncSummary(): Promise<SyncSummary> {
  const userId = await getWaldoUserId();
  if (!userId) return { googleConnected: false, calendarLastSync: null, gmailLastSync: null };

  const [{ data: token }, { data: logs }] = await Promise.all([
    supabase.from('oauth_tokens').select('id').eq('user_id', userId).eq('provider', 'google').maybeSingle(),
    supabase.from('sync_log').select('provider, last_sync_at, last_sync_status').eq('user_id', userId),
  ]);

  const calLog = (logs ?? []).find((l: any) => l.provider === 'google_calendar');
  const gmailLog = (logs ?? []).find((l: any) => l.provider === 'gmail');

  return {
    googleConnected: token !== null,
    calendarLastSync: calLog?.last_sync_at ?? null,
    gmailLastSync: gmailLog?.last_sync_at ?? null,
  };
}

// ─── Conversation history ─────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'waldo';
  content: string;
  mode: string | null;
  createdAt: string;
}

export async function fetchConversationHistory(limit = 30): Promise<ChatMessage[]> {
  const userId = await getWaldoUserId();
  if (!userId) return [];

  const { data } = await supabase
    .from('conversation_history')
    .select('id, role, content, mode, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse().map((m: any) => ({
    id: m.id,
    role: m.role as 'user' | 'waldo',
    content: m.content,
    mode: m.mode,
    createdAt: m.created_at,
  }));
}

// ─── Send message to Waldo ────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface WaldoReply {
  message: string;
  zone: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  method: string;
}

export async function sendMessageToWaldo(question: string): Promise<WaldoReply | null> {
  const userId = await getWaldoUserId();
  if (!userId) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/invoke-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      user_id: userId,
      trigger_type: 'conversational',
      question,
      channel: 'mobile',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.message) return null;

  return {
    message: data.message,
    zone: data.zone ?? 'moderate',
    tokensIn: data.tokens_in ?? 0,
    tokensOut: data.tokens_out ?? 0,
    latencyMs: data.latency_ms ?? 0,
    method: data.method ?? 'claude',
  };
}

// ─── Spots (recent observations) ──────────────────────────────────

export interface SpotItem {
  id: string;
  date: string;
  type: string;
  severity: string;
  title: string;
  detail: string;
}

export async function fetchRecentSpots(days = 14): Promise<SpotItem[]> {
  const userId = await getWaldoUserId();
  if (!userId) return [];

  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('spots')
    .select('id, date, type, severity, title, detail')
    .eq('user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(50);

  return (data ?? []).map((s: any) => ({
    id: s.id, date: s.date, type: s.type,
    severity: s.severity, title: s.title, detail: s.detail,
  }));
}

// ─── Patterns ─────────────────────────────────────────────────────

export interface PatternItem {
  id: string;
  type: string;
  confidence: number;
  summary: string;
  evidenceCount: number;
}

export async function fetchPatterns(): Promise<PatternItem[]> {
  const userId = await getWaldoUserId();
  if (!userId) return [];

  const { data } = await supabase
    .from('patterns')
    .select('id, type, confidence, summary, evidence_count')
    .eq('user_id', userId)
    .order('evidence_count', { ascending: false })
    .limit(20);

  return (data ?? []).map((p: any) => ({
    id: p.id, type: p.type,
    confidence: typeof p.confidence === 'number' ? p.confidence : parseFloat(p.confidence) ?? 0,
    summary: p.summary,
    evidenceCount: p.evidence_count ?? 0,
  }));
}

// ─── User profile ─────────────────────────────────────────────────

export interface WaldoUserProfile {
  name: string;
  timezone: string;
  wakeTimeEstimate: string;
  preferredEveningTime: string;
  wearableType: string;
  telegramLinked: boolean;
  lastHealthSync: string | null;
}

export async function fetchWaldoProfile(): Promise<WaldoUserProfile | null> {
  const userId = await getWaldoUserId();
  if (!userId) return null;

  const { data } = await supabase
    .from('users')
    .select('name, timezone, wake_time_estimate, preferred_evening_time, wearable_type, telegram_chat_id, last_health_sync')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return null;
  return {
    name: data.name ?? 'User',
    timezone: data.timezone ?? 'UTC',
    wakeTimeEstimate: data.wake_time_estimate ?? '07:00',
    preferredEveningTime: data.preferred_evening_time ?? '21:00',
    wearableType: data.wearable_type ?? 'unknown',
    telegramLinked: data.telegram_chat_id !== null,
    lastHealthSync: data.last_health_sync ?? null,
  };
}

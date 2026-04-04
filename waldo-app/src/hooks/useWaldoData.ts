/**
 * Waldo data hooks — all Supabase queries for the mobile app.
 * Ported from waldo-dev-review and wired to the production Supabase schema.
 */
import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  supabase, AGENT_URL, DEMO_USER_ID, getActiveUserId,
  fetchSyncStatus, fetchWaldoProfile, fetchCoreMemory, fetchRecentAgentLogs,
  type SyncStatusEntry, type WaldoProfile, type MemoryEntry, type AgentLogSummary,
} from '@/lib/supabase';

let Haptics: { impactAsync: (style: number) => Promise<void> } | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }
function haptic(style: number = 0) { Haptics?.impactAsync(style).catch(() => {}); }

// ─── Types ───────────────────────────────────────────────────────

export interface DateInfo { date: string; score: number; zone: Zone; hasSleep: boolean; hasHrv: boolean }
export interface Spot      { id: string; title: string; body: string; type: 'insight' | 'alert' | 'behaviour'; date: string }
export interface Adjustment{ id: string; action: string; reason: string; undoable: boolean }
export interface HealthStat{ id: string; label: string; value: number | string; unit: string; trend: 'up' | 'down' | 'stable'; context: string }
export interface TimelineDay{ date: string; dayLabel: string; score: number; zone: Zone }
export interface ChatMessage{ id: string; text: string; isWaldo: boolean; timestamp: string }
export interface ChatThread { id: string; title: string; lastMessage: string; timestamp: string; mode: string }

export type Zone = 'peak' | 'steady' | 'flagging' | 'depleted';

export function getZoneFromScore(s: number): Zone {
  if (s >= 80) return 'peak';
  if (s >= 60) return 'steady';
  if (s >= 40) return 'flagging';
  return 'depleted';
}

// ─── Available Dates ─────────────────────────────────────────────

export function useAvailableDates() {
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('crs_scores')
      .select('date, score')
      .eq('user_id', getActiveUserId())
      .gte('score', 0)
      .order('date', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setDates((data ?? []).map((d: Record<string, unknown>) => ({
          date:     d['date'] as string,
          score:    d['score'] as number,
          zone:     getZoneFromScore(d['score'] as number),
          hasSleep: true, hasHrv: true,
        })));
        setLoading(false);
      });
  }, []);

  return { dates, loading };
}

// ─── Dashboard Data ───────────────────────────────────────────────

interface DashboardData {
  napScore: number; zone: Zone; date: string;
  morningWag: { message: string; time: string; score: number };
  spots: Spot[]; adjustments: Adjustment[]; healthStats: HealthStat[];
  loading: boolean;
  sleepHours: number | null; sleepEfficiency: number | null;
  sleepDeepPct: number | null; sleepRemPct: number | null;
  hrvAvg: number | null; restingHr: number | null; steps: number | null;
  crsComponents: { sleep: number; hrv: number; circadian: number; activity: number } | null;
  stressEvents: number;
}

export function useDashboardData(selectedDate?: string) {
  const [data, setData] = useState<DashboardData>({
    napScore: 0, zone: 'depleted', date: '',
    morningWag: { message: 'Loading...', time: '', score: 0 },
    spots: [], adjustments: [], healthStats: [], loading: true,
    sleepHours: null, sleepEfficiency: null, sleepDeepPct: null, sleepRemPct: null,
    hrvAvg: null, restingHr: null, steps: null, crsComponents: null, stressEvents: 0,
  });

  const load = useCallback(async (target?: string) => {
    setData(d => ({ ...d, loading: true }));

    let date = target;
    if (!date) {
      const { data: latest } = await supabase.from('crs_scores')
        .select('date, score').eq('user_id', getActiveUserId())
        .gte('score', 0).order('date', { ascending: false }).limit(1).single();
      if (!latest) { setData(d => ({ ...d, loading: false })); return; }
      date = (latest as Record<string, unknown>)['date'] as string;
    }

    const uid = getActiveUserId();
    const [
      { data: crs }, { data: activity }, { data: daySpots },
      { data: master }, { data: calMetrics }, { data: health }, { data: stress },
    ] = await Promise.all([
      supabase.from('crs_scores').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
      supabase.from('day_activity').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
      supabase.from('spots').select('*').eq('user_id', uid).eq('date', date).order('created_at').limit(8),
      supabase.from('master_metrics').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
      supabase.from('calendar_metrics').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
      supabase.from('health_snapshots').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
      supabase.from('stress_events').select('id', { count: 'exact' }).eq('user_id', uid).eq('date', date),
    ]);

    const score = (crs as Record<string, unknown> | null)?.['score'] as number ?? 0;
    const zone  = getZoneFromScore(score);

    const spots: Spot[] = (daySpots ?? []).map((s: Record<string, unknown>, i: number) => ({
      id:    s['id'] as string ?? String(i),
      title: s['title'] as string,
      body:  s['detail'] as string ?? '',
      type:  s['type'] === 'alert' ? 'alert' : s['type'] === 'behavior' ? 'behaviour' : 'insight',
      date:  date === new Date().toISOString().slice(0, 10) ? 'Today' : date!,
    }));

    const actions = ((activity as Record<string, unknown> | null)?.['actions_json'] as unknown[]) ?? [];
    const adjustments: Adjustment[] = (actions as Record<string, unknown>[]).slice(0, 3).map((a, i) => ({
      id: String(i), action: a['action'] as string ?? '', reason: a['reason'] as string ?? '', undoable: true,
    }));

    const stats: HealthStat[] = [];
    const h = health as Record<string, unknown> | null;
    const m = master as Record<string, unknown> | null;
    const cal = calMetrics as Record<string, unknown> | null;

    if (h?.['sleep_duration_hours']) {
      const hrs = h['sleep_duration_hours'] as number;
      stats.push({ id:'1', label:'Sleep', value:+hrs.toFixed(1), unit:'hrs',
        trend: hrs >= 7 ? 'up' : 'down', context: `${h['sleep_efficiency'] ?? 0}% efficiency` });
    }
    if (m?.['sleep_debt']) {
      const debt = m['sleep_debt'] as Record<string, unknown>;
      stats.push({ id:'2', label:'Sleep debt', value:+(debt['debtHours'] as number ?? 0).toFixed(1), unit:'hrs',
        trend: debt['direction'] === 'accumulating' ? 'up' : debt['direction'] === 'paying_off' ? 'down' : 'stable',
        context: debt['direction'] as string ?? 'stable' });
    }
    if (m?.['strain']) {
      const strain = m['strain'] as Record<string, unknown>;
      stats.push({ id:'3', label:'Day strain', value:+(strain['score'] as number ?? 0).toFixed(1), unit:'/21',
        trend:'stable', context: strain['level'] as string ?? '' });
    }
    if (cal) {
      stats.push({ id:'4', label:'Meetings', value: cal['event_count'] as number ?? 0, unit:'',
        trend: (cal['back_to_back_count'] as number ?? 0) > 0 ? 'up' : 'stable',
        context: `MLS ${+(cal['meeting_load_score'] as number ?? 0).toFixed(0)}/15` });
    }
    if (h?.['steps']) {
      const steps = h['steps'] as number;
      stats.push({ id:'5', label:'Steps', value: Math.round(steps / 1000), unit:'k',
        trend: steps > 8000 ? 'up' : steps < 4000 ? 'down' : 'stable',
        context: `${h['exercise_minutes'] ?? 0}min active` });
    }
    if (h?.['hrv_rmssd']) {
      stats.push({ id:'6', label:'HRV', value: Math.round(h['hrv_rmssd'] as number), unit:'ms',
        trend:'stable', context:`${h['hrv_count'] ?? 0} readings` });
    }
    if (h?.['resting_hr']) {
      stats.push({ id:'7', label:'Resting HR', value: Math.round(h['resting_hr'] as number), unit:'bpm',
        trend:'stable', context:'' });
    }

    haptic(0);
    const crsRec = crs as Record<string, unknown> | null;
    setData({
      napScore: score, zone, date: date!,
      morningWag: {
        message: (activity as Record<string, unknown> | null)?.['morning_wag'] as string ?? 'No Morning Wag for this day.',
        time: '7:12 AM', score,
      },
      spots, adjustments, healthStats: stats, loading: false,
      sleepHours:    h?.['sleep_duration_hours'] as number | null ?? null,
      sleepEfficiency: h?.['sleep_efficiency'] as number | null ?? null,
      sleepDeepPct:  h?.['sleep_deep_pct'] as number | null ?? null,
      sleepRemPct:   h?.['sleep_rem_pct'] as number | null ?? null,
      hrvAvg:        h?.['hrv_rmssd'] as number | null ?? null,
      restingHr:     h?.['resting_hr'] as number | null ?? null,
      steps:         h?.['steps'] as number | null ?? null,
      crsComponents: crsRec ? {
        sleep:    (crsRec['sleep_json'] as Record<string, unknown>)?.['score'] as number ?? 0,
        hrv:      (crsRec['hrv_json'] as Record<string, unknown>)?.['score'] as number ?? 0,
        circadian:(crsRec['circadian_json'] as Record<string, unknown>)?.['score'] as number ?? 0,
        activity: (crsRec['activity_json'] as Record<string, unknown>)?.['score'] as number ?? 0,
      } : null,
      stressEvents: stress?.length ?? 0,
    });
  }, []);

  useEffect(() => { load(selectedDate); }, [selectedDate, load]);
  return { ...data, reload: load };
}

// ─── Timeline Data ─────────────────────────────────────────────────

export function useTimelineData(): { days: TimelineDay[]; loading: boolean; weeklyRead: string } {
  const [days, setDays]           = useState<TimelineDay[]>([]);
  const [loading, setLoading]     = useState(true);
  const [weeklyRead, setWeekly]   = useState('');

  useEffect(() => {
    const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    Promise.all([
      supabase.from('crs_scores').select('date, score').eq('user_id', getActiveUserId())
        .gte('score', 0).order('date', { ascending: false }).limit(30),
      supabase.from('patterns').select('summary').eq('user_id', getActiveUserId()).limit(2),
    ]).then(([{ data: crsData }, { data: patterns }]) => {
      setDays(((crsData ?? []) as Record<string, unknown>[]).reverse().map(c => ({
        date:     c['date'] as string,
        dayLabel: dayNames[new Date((c['date'] as string) + 'T00:00:00').getDay()] ?? '',
        score:    c['score'] as number,
        zone:     getZoneFromScore(c['score'] as number),
      })));
      if (patterns && patterns.length > 0) {
        setWeekly((patterns as Record<string, unknown>[]).map(p => p['summary'] as string).join(' '));
      }
      setLoading(false);
    });
  }, []);

  return { days, loading, weeklyRead };
}

// ─── Constellation Data ────────────────────────────────────────────

export interface ConstellationNode {
  id: string; label: string; type: string; severity: string; detail: string; date: string; size: number;
}

export function useConstellationData() {
  const [nodes, setNodes]     = useState<ConstellationNode[]>([]);
  const [patterns, setPatterns] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('spots').select('id, title, type, severity, detail, date')
        .eq('user_id', getActiveUserId()).order('created_at', { ascending: false }).limit(150),
      supabase.from('patterns').select('*').eq('user_id', getActiveUserId()),
    ]).then(([{ data: spots }, { data: pats }]) => {
      setNodes((spots ?? []).map((s: Record<string, unknown>) => ({
        id: s['id'] as string, label: s['title'] as string,
        type: s['type'] as string, severity: s['severity'] as string,
        detail: s['detail'] as string ?? '', date: s['date'] as string,
        size: s['severity'] === 'critical' ? 70 : s['severity'] === 'warning' ? 58 :
              s['severity'] === 'positive' ? 54 : 46,
      })));
      setPatterns((pats ?? []) as Record<string, unknown>[]);
      setLoading(false);
    });
  }, []);

  return { nodes, patterns, loading };
}

// ─── Chat ──────────────────────────────────────────────────────────

export function useWaldoChat() {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [threads, setThreads]     = useState<ChatThread[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase.from('conversation_history')
      .select('*').eq('user_id', getActiveUserId())
      .order('created_at', { ascending: true }).limit(50)
      .then(({ data }) => {
        const all: ChatMessage[] = (data ?? []).map((m: Record<string, unknown>, i: number) => ({
          id:       m['id'] as string ?? String(i),
          text:     m['content'] as string,
          isWaldo:  m['role'] === 'waldo',
          timestamp: new Date(m['created_at'] as string).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }),
        }));
        setMessages(all);

        const threadMap = new Map<string, ChatThread>();
        for (const m of (data ?? []) as Record<string, unknown>[]) {
          const key = m['mode'] as string ?? 'general';
          if (!threadMap.has(key)) {
            threadMap.set(key, {
              id: key,
              title: key === 'morning_wag' ? 'Morning Wags' : key === 'fetch_alert' ? 'Fetch Alerts' : 'Chat',
              lastMessage: (m['content'] as string).slice(0, 60),
              timestamp:   new Date(m['created_at'] as string).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }),
              mode: key,
            });
          } else {
            const t = threadMap.get(key)!;
            t.lastMessage = (m['content'] as string).slice(0, 60);
            t.timestamp   = new Date(m['created_at'] as string).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
          }
        }
        setThreads([...threadMap.values()]);
        setLoading(false);
      });
  }, []);

  async function sendMessage(text: string): Promise<void> {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`, text, isWaldo: false,
      timestamp: new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    haptic(0);

    try {
      const { data: latest } = await supabase.from('crs_scores')
        .select('date').eq('user_id', getActiveUserId()).gte('score', 0)
        .order('date', { ascending: false }).limit(1).single();

      const response = await fetch(AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: getActiveUserId(),
          trigger_type: 'conversational',
          question: text,
          date: (latest as Record<string, unknown> | null)?.['date'] ?? new Date().toISOString().slice(0, 10),
          channel: 'mobile',
        }),
      });

      const result = await response.json() as Record<string, unknown>;
      haptic(1);
      setMessages(prev => [...prev, {
        id: `waldo-${Date.now()}`,
        text: result['message'] as string ?? result['reply'] as string ?? 'Something went wrong.',
        isWaldo: true,
        timestamp: new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        text: "I'm having trouble connecting. I'll try again soon.",
        isWaldo: true,
        timestamp: new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }),
      }]);
    }
  }

  function startNewThread() {
    setMessages([]);
    haptic(1);
  }

  return { messages, threads, loading, sendMessage, startNewThread };
}

// ─── Profile Data ──────────────────────────────────────────────────

export interface ProfileData {
  profile: WaldoProfile | null;
  syncStatuses: SyncStatusEntry[];
  memory: MemoryEntry[];
  agentLogs: AgentLogSummary[];
  loading: boolean;
}

export function useProfileData(): ProfileData & { reload: () => Promise<void> } {
  const [state, setState] = useState<ProfileData>({
    profile: null, syncStatuses: [], memory: [], agentLogs: [], loading: true,
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const [profile, syncStatuses, memory, agentLogs] = await Promise.all([
      fetchWaldoProfile().catch(() => null),
      fetchSyncStatus().catch(() => []),
      fetchCoreMemory().catch(() => []),
      fetchRecentAgentLogs().catch(() => []),
    ]);
    setState({ profile, syncStatuses, memory, agentLogs, loading: false });
  }, []);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

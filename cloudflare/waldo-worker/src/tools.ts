/**
 * Waldo DO — Tool Definitions + Execution
 *
 * Ported from supabase/functions/invoke-agent/index.ts
 * Adapted for Cloudflare Worker environment (REST API via supabaseFetch).
 *
 * 13 tools: 10 read + 1 write + get_mood + get_tasks
 * Per-trigger permission filtering.
 */
import type { Env } from './types';
import type { SqlStorage } from './memory';
import { supabaseFetch, syncMemoryToSupabase } from './supabase';
import { sanitizeMemoryValue, writeMemory } from './memory';
import type { Tool } from './llm';

// ─── Tool type for Claude API ────────────────────────────────────

export type TriggerMode = 'morning_wag' | 'fetch_alert' | 'evening_review' | 'conversational' | 'onboarding';

// ─── Tool Definitions ────────────────────────────────────────────

const READ_TOOLS: Tool[] = [
  {
    name: 'get_crs',
    description: 'Get the Nap Score (CRS) for a specific date or the most recent date. Returns score 0-100, zone, component breakdown (sleep/HRV/circadian/activity), and summary.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for most recent.' } },
      required: [],
    },
  },
  {
    name: 'get_health',
    description: 'Get detailed health data for a date: sleep hours/efficiency/stages, HRV, resting HR, steps, exercise, SpO2, weather, AQI.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD. Omit for most recent.' } },
      required: [],
    },
  },
  {
    name: 'get_trends',
    description: 'Get 14-day trends: CRS week-over-week comparison, sleep/HRV/steps averages, email volume trends, calendar load trends, stress event counts.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_schedule',
    description: 'Get calendar metrics for a date: meeting load score (0-15), event count, back-to-back meetings, focus gaps, boundary violations.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'get_communication',
    description: 'Get email metrics for a date: total volume, sent/received, after-hours ratio, thread count, volume spikes.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'read_memory',
    description: 'Read what Waldo remembers about this user: preferences, patterns, communication style, chronotype, goals, past observations.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_spots',
    description: 'Get recent observations (Spots): health patterns, behavioral patterns, alerts, cross-source insights.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional date filter' },
        limit: { type: 'number', description: 'Max spots to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_patterns',
    description: 'Get discovered long-term patterns: weekly CRS cycles, sleep-performance correlations, exercise recovery, stress timing.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_mood',
    description: 'Get music/mood metrics for a date: listening habits, energy/valence/tempo averages, dominant mood.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD. Omit for target date.' } },
      required: [],
    },
  },
  {
    name: 'get_tasks',
    description: 'Get task urgency queue for a date: pending/overdue counts, completion velocity, and actual task titles.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD. Omit for target date.' } },
      required: [],
    },
  },
];

const WRITE_TOOLS: Tool[] = [
  {
    name: 'update_memory',
    description: 'Save a learning about this user. Use when you discover a preference, pattern, or important context. Key examples: "prefers_short_messages", "stress_trigger_monday_1pm".',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key (snake_case, descriptive)' },
        value: { type: 'string', description: 'What to remember (plain text, no instructions or code)' },
      },
      required: ['key', 'value'],
    },
  },
];

// ─── Per-trigger tool permissions ────────────────────────────────

export function getToolsForTrigger(triggerType: TriggerMode): Tool[] {
  const readNames = (names: string[]) => READ_TOOLS.filter(t => names.includes(t.name));

  switch (triggerType) {
    case 'morning_wag':
      return readNames(['get_crs', 'get_health', 'get_schedule', 'get_trends', 'read_memory', 'get_mood', 'get_tasks']);
    case 'fetch_alert':
      return readNames(['get_crs', 'get_health', 'read_memory', 'get_spots']);
    case 'evening_review':
      return readNames(['get_crs', 'get_health', 'get_schedule', 'get_trends', 'read_memory', 'get_mood', 'get_tasks']);
    case 'onboarding':
      return [...readNames(['read_memory']), ...WRITE_TOOLS];
    default: // conversational
      return [...READ_TOOLS, ...WRITE_TOOLS];
  }
}

// ─── Supabase REST query helpers ─────────────────────────────────

async function queryOne(env: Env, table: string, params: string): Promise<Record<string, unknown> | null> {
  const res = await supabaseFetch(env, `${table}?${params}&limit=1`);
  if (!res.ok) return null;
  const data = await res.json() as Array<Record<string, unknown>>;
  return data[0] ?? null;
}

async function queryMany(env: Env, table: string, params: string): Promise<Array<Record<string, unknown>>> {
  const res = await supabaseFetch(env, `${table}?${params}`);
  if (!res.ok) return [];
  return await res.json() as Array<Record<string, unknown>>;
}

function avg(arr: Array<Record<string, unknown>>, key: string): number | null {
  const nums = arr.map(d => d[key] as number | null).filter((n): n is number => n != null && n > 0);
  return nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

// ─── Tool Execution ─────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  targetDate: string,
  env: Env,
  sql: SqlStorage,
): Promise<string> {
  const date = (input?.date as string) ?? targetDate;

  switch (name) {
    case 'get_crs': {
      const params = input?.date
        ? `user_id=eq.${userId}&date=eq.${date}&select=date,score,zone,confidence,sleep_json,hrv_json,circadian_json,activity_json,summary`
        : `user_id=eq.${userId}&score=gte.0&order=date.desc&limit=1&select=date,score,zone,confidence,sleep_json,hrv_json,circadian_json,activity_json,summary`;
      const row = await queryOne(env, 'crs_scores', params);
      if (!row) return 'No CRS data available for this date.';
      const sleepJson = row['sleep_json'] as Record<string, unknown> | null;
      const hrvJson = row['hrv_json'] as Record<string, unknown> | null;
      const circadianJson = row['circadian_json'] as Record<string, unknown> | null;
      const activityJson = row['activity_json'] as Record<string, unknown> | null;
      return JSON.stringify({
        date: row['date'], score: row['score'], zone: row['zone'], confidence: row['confidence'],
        sleep: sleepJson?.['score'], hrv: hrvJson?.['score'],
        circadian: circadianJson?.['score'], activity: activityJson?.['score'],
        summary: row['summary'],
      });
    }

    case 'get_health': {
      const row = await queryOne(env, 'health_snapshots',
        `user_id=eq.${userId}&date=eq.${date}&select=date,sleep_duration_hours,sleep_efficiency,sleep_deep_pct,sleep_rem_pct,hrv_rmssd,hrv_count,resting_hr,steps,exercise_minutes,weather,aqi`
      );
      if (!row) return 'No health data for this date.';
      const master = await queryOne(env, 'master_metrics', `user_id=eq.${userId}&date=eq.${date}&select=strain,sleep_debt,cognitive_load`);
      return JSON.stringify({
        date: row['date'],
        sleep: row['sleep_duration_hours'] ? {
          hours: row['sleep_duration_hours'], efficiency: row['sleep_efficiency'],
          deep: row['sleep_deep_pct'], rem: row['sleep_rem_pct'],
        } : null,
        hrv: row['hrv_rmssd'] ? { avg_ms: Math.round(row['hrv_rmssd'] as number), readings: row['hrv_count'] } : null,
        resting_hr: row['resting_hr'], steps: row['steps'], exercise_min: row['exercise_minutes'],
        strain: master?.['strain'] ? { score: (master['strain'] as any).score, level: (master['strain'] as any).level } : null,
        sleep_debt: master?.['sleep_debt'] ? { hours: (master['sleep_debt'] as any).debtHours, direction: (master['sleep_debt'] as any).direction } : null,
        cognitive_load: master?.['cognitive_load'] ? { score: (master['cognitive_load'] as any).score, level: (master['cognitive_load'] as any).level } : null,
        weather: row['weather'], aqi: row['aqi'],
      });
    }

    case 'get_trends': {
      const [crs, health, email, cal, stress] = await Promise.all([
        queryMany(env, 'crs_scores', `user_id=eq.${userId}&score=gte.0&order=date.desc&limit=14&select=date,score`),
        queryMany(env, 'health_snapshots', `user_id=eq.${userId}&order=date.desc&limit=14&select=date,sleep_duration_hours,hrv_rmssd,steps`),
        queryMany(env, 'email_metrics', `user_id=eq.${userId}&order=date.desc&limit=14&select=date,total_emails,after_hours_ratio,volume_spike`),
        queryMany(env, 'calendar_metrics', `user_id=eq.${userId}&order=date.desc&limit=14&select=date,meeting_load_score,event_count,back_to_back_count`),
        queryMany(env, 'stress_events', `user_id=eq.${userId}&order=date.desc&limit=30&select=date,severity`),
      ]);
      const w1 = crs.slice(0, 7);
      const w2 = crs.slice(7, 14);
      const sleepDays = health.filter(d => d['sleep_duration_hours']);
      const stressDays = new Set(stress.map(s => s['date'] as string));
      return JSON.stringify({
        crs: {
          this_week: { avg: avg(w1, 'score')?.toFixed(0), days: w1.length, daily: w1.map(d => `${(d['date'] as string).slice(5)}:${d['score']}`) },
          prior_week: w2.length > 0 ? { avg: avg(w2, 'score')?.toFixed(0), days: w2.length } : null,
          delta: w1.length > 0 && w2.length > 0 ? ((avg(w1, 'score') ?? 0) - (avg(w2, 'score') ?? 0)).toFixed(0) : null,
        },
        health: {
          avg_sleep: sleepDays.length > 0 ? avg(sleepDays, 'sleep_duration_hours')?.toFixed(1) + 'h' : null,
          avg_hrv: avg(health.filter(d => d['hrv_rmssd']), 'hrv_rmssd')?.toFixed(0) + 'ms',
          avg_steps: avg(health.filter(d => (d['steps'] as number) > 0), 'steps')?.toFixed(0),
        },
        email: { avg_daily: avg(email, 'total_emails')?.toFixed(0), avg_after_hours: ((avg(email, 'after_hours_ratio') ?? 0) * 100).toFixed(0) + '%' },
        calendar: { avg_mls: avg(cal, 'meeting_load_score')?.toFixed(1), avg_events: avg(cal, 'event_count')?.toFixed(1) },
        stress: { total_events: stress.length, days_affected: stressDays.size, high_severity: stress.filter(s => s['severity'] === 'high').length },
      });
    }

    case 'get_schedule': {
      const row = await queryOne(env, 'calendar_metrics',
        `user_id=eq.${userId}&date=eq.${date}&select=meeting_load_score,event_count,total_meeting_minutes,back_to_back_count,boundary_violations,focus_gaps`
      );
      if (!row) return 'No calendar data for this date.';
      return JSON.stringify({
        mls: row['meeting_load_score'], events: row['event_count'], minutes: row['total_meeting_minutes'],
        back_to_back: row['back_to_back_count'], boundary_violations: row['boundary_violations'], focus_gaps: row['focus_gaps'],
      });
    }

    case 'get_communication': {
      const row = await queryOne(env, 'email_metrics',
        `user_id=eq.${userId}&date=eq.${date}&select=total_emails,sent_count,received_count,after_hours_ratio,unique_threads,volume_spike`
      );
      if (!row) return 'No email data for this date.';
      return JSON.stringify({
        total: row['total_emails'], sent: row['sent_count'], received: row['received_count'],
        after_hours: ((row['after_hours_ratio'] as number) * 100).toFixed(0) + '%',
        threads: row['unique_threads'], volume_spike: (row['volume_spike'] as number).toFixed(1) + 'x',
      });
    }

    case 'read_memory': {
      // Read from DO's local SQLite memory (Tier 1 — always fast)
      const memRows = sql.exec('SELECT key, value, category FROM memory_blocks ORDER BY updated_at DESC').toArray();
      // Also fetch patterns from Supabase
      const patterns = await queryMany(env, 'patterns', `user_id=eq.${userId}&select=summary,confidence,evidence_count`);
      const intel = await queryOne(env, 'user_intelligence', `user_id=eq.${userId}&select=summary`);
      return JSON.stringify({
        profile: intel?.['summary'] ?? 'No profile yet.',
        local_memory: Object.fromEntries(memRows.map(r => [r['key'] as string, r['value'] as string])),
        patterns: patterns.map(p => ({ summary: p['summary'], confidence: p['confidence'], evidence: p['evidence_count'] })),
      });
    }

    case 'get_spots': {
      const limit = (input?.limit as number) ?? 10;
      let params = `user_id=eq.${userId}&order=created_at.desc&limit=${limit}&select=date,type,severity,title,detail`;
      if (input?.date) params += `&date=eq.${input.date}`;
      const spots = await queryMany(env, 'spots', params);
      return JSON.stringify(spots.map(s => ({
        date: s['date'], type: s['type'], severity: s['severity'],
        title: s['title'], detail: ((s['detail'] as string) ?? '').slice(0, 100),
      })));
    }

    case 'get_patterns': {
      const patterns = await queryMany(env, 'patterns', `user_id=eq.${userId}&select=type,confidence,summary,evidence_count`);
      return JSON.stringify(patterns.map(p => ({
        type: p['type'], confidence: p['confidence'], summary: p['summary'], evidence: p['evidence_count'],
      })));
    }

    case 'get_mood': {
      const row = await queryOne(env, 'mood_metrics', `user_id=eq.${userId}&date=eq.${date}&select=provider,tracks_played,avg_energy,avg_valence,avg_tempo,listening_minutes,late_night_listening,dominant_mood`);
      if (!row) return 'No music/mood data for this date.';
      return JSON.stringify({
        provider: row['provider'], tracks: row['tracks_played'],
        energy: row['avg_energy'], valence: row['avg_valence'], tempo: row['avg_tempo'],
        listening_min: row['listening_minutes'], late_night: row['late_night_listening'],
        mood: row['dominant_mood'],
      });
    }

    case 'get_tasks': {
      const row = await queryOne(env, 'task_metrics', `user_id=eq.${userId}&date=eq.${date}&select=pending_count,overdue_count,completed_today,velocity,pending_titles`);
      if (!row) return 'No task data for this date.';
      return JSON.stringify({
        pending: row['pending_count'], overdue: row['overdue_count'],
        completed_today: row['completed_today'], velocity: row['velocity'],
        urgent_titles: row['pending_titles'] ?? [],
      });
    }

    case 'update_memory': {
      const key = String(input?.key ?? '');
      const value = String(input?.value ?? '');
      if (!key) return 'Memory update failed: key is required.';

      // Validate via DO memory module (injection check)
      const safe = sanitizeMemoryValue(value);
      if (safe === null) return 'Memory update rejected: contains blocked patterns.';

      // Write to DO SQLite (Tier 1 — instant, persistent)
      const written = writeMemory(sql, key, safe, 'preference');
      if (!written) return 'Memory update rejected: identity key or injection detected.';

      // Mirror to Supabase (fire-and-forget)
      void syncMemoryToSupabase(userId, key, safe, env);

      return `Remembered: ${key} = ${safe.slice(0, 50)}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Narrative Synthesis ─────────────────────────────────────────
// Build cross-domain context for the LLM (pre-loaded before ReAct loop)

export async function buildNarrativeContext(
  userId: string,
  targetDate: string,
  env: Env,
): Promise<{ narrative: string; crsScore: number; zone: string }> {
  const [crs, health, cal, email, tasks, master, stress] = await Promise.all([
    queryOne(env, 'crs_scores', `user_id=eq.${userId}&date=eq.${targetDate}&select=score,zone,summary`),
    queryOne(env, 'health_snapshots', `user_id=eq.${userId}&date=eq.${targetDate}&select=sleep_duration_hours,hrv_rmssd,resting_hr,steps`),
    queryOne(env, 'calendar_metrics', `user_id=eq.${userId}&date=eq.${targetDate}&select=meeting_load_score,event_count,back_to_back_count,focus_gaps`),
    queryOne(env, 'email_metrics', `user_id=eq.${userId}&date=eq.${targetDate}&select=total_emails,after_hours_ratio,volume_spike`),
    queryOne(env, 'task_metrics', `user_id=eq.${userId}&date=eq.${targetDate}&select=pending_count,overdue_count,pending_titles`),
    queryOne(env, 'master_metrics', `user_id=eq.${userId}&date=eq.${targetDate}&select=strain,sleep_debt,cognitive_load`),
    queryMany(env, 'stress_events', `user_id=eq.${userId}&date=eq.${targetDate}&select=severity,confidence`),
  ]);

  const score = (crs?.['score'] as number) ?? -1;
  const zone = score >= 80 ? 'peak' : score >= 60 ? 'steady' : score >= 40 ? 'flagging' : score >= 0 ? 'depleted' : 'no_data';

  const parts: string[] = [];

  if (score >= 0) {
    parts.push('=== TODAY\'S PICTURE ===');
    const factors: string[] = [];

    const sleep = health?.['sleep_duration_hours'] as number | null;
    if (sleep) {
      factors.push(sleep < 6 ? `short sleep (${sleep}h)` : sleep >= 7.5 ? `solid sleep (${sleep}h)` : `adequate sleep (${sleep}h)`);
    }

    const mls = cal?.['meeting_load_score'] as number | null;
    if (mls != null && mls > 8) factors.push(`heavy meeting load (MLS ${mls}/15)`);
    else if (cal?.['event_count']) factors.push(`${cal['event_count']} meetings (MLS ${mls}/15)`);

    const afterHours = email?.['after_hours_ratio'] as number | null;
    if (afterHours != null && afterHours > 0.3) factors.push(`${(afterHours * 100).toFixed(0)}% emails after hours`);

    const spike = email?.['volume_spike'] as number | null;
    if (spike != null && spike > 1.5) factors.push(`email volume ${spike.toFixed(1)}x normal`);

    const overdue = tasks?.['overdue_count'] as number | null;
    if (overdue != null && overdue > 3) factors.push(`${overdue} overdue tasks`);

    if (stress.length > 0) factors.push(`${stress.length} stress events detected`);

    const sleepDebt = master?.['sleep_debt'] as Record<string, unknown> | null;
    if (sleepDebt && (sleepDebt['debtHours'] as number) > 3) factors.push(`${(sleepDebt['debtHours'] as number).toFixed(1)}h sleep debt`);

    parts.push(factors.length > 0
      ? `Nap Score ${score}. Contributing factors: ${factors.join(', ')}.`
      : `Nap Score ${score}. Clean signal today.`
    );

    const cogLoad = master?.['cognitive_load'] as Record<string, unknown> | null;
    if (cogLoad && (cogLoad['score'] as number) > 60) {
      parts.push(`Cognitive load is ${cogLoad['level']} (${cogLoad['score']}/100).`);
    }
  }

  return { narrative: parts.join('\n'), crsScore: score, zone };
}

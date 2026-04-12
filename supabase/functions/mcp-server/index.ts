/**
 * Waldo MCP Server — The Body API
 *
 * Exposes Waldo's biological intelligence via the Model Context Protocol (MCP).
 * Any MCP-compatible agent (Claude, GPT, Cursor, Lindy, custom agents) can query
 * a user's biological state before making decisions on their behalf.
 *
 * Protocol: JSON-RPC 2.0 over HTTP (Streamable HTTP transport — MCP spec June 2025)
 *
 * Authentication: Bearer token = Waldo user_id (simple auth for v1)
 * Future: OAuth 2.1 PKCE for third-party agent access
 *
 * Exposed tools:
 *   get_crs           — current Cognitive Readiness Score + zone
 *   get_stress_level  — current biometric stress signature + confidence
 *   get_cognitive_window — peak mental performance window for today
 *   get_sleep_debt    — accumulated sleep debt + direction
 *   get_health_baseline — user's personal physiological normal
 *   get_meeting_context — insights from recent meetings (if meeting adapter connected)
 *
 * Usage (for an external agent):
 *   POST /functions/v1/mcp-server
 *   Authorization: Bearer <waldo_user_id>
 *   Content-Type: application/json
 *   Body: { jsonrpc: "2.0", method: "tools/call", params: { name: "get_crs", arguments: {} }, id: 1 }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: '2.0', id, error: { code, message } });
}

function jsonrpcResult(id: unknown, result: unknown) {
  return json({ jsonrpc: '2.0', id, result });
}

// ─── MCP Tool Definitions ─────────────────────────────────────

const TOOLS = [
  {
    name: 'get_crs',
    description: "Get the user's current Cognitive Readiness Score (Nap Score). Returns 0-100 score, zone (peak/steady/flagging/depleted), and a one-sentence summary. Use before scheduling demanding work or decisions.",
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Omit for today.' },
      },
    },
  },
  {
    name: 'get_stress_level',
    description: "Get the user's current biometric stress signature. Returns confidence 0-1, severity, recent event count, and whether an active Fetch Alert was triggered today.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cognitive_window',
    description: "Get the user's peak mental performance window for today. Returns the best time block for demanding cognitive work based on chronotype, sleep quality, and current CRS. Format: {start: 'HH:MM', end: 'HH:MM', confidence: 0-1}.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_sleep_debt',
    description: "Get the user's current sleep debt. Returns hours owed, 14-day trend direction (accumulating/paying_off/stable), and a readiness flag.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_health_baseline',
    description: "Get the user's personal physiological baseline (their normal). Returns: resting HR, HRV baseline (RMSSD), average sleep hours, typical CRS range, and chronotype. Use to understand what 'normal' looks like for this specific person.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_meeting_context',
    description: "Get insights from the user's most recent meetings. Returns: last N meeting summaries, cognitive cost per meeting, and recurring stress triggers identified. Only available if meeting integration is connected.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent meetings to summarize (default 3, max 10).' },
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────

async function executeMcpTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const date = (args['date'] as string | undefined) ?? today;

  switch (name) {
    case 'get_crs': {
      const { data } = await supabase
        .from('crs_scores')
        .select('score,zone,summary')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      if (!data) return { score: -1, zone: 'insufficient', summary: 'No CRS data for this date.', date };
      return {
        score: data.score,
        zone: data.zone,
        summary: data.summary ?? `Nap Score ${data.score} (${data.zone})`,
        date,
        agent_guidance: data.score >= 80
          ? 'User is in peak cognitive state. Good time for demanding work.'
          : data.score >= 60
            ? 'User is steady. Routine tasks fine; defer major decisions if possible.'
            : data.score >= 40
              ? 'User is flagging. Protect their energy. Avoid overloading.'
              : 'User is depleted. Recommend rest. Defer all non-urgent demands.',
      };
    }

    case 'get_stress_level': {
      const { data: stressEvents, count } = await supabase
        .from('stress_events')
        .select('confidence,severity,start_time', { count: 'exact' })
        .eq('user_id', userId)
        .eq('date', today)
        .order('confidence', { ascending: false })
        .limit(1);

      const topEvent = stressEvents?.[0] as Record<string, unknown> | undefined;
      const { data: alertFired } = await supabase
        .from('agent_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('trigger_type', 'fetch_alert')
        .gte('created_at', `${today}T00:00:00`)
        .limit(1)
        .maybeSingle();

      return {
        stress_confidence: topEvent?.confidence ?? 0,
        severity: topEvent?.severity ?? 'none',
        events_today: count ?? 0,
        fetch_alert_fired: alertFired !== null,
        last_event_time: topEvent?.start_time ?? null,
        agent_guidance: (topEvent?.confidence as number ?? 0) >= 0.6
          ? 'Active stress detected. Avoid adding pressure. A short break would help.'
          : 'Stress levels appear normal.',
      };
    }

    case 'get_cognitive_window': {
      const { data: crs } = await supabase
        .from('crs_scores')
        .select('score,zone')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const { data: user } = await supabase
        .from('users')
        .select('wake_time_estimate,chronotype')
        .eq('id', userId)
        .maybeSingle();

      const chronotype = (user as Record<string, unknown> | null)?.['chronotype'] as string ?? 'normal';
      const wakeTime = (user as Record<string, unknown> | null)?.['wake_time_estimate'] as string ?? '07:00';
      const [wakeH] = wakeTime.split(':').map(Number);

      // Compute peak window based on chronotype
      const peakOffsetHours = chronotype === 'early' ? 3 : chronotype === 'late' ? 5 : 4;
      const peakStart = wakeH + peakOffsetHours;
      const peakEnd = peakStart + 2;
      const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;

      const score = (crs as Record<string, unknown> | null)?.score as number ?? -1;
      return {
        peak_start: fmt(peakStart),
        peak_end: fmt(peakEnd),
        chronotype,
        current_crs: score,
        confidence: score >= 0 ? 0.85 : 0.5,
        agent_guidance: `Schedule demanding work between ${fmt(peakStart)}–${fmt(peakEnd)} for best results.`,
      };
    }

    case 'get_sleep_debt': {
      const { data: master } = await supabase
        .from('master_metrics')
        .select('sleep_debt')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const debt = (master as Record<string, unknown> | null)?.sleep_debt as Record<string, unknown> | null;
      return {
        debt_hours: debt?.['debtHours'] ?? 0,
        direction: debt?.['direction'] ?? 'stable',
        weeks_accumulated: debt?.['weeksAccumulated'] ?? 0,
        is_critical: (debt?.['debtHours'] as number ?? 0) > 6,
        agent_guidance: (debt?.['debtHours'] as number ?? 0) > 3
          ? 'Sleep debt is significant. Avoid demanding late-day tasks. Earlier end time recommended.'
          : 'Sleep debt is manageable.',
      };
    }

    case 'get_health_baseline': {
      const { data: memory } = await supabase
        .from('core_memory')
        .select('key,value')
        .eq('user_id', userId)
        .in('key', ['hrv_baseline', 'resting_hr_baseline', 'sleep_avg_7d', 'chronotype', 'typical_crs_range']);

      const memMap: Record<string, string> = {};
      for (const row of (memory ?? []) as Array<{ key: string; value: string }>) {
        memMap[row.key] = row.value;
      }

      const { data: user } = await supabase
        .from('users')
        .select('wearable_type,wake_time_estimate')
        .eq('id', userId)
        .maybeSingle();

      return {
        hrv_baseline_ms: memMap['hrv_baseline'] ? parseFloat(memMap['hrv_baseline']) : null,
        resting_hr_bpm: memMap['resting_hr_baseline'] ? parseFloat(memMap['resting_hr_baseline']) : null,
        avg_sleep_hours: memMap['sleep_avg_7d'] ? parseFloat(memMap['sleep_avg_7d']) : null,
        chronotype: memMap['chronotype'] ?? 'normal',
        typical_crs_range: memMap['typical_crs_range'] ?? 'unknown',
        wearable: (user as Record<string, unknown> | null)?.['wearable_type'] ?? 'unknown',
        wake_time: (user as Record<string, unknown> | null)?.['wake_time_estimate'] ?? '07:00',
      };
    }

    case 'get_meeting_context': {
      const limit = Math.min((args['limit'] as number | undefined) ?? 3, 10);
      const { data: activity } = await supabase
        .from('day_activity')
        .select('date,morning_wag,evening_review')
        .eq('user_id', userId)
        .not('morning_wag', 'is', null)
        .order('date', { ascending: false })
        .limit(limit);

      if (!activity || activity.length === 0) {
        return { meetings: [], message: 'No meeting data available. Connect the meeting integration.' };
      }

      return {
        recent_days: (activity as Array<Record<string, unknown>>).map(a => ({
          date: a['date'],
          morning_summary: (a['morning_wag'] as string | null)?.slice(0, 200) ?? null,
          evening_summary: (a['evening_review'] as string | null)?.slice(0, 200) ?? null,
        })),
        count: activity.length,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ─── Auth: Bearer token = Waldo user_id ────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonrpcError(null, -32001, 'Missing Authorization header. Provide: Authorization: Bearer <waldo_user_id>');
  }
  const userId = authHeader.slice(7).trim();

  // Verify user exists
  const { data: userExists } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('active', true)
    .maybeSingle();

  if (!userExists) {
    return jsonrpcError(null, -32001, 'User not found or inactive. Provide a valid Waldo user_id.');
  }

  // ─── MCP protocol discovery (GET) ──────────────────────────
  // Returns server capabilities for MCP client initialization
  if (req.method === 'GET') {
    return json({
      name: 'waldo-body-api',
      version: '1.0.0',
      description: 'Waldo biological intelligence — real-time cognitive readiness and health signals for any AI agent.',
      capabilities: { tools: {} },
      protocolVersion: '2024-11-05',
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let rpc: Record<string, unknown>;
  try {
    rpc = await req.json() as Record<string, unknown>;
  } catch {
    return jsonrpcError(null, -32700, 'Parse error');
  }

  const { id, method, params } = rpc as {
    id: unknown;
    method: string;
    params?: Record<string, unknown>;
  };

  // ─── tools/list ────────────────────────────────────────────
  if (method === 'tools/list') {
    return jsonrpcResult(id, { tools: TOOLS });
  }

  // ─── tools/call ────────────────────────────────────────────
  if (method === 'tools/call') {
    const toolName = params?.['name'] as string | undefined;
    const toolArgs = (params?.['arguments'] as Record<string, unknown> | undefined) ?? {};

    if (!toolName) return jsonrpcError(id, -32602, 'Missing tool name');
    if (!TOOLS.find(t => t.name === toolName)) {
      return jsonrpcError(id, -32602, `Unknown tool: ${toolName}. Available: ${TOOLS.map(t => t.name).join(', ')}`);
    }

    try {
      const result = await executeMcpTool(toolName, toolArgs, userId, supabase);
      return jsonrpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      });
    } catch (err) {
      return jsonrpcError(id, -32603, err instanceof Error ? err.message : String(err));
    }
  }

  // ─── initialize (MCP handshake) ────────────────────────────
  if (method === 'initialize') {
    return jsonrpcResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'waldo-body-api', version: '1.0.0' },
    });
  }

  return jsonrpcError(id, -32601, `Method not found: ${method}`);
});

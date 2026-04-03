/**
 * Waldo — admin Edge Function
 *
 * Internal-only admin API for team operations.
 * Secured by ADMIN_API_KEY env var (simple shared secret, team demo only).
 * Never expose this key publicly.
 *
 * Routes:
 *   GET  /admin/users                — list all users with stats
 *   POST /admin/users                — create a new user, return linking code
 *   POST /admin/users/:id/link       — generate fresh Telegram linking code
 *   GET  /admin/users/:id            — get single user detail
 *   POST /admin/users/:id/impersonate — generate a linking code as that user (super admin)
 *
 * Auth: x-admin-key: <ADMIN_API_KEY> header on every request.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'admin', event, ...data }));
}

// ─── Auth ──────────────────────────────────────────────────────
function isAuthorized(req: Request): boolean {
  const adminKey = Deno.env.get('ADMIN_API_KEY');
  if (!adminKey) return false; // Must be configured
  return req.headers.get('x-admin-key') === adminKey;
}

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().default('UTC'),
  wake_time_estimate: z.string().default('07:00'),
  preferred_evening_time: z.string().default('21:00'),
  wearable_type: z.enum(['apple_watch', 'garmin', 'whoop', 'oura', 'fitbit', 'galaxy_watch', 'unknown']).default('unknown'),
  is_admin: z.boolean().default(false),
});

function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized — invalid or missing x-admin-key' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  // path after /admin/
  const segments = url.pathname.replace(/.*\/admin\/?/, '').split('/').filter(Boolean);
  // segments[0] = 'users', segments[1] = user_id, segments[2] = 'link' | 'impersonate'

  // ─── GET /admin/users ─────────────────────────────────────────
  if (req.method === 'GET' && segments[0] === 'users' && !segments[1]) {
    const { data: users } = await supabase
      .from('users')
      .select(`
        id, name, timezone, wearable_type, onboarding_complete,
        active, telegram_chat_id, last_health_sync,
        wake_time_estimate, preferred_evening_time, is_admin, created_at
      `)
      .order('created_at', { ascending: false });

    // Enrich with CRS score count and latest score
    const enriched = await Promise.all((users ?? []).map(async (u: any) => {
      const [{ count: crsCount }, { data: latestCrs }, { count: convCount }, { data: syncLogs }] = await Promise.all([
        supabase.from('crs_scores').select('*', { count: 'exact', head: true }).eq('user_id', u.id).gte('score', 0),
        supabase.from('crs_scores').select('score, zone, date').eq('user_id', u.id).gte('score', 0).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('conversation_history').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('sync_log').select('provider, last_sync_at, last_sync_status').eq('user_id', u.id),
      ]);

      const googleConnected = !!(await supabase.from('oauth_tokens').select('id').eq('user_id', u.id).eq('provider', 'google').maybeSingle()).data;

      return {
        ...u,
        stats: {
          daysOfData: crsCount ?? 0,
          latestScore: latestCrs?.score ?? null,
          latestZone: latestCrs?.zone ?? null,
          latestDate: latestCrs?.date ?? null,
          conversationCount: convCount ?? 0,
          googleConnected,
          syncLogs: syncLogs ?? [],
        },
      };
    }));

    return json({ users: enriched, total: enriched.length });
  }

  // ─── GET /admin/users/:id ──────────────────────────────────────
  if (req.method === 'GET' && segments[0] === 'users' && segments[1] && !segments[2]) {
    const userId = segments[1];
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user) return json({ error: 'User not found' }, 404);

    const [{ data: memory }, { data: agentLogs }, { data: crsHistory }] = await Promise.all([
      supabase.from('core_memory').select('key, value').eq('user_id', userId),
      supabase.from('agent_logs').select('trigger_type, delivery_status, total_tokens, latency_ms, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('crs_scores').select('date, score, zone').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(30),
    ]);

    return json({ user, memory: memory ?? [], agentLogs: agentLogs ?? [], crsHistory: crsHistory ?? [] });
  }

  // ─── POST /admin/users ─────────────────────────────────────────
  if (req.method === 'POST' && segments[0] === 'users' && !segments[1]) {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return json({ error: 'Invalid JSON' }, 400);

    const parsed = CreateUserSchema.safeParse(rawBody);
    if (!parsed.success) return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

    const { name, timezone, wake_time_estimate, preferred_evening_time, wearable_type, is_admin } = parsed.data;

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name, timezone, wake_time_estimate, preferred_evening_time,
        wearable_type, is_admin,
        onboarding_complete: true, // admin-created users skip onboarding
        active: true,
      })
      .select('id')
      .single();

    if (error || !newUser) {
      log('create_user_failed', { error: error?.message });
      return json({ error: 'Failed to create user', detail: error?.message }, 500);
    }

    // Generate linking code
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('telegram_linking_codes').insert({ user_id: newUser.id, code, expires_at: expiresAt });

    log('user_created', { userId: newUser.id, name });

    return json({
      user_id: newUser.id,
      name,
      linking_code: code,
      linking_code_expires_in_seconds: 600,
      google_connect_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-google/connect?user_id=${newUser.id}&scopes=calendar,gmail,tasks`,
      telegram_instructions: `DM the bot, send /start, then enter: ${code}`,
    }, 201);
  }

  // ─── POST /admin/users/:id/link ───────────────────────────────
  if (req.method === 'POST' && segments[0] === 'users' && segments[1] && segments[2] === 'link') {
    const userId = segments[1];
    const { data: user } = await supabase.from('users').select('id, name').eq('id', userId).maybeSingle();
    if (!user) return json({ error: 'User not found' }, 404);

    // Invalidate old codes
    await supabase.from('telegram_linking_codes').update({ used: true }).eq('user_id', userId).eq('used', false);

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('telegram_linking_codes').insert({ user_id: userId, code, expires_at: expiresAt });

    log('linking_code_regenerated', { userId });
    return json({ user_id: userId, name: user.name, linking_code: code, expires_in_seconds: 600 });
  }

  // ─── POST /admin/users/:id/toggle-active ─────────────────────
  if (req.method === 'POST' && segments[0] === 'users' && segments[1] && segments[2] === 'toggle-active') {
    const userId = segments[1];
    const { data: user } = await supabase.from('users').select('active').eq('id', userId).maybeSingle();
    if (!user) return json({ error: 'User not found' }, 404);

    await supabase.from('users').update({ active: !user.active }).eq('id', userId);
    log('user_toggled', { userId, active: !user.active });
    return json({ user_id: userId, active: !user.active });
  }

  return json({ error: 'Not found' }, 404);
});

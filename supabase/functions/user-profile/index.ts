/**
 * Waldo — user-profile Edge Function
 *
 * Manages user registration and Telegram linking.
 * All routes require a valid Supabase Auth JWT (user is authenticated).
 *
 * Routes:
 *   POST   /user-profile              — Create user row, return linking code
 *   GET    /user-profile              — Get profile + onboarding status
 *   GET    /user-profile/linking-code — Generate fresh linking code (or return non-expired one)
 *
 * Body schema (POST):
 *   { name: string, timezone: string, wearable_type?: string }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { createLinkingCode } from '../_shared/config.ts';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'user-profile', level, event, ...data }));
}

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50).default('UTC'),
  wearable_type: z.enum(['apple_watch', 'garmin', 'whoop', 'oura', 'fitbit', 'unknown']).default('unknown'),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ─── Auth: extract caller's auth_id from JWT ───────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const jwt = authHeader.slice(7);

  // Use anon client to verify JWT and get auth user
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
  if (authError || !authUser) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  // Service-role client for DB writes (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');

  // ─── GET /user-profile/linking-code ───────────────────────
  if (req.method === 'GET' && path.endsWith('/linking-code')) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (!existingUser) {
      return json({ error: 'User profile not found. Create profile first.' }, 404);
    }

    // Check for an unexpired, unused code first
    const { data: existingCode } = await supabase
      .from('telegram_linking_codes')
      .select('code, expires_at')
      .eq('user_id', existingUser.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCode) {
      const expiresInSeconds = Math.floor((new Date(existingCode.expires_at).getTime() - Date.now()) / 1000);
      return json({ code: existingCode.code, expires_in_seconds: expiresInSeconds });
    }

    const code = await createLinkingCode(supabase, existingUser.id);
    log('info', 'linking_code_generated', { userId: existingUser.id });
    return json({ code, expires_in_seconds: 600 });
  }

  // ─── GET /user-profile ────────────────────────────────────
  if (req.method === 'GET') {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, timezone, wearable_type, onboarding_complete, telegram_chat_id, last_health_sync, wake_time_estimate, preferred_evening_time, created_at')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (error) {
      log('error', 'profile_fetch_failed', { error: error.message });
      return json({ error: 'Failed to fetch profile' }, 500);
    }

    if (!user) {
      return json({ exists: false }, 404);
    }

    return json({
      exists: true,
      user: {
        id: user.id,
        name: user.name,
        timezone: user.timezone,
        wearable_type: user.wearable_type,
        onboarding_complete: user.onboarding_complete,
        telegram_linked: user.telegram_chat_id !== null,
        last_health_sync: user.last_health_sync,
        wake_time_estimate: user.wake_time_estimate,
        preferred_evening_time: user.preferred_evening_time,
        created_at: user.created_at,
      },
    });
  }

  // ─── POST /user-profile ───────────────────────────────────
  if (req.method === 'POST') {
    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CreateProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }
    const { name, timezone, wearable_type } = parsed.data;

    // Idempotent: if a profile already exists for this auth_id, return existing
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    let userId: string;

    if (existing) {
      userId = existing.id;
      log('info', 'profile_already_exists', { userId });
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          auth_id: authUser.id,
          email: authUser.email ?? null,
          name,
          timezone,
          wearable_type,
          onboarding_complete: false,
          active: true,
        })
        .select('id')
        .single();

      if (insertError || !newUser) {
        log('error', 'profile_create_failed', { error: insertError?.message });
        return json({ error: 'Failed to create profile' }, 500);
      }

      userId = newUser.id;
      log('info', 'profile_created', { userId });
    }

    const code = await createLinkingCode(supabase, userId);
    log('info', 'initial_linking_code', { userId });

    return json({
      user_id: userId,
      linking_code: code,
      linking_code_expires_in_seconds: 600,
      message: 'Profile created. Send the linking code to the Waldo Telegram bot to connect.',
    }, existing ? 200 : 201);
  }

  return json({ error: 'Method not allowed' }, 405);
});

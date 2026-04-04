/**
 * Waldo — user-register Edge Function (public, no admin key)
 *
 * Self-service registration for mobile app users.
 * No authentication required — intended for internal team use.
 * Anyone who has the app can register.
 *
 * POST /user-register
 *   body: { name, timezone, wearable_type?, wake_time_estimate? }
 *   → { user_id, linking_code, google_connect_url }
 *
 * Idempotent: if a user with the same name already exists in the same timezone
 * created in the last 5 minutes, returns the existing user (prevents double-taps).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().default('UTC'),
  wearable_type: z.enum(['apple_watch', 'galaxy_watch', 'garmin', 'whoop', 'oura', 'fitbit', 'unknown']).default('unknown'),
  wake_time_estimate: z.string().default('07:30'),
  preferred_evening_time: z.string().default('21:00'),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) return json({ error: 'Invalid JSON' }, 400);

  const parsed = RegisterSchema.safeParse(rawBody);
  if (!parsed.success) return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const { name, timezone, wearable_type, wake_time_estimate, preferred_evening_time } = parsed.data;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotency: check for very recent duplicate registration (within 5 min)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', name.trim())
    .eq('timezone', timezone)
    .gte('created_at', fiveMinAgo)
    .maybeSingle();

  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        timezone,
        wearable_type,
        wake_time_estimate,
        preferred_evening_time,
        onboarding_complete: false,
        active: true,
        is_admin: false,
      })
      .select('id')
      .single();

    if (error || !newUser) return json({ error: 'Failed to create user', detail: error?.message }, 500);
    userId = newUser.id;
  }

  // Generate Telegram linking code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await supabase.from('telegram_linking_codes').insert({
    user_id: userId,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const googleConnectUrl = `${supabaseUrl}/functions/v1/oauth-google/connect?user_id=${userId}&scopes=calendar,gmail,tasks,youtube,fit_heart,fit_sleep,fit_steps`;

  // ─── Provision Cloudflare DO for this user (fire-and-forget) ─────
  // If CLOUDFLARE_WORKER_URL is set, spin up the user's persistent Waldo agent.
  // If not set (during initial testing), this is skipped gracefully.
  let doProvisioned = false;
  const workerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL');
  const workerSecret = Deno.env.get('WALDO_WORKER_SECRET');

  if (workerUrl && !existing) {
    try {
      const provisionRes = await fetch(`${workerUrl}/provision/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workerSecret ? { 'x-waldo-secret': workerSecret } : {}),
        },
        body: JSON.stringify({ user_id: userId }),
      });
      doProvisioned = provisionRes.ok;
      if (!provisionRes.ok) {
        const err = await provisionRes.text();
        console.warn(`DO provision failed for ${userId}: ${err.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`DO provision error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return json({
    user_id: userId,
    name: name.trim(),
    linking_code: code,
    google_connect_url: googleConnectUrl,
    telegram_instructions: `DM @wadloboi1_test_bot and send: /start, then enter code ${code}`,
    do_provisioned: doProvisioned,
    agent_status: doProvisioned ? 'running' : workerUrl ? 'provision_failed' : 'not_configured',
  }, existing ? 200 : 201);
});

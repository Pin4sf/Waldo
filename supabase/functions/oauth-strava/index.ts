/**
 * Waldo — oauth-strava Edge Function
 *
 * Handles Strava OAuth 2.0 flow. Strava returns access_token + refresh_token
 * with expires_at. Refresh pattern same as Spotify.
 *
 * Routes: /connect, /callback, /status, /disconnect
 *
 * Required Supabase Secrets:
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   OAUTH_REDIRECT_SUCCESS_URL
 *
 * Strava API setup:
 *   1. Create app at strava.com/settings/api
 *   2. Add callback URL: https://<project>.supabase.co/functions/v1/oauth-strava/callback
 *   3. Scopes: read,activity:read
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_SCOPES = 'read,activity:read';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-strava', event, ...data }));
}

function encodeState(userId: string): string {
  return btoa(JSON.stringify({ userId, ts: Date.now() }));
}

function decodeState(state: string): { userId: string } | null {
  try {
    const parsed = JSON.parse(atob(state));
    if (!parsed.userId) return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const successUrl = Deno.env.get('OAUTH_REDIRECT_SUCCESS_URL') ?? 'https://waldo-console.vercel.app';

  // ─── GET /connect ─────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/connect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400, headers: CORS });

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    if (!clientId) return new Response('Strava OAuth not configured', { status: 503, headers: CORS });

    const state = encodeState(userId);
    const authUrl = `${STRAVA_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(Deno.env.get('SUPABASE_URL') + '/functions/v1/oauth-strava/callback')}&response_type=code&scope=${STRAVA_SCOPES}&state=${state}`;

    log('oauth_redirect', { userId });
    return Response.redirect(authUrl, 302);
  }

  // ─── GET /callback ────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) return Response.redirect(`${successUrl}?error=missing_params`, 302);

    const stateData = decodeState(state);
    if (!stateData) return Response.redirect(`${successUrl}?error=expired_state`, 302);

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientId || !clientSecret) return Response.redirect(`${successUrl}?error=not_configured`, 302);

    // Exchange code for tokens
    const resp = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!resp.ok) {
      log('token_exchange_failed', { status: resp.status });
      return Response.redirect(`${successUrl}?error=token_exchange_failed`, 302);
    }

    const tokens = await resp.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: number; // Unix timestamp
      athlete: { id: number; firstname: string };
    };

    await supabase.from('oauth_tokens').upsert({
      user_id: stateData.userId,
      provider: 'strava',
      scopes: [STRAVA_SCOPES],
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: 'Bearer',
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await supabase.from('sync_log').upsert({
      user_id: stateData.userId, provider: 'strava',
      last_sync_status: 'pending', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('oauth_complete', { userId: stateData.userId, athlete: tokens.athlete?.firstname });

    // Immediate first sync
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-strava`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ user_id: stateData.userId }),
    }).catch(() => {});

    return Response.redirect(`${successUrl}?connected=strava`, 302);
  }

  // ─── GET /status ──────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/status')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response(JSON.stringify({ connected: false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    const { data: token } = await supabase.from('oauth_tokens').select('updated_at').eq('user_id', userId).eq('provider', 'strava').maybeSingle();
    const { data: sync } = await supabase.from('sync_log').select('last_sync_at, last_sync_status, records_synced').eq('user_id', userId).eq('provider', 'strava').maybeSingle();

    return new Response(JSON.stringify({
      connected: !!token, last_sync: sync?.last_sync_at, last_status: sync?.last_sync_status, records: sync?.records_synced ?? 0,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ─── DELETE /disconnect ───────────────────────────────────
  if (req.method === 'DELETE' && path.endsWith('/disconnect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400, headers: CORS });
    await supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'strava');
    await supabase.from('sync_log').delete().eq('user_id', userId).eq('provider', 'strava');
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response('Not Found', { status: 404, headers: CORS });
});

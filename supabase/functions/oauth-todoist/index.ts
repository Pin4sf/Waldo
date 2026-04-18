/**
 * Waldo — oauth-todoist Edge Function
 *
 * Handles Todoist OAuth 2.0 flow (Authorization Code).
 * Todoist tokens do NOT expire — no refresh needed.
 *
 * Routes:
 *   GET /oauth-todoist/connect?user_id=<id>
 *     → Redirects to Todoist authorization page
 *
 *   GET /oauth-todoist/callback?code=<code>&state=<state>
 *     → Exchanges code for token, stores in oauth_tokens (provider='todoist')
 *     → Redirects to OAUTH_REDIRECT_SUCCESS_URL?connected=todoist
 *
 *   GET /oauth-todoist/status?user_id=<id>
 *     → Returns connection status + last sync
 *
 *   DELETE /oauth-todoist/disconnect?user_id=<id>
 *     → Removes tokens + sync log
 *
 * Required Supabase Secrets:
 *   TODOIST_CLIENT_ID
 *   TODOIST_CLIENT_SECRET
 *   OAUTH_REDIRECT_SUCCESS_URL
 *
 * Todoist Developer Console setup:
 *   1. Create app at developer.todoist.com/appconsole.html
 *   2. Add redirect URI: https://<project>.supabase.co/functions/v1/oauth-todoist/callback
 *   3. Scopes: data:read
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const TODOIST_AUTH_URL = 'https://todoist.com/oauth/authorize';
const TODOIST_TOKEN_URL = 'https://todoist.com/oauth/access_token';
const TODOIST_SCOPES = 'data:read';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-todoist', event, ...data }));
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

async function exchangeCode(code: string): Promise<{ access_token: string } | null> {
  const clientId = Deno.env.get('TODOIST_CLIENT_ID');
  const clientSecret = Deno.env.get('TODOIST_CLIENT_SECRET');
  if (!clientId || !clientSecret) { log('missing_todoist_creds'); return null; }

  const resp = await fetch(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!resp.ok) { log('token_exchange_failed', { status: resp.status }); return null; }
  return resp.json();
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const successUrl = Deno.env.get('OAUTH_REDIRECT_SUCCESS_URL') ?? 'https://waldo-sigma.vercel.app';

  // ─── GET /connect ─────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/connect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400, headers: CORS });

    const { data: user } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
    if (!user) return new Response('User not found', { status: 404, headers: CORS });

    const clientId = Deno.env.get('TODOIST_CLIENT_ID');
    if (!clientId) return new Response('Todoist OAuth not configured', { status: 503, headers: CORS });

    const state = encodeState(userId);
    const authUrl = new URL(TODOIST_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', TODOIST_SCOPES);
    authUrl.searchParams.set('state', state);

    log('oauth_redirect', { userId });
    return Response.redirect(authUrl.toString(), 302);
  }

  // ─── GET /callback ────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      log('oauth_denied', { error });
      return Response.redirect(`${successUrl}?error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${successUrl}?error=missing_params`, 302);
    }

    const stateData = decodeState(state);
    if (!stateData) {
      return Response.redirect(`${successUrl}?error=expired_state`, 302);
    }

    const tokens = await exchangeCode(code);
    if (!tokens) {
      return Response.redirect(`${successUrl}?error=token_exchange_failed`, 302);
    }

    // Todoist tokens don't expire — set far-future expiry
    await supabase.from('oauth_tokens').upsert({
      user_id: stateData.userId,
      provider: 'todoist',
      scopes: [TODOIST_SCOPES],
      access_token: tokens.access_token,
      refresh_token: null,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Initialize sync_log
    await supabase.from('sync_log').upsert({
      user_id: stateData.userId,
      provider: 'todoist',
      last_sync_status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('oauth_complete', { userId: stateData.userId });

    // Immediate first sync — no reason to wait for pg_cron
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-todoist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ user_id: stateData.userId }),
    }).catch(() => {});

    return Response.redirect(`${successUrl}?connected=todoist`, 302);
  }

  // ─── GET /status ──────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/status')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response(JSON.stringify({ connected: false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('provider, updated_at')
      .eq('user_id', userId).eq('provider', 'todoist').maybeSingle();

    const { data: sync } = await supabase
      .from('sync_log')
      .select('last_sync_at, last_sync_status, records_synced')
      .eq('user_id', userId).eq('provider', 'todoist').maybeSingle();

    return new Response(JSON.stringify({
      connected: !!token,
      connected_at: token?.updated_at ?? null,
      last_sync: sync?.last_sync_at ?? null,
      last_status: sync?.last_sync_status ?? null,
      records: sync?.records_synced ?? 0,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ─── DELETE /disconnect ───────────────────────────────────
  if (req.method === 'DELETE' && path.endsWith('/disconnect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400, headers: CORS });

    await supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'todoist');
    await supabase.from('sync_log').delete().eq('user_id', userId).eq('provider', 'todoist');

    log('disconnected', { userId });
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response('Not Found', { status: 404, headers: CORS });
});

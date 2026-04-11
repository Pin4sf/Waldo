/**
 * Waldo — oauth-notion Edge Function
 *
 * Notion OAuth 2.0. Notion tokens do NOT expire (no refresh needed).
 *
 * Routes: /connect, /callback, /status, /disconnect
 *
 * Required Supabase Secrets:
 *   NOTION_CLIENT_ID       (from Notion integration settings)
 *   NOTION_CLIENT_SECRET
 *   OAUTH_REDIRECT_SUCCESS_URL
 *
 * Notion setup:
 *   1. Create integration at notion.so/my-integrations
 *   2. Set as "Public" integration (OAuth)
 *   3. Add redirect URI: https://<project>.supabase.co/functions/v1/oauth-notion/callback
 *   4. Request capabilities: Read content, Read user info
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-notion', event, ...data }));
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

    const clientId = Deno.env.get('NOTION_CLIENT_ID');
    if (!clientId) return new Response('Notion OAuth not configured', { status: 503, headers: CORS });

    const state = encodeState(userId);
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-notion/callback`;
    const authUrl = `${NOTION_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&owner=user&state=${state}`;

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

    const clientId = Deno.env.get('NOTION_CLIENT_ID');
    const clientSecret = Deno.env.get('NOTION_CLIENT_SECRET');
    if (!clientId || !clientSecret) return Response.redirect(`${successUrl}?error=not_configured`, 302);

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-notion/callback`;

    // Notion uses Basic auth for token exchange
    const creds = btoa(`${clientId}:${clientSecret}`);
    const resp = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!resp.ok) {
      log('token_exchange_failed', { status: resp.status });
      return Response.redirect(`${successUrl}?error=token_exchange_failed`, 302);
    }

    const tokens = await resp.json() as {
      access_token: string;
      workspace_name: string;
      workspace_id: string;
      bot_id: string;
    };

    // Notion tokens don't expire — set far-future expiry
    await supabase.from('oauth_tokens').upsert({
      user_id: stateData.userId,
      provider: 'notion',
      scopes: ['read_content'],
      access_token: tokens.access_token,
      refresh_token: null,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await supabase.from('sync_log').upsert({
      user_id: stateData.userId, provider: 'notion',
      last_sync_status: 'pending', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('oauth_complete', { userId: stateData.userId, workspace: tokens.workspace_name });

    // Immediate first sync
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-notion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ user_id: stateData.userId }),
    }).catch(() => {});

    return Response.redirect(`${successUrl}?connected=notion`, 302);
  }

  // ─── GET /status ──────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/status')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response(JSON.stringify({ connected: false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    const { data: token } = await supabase.from('oauth_tokens').select('updated_at').eq('user_id', userId).eq('provider', 'notion').maybeSingle();
    const { data: sync } = await supabase.from('sync_log').select('last_sync_at, last_sync_status, records_synced').eq('user_id', userId).eq('provider', 'notion').maybeSingle();

    return new Response(JSON.stringify({
      connected: !!token, last_sync: sync?.last_sync_at, last_status: sync?.last_sync_status, records: sync?.records_synced ?? 0,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ─── DELETE /disconnect ───────────────────────────────────
  if (req.method === 'DELETE' && path.endsWith('/disconnect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400, headers: CORS });
    await supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'notion');
    await supabase.from('sync_log').delete().eq('user_id', userId).eq('provider', 'notion');
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response('Not Found', { status: 404, headers: CORS });
});

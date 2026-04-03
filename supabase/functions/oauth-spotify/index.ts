/**
 * Waldo — oauth-spotify Edge Function
 *
 * Handles Spotify OAuth 2.0 flow (Authorization Code with PKCE is not needed
 * server-side; we use standard Authorization Code flow).
 *
 * Routes:
 *   GET /oauth-spotify/connect?user_id=<id>
 *     → Redirects to Spotify authorization page
 *
 *   GET /oauth-spotify/callback?code=<code>&state=<state>
 *     → Exchanges code for tokens, stores in oauth_tokens (provider='spotify')
 *     → Redirects to OAUTH_REDIRECT_SUCCESS_URL?connected=spotify
 *
 *   GET /oauth-spotify/status?user_id=<id>
 *     → Returns connection status + last sync
 *
 *   DELETE /oauth-spotify/disconnect?user_id=<id>
 *     → Removes tokens + sync log
 *
 * Required Supabase Secrets:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   OAUTH_REDIRECT_SUCCESS_URL  (same as Google, reused)
 *
 * Spotify Developer Console setup:
 *   1. Create app at developer.spotify.com
 *   2. Add redirect URI: https://<project>.supabase.co/functions/v1/oauth-spotify/callback
 *   3. Scopes: user-read-recently-played, user-top-read, user-read-playback-state, user-library-read
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const SPOTIFY_SCOPES = [
  'user-read-recently-played',  // recently played tracks (with audio features)
  'user-top-read',              // top tracks + artists (mood inference)
  'user-read-playback-state',   // current playback (real-time mood)
  'user-library-read',          // saved tracks
].join(' ');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-spotify', event, ...data }));
}

function encodeState(userId: string): string {
  return btoa(JSON.stringify({ userId, ts: Date.now() }));
}

function decodeState(state: string): { userId: string } | null {
  try {
    const parsed = JSON.parse(atob(state));
    if (!parsed.userId) return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null; // 10min expiry
    return parsed;
  } catch { return null; }
}

async function exchangeCode(code: string, redirectUri: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number; token_type: string;
} | null> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) { log('missing_spotify_creds'); return null; }

  const creds = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });

  if (!resp.ok) { log('token_exchange_failed', { status: resp.status }); return null; }
  return resp.json();
}

export async function refreshSpotifyToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId).eq('provider', 'spotify').maybeSingle();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() > Date.now() + 5 * 60 * 1000) return row.access_token;
  if (!row.refresh_token) return null;

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const creds = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: row.refresh_token, grant_type: 'refresh_token' }),
  });

  if (!resp.ok) return null;
  const tokens = await resp.json() as { access_token: string; expires_in: number };
  await supabase.from('oauth_tokens').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'spotify');

  return tokens.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const successUrl = Deno.env.get('OAUTH_REDIRECT_SUCCESS_URL') ?? 'https://waldo-console.vercel.app';

  // ─── GET /connect ────────────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/connect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400 });

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    if (!clientId) return new Response('Spotify not configured (SPOTIFY_CLIENT_ID missing)', { status: 503 });

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-spotify/callback`;
    const authUrl = new URL(SPOTIFY_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', SPOTIFY_SCOPES);
    authUrl.searchParams.set('state', encodeState(userId));
    authUrl.searchParams.set('show_dialog', 'true');

    log('oauth_redirect', { userId });
    return Response.redirect(authUrl.toString(), 302);
  }

  // ─── GET /callback ───────────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) return Response.redirect(`${successUrl}?error=spotify_denied`, 302);
    if (!code || !state) return Response.redirect(`${successUrl}?error=spotify_invalid`, 302);

    const stateData = decodeState(state);
    if (!stateData) return Response.redirect(`${successUrl}?error=spotify_expired`, 302);

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-spotify/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    if (!tokens) return Response.redirect(`${successUrl}?error=spotify_token_failed`, 302);

    await supabase.from('oauth_tokens').upsert({
      user_id: stateData.userId,
      provider: 'spotify',
      scopes: SPOTIFY_SCOPES.split(' '),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await supabase.from('sync_log').upsert({
      user_id: stateData.userId,
      provider: 'spotify',
      last_sync_status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('connected', { userId: stateData.userId });
    return Response.redirect(`${successUrl}?connected=spotify`, 302);
  }

  // ─── GET /status ─────────────────────────────────────────────────
  if (req.method === 'GET' && path.endsWith('/status')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400 });
    const [{ data: token }, { data: syncLog }] = await Promise.all([
      supabase.from('oauth_tokens').select('expires_at, scopes').eq('user_id', userId).eq('provider', 'spotify').maybeSingle(),
      supabase.from('sync_log').select('last_sync_at, last_sync_status, records_synced').eq('user_id', userId).eq('provider', 'spotify').maybeSingle(),
    ]);
    return new Response(JSON.stringify({ connected: token !== null, expires_at: token?.expires_at, sync: syncLog }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // ─── DELETE /disconnect ──────────────────────────────────────────
  if (req.method === 'DELETE' && path.endsWith('/disconnect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400 });
    await Promise.all([
      supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'spotify'),
      supabase.from('sync_log').delete().eq('user_id', userId).eq('provider', 'spotify'),
    ]);
    return new Response(JSON.stringify({ disconnected: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response('Not found', { status: 404 });
});

/**
 * Waldo — oauth-whoop Edge Function
 *
 * WHOOP OAuth 2.0 (Authorization Code grant) — same pattern as oauth-spotify.
 * 4 routes:
 *   GET /connect          → redirect to WHOOP authorization page
 *   GET /callback         → exchange code, save tokens to oauth_tokens
 *   GET /status           → check connection status for a user
 *   DELETE /disconnect    → revoke and delete tokens
 *
 * Required env vars:
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL (e.g. https://waldo.health)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const WHOOP_AUTH_URL  = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API       = 'https://api.prod.whoop.com/developer/v1';

const SCOPES = [
  'read:recovery',
  'read:sleep',
  'read:workout',
  'read:cycles',
  'read:profile',
  'read:body_measurement',
  'offline',
].join(' ');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-whoop', level, event, ...data }));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, ...CORS } });
}

// ─── State helpers (10-minute expiry, encodes user_id) ───────────
function encodeState(userId: string): string {
  const payload = { userId, exp: Date.now() + 10 * 60_000 };
  return btoa(JSON.stringify(payload));
}

function decodeState(state: string): { userId: string } | null {
  try {
    const payload = JSON.parse(atob(state)) as { userId: string; exp: number };
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const url      = new URL(req.url);
  const pathname = url.pathname.replace(/.*\/oauth-whoop/, '');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const clientId     = Deno.env.get('WHOOP_CLIENT_ID');
  const clientSecret = Deno.env.get('WHOOP_CLIENT_SECRET');
  const appUrl       = Deno.env.get('APP_URL') ?? 'http://localhost:3000';

  // ── GET /connect ─────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/connect') {
    const userId = url.searchParams.get('user_id');
    if (!userId || !clientId) return json({ error: 'missing user_id or client config' }, 400);

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-whoop/callback`;
    const authUrl = new URL(WHOOP_AUTH_URL);
    authUrl.searchParams.set('client_id',     clientId);
    authUrl.searchParams.set('redirect_uri',  callbackUrl);
    authUrl.searchParams.set('scope',         SCOPES);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state',         encodeState(userId));

    log('info', 'connect_redirect', { userId });
    return redirect(authUrl.toString());
  }

  // ── GET /callback ────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/callback') {
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      log('warn', 'oauth_denied', { error });
      return redirect(`${appUrl}/settings?whoop=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code || !state) return json({ error: 'missing code or state' }, 400);

    const decoded = decodeState(state);
    if (!decoded) {
      log('warn', 'state_invalid_or_expired');
      return redirect(`${appUrl}/settings?whoop=error&reason=state_expired`);
    }

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-whoop/callback`;
    const tokenResp = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  callbackUrl,
        client_id:     clientId!,
        client_secret: clientSecret!,
      }),
    });

    if (!tokenResp.ok) {
      const body = await tokenResp.text();
      log('error', 'token_exchange_failed', { status: tokenResp.status, body: body.slice(0, 200) });
      return redirect(`${appUrl}/settings?whoop=error&reason=token_exchange`);
    }

    const tokens = await tokenResp.json() as {
      access_token:  string;
      refresh_token: string;
      expires_in:    number;
      token_type:    string;
    };

    const { userId } = decoded;

    await supabase.from('oauth_tokens').upsert({
      user_id:       userId,
      provider:      'whoop',
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type:    tokens.token_type ?? 'Bearer',
      expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes:        SCOPES.split(' '),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await supabase.from('sync_log').upsert({
      user_id:          userId,
      provider:         'whoop',
      last_sync_status: 'connected',
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('info', 'connected', { userId });

    // Trigger full history backfill in background (fire-and-forget)
    // mode=full: no startDate — fetches entire WHOOP membership history
    const backfillUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whoop-backfill`;
    fetch(backfillUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ user_id: userId, mode: 'full' }),
    }).catch(() => { /* fire-and-forget */ });

    return redirect(`${appUrl}/settings?whoop=connected`);
  }

  // ── GET /status ──────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/status') {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ error: 'missing user_id' }, 400);

    const { data: tokenRow } = await supabase
      .from('oauth_tokens')
      .select('expires_at, scopes, updated_at')
      .eq('user_id', userId).eq('provider', 'whoop').maybeSingle();

    const { data: syncRow } = await supabase
      .from('sync_log')
      .select('last_sync_at, last_sync_status, records_synced')
      .eq('user_id', userId).eq('provider', 'whoop').maybeSingle();

    return json({
      connected:     !!tokenRow,
      expires_at:    tokenRow?.expires_at ?? null,
      scopes:        tokenRow?.scopes ?? [],
      last_sync_at:  syncRow?.last_sync_at ?? null,
      sync_status:   syncRow?.last_sync_status ?? null,
      records_synced: syncRow?.records_synced ?? 0,
    });
  }

  // ── DELETE /disconnect ────────────────────────────────────────
  if (req.method === 'DELETE' && pathname === '/disconnect') {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ error: 'missing user_id' }, 400);

    await supabase.from('oauth_tokens').delete()
      .eq('user_id', userId).eq('provider', 'whoop');

    await supabase.from('sync_log').upsert({
      user_id:          userId,
      provider:         'whoop',
      last_sync_status: 'disconnected',
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    log('info', 'disconnected', { userId });
    return json({ ok: true });
  }

  return json({ error: 'not found' }, 404);
});

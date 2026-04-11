/**
 * Waldo — oauth-google Edge Function
 *
 * Handles the Google OAuth 2.0 flow for all Google Workspace integrations:
 * - Google Calendar (read events)
 * - Gmail (metadata only — no body content)
 * - Google Tasks (read tasks)
 *
 * Routes:
 *   GET /oauth-google/connect?user_id=<id>&scopes=calendar,gmail,tasks
 *     → Redirects user to Google OAuth consent page
 *
 *   GET /oauth-google/callback?code=<code>&state=<state>
 *     → Exchanges code for tokens, stores in oauth_tokens table
 *     → Redirects to success page (app deep link or web page)
 *
 * OAuth app setup required (Google Cloud Console):
 *   - Authorized redirect URI: https://<project>.supabase.co/functions/v1/oauth-google/callback
 *   - Scopes: calendar.readonly, gmail.metadata, tasks.readonly
 *
 * Env vars required (set in Supabase dashboard → Edge Functions → Secrets):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   OAUTH_REDIRECT_SUCCESS_URL  (where to send user after connect — e.g. your app deep link)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

// Scopes — carefully minimal
const SCOPE_DEFINITIONS: Record<string, string> = {
  calendar:  'https://www.googleapis.com/auth/calendar.readonly',
  gmail:     'https://www.googleapis.com/auth/gmail.readonly',        // gmail.metadata restricted for new GCP projects; readonly needed for message listing
  tasks:     'https://www.googleapis.com/auth/tasks.readonly',
  youtube:   'https://www.googleapis.com/auth/youtube.readonly',     // YouTube Music liked videos
  // Google Fit — syncs from Health Connect on Android + any paired wearable
  fit_heart: 'https://www.googleapis.com/auth/fitness.heart_rate.read',
  fit_sleep: 'https://www.googleapis.com/auth/fitness.sleep.read',
  fit_steps: 'https://www.googleapis.com/auth/fitness.activity.read',
};

const ALL_SCOPES = Object.values(SCOPE_DEFINITIONS);

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'oauth-google', level, event, ...data }));
}

function errorRedirect(message: string): Response {
  const successUrl = Deno.env.get('OAUTH_REDIRECT_SUCCESS_URL') ?? 'https://waldo.app';
  return Response.redirect(`${successUrl}?error=${encodeURIComponent(message)}`, 302);
}

function successRedirect(provider: string): Response {
  const successUrl = Deno.env.get('OAUTH_REDIRECT_SUCCESS_URL') ?? 'https://waldo.app';
  return Response.redirect(`${successUrl}?connected=${provider}`, 302);
}

// ─── State encoding (userId + requested scopes, base64) ────────
function encodeState(userId: string, scopes: string[]): string {
  return btoa(JSON.stringify({ userId, scopes, ts: Date.now() }));
}

function decodeState(state: string): { userId: string; scopes: string[] } | null {
  try {
    const parsed = JSON.parse(atob(state));
    if (!parsed.userId || !Array.isArray(parsed.scopes)) return null;
    // Reject states older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Token exchange ────────────────────────────────────────────
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
} | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    log('error', 'missing_google_credentials');
    return null;
  }

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    log('error', 'token_exchange_failed', { status: resp.status, body: err.slice(0, 200) });
    return null;
  }

  return resp.json().catch(() => null);
}

// ─── Store tokens ──────────────────────────────────────────────
async function storeTokens(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in: number; token_type: string },
  scopes: string[],
  googleEmail?: string | null,
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from('oauth_tokens')
    .upsert({
      user_id: userId,
      provider: 'google',
      scopes,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type ?? 'Bearer',
      expires_at: expiresAt,
      google_email: googleEmail ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

  // Initialize sync_log entries for each scope
  const syncProviders = scopes
    .filter(s => s.includes('calendar') || s.includes('gmail') || s.includes('tasks'))
    .map(s => {
      if (s.includes('calendar')) return 'google_calendar';
      if (s.includes('gmail')) return 'gmail';
      if (s.includes('tasks')) return 'google_tasks';
      return null;
    })
    .filter((p): p is string => p !== null);

  for (const provider of syncProviders) {
    await supabase
      .from('sync_log')
      .upsert({
        user_id: userId,
        provider,
        last_sync_status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });
  }
}

// ─── Token refresh ──────────────────────────────────────────────
export async function refreshGoogleToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (!tokenRow) return null;

  // Token still valid (with 5-minute buffer)
  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) return null;

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) return null;

  const tokens = await resp.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from('oauth_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'google');

  return tokens.access_token;
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ─── GET /oauth-google/connect ─────────────────────────────
  if (req.method === 'GET' && path.endsWith('/connect')) {
    const userId = url.searchParams.get('user_id');
    const scopeParam = url.searchParams.get('scopes') ?? 'calendar,gmail,tasks';

    if (!userId) {
      return new Response('Missing user_id', { status: 400 });
    }

    // Validate user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    const requestedKeys = scopeParam.split(',').map(s => s.trim()).filter(s => s in SCOPE_DEFINITIONS);
    const scopes = requestedKeys.map(k => SCOPE_DEFINITIONS[k]);

    if (scopes.length === 0) {
      return new Response(`Invalid scopes. Valid: ${Object.keys(SCOPE_DEFINITIONS).join(', ')}`, { status: 400 });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      return new Response('Google OAuth not configured (missing GOOGLE_CLIENT_ID)', { status: 503 });
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-google/callback`;
    const state = encodeState(userId, scopes);

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');   // get refresh token
    authUrl.searchParams.set('prompt', 'consent');        // force refresh token re-issue
    authUrl.searchParams.set('state', state);

    log('info', 'oauth_redirect', { userId, scopes: requestedKeys });
    return Response.redirect(authUrl.toString(), 302);
  }

  // ─── GET /oauth-google/callback ────────────────────────────
  if (req.method === 'GET' && path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      log('warn', 'oauth_denied', { error });
      return errorRedirect(`Google connection denied: ${error}`);
    }

    if (!code || !state) {
      return errorRedirect('Invalid OAuth callback — missing code or state');
    }

    const stateData = decodeState(state);
    if (!stateData) {
      return errorRedirect('Invalid or expired OAuth state — please try connecting again');
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens) {
      return errorRedirect('Failed to exchange Google authorization code — please try again');
    }

    // Validate granted scopes — Google may grant fewer scopes than requested
    const requestedScopes = stateData.scopes;
    let grantedScopes: string[];

    if (tokens.scope) {
      // Google returns granted scopes as a space-separated string
      const grantedSet = new Set(tokens.scope.split(' ').filter(Boolean));
      grantedScopes = requestedScopes.filter(s => grantedSet.has(s));

      const deniedScopes = requestedScopes.filter(s => !grantedSet.has(s));
      if (deniedScopes.length > 0) {
        log('warn', 'oauth_partial_scopes', {
          userId: stateData.userId,
          requested: requestedScopes,
          granted: grantedScopes,
          denied: deniedScopes,
        });
      }
    } else {
      // If Google didn't return scope field, assume all requested were granted (pre-2019 behavior)
      grantedScopes = requestedScopes;
      log('warn', 'oauth_no_scope_in_response', { userId: stateData.userId });
    }

    if (grantedScopes.length === 0) {
      return errorRedirect('Google did not grant any of the requested permissions — please try again');
    }

    // Fetch the connected Google account's email via userinfo endpoint
    let googleEmail: string | null = null;
    try {
      const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userinfoResp.ok) {
        const info = await userinfoResp.json() as { email?: string };
        googleEmail = info.email ?? null;
      }
    } catch {
      // Non-fatal — email is nice-to-have, not blocking
    }

    await storeTokens(supabase, stateData.userId, tokens, grantedScopes, googleEmail);

    // Also store email on the users table if it's currently null
    if (googleEmail) {
      await supabase
        .from('users')
        .update({ email: googleEmail })
        .eq('id', stateData.userId)
        .is('email', null); // only set if not already set
    }

    log('info', 'oauth_connected', { userId: stateData.userId, scopesGranted: grantedScopes.length, scopesRequested: requestedScopes.length, googleEmail });

    // ─── Immediate first sync (fire-and-forget, don't block redirect) ─
    // No reason to wait for pg_cron — Google APIs are queryable instantly after OAuth.
    const fnBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
    const syncHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    };
    const syncBody = JSON.stringify({ user_id: stateData.userId });

    // Fire all applicable syncs in parallel — don't await, don't block the redirect
    const syncFunctions = ['sync-google-calendar', 'sync-gmail', 'sync-tasks'];
    if (grantedScopes.some(s => s.includes('fit'))) {
      syncFunctions.push('sync-google-fit');
    }

    for (const fn of syncFunctions) {
      fetch(`${fnBase}/${fn}`, { method: 'POST', headers: syncHeaders, body: syncBody }).catch(() => {});
    }

    log('info', 'first_sync_triggered', { userId: stateData.userId, functions: syncFunctions });
    return successRedirect('google');
  }

  // ─── GET /oauth-google/status ──────────────────────────────
  if (req.method === 'GET' && path.endsWith('/status')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400 });

    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('scopes, expires_at, updated_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    const { data: syncLogs } = await supabase
      .from('sync_log')
      .select('provider, last_sync_at, last_sync_status, records_synced')
      .eq('user_id', userId)
      .like('provider', 'google%');

    return new Response(JSON.stringify({
      connected: token !== null,
      expires_at: token?.expires_at ?? null,
      scopes: token?.scopes ?? [],
      syncs: syncLogs ?? [],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── DELETE /oauth-google/disconnect ──────────────────────
  if (req.method === 'DELETE' && path.endsWith('/disconnect')) {
    const userId = url.searchParams.get('user_id');
    if (!userId) return new Response('Missing user_id', { status: 400 });

    await supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'google');
    await supabase.from('sync_log').delete().eq('user_id', userId).like('provider', 'google%');

    log('info', 'oauth_disconnected', { userId });
    return new Response(JSON.stringify({ disconnected: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Not found', { status: 404 });
});

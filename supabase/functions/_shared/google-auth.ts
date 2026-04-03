/**
 * Shared Google OAuth helpers for Waldo Edge Functions.
 * Used by sync-google-calendar, sync-gmail, sync-tasks.
 */
import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleTokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string[];
}

/**
 * Get a valid access token for a user, refreshing if expired.
 * Returns null if the user has no Google token or if refresh fails.
 */
export async function getValidGoogleToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at, scopes')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (!tokenRow) return null;

  // Token still valid (5-min buffer)
  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  // Need to refresh
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

  if (!resp.ok) {
    const body = await resp.text();
    console.error(JSON.stringify({ event: 'token_refresh_failed', userId, status: resp.status, body: body.slice(0, 200) }));
    // Mark token as expired in sync_log
    await supabase.from('sync_log').upsert(
      { user_id: userId, provider: 'google', last_sync_status: 'token_expired', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' },
    );
    return null;
  }

  const tokens = await resp.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from('oauth_tokens')
    .update({ access_token: tokens.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('provider', 'google');

  return tokens.access_token;
}

/** Update sync_log for a provider after a sync attempt. */
export async function recordSync(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
  status: 'ok' | 'error' | 'no_token' | 'token_expired',
  recordsSynced = 0,
  error?: string,
): Promise<void> {
  await supabase.from('sync_log').upsert(
    {
      user_id: userId,
      provider,
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      records_synced: recordsSynced,
      last_error: error ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
}

/** Google API fetch with automatic 401 detection (revoked token). */
export async function googleFetch(
  url: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const fullUrl = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      fullUrl.searchParams.set(k, v);
    }
  }

  const resp = await fetch(fullUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    return { ok: false, status: resp.status, data: null };
  }

  const data = await resp.json();
  return { ok: true, status: 200, data };
}

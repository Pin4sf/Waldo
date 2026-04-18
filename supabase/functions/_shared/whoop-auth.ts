/**
 * Shared WHOOP token refresh helper.
 * Imported by: oauth-whoop, whoop-backfill, sync-whoop.
 * Kept in _shared/ so importing never pulls in a Deno.serve() call.
 */
import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'whoop-auth', level, event, ...data }));
}

export async function refreshWhoopToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId).eq('provider', 'whoop').maybeSingle();

  if (!row) return null;

  // Token still valid (5-minute buffer)
  if (new Date(row.expires_at as string).getTime() > Date.now() + 5 * 60_000) {
    return row.access_token as string;
  }

  if (!row.refresh_token) return null;

  const clientId     = Deno.env.get('WHOOP_CLIENT_ID');
  const clientSecret = Deno.env.get('WHOOP_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: row.refresh_token as string,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    log('error', 'token_refresh_failed', { userId, status: resp.status });
    return null;
  }

  const tokens = await resp.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  await supabase.from('oauth_tokens').update({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'whoop');

  return tokens.access_token;
}

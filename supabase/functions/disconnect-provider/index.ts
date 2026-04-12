/**
 * disconnect-provider — Remove OAuth tokens + clear sync logs for a provider.
 *
 * Uses service_role to bypass RLS (oauth_tokens only allows service_role deletes).
 * Called from the Connectors tab Disconnect button.
 *
 * POST /disconnect-provider
 * Body: { user_id: string, provider: 'google' | 'spotify' | 'todoist' | 'strava' | 'notion' }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RELATED_PROVIDERS: Record<string, string[]> = {
  google:  ['google_calendar', 'gmail', 'google_tasks', 'youtube_music', 'google_fit'],
  spotify: ['spotify'],
  todoist: ['todoist'],
  strava:  ['strava'],
  notion:  ['notion'],
};

const VALID_PROVIDERS = Object.keys(RELATED_PROVIDERS);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json() as { user_id?: string; provider?: string };
    const { user_id, provider } = body;

    if (!user_id || !provider) {
      return new Response(JSON.stringify({ error: 'user_id and provider required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      return new Response(JSON.stringify({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Service role — bypasses RLS to delete tokens
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Delete OAuth token
    const { error: tokenErr } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user_id)
      .eq('provider', provider);

    if (tokenErr) {
      console.error(JSON.stringify({ event: 'token_delete_failed', provider, error: tokenErr.message }));
    }

    // Clear all related sync logs
    for (const related of RELATED_PROVIDERS[provider] ?? []) {
      await supabase.from('sync_log').delete().eq('user_id', user_id).eq('provider', related);
    }

    console.log(JSON.stringify({ event: 'provider_disconnected', user_id, provider }));
    return new Response(JSON.stringify({ ok: true, provider }), { headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
});

/**
 * Waldo — sync-spotify Edge Function
 *
 * Runs nightly at 3:30 AM UTC. Uses Spotify Web API to get:
 * - Recently played tracks (last 50, with timestamps)
 * - Audio features per track: valence (happiness), energy, tempo, danceability
 *
 * This gives FAR better mood inference than YouTube Music because Spotify
 * exposes actual audio analysis per track (0.0-1.0 valence, energy, tempo BPM).
 *
 * Mood mapping:
 *   high energy + high valence  → 'energized'
 *   low energy  + high valence  → 'calm'
 *   high energy + low valence   → 'intense'
 *   low energy  + low valence   → 'melancholic'
 *   mid values                  → 'focused'
 *
 * Writes to: mood_metrics (provider = 'spotify')
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshSpotifyToken } from '../oauth-spotify/index.ts';

const SPOTIFY_API = 'https://api.spotify.com/v1';

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-spotify', event, ...data }));
}

async function spotifyGet(url: string, token: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return { ok: false, status: resp.status, data: null };
  return { ok: true, status: 200, data: await resp.json() };
}

function inferMood(avgEnergy: number, avgValence: number): string {
  if (avgEnergy >= 0.65 && avgValence >= 0.55) return 'energized';
  if (avgEnergy <= 0.40 && avgValence >= 0.55) return 'calm';
  if (avgEnergy >= 0.65 && avgValence <= 0.40) return 'intense';
  if (avgEnergy <= 0.40 && avgValence <= 0.40) return 'melancholic';
  return 'focused';
}

function isLateNight(timestampMs: number, tzOffsetMs: number): boolean {
  const localHour = new Date(timestampMs + tzOffsetMs).getUTCHours();
  return localHour >= 23 || localHour < 4;
}

function getTzOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
    const local = now.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const [lH, lM] = local.split(':').map(Number);
    return ((lH! - utcH) * 60 + (lM! - utcM)) * 60 * 1000;
  } catch { return 0; }
}

async function syncUserSpotify(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<{ ok: boolean; tracksProcessed: number; error?: string }> {
  const token = await refreshSpotifyToken(supabase, userId);
  if (!token) {
    await supabase.from('sync_log').upsert({ user_id: userId, provider: 'spotify', last_sync_status: 'no_token', updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    return { ok: false, tracksProcessed: 0, error: 'no_token' };
  }

  // Get recently played (last 50 tracks, up to 24h ago)
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const result = await spotifyGet(`${SPOTIFY_API}/me/player/recently-played?limit=50&after=${since}`, token);

  if (!result.ok) {
    const status = result.status === 401 ? 'token_expired' : 'error';
    await supabase.from('sync_log').upsert({ user_id: userId, provider: 'spotify', last_sync_status: status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    return { ok: false, tracksProcessed: 0, error: `API ${result.status}` };
  }

  const items = ((result.data as any).items ?? []) as Array<{
    track: { id: string; duration_ms: number; name: string };
    played_at: string;
  }>;

  if (items.length === 0) {
    await supabase.from('sync_log').upsert({ user_id: userId, provider: 'spotify', last_sync_status: 'ok', records_synced: 0, last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    return { ok: true, tracksProcessed: 0 };
  }

  // Get audio features for all track IDs (batch of 100 max)
  const trackIds = [...new Set(items.map(i => i.track.id))].slice(0, 100).join(',');
  const featResult = await spotifyGet(`${SPOTIFY_API}/audio-features?ids=${trackIds}`, token);
  const features: Record<string, { energy: number; valence: number; tempo: number; danceability: number }> = {};

  if (featResult.ok) {
    for (const f of ((featResult.data as any).audio_features ?? [])) {
      if (f?.id) features[f.id] = { energy: f.energy, valence: f.valence, tempo: f.tempo, danceability: f.danceability };
    }
  }

  // Group by date, compute daily mood metrics
  const tzOffset = getTzOffsetMs(timezone);
  const byDate = new Map<string, { energies: number[]; valences: number[]; tempos: number[]; minutes: number; lateNight: boolean; sampleTitles: string[] }>();

  for (const item of items) {
    const tsMs = new Date(item.played_at).getTime();
    const dateKey = new Date(tsMs + tzOffset).toISOString().slice(0, 10);
    const f = features[item.track.id];
    if (!byDate.has(dateKey)) byDate.set(dateKey, { energies: [], valences: [], tempos: [], minutes: 0, lateNight: false, sampleTitles: [] });
    const d = byDate.get(dateKey)!;
    if (f) { d.energies.push(f.energy); d.valences.push(f.valence); d.tempos.push(f.tempo); }
    d.minutes += Math.round(item.track.duration_ms / 60000);
    if (isLateNight(tsMs, tzOffset)) d.lateNight = true;
    if (d.sampleTitles.length < 3) d.sampleTitles.push(item.track.name.slice(0, 50));
  }

  const rows = [];
  for (const [date, d] of byDate) {
    const avgEnergy = d.energies.length > 0 ? d.energies.reduce((a, b) => a + b, 0) / d.energies.length : 0.5;
    const avgValence = d.valences.length > 0 ? d.valences.reduce((a, b) => a + b, 0) / d.valences.length : 0.5;
    const avgTempo = d.tempos.length > 0 ? d.tempos.reduce((a, b) => a + b, 0) / d.tempos.length : null;

    rows.push({
      user_id: userId,
      date,
      provider: 'spotify',
      tracks_played: items.filter(i => new Date(new Date(i.played_at).getTime() + tzOffset).toISOString().slice(0, 10) === date).length,
      avg_energy: Math.round(avgEnergy * 100) / 100,
      avg_valence: Math.round(avgValence * 100) / 100,
      avg_tempo: avgTempo ? Math.round(avgTempo) : null,
      listening_minutes: d.minutes,
      late_night_listening: d.lateNight,
      dominant_mood: inferMood(avgEnergy, avgValence),
      raw_summary: { sample_titles: d.sampleTitles, data_source: 'spotify_recently_played' },
    });
  }

  if (rows.length > 0) {
    await supabase.from('mood_metrics').upsert(rows, { onConflict: 'user_id,date,provider' });
  }

  await supabase.from('sync_log').upsert({
    user_id: userId, provider: 'spotify', last_sync_status: 'ok',
    records_synced: items.length, last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  log('synced', { userId, tracks: items.length, days: byDate.size });
  return { ok: true, tracksProcessed: items.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetUserId: string | null = body.user_id ?? null;

  // Get users with Spotify connected
  const query = supabase.from('oauth_tokens').select('user_id, users!inner(timezone, active)').eq('provider', 'spotify').eq('users.active', true);
  if (targetUserId) query.eq('user_id', targetUserId);

  const { data: rows } = await query;
  if (!rows?.length) return new Response(JSON.stringify({ synced: 0, reason: 'No users with Spotify connected' }), { headers: { 'Content-Type': 'application/json' } });

  const results = await Promise.allSettled(rows.map(r => syncUserSpotify(supabase, r.user_id, (r.users as any).timezone ?? 'UTC')));
  const synced = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length;

  return new Response(JSON.stringify({ synced, total: rows.length }), { headers: { 'Content-Type': 'application/json' } });
});

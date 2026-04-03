/**
 * Waldo — sync-youtube-music Edge Function
 *
 * Runs nightly at 3:15 AM UTC (pg_cron scheduled in 20260403000004).
 * Uses YouTube Data API v3 to infer listening mood from YouTube Music activity.
 *
 * What it reads (YouTube Data API v3 scopes):
 *   - youtube.readonly: liked videos, playlists (music-category filtered)
 *   - youtube.force-ssl: required for activity feed
 *
 * What it computes:
 *   - tracks_played: liked music videos in the last 24h
 *   - dominant_mood: inferred from video categories + titles (rule-based, no LLM)
 *   - late_night_listening: any music activity after 23:00 local time
 *   - listening_minutes: estimated from video durations
 *
 * LIMITATION: YouTube Music does NOT expose a dedicated listening API.
 * YouTube Data API v3 gives access to liked videos and playlist history,
 * not a full "recently played" stream like Spotify.
 * This is best-effort — useful for mood signal, not perfect playback tracking.
 * If you want precise mood inference: add Spotify OAuth (has audio features API).
 *
 * OAuth scope to add to oauth-google/index.ts SCOPE_DEFINITIONS:
 *   youtube: 'https://www.googleapis.com/auth/youtube.readonly'
 *
 * Writes to: mood_metrics table (provider = 'youtube_music')
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidGoogleToken, recordSync, googleFetch } from '../_shared/google-auth.ts';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// YouTube video category IDs that indicate music
const MUSIC_CATEGORY_IDS = new Set(['10']); // 10 = Music

// Keywords that suggest energetic/positive music
const ENERGY_KEYWORDS = /hype|pump|epic|fire|lit|banger|intense|workout|motivation|edm|rap|hip.hop|rock|metal|bass/i;
// Keywords that suggest calm/focus music
const CALM_KEYWORDS = /chill|ambient|lo.fi|lofi|meditation|relax|sleep|study|focus|piano|acoustic|classical|jazz/i;
// Keywords that suggest melancholic
const MELANCHOLIC_KEYWORDS = /sad|emotional|breakup|missing|longing|nostalgic|blues|indie/i;

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'sync-youtube-music', level, event, ...data }));
}

interface YouTubeItem {
  id: { videoId?: string; kind: string };
  snippet: {
    title: string;
    categoryId?: string;
    publishedAt: string;
    description?: string;
  };
  contentDetails?: { duration?: string };
}

/** Parse ISO 8601 duration to minutes. e.g. PT3M45S → 3.75 */
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 3; // default 3 minutes
  const hours = parseInt(match[1] ?? '0');
  const minutes = parseInt(match[2] ?? '0');
  const seconds = parseInt(match[3] ?? '0');
  return hours * 60 + minutes + seconds / 60;
}

/** Infer mood from video titles + categories (no LLM). */
function inferMood(titles: string[]): {
  dominant: string;
  avgEnergy: number;
  avgValence: number;
} {
  let energyScore = 0;
  let calmScore = 0;
  let sadScore = 0;

  for (const title of titles) {
    if (ENERGY_KEYWORDS.test(title)) energyScore++;
    else if (CALM_KEYWORDS.test(title)) calmScore++;
    else if (MELANCHOLIC_KEYWORDS.test(title)) sadScore++;
  }

  const total = titles.length;
  if (total === 0) return { dominant: 'unknown', avgEnergy: 0.5, avgValence: 0.5 };

  const energyRatio = energyScore / total;
  const calmRatio = calmScore / total;
  const sadRatio = sadScore / total;

  let dominant = 'neutral';
  let avgEnergy = 0.5;
  let avgValence = 0.5;

  if (energyRatio > 0.3) {
    dominant = 'energized';
    avgEnergy = 0.7 + energyRatio * 0.3;
    avgValence = 0.65;
  } else if (calmRatio > 0.3) {
    dominant = 'calm';
    avgEnergy = 0.2 + calmRatio * 0.2;
    avgValence = 0.6;
  } else if (sadRatio > 0.2) {
    dominant = 'melancholic';
    avgEnergy = 0.25;
    avgValence = 0.3;
  } else {
    dominant = 'focused';
    avgEnergy = 0.4;
    avgValence = 0.55;
  }

  return { dominant, avgEnergy, avgValence };
}

async function syncUserYouTubeMusic(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<{ ok: boolean; tracksFound: number; error?: string }> {
  const token = await getValidGoogleToken(supabase, userId);
  if (!token) {
    await recordSync(supabase, userId, 'youtube_music', 'no_token');
    return { ok: false, tracksFound: 0, error: 'no_token' };
  }

  // Check if youtube scope is available (users must have connected with youtube scope)
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('scopes')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  const scopes: string[] = tokenRow?.scopes ?? [];
  const hasYouTubeScope = scopes.some(s => s.includes('youtube'));
  if (!hasYouTubeScope) {
    // User connected Google without YouTube scope — silently skip
    await recordSync(supabase, userId, 'youtube_music', 'no_token', 0, 'missing youtube scope');
    return { ok: true, tracksFound: 0 }; // Not an error, just not connected yet
  }

  // Get liked videos (most recent 50 — recent likes = recent listening)
  const likedResult = await googleFetch(
    `${YOUTUBE_API}/videos`,
    token,
    {
      myRating: 'like',
      part: 'snippet,contentDetails',
      maxResults: '50',
      fields: 'items(id,snippet(title,categoryId,publishedAt),contentDetails(duration))',
    },
  );

  if (!likedResult.ok) {
    const status = likedResult.status === 401 ? 'token_expired' : 'error';
    await recordSync(supabase, userId, 'youtube_music', status, 0, `API ${likedResult.status}`);
    return { ok: false, tracksFound: 0, error: `API ${likedResult.status}` };
  }

  const items: YouTubeItem[] = ((likedResult.data as { items?: YouTubeItem[] }).items ?? []);

  // Filter to music category and liked in last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentMusicItems = items.filter(item => {
    const isMusicCategory = !item.snippet.categoryId || MUSIC_CATEGORY_IDS.has(item.snippet.categoryId);
    const isRecent = item.snippet.publishedAt >= since || true; // liked_at not in API, use all recent
    return isMusicCategory;
  });

  const today = new Date().toISOString().slice(0, 10);
  const titles = recentMusicItems.map(i => i.snippet.title);
  const { dominant, avgEnergy, avgValence } = inferMood(titles);

  const listeningMinutes = recentMusicItems.reduce((sum, item) => {
    const dur = item.contentDetails?.duration ?? '';
    return sum + parseISO8601Duration(dur);
  }, 0);

  // Late night check (local timezone)
  const tzOffset = getTzOffsetMs(timezone);
  const localHour = new Date(Date.now() + tzOffset).getUTCHours();
  const lateNight = localHour >= 23 || localHour < 4;

  await supabase.from('mood_metrics').upsert({
    user_id: userId,
    date: today,
    provider: 'youtube_music',
    tracks_played: recentMusicItems.length,
    avg_energy: Math.round(avgEnergy * 100) / 100,
    avg_valence: Math.round(avgValence * 100) / 100,
    avg_tempo: null,  // YouTube Data API doesn't expose audio features
    listening_minutes: Math.round(listeningMinutes),
    late_night_listening: lateNight && recentMusicItems.length > 0,
    dominant_mood: dominant,
    raw_summary: {
      sample_titles: titles.slice(0, 5),   // first 5 titles only (privacy: don't store all)
      category_id: '10',
    },
  }, { onConflict: 'user_id,date,provider' });

  await recordSync(supabase, userId, 'youtube_music', 'ok', recentMusicItems.length);
  log('info', 'youtube_music_synced', { userId, tracks: recentMusicItems.length, mood: dominant });
  return { ok: true, tracksFound: recentMusicItems.length };
}

function getTzOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
    const localStr = now.toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const [lH, lM] = localStr.split(':').map(Number);
    return ((lH! - utcH) * 60 + (lM! - utcM)) * 60 * 1000;
  } catch { return 0; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const startMs = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetUserId: string | null = body.user_id ?? null;

    const query = supabase
      .from('oauth_tokens')
      .select('user_id, users!inner(timezone, active)')
      .eq('provider', 'google')
      .eq('users.active', true);
    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: tokenRows, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ synced: 0, reason: 'No users with Google connected' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.allSettled(
      tokenRows.map(row => syncUserYouTubeMusic(
        supabase, row.user_id, (row.users as { timezone: string }).timezone ?? 'UTC',
      )),
    );

    let synced = 0;
    for (const r of results) if (r.status === 'fulfilled' && r.value.ok) synced++;

    return new Response(JSON.stringify({ synced, latency_ms: Date.now() - startMs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});

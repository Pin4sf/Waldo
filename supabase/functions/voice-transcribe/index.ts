/**
 * voice-transcribe — Speech-to-Text via Groq Whisper
 *
 * POST /voice-transcribe
 * Body: multipart/form-data with 'audio' file field
 * Returns: { transcript: string }
 *
 * Used by the web console mic button. Same Groq transcription
 * as telegram-bot voice messages but via HTTP instead of Telegram.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Accept raw audio bytes or multipart form
    const contentType = req.headers.get('content-type') ?? '';
    let audioBlob: Blob;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('audio') as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'audio field required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = file;
    } else {
      // Raw audio bytes (webm/ogg from MediaRecorder)
      const bytes = await req.arrayBuffer();
      audioBlob = new Blob([bytes], { type: contentType || 'audio/webm' });
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'text');
    // Auto-detect language — handles Hindi/English code-switching

    const groqRes = await fetch(GROQ_STT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}` },
      body: formData,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('[STT] Groq error:', groqRes.status, err);
      return new Response(JSON.stringify({ error: 'Transcription failed', detail: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcript = await groqRes.text();
    return new Response(JSON.stringify({ transcript: transcript.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[STT] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * tts — Text-to-Speech via Groq PlayAI
 *
 * POST /tts
 * Body: { text: string, voice?: string }
 * Returns: audio/mpeg binary stream
 *
 * Voices: Fritz-PlayAI (default, calm male), Celeste-PlayAI (warm female),
 *         Liam-PlayAI, Aria-PlayAI
 * Cost: ~$0.006/1000 chars at Groq pricing
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';
const DEFAULT_VOICE = 'Fritz-PlayAI';
const MODEL = 'playai-tts';

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
    const { text, voice = DEFAULT_VOICE } = await req.json() as { text: string; voice?: string };

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strip italic markers and clean text for speech
    const cleanText = text
      .replace(/\*([^*]+)\*/g, '$1')  // *italic* → italic
      .replace(/\n+/g, '. ')
      .replace(/·/g, ',')
      .trim()
      .slice(0, 4096); // Groq TTS max input

    const groqRes = await fetch(GROQ_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: cleanText,
        voice,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('[TTS] Groq error:', groqRes.status, err);
      return new Response(JSON.stringify({ error: 'TTS generation failed', detail: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream audio back
    const audioBuffer = await groqRes.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });

  } catch (err) {
    console.error('[TTS] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

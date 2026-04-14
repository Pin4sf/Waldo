/**
 * TheBrief — Hero card in center column
 *
 * Includes:
 * - Dalmatian mascot + zone-aware animation
 * - Large serif narrative
 * - 🔊 Play button — calls /tts EF, plays Morning Wag as audio (Groq PlayAI)
 * - Patrol footer
 */
import { useState, useRef } from 'react';
import { SUPABASE_FN_URL } from '../../supabase-api.js';

interface TheBriefProps {
  message: string | null;
  zone?: 'peak' | 'moderate' | 'low' | 'nodata';
  isLoading?: boolean;
  timestamp?: string;
}

const MASCOT_SRC: Record<string, string> = {
  peak: '/good-light-mode.svg',
  moderate: '/on-it-light-mode.svg',
  low: '/rough-light-mode.svg',
  nodata: '/watching-light-mode.svg',
};

const MASCOT_CLASS: Record<string, string> = {
  peak: 'mascot-happy',
  moderate: 'mascot-onit',
  low: 'mascot-rough',
  nodata: 'mascot-idle',
};

const DEFAULT_MESSAGE =
  "Morning. Waldo's still setting up — connect your wearable or upload health data to get your first Brief.";

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc';

export function TheBrief({ message, zone, isLoading, timestamp }: TheBriefProps) {
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    const text = message ?? DEFAULT_MESSAGE;
    if (!text?.trim()) return;

    // If already playing, stop
    if (audioState === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioState('idle');
      return;
    }

    setAudioState('loading');
    try {
      const res = await fetch(`${SUPABASE_FN_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text, voice: 'Fritz-PlayAI' }),
      });

      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setAudioState('playing');
      audio.onended = () => {
        setAudioState('idle');
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setAudioState('error');
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('[TheBrief] TTS error:', err);
      setAudioState('error');
      setTimeout(() => setAudioState('idle'), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="dash-card morning-wag-card">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <img
            src="/thinking-light-mode.svg"
            alt="Waldo thinking"
            className="mascot-thinking"
            style={{ width: 80, height: 80, marginBottom: 20 }}
          />
          <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
            Already on it...
          </p>
        </div>
      </div>
    );
  }

  const displayMessage = message ?? DEFAULT_MESSAGE;
  const paragraphs = displayMessage.split('\n').filter(p => p.trim().length > 0);
  const resolvedZone = zone ?? 'nodata';
  const mascotSrc = MASCOT_SRC[resolvedZone] ?? MASCOT_SRC.nodata!;
  const mascotClass = MASCOT_CLASS[resolvedZone] ?? MASCOT_CLASS.nodata!;

  const playIcon = audioState === 'loading' ? '⏳' : audioState === 'playing' ? '⏹' : audioState === 'error' ? '⚠' : '🔊';
  const playLabel = audioState === 'loading' ? 'Generating...' : audioState === 'playing' ? 'Stop' : audioState === 'error' ? 'Error' : 'Listen';

  return (
    <div className="dash-card morning-wag-card">
      {/* Header row: label + play button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-body)',
        }}>
          The Brief
        </span>

        {/* Audio play button */}
        <button
          onClick={handlePlay}
          disabled={audioState === 'loading'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: audioState === 'playing' ? 'rgba(249,115,22,0.1)' : 'rgba(26,26,26,0.04)',
            border: `0.5px solid ${audioState === 'playing' ? 'rgba(249,115,22,0.3)' : 'rgba(26,26,26,0.12)'}`,
            borderRadius: 8, padding: '4px 10px', cursor: audioState === 'loading' ? 'wait' : 'pointer',
            fontSize: 11, color: audioState === 'playing' ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--font-body)', fontWeight: 500, transition: 'all 0.15s',
          }}
        >
          <span>{playIcon}</span>
          <span>{playLabel}</span>
        </button>
      </div>

      {/* Dalmatian mascot */}
      <img
        src={mascotSrc}
        alt="Waldo"
        className={mascotClass}
        style={{ width: 80, height: 80, marginBottom: 16, display: 'block' }}
      />

      {/* Timestamp */}
      {timestamp !== undefined && timestamp.length > 0 && (
        <span style={{
          display: 'block', fontSize: 13, color: 'var(--text-dim)',
          fontFamily: 'var(--font-body)', marginBottom: 16,
        }}>
          {timestamp}
        </span>
      )}

      {/* Narrative */}
      <div className="morning-wag-text">
        {paragraphs.map((p, i) => (
          <p key={i} className="morning-wag-paragraph">{p}</p>
        ))}
      </div>

      {/* Patrol footer */}
      <p className="morning-wag-footer">The Patrol picks up from here.</p>
    </div>
  );
}

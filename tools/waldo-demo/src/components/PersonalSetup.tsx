/**
 * PersonalSetup — shown after new user creation.
 * Polls Supabase every 4s to detect when Google and Telegram are connected.
 * Both steps are optional — user can skip to dashboard at any time.
 */
import { useState, useEffect, useRef } from 'react';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc';
const FN_URL = `${SUPABASE_URL}/functions/v1`;

interface Props {
  userId: string;
  name: string;
  onDone: () => void;
}

async function checkGoogleConnected(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/oauth_tokens?user_id=eq.${userId}&provider=eq.google&select=id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json() as unknown[];
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

async function checkTelegramLinked(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=telegram_chat_id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json() as Array<{ telegram_chat_id: number | null }>;
    return Array.isArray(data) && data.length > 0 && data[0]!.telegram_chat_id !== null;
  } catch { return false; }
}

export function PersonalSetup({ userId, name, onDone }: Props) {
  const linkingCode = localStorage.getItem('waldo_linking_code') ?? '——————';
  const googleUrl   = localStorage.getItem('waldo_google_url')
    ?? `${FN_URL}/oauth-google/connect?user_id=${userId}&scopes=calendar,gmail,tasks`;

  const [googleConnected,  setGoogleConnected]  = useState(false);
  const [telegramLinked,   setTelegramLinked]    = useState(false);
  const [copied,           setCopied]            = useState<string | null>(null);
  const [googleClicked,    setGoogleClicked]     = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 4s to detect when user returns from Google OAuth / Telegram
  useEffect(() => {
    async function poll() {
      const [g, t] = await Promise.all([
        checkGoogleConnected(userId),
        checkTelegramLinked(userId),
      ]);
      setGoogleConnected(g);
      setTelegramLinked(t);
    }

    poll(); // Check immediately on mount (returning from OAuth redirect)
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [userId]);

  // Auto-advance to dashboard when both are done (small delay so user sees ✓)
  useEffect(() => {
    if (googleConnected && telegramLinked) {
      const t = setTimeout(onDone, 1800);
      return () => clearTimeout(t);
    }
  }, [googleConnected, telegramLinked, onDone]);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const bothDone = googleConnected && telegramLinked;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-surface)', borderRadius: 20, padding: 40, border: '1px solid var(--border)', boxShadow: '0 4px 40px rgba(0,0,0,0.08)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
          <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 18 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src="/on-it-light-mode.svg" alt="" style={{ width: 140, height: 140, objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, marginBottom: 6 }}>
          {name}'s Waldo is ready
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          {bothDone
            ? 'All set. Opening your dashboard…'
            : 'Two things to do and Waldo starts watching. Both are optional.'}
        </p>

        {/* ── Step 1: Google ── */}
        <div style={{ ...stepCard, borderColor: googleConnected ? '#6EE7B7' : 'var(--border)', background: googleConnected ? '#F0FDF4' : 'var(--bg)' }}>
          <div style={{ ...stepNum, background: googleConnected ? '#059669' : 'var(--accent)' }}>
            {googleConnected ? '✓' : '1'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={stepTitle}>
              {googleConnected ? 'Google Workspace connected' : 'Connect Google Workspace'}
            </div>
            {googleConnected ? (
              <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6 }}>
                Calendar, Gmail, and Tasks are syncing. Waldo will use this for Morning Wag context.
              </p>
            ) : (
              <>
                <p style={stepSub}>
                  Waldo reads your Calendar (meeting load), Gmail (email volume — no content), and Tasks (deadline pressure).
                  This makes Morning Wag actually useful — not just your body, but your day.
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setGoogleClicked(true)}
                    style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
                  >
                    Connect Google →
                  </a>
                  <button
                    onClick={() => copy(googleUrl, 'google')}
                    style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                  >
                    {copied === 'google' ? '✓ Copied' : 'Copy URL'}
                  </button>
                </div>
                {googleClicked && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Waiting for Google connection… this page will update automatically.
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: googleClicked ? 4 : 8 }}>
                  Calendar syncs every 30 min. Gmail and Tasks sync nightly.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Step 2: Telegram ── */}
        <div style={{ ...stepCard, marginTop: 16, borderColor: telegramLinked ? '#6EE7B7' : 'var(--border)', background: telegramLinked ? '#F0FDF4' : 'var(--bg)' }}>
          <div style={{ ...stepNum, background: telegramLinked ? '#059669' : 'var(--accent)' }}>
            {telegramLinked ? '✓' : '2'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={stepTitle}>
              {telegramLinked ? 'Telegram linked' : 'Link Telegram'}
            </div>
            {telegramLinked ? (
              <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6 }}>
                Waldo will deliver Morning Wags, Fetch Alerts, and Evening Reviews directly to your Telegram.
              </p>
            ) : (
              <>
                <p style={stepSub}>
                  Waldo delivers Morning Wags, Fetch Alerts, and Evening Reviews via Telegram. This is how Waldo talks to you.
                </p>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px' }}>
                    Your linking code
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 32, fontWeight: 700, letterSpacing: 8, color: 'var(--accent)' }}>
                      {linkingCode}
                    </span>
                    <button
                      onClick={() => copy(linkingCode, 'code')}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                    >
                      {copied === 'code' ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 12, color: '#92400E', lineHeight: 1.7 }}>
                  1. Open Telegram → find <strong>@wadloboi1_test_bot</strong><br />
                  2. Send <code>/start</code><br />
                  3. Paste the code above
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                  This page updates automatically when Telegram is linked.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ marginTop: 28 }}>
          <button
            onClick={onDone}
            style={{ width: '100%', padding: '13px 20px', borderRadius: 12, border: 'none', background: bothDone ? '#059669' : 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'background 0.3s' }}
          >
            {bothDone ? 'Opening dashboard…' : 'Open my dashboard →'}
          </button>
          {!bothDone && (
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, textAlign: 'center' }}>
              Both steps are optional — you can complete them later from the Integrations tab.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const stepCard: React.CSSProperties = {
  display: 'flex', gap: 16, alignItems: 'flex-start',
  borderRadius: 12, padding: 20, border: '1px solid var(--border)',
  transition: 'background 0.4s, border-color 0.4s',
};
const stepNum: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, fontWeight: 700, flexShrink: 0, transition: 'background 0.4s',
};
const stepTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 };
const stepSub: React.CSSProperties = { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 };

/**
 * PersonalSetup — shown after new user creation.
 * Walks through: Connect Google → Link Telegram → You're ready.
 * Also shown on first visit of personal dashboard when not yet connected.
 */
import { useState, useEffect } from 'react';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const FN_URL = `${SUPABASE_URL}/functions/v1`;

interface Props {
  userId: string;
  name: string;
  onDone: () => void;
}

export function PersonalSetup({ userId, name, onDone }: Props) {
  const linkingCode = localStorage.getItem('waldo_linking_code') ?? '——————';
  const googleUrl = localStorage.getItem('waldo_google_url')
    ?? `${FN_URL}/oauth-google/connect?user_id=${userId}&scopes=calendar,gmail,tasks,youtube`;
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: 'var(--bg-surface)',
        borderRadius: 20, padding: 40, border: '1px solid var(--border)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐕</div>
        <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, marginBottom: 6 }}>
          {name}'s Waldo is ready
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Two things to do and Waldo starts watching. Takes 3 minutes.
        </p>

        {/* Step 1: Google */}
        <div style={stepCard}>
          <div style={stepNum}>1</div>
          <div style={{ flex: 1 }}>
            <div style={stepTitle}>Connect Google Workspace</div>
            <p style={stepSub}>
              Waldo reads your Calendar (meeting load), Gmail (email volume — no content), and Tasks (deadline pressure).
              This is what makes Morning Wag actually useful — not just your body, but your day.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '9px 18px', borderRadius: 9, background: 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Connect Google →
              </a>
              <button
                onClick={() => copy(googleUrl, 'google')}
                style={{
                  padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                }}
              >
                {copied === 'google' ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
              Calendar syncs every 30 min. Gmail and Tasks sync nightly.
            </p>
          </div>
        </div>

        {/* Step 2: Telegram */}
        <div style={{ ...stepCard, marginTop: 16 }}>
          <div style={stepNum}>2</div>
          <div style={{ flex: 1 }}>
            <div style={stepTitle}>Link Telegram</div>
            <p style={stepSub}>
              Waldo delivers Morning Wags, Fetch Alerts, and Evening Reviews via Telegram.
              This is how Waldo talks to you.
            </p>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', marginTop: 12,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
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
            <div style={{
              background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
              padding: '10px 14px', marginTop: 10, fontSize: 12, color: '#92400E', lineHeight: 1.7,
            }}>
              1. Open Telegram → find <strong>@YourWaldoBot</strong><br />
              2. Send <code>/start</code><br />
              3. Paste the code above
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={onDone}
            style={{
              flex: 1, padding: '13px 20px', borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open my dashboard →
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, textAlign: 'center' }}>
          You can do this later — your dashboard is ready now.
        </p>
      </div>
    </div>
  );
}

const stepCard: React.CSSProperties = {
  display: 'flex', gap: 16, alignItems: 'flex-start',
  background: 'var(--bg)', borderRadius: 12, padding: 20, border: '1px solid var(--border)',
};

const stepNum: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, fontWeight: 700, flexShrink: 0,
};

const stepTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4,
};

const stepSub: React.CSSProperties = {
  fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
};

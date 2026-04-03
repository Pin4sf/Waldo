/**
 * LandingPage — console entry with proper Waldo brand assets.
 * Uses: /logo/light-mode-ui/logo.svg, horizontal-stack.svg, workmark.svg
 * Uses: /illustration-svgs/light-mode-ui/ for dalmatian states
 * Fonts: Corben (headlines) + DM Sans (body) — loaded via /typefaces/
 */
import { useState, useEffect } from 'react';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Europe Central (CET)' },
  { value: 'America/New_York', label: 'US East (ET)' },
  { value: 'America/Los_Angeles', label: 'US West (PT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

const WEARABLES = [
  { value: 'apple_watch', label: 'Apple Watch' },
  { value: 'galaxy_watch', label: 'Samsung Galaxy Watch' },
  { value: 'garmin', label: 'Garmin' },
  { value: 'whoop', label: 'WHOOP' },
  { value: 'oura', label: 'Oura Ring' },
  { value: 'fitbit', label: 'Fitbit' },
  { value: 'unknown', label: 'No wearable yet' },
];

interface Props {
  onLogin: (userId: string, name: string, isAdmin: boolean) => void;
}

type Mode = 'welcome' | 'new' | 'returning' | 'admin';

// All SVGs live at the public root — use root paths, not subdirectories
function WaldoIllustration({ state, size = 160 }: { state: string; size?: number }) {
  return (
    <img
      src={`/${state}-light-mode.svg`}
      alt=""
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

export function LandingPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('welcome');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [wakeTime, setWakeTime] = useState('07:30');
  const [wearable, setWearable] = useState('apple_watch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [returnUserId, setReturnUserId] = useState('');

  // Auto-restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('waldo_user_id');
    const savedName = localStorage.getItem('waldo_user_name');
    const savedAdmin = localStorage.getItem('waldo_is_admin');
    if (saved && savedName) {
      onLogin(saved, savedName, savedAdmin === 'true');
    }
  }, []);

  function getAdminKey() {
    return adminKey || (import.meta as any).env?.VITE_ADMIN_KEY || localStorage.getItem('waldo_admin_key') || '';
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name'); return; }
    const key = getAdminKey();
    if (!key) { setError('Admin API key not configured — check .env.local'); return; }
    setLoading(true); setError(null);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ name: name.trim(), timezone, wake_time_estimate: wakeTime, preferred_evening_time: '21:00', wearable_type: wearable }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Failed — check admin key'); return; }

    localStorage.setItem('waldo_user_id', data.user_id);
    localStorage.setItem('waldo_user_name', name.trim());
    localStorage.setItem('waldo_is_admin', 'false');
    localStorage.setItem('waldo_linking_code', data.linking_code);
    localStorage.setItem('waldo_google_url', data.google_connect_url);
    onLogin(data.user_id, name.trim(), false);
  }

  function handleReturn() {
    const id = returnUserId.trim();
    if (!id) { setError('Paste your user ID'); return; }
    const savedName = localStorage.getItem('waldo_user_name') ?? 'User';
    localStorage.setItem('waldo_user_id', id);
    onLogin(id, savedName, false);
  }

  function handleAdminLogin() {
    const key = getAdminKey();
    if (!key) { setError('Enter the admin key'); return; }
    localStorage.setItem('waldo_admin_key', key);
    onLogin('admin', 'Admin', true);
  }

  // ─── Welcome ────────────────────────────────────────────────────
  if (mode === 'welcome') {
    return (
      <div style={pageWrap}>
        <div style={welcomeCard}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
            <img src="/logo.svg" alt="Waldo" style={{ width: 36, height: 36 }} />
            <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 22 }} />
          </div>

          {/* Dalmatian illustration */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <WaldoIllustration state="watching" size={180} />
          </div>

          <h1 style={headlineStyle}>Already on it.</h1>
          <p style={taglineStyle}>
            Waldo reads your body signals and acts before you notice you're stressed, depleted, or about to burn out.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 36 }}>
            <button style={primaryBtn} onClick={() => setMode('new')}>
              Get started →
            </button>
            <button style={ghostBtn} onClick={() => setMode('returning')}>
              I already have a Waldo
            </button>
          </div>

          <button onClick={() => setMode('admin')} style={adminLink}>
            Admin console ↗
          </button>
        </div>
      </div>
    );
  }

  // ─── New user ────────────────────────────────────────────────────
  if (mode === 'new') {
    return (
      <div style={pageWrap}>
        <div style={{ ...formCard }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
            <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 18 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <WaldoIllustration state="thinking" size={120} />
          </div>

          <h2 style={{ ...headlineStyle, fontSize: 26, marginBottom: 6 }}>Let's set up your Waldo</h2>
          <p style={{ ...taglineStyle, marginBottom: 28 }}>Takes 90 seconds. No Apple Watch required to start.</p>

          {error && <div style={errorBox}>{error}</div>}

          <div style={fieldWrap}>
            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Suyash" style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...fieldWrap, flex: 1 }}>
              <label style={labelStyle}>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
            <div style={{ ...fieldWrap, width: 110 }}>
              <label style={labelStyle}>Wake time</label>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Wearable</label>
            <select value={wearable} onChange={e => setWearable(e.target.value)} style={inputStyle}>
              {WEARABLES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>

          <button onClick={handleCreate} disabled={loading || !name.trim()} style={{ ...primaryBtn, opacity: loading || !name.trim() ? 0.5 : 1 }}>
            {loading ? 'Creating your Waldo...' : 'Create my Waldo →'}
          </button>

          <button onClick={() => setMode('welcome')} style={backLink}>← Back</button>
        </div>
      </div>
    );
  }

  // ─── Returning user ──────────────────────────────────────────────
  if (mode === 'returning') {
    const savedId = localStorage.getItem('waldo_user_id');
    const savedName = localStorage.getItem('waldo_user_name');
    return (
      <div style={pageWrap}>
        <div style={formCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
            <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 18 }} />
          </div>
          <WaldoIllustration state="good" size={100} />
          <h2 style={{ ...headlineStyle, fontSize: 24, marginTop: 16, marginBottom: 6 }}>Welcome back</h2>

          {savedId && savedName && (
            <div style={{ marginBottom: 24, marginTop: 16 }}>
              <button onClick={() => onLogin(savedId, savedName, false)} style={primaryBtn}>
                Continue as {savedName} →
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: savedId ? 0 : 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>Or enter your user ID:</p>
            <input value={returnUserId} onChange={e => setReturnUserId(e.target.value)} placeholder="Paste user ID" style={{ ...inputStyle, marginBottom: 10 }} />
            {error && <div style={errorBox}>{error}</div>}
            <button onClick={handleReturn} style={ghostBtn}>Continue →</button>
          </div>

          <button onClick={() => setMode('welcome')} style={backLink}>← Back</button>
        </div>
      </div>
    );
  }

  // ─── Admin ───────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={formCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <img src="/logo/light-mode-ui/logo.svg" alt="" style={{ width: 28, height: 28 }} />
          <img src="/logo/light-mode-ui/horizontal-stack.svg" alt="Waldo" style={{ height: 18 }} />
        </div>
        <WaldoIllustration state="on-it" size={100} />
        <h2 style={{ ...headlineStyle, fontSize: 22, marginTop: 16, marginBottom: 6 }}>Admin console</h2>
        <p style={{ ...taglineStyle, marginBottom: 24 }}>Full multi-user access. Enter your admin key.</p>

        {error && <div style={errorBox}>{error}</div>}

        <div style={fieldWrap}>
          <label style={labelStyle}>Admin API key</label>
          <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="waldo-admin-2026" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} autoFocus />
        </div>

        <button onClick={handleAdminLogin} style={primaryBtn}>Open admin console →</button>
        <button onClick={() => setMode('welcome')} style={backLink}>← Back</button>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────

const pageWrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: 24,
};

const welcomeCard: React.CSSProperties = {
  width: '100%', maxWidth: 420, textAlign: 'center',
  background: 'var(--bg-surface)', borderRadius: 20, padding: 48,
  border: '1px solid var(--border)', boxShadow: '0 4px 48px rgba(26,26,26,0.06)',
};

const formCard: React.CSSProperties = {
  width: '100%', maxWidth: 460, textAlign: 'center',
  background: 'var(--bg-surface)', borderRadius: 20, padding: '40px 44px',
  border: '1px solid var(--border)', boxShadow: '0 4px 48px rgba(26,26,26,0.06)',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-headline)', fontSize: 36,
  color: 'var(--text)', marginBottom: 12, lineHeight: 1.15,
};

const taglineStyle: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7,
};

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 20px', borderRadius: 'var(--radius)', border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer', letterSpacing: '-0.2px', fontFamily: 'var(--font-body)',
};

const ghostBtn: React.CSSProperties = {
  width: '100%', padding: '12px 20px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)',
};

const adminLink: React.CSSProperties = {
  marginTop: 36, fontSize: 12, color: 'var(--text-dim)',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
};

const backLink: React.CSSProperties = {
  display: 'block', marginTop: 20, fontSize: 13, color: 'var(--text-dim)',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
};

const fieldWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, textAlign: 'left',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.7px',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 13px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', fontSize: 14,
  background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-body)',
};

const errorBox: React.CSSProperties = {
  background: '#FEE2E2', color: '#7B3333', borderRadius: 8,
  padding: '10px 14px', fontSize: 13, marginBottom: 16, textAlign: 'left',
};

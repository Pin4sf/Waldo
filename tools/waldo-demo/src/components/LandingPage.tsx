/**
 * LandingPage — console entry for new and returning users.
 *
 * New user  → enter name + timezone → creates Waldo user via admin API
 *             → shows personal dashboard with Google connect + Telegram code
 *
 * Returning → name lookup from localStorage, or enter user ID directly
 *
 * Admin     → small link at bottom → enters ADMIN_API_KEY → full multi-user console
 */
import { useState, useEffect } from 'react';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const ADMIN_KEY = (import.meta as any).env?.VITE_ADMIN_KEY ?? localStorage.getItem('waldo_admin_key') ?? '';

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
  { value: 'apple_watch', label: '⌚ Apple Watch' },
  { value: 'galaxy_watch', label: '⌚ Samsung Galaxy Watch' },
  { value: 'garmin', label: '⌚ Garmin' },
  { value: 'whoop', label: '💪 WHOOP' },
  { value: 'oura', label: '💍 Oura Ring' },
  { value: 'unknown', label: '📱 No wearable yet' },
];

interface Props {
  onLogin: (userId: string, name: string, isAdmin: boolean) => void;
}

export function LandingPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'welcome' | 'new' | 'returning' | 'admin'>('welcome');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [wakeTime, setWakeTime] = useState('07:30');
  const [wearable, setWearable] = useState('apple_watch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState(ADMIN_KEY);
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

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name'); return; }
    const key = adminKey || ADMIN_KEY;
    if (!key) { setError('Admin API key not set — check .env.local'); return; }

    setLoading(true);
    setError(null);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({
        name: name.trim(),
        timezone,
        wake_time_estimate: wakeTime,
        preferred_evening_time: '21:00',
        wearable_type: wearable,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to create profile. Check admin key.');
      return;
    }

    // Persist in localStorage for return visits
    localStorage.setItem('waldo_user_id', data.user_id);
    localStorage.setItem('waldo_user_name', name.trim());
    localStorage.setItem('waldo_is_admin', 'false');
    // Also persist the linking code temporarily
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
    if (!adminKey) { setError('Enter admin key'); return; }
    localStorage.setItem('waldo_admin_key', adminKey);
    onLogin('admin', 'Admin', true);
  }

  // ─── Welcome screen ────────────────────────────────────────────
  if (mode === 'welcome') {
    return (
      <div style={page}>
        <div style={card}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🐕</div>
          <h1 style={headline}>Meet Waldo</h1>
          <p style={sub}>
            Your biological intelligence layer. Reads your body signals and acts before you notice you're stressed, depleted, or about to burn out.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
            <button style={primaryBtn} onClick={() => setMode('new')}>
              Get started →
            </button>
            <button style={ghostBtn} onClick={() => setMode('returning')}>
              I already have a Waldo
            </button>
          </div>

          <button
            onClick={() => setMode('admin')}
            style={{ marginTop: 40, fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Admin console ↗
          </button>
        </div>
      </div>
    );
  }

  // ─── New user form ──────────────────────────────────────────────
  if (mode === 'new') {
    return (
      <div style={page}>
        <div style={{ ...card, maxWidth: 480 }}>
          <button onClick={() => setMode('welcome')} style={backBtn}>← Back</button>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
          <h2 style={{ ...headline, fontSize: 26, marginBottom: 6 }}>Let's set up your Waldo</h2>
          <p style={{ ...sub, marginBottom: 28 }}>Takes 90 seconds. No Apple Watch required to get started.</p>

          {error && <div style={errorBox}>{error}</div>}

          <div style={field}>
            <label style={label}>Your name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Suyash"
              style={input}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} style={input}>
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...field, width: 110 }}>
              <label style={label}>Wake time</label>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={input} />
            </div>
          </div>

          <div style={field}>
            <label style={label}>Wearable</label>
            <select value={wearable} onChange={e => setWearable(e.target.value)} style={input}>
              {WEARABLES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            style={{ ...primaryBtn, marginTop: 8, opacity: loading || !name.trim() ? 0.5 : 1 }}
          >
            {loading ? 'Creating your Waldo...' : 'Create my Waldo →'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 16, textAlign: 'center' }}>
            No password. No credit card. Just you and your data.
          </p>
        </div>
      </div>
    );
  }

  // ─── Returning user ─────────────────────────────────────────────
  if (mode === 'returning') {
    // Check localStorage first
    const savedId = localStorage.getItem('waldo_user_id');
    const savedName = localStorage.getItem('waldo_user_name');

    return (
      <div style={page}>
        <div style={card}>
          <button onClick={() => setMode('welcome')} style={backBtn}>← Back</button>
          <h2 style={{ ...headline, fontSize: 24, marginBottom: 6 }}>Welcome back</h2>

          {savedId && savedName && (
            <div style={{ marginBottom: 24 }}>
              <p style={sub}>Continue as:</p>
              <button
                onClick={() => onLogin(savedId, savedName, false)}
                style={{ ...primaryBtn, marginTop: 8 }}
              >
                {savedName}'s Waldo →
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <p style={sub}>Or enter your user ID:</p>
            <input
              value={returnUserId}
              onChange={e => setReturnUserId(e.target.value)}
              placeholder="paste user ID from your setup email"
              style={{ ...input, marginTop: 8, marginBottom: 8 }}
            />
            {error && <div style={errorBox}>{error}</div>}
            <button onClick={handleReturn} style={ghostBtn}>Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Admin login ────────────────────────────────────────────────
  if (mode === 'admin') {
    return (
      <div style={page}>
        <div style={card}>
          <button onClick={() => setMode('welcome')} style={backBtn}>← Back</button>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <h2 style={{ ...headline, fontSize: 22, marginBottom: 6 }}>Admin console</h2>
          <p style={{ ...sub, marginBottom: 24 }}>Full multi-user access. Requires admin key.</p>

          {error && <div style={errorBox}>{error}</div>}

          <div style={field}>
            <label style={label}>Admin API key</label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="waldo-admin-2026"
              style={input}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
            />
          </div>

          <button onClick={handleAdminLogin} style={primaryBtn}>
            Open admin console →
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Styles ──────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: 24,
};

const card: React.CSSProperties = {
  background: 'var(--bg-surface)', borderRadius: 20, padding: 40,
  width: '100%', maxWidth: 440, textAlign: 'center',
  boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
  border: '1px solid var(--border)',
};

const headline: React.CSSProperties = {
  fontFamily: 'var(--font-headline)', fontSize: 36,
  color: 'var(--text)', marginBottom: 12,
};

const sub: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8,
};

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 20px', borderRadius: 12, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer', letterSpacing: '-0.2px',
};

const ghostBtn: React.CSSProperties = {
  width: '100%', padding: '12px 20px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', fontSize: 14, cursor: 'pointer',
};

const backBtn: React.CSSProperties = {
  display: 'block', marginBottom: 20, background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', textAlign: 'left',
};

const field: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  marginBottom: 16, textAlign: 'left',
};

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.6px',
};

const input: React.CSSProperties = {
  padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)',
  fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
};

const errorBox: React.CSSProperties = {
  background: '#FEE2E2', color: '#7B3333', borderRadius: 8,
  padding: '10px 14px', fontSize: 13, marginBottom: 16, textAlign: 'left',
};

/**
 * AddUserModal — create a new Waldo user from the admin console.
 * Calls the admin Edge Function (no client-side service_role needed).
 * Shows linking code, Google connect URL, and Telegram instructions after creation.
 */
import { useState } from 'react';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
// Admin key — stored in .env.local as VITE_ADMIN_KEY (never commit)
// Falls back to prompt so the console still works without a local .env file.
function getAdminKey(): string {
  return (import.meta as any).env?.VITE_ADMIN_KEY ?? localStorage.getItem('waldo_admin_key') ?? '';
}

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Dubai',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC',
];

const WEARABLES = [
  { value: 'apple_watch', label: 'Apple Watch' },
  { value: 'galaxy_watch', label: 'Samsung Galaxy Watch' },
  { value: 'garmin', label: 'Garmin' },
  { value: 'whoop', label: 'WHOOP' },
  { value: 'oura', label: 'Oura Ring' },
  { value: 'fitbit', label: 'Fitbit' },
  { value: 'unknown', label: 'No wearable / other' },
];

interface CreatedUser {
  user_id: string;
  name: string;
  linking_code: string;
  google_connect_url: string;
  telegram_instructions: string;
}

interface Props {
  onClose: () => void;
  onCreated: (userId: string) => void;
}

export function AddUserModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    wake_time_estimate: '07:00',
    preferred_evening_time: '21:00',
    wearable_type: 'apple_watch',
    is_admin: false,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState(getAdminKey);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!adminKey) { setError('Admin key is required'); return; }

    setLoading(true);
    setError(null);

    // Persist key for session
    localStorage.setItem('waldo_admin_key', adminKey);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to create user');
      return;
    }

    setCreated(data);
    onCreated(data.user_id);
  }

  // ─── Success screen ─────────────────────────────────────────────
  if (created) {
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🐕</div>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 20, marginBottom: 4 }}>
            {created.name}'s Waldo is ready
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Share these three things to get them fully set up.
          </p>

          {/* Telegram code */}
          <div style={card}>
            <div style={cardLabel}>Step 1 — Link Telegram</div>
            <div style={codeRow}>
              <span style={bigCode}>{created.linking_code}</span>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}
                onClick={() => copy(created.linking_code, 'code')}>
                {copied === 'code' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              {created.telegram_instructions}
            </div>
          </div>

          {/* Google connect */}
          <div style={card}>
            <div style={cardLabel}>Step 2 — Connect Google Workspace</div>
            <div style={codeRow}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1, wordBreak: 'break-all' }}>
                {created.google_connect_url.slice(0, 60)}...
              </span>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}
                onClick={() => copy(created.google_connect_url, 'google')}>
                {copied === 'google' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <a href={created.google_connect_url} target="_blank" rel="noreferrer"
              className="btn btn-accent" style={{ fontSize: 11, marginTop: 8, display: 'inline-block', textDecoration: 'none' }}>
              Open connect URL →
            </a>
          </div>

          {/* Health data */}
          <div style={card}>
            <div style={cardLabel}>Step 3 — Seed health data (optional for now)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: '#1A1A1A', color: '#E5E7EB', padding: '10px 12px', borderRadius: 6, lineHeight: 1.7 }}>
              <div>SUPABASE_SECRET_KEY=... npx tsx</div>
              <div>tools/health-parser/src/seed-supabase.ts</div>
              <div style={{ opacity: 0.5 }}>\</div>
              <div style={{ paddingLeft: 16 }}>{'<path/to/export.xml>'}</div>
              <div style={{ paddingLeft: 16 }}>{'--user-id ' + created.user_id}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-accent" onClick={onClose} style={{ flex: 1 }}>
              Done
            </button>
            <button className="btn btn-ghost" onClick={() => setCreated(null)}>
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Create form ─────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 20 }}>Add Waldo User</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 10px' }}>×</button>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#7B3333', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Admin key (one-time entry) */}
        {!localStorage.getItem('waldo_admin_key') && (
          <div style={fieldWrap}>
            <label style={fieldLabel}>Admin API key</label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Set VITE_ADMIN_KEY in .env.local"
              style={input}
            />
            <div style={hint}>Set once, stored for this session.</div>
          </div>
        )}

        <div style={fieldWrap}>
          <label style={fieldLabel}>Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ark" style={input} autoFocus />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...fieldWrap, flex: 1 }}>
            <label style={fieldLabel}>Timezone</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} style={input}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div style={{ ...fieldWrap, width: 120 }}>
            <label style={fieldLabel}>Wake time</label>
            <input type="time" value={form.wake_time_estimate}
              onChange={e => setForm(f => ({ ...f, wake_time_estimate: e.target.value }))} style={input} />
          </div>
          <div style={{ ...fieldWrap, width: 120 }}>
            <label style={fieldLabel}>Evening</label>
            <input type="time" value={form.preferred_evening_time}
              onChange={e => setForm(f => ({ ...f, preferred_evening_time: e.target.value }))} style={input} />
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={fieldLabel}>Wearable</label>
          <select value={form.wearable_type} onChange={e => setForm(f => ({ ...f, wearable_type: e.target.value }))} style={input}>
            {WEARABLES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>

        <div style={{ ...fieldWrap, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="is_admin" checked={form.is_admin}
            onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
          <label htmlFor="is_admin" style={{ fontSize: 13, color: 'var(--text)' }}>
            Super admin (can view all users in console + app)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-accent" onClick={handleCreate} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Creating...' : 'Create Waldo →'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: 'var(--bg)', borderRadius: 16, padding: 28,
  width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

const fieldWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
};

const input: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 14, background: 'var(--bg-surface)', color: 'var(--text)', outline: 'none',
};

const hint: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)' };

const card: React.CSSProperties = {
  background: 'var(--bg-surface)', borderRadius: 10, padding: 14, marginBottom: 10,
  border: '1px solid var(--border)',
};

const cardLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8,
};

const codeRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
};

const bigCode: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 28, fontWeight: 700, letterSpacing: 6,
  color: 'var(--accent)',
};

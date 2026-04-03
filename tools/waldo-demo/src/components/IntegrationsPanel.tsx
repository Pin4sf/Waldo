import { useState, useEffect } from 'react';
import { fetchSyncStatus, getGoogleConnectUrl, triggerSync } from '../supabase-api.js';
import type { SyncStatus } from '../types.js';

interface Props { userId: string }

function statusDot(status: SyncStatus['status']) {
  if (status === 'ok') return <span title="Connected" style={{ color: '#34D399' }}>●</span>;
  if (status === 'not_connected') return <span title="Not connected" style={{ color: '#9CA3AF' }}>○</span>;
  if (status === 'token_expired') return <span title="Token expired" style={{ color: '#F59E0B' }}>●</span>;
  if (status === 'error') return <span title="Sync error" style={{ color: '#EF4444' }}>●</span>;
  return <span title={status} style={{ color: '#F59E0B' }}>●</span>;
}

function timeSince(iso: string | null): string {
  if (!iso) return 'Never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function IntegrationsPanel({ userId }: Props) {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncStatus(userId).then(s => { setStatuses(s); setLoading(false); });
  }, [userId]);

  const handleSync = async (provider: SyncStatus['provider']) => {
    setSyncing(provider);
    await triggerSync(provider as any, userId);
    await new Promise(r => setTimeout(r, 2000));
    const fresh = await fetchSyncStatus(userId);
    setStatuses(fresh);
    setSyncing(null);
  };

  const googleConnectUrl = getGoogleConnectUrl(userId);
  const anyConnected = statuses.some(s => s.connected);

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Google Workspace */}
      <div className="debug-section">
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Google Workspace</span>
          {anyConnected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>

        {!anyConnected && (
          <div style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Connect Google to give Waldo calendar context, Gmail load, and task pressure.
              After connecting, syncs run automatically every 30 min (Calendar) and nightly (Gmail, Tasks).
            </p>
            <a
              href={googleConnectUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-accent"
              style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}
            >
              Connect Google Workspace →
            </a>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>Loading...</div>
        ) : (
          <div>
            {statuses.map(s => (
              <div key={s.provider} className="debug-metric" style={{ padding: '10px 14px', alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>
                    {statusDot(s.status)} {s.label}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {s.connected && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 10px', opacity: syncing === s.provider ? 0.5 : 1 }}
                        onClick={() => handleSync(s.provider as any)}
                        disabled={syncing !== null}
                      >
                        {syncing === s.provider ? '...' : 'Sync now'}
                      </button>
                    )}
                    {!s.connected && (
                      <a
                        href={googleConnectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 10px', textDecoration: 'none', color: 'var(--accent)' }}
                      >
                        Connect
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 12 }}>
                  <span>Last sync: {timeSince(s.lastSyncAt)}</span>
                  {s.recordsSynced > 0 && <span>{s.recordsSynced} records</span>}
                  {s.lastError && <span style={{ color: '#EF4444' }}>{s.lastError.slice(0, 60)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Telegram */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Telegram Bot</span>
          <span style={{ fontSize: 11, color: '#34D399' }}>Active</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="debug-metric">
            <span className="label">Commands</span>
            <span className="value" style={{ fontFamily: 'monospace', fontSize: 11 }}>/start /status /connect /morning</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            Users link via 6-digit code from the Waldo app or onboarding screen.
            Proactive messages (Morning Wag, Fetch Alerts, Evening Reviews) are delivered here automatically.
          </div>
        </div>
      </div>

      {/* Wearables */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Health Data</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="debug-metric">
            <span className="label">iOS (Apple Watch)</span>
            <span className="value">HealthKit live sync via app</span>
          </div>
          <div className="debug-metric" style={{ marginTop: 4 }}>
            <span className="label">Android</span>
            <span className="value" style={{ color: '#F59E0B' }}>Health Connect — Phase B2</span>
          </div>
          <div className="debug-metric" style={{ marginTop: 4 }}>
            <span className="label">Manual import</span>
            <span className="value">Apple Health XML → seed-supabase.ts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { fetchSyncStatus, getGoogleConnectUrl, getSpotifyConnectUrl, getTodoistConnectUrl, getStravaConnectUrl, getNotionConnectUrl, getWhoopConnectUrl, triggerWhoopBackfill, triggerSync, disconnectProvider, SUPABASE_FN_URL, supabase } from '../supabase-api.js';
import type { SyncStatus } from '../types.js';
import { HealthUploadPanel } from './HealthUploadPanel.js';

// Admin key is optional — health-import now accepts user_id directly
function getAdminKey(): string {
  return (import.meta as any).env?.VITE_ADMIN_KEY ?? localStorage.getItem('waldo_admin_key') ?? '';
}

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
  const [syncingSet, setSyncingSet] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const refreshStatuses = () => fetchSyncStatus(userId).then(setStatuses);

  useEffect(() => {
    refreshStatuses().then(() => setLoading(false));
  }, [userId]);

  // Parallel sync — each provider syncs independently
  const handleSync = async (provider: string) => {
    setSyncingSet(prev => new Set(prev).add(provider));
    await triggerSync(provider, userId);
    await new Promise(r => setTimeout(r, 2000));
    await refreshStatuses();
    setSyncingSet(prev => { const next = new Set(prev); next.delete(provider); return next; });
  };

  // Sync all connected providers in parallel
  const handleSyncAll = () => {
    const connected = statuses.filter(s => s.connected);
    connected.forEach(s => handleSync(s.provider));
  };

  const handleDisconnect = async (provider: 'google' | 'spotify' | 'todoist' | 'strava' | 'notion') => {
    if (!confirm(`Disconnect ${provider}? Waldo will lose access to this data source.`)) return;
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await disconnectProvider(provider, userId);
      await refreshStatuses();
    } catch (err) {
      setDisconnectError((err as Error).message ?? 'Disconnect failed. Try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  const googleConnectUrl = getGoogleConnectUrl(userId);
  const anyConnected = statuses.some(s => s.connected);

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Google Workspace */}
      <div className="debug-section">
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Google Workspace</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {anyConnected && (
              <>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text-dim)' }}
                  onClick={handleSyncAll} disabled={syncingSet.size > 0}>
                  {syncingSet.size > 0 ? 'Syncing...' : 'Sync all'}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px', color: '#EF4444' }}
                  onClick={() => handleDisconnect('google')} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
              </>
            )}
            {disconnectError && (
              <span style={{ fontSize: 11, color: '#EF4444', display: 'block', marginTop: 4 }}>
                {disconnectError}
              </span>
            )}
            {!anyConnected && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>}
          </div>
        </div>

        {!anyConnected && (
          <div style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Connect Google to give Waldo calendar context, Gmail load, and task pressure.
              Add Google Fit scopes to also sync Android health data (steps, heart rate, sleep).
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={googleConnectUrl} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Google →
              </a>
              <a href={getGoogleConnectUrl(userId, true)} target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Google + Android Health →
              </a>
            </div>
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
                        style={{ fontSize: 11, padding: '3px 10px', opacity: syncingSet.has(s.provider) ? 0.5 : 1 }}
                        onClick={() => handleSync(s.provider)}
                        disabled={syncingSet.has(s.provider)}
                      >
                        {syncingSet.has(s.provider) ? '...' : 'Sync now'}
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

      {/* Spotify */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Spotify</span>
          {statuses.find(s => s.provider === 'spotify')?.connected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>
        <div style={{ padding: '10px 14px' }}>
          {statuses.find(s => s.provider === 'spotify')?.connected ? (
            <div className="debug-metric">
              <span className="label">Last sync</span>
              <span className="value">{timeSince(statuses.find(s => s.provider === 'spotify')?.lastSyncAt ?? null)}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Spotify gives Waldo real audio features per track (valence, energy, tempo) — much better mood inference than YouTube Music. Requires a Spotify account.
              </p>
              <a href={getSpotifyConnectUrl(userId)} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Spotify →
              </a>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                Requires: SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in Supabase secrets
              </div>
            </>
          )}
        </div>
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

      {/* Todoist */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Todoist</span>
          {statuses.find(s => s.provider === 'todoist')?.connected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>
        <div style={{ padding: '10px 14px' }}>
          {statuses.find(s => s.provider === 'todoist')?.connected ? (
            <div className="debug-metric">
              <span className="label">Last sync</span>
              <span className="value">{timeSince(statuses.find(s => s.provider === 'todoist')?.lastSyncAt ?? null)}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Task pressure: overdue count, urgency queue, completion velocity. Broadens beyond Google Tasks.
              </p>
              <a href={getTodoistConnectUrl(userId)} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Todoist →
              </a>
            </>
          )}
        </div>
      </div>

      {/* WHOOP */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>WHOOP</span>
          {statuses.find(s => s.provider === 'whoop')?.connected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>
        <div style={{ padding: '10px 14px' }}>
          {statuses.find(s => s.provider === 'whoop')?.connected ? (
            <>
              <div className="debug-metric">
                <span className="label">Last sync</span>
                <span className="value">{timeSince(statuses.find(s => s.provider === 'whoop')?.lastSyncAt ?? null)}</span>
              </div>
              <div className="debug-metric">
                <span className="label">Records</span>
                <span className="value">{statuses.find(s => s.provider === 'whoop')?.recordsSynced ?? 0}</span>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, marginTop: 8 }}
                onClick={async () => {
                  await triggerWhoopBackfill(userId);
                  alert('Full WHOOP backfill triggered — check sync status in a few minutes.');
                }}
              >
                Re-trigger full backfill
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Recovery score, HRV (RMSSD), sleep stages, respiratory rate, day strain, and skin temperature. The richest wearable data source.
              </p>
              <a href={getWhoopConnectUrl(userId)} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect WHOOP →
              </a>
            </>
          )}
        </div>
      </div>

      {/* Strava */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Strava</span>
          {statuses.find(s => s.provider === 'strava')?.connected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>
        <div style={{ padding: '10px 14px' }}>
          {statuses.find(s => s.provider === 'strava')?.connected ? (
            <div className="debug-metric">
              <span className="label">Last sync</span>
              <span className="value">{timeSince(statuses.find(s => s.provider === 'strava')?.lastSyncAt ?? null)}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Detailed workout data: runs, rides, swims with HR, distance, suffer score. Enriches your health profile.
              </p>
              <a href={getStravaConnectUrl(userId)} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Strava →
              </a>
            </>
          )}
        </div>
      </div>

      {/* Notion */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Notion</span>
          {statuses.find(s => s.provider === 'notion')?.connected
            ? <span style={{ fontSize: 11, color: '#34D399' }}>Connected</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Not connected</span>
          }
        </div>
        <div style={{ padding: '10px 14px' }}>
          {statuses.find(s => s.provider === 'notion')?.connected ? (
            <div className="debug-metric">
              <span className="label">Last sync</span>
              <span className="value">{timeSince(statuses.find(s => s.provider === 'notion')?.lastSyncAt ?? null)}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Task intelligence from your Notion databases. Waldo auto-detects task boards and computes pile-up.
              </p>
              <a href={getNotionConnectUrl(userId)} target="_blank" rel="noreferrer"
                className="btn btn-accent" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}>
                Connect Notion →
              </a>
            </>
          )}
        </div>
      </div>

      {/* RescueTime */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>RescueTime</span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>API Key</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
            Screen time quality: productive vs distracted hours, late-night screen detection.
            Get your API key from <a href="https://www.rescuetime.com/anapi/manage" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>rescuetime.com/anapi/manage</a>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Paste RescueTime API key"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const key = (e.target as HTMLInputElement).value.trim();
                  if (!key) return;
                  await supabase.from('core_memory').upsert({
                    user_id: userId, key: 'rescuetime_api_key', value: key, updated_at: new Date().toISOString(),
                  }, { onConflict: 'user_id,key' });
                  alert('RescueTime API key saved. Data will sync tonight at 3 AM UTC.');
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Apple Health Upload (iOS users) */}
      <HealthUploadPanel
        userId={userId}
        adminKey={getAdminKey()}
        onImported={(s) => {
          console.log('Health imported:', s);
          // Refresh sync statuses after import
          fetchSyncStatus(userId).then(setStatuses);
        }}
      />

      {/* Wearables */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Health Data Sources</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="debug-metric">
            <span className="label">iOS (Apple Watch)</span>
            <span className="value">HealthKit live sync via app</span>
          </div>
          <div className="debug-metric" style={{ marginTop: 4 }}>
            <span className="label">Android</span>
            <span className="value">Health Connect + Google Fit</span>
          </div>
          <div className="debug-metric" style={{ marginTop: 4 }}>
            <span className="label">Manual import</span>
            <span className="value">Apple Health XML upload (above)</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            Each new source makes Waldo exponentially smarter. 10 sources = 375 cross-correlations.
          </div>
        </div>
      </div>
    </div>
  );
}

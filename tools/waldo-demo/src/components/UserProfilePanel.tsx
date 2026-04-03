import { useState, useEffect } from 'react';
import { fetchUserProfile, fetchCoreMemory, fetchSyncStatus, getGoogleConnectUrl } from '../supabase-api.js';
import type { UserProfile, SyncStatus, CoreMemoryEntry } from '../types.js';

interface Props { userId: string; onUserSelect: (id: string) => void; allUsers: UserProfile[] }

const ZONE_COLOR: Record<string, string> = {
  early: '#60A5FA', normal: '#34D399', late: '#F59E0B',
};

const CHRONOTYPE_LABEL: Record<string, string> = {
  early: '🌅 Early bird', normal: '☀️ Normal', late: '🦉 Night owl',
};

function MemoryTag({ entry }: { entry: CoreMemoryEntry }) {
  const isNumeric = /^\d+/.test(entry.value);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-surface)', borderRadius: 6,
      padding: '4px 10px', fontSize: 12, marginRight: 6, marginBottom: 6,
    }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{entry.key.replace(/_/g, ' ')}</span>
      <span style={{ fontWeight: 600 }}>{entry.value}</span>
    </div>
  );
}

export function UserProfilePanel({ userId, onUserSelect, allUsers }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memory, setMemory] = useState<CoreMemoryEntry[]>([]);
  const [syncs, setSyncs] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchUserProfile(userId),
      fetchCoreMemory(userId),
      fetchSyncStatus(userId),
    ]).then(([p, m, s]) => {
      setProfile(p);
      setMemory(m);
      setSyncs(s);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Loading profile...</div>;
  }

  if (!profile) {
    return <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Profile not found.</div>;
  }

  const googleConnected = syncs.some(s => s.connected);
  const googleUrl = getGoogleConnectUrl(userId);
  const daysSinceSync = profile.lastHealthSync
    ? Math.floor((Date.now() - new Date(profile.lastHealthSync).getTime()) / 86400000)
    : null;

  return (
    <div style={{ padding: '16px 0' }}>
      {/* User switcher (if multiple users) */}
      {allUsers.length > 1 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allUsers.map(u => (
            <button
              key={u.id}
              className={u.id === userId ? 'btn btn-accent' : 'btn btn-ghost'}
              style={{ fontSize: 11, padding: '5px 14px' }}
              onClick={() => onUserSelect(u.id)}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* Identity card */}
      <div className="debug-section">
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Identity</span>
          <span style={{ fontSize: 11, color: profile.onboardingComplete ? '#34D399' : '#F59E0B' }}>
            {profile.onboardingComplete ? 'Onboarded' : 'Setup incomplete'}
          </span>
        </div>
        <div>
          <div className="debug-metric">
            <span className="label">Name</span>
            <span className="value">{profile.name}</span>
          </div>
          {profile.age && (
            <div className="debug-metric">
              <span className="label">Age</span>
              <span className="value">{profile.age}</span>
            </div>
          )}
          <div className="debug-metric">
            <span className="label">Timezone</span>
            <span className="value">{profile.timezone}</span>
          </div>
          <div className="debug-metric">
            <span className="label">Chronotype</span>
            <span className="value" style={{ color: ZONE_COLOR[profile.chronotype] }}>
              {CHRONOTYPE_LABEL[profile.chronotype] ?? profile.chronotype}
            </span>
          </div>
          <div className="debug-metric">
            <span className="label">Wake time</span>
            <span className="value">{profile.wakeTimeEstimate}</span>
          </div>
          <div className="debug-metric">
            <span className="label">Evening review</span>
            <span className="value">{profile.preferredEveningTime}</span>
          </div>
          <div className="debug-metric">
            <span className="label">Wearable</span>
            <span className="value">{profile.wearableType.replace('_', ' ')}</span>
          </div>
          <div className="debug-metric">
            <span className="label">Telegram</span>
            <span className="value" style={{ color: profile.telegramLinked ? '#34D399' : '#9CA3AF' }}>
              {profile.telegramLinked ? 'Linked' : 'Not linked'}
            </span>
          </div>
          <div className="debug-metric">
            <span className="label">Last health sync</span>
            <span className="value">
              {daysSinceSync === null ? 'Never' : daysSinceSync === 0 ? 'Today' : `${daysSinceSync}d ago`}
            </span>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="debug-section" style={{ marginTop: 8 }}>
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Integrations</span>
          <span style={{ fontSize: 11, color: googleConnected ? '#34D399' : '#9CA3AF' }}>
            {googleConnected ? 'Google connected' : 'Not connected'}
          </span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {syncs.map(s => (
            <div key={s.provider} className="debug-metric" style={{ marginBottom: 6 }}>
              <span className="label">{s.label}</span>
              <span className="value">
                {s.status === 'ok' ? (
                  <span style={{ color: '#34D399' }}>✓ {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                ) : s.status === 'not_connected' ? (
                  <a href={googleUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>
                    Connect →
                  </a>
                ) : (
                  <span style={{ color: '#F59E0B' }}>{s.status}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Core Memory */}
      {memory.length > 0 && (
        <div className="debug-section" style={{ marginTop: 8 }}>
          <div className="debug-header" style={{ cursor: 'default' }}>
            <span>What Waldo knows</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{memory.length} entries</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {memory.map(m => <MemoryTag key={m.id} entry={m} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

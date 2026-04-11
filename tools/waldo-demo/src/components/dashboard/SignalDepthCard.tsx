/**
 * SignalDepthCard — Segmented progress arc showing connected adapters
 *
 * 10-segment arc: filled segments = connected sources, gray = disconnected.
 * Center: "4/10 · 61% depth"
 * Compact: arc + ratio. Expanded: arc + per-source list.
 */
import { useState } from 'react';
import type { SyncStatus } from '../../types.js';

interface SignalDepthCardProps {
  syncStatuses?: SyncStatus[];
}

const ALL_SOURCES = [
  { key: 'apple_health', label: 'Apple Health', icon: '♥' },
  { key: 'google_fit', label: 'Google Fit', icon: '🏃' },
  { key: 'google_calendar', label: 'Calendar', icon: '📅' },
  { key: 'gmail', label: 'Email', icon: '✉' },
  { key: 'google_tasks', label: 'Tasks', icon: '✓' },
  { key: 'spotify', label: 'Music', icon: '♫' },
  { key: 'rescuetime', label: 'Screen Time', icon: '📱' },
  { key: 'telegram', label: 'Telegram', icon: '💬' },
  { key: 'weather', label: 'Weather', icon: '☀' },
  { key: 'air_quality', label: 'Air Quality', icon: '🌬' },
];

function DepthArc({ connected, total, size = 140 }: { connected: number; total: number; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38;
  const segGap = 3; // degrees gap between segments
  const totalSweep = 240; // arc spans 240 degrees (from 150° to 390°)
  const startAngle = 150;
  const segSweep = (totalSweep - segGap * (total - 1)) / total;

  const segments = Array.from({ length: total }, (_, i) => {
    const angle0 = startAngle + i * (segSweep + segGap);
    const angle1 = angle0 + segSweep;
    const a0 = (angle0 * Math.PI) / 180;
    const a1 = (angle1 * Math.PI) / 180;
    const filled = i < connected;
    return (
      <path
        key={i}
        d={`M ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`}
        fill="none"
        stroke={filled ? '#fb943f' : '#e8e6e0'}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
      />
    );
  });

  const pct = total > 0 ? Math.round((connected / total) * 100) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments}
      {/* Center text */}
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" fill="#1a1a1a" fontSize={size * 0.15} fontFamily="'DM Sans', sans-serif" fontWeight="500">
        {connected}/{total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central" fill="#9a9a96" fontSize={size * 0.08} fontFamily="'DM Sans', sans-serif">
        {pct}% depth
      </text>
    </svg>
  );
}

export function SignalDepthCard({ syncStatuses }: SignalDepthCardProps) {
  const [expanded, setExpanded] = useState(false);

  const connectedKeys = new Set((syncStatuses ?? []).filter(s => s.connected).map(s => s.provider));
  const sources = ALL_SOURCES.map(s => ({ ...s, connected: connectedKeys.has(s.key) }));
  const connectedCount = sources.filter(s => s.connected).length;
  const total = sources.length;

  if (!expanded) {
    return (
      <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <span className="zone-badge">Signal Depth</span>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <h3 className="dash-card-title" style={{ fontSize: 22 }}>Signal Depth</h3>
            <p className="dash-card-narrative">
              {connectedCount === 0
                ? 'No sources connected yet. Connect your first source to start.'
                : `${connectedCount} of ${total} sources active. ${connectedCount >= 6 ? 'Rich signal coverage.' : 'Connect more for deeper insights.'}`}
            </p>
          </div>
          <div className="card-compact-visual">
            <DepthArc connected={connectedCount} total={total} size={100} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge">Signal Depth</span>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <DepthArc connected={connectedCount} total={total} size={180} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 24, fontWeight: 400, color: '#1a1a1a', margin: 0, textAlign: 'center' }}>Signal Depth</h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9a9a96', textAlign: 'center', margin: '8px 0 16px' }}>
        Each connected source adds a new dimension to Waldo's insight.
      </p>

      {/* Source list */}
      <div className="component-bars">
        {sources.map(s => (
          <div key={s.key} className="component-row">
            <div className="component-label">
              <span style={{ fontSize: 14, marginRight: 4 }}>{s.icon}</span>
              <span className="component-label-name">{s.label}</span>
            </div>
            <div className="component-value">
              <span className="component-score" style={{
                background: s.connected ? 'rgba(52,211,153,0.12)' : 'rgba(26,26,26,0.04)',
                color: s.connected ? '#065F46' : '#9a9a96',
                borderColor: s.connected ? 'rgba(52,211,153,0.25)' : 'rgba(26,26,26,0.08)',
              }}>
                {s.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

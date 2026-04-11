/**
 * LoadCard — Day Strain card with HR zone bars
 *
 * Matches Figma: strain score X/21, up/down arrow, HR zone breakdown,
 * yesterday comparison, narrative
 */
import type { DayResponse } from '../../types.js';

interface LoadCardProps {
  data: DayResponse;
}

function barWidth(minutes: number, maxMinutes: number): string {
  if (maxMinutes === 0) return '0%';
  return `${Math.min(100, (minutes / maxMinutes) * 100)}%`;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}.${Math.round(m / 6)}h` : `${h}h`;
}

export function LoadCard({ data }: LoadCardProps) {
  if (!data) return null;
  const { strain, crs } = data;

  if (!strain) {
    return (
      <div className="dash-card">
        <span className="zone-badge" style={{ background: 'var(--bg-surface)', color: 'var(--text-dim)' }}>--</span>
        <h3 className="dash-card-title" style={{ marginTop: 12 }}>Load</h3>
        <p className="dash-card-narrative" style={{ color: 'var(--text-dim)' }}>No strain data for this day.</p>
      </div>
    );
  }

  const zone = crs.zone;
  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'moderate' ? 'Steady' : zone === 'low' ? 'Flagging' : '--';
  const zoneBg = zone === 'peak' ? 'var(--peak-bg)' : zone === 'moderate' ? 'var(--steady-bg)' : zone === 'low' ? 'var(--flagging-bg)' : 'var(--bg-surface)';
  const zoneColor = zone === 'peak' ? 'var(--peak-text)' : zone === 'moderate' ? 'var(--steady-text)' : zone === 'low' ? 'var(--flagging-text)' : 'var(--text-dim)';

  const zoneMinutes = strain.zoneMinutes ?? [];
  const zoneNames = strain.zoneNames ?? [];
  const maxZoneMin = Math.max(...zoneMinutes, 60);
  const isUp = (strain.score ?? 0) >= 10;

  // Build zone rows (show up to 5 zones, or however many we have)
  const zones = zoneMinutes.map((mins, i) => ({
    label: zoneNames[i] ?? `Zone ${i + 1}`,
    shortLabel: `zone ${i + 1}`,
    minutes: mins,
    status: mins > 0 ? (mins > 120 ? 'heavy' : 'steady') : '--',
  }));

  return (
    <div className="dash-card">
      <span className="zone-badge" style={{ background: zoneBg, color: zoneColor }}>
        {zoneLabel}
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 className="dash-card-title">Load</h3>
          <p className="dash-card-narrative">
            {strain.summary || `Day strain ${strain.score}/21. ${strain.level}.`}
          </p>
          <span className="dash-card-meta">
            last read &middot; {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
          </span>
        </div>

        {/* Strain score badge */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-surface)', borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>{strain.score}</span>
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>/21</span>
            <span style={{
              background: isUp ? 'var(--accent)' : 'var(--peak-bg)',
              color: isUp ? 'white' : 'var(--peak-text)',
              borderRadius: 6, padding: '2px 6px', fontSize: 12,
              display: 'flex', alignItems: 'center',
            }}>
              {isUp ? '\u2191' : '\u2193'}
            </span>
          </div>

          {/* Zone bars */}
          <div style={{ marginTop: 10 }}>
            {zones.slice(0, 3).map((z, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 4, fontSize: 11,
              }}>
                <span style={{ width: 30, textAlign: 'right', color: 'var(--text-dim)' }}>
                  {formatHours(z.minutes)}
                </span>
                <div style={{
                  width: 90, height: 6, background: 'var(--bg-surface-2)',
                  borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: barWidth(z.minutes, maxZoneMin),
                    background: i === 0 ? '#4F7DF9' : i === 1 ? '#4F7DF9' : '#4F7DF9',
                    opacity: 1 - i * 0.25,
                  }} />
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{z.shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

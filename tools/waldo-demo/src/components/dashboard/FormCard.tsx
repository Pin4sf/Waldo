/**
 * FormCard — Nap Score card with radial gauge + component bars
 *
 * Compact card view (right column): zone badge, title, narrative, gauge
 * Matches Figma: "Your nap score" with radial clock gauge
 */
import { RadialGauge } from './RadialGauge.js';
import type { DayResponse } from '../../types.js';

interface FormCardProps {
  data: DayResponse;
}

const ZONE_LABELS: Record<string, string> = {
  peak: 'Peak',
  moderate: 'Steady',
  low: 'Flagging',
  nodata: '--',
};

const ZONE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  peak: { bg: 'var(--peak-bg)', color: 'var(--peak-text)' },
  moderate: { bg: 'var(--steady-bg)', color: 'var(--steady-text)' },
  low: { bg: 'var(--flagging-bg)', color: 'var(--flagging-text)' },
  nodata: { bg: 'var(--bg-surface)', color: 'var(--text-dim)' },
};

function componentStatus(score: number): string {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'on track';
  if (score >= 50) return 'dipping';
  if (score >= 35) return 'short';
  return 'low';
}

function barColor(score: number): string {
  if (score >= 75) return '#4F7DF9'; // blue
  if (score >= 50) return '#4F7DF9';
  return '#F97316'; // orange for low
}

export function FormCard({ data }: FormCardProps) {
  const crs = data?.crs;
  if (!crs) return null;
  const zone = crs.zone;
  const badge = ZONE_BADGE_STYLES[zone] ?? ZONE_BADGE_STYLES.nodata!;

  const components = [
    { name: 'Sleep', score: crs.sleep?.score ?? 0, status: componentStatus(crs.sleep?.score ?? 0) },
    { name: 'HRV', score: crs.hrv?.score ?? 0, status: componentStatus(crs.hrv?.score ?? 0) },
    { name: 'Circadian', score: crs.circadian?.score ?? 0, status: componentStatus(crs.circadian?.score ?? 0) },
    { name: 'Motion', score: crs.activity?.score ?? 0, status: componentStatus(crs.activity?.score ?? 0) },
  ];

  return (
    <div className="dash-card">
      {/* Zone badge */}
      <span
        className="zone-badge"
        style={{ background: badge.bg, color: badge.color }}
      >
        {ZONE_LABELS[zone]}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        {/* Left: Title + narrative */}
        <div style={{ flex: 1 }}>
          <h3 className="dash-card-title">Form</h3>
          <p className="dash-card-narrative">
            {crs.summary || `${ZONE_LABELS[zone]} day. Score ${crs.score}.`}
          </p>
          <span className="dash-card-meta">updated this morning</span>
        </div>

        {/* Right: Radial gauge */}
        <div style={{ flexShrink: 0 }}>
          <RadialGauge score={crs.score} zone={zone} size={130} compact />
        </div>
      </div>

      {/* Component bars */}
      <div className="component-bars">
        {components.map(c => (
          <div key={c.name} className="component-row">
            <div className="component-label">
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{c.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{c.score}</span>
              <div className="component-bar-track">
                <div
                  className="component-bar-fill"
                  style={{ width: `${c.score}%`, background: barColor(c.score) }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

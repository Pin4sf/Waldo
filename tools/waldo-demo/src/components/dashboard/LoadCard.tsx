/**
 * LoadCard — Day Strain / Load card matching Figma designs
 *
 * Compact: badge + title + narrative + timestamp (left), strain score + zone bars (right)
 * Expanded: tabs + strain summary + zone breakdown table + yesterday's load + about
 */
import { useState } from 'react';
import type { DayResponse } from '../../types.js';

interface LoadCardProps {
  data: DayResponse;
}

type TimeRange = 'today' | '7d' | '30d' | '3m' | '12m';

const TIME_TABS: { id: TimeRange; label: string; disabled?: boolean }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months', disabled: true },
  { id: '12m', label: '12 Months', disabled: true },
];

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}.${Math.round(m / 6)}h` : `${h}h`;
}

function barWidthPct(minutes: number, maxMinutes: number): number {
  if (maxMinutes === 0) return 0;
  return Math.min(100, (minutes / maxMinutes) * 100);
}

export function LoadCard({ data }: LoadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  if (!data) return null;
  const { strain, crs } = data;

  if (!strain) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Load</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No strain data for this day.</p>
      </div>
    );
  }

  const zone = crs.zone;
  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'moderate' ? 'Steady' : zone === 'low' ? 'Flagging' : '--';
  const zoneMinutes = strain.zoneMinutes ?? [];
  const zoneNames = strain.zoneNames ?? [];
  const maxZoneMin = Math.max(...zoneMinutes, 60);
  const isUp = (strain.score ?? 0) >= 10;

  const zones = zoneMinutes.slice(0, 5).map((mins, i) => ({
    label: zoneNames[i] ?? `Zone ${i + 1}`,
    shortLabel: `zone ${i + 1}`,
    hrLabel: `Heart rate - zone ${i + 1}`,
    minutes: mins,
    hours: formatHours(mins),
    pct: barWidthPct(mins, maxZoneMin),
    status: mins > 120 ? 'heavy' : mins > 30 ? 'steady' : mins > 0 ? 'light' : '--',
  }));

  const nowStr = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).toLowerCase();

  const yesterdayScore = Math.max(0, (strain.score ?? 0) - 2);

  // ── Compact card (default) ────────────────────────────────
  if (!expanded) {
    return (
      <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <span className="zone-badge">{zoneLabel}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 0 }}>
          {/* Left: text */}
          <div style={{ flex: 1 }}>
            <h3 className="dash-card-title">Load</h3>
            <p className="dash-card-narrative">
              {strain.summary || `Day strain ${strain.score}/21. ${strain.level ?? ''}.`}
            </p>
            <span className="dash-card-meta">last read · {nowStr}</span>
          </div>

          {/* Right: legend panel */}
          <div className="dash-legend-panel" style={{ minWidth: 200 }}>
            {/* Strain score + yesterday bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
              <div className="dash-score-badge">
                <span className="dash-score-badge-value">{strain.score}/21</span>
                <div className="dash-score-arrow">
                  {isUp ? '↑' : '↓'}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Today vs yesterday bar */}
                <div className="dash-bar-track" style={{ padding: '4px 5px' }}>
                  <div style={{ position: 'relative', height: 4 }}>
                    {/* Yesterday (gray) */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: 4,
                      width: `${barWidthPct(yesterdayScore, 21) * 0.9}%`,
                      background: 'rgba(26,26,26,0.12)', borderRadius: 20,
                    }} />
                    {/* Today (orange) */}
                    <div className="dash-bar-fill" style={{
                      width: `${barWidthPct(strain.score ?? 0, 21) * 0.9}%`,
                      background: '#fb943f',
                    }} />
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                  fontStyle: 'italic', color: '#9a9a96',
                }}>
                  yesterday · {yesterdayScore}/21
                </span>
              </div>
            </div>

            {/* Zone rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {zones.slice(0, 3).map((z, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="zone-time-badge">{z.hours}</span>
                    <div className="dash-bar-track" style={{ width: 80 }}>
                      <div className="dash-bar-fill" style={{ width: `${z.pct}%` }} />
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 400,
                    color: '#6b6b68', letterSpacing: '-0.09px',
                  }}>
                    {z.shortLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded card ─────────────────────────────────────────
  return (
    <div className="dash-card">
      {/* Close */}
      <button
        onClick={() => setExpanded(false)}
        style={{
          float: 'right', background: 'none', border: 'none',
          color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4,
        }}
      >×</button>

      {/* Tabs */}
      <div className="time-tabs-figma">
        {TIME_TABS.map(tab => (
          <button
            key={tab.id}
            className={`time-tab-figma${timeRange === tab.id ? ' active' : ''}`}
            onClick={() => !tab.disabled && setTimeRange(tab.id)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Strain summary legend */}
      <div className="dash-legend-panel" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
          <div className="dash-score-badge">
            <span className="dash-score-badge-value">{strain.score}/21</span>
            <div className="dash-score-arrow">{isUp ? '↑' : '↓'}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="dash-bar-track">
              <div style={{ position: 'relative', height: 4 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: 4,
                  width: `${barWidthPct(yesterdayScore, 21) * 0.9}%`,
                  background: 'rgba(26,26,26,0.12)', borderRadius: 20,
                }} />
                <div className="dash-bar-fill" style={{
                  width: `${barWidthPct(strain.score ?? 0, 21) * 0.9}%`, background: '#fb943f',
                }} />
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, fontStyle: 'italic', color: '#9a9a96' }}>
              yesterday · {yesterdayScore}/21
            </span>
          </div>
        </div>

        {/* Zone rows - compact 3 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {zones.slice(0, 3).map((z, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="zone-time-badge">{z.hours}</span>
                <div className="dash-bar-track" style={{ width: 120 }}>
                  <div className="dash-bar-fill" style={{ width: `${z.pct}%` }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#6b6b68', fontFamily: 'var(--font-body)' }}>
                {z.hrLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Title + narrative */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, padding: '20px 0 30px' }}>
        <span className="zone-badge">{zoneLabel}</span>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0, lineHeight: 1.1, textAlign: 'center' }}>
          Load
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#6b6b68', margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
          {strain.summary || `Day strain ${strain.score}/21. ${strain.level ?? ''}.`}
        </p>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, fontStyle: 'italic', color: '#9a9a96' }}>
          updated at {nowStr}
        </span>
      </div>

      {/* Full zone breakdown */}
      <div className="component-bars">
        {zones.map((z, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">HR zone {i + 1}</span>
              <span className="component-label-status">{z.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{z.hours}</span>
              <div className="component-bar-track">
                <div className="component-bar-fill" style={{ width: `${z.pct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Yesterday's Load summary */}
      <div className="component-bars" style={{ marginTop: 10 }}>
        <div className="component-row">
          <div className="component-label">
            <span className="component-label-name">Yesterday's Load</span>
            <span className="component-label-status">on track</span>
          </div>
          <div className="component-value">
            <span className="component-score">{yesterdayScore}</span>
            <div className="component-bar-track">
              <div className="component-bar-fill" style={{ width: `${barWidthPct(yesterdayScore, 21) * 100 / 21}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{
        background: 'white', border: '1px solid rgba(26,26,26,0.08)',
        borderRadius: 16, padding: 20, marginTop: 10,
      }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{
          fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400,
          color: '#1a1a1a', margin: '20px 0 20px', lineHeight: 1.1,
        }}>What is Load?</h4>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 400,
          color: '#6b6b68', lineHeight: 1.3, margin: 0,
        }}>
          Load is how hard your heart worked today, measured in time spent at different intensities.
          A long walk counts for less than a short run. Five minutes in zone 4 moves the number
          more than an hour in zone 1. It's not about steps. It's about cardiac demand.
          {'\n\n'}
          High Load today means Waldo protects lighter slots in the morning, flags if your calendar
          has hard meetings on top of a depleted Form, and watches tonight's HRV to see how you absorbed it.
        </p>
      </div>
    </div>
  );
}

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

  // ── Bullet graph helpers ──────────────────────────────────────
  const loadScore = strain.score ?? 0;
  const avgRef = Math.max(1, Math.round(loadScore * 0.85)); // simulated 7-day avg
  const BULLET_ZONES = [
    { label: 'Rest', max: 7, color: 'rgba(59,249,211,0.15)' },
    { label: 'Low', max: 11, color: 'rgba(251,191,36,0.12)' },
    { label: 'Medium', max: 14, color: 'rgba(251,148,63,0.15)' },
    { label: 'High', max: 18, color: 'rgba(249,115,22,0.18)' },
    { label: 'Peak', max: 21, color: 'rgba(248,113,113,0.18)' },
  ];
  const barColor = loadScore >= 18 ? '#F87171' : loadScore >= 14 ? '#fb943f' : '#2388ff';

  function BulletGraph({ compact = false }: { compact?: boolean }) {
    const w = 100, h = compact ? 22 : 28;
    const toX = (v: number) => (v / 21) * w;
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {/* Zone bands */}
        {BULLET_ZONES.map((bz, i) => {
          const prev = i === 0 ? 0 : BULLET_ZONES[i - 1]!.max;
          return (
            <rect key={bz.label} x={toX(prev)} y={0} width={toX(bz.max) - toX(prev)} height={h} fill={bz.color} />
          );
        })}
        {/* Track border */}
        <rect x={0} y={0} width={w} height={h} fill="none" stroke="rgba(26,26,26,0.08)" strokeWidth={0.5} rx={3} />
        {/* Today's bar */}
        <rect x={0} y={h * 0.25} width={toX(loadScore)} height={h * 0.5} fill={barColor} rx={2} />
        {/* 7-day avg reference line */}
        <line x1={toX(avgRef)} y1={h * 0.1} x2={toX(avgRef)} y2={h * 0.9} stroke="rgba(26,26,26,0.5)" strokeWidth={1.5} />
        {/* Zone labels (expanded only) */}
        {!compact && BULLET_ZONES.map((bz, i) => {
          const prev = i === 0 ? 0 : BULLET_ZONES[i - 1]!.max;
          return (
            <text key={bz.label} x={toX(prev) + (toX(bz.max) - toX(prev)) / 2} y={h - 3} textAnchor="middle" fill="rgba(26,26,26,0.35)" fontSize={3.5} fontFamily="'DM Sans', sans-serif">{bz.label}</text>
          );
        })}
      </svg>
    );
  }

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

          {/* Right: bullet graph panel */}
          <div className="dash-legend-panel" style={{ minWidth: 190, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Score + arrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dash-score-badge">
                <span className="dash-score-badge-value">{strain.score}/21</span>
                <div className="dash-score-arrow">{isUp ? '↑' : '↓'}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontStyle: 'italic', color: '#9a9a96' }}>
                avg {avgRef}/21
              </span>
            </div>
            {/* Bullet graph */}
            <div>
              <BulletGraph compact />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 8, color: '#9a9a96' }}>0</span>
                <span style={{ fontSize: 8, color: '#9a9a96', fontStyle: 'italic' }}>│ 7-day avg</span>
                <span style={{ fontSize: 8, color: '#9a9a96' }}>21</span>
              </div>
            </div>
            {/* Zone rows (top 3) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {zones.slice(0, 3).map((z, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="zone-time-badge">{z.hours}</span>
                    <div className="dash-bar-track" style={{ width: 70 }}>
                      <div className="dash-bar-fill" style={{ width: `${z.pct}%` }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', letterSpacing: '-0.09px' }}>
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

      {/* Strain summary legend (expanded) */}
      <div className="dash-legend-panel" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="dash-score-badge">
            <span className="dash-score-badge-value">{strain.score}/21</span>
            <div className="dash-score-arrow">{isUp ? '↑' : '↓'}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontStyle: 'italic', color: '#9a9a96' }}>
            7-day avg · {avgRef}/21
          </span>
        </div>
        {/* Full-width bullet graph */}
        <BulletGraph />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: '#9a9a96' }}>Rest</span>
          <span style={{ fontSize: 9, color: '#9a9a96' }}>Low</span>
          <span style={{ fontSize: 9, color: '#9a9a96' }}>Medium</span>
          <span style={{ fontSize: 9, color: '#9a9a96' }}>High</span>
          <span style={{ fontSize: 9, color: '#9a9a96' }}>Peak</span>
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

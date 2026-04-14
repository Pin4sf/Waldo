/**
 * TheSlopeCard — 4-week direction dumbbell plot.
 *
 * Figma spec: six rows (Body/Schedule/Communication/Tasks/Mood/Screen).
 * Left dot = 4 weeks ago (7-day avg). Right dot = this week (7-day avg).
 * Right dot green = improving · rose = declining · gray = stable.
 * Connecting line colored by direction.
 *
 * Significance threshold: >5% change = directional, else stable.
 * Higher-is-better: Body, Mood, Screen.
 * Lower-is-better: Schedule (MLS), Communication (after-hours %), Tasks (overdue).
 */
import { useState } from 'react';
import type { TrendData, TrendDimension, TrendDirection } from '../../types.js';

interface TheSlopeCardProps {
  data: TrendData | null;
  isLoading?: boolean;
}

const DIRECTION_COLOR: Record<TrendDirection, string> = {
  improving: '#34D399',
  stable:    '#9a9a96',
  declining: '#F87171',
};

const DIRECTION_ARROW: Record<TrendDirection, string> = {
  improving: '→',
  stable:    '→',
  declining: '→',
};

const OVERALL_LABEL: Record<TrendDirection, string> = {
  improving: 'Improving',
  stable:    'Stable',
  declining: 'Declining',
};

const OVERALL_COPY: Record<TrendDirection, string> = {
  improving: 'Things are moving in the right direction.',
  stable:    'Holding steady across most dimensions.',
  declining: 'Five of six dimensions are moving the wrong way. Waldo is watching this closely.',
};

const GHOST_COPY: Record<string, string> = {
  schedule:      "The Stack needs your Calendar. Connect Google Calendar →",
  communication: "Signal Pressure needs your inbox. Metadata only — Waldo never reads content. Connect Gmail →",
  tasks:         "Task Pile-Up needs your task manager. Connect Todoist or Google Tasks →",
  mood:          "The Tone needs your Spotify. Connect Spotify →",
  screen:        "Signal Ratio needs your screen activity. Connect RescueTime →",
};

function formatValue(dim: TrendDimension, val: number | null): string {
  if (val === null) return '--';
  if (dim.unit === 'pts') return String(Math.round(val));
  if (dim.unit === 'MLS') return val.toFixed(1);
  if (dim.unit === '%') return `${Math.round(val)}%`;
  if (dim.unit === 'overdue') return String(Math.round(val));
  return String(Math.round(val));
}

function DumbbellRow({ dim }: { dim: TrendDimension }) {
  if (!dim.available) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 0', borderBottom: '0.5px solid rgba(26,26,26,0.06)',
        opacity: 0.45,
      }}>
        <div style={{ width: 80, fontSize: 12, fontWeight: 500, color: '#1a1a1a', fontFamily: 'var(--font-body)' }}>
          {dim.label}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#e5e5e3', border: '1.5px solid #d1d0cd' }} />
          <div style={{ flex: 1, height: 1, background: '#e5e5e3', borderStyle: 'dashed', borderWidth: 0.5 }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#e5e5e3', border: '1.5px solid #d1d0cd' }} />
        </div>
        <div style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)', width: 60, textAlign: 'right' }}>
          not connected
        </div>
      </div>
    );
  }

  const color = DIRECTION_COLOR[dim.direction];
  const w1Label = formatValue(dim, dim.weekOneValue);
  const w8Label = formatValue(dim, dim.weekFourValue);
  const delta = (dim.weekOneValue !== null && dim.weekFourValue !== null)
    ? dim.weekFourValue - dim.weekOneValue
    : null;
  const deltaStr = delta === null ? '' : (delta > 0 ? `+${delta.toFixed(delta % 1 === 0 ? 0 : 1)}` : delta.toFixed(delta % 1 === 0 ? 0 : 1));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', borderBottom: '0.5px solid rgba(26,26,26,0.06)',
    }}>
      {/* Dimension label */}
      <div style={{ width: 80, fontSize: 12, fontWeight: 500, color: '#1a1a1a', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
        {dim.label}
      </div>

      {/* 4 weeks ago label */}
      <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: 'var(--font-body)', width: 28, textAlign: 'right', flexShrink: 0 }}>
        {w1Label}
      </div>

      {/* Dumbbell track */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', height: 16 }}>
        {/* Track line */}
        <div style={{
          position: 'absolute', left: 6, right: 6, height: 1.5,
          background: `linear-gradient(to right, rgba(26,26,26,0.1), ${color}40)`,
          borderRadius: 1,
        }} />
        {/* Left dot — 4 weeks ago */}
        <div style={{
          position: 'absolute', left: 0,
          width: 10, height: 10, borderRadius: 5,
          background: '#fff', border: '1.5px solid rgba(26,26,26,0.2)',
          transform: 'translateY(-50%)', top: '50%',
        }} />
        {/* Right dot — this week */}
        <div style={{
          position: 'absolute', right: 0,
          width: 10, height: 10, borderRadius: 5,
          background: color,
          transform: 'translateY(-50%)', top: '50%',
          boxShadow: `0 0 0 2px ${color}30`,
        }} />
      </div>

      {/* This week label */}
      <div style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'var(--font-body)', width: 28, textAlign: 'left', flexShrink: 0 }}>
        {w8Label}
      </div>

      {/* Delta */}
      <div style={{
        fontSize: 10, color, fontFamily: 'var(--font-body)',
        width: 36, textAlign: 'right', flexShrink: 0, fontWeight: 500,
      }}>
        {deltaStr}{dim.unit === '%' || dim.unit === 'overdue' ? '' : ''}{' '}
        {dim.direction === 'improving' ? '↑' : dim.direction === 'declining' ? '↓' : '→'}
      </div>
    </div>
  );
}

export function TheSlopeCard({ data, isLoading }: TheSlopeCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="dash-card">
        <span className="zone-badge" style={{ background: '#f4f3f0', color: '#9a9a96' }}>The Slope</span>
        <p className="dash-card-narrative" style={{ color: '#9a9a96', marginTop: 8 }}>Computing 4-week direction...</p>
      </div>
    );
  }

  if (!data || data.daysAnalysed === 0) {
    return (
      <div className="dash-card" style={{ opacity: 0.6, border: '1px dashed var(--border)' }}>
        <span className="zone-badge" style={{ background: '#f4f3f0', color: '#9a9a96' }}>The Slope</span>
        <h3 className="dash-card-title" style={{ marginTop: 12 }}>The Slope</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>
          The Slope needs 30 days of data and at least 2 sources connected. Keep going.
        </p>
      </div>
    );
  }

  const overallColor = DIRECTION_COLOR[data.overallDirection];

  if (!expanded) {
    const decliningCount = data.dimensions.filter(d => d.available && d.direction === 'declining').length;
    const improvingCount = data.dimensions.filter(d => d.available && d.direction === 'improving').length;
    const availableCount = data.dimensions.filter(d => d.available).length;

    return (
      <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="zone-badge" style={{ background: `${overallColor}18`, color: overallColor }}>
            {OVERALL_LABEL[data.overallDirection]}
          </span>
          <span style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>
            {data.rangeLabel} · {data.daysAnalysed}d
          </span>
        </div>

        <h3 className="dash-card-title">The Slope</h3>
        <p className="dash-card-narrative" style={{ marginBottom: 12 }}>
          {decliningCount > 2
            ? `${decliningCount} of ${availableCount} dimensions moving the wrong way. Waldo is watching this closely.`
            : improvingCount > 2
            ? `${improvingCount} of ${availableCount} dimensions improving. Things are trending up.`
            : OVERALL_COPY[data.overallDirection]}
        </p>

        {/* Mini dumbbell preview — top 3 available dimensions */}
        <div>
          {data.dimensions.filter(d => d.available).slice(0, 3).map(dim => (
            <div key={dim.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#6b6b68', fontFamily: 'var(--font-body)', width: 80, flexShrink: 0 }}>
                {dim.label}
              </span>
              <div style={{ flex: 1, height: 2, background: '#f0ede8', borderRadius: 1, position: 'relative' }}>
                <div style={{
                  position: 'absolute', right: 0, width: 6, height: 6,
                  borderRadius: 3, background: DIRECTION_COLOR[dim.direction],
                  top: -2,
                }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: DIRECTION_COLOR[dim.direction], fontFamily: 'var(--font-body)', width: 24, textAlign: 'right' }}>
                {dim.direction === 'improving' ? '↑' : dim.direction === 'declining' ? '↓' : '→'}
              </span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 10, color: '#9a9a96', fontStyle: 'italic', fontFamily: 'var(--font-body)', marginTop: 6, display: 'block' }}>
          tap to see all 6 dimensions
        </span>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────
  return (
    <div className="dash-card">
      <button
        onClick={() => setExpanded(false)}
        style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}
      >×</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="zone-badge" style={{ background: `${overallColor}18`, color: overallColor }}>
          {OVERALL_LABEL[data.overallDirection]}
        </span>
        <span style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>
          {data.rangeLabel}
        </span>
      </div>

      <h3 className="dash-card-title" style={{ marginBottom: 4 }}>The Slope</h3>
      <p className="dash-card-narrative" style={{ marginBottom: 16 }}>
        {OVERALL_COPY[data.overallDirection]}
      </p>

      {/* Column headers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, padding: '0 0 4px', borderBottom: '0.5px solid rgba(26,26,26,0.12)' }}>
        <div style={{ width: 80, fontSize: 9, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9a9a96', fontFamily: 'var(--font-body)' }}>
          Dimension
        </div>
        <div style={{ width: 28, fontSize: 9, color: '#9a9a96', textAlign: 'right', fontFamily: 'var(--font-body)' }}>4w ago</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, fontSize: 9, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>now</div>
        <div style={{ width: 36, fontSize: 9, color: '#9a9a96', textAlign: 'right', fontFamily: 'var(--font-body)' }}>Δ</div>
      </div>

      {/* Dumbbell rows */}
      {data.dimensions.map(dim => <DumbbellRow key={dim.key} dim={dim} />)}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { label: '● today', color: overallColor },
          { label: '○ 4 weeks ago', color: '#9a9a96' },
        ].map(l => (
          <span key={l.label} style={{ fontSize: 10, color: l.color, fontFamily: 'var(--font-body)' }}>{l.label}</span>
        ))}
      </div>

      {/* About */}
      <div style={{ background: '#f9f8f6', borderRadius: 12, padding: '14px 16px', marginTop: 12 }}>
        <p style={{ fontSize: 10, color: '#6b6b68', lineHeight: 1.6, fontFamily: 'var(--font-body)', margin: 0 }}>
          The Slope shows whether things are getting better or worse across every dimension Waldo tracks — over four weeks, not just today.
          A single bad day doesn't move it. A consistent direction over a month does.{' '}
          When five of six rows point the same way, that's the story.
        </p>
      </div>
    </div>
  );
}

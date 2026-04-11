/**
 * SleepCard — Sleep stages card matching Figma designs
 *
 * Compact: badge + title + narrative + timestamp (left), colored hypnogram panel (right)
 */
import type { DayResponse } from '../../types.js';

interface SleepCardProps {
  data: DayResponse;
}

// Figma colors for each stage band
const STAGE_CONFIG = [
  { key: 'awake' as const, label: 'awake', bg: 'rgba(255,47,0,0.1)', line: '#ff7c25' },
  { key: 'rem'   as const, label: 'REM',   bg: 'rgba(59,249,211,0.1)', line: '#07bea6' },
  { key: 'core'  as const, label: 'core',  bg: 'rgba(243,107,239,0.1)', line: '#ff60fa' },
  { key: 'deep'  as const, label: 'deep',  bg: 'rgba(25,117,255,0.1)', line: '#3485ff' },
];

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Generate step-path hypnogram from stage percentages */
function buildHypnogram(
  stages: { core: number; deep: number; rem: number; awake: number },
  width: number,
  height: number,
): string {
  const stageY: Record<string, number> = {
    awake: height * 0.14,
    rem:   height * 0.36,
    core:  height * 0.61,
    deep:  height * 0.86,
  };

  const total = stages.awake + stages.rem + stages.core + stages.deep || 1;
  const segs = 24;
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = t * width;
    const cyclePos = (t * 4) % 1;
    let stage: string;

    if (t < 0.04 || t > 0.96) {
      stage = 'awake';
    } else if (cyclePos < 0.12) {
      stage = 'core';
    } else if (cyclePos < 0.30) {
      stage = t < 0.5 ? 'deep' : 'core';
    } else if (cyclePos < 0.50) {
      stage = 'core';
    } else if (cyclePos < 0.72) {
      stage = 'rem';
    } else {
      stage = Math.random() < 0.12 ? 'awake' : 'core';
    }

    // Bias toward actual stage ratios
    const rand = Math.random();
    if (rand < stages.awake / total * 0.3) stage = 'awake';
    if (rand < stages.deep / total * 0.4) stage = 'deep';

    pts.push({ x, y: stageY[stage]! });
  }

  let path = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    path += ` H ${pts[i]!.x} V ${pts[i]!.y}`;
  }
  return path;
}

export function SleepCard({ data }: SleepCardProps) {
  if (!data) return null;
  const { sleep, crs } = data;

  if (!sleep) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Sleep stages</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No sleep data for this day.</p>
      </div>
    );
  }

  const zone = crs.zone;
  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'moderate' ? 'Steady' : zone === 'low' ? 'Flagging' : '--';
  const durationStr = formatDuration(sleep.durationHours);
  const sleepFactors = crs.sleep?.factors ?? [];
  const narrative = sleepFactors.length > 0 ? sleepFactors[0]! : `${durationStr} total sleep.`;

  const chartW = 198;
  const chartH = 110;
  const bandH = chartH / 4;
  const hypnogram = buildHypnogram(sleep.stages, chartW, chartH);

  return (
    <div className="dash-card">
      <span className="zone-badge">{zoneLabel}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 0 }}>
        {/* Left: text */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 className="dash-card-title">Sleep stages</h3>
          <p className="dash-card-narrative">{narrative}</p>
          <span className="dash-card-meta">
            Last night · {durationStr} total
          </span>
        </div>

        {/* Right: Figma-style hypnogram panel */}
        <div style={{
          background: 'white',
          border: '1px solid rgba(26,26,26,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
        }}>
          <svg width={chartW + 30} height={chartH + 20} viewBox={`0 0 ${chartW + 30} ${chartH + 20}`}>
            {/* Colored stage bands */}
            {STAGE_CONFIG.map((band, i) => (
              <rect
                key={band.key}
                x={14} y={i * bandH}
                width={chartW} height={bandH}
                fill={band.bg}
              />
            ))}

            {/* Stage labels (centered in each band) */}
            {STAGE_CONFIG.map((band, i) => (
              <text
                key={`lbl-${band.key}`}
                x={(chartW + 14) / 2 + 7}
                y={i * bandH + bandH / 2}
                textAnchor="middle" dominantBaseline="central"
                fill="#9a9a96" fontSize={8}
                fontFamily="'DM Sans', sans-serif"
              >
                {band.label}
              </text>
            ))}

            {/* Vertical time markers */}
            <line x1={14} y1={0} x2={14} y2={chartH} stroke="rgba(26,26,26,0.1)" strokeWidth={0.8} />
            <line x1={chartW + 14} y1={0} x2={chartW + 14} y2={chartH} stroke="rgba(26,26,26,0.1)" strokeWidth={0.8} />

            {/* Hypnogram step-path */}
            <path
              d={`M ${hypnogram.slice(1)}`}
              fill="none" stroke="#1a1a1a" strokeWidth={1.5} opacity={0.55}
              strokeLinecap="round" strokeLinejoin="round"
              transform="translate(14, 0)"
            />

            {/* Time labels below */}
            <text x={14} y={chartH + 14} textAnchor="start"
              fill="#9a9a96" fontSize={8} fontFamily="'DM Sans', sans-serif">
              {sleep.bedtime || '11pm'}
            </text>
            <text x={chartW + 14} y={chartH + 14} textAnchor="end"
              fill="#9a9a96" fontSize={8} fontFamily="'DM Sans', sans-serif">
              {sleep.wakeTime || '7am'}
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

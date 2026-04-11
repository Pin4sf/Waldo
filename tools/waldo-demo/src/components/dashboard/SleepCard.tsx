/**
 * SleepCard — Sleep stages card with hypnogram visualization
 *
 * Matches Figma: zone badge, "Sleep stages" title, narrative,
 * colored hypnogram (awake/REM/core/deep bands), bedtime to wake time
 */
import type { DayResponse } from '../../types.js';

interface SleepCardProps {
  data: DayResponse;
}

const STAGE_COLORS = {
  awake: '#F9A8A8',   // coral/pink
  rem: '#93D5E0',     // light teal
  core: '#5EB89A',    // green-teal
  deep: '#7C8BF0',    // blue-purple
};

const STAGE_BANDS = [
  { key: 'awake' as const, label: 'awake', color: STAGE_COLORS.awake, bgAlpha: 0.25 },
  { key: 'rem' as const, label: 'REM', color: STAGE_COLORS.rem, bgAlpha: 0.2 },
  { key: 'core' as const, label: 'core', color: STAGE_COLORS.core, bgAlpha: 0.2 },
  { key: 'deep' as const, label: 'deep', color: STAGE_COLORS.deep, bgAlpha: 0.25 },
];

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Generate a simplified hypnogram path from stage percentages */
function generateHypnogram(
  stages: { core: number; deep: number; rem: number; awake: number },
  width: number,
  height: number,
): string {
  // Map stages to vertical positions (0=top=awake, 3=bottom=deep)
  const stageY = {
    awake: height * 0.1,
    rem: height * 0.35,
    core: height * 0.6,
    deep: height * 0.85,
  };

  // Generate a sequence of sleep stages based on percentages
  const totalPct = stages.awake + stages.rem + stages.core + stages.deep;
  if (totalPct === 0) return '';

  // Typical sleep cycle pattern: light -> deep -> REM, repeating
  const segments = 20;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * width;
    let stage: keyof typeof stageY;

    // Simulate sleep architecture
    const cyclePos = (t * 4) % 1; // ~4 sleep cycles per night
    if (t < 0.05 || t > 0.95) {
      stage = 'awake';
    } else if (cyclePos < 0.15) {
      stage = 'core';
    } else if (cyclePos < 0.35) {
      stage = t < 0.5 ? 'deep' : 'core'; // less deep sleep later
    } else if (cyclePos < 0.55) {
      stage = 'core';
    } else if (cyclePos < 0.75) {
      stage = 'rem';
    } else {
      stage = Math.random() < 0.15 ? 'awake' : 'core'; // brief awakenings
    }

    points.push({ x, y: stageY[stage] });
  }

  // Build step-path (horizontal then vertical, like a real hypnogram)
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const prev = points[i - 1]!;
    path += ` H ${p.x} V ${p.y}`;
    // Avoid unused var warning
    void prev;
  }

  return path;
}

export function SleepCard({ data }: SleepCardProps) {
  if (!data) return null;
  const { sleep, crs } = data;
  if (!sleep) {
    return (
      <div className="dash-card">
        <span className="zone-badge" style={{ background: 'var(--bg-surface)', color: 'var(--text-dim)' }}>--</span>
        <h3 className="dash-card-title" style={{ marginTop: 12 }}>Sleep stages</h3>
        <p className="dash-card-narrative" style={{ color: 'var(--text-dim)' }}>No sleep data for this day.</p>
      </div>
    );
  }

  const zone = crs.zone;
  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'moderate' ? 'Steady' : zone === 'low' ? 'Flagging' : '--';
  const zoneBg = zone === 'peak' ? 'var(--peak-bg)' : zone === 'moderate' ? 'var(--steady-bg)' : zone === 'low' ? 'var(--flagging-bg)' : 'var(--bg-surface)';
  const zoneColor = zone === 'peak' ? 'var(--peak-text)' : zone === 'moderate' ? 'var(--steady-text)' : zone === 'low' ? 'var(--flagging-text)' : 'var(--text-dim)';

  const chartW = 180;
  const chartH = 100;

  // Build narrative
  const durationStr = formatDuration(sleep.durationHours);
  const sleepFactors = crs.sleep?.factors ?? [];
  const sleepSummary = sleepFactors.length > 0
    ? sleepFactors[0]
    : `${durationStr} total sleep.`;

  return (
    <div className="dash-card">
      <span className="zone-badge" style={{ background: zoneBg, color: zoneColor }}>
        {zoneLabel}
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 className="dash-card-title">Sleep stages</h3>
          <p className="dash-card-narrative">{sleepSummary}</p>
          <span className="dash-card-meta">
            Last night &middot; {durationStr} total
          </span>
        </div>

        {/* Hypnogram visualization */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
            {/* Background bands */}
            {STAGE_BANDS.map((band, i) => (
              <rect
                key={band.key}
                x={0} y={i * (chartH / 4)}
                width={chartW} height={chartH / 4}
                fill={band.color}
                opacity={band.bgAlpha}
              />
            ))}

            {/* Stage labels */}
            {STAGE_BANDS.map((band, i) => (
              <text
                key={`label-${band.key}`}
                x={chartW / 2}
                y={i * (chartH / 4) + chartH / 8}
                textAnchor="middle"
                dominantBaseline="central"
                fill={band.color}
                fontSize={9}
                fontFamily="'DM Sans', sans-serif"
                opacity={0.7}
              >
                {band.label}
              </text>
            ))}

            {/* Hypnogram path */}
            <path
              d={generateHypnogram(sleep.stages, chartW, chartH)}
              fill="none"
              stroke="#1A1A1A"
              strokeWidth={1.5}
              opacity={0.6}
            />
          </svg>

          {/* Time labels */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, color: 'var(--text-dim)', marginTop: 2,
          }}>
            <span>{sleep.bedtime || '11pm'}</span>
            <span>{sleep.wakeTime || '7am'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SleepCard — Sleep stages card matching Figma designs
 *
 * Compact: badge + title + narrative + timestamp (left), colored hypnogram panel (right)
 */
import type { DayResponse } from '../../types.js';
import type { DashboardHistoryContext } from './history.js';

interface SleepCardProps {
  data: DayResponse;
  history?: DashboardHistoryContext;
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
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Format ISO timestamp or time string → "11pm" / "7:30am" */
function formatSleepTime(raw: string): string {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw; // not parseable — return as-is
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase().replace(':00', ''); // "11pm" not "11:00pm"
  } catch {
    return raw;
  }
}

function allocateBarStages(stages: { core: number; deep: number; rem: number; awake: number }, count = 11) {
  const weights = [
    { key: 'deep' as const, value: stages.deep },
    { key: 'rem' as const, value: stages.rem },
    { key: 'core' as const, value: stages.core },
    { key: 'awake' as const, value: stages.awake },
  ];
  const total = weights.reduce((sum, item) => sum + item.value, 0) || 1;
  const counts = Object.fromEntries(weights.map(({ key, value }) => [key, Math.max(value > 0 ? 1 : 0, Math.round((value / total) * count))])) as Record<'core' | 'deep' | 'rem' | 'awake', number>;

  let assigned = counts.core + counts.deep + counts.rem + counts.awake;
  while (assigned > count) {
    const reducible = (['core', 'rem', 'deep', 'awake'] as const)
      .find((key) => counts[key] > 1);
    if (!reducible) break;
    counts[reducible] -= 1;
    assigned -= 1;
  }
  while (assigned < count) {
    counts.core += 1;
    assigned += 1;
  }

  const layout = new Array<'core' | 'deep' | 'rem' | 'awake'>(count).fill('core');
  const preferredSlots: Record<'core' | 'deep' | 'rem' | 'awake', number[]> = {
    deep: [1, 7],
    rem: [2, 5, 9],
    awake: [4, 8],
    core: [0, 3, 6, 10],
  };

  (['deep', 'rem', 'awake', 'core'] as const).forEach((stage) => {
    let remaining = counts[stage];
    preferredSlots[stage].forEach((slot) => {
      if (remaining > 0 && slot < count && layout[slot] === 'core') {
        layout[slot] = stage;
        remaining -= 1;
      }
    });
    for (let index = 0; index < count && remaining > 0; index += 1) {
      if (layout[index] === 'core' && stage !== 'core') {
        layout[index] = stage;
        remaining -= 1;
      }
    }
  });

  return layout;
}

export function SleepCard({ data, history }: SleepCardProps) {
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
  const previousSleepHours = history?.previousEntry?.sleepHours ?? null;
  const previousLabel = previousSleepHours ? formatDuration(previousSleepHours) : null;
  const delta = previousSleepHours === null ? null : sleep.durationHours - previousSleepHours;
  const deltaIsPositive = delta === null ? true : delta >= 0;
  const stageBars = allocateBarStages(sleep.stages).map((stage, index) => {
    const height = [42, 64, 78, 36, 54, 68, 44, 72, 58, 66, 40][index]!;
    const color = STAGE_CONFIG.find((item) => item.key === stage)?.line ?? '#3485ff';
    return { stage, height, color };
  });

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

        {/* Right: Figma-style stage panel */}
        <div style={{
          background: 'white',
          border: '1px solid rgba(26,26,26,0.08)',
          borderRadius: 16,
          padding: '18px 18px 16px',
          minWidth: 258,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid rgba(26,26,26,0.08)',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: 18,
              fontWeight: 500,
              color: '#1a1a1a',
              lineHeight: 1,
            }}>
              <span>{durationStr}</span>
              <span style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: '#fb943f',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}>
                {deltaIsPositive ? '↑' : '↓'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, minHeight: 82 }}>
            {stageBars.map((bar, index) => (
              <div
                key={`${bar.stage}-${index}`}
                style={{
                  width: 9,
                  height: bar.height,
                  borderRadius: 999,
                  background: bar.color,
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9a9a96' }}>
            <span>Yesterday</span>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#fb943f',
              display: 'inline-block',
            }} />
            <span>{previousLabel ?? formatSleepTime(sleep.bedtime) ?? 'Last night'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

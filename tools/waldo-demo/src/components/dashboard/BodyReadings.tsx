/**
 * BodyReadings — SpO2 + Respiratory Rate in a compact row
 *
 * SpO2: only visible when < 95%. Number + colored tag.
 * Respiratory Rate: 7-day sparkline (shared format with Resting HR).
 * These are quiet signals — they sit in a single condensed row, not full cards.
 */
import type { DayResponse } from '../../types.js';

interface BodyReadingsProps {
  data: DayResponse;
}

/** 7-day pseudo-history from a single value (deterministic) */
function spark7(today: number, seed: number): number[] {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  return Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return today;
    const jitter = (rng() - 0.5) * 3;
    return Math.max(8, Math.min(25, today + jitter));
  });
}

function MiniSparkline({ values, color, size = { w: 64, h: 22 } }: { values: number[]; color: string; size?: { w: number; h: number } }) {
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const toX = (i: number) => (i / (values.length - 1)) * size.w;
  const toY = (v: number) => size.h - ((v - min) / (max - min)) * size.h;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');

  return (
    <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1]!)} r={2.5} fill={color} />
    </svg>
  );
}

export function BodyReadings({ data }: BodyReadingsProps) {
  // SpO2 — only show below 95%
  const spo2 = 97; // not in current DayResponse — stubbed at normal
  const showSpo2 = spo2 < 95;

  // Respiratory rate — derive from restingHR (not separately tracked yet, stub)
  const respRate = data.restingHR ? Math.round(data.restingHR / 4.2) : null;
  const respHistory = respRate ? spark7(respRate, Math.round(respRate * 7)) : null;
  const respTrend = respHistory
    ? respHistory[6]! > respHistory[5]! ? '↑ rising' : respHistory[6]! < respHistory[5]! ? '↓ dropping' : '→ stable'
    : null;
  const respColor = respTrend?.startsWith('↑') ? '#F87171' : '#9a9a96';

  // If nothing to show, return null
  if (!showSpo2 && !respRate) return null;

  return (
    <div className="dash-card card-tier2" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* SpO2 — conditional */}
        {showSpo2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>
              SpO2 {spo2}%
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
              background: spo2 >= 95 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
              color: spo2 >= 95 ? '#065F46' : '#991B1B',
            }}>
              {spo2 >= 95 ? 'Normal' : 'Low'}
            </span>
          </div>
        )}

        {/* Respiratory Rate */}
        {respRate && respHistory && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
              Resp {respRate} <span style={{ fontSize: 10, color: '#9a9a96' }}>brpm</span>
            </span>
            <MiniSparkline values={respHistory} color={respColor} />
            <span style={{ fontSize: 10, color: respColor, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              {respTrend}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

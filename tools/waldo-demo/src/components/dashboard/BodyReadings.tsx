/**
 * BodyReadings — SpO2 + Respiratory Rate in a compact row.
 *
 * SpO2: only visible when < 95% (normal range = invisible per spec).
 *       Reads from data.spO2 (health_snapshots.spo2).
 *
 * Respiratory Rate: 7-day sparkline from real history.
 *       Reads from data.respiratoryRate (health_snapshots.respiratory_rate).
 *       Uses allDates history if available, else hides (no fake data).
 */
import type { DayResponse } from '../../types.js';
import type { HealthHistory } from '../../types.js';

interface BodyReadingsProps {
  data: DayResponse;
  history?: HealthHistory;
}

function MiniSparkline({ values, color, size = { w: 64, h: 22 } }: { values: number[]; color: string; size?: { w: number; h: number } }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  if (max === min) return null;
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

export function BodyReadings({ data, history }: BodyReadingsProps) {
  // SpO2 — read from real data. Only surface if below 95% per spec.
  const spo2 = data.spO2;
  const showSpo2 = spo2 !== null && spo2 !== undefined && spo2 < 95;

  // Respiratory rate — read from real data only. No derivation from HR.
  const respRate = data.respiratoryRate;

  // 7-day history from real allDates if available
  // history?.respiratoryRate7d is not yet in HealthHistory type — if no real history, show single reading only
  const respHistory: number[] | null = respRate
    ? [respRate] // Show current value; sparkline needs 7 days of real data (not yet collected)
    : null;

  const respTrend = null; // Requires 7 days of real resp rate data — not yet available

  // Nothing real to show
  if (!showSpo2 && !respRate) return null;

  return (
    <div className="dash-card card-tier2" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* SpO2 — only shown when below 95% (normal range = invisible) */}
        {showSpo2 && spo2 !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>
              SpO2 {Math.round(spo2)}%
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
              background: spo2 >= 95 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
              color: spo2 >= 95 ? '#065F46' : '#991B1B',
            }}>
              {spo2 >= 95 ? 'Normal' : 'Low — check your watch'}
            </span>
          </div>
        )}

        {/* Respiratory rate — real value from health_snapshots.respiratory_rate */}
        {respRate !== null && respRate !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
              Resp {Math.round(respRate)} <span style={{ fontSize: 10, color: '#9a9a96' }}>brpm</span>
            </span>
            <span style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>
              {respRate >= 12 && respRate <= 20 ? '· normal range' : respRate > 20 ? '· elevated' : '· low'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

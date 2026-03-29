import { useEffect, useState } from 'react';
import type { DayResponse } from '../types.js';

interface Props {
  data: DayResponse;
}

function getBarZone(score: number): string {
  if (score >= 80) return 'peak';
  if (score >= 50) return 'moderate';
  return 'low';
}

function zoneColor(zone: string): string {
  if (zone === 'peak') return '#34D399';
  if (zone === 'moderate') return '#FBBF24';
  return '#F87171';
}

/** SVG arc gauge — 240 degree arc */
function CrsGauge({ score, zone }: { score: number; zone: string }) {
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    if (score < 0) { setAnimatedPct(0); return; }
    setAnimatedPct(0);
    const target = score / 100;
    const duration = 800;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPct(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [score]);

  const size = 160;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 240 degree arc, starting from bottom-left
  const startAngle = 150; // degrees
  const endAngle = 390;   // 150 + 240
  const totalArc = 240;

  function polarToCart(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Background arc
  const bgStart = polarToCart(startAngle, radius);
  const bgEnd = polarToCart(endAngle, radius);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  // Filled arc
  const fillAngle = startAngle + totalArc * animatedPct;
  const fillEnd = polarToCart(fillAngle, radius);
  const largeArc = (fillAngle - startAngle) > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  const color = zoneColor(zone);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background track */}
      <path d={bgPath} fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round" />
      {/* Filled arc */}
      {score >= 0 && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />
      )}
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: 'var(--font-headline)', fontSize: 44, fontWeight: 700, fill: score >= 0 ? color : 'var(--text-dim)' }}>
        {score >= 0 ? Math.round(animatedPct * 100) : '—'}
      </text>
      {/* Zone label */}
      <text x={cx} y={cy + 28} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, fill: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' } as React.CSSProperties}>
        {score >= 0 ? zone : 'no data'}
      </text>
    </svg>
  );
}

export function CrsCard({ data }: Props) {
  const { crs } = data;

  const components = [
    { name: 'Sleep', weight: '35%', data: crs.sleep },
    { name: 'HRV', weight: '25%', data: crs.hrv },
    { name: 'Circadian', weight: '25%', data: crs.circadian },
    { name: 'Activity', weight: '15%', data: crs.activity },
  ];

  return (
    <div className="card crs-card" style={{ padding: '20px 20px 24px' }}>
      <CrsGauge score={crs.score} zone={crs.zone} />

      <div className="crs-confidence" style={{ textAlign: 'center', marginTop: -4 }}>
        {crs.score >= 0 ? `±${crs.confidence} confidence` : 'Need 3+ data signals'}
        {' · '}{crs.componentsWithData}/4 components
      </div>

      <div className="crs-components">
        {components.map((c, i) => (
          <div className={`crs-comp stagger-${i + 1}`} key={c.name}>
            <div className="crs-comp-header">
              <span className="crs-comp-name">{c.name} ({c.weight})</span>
              <span className="crs-comp-score">
                {c.data.dataAvailable ? Math.round(c.data.score) : '—'}
              </span>
            </div>
            <div className="crs-comp-bar">
              <div
                className={`crs-comp-fill ${getBarZone(c.data.score)}`}
                style={{ width: c.data.dataAvailable ? `${c.data.score}%` : '0%' }}
              />
            </div>
            <div className="crs-comp-factors">
              {c.data.factors.slice(0, 2).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FormCard — Nap Score / Form card matching Figma designs
 *
 * Compact: badge + title + narrative + timestamp (left), radial gauge (right)
 * Expanded: time-range tabs + large gauge + component breakdown + line chart + about
 */
import { useState } from 'react';
import { RadialGauge } from './RadialGauge.js';
import type { DayResponse } from '../../types.js';

interface FormCardProps {
  data: DayResponse;
  onDrillDown?: (cardId: string) => void;
}

function componentStatus(score: number): string {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'on track';
  if (score >= 50) return 'dipping';
  if (score >= 35) return 'short';
  return 'low';
}

/** Mini CRS line chart for the day */
function CrsDayChart({ score }: { score: number }) {
  const w = 354;
  const h = 160;
  const padL = 44;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Generate a plausible CRS curve (past = solid, future = dashed)
  const now = new Date();
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const normalized = score / 100;

  const hourlyValues: { h: number; v: number }[] = [];
  for (let h = 6; h <= 22; h += 0.5) {
    let v: number;
    if (h < 8) v = 0.65 + normalized * 0.1;
    else if (h < 11) v = 0.70 + normalized * 0.25 + Math.sin((h - 8) * 0.8) * 0.05;
    else if (h < 13) v = 0.72 + normalized * 0.2 - (h - 11) * 0.015;
    else if (h < 15) v = 0.62 + normalized * 0.15;
    else if (h < 18) v = 0.58 + normalized * 0.12 - (h - 15) * 0.01;
    else v = 0.50 + normalized * 0.1 - (h - 18) * 0.02;
    v += Math.sin(h * 1.7) * 0.012;
    v = Math.max(0.3, Math.min(1, v));
    hourlyValues.push({ h, v });
  }

  const toX = (h: number) => padL + ((h - 6) / 16) * chartW;
  const toY = (v: number) => padT + chartH - v * chartH;

  const splitIdx = hourlyValues.findIndex(p => p.h >= hourNow);
  const past = splitIdx > 0 ? hourlyValues.slice(0, splitIdx) : hourlyValues;
  const future = splitIdx > 0 ? hourlyValues.slice(splitIdx - 1) : [];

  const pastPath = past.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.h)} ${toY(p.v)}`).join(' ');
  const futurePath = future.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.h)} ${toY(p.v)}`).join(' ');

  const yLabels = [50, 60, 70, 80, 90, 100];
  const xLabels = [{ h: 7, label: '7am' }, { h: 10, label: '10am' }, { h: 13, label: '1pm' }, { h: 16, label: '4pm' }, { h: 19, label: '7pm' }];
  const splitX = splitIdx > 0 ? toX(hourlyValues[splitIdx - 1]!.h) : toX(hourNow);

  return (
    <div style={{
      background: 'white',
      border: '1px solid rgba(26,26,26,0.08)',
      borderRadius: 16,
      padding: '0 0 4px',
      marginTop: 10,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
        {/* Grid lines */}
        {yLabels.map(y => {
          const yPos = toY(y / 100);
          return (
            <g key={y}>
              <line x1={padL} y1={yPos} x2={w - padR} y2={yPos} stroke="rgba(26,26,26,0.06)" strokeWidth={0.8} />
              <text x={padL - 6} y={yPos} textAnchor="end" dominantBaseline="central"
                fill="#6b6b68" fontSize={8} opacity={0.5} fontFamily="'DM Sans', sans-serif">{y}</text>
            </g>
          );
        })}
        {xLabels.map(({ h: hr, label }) => (
          <text key={label} x={toX(hr)} y={h - padB + 14} textAnchor="middle"
            fill="#6b6b68" fontSize={8} fontFamily="'DM Sans', sans-serif"
            opacity={0.5}>{label}</text>
        ))}

        {/* "now" divider */}
        <line x1={splitX} y1={padT} x2={splitX} y2={h - padB}
          stroke="rgba(26,26,26,0.15)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={splitX + 4} y={padT + 8} fill="#6b6b68" fontSize={8}
          fontFamily="'DM Sans', sans-serif">projected</text>

        {/* Past curve (solid orange) */}
        {pastPath && (
          <path d={pastPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Future curve (dashed, lighter) */}
        {futurePath && (
          <path d={futurePath} fill="none" stroke="var(--accent)" strokeWidth={1.5}
            strokeDasharray="4 4" opacity={0.4} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

const PILLAR_DRAG_LABEL: Record<string, string> = {
  sleep: 'sleep dragging',
  hrv: 'HRV dragging',
  circadian: 'body clock dragging',
  activity: 'low activity dragging',
};

export function FormCard({ data, onDrillDown }: FormCardProps) {
  const [expanded, setExpanded] = useState(false);
  const crs = data?.crs;
  if (!crs) return null;

  const zone = crs.zone;
  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'moderate' ? 'Steady' : zone === 'low' ? 'Flagging' : '--';
  const primaryDrag = crs.pillarDrag?.primary ?? null;

  const components = [
    { name: 'Sleep', score: Math.round(crs.sleep?.score ?? 0), status: componentStatus(crs.sleep?.score ?? 0) },
    { name: 'HRV', score: Math.round(crs.hrv?.score ?? 0), status: componentStatus(crs.hrv?.score ?? 0) },
    { name: 'Circadian', score: Math.round(crs.circadian?.score ?? 0), status: componentStatus(crs.circadian?.score ?? 0) },
    { name: 'Motion', score: Math.round(crs.activity?.score ?? 0), status: componentStatus(crs.activity?.score ?? 0) },
  ];

  const nowStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

  // ── Compact card (default) ────────────────────────────────
  if (!expanded) {
    return (
      <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <span className="zone-badge">{zoneLabel}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 0 }}>
          {/* Left: text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <h3 className="dash-card-title" style={{ marginTop: 20 }}>Form</h3>
            <p className="dash-card-narrative">
              {(crs.summary || `${zoneLabel} day. Your biological readiness today.`).replace(/Nap Score/gi, 'Form').replace(/nap score/gi, 'Form')}
            </p>
            <span className="dash-card-meta">
              last read · {nowStr}
              {crs.pctVsBaseline !== null && crs.pctVsBaseline !== undefined && (
                <span style={{ marginLeft: 6, color: crs.pctVsBaseline >= 0 ? '#34D399' : '#F59E0B' }}>
                  · {crs.pctVsBaseline > 0 ? '+' : ''}{crs.pctVsBaseline}% baseline
                </span>
              )}
              {primaryDrag && crs.score < 75 && (
                <span style={{ marginLeft: 6, color: '#F59E0B' }}>· {PILLAR_DRAG_LABEL[primaryDrag] ?? primaryDrag}</span>
              )}
            </span>
          </div>

          {/* Right: radial gauge */}
          <div style={{ flexShrink: 0 }}>
            <RadialGauge score={crs.score} zone={zone} size={140} showLabels />
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded card ─────────────────────────────────────────
  return (
    <div className="dash-card">
      {/* Close button */}
      <button
        onClick={() => setExpanded(false)}
        style={{
          float: 'right', background: 'none', border: 'none',
          color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1,
          padding: 0, marginTop: -4,
        }}
      >
        ×
      </button>

      {/* Large radial gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <RadialGauge score={crs.score} zone={zone} size={280} showLabels />
      </div>

      {/* Zone badge + title + narrative */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, marginBottom: 10 }}>
        <span className="zone-badge">{zoneLabel}</span>
        <h3 style={{
          fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400,
          color: '#1a1a1a', margin: 0, lineHeight: 1.1, textAlign: 'center',
        }}>Form</h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          color: '#6b6b68', margin: 0, textAlign: 'center', lineHeight: 1.3,
        }}>
          {crs.summary || `${zoneLabel} day. Your biological readiness today.`}
        </p>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
          fontStyle: 'italic', color: '#9a9a96',
        }}>
          updated at {nowStr}
        </span>
      </div>

      {/* Component breakdown — click to drill down */}
      <div className="component-bars">
        {components.map((c) => {
          const cardId = c.name === 'Sleep' ? 'sleep-score' : c.name === 'HRV' ? 'hrv' : c.name === 'Circadian' ? 'circadian' : 'motion';
          return (
            <div
              key={c.name}
              className="component-row component-row-clickable"
              onClick={() => onDrillDown?.(cardId)}
              style={{ cursor: onDrillDown ? 'pointer' : undefined }}
            >
              <div className="component-label">
                <span className="component-label-name">{c.name}</span>
                <span className="component-label-status">{c.status}</span>
              </div>
              <div className="component-value">
                <span className="component-score">{c.score}</span>
                <div className="component-bar-track">
                  <div className="component-bar-fill" style={{ width: `${c.score}%` }} />
                </div>
              </div>
              {onDrillDown && <span className="drill-arrow">›</span>}
            </div>
          );
        })}
      </div>

      {/* Pillar engine breakdown — shown when pillar data available */}
      {crs.pillars && (
        <div style={{
          background: 'white', border: '1px solid rgba(26,26,26,0.08)',
          borderRadius: 16, padding: '14px 16px', marginTop: 10,
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a9a96', marginBottom: 10 }}>
            Pillar Engine
          </div>
          {[
            { label: 'Recovery', key: 'recovery' as const, weight: '50%', desc: 'Sleep quality & architecture' },
            { label: 'CASS', key: 'cass' as const, weight: '35%', desc: 'HRV & cardiac stress' },
            { label: 'ILAS', key: 'ilas' as const, weight: '15%', desc: 'Circadian alignment & movement' },
          ].map(({ label, key, weight, desc }) => {
            const score = crs.pillars![key];
            const isPrimary = primaryDrag && key === (primaryDrag === 'hrv' ? 'cass' : primaryDrag === 'activity' || primaryDrag === 'circadian' ? 'ilas' : 'recovery');
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 60, fontSize: 10, fontWeight: 600, color: isPrimary ? '#F59E0B' : '#1a1a1a' }}>
                  {label}
                </div>
                <div style={{ flex: 1, background: 'rgba(26,26,26,0.06)', borderRadius: 4, height: 5 }}>
                  <div style={{
                    height: 5, borderRadius: 4,
                    width: `${score}%`,
                    background: isPrimary ? '#F59E0B' : score >= 75 ? '#34D399' : score >= 50 ? 'var(--accent)' : '#EF4444',
                  }} />
                </div>
                <div style={{ width: 28, fontSize: 10, fontWeight: 600, textAlign: 'right', color: isPrimary ? '#F59E0B' : '#1a1a1a' }}>
                  {score}
                </div>
                <div style={{ width: 28, fontSize: 9, color: '#9a9a96', textAlign: 'right' }}>{weight}</div>
              </div>
            );
          })}
          {primaryDrag && crs.score < 80 && (
            <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 4, fontStyle: 'italic' }}>
              {PILLAR_DRAG_LABEL[primaryDrag] ?? primaryDrag} is suppressing Form today
            </div>
          )}
        </div>
      )}

      {/* CRS day chart */}
      <CrsDayChart score={crs.score} />

      {/* Insight */}
      <div style={{
        background: 'white', border: '1px solid rgba(26,26,26,0.08)',
        borderRadius: 16, padding: 20, marginTop: 10,
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
        color: '#6b6b68', lineHeight: 1.3, textAlign: 'center',
      }}>
        {crs.score >= 80
          ? "Peak window right now. Your hardest thinking goes here."
          : crs.score >= 65
          ? "Solid baseline. Watch cognitive load after 2pm."
          : crs.score >= 50
          ? "Running a bit low. Protect your focus blocks."
          : "Rough day biologically. Defer heavy decisions where possible."}
      </div>

      {/* About section */}
      <div style={{
        background: 'white', border: '1px solid rgba(26,26,26,0.08)',
        borderRadius: 16, padding: 20, marginTop: 10,
      }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{
          fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400,
          color: '#1a1a1a', margin: '20px 0 20px', lineHeight: 1.1,
        }}>
          What is Form?
        </h4>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 400,
          color: '#6b6b68', lineHeight: 1.3, margin: 0,
        }}>
          Form is the single number that tells you how sharp your brain is right now.
          Not how healthy you are. How ready you are, today, for things that require
          actual thinking.
          {'\n\n'}
          It's built from four signals — sleep quality, HRV, your body clock, and
          yesterday's movement. Waldo weighs them and gives you one number that updates
          through the day. 80 and above is a day to do your hardest work. Below 50,
          protect your energy.
        </p>
      </div>
    </div>
  );
}

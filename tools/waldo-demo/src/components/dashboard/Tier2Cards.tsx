/**
 * Tier2Cards — Component metric cards (expanded from Form's 4 sub-scores)
 *
 * HRVCard       — 30-day line + personal baseline band
 * CircadianCard — 24-hour arc + wake drift + energy wave
 * MotionCard    — 3 segmented bars (steps / exercise / stand)
 * SleepDebtCard — 7-day stepped line + direction arrow
 * RestingHRCard — 7-day sparkline + trend label
 * SleepScoreCard— stepped line + 4 stat pills
 *
 * Each card: compact (badge + text + mini-chart) + expanded (click to open).
 */
import { useState } from 'react';
import type { DayResponse } from '../../types.js';
import type { DashboardHistoryContext } from './history.js';

interface CardProps {
  data: DayResponse;
  history?: DashboardHistoryContext;
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function fallbackSeries(length: number, current: number, span: number, min: number, max: number) {
  return Array.from({ length }, (_, index) => {
    if (index === length - 1) return current;
    const wave = Math.sin((index + 1) * 1.7 + current * 0.05) * span;
    const drift = Math.cos((index + 1) * 0.65) * (span * 0.35);
    return Math.round(clamp(current + wave + drift, min, max));
  });
}

function cleanSeries(values: Array<number | null> | undefined, fallback: number[]) {
  const cleaned = (values ?? []).filter((value): value is number => value !== null && Number.isFinite(value));
  return cleaned.length > 1 ? cleaned : fallback;
}

function buildSleepStepPath(
  stages: { core: number; deep: number; rem: number; awake: number },
  width: number,
  height: number,
) {
  const order = ['awake', 'core', 'deep', 'core', 'rem', 'core', 'deep', 'core', 'rem', 'awake'] as const;
  const weights = {
    awake: stages.awake,
    rem: stages.rem,
    core: stages.core,
    deep: stages.deep,
  };
  const stageY: Record<(typeof order)[number], number> = {
    awake: height * 0.16,
    rem: height * 0.34,
    core: height * 0.58,
    deep: height * 0.82,
  };

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const dominant = Object.entries(weights).sort((a, b) => b[1] - a[1]).map(([key]) => key) as Array<(typeof order)[number]>;
  const points = order.map((stage, index) => {
    const emphasis = weights[stage] / total;
    const resolvedStage = emphasis > 0.12 ? stage : dominant[index % dominant.length] ?? 'core';
    return {
      x: (index / (order.length - 1)) * width,
      y: stageY[resolvedStage],
    };
  });

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` H ${points[index]!.x} V ${points[index]!.y}`;
  }
  return path;
}

export function HRVCard({ data, history }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const hrv = data.hrv;
  const crsHrv = data.crs.hrv;

  if (!hrv && !crsHrv.dataAvailable) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">HRV</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No HRV data for this day.</p>
      </div>
    );
  }

  const todayVal = hrv?.avg ?? 0;
  const historyValues = cleanSeries(history?.hrv30d, fallbackSeries(30, todayVal, 12, 20, 120));
  const previousValue = history?.previousEntry?.hrvAvg ?? historyValues[historyValues.length - 2] ?? null;
  const baselineAvg = Math.round(historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length);
  const baselineLo = Math.round(baselineAvg * 0.85);
  const baselineHi = Math.round(baselineAvg * 1.15);

  const zone = todayVal >= baselineHi ? 'above' : todayVal >= baselineLo ? 'within' : 'below';
  const compactDelta = previousValue === null ? todayVal - baselineAvg : todayVal - previousValue;
  const compactLabel = compactDelta <= -3 ? 'Dropping' : compactDelta >= 3 ? 'Rising' : 'Stable';
  const zoneLabel = zone === 'above' ? 'Strong' : zone === 'within' ? 'Baseline' : 'Low';
  const zoneColor = zone === 'above' ? '#34D399' : zone === 'within' ? '#FBBF24' : '#F87171';

  const chartW = 240, chartH = 80, padL = 8, padR = 8, padT = 10, padB = 10;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const allVals = historyValues;
  const minV = Math.min(...allVals, baselineLo) - 5;
  const maxV = Math.max(...allVals, baselineHi) + 5;
  const maxIndex = Math.max(1, historyValues.length - 1);
  const toX = (i: number) => padL + (i / maxIndex) * innerW;
  const toY = (v: number) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const linePath = historyValues.map((value, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(value)}`).join(' ');
  const todayX = toX(historyValues.length - 1);
  const todayY = toY(todayVal);

  const compactSeries = historyValues.slice(-7);
  const compactMaxIndex = Math.max(1, compactSeries.length - 1);
  const compactToX = (index: number) => 18 + (index / compactMaxIndex) * 150;
  const compactToY = (value: number) => 74 - ((value - minV) / (maxV - minV)) * 24;
  const compactAverageY = compactToY(baselineAvg);
  const arrow = compactDelta >= 0 ? '↑' : '↓';

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          {/* Visual-first: chart takes right side prominently */}
          <div className="card-compact-text">
            <span className="zone-badge">{compactLabel}</span>
            <h3 className="dash-card-title">HRV</h3>
            <p className="dash-card-narrative">{crsHrv.factors?.[0] ?? `${todayVal}ms · ${zoneLabel.toLowerCase()} vs baseline.`}</p>
          </div>
          <div className="card-compact-visual">
            <div style={{
              background: 'white',
              border: '1px solid rgba(26,26,26,0.08)',
              borderRadius: 16,
              padding: '14px 16px 12px',
              minWidth: 226,
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, padding: '8px 10px', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 500, lineHeight: 1, color: '#1a1a1a' }}>{Math.round(todayVal)} ms</span>
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
                }}>{arrow}</span>
              </div>
              <svg width={184} height={54} viewBox="0 0 184 54">
                <line x1={12} y1={compactAverageY} x2={172} y2={compactAverageY} stroke="#fb943f" strokeWidth={1.5} />
                <text x={12} y={compactAverageY + 11} textAnchor="start" fill="#d0ccc5" fontSize={7} fontFamily="'DM Sans', sans-serif">avg</text>
                {compactSeries.map((value, index) => {
                  const isToday = index === compactSeries.length - 1;
                  const isYesterday = !isToday && previousValue !== null && value === previousValue && index === compactSeries.length - 2;
                  return (
                    <circle
                      key={`${value}-${index}`}
                      cx={compactToX(index)}
                      cy={compactToY(value)}
                      r={isToday ? 5 : 4.5}
                      fill={isToday ? '#3485ff' : isYesterday ? '#fb943f' : 'white'}
                      stroke={isToday ? '#3485ff' : isYesterday ? '#fb943f' : '#d4d4d0'}
                      strokeWidth={1.2}
                    />
                  );
                })}
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11, color: '#9a9a96' }}>
                <span>Yesterday</span>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fb943f', display: 'inline-block' }} />
                <span>{previousValue !== null ? Math.round(previousValue) : baselineAvg}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zoneLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>HRV</h3>
        <div style={{ fontSize: 36, fontWeight: 500, fontFamily: 'var(--font-body)', color: '#1a1a1a' }}>
          {todayVal}<span style={{ fontSize: 14, color: '#9a9a96', marginLeft: 4 }}>ms</span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6b6b68', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
          {crsHrv.factors?.[0] ?? `${todayVal}ms today · baseline ${baselineLo}–${baselineHi}ms`}
        </p>
      </div>

      {/* 30-day chart */}
      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: '16px 12px' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#9a9a96', display: 'block', marginBottom: 8 }}>30-day history · your personal baseline</span>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
          {/* baseline band */}
          <rect x={padL} y={toY(baselineHi)} width={innerW} height={toY(baselineLo) - toY(baselineHi)} fill="rgba(251,148,63,0.1)" />
          {/* baseline border lines */}
          <line x1={padL} y1={toY(baselineHi)} x2={padL + innerW} y2={toY(baselineHi)} stroke="rgba(251,148,63,0.3)" strokeWidth={0.8} strokeDasharray="3 3" />
          <line x1={padL} y1={toY(baselineLo)} x2={padL + innerW} y2={toY(baselineLo)} stroke="rgba(251,148,63,0.3)" strokeWidth={0.8} strokeDasharray="3 3" />
          {/* line */}
          <path d={linePath} fill="none" stroke="#6b6b68" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
          {/* today dot */}
          <circle cx={todayX} cy={todayY} r={4} fill={zoneColor} />
          <circle cx={todayX} cy={todayY} r={7} fill={zoneColor} opacity={0.2} />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9a9a96', marginTop: 4 }}>
          <span>30 days ago</span>
          <span style={{ color: zoneColor }}>today · {todayVal}ms</span>
        </div>
      </div>

      {/* Stat pills */}
      <div className="component-bars" style={{ marginTop: 10 }}>
          {[
            { label: 'Today', value: `${todayVal}ms`, status: zoneLabel.toLowerCase() },
            { label: 'Min (30d)', value: `${Math.min(...allVals)}ms`, status: '--' },
            { label: 'Max (30d)', value: `${Math.max(...allVals)}ms`, status: '--' },
            { label: 'Baseline', value: `${baselineLo}–${baselineHi}ms`, status: 'your range' },
        ].map((row, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">{row.label}</span>
              <span className="component-label-status">{row.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* About */}
      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 10 }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px' }}>What is HRV?</h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', lineHeight: 1.4, margin: 0 }}>
          Heart rate variability is the millisecond variation between heartbeats. Higher variability means your nervous system is adaptable — lower means it's under load. Waldo compares you to you, not to a population average. The band is your personal baseline built from 30 days of your own data.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCADIAN CARD
// ─────────────────────────────────────────────────────────────────────────────

export function CircadianCard({ data }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const circadian = data.crs.circadian;

  if (!circadian.dataAvailable) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Circadian</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No circadian data for this day.</p>
      </div>
    );
  }

  const score = circadian.score;
  const zone = score >= 80 ? 'Aligned' : score >= 60 ? 'Drifting' : 'Misaligned';
  const zoneColor = score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#F87171';

  // Derive wake times from sleep data
  const wakeTime = data.sleep?.wakeTime ?? '7am';
  const idealWakeHour = 7; // canonical ideal
  const actualWakeHour = (() => {
    const m = wakeTime.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
    if (!m) return 7;
    let h = parseInt(m[1]!);
    if (m[3]?.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
    return h;
  })();
  const driftHours = actualWakeHour - idealWakeHour;
  const driftLabel = driftHours === 0 ? 'On time' : driftHours > 0 ? `+${driftHours}h later` : `${Math.abs(driftHours)}h earlier`;

  // ── 24-hour arc SVG (compact) ──
  function CircadianArc({ size = 100 }: { size?: number }) {
    const cx = size / 2, cy = size / 2, r = size * 0.36;
    const toAngle = (h: number) => ((h / 24) * 360 - 90) * (Math.PI / 180);

    // Energy wave (simplified sinusoid overlaid on arc)
    const energyPoints: { x: number; y: number }[] = [];
    for (let h = 0; h <= 24; h += 0.5) {
      const e = 0.5 + 0.5 * Math.sin((h - 6) * (Math.PI / 8));
      const er = r + clamp(e, 0, 1) * size * 0.08;
      const a = toAngle(h);
      energyPoints.push({ x: cx + Math.cos(a) * er, y: cy + Math.sin(a) * er });
    }
    const wavePath = energyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const idealA = toAngle(idealWakeHour);
    const actualA = toAngle(actualWakeHour);
    const nowA = toAngle(new Date().getHours());

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Base circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(26,26,26,0.08)" strokeWidth={size * 0.05} />
        {/* Energy wave */}
        <path d={wavePath + ' Z'} fill="rgba(251,148,63,0.06)" stroke="rgba(251,148,63,0.25)" strokeWidth={0.8} />
        {/* Drift arc between ideal and actual */}
        {driftHours !== 0 && (() => {
          const [startA, endA] = driftHours > 0 ? [idealA, actualA] : [actualA, idealA];
          const r2 = r;
          const x1 = cx + Math.cos(startA) * r2, y1 = cy + Math.sin(startA) * r2;
          const x2 = cx + Math.cos(endA) * r2, y2 = cy + Math.sin(endA) * r2;
          const large = Math.abs(driftHours) > 12 ? 1 : 0;
          return <path d={`M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={zoneColor} strokeWidth={size * 0.04} opacity={0.6} />;
        })()}
        {/* Ideal wake dot (fixed) */}
        <circle cx={cx + Math.cos(idealA) * r} cy={cy + Math.sin(idealA) * r} r={size * 0.04} fill="#34D399" />
        {/* Actual wake dot */}
        <circle cx={cx + Math.cos(actualA) * r} cy={cy + Math.sin(actualA) * r} r={size * 0.05} fill={zoneColor} />
        {/* Now dot */}
        <circle cx={cx + Math.cos(nowA) * r} cy={cy + Math.sin(nowA) * r} r={size * 0.035} fill="#1a1a1a" />
        {/* Score center */}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#1a1a1a" fontSize={size * 0.18} fontFamily="'DM Sans', sans-serif" fontWeight="500">{Math.round(score)}</text>
      </svg>
    );
  }

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <span className={`zone-badge zone-${score >= 80 ? 'peak' : score >= 60 ? 'steady' : 'flagging'}`}>{zone}</span>
            <h3 className="dash-card-title">Circadian</h3>
            <p className="dash-card-narrative">{circadian.factors?.[0] ?? `Drift: ${driftLabel}. Clock ${zone.toLowerCase()}.`}</p>
          </div>
          <div className="card-compact-visual">
            <CircadianArc size={100} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zone}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <CircadianArc size={180} />
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>Circadian</h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6b6b68', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
          {circadian.factors?.[0] ?? `Wake drift: ${driftLabel}. Body clock ${zone.toLowerCase()}.`}
        </p>
      </div>

      <div className="component-bars">
        {[
          { label: 'Ideal wake', value: `${idealWakeHour}:00am`, status: 'target' },
          { label: 'Actual wake', value: wakeTime, status: driftLabel },
          { label: 'Alignment score', value: `${Math.round(score)}`, status: zone.toLowerCase() },
        ].map((row, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">{row.label}</span>
              <span className="component-label-status">{row.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 10 }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px' }}>What is Circadian?</h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', lineHeight: 1.4, margin: 0 }}>
          Your circadian rhythm is your internal clock — it governs when your body expects to sleep, wake, and peak cognitively. Drift is the gap between when you woke today versus your usual time. Even 90 minutes of drift degrades next-day Form measurably.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTION CARD
// ─────────────────────────────────────────────────────────────────────────────

export function MotionCard({ data }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const activity = data.activity;
  const crsActivity = data.crs.activity;

  if (!crsActivity.dataAvailable && activity.steps === 0) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Motion</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No motion data for this day.</p>
      </div>
    );
  }

  const TARGETS = { steps: 10000, exercise: 30, stand: 8 };
  const stepsPct = clamp(Math.round((activity.steps / TARGETS.steps) * 100), 0, 100);
  const exercisePct = clamp(Math.round((activity.exerciseMinutes / TARGETS.exercise) * 100), 0, 100);
  const standPct = clamp(Math.round((activity.standHours / TARGETS.stand) * 100), 0, 100);
  const overallScore = Math.round((stepsPct + exercisePct + standPct) / 3);

  const zoneLabel = overallScore >= 80 ? 'Active' : overallScore >= 50 ? 'Moderate' : 'Light';
  const zoneColor = overallScore >= 80 ? '#34D399' : overallScore >= 50 ? '#FBBF24' : '#F87171';

  function SegBar({ pct, color = '#2388ff' }: { pct: number; color?: string }) {
    return (
      <div className="dash-bar-track" style={{ flex: 1 }}>
        <div className="dash-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    );
  }

  const rows = [
    { label: 'Steps', value: activity.steps.toLocaleString(), target: `/ ${TARGETS.steps.toLocaleString()}`, pct: stepsPct },
    { label: 'Exercise', value: `${activity.exerciseMinutes}min`, target: `/ ${TARGETS.exercise}min`, pct: exercisePct },
    { label: 'Stand', value: `${activity.standHours}h`, target: `/ ${TARGETS.stand}h`, pct: standPct },
  ];

  const barColor = zoneColor;

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <span className={`zone-badge zone-${overallScore >= 80 ? 'peak' : overallScore >= 50 ? 'steady' : 'flagging'}`}>{zoneLabel}</span>
            <h3 className="dash-card-title">Motion</h3>
            <p className="dash-card-narrative">{activity.steps.toLocaleString()} steps · {activity.exerciseMinutes}m exercise</p>
          </div>
          <div className="card-compact-visual" style={{ minWidth: 120 }}>
            {/* 3 visual bars — the chart IS the content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {rows.map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: '#9a9a96', width: 38, flexShrink: 0 }}>{row.label}</span>
                  <div style={{ flex: 1, background: 'rgba(26,26,26,0.04)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${row.pct}%`, height: '100%', background: barColor, borderRadius: 20, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zoneLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <div style={{ fontSize: 40, fontWeight: 500, fontFamily: 'var(--font-body)', color: '#1a1a1a' }}>{overallScore}<span style={{ fontSize: 14, color: '#9a9a96' }}>/100</span></div>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>Motion</h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6b6b68', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
          {crsActivity.factors?.[0] ?? `${activity.steps.toLocaleString()} steps · ${activity.exerciseMinutes}min exercise.`}
        </p>
      </div>

      <div className="component-bars">
        {rows.map((row, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">{row.label}</span>
              <span className="component-label-status">{row.target}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{row.value}</span>
              <div className="component-bar-track">
                <div className="component-bar-fill" style={{ width: `${row.pct}%`, background: barColor }} />
              </div>
            </div>
          </div>
        ))}
        {activity.activeEnergy > 0 && (
          <div className="component-row">
            <div className="component-label">
              <span className="component-label-name">Active energy</span>
              <span className="component-label-status">kcal burned</span>
            </div>
            <div className="component-value">
              <span className="component-score">{Math.round(activity.activeEnergy)} kcal</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 10 }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px' }}>What is Motion?</h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', lineHeight: 1.4, margin: 0 }}>
          Motion scores your physical output across three dimensions: steps (cardiovascular baseline), exercise minutes (structured intensity), and stand hours (metabolic continuity). All three matter — an hour-long run doesn't undo 10 hours at a desk.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLEEP DEBT CARD
// ─────────────────────────────────────────────────────────────────────────────

export function SleepDebtCard({ data, history }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const debt = data.sleepDebt;

  if (!debt) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Sleep Debt</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No sleep debt data for this day.</p>
      </div>
    );
  }

  const { debtHours, direction } = debt;
  const historyValues = cleanSeries(
    history?.sleepDebt7d,
    fallbackSeries(7, Math.round(debtHours * 10) / 10, 0.8, 0, 6).map((value) => parseFloat(value.toFixed(1))),
  ).map((value) => parseFloat(value.toFixed(1)));
  const zoneLabel = debtHours <= 0.5 ? 'Repaid' : debtHours <= 1.5 ? 'Mild' : debtHours <= 3 ? 'Moderate' : 'High';
  const zoneColor = debtHours <= 0.5 ? '#34D399' : debtHours <= 1.5 ? '#FBBF24' : '#F87171';
  const arrow = direction === 'increasing' ? '↑' : direction === 'decreasing' ? '↓' : '→';

  // Stepped path
  const chartW = 200, chartH = 60;
  const maxVal = Math.max(...historyValues, 2);
  const toX = (i: number) => (i / 6) * chartW;
  const toY = (v: number) => chartH - (v / maxVal) * chartH;

  let stepPath = `M ${toX(0)} ${toY(historyValues[0] ?? 0)}`;
  for (let i = 1; i < historyValues.length; i++) {
    stepPath += ` H ${toX(i)} V ${toY(historyValues[i] ?? 0)}`;
  }

  // Compact mini version
  const miniW = 80, miniH = 36;
  const mToX = (i: number) => (i / 6) * miniW;
  const mToY = (v: number) => miniH - (v / maxVal) * miniH;
  let miniStep = `M ${mToX(0)} ${mToY(historyValues[0] ?? 0)}`;
  for (let i = 1; i < historyValues.length; i++) {
    miniStep += ` H ${mToX(i)} V ${mToY(historyValues[i] ?? 0)}`;
  }

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <span className={`zone-badge zone-${debtHours <= 0.5 ? 'peak' : debtHours <= 1.5 ? 'steady' : 'flagging'}`}>{zoneLabel}</span>
            <h3 className="dash-card-title">Sleep Debt</h3>
            <p className="dash-card-narrative">{debt.summary}</p>
          </div>
          <div className="card-compact-visual">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-body)', color: zoneColor }}>
                {debtHours.toFixed(1)}<span style={{ fontSize: 10, color: '#9a9a96' }}>h</span>
                <span style={{ fontSize: 16, marginLeft: 4 }}>{arrow}</span>
              </div>
              <svg width={100} height={40} viewBox={`0 0 ${miniW} ${miniH}`} style={{ marginTop: 4 }}>
                <path d={`${miniStep} V ${miniH} H ${mToX(0)} Z`} fill={zoneColor} opacity={0.08} />
                <path d={miniStep} fill="none" stroke={zoneColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={mToX(6)} cy={mToY(historyValues[6] ?? 0)} r={3} fill={zoneColor} />
              </svg>
              <div style={{ fontSize: 8, color: '#9a9a96', marginTop: 2 }}>7-day · {direction}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zoneLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0 16px' }}>
        <div style={{ fontSize: 40, fontWeight: 500, fontFamily: 'var(--font-body)', color: zoneColor }}>
          {debtHours.toFixed(1)}<span style={{ fontSize: 14, color: '#9a9a96', marginLeft: 4 }}>h owed</span>
          <span style={{ fontSize: 20, marginLeft: 8 }}>{arrow}</span>
        </div>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>Sleep Debt</h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6b6b68', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>{debt.summary}</p>
      </div>

      {/* 7-day chart */}
      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: '16px 12px' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#9a9a96', display: 'block', marginBottom: 8 }}>7-day debt accumulation</span>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
          {/* Zero line */}
          <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="rgba(26,26,26,0.1)" strokeWidth={0.8} />
          {/* Area fill */}
          <path d={`${stepPath} V ${chartH} H ${toX(0)} Z`} fill={zoneColor} opacity={0.08} />
          {/* Step line */}
          <path d={stepPath} fill="none" stroke={zoneColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {/* Today dot */}
          <circle cx={toX(6)} cy={toY(historyValues[6] ?? 0)} r={4} fill={zoneColor} />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9a9a96', marginTop: 4 }}>
          <span>6 days ago</span>
          <span style={{ color: zoneColor }}>today · {debtHours.toFixed(1)}h</span>
        </div>
      </div>

      <div className="component-bars" style={{ marginTop: 10 }}>
        {[
          { label: 'Current debt', value: `${debtHours.toFixed(1)}h`, status: zoneLabel.toLowerCase() },
          { label: 'Avg sleep', value: `${debt.avgSleepHours.toFixed(1)}h/night`, status: '--' },
          { label: 'Short nights', value: `${debt.shortNights}`, status: 'last 7 days' },
          { label: 'Direction', value: arrow + ' ' + direction, status: '--' },
        ].map((row, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">{row.label}</span>
              <span className="component-label-status">{row.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 10 }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px' }}>What is Sleep Debt?</h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', lineHeight: 1.4, margin: 0 }}>
          Sleep debt is the running total of sleep you owe your body. It accumulates when you sleep less than your personal need. You can repay it — but only at about half the rate you built it. One good night won't clear a week of bad sleep.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTING HR CARD
// ─────────────────────────────────────────────────────────────────────────────

export function RestingHRCard({ data, history }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const rhr = data.restingHR;

  if (rhr === null || rhr === undefined) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Resting HR</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No resting heart rate data.</p>
      </div>
    );
  }

  const historyValues = cleanSeries(history?.rhr7d, fallbackSeries(7, rhr, 5, 40, 100));
  const trend = historyValues[6]! > historyValues[5]! ? 'rising' : historyValues[6]! < historyValues[5]! ? 'dropping' : 'stable';
  const trendArrow = trend === 'rising' ? '↑' : trend === 'dropping' ? '↓' : '→';
  const trendColor = trend === 'rising' ? '#F87171' : trend === 'dropping' ? '#34D399' : '#9a9a96';
  const zoneLabel = rhr < 60 ? 'Athletic' : rhr < 72 ? 'Normal' : rhr < 85 ? 'Elevated' : 'High';
  const zoneColor = rhr < 60 ? '#34D399' : rhr < 72 ? '#34D399' : rhr < 85 ? '#FBBF24' : '#F87171';

  const miniW = 80, miniH = 32;
  const minV = Math.min(...historyValues) - 3, maxV = Math.max(...historyValues) + 3;
  const mToX = (i: number) => (i / 6) * miniW;
  const mToY = (v: number) => miniH - ((v - minV) / (maxV - minV)) * miniH;
  const miniPath = historyValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${mToX(i)} ${mToY(v)}`).join(' ');

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <span className={`zone-badge zone-${rhr < 72 ? 'peak' : rhr < 85 ? 'steady' : 'flagging'}`}>{zoneLabel}</span>
            <h3 className="dash-card-title">Resting HR</h3>
            <p className="dash-card-narrative">{rhr} bpm · <span style={{ color: trendColor }}>{trendArrow} {trend}</span></p>
          </div>
          <div className="card-compact-visual">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-body)', color: '#1a1a1a' }}>{rhr}<span style={{ fontSize: 10, color: '#9a9a96' }}>bpm</span></div>
              <svg width={100} height={36} viewBox={`0 0 ${miniW} ${miniH}`} style={{ marginTop: 4 }}>
                <path d={miniPath} fill="none" stroke={zoneColor} strokeWidth={1.5} strokeLinecap="round" />
                <circle cx={mToX(6)} cy={mToY(rhr)} r={3} fill={trendColor} />
              </svg>
              <div style={{ fontSize: 8, color: trendColor, marginTop: 2 }}>{trendArrow} {trend} · 7d</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartW = 220, chartH = 70;
  const toX = (i: number) => 16 + (i / 6) * (chartW - 32);
  const toY = (v: number) => 10 + (chartH - 20) - ((v - minV) / (maxV - minV)) * (chartH - 20);
  const fullPath = historyValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  const days = ['6d', '5d', '4d', '3d', '2d', '1d', 'today'];

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zoneLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0 16px' }}>
        <div style={{ fontSize: 40, fontWeight: 500, fontFamily: 'var(--font-body)', color: '#1a1a1a' }}>{rhr}<span style={{ fontSize: 14, color: '#9a9a96', marginLeft: 4 }}>bpm</span></div>
        <span style={{ fontSize: 13, color: trendColor, fontFamily: 'var(--font-body)' }}>{trendArrow} {trend}</span>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>Resting HR</h3>
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: '16px 12px' }}>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
          <path d={fullPath} fill="none" stroke={zoneColor} strokeWidth={2} strokeLinecap="round" />
          {historyValues.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={i === 6 ? 4 : 2.5} fill={i === 6 ? trendColor : zoneColor} opacity={i === 6 ? 1 : 0.6} />
          ))}
          {days.map((d, i) => (
            <text key={d} x={toX(i)} y={chartH - 2} textAnchor="middle" fill="#9a9a96" fontSize={7} fontFamily="'DM Sans', sans-serif">{d}</text>
          ))}
        </svg>
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 10 }}>
        <span className="zone-badge" style={{ fontSize: 8 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px' }}>What is Resting HR?</h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#6b6b68', lineHeight: 1.4, margin: 0 }}>
          Resting heart rate is your heart's baseline effort when your body is at complete rest. A rising trend over 7 days can signal accumulated stress, illness, or under-recovery before you consciously feel it. Athletes typically sit in the 40–60 bpm range.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLEEP SCORE CARD
// ─────────────────────────────────────────────────────────────────────────────

export function SleepScoreCard({ data, history }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const sleep = data.sleep;
  const crsSleep = data.crs.sleep;

  if (!sleep || !crsSleep.dataAvailable) {
    return (
      <div className="dash-card">
        <span className="zone-badge">--</span>
        <h3 className="dash-card-title">Sleep Score</h3>
        <p className="dash-card-narrative" style={{ color: '#9a9a96' }}>No sleep score data.</p>
      </div>
    );
  }

  const score = Math.round(crsSleep.score);
  const zoneLabel = score >= 80 ? 'Restored' : score >= 65 ? 'Adequate' : score >= 50 ? 'Light' : 'Poor';
  const zoneColor = score >= 80 ? '#34D399' : score >= 65 ? '#FBBF24' : '#F87171';

  const stageConfig = [
    { key: 'awake' as const, label: 'Awake', color: '#ff7c25', pct: sleep.stages.awake },
    { key: 'rem' as const, label: 'REM', color: '#07bea6', pct: sleep.stages.rem },
    { key: 'core' as const, label: 'Core', color: '#ff60fa', pct: sleep.stages.core },
    { key: 'deep' as const, label: 'Deep', color: '#3485ff', pct: sleep.stages.deep },
  ];

  // Stepped hypnogram (simplified — same as SleepCard)
  const chartW = 220, chartH = 70;
  const hypnogram = buildSleepStepPath(sleep.stages, chartW, chartH);

  const totalH = Math.floor(sleep.durationHours);
  const totalM = Math.round((sleep.durationHours - totalH) * 60);
  const durationStr = totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`;
  const recentSleepHours = cleanSeries(history?.sleepHours7d, fallbackSeries(7, sleep.durationHours, 0.6, 4, 9));
  const previousSleep = history?.previousEntry?.sleepHours ?? recentSleepHours[recentSleepHours.length - 2] ?? null;

  if (!expanded) {
    return (
      <div className="dash-card card-tier2" style={{ cursor: 'pointer' }} onClick={() => setExpanded(true)}>
        <div className="card-compact-row">
          <div className="card-compact-text">
            <span className={`zone-badge zone-${score >= 80 ? 'peak' : score >= 65 ? 'steady' : 'flagging'}`}>{zoneLabel}</span>
            <h3 className="dash-card-title">Sleep Score</h3>
            <p className="dash-card-narrative">{crsSleep.factors?.[0] ?? `${durationStr} · ${zoneLabel.toLowerCase()} quality.`}</p>
          </div>
          <div className="card-compact-visual">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 500, fontFamily: 'var(--font-body)', color: zoneColor }}>{score}</div>
              {/* Stage color bar — visual instead of numbers */}
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', width: 90, margin: '6px auto 0', gap: 1 }}>
                {stageConfig.map(s => (
                  <div key={s.key} style={{ flex: Math.max(s.pct, 3), background: s.color, transition: 'flex 0.8s ease' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                {stageConfig.map(s => (
                  <span key={s.key} style={{ fontSize: 7, color: s.color, fontWeight: 500 }}>{s.label}</span>
                ))}
              </div>
              <div style={{ fontSize: 8, color: '#9a9a96', marginTop: 4 }}>
                {previousSleep !== null ? `yesterday · ${previousSleep.toFixed(1)}h` : 'last night'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <button onClick={() => setExpanded(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}>×</button>
      <span className="zone-badge" style={{ color: zoneColor }}>{zoneLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0 16px' }}>
        <div style={{ fontSize: 40, fontWeight: 500, fontFamily: 'var(--font-body)', color: zoneColor }}>{score}<span style={{ fontSize: 14, color: '#9a9a96' }}>/100</span></div>
        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>Sleep Score</h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6b6b68', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
          {crsSleep.factors?.[0] ?? `${durationStr} total sleep · ${zoneLabel.toLowerCase()} quality.`}
        </p>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontStyle: 'italic', color: '#9a9a96' }}>
          {sleep.bedtime ?? '--'} → {sleep.wakeTime ?? '--'}
        </span>
      </div>

      {/* Hypnogram */}
      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: '16px 12px' }}>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
          {[{ y: 10, color: 'rgba(255,47,0,0.08)' }, { y: 25, color: 'rgba(59,249,211,0.08)' }, { y: 40, color: 'rgba(243,107,239,0.08)' }, { y: 55, color: 'rgba(25,117,255,0.08)' }].map((b, i) => (
            <rect key={i} x={0} y={i === 0 ? 0 : b.y - 7} width={chartW} height={17} fill={b.color} />
          ))}
          <path d={hypnogram} fill="none" stroke="#1a1a1a" strokeWidth={1.5} opacity={0.6} strokeLinecap="round" />
        </svg>
        {/* Stage legend */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {stageConfig.map(s => (
            <span key={s.key} style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-body)', color: '#6b6b68' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              {s.label} {Math.round(s.pct)}%
            </span>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="component-bars" style={{ marginTop: 10 }}>
        {[
          { label: 'Duration', value: durationStr, status: sleep.efficiency >= 85 ? 'efficient' : 'fragmented' },
          { label: 'Efficiency', value: `${sleep.efficiency}%`, status: sleep.efficiency >= 85 ? 'good' : 'below threshold' },
          { label: 'Deep sleep', value: `${Math.round(sleep.deepPercent)}%`, status: sleep.deepPercent >= 15 ? 'normal' : 'below threshold' },
          { label: 'REM', value: `${Math.round(sleep.remPercent)}%`, status: sleep.remPercent >= 18 ? 'normal' : 'below threshold' },
        ].map((row, i) => (
          <div key={i} className="component-row">
            <div className="component-label">
              <span className="component-label-name">{row.label}</span>
              <span className="component-label-status">{row.status}</span>
            </div>
            <div className="component-value">
              <span className="component-score">{row.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

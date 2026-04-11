/**
 * Phase2Cards — All Phase 2 metric cards in a single file
 *
 * StackCard          — Meeting load / calendar intelligence
 * SignalPressureCard — Email / comms noise
 * TaskPileUpCard     — Task queue / cognitive weight
 * TodaysWeightCard   — Full cognitive load score
 *
 * Each card handles null data gracefully with an invite ghost state.
 * No external libraries. CSS variables only.
 */

import type { DayResponse } from '../../types.js';

/* ══════════════════════════════════════════════════════════
   Shared primitives
   ══════════════════════════════════════════════════════════ */

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-body)',
  display: 'block',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-body)',
  marginTop: 1,
  letterSpacing: '0.03em',
};

/** Ghost tile: invite not error */
function GhostTile({ label, ghostCopy }: { label: string; ghostCopy: string }) {
  return (
    <div
      className="dash-card"
      style={{
        opacity: 0.6,
        border: '1px dashed var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      <span style={sectionLabel}>{label}</span>
      <p
        style={{
          color: 'var(--text-dim)',
          fontSize: 14,
          marginTop: 12,
          lineHeight: 1.6,
          fontFamily: 'var(--font-body)',
        }}
      >
        {ghostCopy}
      </p>
    </div>
  );
}

/** Horizontal bar — track + colored fill */
function MetricBar({
  value,
  max = 100,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      style={{
        width: '100%',
        height: 6,
        background: 'var(--bg-surface-2)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
}

/** Map 0-100 score to a traffic-light color */
function scoreColor(score: number, lowIsGood = false): string {
  if (lowIsGood) {
    // lower = greener (e.g. cognitive load)
    if (score <= 30) return '#34D399';
    if (score <= 60) return '#FBBF24';
    return '#F87171';
  }
  if (score >= 70) return '#34D399';
  if (score >= 40) return '#FBBF24';
  return '#F87171';
}

/* ══════════════════════════════════════════════════════════
   1. StackCard — meeting load / calendar intelligence
   ══════════════════════════════════════════════════════════ */

interface StackCardProps {
  data: DayResponse['calendar'];
}

function meetingLoadColor(score: number): string {
  if (score < 5) return '#34D399';
  if (score < 10) return '#FBBF24';
  return '#F87171';
}

export function StackCard({ data }: StackCardProps) {
  if (!data) {
    return (
      <GhostTile
        label="THE STACK"
        ghostCopy="Waldo can't see your stack yet. Connect Calendar and The Stack comes alive."
      />
    );
  }

  const bestFocusGap =
    data.focusGaps.length > 0
      ? Math.max(...data.focusGaps.map(g => g.durationMinutes))
      : null;

  const loadBarColor = meetingLoadColor(data.meetingLoadScore);
  // Scale: 0–15+ mapped onto 0–100 for the bar (cap at 15)
  const loadBarPct = Math.min(100, Math.round((data.meetingLoadScore / 15) * 100));

  return (
    <div className="dash-card">
      {/* Header */}
      <div>
        <span style={sectionLabel}>THE STACK</span>
        <span style={subtitleStyle}>meeting load</span>
      </div>

      {/* Meeting load score + bar */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 36,
              fontWeight: 400,
              color: loadBarColor,
              lineHeight: 1,
            }}
          >
            {data.meetingLoadScore.toFixed(1)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ 15+</span>
        </div>
        <MetricBar value={loadBarPct} max={100} color={loadBarColor} />
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 16px',
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        <StatTile
          label="Meetings"
          value={String(data.eventCount)}
        />
        <StatTile
          label="Back-to-back"
          value={String(data.backToBackCount)}
          highlight={data.backToBackCount > 2}
        />
        <StatTile
          label="Boundary violations"
          value={String(data.boundaryViolations)}
          highlight={data.boundaryViolations > 0}
        />
        {bestFocusGap !== null && (
          <StatTile
            label="Best focus gap"
            value={`${bestFocusGap}m`}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   2. SignalPressureCard — comms noise
   ══════════════════════════════════════════════════════════ */

interface SignalPressureCardProps {
  data: DayResponse['email'];
}

function afterHoursColor(ratio: number): string {
  if (ratio < 0.4) return '#34D399';
  if (ratio < 0.6) return '#FBBF24';
  return '#F87171';
}

export function SignalPressureCard({ data }: SignalPressureCardProps) {
  if (!data) {
    return (
      <GhostTile
        label="SIGNAL PRESSURE"
        ghostCopy="Your comms noise isn't visible yet. Connect Gmail to surface Signal Pressure."
      />
    );
  }

  const ratioColor = afterHoursColor(data.afterHoursRatio);
  const afterHoursPct = Math.round(data.afterHoursRatio * 100);
  const isSpike = data.volumeSpike > 1.5;

  return (
    <div className="dash-card">
      {/* Header */}
      <div>
        <span style={sectionLabel}>SIGNAL PRESSURE</span>
        <span style={subtitleStyle}>comms noise</span>
      </div>

      {/* After-hours ratio — main number */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 36,
                fontWeight: 400,
                color: ratioColor,
                lineHeight: 1,
              }}
            >
              {afterHoursPct}%
            </span>
            {isSpike && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                spike
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>after-hours</span>
        </div>
        <MetricBar value={afterHoursPct} max={100} color={ratioColor} />
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 16px',
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        <StatTile label="Total emails" value={String(data.totalEmails)} />
        <StatTile label="Threads" value={String(data.uniqueThreads)} />
        <StatTile label="Sent" value={String(data.sentCount)} />
        <StatTile
          label="After-hours"
          value={String(data.afterHoursCount)}
          highlight={data.afterHoursCount > 5}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   3. TaskPileUpCard — cognitive weight
   ══════════════════════════════════════════════════════════ */

interface TaskPileUpCardProps {
  data: DayResponse['tasks'];
}

export function TaskPileUpCard({ data }: TaskPileUpCardProps) {
  if (!data) {
    return (
      <GhostTile
        label="TASK PILE-UP"
        ghostCopy="Connect Todoist, Linear, or Notion to see your Task Pile-Up."
      />
    );
  }

  const firstUrgent =
    data.urgencyQueue && data.urgencyQueue.length > 0 ? data.urgencyQueue[0] : null;

  return (
    <div className="dash-card">
      {/* Header */}
      <div>
        <span style={sectionLabel}>TASK PILE-UP</span>
        <span style={subtitleStyle}>cognitive weight</span>
      </div>

      {/* Overdue count — prominent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 52,
            fontWeight: 400,
            lineHeight: 1,
            color: data.overdueCount > 0 ? 'var(--accent)' : '#34D399',
          }}
        >
          {data.overdueCount}
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
          }}
        >
          overdue
        </span>
      </div>

      {/* Urgency queue first item */}
      {firstUrgent && (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-xs)',
            padding: '8px 12px',
            marginBottom: 14,
            borderLeft: '3px solid var(--accent)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>
            Next up
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {firstUrgent.title}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginTop: 2 }}>
            Due {firstUrgent.due}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 16px',
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        <StatTile label="Pending" value={String(data.pendingCount)} />
        <StatTile
          label="Velocity"
          value={`${data.recentVelocity.toFixed(1)}/day`}
        />
        <StatTile
          label="Completion rate"
          value={`${Math.round(data.completionRate * 100)}%`}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   4. TodaysWeightCard — total cognitive load
   ══════════════════════════════════════════════════════════ */

interface TodaysWeightCardProps {
  data: DayResponse['cognitiveLoad'];
}

const LOAD_COMPONENT_LABELS: Record<string, string> = {
  meetingLoad: 'Meeting load',
  communicationLoad: 'Comms',
  taskLoad: 'Tasks',
  sleepDebtImpact: 'Sleep debt',
};

function loadLevelColor(level: string): string {
  if (level === 'low') return '#34D399';
  if (level === 'moderate') return '#FBBF24';
  if (level === 'high') return '#F87171';
  return 'var(--text-dim)';
}

export function TodaysWeightCard({ data }: TodaysWeightCardProps) {
  if (!data) {
    return (
      <GhostTile
        label="TODAY'S WEIGHT"
        ghostCopy="Needs 3+ sources connected to compute your full weight."
      />
    );
  }

  const scoreCol = loadLevelColor(data.level);
  const components = data.components as Record<string, number>;

  return (
    <div className="dash-card">
      {/* Header */}
      <div>
        <span style={sectionLabel}>TODAY'S WEIGHT</span>
        <span style={subtitleStyle}>total cognitive load</span>
      </div>

      {/* Score + level badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 52,
            fontWeight: 400,
            lineHeight: 1,
            color: scoreCol,
          }}
        >
          {data.score}
        </span>
        <div style={{ paddingBottom: 6 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
              background: scoreCol + '22',
              color: scoreCol,
              textTransform: 'capitalize',
              letterSpacing: '0.03em',
            }}
          >
            {data.level}
          </span>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: 14,
            fontFamily: 'var(--font-body)',
          }}
        >
          {data.summary}
        </p>
      )}

      {/* Component breakdown bars */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        {Object.entries(components).map(([key, value]) => {
          const pct = Math.min(100, Math.round(value));
          const barColor = scoreColor(pct, true);
          return (
            <div key={key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                  {LOAD_COMPONENT_LABELS[key] ?? key}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {pct}
                </span>
              </div>
              <MetricBar value={pct} max={100} color={barColor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Internal utility — small stat tile used across all cards
   ══════════════════════════════════════════════════════════ */

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          display: 'block',
          fontFamily: 'var(--font-body)',
          marginBottom: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: highlight ? 'var(--accent)' : 'var(--text)',
          fontFamily: 'var(--font-body)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

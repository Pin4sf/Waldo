/**
 * ThePatrol — Timestamped audit log of every action Waldo took.
 *
 * Shows proactive (◉), reactive (◎), and learning (◈) entries with
 * left border color coding, action text, and reason. Handles loading,
 * empty, and ghost states.
 */

import type { WaldoActionData } from '../../types.js';

interface ThePatrolProps {
  actions: WaldoActionData[];
  isLoading?: boolean;
  date?: string;
}

const TYPE_COLOR: Record<WaldoActionData['type'], string> = {
  proactive: '#34D399',
  reactive: '#F97316',
  learning: '#7C6BF0',
};

const TYPE_ICON: Record<WaldoActionData['type'], string> = {
  proactive: '◉',
  reactive: '◎',
  learning: '◈',
};

// ─── Skeleton row ─────────────────────────────────────────────

function SkeletonRow({ opacity }: { opacity: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        opacity,
      }}
    >
      {/* timestamp placeholder */}
      <div style={{
        width: 42,
        height: 12,
        borderRadius: 4,
        background: 'var(--bg-surface-2)',
        flexShrink: 0,
        marginTop: 2,
      }} />
      {/* content placeholders */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '60%', height: 12, borderRadius: 4, background: 'var(--bg-surface-2)' }} />
        <div style={{ width: '85%', height: 10, borderRadius: 4, background: 'var(--bg-surface-2)' }} />
      </div>
    </div>
  );
}

// ─── Ghost row (empty state) ──────────────────────────────────

function GhostRow({ opacity }: { opacity: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        opacity,
      }}
    >
      <div style={{
        width: 42,
        height: 12,
        borderRadius: 4,
        background: 'var(--border)',
        flexShrink: 0,
        marginTop: 2,
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '55%', height: 12, borderRadius: 4, background: 'var(--border)' }} />
        <div style={{ width: '80%', height: 10, borderRadius: 4, background: 'var(--border)' }} />
      </div>
    </div>
  );
}

// ─── Single action entry ──────────────────────────────────────

function PatrolEntry({ action }: { action: WaldoActionData }) {
  const color = TYPE_COLOR[action.type];
  const icon = TYPE_ICON[action.type];

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0 12px 12px',
        borderLeft: `3px solid ${color}`,
        borderBottom: '1px solid var(--border)',
        marginLeft: 0,
      }}
    >
      {/* Timestamp */}
      <span style={{
        fontSize: 12,
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-body)',
        flexShrink: 0,
        minWidth: 42,
        paddingTop: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {action.time}
      </span>

      {/* Icon + content */}
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}>
          <span style={{
            color,
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {icon}
          </span>
          <span style={{
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.4,
          }}>
            {action.action}
          </span>
        </div>

        {/* Reason */}
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>
          {action.reason}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ThePatrol({ actions, isLoading, date }: ThePatrolProps) {
  return (
    <div className="dash-card" style={{ padding: '20px 24px' }}>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-body)',
          marginBottom: 4,
        }}>
          The Patrol
        </span>
        <span style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
        }}>
          {date !== undefined && date.length > 0
            ? `every action Waldo took · ${date}`
            : 'every action Waldo took today'}
        </span>
      </div>

      {/* Loading state */}
      {isLoading === true && (
        <div>
          <SkeletonRow opacity={0.7} />
          <SkeletonRow opacity={0.5} />
          <SkeletonRow opacity={0.3} />
        </div>
      )}

      {/* Empty state */}
      {isLoading !== true && actions.length === 0 && (
        <div>
          <GhostRow opacity={0.4} />
          <GhostRow opacity={0.28} />
          <GhostRow opacity={0.16} />
          <p style={{
            marginTop: 16,
            fontSize: 13,
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            textAlign: 'center' as const,
          }}>
            Waldo&apos;s Patrol starts when your data connects.
          </p>
        </div>
      )}

      {/* Action entries */}
      {isLoading !== true && actions.length > 0 && (
        <div>
          {actions.map((action, i) => (
            <PatrolEntry key={`${action.time}-${i}`} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

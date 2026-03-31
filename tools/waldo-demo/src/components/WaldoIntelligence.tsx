import type { WaldoActionData, PatternData, DayActivityData } from '../types.js';

interface Props {
  actions: WaldoActionData[];
  patterns: PatternData[];
  dayActivity: DayActivityData | null;
}

const SPOT_COLORS: Record<string, string> = {
  positive: '#34D399',
  neutral: 'var(--text-dim)',
  warning: '#FBBF24',
  critical: '#F87171',
};

const SPOT_ICONS: Record<string, string> = {
  health: '●',
  behavior: '◆',
  environment: '◯',
  insight: '★',
  alert: '!',
  learning: '~',
};

export function WaldoIntelligence({ actions, patterns, dayActivity }: Props) {
  return (
    <>
      {/* Morning Wag (pre-generated, no Claude needed) */}
      {dayActivity?.morningWag && (
        <div className="card stagger-1" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-label">Morning wag</div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
            {dayActivity.morningWag}
          </div>
        </div>
      )}

      {/* Spots — what Waldo noticed this day */}
      {dayActivity && dayActivity.spots.length > 0 && (
        <div className="card stagger-2">
          <div className="card-label">Spots — what Waldo noticed</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayActivity.spots.map((spot) => (
              <div key={spot.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <span style={{
                  color: SPOT_COLORS[spot.severity],
                  fontSize: 14,
                  width: 16,
                  textAlign: 'center',
                  flexShrink: 0,
                  lineHeight: '20px',
                  fontWeight: 700,
                }}>
                  {SPOT_ICONS[spot.type] ?? '?'}
                </span>
                <div style={{ flex: 1, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{spot.title}</span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{spot.detail}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 6 }}>{spot.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evening Review */}
      {dayActivity?.eveningReview && (
        <div className="card stagger-3" style={{ borderLeft: '3px solid var(--border)' }}>
          <div className="card-label">Evening review</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
            {dayActivity.eveningReview}
          </div>
        </div>
      )}

      {/* What Waldo did (actions) */}
      {actions.length > 0 && (
        <div className="card stagger-4">
          <div className="card-label">What Waldo did</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <span style={{
                  color: a.type === 'proactive' ? 'var(--accent)' : a.type === 'reactive' ? 'var(--low-text)' : 'var(--text-dim)',
                  fontWeight: 700, width: 16, textAlign: 'center', flexShrink: 0, lineHeight: '20px',
                }}>
                  {a.type === 'proactive' ? '→' : a.type === 'reactive' ? '!' : '~'}
                </span>
                <div style={{ flex: 1, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 500 }}>{a.action}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 6 }}>{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The Constellation — patterns */}
      {patterns.length > 0 && (
        <div className="card stagger-5">
          <div className="card-label">The constellation — patterns across {patterns.reduce((s, p) => s + p.evidenceCount, 0)} data points</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {patterns.map((p) => (
              <div key={p.id} style={{ fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ color: 'var(--text)' }}>{p.summary}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>
                  {p.confidence} · {p.evidenceCount} data points · {p.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

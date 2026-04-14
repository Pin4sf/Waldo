/**
 * TheWindowCard — Focus window protection card.
 *
 * Compact: label + "9:30–11:00am · Your clearest stretch today" + badge + protect CTA
 * Expanded: quality bar, gap details, protection status, about section.
 *
 * Data source: data.calendar.focusGaps — sorted by durationMinutes + quality
 * Ghost state when no calendar connected or no focus gap found.
 */
import { useState } from 'react';
import type { DayResponse } from '../../types.js';

interface TheWindowCardProps {
  data: DayResponse | null;
  /** Synthetic override for demo mode */
  demo?: {
    startTime: string;   // "9:30am"
    endTime: string;     // "11:00am"
    durationMinutes: number;
    quality: number;     // 0–100
    protected: boolean;
    description: string;
  };
}

const QUALITY_LABELS: Record<string, string> = {
  high: 'Prime focus',
  medium: 'Good stretch',
  low: 'Light window',
};

function qualityBand(q: number): { label: string; color: string; bg: string } {
  if (q >= 75) return { label: 'Prime focus', color: '#166534', bg: 'rgba(52,211,153,0.12)' };
  if (q >= 45) return { label: 'Good stretch', color: '#92400E', bg: 'rgba(251,191,36,0.12)' };
  return { label: 'Light window', color: '#6b6b68', bg: 'rgba(26,26,26,0.06)' };
}

function minutesToRange(start: string, minutes: number): string {
  try {
    const d = new Date(start);
    const end = new Date(d.getTime() + minutes * 60000);
    const fmt = (t: Date) =>
      t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
       .toLowerCase().replace(':00', '');
    return `${fmt(d)}–${fmt(end)}`;
  } catch { return '—'; }
}

export function TheWindowCard({ data, demo }: TheWindowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isProtected, setIsProtected] = useState(demo?.protected ?? false);

  // Resolve best focus gap from real or demo data
  const gap = (() => {
    if (demo) {
      return {
        timeRange: `${demo.startTime}–${demo.endTime}`,
        durationMinutes: demo.durationMinutes,
        quality: demo.quality,
        description: demo.description,
      };
    }
    if (!data?.calendar?.focusGaps?.length) return null;
    const sorted = [...data.calendar.focusGaps].sort((a, b) => {
      const qa = (a.quality ?? 50) + a.durationMinutes * 0.3;
      const qb = (b.quality ?? 50) + b.durationMinutes * 0.3;
      return qb - qa;
    });
    const best = sorted[0]!;
    return {
      timeRange: `${best.durationMinutes}min gap`,
      durationMinutes: best.durationMinutes,
      quality: best.quality ?? 60,
      description: `${Math.round(best.durationMinutes / 60)}h ${best.durationMinutes % 60}min of uninterrupted time`,
    };
  })();

  // Ghost state — no calendar or no gap
  if (!gap) {
    return (
      <div className="dash-card" style={{ opacity: 0.6, border: '1px dashed var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
          The Window
        </span>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 12, lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
          Connect your calendar and Waldo will protect your clearest focus stretch each day.
        </p>
      </div>
    );
  }

  const band = qualityBand(gap.quality);
  const durationLabel = gap.durationMinutes >= 60
    ? `${Math.floor(gap.durationMinutes / 60)}h ${gap.durationMinutes % 60 > 0 ? `${gap.durationMinutes % 60}m` : ''}`.trim()
    : `${gap.durationMinutes}m`;

  // ── Compact ──────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        className="dash-card"
        style={{ cursor: 'pointer', borderLeft: isProtected ? '3px solid #34D399' : undefined }}
        onClick={() => setExpanded(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
            The Window
          </span>
          <span style={{
            fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
            background: band.bg, color: band.color,
          }}>
            {band.label}
          </span>
        </div>

        <p style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '4px 0 2px', lineHeight: 1.2 }}>
          {gap.timeRange}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
          {gap.description}
        </p>

        {/* Quality bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 4, background: 'rgba(26,26,26,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${gap.quality}%`,
              background: gap.quality >= 75 ? '#34D399' : gap.quality >= 45 ? '#F59E0B' : '#9a9a96',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: '#9a9a96' }}>focus quality</span>
            <span style={{ fontSize: 9, color: '#9a9a96' }}>{gap.quality}/100</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            {isProtected ? '🛡 Protected · no meetings booked' : `${durationLabel} of clear time`}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setIsProtected(p => !p); }}
            style={{
              padding: '5px 14px', border: `1px solid ${isProtected ? '#34D399' : 'var(--border-strong)'}`,
              borderRadius: 8, background: isProtected ? 'rgba(52,211,153,0.08)' : 'transparent',
              color: isProtected ? '#166534' : 'var(--text-muted)', fontFamily: 'var(--font-body)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {isProtected ? 'Protected ✓' : 'Protect it'}
          </button>
        </div>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────
  return (
    <div className="dash-card">
      {/* Close */}
      <button
        onClick={() => setExpanded(false)}
        style={{ float: 'right', background: 'none', border: 'none', color: '#9a9a96', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -4 }}
      >×</button>

      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
        The Window
      </span>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
        <span style={{
          display: 'inline-block', fontSize: 10, fontWeight: 500, padding: '3px 10px',
          borderRadius: 6, background: band.bg, color: band.color, marginBottom: 12,
        }}>
          {band.label}
        </span>
        <p style={{ fontFamily: 'var(--font-headline)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.1 }}>
          {gap.timeRange}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          {gap.description}
        </p>
      </div>

      {/* Quality bar (full width) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}>Focus quality</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{gap.quality}/100</span>
        </div>
        <div style={{ height: 6, background: 'rgba(26,26,26,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${gap.quality}%`,
            background: gap.quality >= 75 ? '#34D399' : gap.quality >= 45 ? '#F59E0B' : '#9a9a96',
            borderRadius: 4,
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Duration', value: durationLabel },
          { label: 'Status', value: isProtected ? 'Protected' : 'Open' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(26,26,26,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Protect CTA */}
      <button
        onClick={() => setIsProtected(p => !p)}
        style={{
          width: '100%', padding: '13px', border: `1px solid ${isProtected ? '#34D399' : '#1A1A1A'}`,
          borderRadius: 'var(--radius-sm)', background: isProtected ? 'rgba(52,211,153,0.08)' : '#1A1A1A',
          color: isProtected ? '#166534' : '#FAFAF8', fontFamily: 'var(--font-body)',
          fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {isProtected ? '🛡 Protected — remove protection' : 'Protect this window'}
      </button>

      {/* About */}
      <div style={{ background: 'white', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 16, padding: 20, marginTop: 16 }}>
        <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-dim)', display: 'inline-block', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>About</span>
        <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '16px 0 12px', lineHeight: 1.1 }}>
          What is The Window?
        </h4>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 400, color: '#6b6b68', lineHeight: 1.5, margin: 0 }}>
          The Window is the single best stretch of uninterrupted time you have today — scored by gap length, your chronotype, and how recovered you are.
          {'\n\n'}
          When you protect it, Waldo watches for meeting invites that would break it and flags them before you accept. Not a time blocker. A biological scheduler.
        </p>
      </div>
    </div>
  );
}

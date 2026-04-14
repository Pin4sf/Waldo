/**
 * TodaysBriefCard — Daily intelligence timeline.
 *
 * Matches Figma node 297-5981: The central morning card showing
 * the full day broken into three windows (Morning / Midday / Afternoon)
 * with task placement, calendar load, and Waldo actions per block.
 *
 * Structure:
 *   1. Morning message + dalmatian + Waldo handled summary
 *   2. "Today's Brief" — 3 time-block timeline
 *   3. The Handoff CTA — "This is the plan. Want me to sync it?"
 */
import { useState } from 'react';
import type { DayResponse } from '../../types.js';

interface TodaysBriefCardProps {
  data: DayResponse;
  morningWag: string | null;
  onApproveHandoff?: () => void;
  pendingProposal?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function timeToMinutes(iso: string): number {
  try {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  } catch { return 0; }
}

function formatTime12h(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(':00', '');
  } catch { return ''; }
}

interface TimeBlock {
  id: 'morning' | 'midday' | 'afternoon';
  label: string;
  timeRange: string;
  startMin: number;
  endMin: number;
  zone: 'peak' | 'steady' | 'flagging';
  description: string;
  waldoNote: string | null;
  tasks: Array<{ title: string; label: string; arrow: string }>;
  events: Array<{ name: string; time: string; isBackToBack?: boolean }>;
}

const BLOCK_COLORS = {
  peak:     { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', dot: '#34D399' },
  steady:   { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  flagging: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#F87171' },
};

function buildBlocks(data: DayResponse, crs: number): TimeBlock[] {
  const chronotype = data.baselines?.chronotype ?? 'normal';
  // Compute morning peak window by chronotype
  const morningEnd = chronotype === 'early' ? 660 : chronotype === 'late' ? 780 : 720; // 11am / 1pm / 12pm
  const morningStart = chronotype === 'early' ? 510 : chronotype === 'late' ? 600 : 540; // 8:30 / 10:00 / 9:00

  const events = data.calendar?.events ?? [];
  const tasks = data.tasks?.urgencyQueue ?? [];
  const pendingTasks = data.tasks?.pendingCount ?? 0;
  const overdueTasks = data.tasks?.overdueCount ?? 0;

  function eventsInRange(start: number, end: number) {
    return events.filter(e => {
      const t = timeToMinutes(e.startTime);
      return t >= start && t < end;
    }).slice(0, 3);
  }

  // Classify task difficulty by position in queue (first = most urgent/hard)
  const allTasks = Array.isArray(tasks)
    ? tasks.map((t: any, i: number) => ({
        title: typeof t === 'string' ? t : (t?.title ?? 'Task'),
        label: i === 0 ? 'hard task — put here' : i <= 2 ? 'medium task — fits here' : 'low effort — fits here',
        arrow: '→',
      }))
    : [];

  const morningZone: 'peak' | 'steady' | 'flagging' = crs >= 75 ? 'peak' : crs >= 60 ? 'steady' : 'flagging';

  const circadianFactors = data.crs.circadian?.factors ?? [];
  const hasDip = circadianFactors.some(f => f.toLowerCase().includes('dip') || f.toLowerCase().includes('misalign'));
  const afternoonZone: 'peak' | 'steady' | 'flagging' = hasDip || crs < 65 ? 'flagging' : 'steady';

  const mls = data.calendar?.meetingLoadScore ?? 0;
  const b2b = data.calendar?.backToBackCount ?? 0;
  const middayZone: 'peak' | 'steady' | 'flagging' = mls > 10 || b2b > 2 ? 'flagging' : 'steady';

  // Morning window description
  const morningDesc = crs >= 80
    ? `Form ${crs}. Your sharpest block. Use it.`
    : crs >= 65
    ? `Form ${crs}. Decent start. Peak window is yours.`
    : `Form ${crs}. Running lower than usual. Protect what you can.`;

  // Midday description
  const waldoMoves = data.waldoActions.filter(a => a.type === 'proactive').slice(0, 1);
  const middayDesc = mls > 8
    ? `${events.filter(e => { const t = timeToMinutes(e.startTime); return t >= morningEnd && t < 840; }).length} meetings. Stack is heavy.`
    : `Light meeting load. Good window for focus work if you need it.`;
  const middayWaldoNote = waldoMoves.length > 0 ? waldoMoves[0]!.reason : null;

  // Afternoon description from circadian
  const circDip = circadianFactors.find(f => f.toLowerCase().includes('peak ~')) ?? null;
  const peakTimeStr = circDip ? circDip.replace(/.*peak ~/, '').replace(/[^0-9:apm]/g, '') : '3pm';
  const afternoonDesc = `Circadian dip incoming around ${peakTimeStr || '2:30pm'}. Keep it light.`;

  const morningTasks = allTasks.filter((_, i) => i <= 1);
  const middayTasks = allTasks.filter((_, i) => i > 1 && i <= 3);
  const afternoonTasks = allTasks.filter((_, i) => i > 3 && i <= 5);

  const morningTimeLabel = chronotype === 'early'
    ? `8:30 – 11:00am`
    : chronotype === 'late'
    ? `10:00am – 1:00pm`
    : `9:00 – 12:00pm`;

  return [
    {
      id: 'morning',
      label: 'Morning Window',
      timeRange: morningTimeLabel,
      startMin: morningStart,
      endMin: morningEnd,
      zone: morningZone,
      description: morningDesc,
      waldoNote: data.waldoActions.length > 0 ? 'The brief is done. This is yours.' : null,
      tasks: morningTasks.length > 0 ? morningTasks : (pendingTasks > 0 ? [{ title: 'Your most important task', label: 'hard task — put here', arrow: '→' }] : []),
      events: eventsInRange(morningStart, morningEnd).map(e => ({ name: e.summary, time: formatTime12h(e.startTime) })),
    },
    {
      id: 'midday',
      label: 'Midday',
      timeRange: '11am – 2:00pm',
      startMin: morningEnd,
      endMin: 840,
      zone: middayZone,
      description: middayDesc,
      waldoNote: middayWaldoNote,
      tasks: middayTasks.length > 0 ? middayTasks : [],
      events: eventsInRange(morningEnd, 840).map(e => ({ name: e.summary, time: formatTime12h(e.startTime) })),
    },
    {
      id: 'afternoon',
      label: 'Afternoon',
      timeRange: '2:00 – 6:00pm',
      startMin: 840,
      endMin: 1080,
      zone: afternoonZone,
      description: afternoonDesc,
      waldoNote: mls > 8 ? "Waldo's watching the 2pm block." : null,
      tasks: afternoonTasks.length > 0 ? afternoonTasks : [],
      events: eventsInRange(840, 1080).map(e => ({ name: e.summary, time: formatTime12h(e.startTime) })),
    },
  ];
}

// ── Time Block Component ──────────────────────────────────────────

function TimeBlockCard({ block }: { block: TimeBlock }) {
  const c = BLOCK_COLORS[block.zone];
  return (
    <div style={{
      background: c.bg,
      border: `0.5px solid ${c.border}`,
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {/* Time range + zone dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: c.text, fontWeight: 500, letterSpacing: '0.04em' }}>
          {block.timeRange}
        </span>
      </div>

      {/* Block title */}
      <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: '#1a1a1a', margin: '0 0 4px', lineHeight: 1.2 }}>
        {block.label}
      </h4>

      {/* Description */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#6b6b68', lineHeight: 1.5, margin: '0 0 6px' }}>
        {block.description}
      </p>

      {/* Waldo note */}
      {block.waldoNote && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9a9a96', fontStyle: 'italic', lineHeight: 1.4, margin: '0 0 6px' }}>
          {block.waldoNote}
        </p>
      )}

      {/* Calendar events */}
      {block.events.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>📅</span>
          <span style={{ fontSize: 11, color: '#6b6b68', fontFamily: 'var(--font-body)' }}>
            {e.time && <span style={{ color: '#9a9a96', marginRight: 4 }}>{e.time}</span>}
            {e.name}
          </span>
        </div>
      ))}

      {/* Task arrows */}
      {block.tasks.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 12, color: c.text, flexShrink: 0, marginTop: 1 }}>→</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: '#1a1a1a', lineHeight: 1.4 }}>
            {t.title}{' '}
            <span style={{ color: '#9a9a96', fontStyle: 'italic' }}>[{t.label}]</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export function TodaysBriefCard({ data, morningWag, onApproveHandoff, pendingProposal }: TodaysBriefCardProps) {
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const crs = data.crs.score;

  if (crs < 0) return null; // No data

  const blocks = buildBlocks(data, crs);
  const waldoActionsToday = data.waldoActions.length;
  const hasPlan = (data.calendar?.eventCount ?? 0) > 0 || (data.tasks?.pendingCount ?? 0) > 0;

  const handleSync = () => {
    setHandoffDone(true);
    onApproveHandoff?.();
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(26,26,26,0.08)',
      borderRadius: 20,
      overflow: 'hidden',
      
      marginBottom: 12,
    }}>

      {/* ── Morning message ── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid rgba(26,26,26,0.06)' }}>
        {/* Dalmatian mood + morning text */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
          {/* Dalmatian SVG (simplified) */}
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: crs >= 75 ? '#F0FDF4' : crs >= 60 ? '#FFFBEB' : '#FEF2F2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            🐕
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 16, fontWeight: 400,
              color: '#1a1a1a', lineHeight: 1.5, margin: 0,
            }}>
              {morningWag || (
                crs >= 80 ? `Form ${crs}. Sharp morning. Put the hard thing first.`
                : crs >= 65 ? `Form ${crs}. Good baseline. Watch your meeting load this afternoon.`
                : crs >= 50 ? `Form ${crs}. A bit lower than usual. One priority today.`
                : `Form ${crs}. Rough start. Waldo's kept things light.`
              )}
            </p>
          </div>
        </div>

        {/* Waldo handled footer */}
        {waldoActionsToday > 0 && (
          <p style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)', fontStyle: 'italic', margin: 0 }}>
            scroll up to see overnight log · but you probably don't because Waldo handled it
          </p>
        )}
      </div>

      {/* ── Today's Brief timeline ── */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 400, color: '#1a1a1a', margin: 0 }}>
            Today's Brief
          </h3>
          <span style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)' }}>
            {data.calendar?.eventCount ?? 0} meetings · {data.tasks?.pendingCount ?? 0} tasks
          </span>
        </div>

        {blocks.map(block => <TimeBlockCard key={block.id} block={block} />)}
      </div>

      {/* ── The Handoff CTA ── */}
      {hasPlan && (
        <div style={{
          padding: '16px 20px 20px',
          borderTop: '0.5px solid rgba(26,26,26,0.06)',
          background: '#FAFAF8',
        }}>
          {handoffDone ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 16, fontStyle: 'italic',
                color: '#1a1a1a', margin: '0 0 4px',
              }}>
                Already on it. Check back at 2pm.
              </p>
              <p style={{ fontSize: 11, color: '#9a9a96', fontFamily: 'var(--font-body)', margin: 0 }}>
                {waldoActionsToday} things handled
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 10, color: '#9a9a96', fontFamily: 'var(--font-body)', marginBottom: 6 }}>
                No need…
              </p>
              <p style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 20, fontWeight: 400,
                color: '#1a1a1a', margin: '0 0 6px', lineHeight: 1.3,
              }}>
                This is the plan.{'\n'}Want me to sync it?
              </p>
              {!showHandoff && (
                <p style={{ fontSize: 11, color: '#6b6b68', fontFamily: 'var(--font-body)', lineHeight: 1.5, margin: '0 0 14px' }}>
                  I'll move the meetings, draft the emails, block the focus windows,
                  and check back at 2pm. You won't need to think about it.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSync}
                  style={{
                    background: '#1a1a1a', color: '#FAFAF8',
                    border: 'none', borderRadius: 10,
                    padding: '10px 20px', fontSize: 13,
                    fontFamily: 'var(--font-body)', fontWeight: 500,
                    cursor: 'pointer', flex: 1,
                  }}
                >
                  Sync it
                </button>
                <button
                  onClick={() => setShowHandoff(!showHandoff)}
                  style={{
                    background: 'transparent', color: '#6b6b68',
                    border: '0.5px solid rgba(26,26,26,0.2)', borderRadius: 10,
                    padding: '10px 16px', fontSize: 13,
                    fontFamily: 'var(--font-body)', cursor: 'pointer', flex: 1,
                  }}
                >
                  Walk me through it first
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DailyScheduleCard — Today's schedule at a glance
 *
 * Shows a vertical timeline of events with:
 * - Time + duration pill + event name + attendee count
 * - Back-to-back indicator (rose dot)
 * - Boundary violation highlight (events after 7pm → orange text)
 * - Focus gap spacers between events (≥ 45 min gap → green shaded spacer)
 * - Ghost tile when calendar is not connected
 * - Footer warnings for heavy load or after-hours meetings
 */

import type { DayResponse } from '../../types.js';

/* ── Props ─────────────────────────────────────────────────── */

interface DailyScheduleCardProps {
  calendar: DayResponse['calendar'];
  formPeak?: string; // e.g. "10am–12pm" — peak cognitive window
}

type CalendarEvent = NonNullable<DayResponse['calendar']>['events'][number];

/* ── Time helpers ───────────────────────────────────────────── */

function formatTime(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase();
  } catch {
    return '';
  }
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getStartMinutes(iso: string): number {
  try {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  } catch {
    return 0;
  }
}

function isAfter7pm(iso: string): boolean {
  try {
    return new Date(iso).getHours() >= 19;
  } catch {
    return false;
  }
}

/* ── Shared style constants ─────────────────────────────────── */

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-body)',
  display: 'block',
  marginBottom: 14,
};

/* ── Sub-components ─────────────────────────────────────────── */

/** Duration pill */
function DurationPill({ minutes }: { minutes: number }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-muted)',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 7px',
        flexShrink: 0,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {formatDuration(minutes)}
    </span>
  );
}

/** Attendee count badge — only shown when > 1 */
function AttendeeBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span
      style={{
        fontSize: 11,
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap' as const,
        flexShrink: 0,
      }}
    >
      {count} people
    </span>
  );
}

/** Focus gap spacer rendered between two events */
function FocusGapSpacer({ gapMinutes }: { gapMinutes: number }) {
  return (
    <div
      style={{
        padding: '6px 0 6px 12px',
        borderLeft: '2px solid #34D399',
        marginLeft: 6,
      }}
    >
      <span style={{ fontSize: 12, color: '#34D399', fontFamily: 'var(--font-body)' }}>
        {'\u21b3'} {gapMinutes}m focus window
      </span>
    </div>
  );
}

/** Single event row in the timeline */
function EventRow({
  event,
  isBackToBack,
}: {
  event: CalendarEvent;
  isBackToBack: boolean;
}) {
  const afterHours = isAfter7pm(event.startTime);
  const timeStr = formatTime(event.startTime);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 16,
        position: 'relative' as const,
        minHeight: 32,
      }}
    >
      {/* Back-to-back indicator dot */}
      {isBackToBack && (
        <span
          style={{
            position: 'absolute' as const,
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#FB7185',
            flexShrink: 0,
          }}
        />
      )}

      {/* Time */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-body)',
          color: afterHours ? 'var(--accent)' : 'var(--text-muted)',
          minWidth: 52,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timeStr}
      </span>

      {/* Duration pill */}
      <DurationPill minutes={event.durationMinutes} />

      {/* Event name */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--font-body)',
          color: afterHours ? 'var(--accent)' : 'var(--text)',
          flex: 1,
          overflow: 'hidden' as const,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
        title={event.summary}
      >
        {event.summary}
      </span>

      {/* Attendee count */}
      <AttendeeBadge count={event.attendeeCount} />
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

const MAX_EVENTS = 8;

export function DailyScheduleCard({ calendar, formPeak }: DailyScheduleCardProps) {
  /* Ghost tile — calendar not connected */
  if (calendar === null) {
    return (
      <div
        className="dash-card"
        style={{
          opacity: 0.6,
          border: '1px dashed var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <span style={sectionLabel}>TODAY'S SCHEDULE</span>
        <p
          style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            marginTop: 0,
            lineHeight: 1.6,
            fontFamily: 'var(--font-body)',
          }}
        >
          Connect Calendar to see your day.
        </p>
      </div>
    );
  }

  const { events, meetingLoadScore, backToBackCount, boundaryViolations } = calendar;

  /* No events — clear day */
  if (events.length === 0) {
    return (
      <div className="dash-card">
        <span style={sectionLabel}>TODAY'S SCHEDULE</span>
        <p
          style={{
            color: '#34D399',
            fontSize: 14,
            marginTop: 0,
            lineHeight: 1.6,
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
          }}
        >
          No meetings today — full day.
        </p>
        {formPeak && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)',
              fontStyle: 'italic',
              marginTop: 4,
              display: 'block',
            }}
          >
            Peak window: {formPeak}
          </span>
        )}
      </div>
    );
  }

  /* Sort events by start time */
  const sorted = [...events].sort(
    (a, b) => getStartMinutes(a.startTime) - getStartMinutes(b.startTime),
  );

  /* Detect back-to-back events: event i is B2B if it starts within 5 min of
     the end of event i-1 */
  const isB2B: boolean[] = sorted.map((ev, i) => {
    if (i === 0) return false;
    const prev = sorted[i - 1]!;
    const prevEnd = getStartMinutes(prev.startTime) + prev.durationMinutes;
    const gap = getStartMinutes(ev.startTime) - prevEnd;
    return gap >= 0 && gap <= 5;
  });

  /* Build the capped list + overflow count */
  const visibleEvents = sorted.slice(0, MAX_EVENTS);
  const hiddenCount = sorted.length - visibleEvents.length;

  /* Build interleaved timeline: event rows + focus gap spacers */
  type TimelineItem =
    | { kind: 'event'; event: CalendarEvent; index: number }
    | { kind: 'gap'; minutes: number };

  const timeline: TimelineItem[] = [];
  visibleEvents.forEach((ev, i) => {
    if (i > 0) {
      const prev = visibleEvents[i - 1]!;
      const prevEnd = getStartMinutes(prev.startTime) + prev.durationMinutes;
      const gap = getStartMinutes(ev.startTime) - prevEnd;
      if (gap >= 45) {
        timeline.push({ kind: 'gap', minutes: gap });
      }
    }
    timeline.push({ kind: 'event', event: ev, index: i });
  });

  return (
    <div className="dash-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={sectionLabel}>TODAY'S SCHEDULE</span>
        {formPeak && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)',
              fontStyle: 'italic',
              marginTop: -2,
              flexShrink: 0,
            }}
          >
            Peak {formPeak}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 6,
        }}
      >
        {timeline.map((item, idx) => {
          if (item.kind === 'gap') {
            return <FocusGapSpacer key={`gap-${idx}`} gapMinutes={item.minutes} />;
          }
          return (
            <EventRow
              key={`event-${item.index}`}
              event={item.event}
              isBackToBack={isB2B[item.index] ?? false}
            />
          );
        })}

        {/* "+N more" overflow row */}
        {hiddenCount > 0 && (
          <div
            style={{
              paddingLeft: 16,
              marginTop: 2,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
              }}
            >
              +{hiddenCount} more
            </span>
          </div>
        )}
      </div>

      {/* Footer warnings */}
      {(meetingLoadScore > 8 || boundaryViolations > 0) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 4,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          {meetingLoadScore > 8 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--accent)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Heavy day — {meetingLoadScore.toFixed(1)} load
            </span>
          )}
          {boundaryViolations > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#FB7185',
                fontFamily: 'var(--font-body)',
              }}
            >
              After-hours meetings detected
            </span>
          )}
        </div>
      )}
    </div>
  );
}

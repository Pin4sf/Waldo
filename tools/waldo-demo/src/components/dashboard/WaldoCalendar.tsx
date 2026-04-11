/**
 * WaldoCalendar — Bubble heatmap calendar
 *
 * 7-column grid (SUN-SAT), circles sized by Form score (bigger = higher score),
 * zone-colored (peak = green, steady = amber, flagging = rose, no data = gray).
 * Adapted from Figma reference node 405:6754.
 */
import type { DateEntry } from '../../types.js';

interface WaldoCalendarProps {
  dates: DateEntry[];
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const ZONE_COLORS: Record<string, string> = {
  peak: '#34D399',
  moderate: '#FBBF24',
  low: '#F87171',
  nodata: '#D4D4D0',
};

function getMonthWeeks(dates: DateEntry[]): { date: string | null; entry: DateEntry | null }[][] {
  if (dates.length === 0) return [];

  // Get the range for the last ~5 weeks
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const lastDate = new Date(last.date + 'T00:00:00');

  // Go back ~5 weeks from the last date
  const startDate = new Date(lastDate);
  startDate.setDate(startDate.getDate() - 34); // ~5 weeks
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const dateMap = new Map(sorted.map(d => [d.date, d]));
  const weeks: { date: string | null; entry: DateEntry | null }[][] = [];
  let current = new Date(startDate);

  while (current <= lastDate) {
    const week: { date: string | null; entry: DateEntry | null }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = current.toISOString().slice(0, 10);
      if (current > lastDate) {
        week.push({ date: null, entry: null });
      } else {
        week.push({ date: iso, entry: dateMap.get(iso) ?? null });
      }
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

export function WaldoCalendar({ dates, onSelectDate, selectedDate }: WaldoCalendarProps) {
  const weeks = getMonthWeeks(dates);

  if (weeks.length === 0) {
    return (
      <div className="dash-card" style={{ padding: '20px', textAlign: 'center', color: '#9a9a96' }}>
        No calendar data yet.
      </div>
    );
  }

  const maxScore = Math.max(...dates.map(d => d.crs).filter(c => c > 0), 100);

  return (
    <div className="dash-card" style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a9a96',
          }}>
            Form Calendar
          </span>
          <h3 style={{
            fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400,
            color: '#1a1a1a', margin: '4px 0 0',
          }}>
            {dates.length} days tracked
          </h3>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#9a9a96' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ZONE_COLORS.peak, display: 'inline-block' }} />Peak
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#9a9a96' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ZONE_COLORS.moderate, display: 'inline-block' }} />Steady
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#9a9a96' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ZONE_COLORS.low, display: 'inline-block' }} />Low
          </span>
        </div>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, textAlign: 'center', marginBottom: 6,
      }}>
        {DAYS.map(d => (
          <span key={d} style={{
            fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
            color: '#9a9a96', letterSpacing: '0.04em',
          }}>{d}</span>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
          }}>
            {week.map((cell, di) => {
              if (!cell.date) {
                return <div key={di} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
              }
              const entry = cell.entry;
              const score = entry?.crs ?? 0;
              const zone = entry?.zone ?? 'nodata';
              const color = ZONE_COLORS[zone] ?? ZONE_COLORS.nodata;
              // Bubble size: min 4px, max 28px based on score
              const minR = 4, maxR = 14;
              const r = score > 0 ? minR + ((score / maxScore) * (maxR - minR)) : 3;
              const isSelected = cell.date === selectedDate;
              const dayNum = new Date(cell.date + 'T00:00:00').getDate();

              return (
                <div
                  key={di}
                  style={{
                    aspectRatio: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column',
                    cursor: onSelectDate ? 'pointer' : 'default',
                    borderRadius: 8,
                    background: isSelected ? 'rgba(251,148,63,0.08)' : 'transparent',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                  onClick={() => onSelectDate?.(cell.date!)}
                  title={`${cell.date} · Form ${score || '--'}`}
                >
                  <div style={{
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    background: color,
                    opacity: score > 0 ? 0.85 : 0.3,
                    transition: 'all 0.2s',
                    border: isSelected ? '2px solid #fb943f' : '2px solid transparent',
                  }} />
                  <span style={{
                    fontSize: 8,
                    color: isSelected ? '#fb943f' : '#9a9a96',
                    fontFamily: 'var(--font-body)',
                    fontWeight: isSelected ? 600 : 400,
                    marginTop: 1,
                    lineHeight: 1,
                  }}>{dayNum}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

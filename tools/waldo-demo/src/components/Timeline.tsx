import { useEffect, useRef } from 'react';
import type { DateEntry } from '../types.js';

interface Props {
  dates: DateEntry[];
  selected: string | null;
  onSelect: (date: string) => void;
}

function buildTooltip(d: DateEntry): string {
  const parts = [d.date];
  if (d.headline) parts.push(d.headline);
  if (d.spotCount > 0) parts.push(`${d.spotCount} spots`);
  return parts.join(' — ');
}

export function Timeline({ dates, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selected]);

  let lastMonth = '';

  return (
    <div className="timeline-container" ref={containerRef}>
      <div className="timeline">
        {dates.map((d) => {
          const month = d.date.slice(0, 7);
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const monthLabel = showMonth
            ? new Date(d.date + 'T00:00:00').toLocaleString('en', { month: 'short', year: '2-digit' })
            : null;

          const zoneClass = d.zone === 'nodata' ? `nodata ${d.tier}` : d.zone;

          return (
            <div key={d.date} style={{ display: 'contents' }}>
              {monthLabel && <span className="timeline-month">{monthLabel}</span>}
              <div
                ref={d.date === selected ? selectedRef : undefined}
                className={`timeline-dot ${zoneClass} ${d.date === selected ? 'selected' : ''}`}
                onClick={() => onSelect(d.date)}
                title={buildTooltip(d)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

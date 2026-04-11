/**
 * FetchCard — Alert/event cards (The Fetch, Adjustment, The Brief)
 *
 * Matches Figma: timestamp, serif title, narrative text, category badge
 * Used in center column below Morning Wag for recent Waldo actions
 */

export interface FetchEvent {
  time: string;
  title: string;
  narrative: string;
  category: string;
  type: 'fetch' | 'adjustment' | 'brief' | 'spot';
}

interface FetchCardProps {
  event: FetchEvent;
}

const CATEGORY_STYLES: Record<string, { borderLeft: string }> = {
  fetch: { borderLeft: '3px solid #F87171' },
  adjustment: { borderLeft: '3px solid var(--accent)' },
  brief: { borderLeft: '3px solid #34D399' },
  spot: { borderLeft: '3px solid #7C6BF0' },
};

export function FetchCard({ event }: FetchCardProps) {
  const borderStyle = CATEGORY_STYLES[event.type] ?? CATEGORY_STYLES.spot;

  return (
    <div className="dash-card fetch-card" style={borderStyle}>
      <span style={{
        fontSize: 13, color: 'var(--text-dim)',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {event.time}
      </span>

      <h3 style={{
        fontFamily: 'var(--font-headline)',
        fontSize: 22, fontWeight: 400,
        color: 'var(--text)', marginTop: 4, marginBottom: 8,
        lineHeight: 1.2,
      }}>
        {event.title}
      </h3>

      <p style={{
        fontSize: 15, lineHeight: 1.6,
        color: 'var(--text-muted)',
      }}>
        {event.narrative}
      </p>

      <span style={{
        display: 'inline-block', marginTop: 12,
        fontSize: 13, color: 'var(--text)',
        background: 'var(--bg-surface)', borderRadius: 20,
        padding: '4px 14px', border: '1px solid var(--border)',
      }}>
        {event.category}
      </span>
    </div>
  );
}

/** Convert SpotData[] into FetchEvents */
export function spotsToFetchEvents(
  spots: Array<{ date: string; type: string; severity: string; title: string; detail: string }>,
  limit = 5,
): FetchEvent[] {
  return spots.slice(0, limit).map(spot => {
    let eventType: FetchEvent['type'] = 'spot';
    let eventTitle = spot.title || 'Spot';
    let category = spot.type;

    if (spot.severity === 'critical' || spot.severity === 'warning' || spot.type === 'alert') {
      eventType = 'fetch';
      eventTitle = 'The Fetch';
      category = 'Health Alert';
    } else if (spot.type === 'health') {
      eventType = 'spot';
      category = 'Health';
    } else if (spot.type === 'behavior') {
      eventType = 'brief';
      eventTitle = spot.title || 'Pattern';
      category = 'Behavior';
    } else if (spot.type === 'insight' || spot.type === 'learning') {
      eventType = 'brief';
      eventTitle = 'The Brief';
      category = 'Intelligence';
    }

    return {
      time: spot.date,
      title: eventTitle,
      narrative: spot.detail || spot.title,
      category,
      type: eventType,
    };
  });
}

/**
 * TheBrief — Hero card in center column
 *
 * Replaces MorningWag. The daily morning message from Waldo.
 * Displays dalmatian mascot, "THE BRIEF" label, zone-aware animation,
 * large serif narrative paragraphs, optional timestamp, and patrol footer.
 */

interface TheBriefProps {
  message: string | null;
  zone?: 'peak' | 'moderate' | 'low' | 'nodata';
  isLoading?: boolean;
  timestamp?: string;
}

const MASCOT_SRC: Record<string, string> = {
  peak: '/good-light-mode.svg',
  moderate: '/on-it-light-mode.svg',
  low: '/rough-light-mode.svg',
  nodata: '/watching-light-mode.svg',
};

const MASCOT_CLASS: Record<string, string> = {
  peak: 'mascot-happy',
  moderate: 'mascot-onit',
  low: 'mascot-rough',
  nodata: 'mascot-idle',
};

const DEFAULT_MESSAGE =
  "Morning. Waldo's still setting up — connect your wearable or upload health data to get your first Brief.";

export function TheBrief({ message, zone, isLoading, timestamp }: TheBriefProps) {
  if (isLoading) {
    return (
      <div className="dash-card morning-wag-card">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <img
            src="/thinking-light-mode.svg"
            alt="Waldo thinking"
            className="mascot-thinking"
            style={{ width: 80, height: 80, marginBottom: 20 }}
          />
          <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
            Already on it...
          </p>
        </div>
      </div>
    );
  }

  const displayMessage = message ?? DEFAULT_MESSAGE;
  const paragraphs = displayMessage.split('\n').filter(p => p.trim().length > 0);

  const resolvedZone = zone ?? 'nodata';
  const mascotSrc = MASCOT_SRC[resolvedZone] ?? MASCOT_SRC.nodata;
  const mascotClass = MASCOT_CLASS[resolvedZone] ?? MASCOT_CLASS.nodata;

  return (
    <div className="dash-card morning-wag-card">
      {/* "THE BRIEF" label */}
      <span style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-body)',
        marginBottom: 16,
      }}>
        The Brief
      </span>

      {/* Dalmatian mascot */}
      <img
        src={mascotSrc}
        alt="Waldo"
        className={mascotClass}
        style={{ width: 80, height: 80, marginBottom: 16, display: 'block' }}
      />

      {/* Optional timestamp */}
      {timestamp !== undefined && timestamp.length > 0 && (
        <span style={{
          display: 'block',
          fontSize: 13,
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-body)',
          marginBottom: 16,
        }}>
          {timestamp}
        </span>
      )}

      {/* Large serif narrative */}
      <div className="morning-wag-text">
        {paragraphs.map((p, i) => (
          <p key={i} className="morning-wag-paragraph">
            {p}
          </p>
        ))}
      </div>

      {/* Patrol footer */}
      <p className="morning-wag-footer">
        The Patrol picks up from here.
      </p>
    </div>
  );
}

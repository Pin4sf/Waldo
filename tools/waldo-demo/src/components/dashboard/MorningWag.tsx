/**
 * MorningWag — Hero card in center column
 *
 * Matches Figma: dalmatian illustration at top, large serif narrative,
 * warm tone, scroll hint at bottom
 */

interface MorningWagProps {
  message: string | null;
  zone?: 'peak' | 'moderate' | 'low' | 'nodata';
  isLoading?: boolean;
}

function getMascotSrc(zone?: string): string {
  switch (zone) {
    case 'peak': return '/good-light-mode.svg';
    case 'moderate': return '/on-it-light-mode.svg';
    case 'low': return '/rough-light-mode.svg';
    default: return '/watching-light-mode.svg';
  }
}

function getMascotClass(zone?: string): string {
  switch (zone) {
    case 'peak': return 'mascot-happy';
    case 'moderate': return 'mascot-onit';
    case 'low': return 'mascot-rough';
    default: return 'mascot-idle';
  }
}

export function MorningWag({ message, zone, isLoading }: MorningWagProps) {
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
          <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Waldo is reading your signals...
          </p>
        </div>
      </div>
    );
  }

  const displayMessage = message || "Morning. Waldo's still waking up \u2014 upload your health data or connect Google to get your first briefing.";

  // Split message into paragraphs for the large serif treatment
  const paragraphs = displayMessage.split('\n').filter(p => p.trim());

  return (
    <div className="dash-card morning-wag-card">
      {/* Dalmatian illustration */}
      <img
        src={getMascotSrc(zone)}
        alt="Waldo"
        className={getMascotClass(zone)}
        style={{ width: 80, height: 80, marginBottom: 16 }}
      />

      {/* Large serif narrative */}
      <div className="morning-wag-text">
        {paragraphs.map((p, i) => (
          <p key={i} className="morning-wag-paragraph">
            {p}
          </p>
        ))}
      </div>

      {/* Subtle footer */}
      <p className="morning-wag-footer">
        scroll up to see overnight log ;<br />
        but you probably don't because Waldo handled it all.
      </p>
    </div>
  );
}

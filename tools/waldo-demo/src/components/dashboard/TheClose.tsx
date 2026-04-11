/**
 * TheClose — End-of-day evening message card
 *
 * Same format as The Brief: Playfair italic, Waldo voice, dalmatian mood state.
 * Appears after 7pm. No chart — the copy is the content.
 */
import type { DayResponse } from '../../types.js';

interface TheCloseProps {
  data: DayResponse;
  message?: string | null;
}

export function TheClose({ data, message }: TheCloseProps) {
  const now = new Date();
  const hour = now.getHours();

  // Only show after 7pm
  if (hour < 19 && !message) return null;

  const zone = data.crs.zone;
  const score = data.crs.score;

  // Generate contextual close if no explicit message
  const closeText = message ?? (() => {
    if (score >= 80) return "Strong day. Your body held up well — don't override that by staying up late. Sleep protects tomorrow's Form.";
    if (score >= 65) return "Solid enough. You didn't burn the reserve, but you didn't build any either. Early bed tonight tilts the odds for tomorrow.";
    if (score >= 50) return "Tough biological day. You made it through — that counts. Tonight's sleep is where the recovery actually happens. Protect it.";
    return "Rough one. Your body was fighting headwinds all day. The single best thing you can do right now is get to bed within the hour. Tomorrow will be different.";
  })();

  const mascot = zone === 'peak' ? '/good-light-mode.svg' : zone === 'moderate' ? '/on-it-light-mode.svg' : '/rough-light-mode.svg';

  return (
    <div className="dash-card" style={{
      background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ee 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle evening gradient overlay */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '40%', height: '100%',
        background: 'linear-gradient(270deg, rgba(124,107,240,0.04) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
        <img
          src={mascot}
          alt=""
          style={{ width: 48, height: 48, opacity: 0.7, flexShrink: 0, marginTop: 4 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C6BF0',
          }}>
            The Close
          </span>
          <p style={{
            fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400,
            lineHeight: 1.6, color: '#1a1a1a', margin: '10px 0 0',
            fontStyle: 'italic',
          }}>
            {closeText}
          </p>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 11, fontStyle: 'italic',
            color: '#9a9a96', display: 'block', marginTop: 12,
          }}>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()} · wind-down window
          </span>
        </div>
      </div>
    </div>
  );
}

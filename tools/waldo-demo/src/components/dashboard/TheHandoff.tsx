/**
 * TheHandoff — Agentic approval UI card
 *
 * The moment Waldo asks for the keys. "Run it?" — Waldo proposes an action,
 * user approves or rejects. L2 autonomy: suggest + one-tap.
 *
 * States:
 *   none/undefined  → ghost: "activates when Waldo has a plan ready"
 *   pending         → proposal card with approve / reject buttons
 *   approved        → "Already on it."
 *   rejected        → "Understood. Keeping things as they are."
 *   expired         → "Lapsed. Waldo will try again tomorrow."
 */

export interface HandoffProposal {
  id: string;
  action: string;
  description: string;
  impact: string;
}

interface TheHandoffProps {
  proposal?: HandoffProposal;
  onApprove?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'none';
}

/* ─── Section label shared style ─────────────────────────── */
const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-body)',
};

export function TheHandoff({ proposal, onApprove, onReject, status = 'none' }: TheHandoffProps) {
  /* ── Ghost state ────────────────────────────────────────── */
  if (status === 'none' || !proposal) {
    return (
      <div
        className="dash-card"
        style={{
          opacity: 0.6,
          border: '1px dashed var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <span style={sectionLabel}>THE HANDOFF</span>
        <p
          style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            marginTop: 12,
            lineHeight: 1.6,
            fontFamily: 'var(--font-body)',
          }}
        >
          The Handoff activates when Waldo has a plan ready.
        </p>
      </div>
    );
  }

  /* ── Approved ───────────────────────────────────────────── */
  if (status === 'approved') {
    return (
      <div
        className="dash-card"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        <span style={sectionLabel}>THE HANDOFF</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          <span
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 22,
              fontWeight: 400,
              color: 'var(--accent)',
              lineHeight: 1.2,
            }}
          >
            Already on it.
          </span>
        </div>
      </div>
    );
  }

  /* ── Rejected ───────────────────────────────────────────── */
  if (status === 'rejected') {
    return (
      <div
        className="dash-card"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span style={sectionLabel}>THE HANDOFF</span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--text-muted)',
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          Understood. Keeping things as they are.
        </p>
      </div>
    );
  }

  /* ── Expired ────────────────────────────────────────────── */
  if (status === 'expired') {
    return (
      <div
        className="dash-card"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span style={sectionLabel}>THE HANDOFF</span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--text-dim)',
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          Lapsed. Waldo will try again tomorrow.
        </p>
      </div>
    );
  }

  /* ── Pending — the main proposal card ───────────────────── */
  return (
    <>
      {/* Keyframe injected once via a style tag — no library needed */}
      <style>{`
        @keyframes handoff-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(249,115,22,0); }
        }
        .handoff-run-btn {
          animation: handoff-pulse 2s ease-in-out infinite;
        }
        .handoff-run-btn:hover {
          background: #1A1A1A !important;
          animation: none;
        }
        .handoff-reject-btn:hover {
          background: var(--bg-surface-hover) !important;
          color: var(--text) !important;
        }
      `}</style>

      <div
        className="dash-card"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        {/* Section label */}
        <span style={sectionLabel}>THE HANDOFF</span>

        {/* Action title */}
        <h3
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 24,
            fontWeight: 400,
            color: 'var(--text)',
            marginTop: 10,
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          {proposal.action}
        </h3>

        {/* Description */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          {proposal.description}
        </p>

        {/* Impact */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          {proposal.impact}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          {/* Run it. — solid black with pulse */}
          <button
            className="handoff-run-btn"
            onClick={onApprove}
            style={{
              padding: '11px 28px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: '#1A1A1A',
              color: '#FAFAF8',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              letterSpacing: '0.01em',
            }}
            type="button"
          >
            Run it.
          </button>

          {/* Not now — ghost */}
          <button
            className="handoff-reject-btn"
            onClick={onReject}
            style={{
              padding: '11px 24px',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            type="button"
          >
            Not now
          </button>
        </div>

        {/* Sub-text */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--text-dim)',
            marginTop: 10,
          }}
        >
          Waldo will handle the rest.
        </p>
      </div>
    </>
  );
}

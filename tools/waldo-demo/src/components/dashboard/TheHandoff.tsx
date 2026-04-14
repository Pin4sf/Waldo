/**
 * TheHandoff — Agentic approval UI card (live API version)
 *
 * Waldo proposes an action → user approves or rejects → execute-proposal runs it.
 * States: none (ghost) | pending (live proposal) | executing (in-flight)
 *       | approved ("Already on it.") | rejected | expired
 *       | walkthrough (voice states: listening → processing → confirmed)
 */

import { useState, useRef } from 'react';
import type { WaldoProposal } from '../../types.js';

interface TheHandoffProps {
  proposal: WaldoProposal | null;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => Promise<void>;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
  letterSpacing: '0.06em', color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
};

export function TheHandoff({ proposal, onApprove, onReject }: TheHandoffProps) {
  const [localStatus, setLocalStatus] = useState<'idle' | 'executing' | 'done' | 'rejected' | 'listening' | 'processing' | 'confirmed'>('idle');
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApprove = async () => {
    if (!proposal || localStatus !== 'idle') return;
    setLocalStatus('executing');
    try {
      await onApprove(proposal.id);
      setLocalStatus('done');
    } catch {
      setLocalStatus('idle'); // let user retry
    }
  };

  const handleReject = async () => {
    if (!proposal || localStatus !== 'idle') return;
    setLocalStatus('rejected');
    await onReject(proposal.id).catch(() => {});
  };

  const handleWalkthrough = () => {
    if (!proposal) return;
    setLocalStatus('listening');
    // Simulate Waldo listening for 2s → processing 1.5s → confirmed
    listenTimerRef.current = setTimeout(() => {
      setLocalStatus('processing');
      listenTimerRef.current = setTimeout(() => {
        setLocalStatus('confirmed');
      }, 1500);
    }, 2000);
  };

  // ── Walkthrough voice states ──────────────────────────────────────
  if (localStatus === 'listening') {
    return (
      <>
        <style>{`
          @keyframes waveform-bar {
            0%, 100% { transform: scaleY(0.3); }
            50%       { transform: scaleY(1); }
          }
          .wf-bar { animation: waveform-bar 0.8s ease-in-out infinite; transform-origin: bottom; }
          .wf-bar:nth-child(1) { animation-delay: 0s; }
          .wf-bar:nth-child(2) { animation-delay: 0.1s; }
          .wf-bar:nth-child(3) { animation-delay: 0.2s; }
          .wf-bar:nth-child(4) { animation-delay: 0.3s; }
          .wf-bar:nth-child(5) { animation-delay: 0.4s; }
          .wf-bar:nth-child(6) { animation-delay: 0.15s; }
          .wf-bar:nth-child(7) { animation-delay: 0.25s; }
        `}</style>
        <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
          <span style={sectionLabel}>The Handoff</span>
          <div style={{ padding: '20px 0 16px', textAlign: 'center' }}>
            {/* Waveform animation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 32, marginBottom: 16 }}>
              {[10, 18, 26, 32, 28, 20, 12].map((h, i) => (
                <div
                  key={i}
                  className="wf-bar"
                  style={{
                    width: 4, height: h, borderRadius: 3,
                    background: '#2388ff', display: 'inline-block',
                  }}
                />
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: '0 0 6px' }}>
              Go ahead. I'm listening.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
              Tell me what to adjust — I'll update the plan.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (localStatus === 'processing') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ padding: '20px 0 16px', textAlign: 'center' }}>
          <img src="/thinking-light-mode.svg" alt="Waldo thinking" style={{ width: 48, height: 48, marginBottom: 12 }} />
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 4px' }}>
            Updating the plan...
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Give me a second.
          </p>
        </div>
      </div>
    );
  }

  if (localStatus === 'confirmed') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 16 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>✓</span>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 400, color: 'var(--accent)' }}>Updated. Ready to run it now?</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleApprove}
            style={{
              padding: '11px 28px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: '#1A1A1A', color: '#FAFAF8', fontFamily: 'var(--font-body)',
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Run it.
          </button>
          <button
            onClick={() => setLocalStatus('rejected')}
            style={{
              padding: '11px 24px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
              fontSize: 15, fontWeight: 400, cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // Check localStatus FIRST — these must survive after proposal is cleared from parent
  if (localStatus === 'done') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>✓</span>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 400, color: 'var(--accent)' }}>Already on it.</span>
        </div>
      </div>
    );
  }

  if (localStatus === 'rejected') {
    return (
      <div className="dash-card">
        <span style={sectionLabel}>The Handoff</span>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          Understood. Keeping things as they are.
        </p>
      </div>
    );
  }

  // Ghost state — no pending proposal
  if (!proposal || proposal.status === 'expired' || proposal.status === 'rejected') {
    return (
      <div className="dash-card" style={{ opacity: 0.6, border: '1px dashed var(--border)' }}>
        <span style={sectionLabel}>The Handoff</span>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 12, lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
          The Handoff activates when Waldo has a plan ready.
        </p>
      </div>
    );
  }

  // Pending — the main proposal card
  return (
    <>
      <style>{`
        @keyframes handoff-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(249,115,22,0); }
        }
        .handoff-run-btn { animation: handoff-pulse 2s ease-in-out infinite; }
        .handoff-run-btn:hover { background: #1A1A1A !important; animation: none; }
        .handoff-reject-btn:hover { background: var(--bg-surface-hover) !important; color: var(--text) !important; }
      `}</style>

      <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <span style={sectionLabel}>The Handoff</span>

        <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 24, fontWeight: 400, color: 'var(--text)', marginTop: 10, marginBottom: 8, lineHeight: 1.2 }}>
          {proposal.title}
        </h3>

        {proposal.description && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 8 }}>
            {proposal.description}
          </p>
        )}

        {proposal.impact && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {proposal.impact}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="handoff-run-btn"
            onClick={handleApprove}
            disabled={localStatus === 'executing'}
            style={{
              padding: '11px 28px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: '#1A1A1A', color: '#FAFAF8', fontFamily: 'var(--font-body)',
              fontSize: 15, fontWeight: 500, cursor: localStatus === 'executing' ? 'wait' : 'pointer',
              transition: 'background 0.15s ease', letterSpacing: '0.01em',
              opacity: localStatus === 'executing' ? 0.6 : 1,
            }}
            type="button"
          >
            {localStatus === 'executing' ? 'Running...' : 'Run it.'}
          </button>

          <button
            onClick={handleWalkthrough}
            disabled={localStatus === 'executing'}
            style={{
              padding: '11px 24px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
              fontSize: 15, fontWeight: 400, cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease',
            }}
            type="button"
          >
            Walk me through it first
          </button>

          <button
            className="handoff-reject-btn"
            onClick={handleReject}
            disabled={localStatus === 'executing'}
            style={{
              padding: '11px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 400, cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease',
            }}
            type="button"
          >
            Not now
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          Waldo will handle the rest.
        </p>
      </div>
    </>
  );
}

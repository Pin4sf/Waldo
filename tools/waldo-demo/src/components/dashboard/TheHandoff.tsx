/**
 * TheHandoff — Agentic approval UI card (live API version)
 *
 * States: none (ghost) | pending | walkthrough-choice | listening | text-input |
 *         processing | confirmed | executing | done | rejected
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

// The 7 things Waldo is handling (from Figma)
const DEMO_ACTIONS = [
  { done: true,  text: 'Executive Sync moved to 10:30am' },
  { done: true,  text: 'Morning window blocked (9:30–11am, DND active)' },
  { done: false, text: 'Investor email draft — generating now' },
  { done: false, text: 'Q3 review prep doc — queued for 11am' },
  { done: false, text: 'Team standup agenda — will send at 10:25am' },
  { done: false, text: 'Afternoon email triage block — set for 3pm' },
  { done: false, text: 'The Close — scheduled for 8pm' },
];

type HandoffStatus =
  | 'idle' | 'executing' | 'done' | 'rejected'
  | 'walkthrough-choice' | 'listening' | 'text-input' | 'processing' | 'confirmed';

export function TheHandoff({ proposal, onApprove, onReject }: TheHandoffProps) {
  const [localStatus, setLocalStatus] = useState<HandoffStatus>('idle');
  const [textInput, setTextInput] = useState('');
  const [showActions, setShowActions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  const handleApprove = async () => {
    if (!proposal) return;
    // Allow from idle OR confirmed (after walkthrough)
    if (localStatus !== 'idle' && localStatus !== 'confirmed') return;
    setLocalStatus('executing');
    try {
      await onApprove(proposal.id);
      setLocalStatus('done');
    } catch {
      setLocalStatus('idle');
    }
  };

  const handleReject = async () => {
    if (!proposal) return;
    clearTimer();
    setLocalStatus('rejected');
    await onReject(proposal.id).catch(() => {});
  };

  const goToProcessing = () => {
    setLocalStatus('processing');
    timerRef.current = setTimeout(() => setLocalStatus('confirmed'), 1800);
  };

  // Audio mode — waveform for 2.5s → processing → confirmed
  const handleAudioMode = () => {
    setLocalStatus('listening');
    timerRef.current = setTimeout(goToProcessing, 2500);
  };

  // Text mode — show input
  const handleTextMode = () => setLocalStatus('text-input');

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    goToProcessing();
  };

  // ─── Walkthrough choice ─────────────────────────────────────────
  if (localStatus === 'walkthrough-choice') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
        <span style={sectionLabel}>The Handoff · Walk Me Through It</span>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginTop: 10, marginBottom: 20, lineHeight: 1.6 }}>
          How do you want to review the plan?
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleAudioMode} style={{
            flex: 1, padding: '14px 16px', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 22 }}>🎙</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Voice</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Speak your changes</span>
          </button>
          <button onClick={handleTextMode} style={{
            flex: 1, padding: '14px 16px', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 22 }}>✏️</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Text</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Type what to change</span>
          </button>
        </div>
        <button onClick={() => setLocalStatus('idle')} style={{
          marginTop: 14, background: 'none', border: 'none',
          color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer',
          fontFamily: 'var(--font-body)', padding: 0,
        }}>
          ← Back
        </button>
      </div>
    );
  }

  // ─── Text input mode ────────────────────────────────────────────
  if (localStatus === 'text-input') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
        <span style={sectionLabel}>The Handoff · Tell Waldo</span>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginTop: 10, marginBottom: 14, lineHeight: 1.6 }}>
          What should I change about the plan?
        </p>
        <textarea
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTextSubmit(); }}
          placeholder="e.g. Move the afternoon block to 4pm, and send the standup agenda at 9:45am instead..."
          style={{
            width: '100%', minHeight: 88, padding: '10px 12px',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)',
            background: 'var(--bg)', resize: 'vertical' as const, lineHeight: 1.5,
            outline: 'none', boxSizing: 'border-box' as const,
          }}
          autoFocus
        />
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, marginBottom: 14 }}>Cmd/Ctrl+Enter to submit</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleTextSubmit} disabled={!textInput.trim()} style={{
            padding: '11px 28px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: textInput.trim() ? '#1A1A1A' : 'var(--bg-surface-2)',
            color: textInput.trim() ? '#FAFAF8' : 'var(--text-dim)',
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500,
            cursor: textInput.trim() ? 'pointer' : 'default',
          }}>Update the plan</button>
          <button onClick={() => setLocalStatus('walkthrough-choice')} style={{
            padding: '11px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer',
          }}>Back</button>
        </div>
      </div>
    );
  }

  // ─── Listening (voice waveform) ──────────────────────────────────
  if (localStatus === 'listening') {
    const bars = [8, 14, 22, 30, 36, 32, 26, 20, 14, 10, 14, 20, 26, 32, 36, 30, 22, 14, 8];
    return (
      <>
        <style>{`
          @keyframes wf { 0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)} }
          .wf-b{animation:wf 0.8s ease-in-out infinite;transform-origin:bottom}
          ${bars.map((_,i)=>`.wf-b:nth-child(${i+1}){animation-delay:${(i*0.05).toFixed(2)}s}`).join('')}
        `}</style>
        <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
          <span style={sectionLabel}>The Handoff</span>
          <div style={{ padding: '20px 0 12px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 44, marginBottom: 14 }}>
              {bars.map((h, i) => (
                <div key={i} className="wf-b" style={{ width: 3, height: h, borderRadius: 3, background: '#2388ff' }} />
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

  // ─── Processing ──────────────────────────────────────────────────
  if (localStatus === 'processing') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid #2388ff' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ padding: '20px 0 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          </div>
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 4px' }}>
            Updating the plan...
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Waldo processes the transcript.
          </p>
        </div>
      </div>
    );
  }

  // ─── Confirmed — show updated plan + pulsing Run button ──────────
  if (localStatus === 'confirmed') {
    return (
      <>
        <style>{`
          @keyframes run-pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.4)}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)}}
          .run-btn-ready{animation:run-pulse 1.8s ease-in-out infinite}
          .run-btn-ready:hover{animation:none;background:#000!important}
        `}</style>
        <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <span style={sectionLabel}>The Handoff</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400, color: 'var(--text)' }}>
              Updated. Ready to run it now?
            </span>
          </div>

          {/* Expandable action list */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowActions(a => !a)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', gap: 6, padding: 0,
            }}>
              <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showActions ? 'rotate(90deg)' : 'none' }}>›</span>
              {DEMO_ACTIONS.length} things Waldo is handling {showActions ? '↑' : '(tap to see)'}
            </button>
            {showActions && (
              <div style={{ marginTop: 10 }}>
                {DEMO_ACTIONS.map((a, i) => (
                  <div key={i} style={{
                    fontFamily: 'var(--font-body)', fontSize: 13, padding: '5px 0',
                    borderBottom: i < DEMO_ACTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                    color: a.done ? 'var(--peak-text)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ flexShrink: 0, opacity: a.done ? 1 : 0.5 }}>{a.done ? '✓' : '→'}</span>
                    {a.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="run-btn-ready" onClick={handleApprove} style={{
              padding: '12px 32px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: '#1A1A1A', color: '#FAFAF8', fontFamily: 'var(--font-body)',
              fontSize: 16, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em',
            }}>
              Run it.
            </button>
            <button onClick={() => { clearTimer(); setLocalStatus('rejected'); }} style={{
              padding: '12px 24px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
              fontSize: 15, cursor: 'pointer',
            }}>
              Not now
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Executing ────────────────────────────────────────────────────
  if (localStatus === 'executing') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)' }}>Running...</span>
        </div>
      </div>
    );
  }

  // ─── Done ─────────────────────────────────────────────────────────
  if (localStatus === 'done') {
    return (
      <div className="dash-card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <span style={sectionLabel}>The Handoff</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>✓</span>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 400, color: 'var(--accent)' }}>Already on it.</span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
          Check back at 2pm — I'll have an update.
        </p>
      </div>
    );
  }

  // ─── Rejected ─────────────────────────────────────────────────────
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

  // ─── Ghost state ──────────────────────────────────────────────────
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

  // ─── Pending — main proposal card ─────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes handoff-pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.35)}50%{box-shadow:0 0 0 6px rgba(249,115,22,0)}}
        .handoff-run-btn{animation:handoff-pulse 2s ease-in-out infinite}
        .handoff-run-btn:hover{background:#1A1A1A!important;animation:none}
        .handoff-reject-btn:hover{background:var(--bg-surface-hover)!important;color:var(--text)!important}
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
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            {proposal.impact}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="handoff-run-btn" onClick={handleApprove} type="button" style={{
            padding: '11px 28px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: '#1A1A1A', color: '#FAFAF8', fontFamily: 'var(--font-body)',
            fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s ease',
          }}>
            Run it.
          </button>

          <button onClick={() => setLocalStatus('walkthrough-choice')} type="button" style={{
            padding: '11px 24px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
            fontSize: 15, fontWeight: 400, cursor: 'pointer',
          }}>
            Walk me through it first
          </button>

          <button className="handoff-reject-btn" onClick={handleReject} type="button" style={{
            padding: '11px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
            fontSize: 14, fontWeight: 400, cursor: 'pointer',
          }}>
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

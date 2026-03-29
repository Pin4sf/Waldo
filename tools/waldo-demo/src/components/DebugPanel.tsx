import { useState } from 'react';
import type { DayResponse, WaldoResponse } from '../types.js';

interface Props {
  day: DayResponse | null;
  waldoResponse: WaldoResponse | null;
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="debug-section">
      <div className="debug-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && children}
    </div>
  );
}

function Metrics({ items }: { items: [string, string | number][] }) {
  return (
    <div>
      {items.map(([label, value]) => (
        <div className="debug-metric" key={label}>
          <span className="label">{label}</span>
          <span className="value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function DebugPanel({ day, waldoResponse }: Props) {
  if (!day) {
    return (
      <div className="empty-state">
        <h3>Under the hood</h3>
        <p>Select a date to see how Waldo works.</p>
      </div>
    );
  }

  const crs = day.crs;

  return (
    <>
      {/* CRS computation */}
      <Section title="CRS computation" defaultOpen>
        <Metrics items={[
          ['Score', crs.score >= 0 ? `${crs.score} (${crs.zone})` : 'Insufficient data'],
          ['Components with data', `${crs.componentsWithData}/4`],
          ['Confidence', `±${crs.confidence}`],
          ['Sleep score', `${Math.round(crs.sleep.score)} (${crs.sleep.dataAvailable ? 'real' : 'no data'})`],
          ['HRV score', `${Math.round(crs.hrv.score)} (${crs.hrv.dataAvailable ? 'real' : 'neutral'})`],
          ['Circadian score', `${Math.round(crs.circadian.score)} (${crs.circadian.dataAvailable ? 'real' : 'neutral'})`],
          ['Activity score', `${Math.round(crs.activity.score)} (${crs.activity.dataAvailable ? 'real' : 'no data'})`],
        ]} />
      </Section>

      {/* Stress detection */}
      <Section title="Stress detection" defaultOpen>
        <Metrics items={[
          ['Events detected', day.stress.events.length],
          ['Peak confidence', day.stress.peakConfidence ? `${(day.stress.peakConfidence * 100).toFixed(0)}%` : 'None'],
          ['Peak severity', day.stress.peakSeverity ?? 'None'],
          ['Total stress minutes', day.stress.totalStressMinutes],
          ['Fetch alert triggered', day.stress.fetchAlertTriggered ? 'Yes' : 'No'],
        ]} />
        {day.stress.events.length > 0 && (
          <div style={{ padding: '8px 14px' }}>
            {day.stress.events.map((e, i) => (
              <div className="stress-event" key={i}>
                <span className={`stress-badge ${e.severity}`}>{e.severity}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{e.durationMinutes}min · {(e.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Claude response metrics */}
      {waldoResponse && (
        <Section title="Claude response" defaultOpen>
          <Metrics items={[
            ['Model', waldoResponse.debug.model],
            ['Zone', waldoResponse.zone],
            ['Mode', waldoResponse.mode.replace('_', ' ')],
            ['Input tokens', waldoResponse.tokensIn],
            ['Output tokens', waldoResponse.tokensOut],
            ['Response time', `${waldoResponse.responseTimeMs}ms`],
            ['Est. cost', `$${((waldoResponse.tokensIn * 0.8 + waldoResponse.tokensOut * 4) / 1_000_000).toFixed(5)}`],
          ]} />
        </Section>
      )}

      {/* System prompt */}
      {waldoResponse && (
        <Section title="System prompt">
          <div className="debug-content">
            {waldoResponse.debug.systemPrompt}
          </div>
        </Section>
      )}

      {/* User message (biometric context) */}
      {waldoResponse && (
        <Section title="User message (biometric context)">
          <div className="debug-content">
            {waldoResponse.debug.userMessage}
          </div>
        </Section>
      )}

      {/* Raw factors */}
      <Section title="All scoring factors">
        <div className="debug-content">
          {[
            `--- Sleep (${Math.round(crs.sleep.score)}) ---`,
            ...crs.sleep.factors,
            '',
            `--- HRV (${Math.round(crs.hrv.score)}) ---`,
            ...crs.hrv.factors,
            '',
            `--- Circadian (${Math.round(crs.circadian.score)}) ---`,
            ...crs.circadian.factors,
            '',
            `--- Activity (${Math.round(crs.activity.score)}) ---`,
            ...crs.activity.factors,
          ].join('\n')}
        </div>
      </Section>
    </>
  );
}

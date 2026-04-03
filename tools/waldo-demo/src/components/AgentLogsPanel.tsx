import { useState, useEffect } from 'react';
import { fetchAgentLogs } from '../supabase-api.js';
import type { AgentLogEntry } from '../types.js';

interface Props { userId: string }

const TRIGGER_COLOR: Record<string, string> = {
  morning_wag: '#3B82F6',
  fetch_alert: '#EF4444',
  conversational: '#8B5CF6',
  evening_review: '#F59E0B',
  baseline_update: '#10B981',
};

const STATUS_COLOR: Record<string, string> = {
  sent: '#34D399',
  fallback: '#F59E0B',
  suppressed: '#9CA3AF',
  failed: '#EF4444',
};

function LogRow({ log }: { log: AgentLogEntry }) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.createdAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const costStr = log.estimatedCostUsd > 0 ? `$${log.estimatedCostUsd.toFixed(5)}` : '$0';
  const trigger = log.triggerType.replace('_', ' ');

  return (
    <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {/* Trigger badge */}
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
          background: (TRIGGER_COLOR[log.triggerType] ?? '#6B7280') + '22',
          color: TRIGGER_COLOR[log.triggerType] ?? '#6B7280',
        }}>
          {trigger}
        </span>

        {/* Status */}
        <span style={{ color: STATUS_COLOR[log.deliveryStatus] ?? '#9CA3AF', fontSize: 12 }}>
          {log.deliveryStatus}
        </span>

        {/* Fallback level */}
        {log.llmFallbackLevel > 1 && (
          <span style={{ fontSize: 11, color: '#F59E0B' }}>L{log.llmFallbackLevel}</span>
        )}

        <span style={{ flex: 1 }} />

        {/* Metrics */}
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{log.latencyMs}ms</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{log.totalTokens} tok</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{costStr}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{time}</span>
        <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 14px 12px', fontSize: 12 }}>
          <div className="debug-metric">
            <span className="label">Trace ID</span>
            <span className="value" style={{ fontFamily: 'monospace', fontSize: 10 }}>{log.traceId}</span>
          </div>
          <div className="debug-metric">
            <span className="label">Iterations</span>
            <span className="value">{log.iterations}</span>
          </div>
          {log.toolsCalled.length > 0 && (
            <div className="debug-metric">
              <span className="label">Tools</span>
              <span className="value">{log.toolsCalled.join(' → ')}</span>
            </div>
          )}
          <div className="debug-metric">
            <span className="label">Tokens in / out</span>
            <span className="value">{log.totalTokens}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentLogsPanel({ userId }: Props) {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentLogs(userId, 30).then(l => { setLogs(l); setLoading(false); });
  }, [userId]);

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Loading logs...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <h3>No agent logs</h3>
        <p>Agent invocations will appear here once Waldo starts running Morning Wags and Fetch Alerts.</p>
      </div>
    );
  }

  const totalCost = logs.reduce((s, l) => s + l.estimatedCostUsd, 0);
  const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
  const avgLatency = Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length);
  const templateRate = Math.round(logs.filter(l => l.llmFallbackLevel > 1).length / logs.length * 100);

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 0 16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Invocations', value: logs.length },
          { label: 'Total tokens', value: totalTokens.toLocaleString() },
          { label: 'Total cost', value: `$${totalCost.toFixed(4)}` },
          { label: 'Avg latency', value: `${avgLatency}ms` },
          { label: 'Template rate', value: `${templateRate}%` },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 14px', fontSize: 12,
          }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Log rows */}
      <div>
        {logs.map(l => <LogRow key={l.id} log={l} />)}
      </div>
    </div>
  );
}

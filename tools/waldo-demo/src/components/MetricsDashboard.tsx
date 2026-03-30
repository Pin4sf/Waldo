/**
 * Full metrics dashboard — shows ALL computed metrics, not just CRS.
 * Organized by dimension: Body, Schedule, Communication, Tasks, Combined.
 */
import type { DayResponse } from '../types.js';

interface Props {
  data: DayResponse;
}

function MetricCard({ label, value, sub, color, size }: {
  label: string; value: string | number; sub?: string; color?: string; size?: 'lg' | 'sm';
}) {
  return (
    <div style={{
      padding: size === 'lg' ? 16 : 12,
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{
        fontSize: size === 'lg' ? 28 : 20,
        fontWeight: 700, fontFamily: 'var(--font-headline)',
        color: color ?? 'var(--text)', lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function BarMeter({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 80, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <span style={{ width: 30, textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(value)}</span>
    </div>
  );
}

function crsColor(score: number): string {
  if (score >= 80) return '#065F46';
  if (score >= 50) return '#92400E';
  return '#991B1B';
}

function loadColor(score: number): string {
  if (score >= 75) return '#991B1B';
  if (score >= 50) return '#92400E';
  if (score >= 25) return '#1A1A1A';
  return '#065F46';
}

export function MetricsDashboard({ data }: Props) {
  const crs = data.crs;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-label">Full metrics dashboard</div>

      {/* Row 1: The big three — CRS, Cognitive Load, Resilience */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <MetricCard
          label="Nap Score"
          value={crs.score >= 0 ? crs.score : '—'}
          sub={crs.score >= 0 ? crs.zone : 'insufficient data'}
          color={crs.score >= 0 ? crsColor(crs.score) : 'var(--text-dim)'}
          size="lg"
        />
        <MetricCard
          label="Cognitive load"
          value={data.cognitiveLoad ? `${data.cognitiveLoad.score}` : '—'}
          sub={data.cognitiveLoad?.level ?? 'no data'}
          color={data.cognitiveLoad ? loadColor(data.cognitiveLoad.score) : 'var(--text-dim)'}
          size="lg"
        />
        <MetricCard
          label="Resilience"
          value={data.resilience ? `${data.resilience.score}` : '—'}
          sub={data.resilience?.level ?? 'building'}
          color={data.resilience ? (data.resilience.score >= 60 ? '#065F46' : data.resilience.score >= 40 ? '#92400E' : '#991B1B') : 'var(--text-dim)'}
          size="lg"
        />
      </div>

      {/* Row 2: Body metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <MetricCard label="Day strain" value={data.strain ? `${data.strain.score}/21` : '—'} sub={data.strain?.level} />
        <MetricCard label="Sleep debt" value={data.sleepDebt ? `${data.sleepDebt.debtHours}h` : '—'} sub={data.sleepDebt?.direction}
          color={data.sleepDebt && data.sleepDebt.debtHours > 3 ? '#991B1B' : undefined} />
        <MetricCard label="Resting HR" value={data.restingHR ? `${data.restingHR}` : '—'} sub="bpm" />
        <MetricCard label="Steps" value={data.activity.steps > 0 ? data.activity.steps.toLocaleString() : '—'} />
      </div>

      {/* Row 3: CRS component breakdown */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          CRS components
        </div>
        <BarMeter value={crs.sleep.score} max={100} color="#6EE7B7" label="Sleep 35%" />
        <BarMeter value={crs.hrv.score} max={100} color="#93C5FD" label="HRV 25%" />
        <BarMeter value={crs.circadian.score} max={100} color="#C4B5FD" label="Circadian 25%" />
        <BarMeter value={crs.activity.score} max={100} color="#FCD34D" label="Activity 15%" />
      </div>

      {/* Row 4: Cognitive Load breakdown */}
      {data.cognitiveLoad && data.cognitiveLoad.score > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Cognitive load breakdown
          </div>
          <BarMeter value={data.cognitiveLoad.components.sleepDebtImpact} max={100} color="#F87171" label="Sleep debt" />
          <BarMeter value={data.cognitiveLoad.components.meetingLoad} max={100} color="#FBBF24" label="Meetings" />
          <BarMeter value={data.cognitiveLoad.components.communicationLoad} max={100} color="#93C5FD" label="Email" />
          <BarMeter value={data.cognitiveLoad.components.taskLoad} max={100} color="#C4B5FD" label="Tasks" />
        </div>
      )}

      {/* Row 5: Schedule + Communication */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {data.calendar && (
          <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Schedule</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>MLS</span>
                <span style={{ fontWeight: 600 }}>{data.calendar.meetingLoadScore}/15</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Meetings</span>
                <span>{data.calendar.eventCount} ({data.calendar.totalMeetingMinutes}min)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Back-to-back</span>
                <span>{data.calendar.backToBackCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Focus gaps</span>
                <span>{data.calendar.focusGaps?.length ?? 0}</span>
              </div>
            </div>
          </div>
        )}
        {data.email && (
          <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Communication</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Emails</span>
                <span style={{ fontWeight: 600 }}>{data.email.totalEmails}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sent / received</span>
                <span>{data.email.sentCount} / {data.email.receivedCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>After-hours</span>
                <span style={{ color: data.email.afterHoursRatio > 0.3 ? '#991B1B' : 'var(--text)' }}>
                  {Math.round(data.email.afterHoursRatio * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Volume</span>
                <span>{data.email.volumeSpike.toFixed(1)}x normal</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 6: Tasks */}
      {data.tasks && (
        <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tasks</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <div><span style={{ fontWeight: 700, fontSize: 18 }}>{data.tasks.pendingCount}</span> <span style={{ color: 'var(--text-muted)' }}>pending</span></div>
            <div><span style={{ fontWeight: 700, fontSize: 18, color: data.tasks.overdueCount > 5 ? '#991B1B' : 'var(--text)' }}>{data.tasks.overdueCount}</span> <span style={{ color: 'var(--text-muted)' }}>overdue</span></div>
            <div><span style={{ fontWeight: 700, fontSize: 18 }}>{data.tasks.recentVelocity.toFixed(1)}</span> <span style={{ color: 'var(--text-muted)' }}>tasks/day</span></div>
            <div><span style={{ fontWeight: 700, fontSize: 18 }}>{data.tasks.completionRate}%</span> <span style={{ color: 'var(--text-muted)' }}>done</span></div>
          </div>
        </div>
      )}

      {/* Row 7: Burnout trajectory */}
      {data.burnoutTrajectory && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 12,
          background: data.burnoutTrajectory.status === 'burnout_trajectory' ? '#FEE2E2'
            : data.burnoutTrajectory.status === 'warning' ? '#FEF3C7'
            : 'var(--bg-surface)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Burnout trajectory (30-day)
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: data.burnoutTrajectory.status === 'burnout_trajectory' ? '#991B1B' : data.burnoutTrajectory.status === 'warning' ? '#92400E' : 'var(--text)' }}>
            {data.burnoutTrajectory.status.replace('_', ' ')}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>HRV: {data.burnoutTrajectory.components.hrvSlope > 0 ? 'declining' : 'improving'}</span>
            <span>Sleep: {data.burnoutTrajectory.components.sleepDebtTrend > 0 ? 'worsening' : 'improving'}</span>
            <span>After-hours: {data.burnoutTrajectory.components.afterHoursTrend > 0 ? 'increasing' : 'decreasing'}</span>
            <span>Meetings: {data.burnoutTrajectory.components.mlsTrend > 0 ? 'growing' : 'stable'}</span>
          </div>
        </div>
      )}

      {/* Row 8: Cross-source insights */}
      {data.crossSourceInsights && data.crossSourceInsights.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Cross-source intelligence
          </div>
          {data.crossSourceInsights.map((ins, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4, padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 6, borderLeft: `3px solid ${ins.confidence === 'high' ? '#34D399' : '#FBBF24'}` }}>
              {ins.summary}
              <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 6 }}>{ins.confidence} · {ins.evidenceCount} data points</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

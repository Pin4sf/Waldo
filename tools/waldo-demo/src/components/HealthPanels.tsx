import type { DayResponse } from '../types.js';

interface Props {
  data: DayResponse;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const STRAIN_COLORS: Record<string, string> = {
  rest: 'var(--text-dim)',
  low: '#93C5FD',
  medium: '#FBBF24',
  high: '#F97316',
  overreaching: '#EF4444',
};

export function HealthPanels({ data }: Props) {
  return (
    <>
      {/* Sleep Debt + Strain row */}
      {(data.sleepDebt || data.strain) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {data.sleepDebt && data.sleepDebt.debtHours > 0 && (
            <div className="card" style={{ margin: 0, padding: 16 }}>
              <div className="card-label">Sleep debt</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-headline)', color: data.sleepDebt.debtHours > 3 ? 'var(--low-text)' : data.sleepDebt.debtHours > 1 ? 'var(--moderate-text)' : 'var(--text)' }}>
                {data.sleepDebt.debtHours}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                {data.sleepDebt.direction === 'accumulating' ? '↑ accumulating' : data.sleepDebt.direction === 'paying_off' ? '↓ paying off' : '— stable'}
                {' · '}{data.sleepDebt.shortNights} short nights
              </div>
            </div>
          )}
          {data.strain && data.strain.score > 0 && (
            <div className="card" style={{ margin: 0, padding: 16 }}>
              <div className="card-label">Day strain</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-headline)', color: STRAIN_COLORS[data.strain.level] ?? 'var(--text)' }}>
                {data.strain.score}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-dim)' }}>/21</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                {data.strain.level} · peak {data.strain.peakHR} bpm · {data.strain.totalActiveMinutes}min active
              </div>
              {/* Zone bar */}
              <div style={{ display: 'flex', gap: 2, marginTop: 8, height: 4, borderRadius: 2, overflow: 'hidden' }}>
                {data.strain.zoneMinutes.map((min, i) => {
                  const colors = ['#93C5FD', '#6EE7B7', '#FBBF24', '#F97316', '#EF4444'];
                  return min > 0 ? <div key={i} style={{ flex: min, background: colors[i], borderRadius: 2 }} title={`${data.strain!.zoneNames[i]}: ${min}min`} /> : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AQI */}
      {data.aqi !== null && (
        <div className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Air quality</span>
            <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: data.aqi > 150 ? 'var(--low-text)' : data.aqi > 100 ? 'var(--moderate-text)' : 'var(--peak-text)' }}>
              AQI {data.aqi}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.aqiLabel}{data.pm25 ? ` · PM2.5: ${data.pm25}` : ''}</span>
        </div>
      )}

      {/* Sleep */}
      {data.sleep && (
        <div className="card stagger-2">
          <div className="card-label">Sleep</div>
          <div className="metric-row">
            <span className="label">Duration</span>
            <span className="value">{data.sleep.durationHours}h</span>
          </div>
          <div className="metric-row">
            <span className="label">Efficiency</span>
            <span className="value">{data.sleep.efficiency}%</span>
          </div>
          <div className="metric-row">
            <span className="label">Deep / REM</span>
            <span className="value">{data.sleep.deepPercent}% / {data.sleep.remPercent}%</span>
          </div>
          <hr className="metric-divider" />
          <div className="metric-row">
            <span className="label">Bedtime</span>
            <span className="value">{formatTime(data.sleep.bedtime)}</span>
          </div>
          <div className="metric-row">
            <span className="label">Wake</span>
            <span className="value">{formatTime(data.sleep.wakeTime)}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {(['core', 'deep', 'rem', 'awake'] as const).map(stage => {
              const stages = data.sleep!.stages;
              const total = (stages?.core ?? 0) + (stages?.deep ?? 0) + (stages?.rem ?? 0) + (stages?.awake ?? 0);
              const stageVal = stages?.[stage] ?? 0;
              const pct = total > 0 ? (stageVal / total) * 100 : 0;
              const colors: Record<string, string> = { core: '#93C5FD', deep: '#6366F1', rem: '#A78BFA', awake: '#FCA5A5' };
              return (
                <div
                  key={stage}
                  title={`${stage}: ${stageVal}min`}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    flex: pct,
                    background: colors[stage],
                    minWidth: pct > 0 ? 4 : 0,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>Core {data.sleep.stages?.core ?? 0}m</span>
            <span>Deep {data.sleep.stages?.deep ?? 0}m</span>
            <span>REM {data.sleep.stages?.rem ?? 0}m</span>
            <span>Awake {data.sleep.stages?.awake ?? 0}m</span>
          </div>
        </div>
      )}

      {/* HRV */}
      {data.hrv && (
        <div className="card stagger-3">
          <div className="card-label">HRV</div>
          <div className="metric-row">
            <span className="label">Average</span>
            <span className="value">{data.hrv.avg.toFixed(1)} ms</span>
          </div>
          <div className="metric-row">
            <span className="label">Range</span>
            <span className="value">{data.hrv.min.toFixed(1)} – {data.hrv.max.toFixed(1)} ms</span>
          </div>
          <div className="metric-row">
            <span className="label">Readings</span>
            <span className="value">{data.hrv.count}</span>
          </div>
          {data.restingHR && (
            <>
              <hr className="metric-divider" />
              <div className="metric-row">
                <span className="label">Resting HR</span>
                <span className="value">{data.restingHR} bpm</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Activity */}
      <div className="card stagger-4">
        <div className="card-label">Activity</div>
        <div className="metric-row">
          <span className="label">Steps</span>
          <span className="value">{data.activity.steps.toLocaleString()}</span>
        </div>
        <div className="metric-row">
          <span className="label">Exercise</span>
          <span className="value">{data.activity.exerciseMinutes} min</span>
        </div>
        {data.activity.workouts.length > 0 && (
          <div className="metric-row">
            <span className="label">Workouts</span>
            <span className="value">{data.activity.workouts.join(', ')}</span>
          </div>
        )}
        <div className="metric-row">
          <span className="label">Stand hours</span>
          <span className="value">{data.activity.standHours}</span>
        </div>
        <div className="metric-row">
          <span className="label">Active energy</span>
          <span className="value">{data.activity.activeEnergy} kcal</span>
        </div>
      </div>

      {/* Environment */}
      {(data.weather || data.avgNoiseDb || (data.daylightMinutes != null && data.daylightMinutes > 0) || data.wristTemp) && (
        <div className="card stagger-5">
          <div className="card-label">Environment</div>
          {data.weather && (
            <div className="metric-row">
              <span className="label">Weather</span>
              <span className="value">
                {Math.round((data.weather.temperatureF - 32) * 5 / 9)}°C
                {data.weather.humidity > 0 ? `, ${Math.round(data.weather.humidity)}% humidity` : ''}
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
                  ({data.weather.source === 'workout' ? 'from workout' : 'Open-Meteo'})
                </span>
              </span>
            </div>
          )}
          {data.avgNoiseDb !== null && (
            <div className="metric-row">
              <span className="label">Avg noise</span>
              <span className="value">{data.avgNoiseDb.toFixed(0)} dB</span>
            </div>
          )}
          {data.daylightMinutes != null && data.daylightMinutes > 0 && (
            <div className="metric-row">
              <span className="label">Daylight</span>
              <span className="value">{data.daylightMinutes} min</span>
            </div>
          )}
          {data.wristTemp !== null && (
            <div className="metric-row">
              <span className="label">Wrist temp (sleep)</span>
              <span className="value">{data.wristTemp.toFixed(1)}°C</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

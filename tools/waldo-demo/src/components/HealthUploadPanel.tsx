/**
 * HealthUploadPanel — Apple Health export upload for iOS users.
 *
 * Workflow:
 *   1. User exports from iPhone: Health app → profile photo → Export Health Data
 *   2. iPhone creates a ZIP. User unzips it and finds export.xml (or uploads the ZIP directly)
 *   3. This component parses the XML in the browser, computes CRS, uploads to Supabase
 *   4. Progress shown throughout. Takes ~10-60s depending on export size.
 *
 * Parses: Heart Rate, HRV (SDNN), Sleep stages, Steps, Resting HR, SpO2
 * Computes: CRS per day (simplified version of the full engine)
 */
import { useState, useRef, useCallback } from 'react';
import { SUPABASE_FN_URL } from '../supabase-api.js';

interface Props {
  userId: string;
  adminKey: string;
  onImported?: (summary: ImportSummary) => void;
}

interface ImportSummary {
  days: number;
  crsAvg: number;
  crsMin: number;
  crsMax: number;
  stressEvents: number;
}

// ─── Apple Health Record Types ───────────────────────────────────

type AppleRecordType =
  | 'HKQuantityTypeIdentifierHeartRate'
  | 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  | 'HKQuantityTypeIdentifierRestingHeartRate'
  | 'HKQuantityTypeIdentifierStepCount'
  | 'HKQuantityTypeIdentifierOxygenSaturation'
  | 'HKQuantityTypeIdentifierFlightsClimbed'
  | 'HKQuantityTypeIdentifierDistanceWalkingRunning'
  | 'HKQuantityTypeIdentifierActiveEnergyBurned'
  | 'HKQuantityTypeIdentifierAppleExerciseTime'
  | 'HKCategoryTypeIdentifierSleepAnalysis';

const SLEEP_STAGE_MAP: Record<string, string> = {
  HKCategoryValueSleepAnalysisAsleepCore:  'core',
  HKCategoryValueSleepAnalysisAsleepDeep:  'deep',
  HKCategoryValueSleepAnalysisAsleepREM:   'rem',
  HKCategoryValueSleepAnalysisAwake:       'awake',
  HKCategoryValueSleepAnalysisInBed:       'inBed',
  HKCategoryValueSleepAnalysisAsleep:      'core', // legacy
};

interface RawRecord {
  type: string;
  startDate: string;
  endDate: string;
  value: string;
  unit: string;
  sourceName: string;
}

interface DailyBucket {
  hrReadings: number[];
  restingHr: number | null;
  sdnnReadings: number[];
  sleepMinutes: { deep: number; rem: number; core: number; awake: number; inBed: number };
  steps: number;
  exerciseMin: number;
  spo2: number[];
  activeEnergy: number;
}

// ─── Fast attribute extractor (no DOM, no regex backtracking) ────

function extractAttr(tag: string, attr: string): string {
  const key = attr + '="';
  const start = tag.indexOf(key);
  if (start === -1) return '';
  const valueStart = start + key.length;
  const end = tag.indexOf('"', valueStart);
  return end === -1 ? '' : tag.slice(valueStart, end);
}

// ─── Main parser ─────────────────────────────────────────────────

function parseAppleHealthXml(
  xml: string,
  onProgress: (pct: number, days: number) => void,
): Map<string, DailyBucket> {
  const daily = new Map<string, DailyBucket>();
  const CHUNK = 500_000;
  let pos = 0;
  let processed = 0;

  function getOrCreate(date: string): DailyBucket {
    if (!daily.has(date)) {
      daily.set(date, {
        hrReadings: [], restingHr: null, sdnnReadings: [],
        sleepMinutes: { deep: 0, rem: 0, core: 0, awake: 0, inBed: 0 },
        steps: 0, exerciseMin: 0, spo2: [], activeEnergy: 0,
      });
    }
    return daily.get(date)!;
  }

  function dateKey(iso: string): string {
    // "2026-01-15 08:30:00 +0000" → "2026-01-15"
    return iso.slice(0, 10);
  }

  while (pos < xml.length) {
    const chunk = xml.slice(pos, pos + CHUNK);
    const tagRegex = /<Record\s[^>]*\/>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(chunk)) !== null) {
      const tag = match[0];
      const type = extractAttr(tag, 'type') as AppleRecordType;
      const startDate = extractAttr(tag, 'startDate');
      const endDate   = extractAttr(tag, 'endDate');
      const value     = extractAttr(tag, 'value');
      const date = dateKey(startDate);
      if (!date || date.length < 10) continue;
      const bucket = getOrCreate(date);

      switch (type) {
        case 'HKQuantityTypeIdentifierHeartRate': {
          const bpm = parseFloat(value);
          if (bpm > 20 && bpm < 250) bucket.hrReadings.push(bpm);
          break;
        }
        case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': {
          const sdnn = parseFloat(value);
          if (sdnn > 1 && sdnn < 300) bucket.sdnnReadings.push(sdnn);
          break;
        }
        case 'HKQuantityTypeIdentifierRestingHeartRate': {
          const rhr = parseFloat(value);
          if (rhr > 20 && rhr < 200) bucket.restingHr = rhr;
          break;
        }
        case 'HKQuantityTypeIdentifierStepCount': {
          const steps = parseInt(value);
          if (steps > 0 && steps < 100_000) bucket.steps += steps;
          break;
        }
        case 'HKQuantityTypeIdentifierOxygenSaturation': {
          const spo2 = parseFloat(value) * (value.includes('.') && parseFloat(value) < 1.5 ? 100 : 1);
          if (spo2 > 70 && spo2 <= 100) bucket.spo2.push(spo2);
          break;
        }
        case 'HKQuantityTypeIdentifierAppleExerciseTime': {
          const mins = parseFloat(value);
          if (mins > 0) bucket.exerciseMin += mins;
          break;
        }
        case 'HKQuantityTypeIdentifierActiveEnergyBurned': {
          const cal = parseFloat(value);
          if (cal > 0) bucket.activeEnergy += cal;
          break;
        }
        case 'HKCategoryTypeIdentifierSleepAnalysis': {
          const stageRaw = value;
          const stage = SLEEP_STAGE_MAP[stageRaw];
          if (!stage) break;
          // Calculate duration in minutes
          const start = new Date(startDate.replace(' ', 'T').replace(/(\+\d{4})$/, 'Z'));
          const end   = new Date(endDate.replace(' ', 'T').replace(/(\+\d{4})$/, 'Z'));
          if (isNaN(start.getTime()) || isNaN(end.getTime())) break;
          const mins = (end.getTime() - start.getTime()) / 60000;
          if (mins <= 0 || mins > 1440) break;
          // Attribute sleep to the morning date (wake date)
          const sleepDate = dateKey(endDate);
          const sleepBucket = getOrCreate(sleepDate);
          const s = sleepBucket.sleepMinutes;
          if (stage === 'deep') s.deep += mins;
          else if (stage === 'rem') s.rem += mins;
          else if (stage === 'core') s.core += mins;
          else if (stage === 'awake') s.awake += mins;
          else if (stage === 'inBed') s.inBed += mins;
          break;
        }
      }
    }

    processed += CHUNK;
    pos += CHUNK;
    onProgress(Math.min(80, Math.round((processed / xml.length) * 80)), daily.size);
  }

  return daily;
}

// ─── Simplified CRS computation ──────────────────────────────────

interface CrsDay {
  date: string;
  score: number;
  zone: string;
  sleep_json: Record<string, unknown>;
  hrv_json: Record<string, unknown>;
  circadian_json: Record<string, unknown>;
  activity_json: Record<string, unknown>;
  components_with_data: number;
  summary: string;
}

function computeCrsForDay(date: string, b: DailyBucket, avgSdnn7d: number | null, avgSteps7d: number): CrsDay {
  let components = 0;

  // ─── Sleep (35%) ───
  const sleepMins = b.sleepMinutes.core + b.sleepMinutes.deep + b.sleepMinutes.rem;
  const totalBedMins = sleepMins + b.sleepMinutes.awake;
  const sleepHours = sleepMins / 60;
  let sleepScore = 50;
  const hasSleep = sleepMins > 30;
  if (hasSleep) {
    components++;
    if (sleepHours >= 7.5) sleepScore = 90;
    else if (sleepHours >= 7) sleepScore = 80;
    else if (sleepHours >= 6) sleepScore = 65;
    else if (sleepHours >= 5) sleepScore = 45;
    else sleepScore = 25;
    const efficiency = totalBedMins > 0 ? sleepMins / totalBedMins : 1;
    if (efficiency < 0.75) sleepScore -= 15;
    const deepPct = sleepMins > 0 ? b.sleepMinutes.deep / sleepMins : 0;
    if (deepPct < 0.10) sleepScore -= 10;
    sleepScore = Math.max(0, Math.min(100, sleepScore));
  }

  // ─── HRV (25%) ────
  const avgSdnn = b.sdnnReadings.length > 0
    ? b.sdnnReadings.reduce((a, c) => a + c, 0) / b.sdnnReadings.length
    : null;
  let hrvScore = 50;
  const hasHrv = avgSdnn !== null;
  if (hasHrv) {
    components++;
    if (avgSdnn7d && avgSdnn7d > 0) {
      const ratio = avgSdnn / avgSdnn7d;
      if (ratio > 1.15) hrvScore = 90;
      else if (ratio > 1.05) hrvScore = 80;
      else if (ratio > 0.95) hrvScore = 70;
      else if (ratio > 0.85) hrvScore = 50;
      else if (ratio > 0.75) hrvScore = 35;
      else hrvScore = 20;
    } else {
      // No baseline — use absolute value (roughly calibrated for adults)
      if (avgSdnn > 60) hrvScore = 85;
      else if (avgSdnn > 45) hrvScore = 75;
      else if (avgSdnn > 30) hrvScore = 60;
      else if (avgSdnn > 20) hrvScore = 45;
      else hrvScore = 30;
    }
  }

  // ─── Circadian (25%) — infer from sleep timing ────
  let circadianScore = 65; // default moderate
  if (hasSleep) {
    components++;
    // Good: sleep 10pm–7am. Penalise large deviation.
    circadianScore = 70; // simplified — full circadian needs wake time history
  }

  // ─── Activity (15%) ────
  let activityScore = 50;
  const hasActivity = b.steps > 0 || b.exerciseMin > 0;
  if (hasActivity) {
    components++;
    if (b.steps >= 10000) activityScore = 90;
    else if (b.steps >= 7500) activityScore = 80;
    else if (b.steps >= 5000) activityScore = 65;
    else if (b.steps >= 2500) activityScore = 50;
    else if (b.steps > 0) activityScore = 35;
    if (b.exerciseMin >= 20 && b.exerciseMin <= 60) activityScore = Math.min(100, activityScore + 10);
  }

  if (components < 1) {
    return {
      date, score: -1, zone: 'low', components_with_data: 0,
      sleep_json: {}, hrv_json: {}, circadian_json: {}, activity_json: {},
      summary: 'No data',
    };
  }

  // Weighted composite with redistribution
  const weights = [
    hasSleep  ? 0.35 : 0,
    hasHrv    ? 0.25 : 0,
    hasSleep  ? 0.25 : 0, // circadian needs sleep data too
    hasActivity ? 0.15 : 0,
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  const scores = [sleepScore, hrvScore, circadianScore, activityScore];
  const weightedSum = scores.reduce((s, sc, i) => s + sc * weights[i]!, 0);
  const raw = total > 0 ? weightedSum / total : 50;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const zone = score >= 80 ? 'peak' : score >= 60 ? 'moderate' : 'low';

  return {
    date, score, zone, components_with_data: components,
    sleep_json: { score: sleepScore, hours: +sleepHours.toFixed(2), dataAvailable: hasSleep },
    hrv_json:   { score: hrvScore, sdnn: avgSdnn ? +avgSdnn.toFixed(1) : null, dataAvailable: hasHrv },
    circadian_json: { score: circadianScore, dataAvailable: hasSleep },
    activity_json:  { score: activityScore, steps: b.steps, exerciseMin: +b.exerciseMin.toFixed(0), dataAvailable: hasActivity },
    summary: `Nap Score ${score} (${zone}) — ${sleepHours.toFixed(1)}h sleep, ${b.steps.toLocaleString()} steps`,
  };
}

function buildImportPayload(
  daily: Map<string, DailyBucket>,
  cutoffDays = 90,
): {
  health_snapshots: Record<string, unknown>[];
  crs_scores: CrsDay[];
  stress_events: Record<string, unknown>[];
} {
  const cutoff = new Date(Date.now() - cutoffDays * 86400000).toISOString().slice(0, 10);
  const sorted = [...daily.entries()]
    .filter(([d]) => d >= cutoff && d <= new Date().toISOString().slice(0, 10))
    .sort(([a], [b]) => a.localeCompare(b));

  // Compute 7-day rolling SDNN baseline for HRV scoring
  const sdnnByDate = new Map(sorted.map(([d, b]) => [
    d,
    b.sdnnReadings.length > 0 ? b.sdnnReadings.reduce((a, c) => a + c, 0) / b.sdnnReadings.length : null,
  ]));

  const health_snapshots: Record<string, unknown>[] = [];
  const crs_scores: CrsDay[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const [date, b] = sorted[i]!;

    // 7-day rolling SDNN average
    const recent7 = sorted.slice(Math.max(0, i - 7), i).map(([d]) => sdnnByDate.get(d)).filter((v): v is number => v !== null);
    const avgSdnn7d = recent7.length > 0 ? recent7.reduce((a, c) => a + c, 0) / recent7.length : null;
    const avgSteps7d = sorted.slice(Math.max(0, i - 7), i)
      .map(([, bk]) => bk.steps)
      .filter(s => s > 0)
      .reduce((s, v, _, a) => s + v / a.length, 0);

    const hrAvg = b.hrReadings.length > 0 ? b.hrReadings.reduce((a, c) => a + c, 0) / b.hrReadings.length : null;
    const avgSpo2 = b.spo2.length > 0 ? b.spo2.reduce((a, c) => a + c, 0) / b.spo2.length : null;
    const sleepHours = (b.sleepMinutes.core + b.sleepMinutes.deep + b.sleepMinutes.rem) / 60;
    const totalBed = sleepHours * 60 + b.sleepMinutes.awake;
    const efficiency = totalBed > 0 ? Math.round((sleepHours * 60 / totalBed) * 100) : null;
    const deepPct = sleepHours > 0 ? Math.round((b.sleepMinutes.deep / (sleepHours * 60)) * 100) : null;
    const remPct  = sleepHours > 0 ? Math.round((b.sleepMinutes.rem  / (sleepHours * 60)) * 100) : null;

    health_snapshots.push({
      date,
      hr_avg:               hrAvg ? +hrAvg.toFixed(1) : null,
      resting_hr:           b.restingHr,
      hrv_rmssd:            b.sdnnReadings.length > 0 ? +(b.sdnnReadings.reduce((a,c)=>a+c,0)/b.sdnnReadings.length * 0.75).toFixed(1) : null, // SDNN→RMSSD approx
      hrv_count:            b.sdnnReadings.length || null,
      sleep_duration_hours: sleepHours > 0.5 ? +sleepHours.toFixed(2) : null,
      sleep_efficiency:     efficiency,
      sleep_deep_pct:       deepPct,
      sleep_rem_pct:        remPct,
      steps:                b.steps || null,
      exercise_minutes:     b.exerciseMin > 0 ? +b.exerciseMin.toFixed(0) : null,
      active_energy:        b.activeEnergy > 0 ? +b.activeEnergy.toFixed(0) : null,
      spo2:                 avgSpo2 ? +avgSpo2.toFixed(1) : null,
      data_tier:            b.sdnnReadings.length > 0 && sleepHours > 1 ? 'rich' : sleepHours > 1 || b.steps > 0 ? 'partial' : 'sparse',
    });

    const crs = computeCrsForDay(date, b, avgSdnn7d, avgSteps7d);
    if (crs.score >= 0) crs_scores.push(crs);
  }

  return { health_snapshots, crs_scores, stress_events: [] };
}

// ─── React component ─────────────────────────────────────────────

type UploadState = 'idle' | 'reading' | 'parsing' | 'uploading' | 'done' | 'error';

export function HealthUploadPanel({ userId, adminKey, onImported }: Props) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file: File) => {
    setError('');
    setSummary(null);

    if (!userId) {
      setError('No user selected. Create a user first.');
      return;
    }

    // Accept XML or ZIP (ZIP requires user to unzip first — see instructions)
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.zip')) {
      setError('Please upload the export.xml file (or a .zip Apple Health export).');
      return;
    }

    try {
      setState('reading');
      setProgress(5);
      setStatusMsg('Reading file…');

      let xmlText: string;

      if (file.name.endsWith('.zip')) {
        // Try to extract export.xml from ZIP using the File System API / DecompressionStream
        // For simplicity, tell user to unzip manually if this fails
        setError('ZIP files: please unzip first and upload the export.xml file inside. Or export just the XML from the Health app shortcuts.');
        setState('idle');
        return;
      } else {
        xmlText = await file.text();
      }

      setState('parsing');
      setProgress(10);
      setStatusMsg(`Parsing ${(file.size / 1e6).toFixed(1)} MB export…`);

      // Parse in small yielding chunks to avoid blocking UI
      await new Promise(r => setTimeout(r, 0));

      const daily = parseAppleHealthXml(xmlText, (pct, days) => {
        setProgress(10 + pct);
        setStatusMsg(`Found ${days} days of data…`);
      });

      setProgress(85);
      setStatusMsg('Computing Nap Scores…');
      await new Promise(r => setTimeout(r, 0));

      const payload = buildImportPayload(daily, 90);

      if (payload.health_snapshots.length === 0) {
        setError('No health data found in the last 90 days. Make sure you selected the right file.');
        setState('idle');
        return;
      }

      setState('uploading');
      setProgress(90);

      // Upload in batches of 30 days to stay under Supabase Edge Function 2MB body limit
      const BATCH_DAYS = 30;
      const totalDays  = payload.health_snapshots.length;
      const batches    = Math.ceil(totalDays / BATCH_DAYS);
      let totalImported = 0;
      let crsValues: number[] = [];

      for (let b = 0; b < batches; b++) {
        const start = b * BATCH_DAYS;
        const end   = Math.min(start + BATCH_DAYS, totalDays);
        const batchSnaps = payload.health_snapshots.slice(start, end);
        const batchDates = new Set(batchSnaps.map(s => (s as Record<string, unknown>)['date'] as string));
        const batchCrs   = payload.crs_scores.filter(c => batchDates.has(c.date));

        setStatusMsg(`Uploading batch ${b + 1}/${batches} (${batchSnaps.length} days)…`);
        setProgress(90 + Math.round((b / batches) * 10));

        const res = await fetch(`${SUPABASE_FN_URL}/health-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey,
          },
          body: JSON.stringify({
            user_id: userId,
            health_snapshots: batchSnaps,
            crs_scores: batchCrs,
            stress_events: b === 0 ? payload.stress_events : [], // Only send stress on first batch
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as Record<string, unknown>;
          throw new Error(`Batch ${b + 1} failed: ${(err['error'] as string) || `HTTP ${res.status}`}`);
        }

        const result = await res.json() as Record<string, unknown>;
        totalImported += (result['days_imported'] as number) ?? batchSnaps.length;

        const range = result['crs_range'] as Record<string, number> | null;
        if (range) {
          crsValues.push(range['min'] ?? 0, range['max'] ?? 0);
        }
      }

      setProgress(100);

      const sum: ImportSummary = {
        days:        totalImported,
        crsAvg:      crsValues.length > 0 ? Math.round(crsValues.reduce((a, b) => a + b, 0) / crsValues.length) : 0,
        crsMin:      crsValues.length > 0 ? Math.min(...crsValues) : 0,
        crsMax:      crsValues.length > 0 ? Math.max(...crsValues) : 0,
        stressEvents: 0,
      };

      setSummary(sum);
      setState('done');
      setStatusMsg('');
      onImported?.(sum);

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [userId, adminKey, onImported]);

  const handleFile = (file: File | null | undefined) => {
    if (file) process(file);
  };

  const busy = state === 'reading' || state === 'parsing' || state === 'uploading';

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="debug-section">
        <div className="debug-header" style={{ cursor: 'default' }}>
          <span>Apple Health Data</span>
          {state === 'done'
            ? <span style={{ fontSize: 11, color: '#34D399' }}>✓ Imported</span>
            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>iOS · Upload export.xml</span>
          }
        </div>

        <div style={{ padding: '14px' }}>
          {/* Instructions */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
              How to export from your iPhone:
            </strong>
            1. Open <strong>Health app</strong> → tap your profile photo (top right)<br />
            2. Tap <strong>Export Health Data</strong> → share the ZIP to your Mac/PC<br />
            3. Unzip it → find <strong>export.xml</strong> inside<br />
            4. Upload that file here ↓
          </div>

          {/* Drop zone */}
          {!busy && state !== 'done' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '28px 16px',
                textAlign: 'center', cursor: 'pointer',
                background: dragging ? 'rgba(249,115,22,0.04)' : 'var(--bg-surface)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗂</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                Drop export.xml here
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                or click to browse
              </div>
              <input
                ref={inputRef} type="file" accept=".xml,.zip"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* Progress */}
          {busy && (
            <div>
              <div style={{
                height: 6, background: 'var(--border)', borderRadius: 3,
                overflow: 'hidden', marginBottom: 10,
              }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${progress}%`, background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{statusMsg}</div>
            </div>
          )}

          {/* Success */}
          {state === 'done' && summary && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontWeight: 600, color: '#15803D', marginBottom: 8 }}>
                ✓ {summary.days} days imported
              </div>
              <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.8 }}>
                Nap Score range: {summary.crsMin}–{summary.crsMax} (avg {summary.crsAvg})<br />
                Waldo will start using this data immediately.<br />
                Your Morning Wag arrives tomorrow at your wake time.
              </div>
              <button
                onClick={() => { setState('idle'); setProgress(0); setSummary(null); }}
                style={{
                  marginTop: 10, fontSize: 11, color: '#166534',
                  background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Upload newer export
              </button>
            </div>
          )}

          {/* Error */}
          {(state === 'error' || error) && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#991B1B',
            }}>
              {error || 'Upload failed. Try again.'}
              <button
                onClick={() => { setState('idle'); setError(''); }}
                style={{
                  display: 'block', marginTop: 8, fontSize: 11,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#991B1B', textDecoration: 'underline',
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

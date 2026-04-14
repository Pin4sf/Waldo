/**
 * DemoPage — Pure showcase dashboard for investor / demo use.
 *
 * Route: /demo (detected via window.location.pathname)
 * All data is synthetic — no Supabase calls, no auth required.
 *
 * Scenario: Tuesday morning, April 8, 2026.
 * Ark is having a peak day — great sleep, strong HRV, moderate load,
 * focus window protected, plan ready to sync, 8/10 signal depth.
 * Everything is at its best to show the full product vision.
 */
import { useState } from 'react';
import { TheBrief } from './components/dashboard/TheBrief.js';
import { ThePatrol } from './components/dashboard/ThePatrol.js';
import { TheHandoff } from './components/dashboard/TheHandoff.js';
import { TheWindowCard } from './components/dashboard/TheWindowCard.js';
import { FormCard } from './components/dashboard/FormCard.js';
import { SleepCard } from './components/dashboard/SleepCard.js';
import { LoadCard } from './components/dashboard/LoadCard.js';
import { HRVCard, CircadianCard, MotionCard, SleepDebtCard, RestingHRCard, SleepScoreCard } from './components/dashboard/Tier2Cards.js';
import { SignalDepthCard } from './components/dashboard/SignalDepthCard.js';
import { TheSlopeCard } from './components/dashboard/TheSlopeCard.js';
import { TodaysBriefCard } from './components/dashboard/TodaysBriefCard.js';
import { BodyReadings } from './components/dashboard/BodyReadings.js';
import type { DayResponse, WaldoActionData, WaldoProposal, TrendData, SyncStatus } from './types.js';
import type { DashboardHistoryContext } from './components/dashboard/history.js';

// ─── Synthetic support data (defined before DayResponse to avoid forward refs) ─

const DEMO_DATE = '2026-04-08';

const DEMO_MORNING_WAG = `You're running well today. Form is at 87 — your best score in two weeks.

Sleep hit 7h 42m last night with a solid deep block early. HRV came up 12% above your 30-day line. The run this morning used the energy without overdrafting — load is in the steady zone.

Your calendar is light until 11. That 90-minute window before Product sync is yours. I've protected it.

Investor prep is at 2pm. You're in good shape for it — better cognitive state than the last three prep sessions. I'll flag if anything changes.

Already on it.`;

const DEMO_PATROL_ACTIONS: WaldoActionData[] = [
  { time: '06:42', action: 'Form computed — 87 (peak)', reason: 'Health data synced, CRS pipeline ran on overnight snapshot.', type: 'proactive' },
  { time: '07:15', action: 'Morning Wag sent to Telegram', reason: 'Scheduled delivery at wake time (6:42 + 33min), peak zone tone applied.', type: 'proactive' },
  { time: '07:17', action: 'Focus window locked — 9:30–11:00am', reason: 'Highest quality gap before Product sync. Chronotype + Form signal used to score.', type: 'proactive' },
  { time: '08:34', action: 'Run logged and load updated', reason: 'Google Fit activity event triggered, Day Strain recalculated to 11.4.', type: 'reactive' },
  { time: '09:05', action: 'Calendar plan generated', reason: 'Investor prep detected at 2pm. Pre-activity Spot queued for 1:30pm delivery.', type: 'proactive' },
  { time: '09:12', action: 'Pattern updated — run→recovery correlation', reason: 'Tuesday run followed by strong HRV. Evidence count now 22. Confidence 91%.', type: 'learning' },
];

// ─── Synthetic DayResponse ────────────────────────────────────────────────────

const DEMO_DATA: DayResponse = {
  date: DEMO_DATE,
  crs: {
    score: 87,
    zone: 'peak',
    confidence: 0.94,
    componentsWithData: 4,
    sleep: { score: 88, factors: ['7h 42m', 'Deep: 19%', 'REM: 23%'], dataAvailable: true },
    hrv: { score: 84, factors: ['42ms avg', '+12% baseline'], dataAvailable: true },
    circadian: { score: 91, factors: ['On-time wake', 'Ideal bedtime'], dataAvailable: true },
    activity: { score: 82, factors: ['8,340 steps', '48 active min'], dataAvailable: true },
    pillars: { recovery: 88, cass: 84, ilas: 90 },
    pillarDrag: { sleep: 5, hrv: 8, circadian: 3, activity: 4, primary: 'hrv' },
    summary: 'Peak day. Your body absorbed last week\'s training load well. HRV is running 12% above your 30-day baseline.',
    pctVsBaseline: 12,
    baseline30d: 78,
  },
  stress: {
    events: [],
    peakConfidence: null,
    peakSeverity: null,
    totalStressMinutes: 0,
    fetchAlertTriggered: false,
  },
  sleep: {
    durationHours: 7.7,
    efficiency: 92,
    deepPercent: 19,
    remPercent: 23,
    stages: { core: 220, deep: 88, rem: 106, awake: 28 },
    bedtime: `${DEMO_DATE}T23:02:00`,
    wakeTime: '2026-04-09T06:42:00',
    minutesVsUsual: 18,
    avgHours7d: 7.4,
  },
  hrv: {
    avg: 42,
    min: 31,
    max: 58,
    count: 14,
    avg30d: 38,
    pctVsBaseline: 12,
    badge: 'strong',
  },
  activity: {
    steps: 8340,
    exerciseMinutes: 48,
    workouts: ['Morning run · 5.2km'],
    standHours: 11,
    activeEnergy: 620,
  },
  restingHR: 52,
  wristTemp: null,
  spO2: null,
  respiratoryRate: 14,
  avgNoiseDb: null,
  daylightMinutes: 74,
  weather: { temperatureF: 68, humidity: 52, source: 'open-meteo' },
  aqi: 28,
  aqiLabel: 'Good',
  pm25: 6.2,
  sleepDebt: {
    debtHours: 0.4,
    direction: 'improving',
    shortNights: 0,
    avgSleepHours: 7.4,
    summary: 'Minimal debt. You\'re absorbing sleep well this week.',
  },
  strain: {
    score: 11.4,
    level: 'Moderate',
    zoneMinutes: [85, 42, 21, 8, 2],
    zoneNames: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'],
    totalActiveMinutes: 158,
    peakHR: 164,
    summary: 'Solid morning run kept load in the steady range. Heart worked but didn\'t overdraft.',
  },
  calendar: {
    meetingLoadScore: 3.2,
    totalMeetingMinutes: 90,
    eventCount: 4,
    backToBackCount: 0,
    boundaryViolations: 0,
    focusGaps: [
      { durationMinutes: 90, quality: 88 },
      { durationMinutes: 45, quality: 62 },
    ],
    events: [
      { summary: 'Product sync', startTime: `${DEMO_DATE}T11:00:00`, durationMinutes: 30, attendeeCount: 4 },
      { summary: 'Investor prep', startTime: `${DEMO_DATE}T14:00:00`, durationMinutes: 60, attendeeCount: 2 },
      { summary: 'Team standup', startTime: `${DEMO_DATE}T17:00:00`, durationMinutes: 15, attendeeCount: 6 },
      { summary: 'Code review', startTime: `${DEMO_DATE}T18:00:00`, durationMinutes: 30, attendeeCount: 1 },
    ],
  },
  tasks: {
    summary: '3 open · 0 overdue. On pace.',
    pendingCount: 3,
    overdueCount: 0,
    recentVelocity: 4.2,
    completionRate: 87,
    urgencyQueue: [
      { title: 'Finalize demo deck', due: '2026-04-08' },
      { title: 'Review eng PRD', due: '2026-04-09' },
    ],
  },
  email: {
    totalEmails: 18,
    sentCount: 6,
    receivedCount: 12,
    afterHoursCount: 0,
    afterHoursRatio: 0,
    uniqueThreads: 9,
    volumeSpike: 0,
  },
  cognitiveLoad: {
    score: 38,
    level: 'Light',
    components: { meetingLoad: 32, communicationLoad: 28, taskLoad: 40, sleepDebtImpact: 5 },
    summary: 'Light day for your brain. This is the day to move hard problems forward.',
  },
  burnoutTrajectory: {
    score: 14,
    status: 'Healthy',
    components: { recoveryBalance: 88, sustainedLoad: 22, sleepConsistency: 91 },
    summary: 'Well under any threshold. The training load is absorbing cleanly.',
  },
  resilience: {
    score: 82,
    level: 'High',
    components: { hrvConsistency: 84, sleepQuality: 88, recoverySpeed: 76 },
    summary: 'Recovering faster than your own baseline. Peak window this week.',
  },
  crossSourceInsights: [
    { type: 'pattern', summary: 'Morning runs are extending your peak cognitive window by ~90 minutes on run days.', confidence: 'high', evidenceCount: 22 },
    { type: 'insight', summary: 'Tuesday investor prep events correlate with +8% HRV the following morning — you absorb high-stakes prep better than you think.', confidence: 'medium', evidenceCount: 11 },
  ],
  patterns: [
    { id: 'p1', type: 'recovery', confidence: 0.91, summary: 'You recover 35% faster after morning runs vs evening sessions.', evidenceCount: 22, firstSeen: '2026-01-10', lastSeen: DEMO_DATE },
    { id: 'p2', type: 'sleep', confidence: 0.88, summary: 'Deep sleep improves by ~12% when you\'re in bed before 11pm two nights in a row.', evidenceCount: 18, firstSeen: '2026-02-03', lastSeen: DEMO_DATE },
  ],
  waldoActions: DEMO_PATROL_ACTIONS,
  dayActivity: {
    date: DEMO_DATE,
    headline: 'Strong start — Form 87, sleep absorbed well, focus window clear.',
    spots: [
      { id: 's1', date: DEMO_DATE, time: '06:42', type: 'health', severity: 'positive', title: 'HRV at 12% above baseline', detail: 'Your HRV woke at 42ms — your 30-day average is 38ms. Clean recovery from yesterday\'s run.', signals: ['hrv', 'sleep'] },
      { id: 's2', date: DEMO_DATE, time: '07:15', type: 'behavior', severity: 'positive', title: 'Morning Wag delivered', detail: 'Waldo sent your morning brief at 7:15am.', signals: ['crs'] },
      { id: 's3', date: DEMO_DATE, time: '08:30', type: 'health', severity: 'positive', title: 'Run logged — 5.2km', detail: 'Morning run added 48 active minutes. Load staying in steady zone.', signals: ['activity', 'strain'] },
    ],
    morningWag: DEMO_MORNING_WAG,
    eveningReview: null,
    fetchAlertFired: false,
    tier: 'rich',
  },
  yesterday: { crs: 79, sleepHours: 7.1, strain: 9.8 },
  baselines: {
    hrv7d: 40,
    hrv30d: 38,
    sleepDuration7d: 7.4,
    bedtime7d: 23 * 60 + 8,
    restingHR7d: 53,
    crs30dAvg: 78,
    chronotype: 'early',
    daysOfData: 84,
  },
};

const DEMO_PROPOSAL: WaldoProposal = {
  id: 'demo-proposal-1',
  type: 'calendar_block',
  title: 'Protect 9:30–11:00am focus window',
  description: 'Your calendar has a clean 90-minute gap before Product sync. Given your Form at 87 and morning run this morning, this is the best cognitive window you\'ll have today. I want to block it so nothing sneaks in.',
  impact: 'Protects ~90min of peak cognitive time. Pre-activity Spot at 1:30pm before investor prep is already queued.',
  status: 'pending',
  expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

const DEMO_TREND_DATA: TrendData = {
  dimensions: [
    { key: 'body', label: 'Body', weekOneValue: 71, weekFourValue: 81, direction: 'improving', unit: 'pts', higherIsBetter: true, available: true },
    { key: 'schedule', label: 'Schedule', weekOneValue: 5.4, weekFourValue: 3.2, direction: 'improving', unit: 'MLS', higherIsBetter: false, available: true },
    { key: 'communication', label: 'Comms', weekOneValue: 28, weekFourValue: 12, direction: 'improving', unit: '%', higherIsBetter: false, available: true },
    { key: 'tasks', label: 'Tasks', weekOneValue: 6, weekFourValue: 1, direction: 'improving', unit: 'overdue', higherIsBetter: false, available: true },
    { key: 'mood', label: 'Mood', weekOneValue: 62, weekFourValue: 74, direction: 'improving', unit: 'score', higherIsBetter: true, available: true },
    { key: 'screen', label: 'Screen', weekOneValue: 51, weekFourValue: 63, direction: 'improving', unit: 'score', higherIsBetter: true, available: false },
  ],
  rangeLabel: '4-week direction',
  daysAnalysed: 28,
  overallDirection: 'improving',
};

const DEMO_HISTORY: DashboardHistoryContext = {
  hrv30d: [34, 36, 33, 38, 35, 40, 37, 39, 36, 38, 41, 37, 38, 40, 39, 42, 38, 41, 40, 43, 38, 42, 41, 39, 42, 40, 38, 41, 42, 42],
  rhr7d: [54, 53, 55, 52, 53, 52, 52],
  sleepDebt7d: [0.8, 0.6, 1.0, 0.7, 0.5, 0.4, 0.4],
  strain7d: [8.2, 12.1, 9.4, 7.8, 11.2, 10.6, 11.4],
  sleepHours7d: [7.1, 7.5, 6.9, 7.3, 7.6, 7.4, 7.7],
  previousEntry: null,
};

const DEMO_SYNC_STATUSES: SyncStatus[] = [
  { provider: 'apple_health', label: 'Apple Health', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 856, lastError: null, tokenExpiry: null },
  { provider: 'google_calendar', label: 'Calendar', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 214, lastError: null, tokenExpiry: null },
  { provider: 'gmail', label: 'Gmail', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 1842, lastError: null, tokenExpiry: null },
  { provider: 'google_tasks', label: 'Tasks', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 87, lastError: null, tokenExpiry: null },
  { provider: 'spotify', label: 'Spotify', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 430, lastError: null, tokenExpiry: null },
  { provider: 'todoist', label: 'Todoist', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 124, lastError: null, tokenExpiry: null },
  { provider: 'strava', label: 'Strava', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 68, lastError: null, tokenExpiry: null },
  { provider: 'telegram', label: 'Telegram', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 312, lastError: null, tokenExpiry: null },
  { provider: 'weather', label: 'Weather + AQI', connected: true, status: 'ok', lastSyncAt: new Date().toISOString(), recordsSynced: 84, lastError: null, tokenExpiry: null },
];

// ─── Demo Page ────────────────────────────────────────────────────────────────

export function DemoPage() {
  const [proposalStatus, setProposalStatus] = useState<'pending' | 'done' | null>('pending');

  const handleApprove = async (_id: string) => {
    await new Promise(r => setTimeout(r, 800));
    setProposalStatus('done');
  };
  const handleReject = async (_id: string) => {
    setProposalStatus(null);
  };

  const currentProposal = proposalStatus === 'pending' ? DEMO_PROPOSAL : null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      {/* ── Demo banner ─────────────────────────────────────────────── */}
      <div style={{
        background: '#1A1A1A', color: '#FAFAF8', padding: '8px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, fontFamily: 'var(--font-body)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
          <span style={{ fontWeight: 600 }}>Waldo · Demo Mode</span>
          <span style={{ color: '#9a9a96' }}>· Tuesday, April 8, 2026 · Ark · Form 87 · All signals live</span>
        </div>
        <a href="/" style={{ color: '#F97316', textDecoration: 'none', fontWeight: 600 }}>Exit demo →</a>
      </div>

      {/* ── 3-column layout ──────────────────────────────────────────── */}
      <div className="dashboard" style={{ height: 'calc(100vh - 34px)' }}>

        {/* ── LEFT: Sidebar ─────────────────────────────────────────── */}
        <div className="dash-sidebar">
          <div className="sidebar-brand">
            <span className="sidebar-logo">Waldo</span>
          </div>
          <nav className="sidebar-nav">
            {[
              { icon: '◉', label: 'Today', active: true },
              { icon: '◎', label: 'The Patrol', active: false },
              { icon: '⬡', label: 'Constellation', active: false },
              { icon: '⊕', label: 'Connectors', active: false },
              { icon: '◈', label: 'Memory', active: false },
            ].map(item => (
              <button
                key={item.label}
                className="sidebar-item"
                style={{
                  color: item.active ? 'var(--text)' : 'var(--text-dim)',
                  background: item.active ? 'var(--bg-surface)' : 'transparent',
                  fontWeight: item.active ? 600 : 400,
                }}
              >
                <span className="sidebar-icon" style={{ fontSize: 14 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User info */}
          <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>A</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ark Patil</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Form 87 · Peak</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTER: Main feed ──────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Date header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, color: 'var(--text)' }}>
              Tuesday, April 8
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Today', '7d', '30d', '3m'].map(r => (
                <button key={r} style={{
                  padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6,
                  background: r === 'Today' ? 'var(--bg-surface)' : 'transparent',
                  color: r === 'Today' ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: 12, fontWeight: r === 'Today' ? 600 : 400, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* TheBrief hero */}
          <TheBrief
            message={DEMO_MORNING_WAG}
            zone="peak"
            timestamp="this morning at 7:15"
          />

          {/* Today's Brief timeline */}
          <TodaysBriefCard
            data={DEMO_DATA}
            morningWag={DEMO_MORNING_WAG}
          />

          {/* The Handoff */}
          <TheHandoff
            proposal={currentProposal}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          {/* The Patrol */}
          <ThePatrol
            actions={DEMO_PATROL_ACTIONS}
            date={DEMO_DATE}
          />

          {/* Chat input (demo placeholder) */}
          <div style={{
            display: 'flex', gap: 10, padding: '12px 16px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 16, alignItems: 'center',
          }}>
            <img src="/watching-light-mode.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
            <input
              style={{
                flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)',
                fontSize: 14, color: 'var(--text)', outline: 'none',
              }}
              placeholder="Ask Waldo anything about your day..."
              readOnly
            />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>demo mode</span>
          </div>
        </div>

        {/* ── RIGHT: Data panel ──────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(26,26,26,0.015)' }}>

          {/* Form card — primary metric */}
          <FormCard data={DEMO_DATA} />

          {/* Sleep */}
          <SleepCard data={DEMO_DATA} history={DEMO_HISTORY} />

          {/* Load */}
          <LoadCard data={DEMO_DATA} history={DEMO_HISTORY} />

          {/* Body readings (resp rate) */}
          <BodyReadings data={DEMO_DATA} />

          {/* Tier 2 cards */}
          <HRVCard data={DEMO_DATA} history={DEMO_HISTORY} />
          <RestingHRCard data={DEMO_DATA} history={DEMO_HISTORY} />
          <SleepScoreCard data={DEMO_DATA} history={DEMO_HISTORY} />
          <SleepDebtCard data={DEMO_DATA} history={DEMO_HISTORY} />
          <CircadianCard data={DEMO_DATA} />
          <MotionCard data={DEMO_DATA} />

          {/* The Window (focus protection) */}
          <TheWindowCard
            data={DEMO_DATA}
            demo={{
              startTime: '9:30am',
              endTime: '11:00am',
              durationMinutes: 90,
              quality: 88,
              protected: true,
              description: 'Your clearest stretch of the day — before Product sync.',
            }}
          />

          {/* 4-week slope */}
          <TheSlopeCard data={DEMO_TREND_DATA} />

          {/* Signal depth */}
          <SignalDepthCard syncStatuses={DEMO_SYNC_STATUSES} />
        </div>
      </div>
    </div>
  );
}

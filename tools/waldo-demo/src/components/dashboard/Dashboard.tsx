/**
 * Dashboard — Main 3-column layout with full historical navigation
 *
 * Left: Sidebar navigation
 * Center: Morning Wag + Intelligence feed (spots, patterns, fetches) + Chat
 * Right: Date navigation + Form/Sleep/Load data cards for selected date
 *
 * Loads ALL dates on mount → user can browse historical data.
 * Shows accumulated intelligence (patterns, spots, learning milestones).
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Sidebar } from './Sidebar.js';
import { MorningWag } from './MorningWag.js';
import { FormCard } from './FormCard.js';
import { SleepCard } from './SleepCard.js';
import { LoadCard } from './LoadCard.js';
import { FetchCard, spotsToFetchEvents } from './FetchCard.js';
import type { FetchEvent } from './FetchCard.js';
import { IntegrationsPanel } from '../IntegrationsPanel.js';
import { ConversationHistory } from '../ConversationHistory.js';
import { ConstellationView } from '../ConstellationView.js';
import * as cloud from '../../supabase-api.js';
import type { DateEntry, DayResponse, WaldoResponse, SpotData, PatternData } from '../../types.js';

type SidebarView = 'home' | 'chat' | 'connectors' | 'fetches' | 'constellations' | 'chats';
type TimeRange = 'today' | '7d' | '30d' | '3m' | '12m';

interface DashboardProps {
  userId: string;
  userName: string;
  onSignOut: () => void;
}

// ─── Zone color helpers ──────────────────────────────────────────
const ZONE_DOT: Record<string, string> = {
  peak: '#34D399', moderate: '#FBBF24', low: '#F87171', nodata: '#D4D4D0',
};

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Range View (7d / 30d / 3m / 12m aggregated view) ────────────
function RangeView({ allDates, spots, patterns, timeRange }: {
  allDates: DateEntry[];
  spots: SpotData[];
  patterns: PatternData[];
  timeRange: TimeRange;
}) {
  const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '3m' ? 90 : 365;
  const cutoff = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10);
  const datesInRange = allDates.filter(d => d.date >= cutoff);
  const crsScores = datesInRange.map(d => d.crs).filter(s => s > 0);
  const avgCrs = crsScores.length > 0 ? Math.round(crsScores.reduce((a, b) => a + b, 0) / crsScores.length) : 0;
  const minCrs = crsScores.length > 0 ? Math.min(...crsScores) : 0;
  const maxCrs = crsScores.length > 0 ? Math.max(...crsScores) : 0;
  const peakDays = datesInRange.filter(d => d.zone === 'peak').length;
  const lowDays = datesInRange.filter(d => d.zone === 'low').length;
  const spotsInRange = spots.filter(s => s.date >= cutoff);

  const rangeLabel = timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : timeRange === '3m' ? 'Last 3 months' : 'Last 12 months';

  return (
    <>
      {/* Summary card */}
      <div className="dash-card">
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
          {rangeLabel} &middot; {datesInRange.length} days
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: 48, fontWeight: 400, color: 'var(--text)' }}>
            {avgCrs || '--'}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>avg Form</span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13 }}>
          <span style={{ color: 'var(--peak-text)' }}>{peakDays} peak days</span>
          <span style={{ color: 'var(--text-dim)' }}>range {minCrs}–{maxCrs}</span>
          <span style={{ color: lowDays > 0 ? 'var(--flagging-text)' : 'var(--text-dim)' }}>{lowDays} low days</span>
        </div>
      </div>

      {/* CRS trend mini-chart */}
      {crsScores.length > 1 && (
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', display: 'block', marginBottom: 10 }}>
            Form trend
          </span>
          <svg width="100%" height="80" viewBox={`0 0 ${Math.min(datesInRange.length, 60)} 100`} preserveAspectRatio="none">
            {/* Zone bands */}
            <rect x="0" y="0" width="100%" height="20" fill="var(--peak-bg)" opacity="0.3" />
            <rect x="0" y="40" width="100%" height="20" fill="var(--steady-bg)" opacity="0.3" />
            <rect x="0" y="60" width="100%" height="40" fill="var(--flagging-bg)" opacity="0.2" />
            {/* Line */}
            <polyline
              fill="none" stroke="var(--accent)" strokeWidth="1.5"
              points={datesInRange.slice(-60).map((d, i) => `${i},${100 - d.crs}`).join(' ')}
            />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            <span>{datesInRange.length > 60 ? formatDateLabel(datesInRange[datesInRange.length - 60]?.date ?? '') : formatDateLabel(datesInRange[0]?.date ?? '')}</span>
            <span>{formatDateLabel(datesInRange[datesInRange.length - 1]?.date ?? '')}</span>
          </div>
        </div>
      )}

      {/* Spots in range */}
      {spotsInRange.length > 0 && (
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
            {spotsInRange.length} observations
          </span>
          {spotsInRange.slice(0, 8).map((s, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < 7 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>{s.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.date}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
            Patterns ({patterns.length})
          </span>
          {patterns.slice(0, 5).map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderLeft: '3px solid #7C6BF0', paddingLeft: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{p.type}</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{p.summary}</p>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {p.evidenceCount} evidence &middot; {typeof p.confidence === 'number' ? `${Math.round(p.confidence * 100)}%` : p.confidence}
              </span>
            </div>
          ))}
        </div>
      )}

      {datesInRange.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
          No data in this time range yet.
        </div>
      )}
    </>
  );
}

export function Dashboard({ userId, userName, onSignOut }: DashboardProps) {
  // ─── State ──────────────────────────────────────────────────────
  const [sidebarView, setSidebarView] = useState<SidebarView>('home');
  const [allDates, setAllDates] = useState<DateEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [morningWag, setMorningWag] = useState<string | null>(null);
  const [spots, setSpots] = useState<SpotData[]>([]);
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [intelligenceSummary, setIntelligenceSummary] = useState<string>('');
  const [intelligenceScore, setIntelligenceScore] = useState(0);
  const [isLoadingDates, setIsLoadingDates] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [isLoadingWag, setIsLoadingWag] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'waldo'; content: string }>>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [showConstellation, setShowConstellation] = useState(false);
  const [buildingIntel, setBuildingIntel] = useState(false);
  const [buildResult, setBuildResult] = useState<{ spots_generated: number; baselines_computed: number; patterns_promoted: number; message: string; error?: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // ─── Load all dates + spots + patterns + intelligence on mount ─
  useEffect(() => {
    setIsLoadingDates(true);
    Promise.all([
      cloud.fetchDates(userId),
      cloud.fetchSpots(userId, 90),
      cloud.fetchPatterns(userId),
      cloud.fetchLearningTimeline(userId),
      cloud.fetchConversationHistory(userId, 10),
      cloud.fetchSummary(userId),
    ]).then(([dates, spotsData, patternsData, learning, history, summary]) => {
      setAllDates(dates ?? []);
      setSpots(spotsData ?? []);
      setPatterns(patternsData ?? []);
      setIntelligenceScore(learning?.intelligenceScore ?? 0);

      // Intelligence summary from user_intelligence or summary
      const uiSummary = (summary as any)?.userIntelligence;
      setIntelligenceSummary(uiSummary ?? '');

      // Find most recent morning wag from conversation history
      const historyArr = Array.isArray(history) ? history : [];
      const wagMsg = historyArr.find(
        (m: any) => m.mode === 'morning_wag' && m.role === 'waldo'
      );
      if (wagMsg) setMorningWag((wagMsg as any).content);

      // Select best date: today → most recent with CRS → most recent with any data → last date
      const datesArr = dates ?? [];
      const todayEntry = datesArr.find(d => d.date === today);
      if (todayEntry) {
        setSelectedDate(today);
      } else {
        // Find most recent date with a real CRS score
        const withCrs = datesArr.filter(d => d.crs > 0);
        if (withCrs.length > 0) {
          setSelectedDate(withCrs[withCrs.length - 1]!.date);
        } else if (datesArr.length > 0) {
          setSelectedDate(datesArr[datesArr.length - 1]!.date);
        }
      }

      // If we have dates but no today, default to range view so user sees aggregated data
      if (!datesArr.find(d => d.date === today) && datesArr.length > 7) {
        setTimeRange('7d');
      }

      setIsLoadingDates(false);
    }).catch(() => setIsLoadingDates(false));
  }, [userId, today]);

  // ─── Load day data when selected date changes ──────────────────
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingDay(true);
    setDayData(null);
    cloud.fetchDay(selectedDate, userId)
      .then(data => { setDayData(data); setIsLoadingDay(false); })
      .catch(() => setIsLoadingDay(false));
  }, [selectedDate, userId]);

  // ─── Generate morning wag ──────────────────────────────────────
  const generateMorningWag = useCallback(async () => {
    if (morningWag || isLoadingWag) return;
    setIsLoadingWag(true);
    try {
      const result = await cloud.callWaldo(today, 'morning_wag', undefined, userId);
      if ('message' in result) setMorningWag((result as WaldoResponse).message);
    } catch { /* silent */ } finally { setIsLoadingWag(false); }
  }, [morningWag, isLoadingWag, today, userId]);

  useEffect(() => {
    if (!isLoadingDates && allDates.length > 0 && !morningWag && !isLoadingWag) {
      generateMorningWag();
    }
  }, [isLoadingDates, allDates.length, morningWag, isLoadingWag, generateMorningWag]);

  // ─── Chat with Waldo ──────────────────────────────────────────
  const handleSendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isChatting) return;
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setIsChatting(true);
    try {
      const result = await cloud.callWaldo(selectedDate ?? today, 'conversational', msg, userId);
      if ('message' in result) {
        setChatMessages(prev => [...prev, { role: 'waldo', content: (result as WaldoResponse).message }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'waldo', content: 'Something went wrong. Try again?' }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'waldo', content: 'Connection issue. Try again.' }]);
    } finally { setIsChatting(false); }
  }, [chatInput, isChatting, selectedDate, today, userId]);

  // ─── Build intelligence + bootstrap (full pipeline) ─────────────
  const handleBuildIntelligence = useCallback(async () => {
    if (buildingIntel) return;
    setBuildingIntel(true);
    setBuildResult(null);
    try {
      // Step 1: Generate spots/baselines from health data
      const biResult = await cloud.triggerBuildIntelligence(userId);

      // Step 2: Run bootstrap — full historical analysis → workspace files
      const bootstrapResult = await cloud.triggerBootstrap(userId);

      setBuildResult({
        spots_generated: biResult.spots_generated ?? 0,
        baselines_computed: biResult.baselines_computed ?? 0,
        patterns_promoted: biResult.patterns_promoted ?? 0,
        message: `Intelligence built. ${bootstrapResult.files_written?.length ?? 0} workspace files created. ${bootstrapResult.data_summary ? `Sources: ${(bootstrapResult.data_summary as any).connected_sources?.join(', ') ?? 'health'}` : ''}`,
      });

      // Reload spots + patterns after building
      const [newSpots, newPatterns, newLearning] = await Promise.all([
        cloud.fetchSpots(userId, 90),
        cloud.fetchPatterns(userId),
        cloud.fetchLearningTimeline(userId),
      ]);
      setSpots(newSpots ?? []);
      setPatterns(newPatterns ?? []);
      setIntelligenceScore(newLearning?.intelligenceScore ?? 0);
    } catch (err) {
      setBuildResult({ spots_generated: 0, baselines_computed: 0, patterns_promoted: 0, message: '', error: String(err) });
    } finally { setBuildingIntel(false); }
  }, [buildingIntel, userId]);

  // ─── Filtered spots for selected date range ────────────────────
  const filteredSpots = useMemo(() => {
    if (!selectedDate) return spots.slice(0, 10);
    if (timeRange === 'today') return spots.filter(s => s.date === selectedDate).slice(0, 10);
    const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '3m' ? 90 : 365;
    const cutoff = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10);
    return spots.filter(s => s.date >= cutoff).slice(0, 15);
  }, [spots, selectedDate, timeRange]);

  const fetchEvents = spotsToFetchEvents(filteredSpots);

  // ─── Date mini-timeline for right column ───────────────────────
  const recentDates = useMemo(() => {
    // Show last 30 dates with CRS data (more useful navigation)
    const withData = allDates.filter(d => d.crs > 0);
    return withData.slice(-30);
  }, [allDates]);

  // ─── Intelligence feed items for center column ─────────────────
  const intelligenceFeed = useMemo((): FetchEvent[] => {
    const feed: FetchEvent[] = [];

    // Patterns as intelligence cards
    patterns.slice(0, 3).forEach(p => {
      feed.push({
        time: p.lastSeen ?? '',
        title: 'The Brief',
        narrative: p.summary,
        category: 'Intelligence',
        type: 'brief',
      });
    });

    // Recent spots
    fetchEvents.forEach(e => feed.push(e));

    return feed.slice(0, 6);
  }, [patterns, fetchEvents]);

  // ─── Sidebar routing ───────────────────────────────────────────
  const handleViewChange = (view: SidebarView) => {
    if (view === 'constellations') { setShowConstellation(true); return; }
    setSidebarView(view);
  };

  // ─── Stats for header area ─────────────────────────────────────
  const totalDays = allDates.length;
  const richDays = allDates.filter(d => d.tier === 'rich').length;

  return (
    <div className="dashboard">
      {showConstellation && <ConstellationView onClose={() => setShowConstellation(false)} userId={userId} />}

      {/* ═══ LEFT SIDEBAR ═══ */}
      <Sidebar
        activeView={sidebarView}
        onViewChange={handleViewChange}
        userName={userName}
        onSignOut={onSignOut}
        recentChats={chatMessages.filter(m => m.role === 'user').map(m => m.content).slice(-5)}
      />

      {/* ═══ CENTER COLUMN ═══ */}
      <main className="dash-center">
        {sidebarView === 'home' && (
          <div className="dash-center-scroll">
            {/* Morning Wag hero */}
            <MorningWag
              message={morningWag}
              zone={dayData?.crs.zone}
              isLoading={isLoadingDates || isLoadingWag}
            />

            {/* Intelligence summary */}
            {intelligenceSummary && (
              <div className="dash-card" style={{ marginTop: 16, borderLeft: '3px solid #7C6BF0' }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                  Waldo's Intelligence
                  {intelligenceScore > 0 && <span style={{ marginLeft: 8, color: 'var(--accent)' }}>Score: {intelligenceScore}</span>}
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {intelligenceSummary}
                </p>
              </div>
            )}

            {/* Build intelligence action */}
            {spots.length === 0 && allDates.length > 0 && !buildingIntel && (
              <div className="dash-card" style={{ marginTop: 16, textAlign: 'center', padding: '24px' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Waldo has {allDates.length} days of data but hasn't generated observations yet.
                </p>
                <button className="btn btn-accent" onClick={handleBuildIntelligence} style={{ padding: '10px 24px' }}>
                  Generate spots from historical data
                </button>
              </div>
            )}
            {buildingIntel && (
              <div className="dash-card" style={{ marginTop: 16, textAlign: 'center', padding: '24px' }}>
                <div className="loading" style={{ justifyContent: 'center', marginBottom: 8 }}>
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Building intelligence from historical data...</p>
              </div>
            )}
            {buildResult && (
              <div className="dash-card" style={{
                marginTop: 16, padding: '16px 20px',
                borderLeft: buildResult.error ? '3px solid #F87171' : '3px solid #34D399',
              }}>
                {buildResult.error ? (
                  <p style={{ fontSize: 13, color: '#991B1B' }}>Error: {buildResult.error}</p>
                ) : (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--peak-text)', marginBottom: 4 }}>
                      Intelligence built
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {buildResult.spots_generated} spots generated &middot; {buildResult.baselines_computed} baselines computed &middot; {buildResult.patterns_promoted} patterns promoted
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{buildResult.message}</p>
                  </>
                )}
              </div>
            )}

            {/* Pattern + spot feed */}
            {intelligenceFeed.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', display: 'block', marginBottom: 12 }}>
                  What Waldo noticed &middot; {totalDays} days observed
                </span>
                {intelligenceFeed.map((event, i) => (
                  <FetchCard key={i} event={event} />
                ))}
              </div>
            )}

            {/* Chat messages */}
            {chatMessages.length > 0 && (
              <div className="dash-chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`dash-chat-bubble ${msg.role === 'user' ? 'user' : 'waldo'}`}>
                    {msg.content}
                  </div>
                ))}
                {isChatting && (
                  <div className="dash-chat-bubble waldo" style={{ opacity: 0.6 }}>
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {sidebarView === 'chat' && (
          <div className="dash-center-scroll">
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <img src="/watching-light-mode.svg" alt="" style={{ width: 64, opacity: 0.5, marginBottom: 16 }} />
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 400, marginBottom: 8 }}>
                  Chat with Waldo
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  Ask about your health, patterns, sleep, or anything Waldo tracks.
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`dash-chat-bubble ${msg.role === 'user' ? 'user' : 'waldo'}`}>
                {msg.content}
              </div>
            ))}
            {isChatting && (
              <div className="dash-chat-bubble waldo" style={{ opacity: 0.6 }}>
                <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
              </div>
            )}
          </div>
        )}

        {sidebarView === 'connectors' && (
          <div className="dash-center-scroll">
            <IntegrationsPanel userId={userId} />
          </div>
        )}

        {sidebarView === 'fetches' && (
          <div className="dash-center-scroll">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 24, fontWeight: 400, marginBottom: 20 }}>
              Fetches &amp; Spots
            </h2>
            {spots.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>No spots yet. Upload health data to start generating observations.</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
                  {spots.length} observations across {new Set(spots.map(s => s.date)).size} days
                </p>
                {spotsToFetchEvents(spots, 20).map((event, i) => (
                  <FetchCard key={i} event={event} />
                ))}
              </>
            )}
          </div>
        )}

        {sidebarView === 'chats' && (
          <div className="dash-center-scroll">
            <ConversationHistory userId={userId} />
          </div>
        )}

        {/* Chat input — always visible for home/chat */}
        {(sidebarView === 'home' || sidebarView === 'chat') && (
          <div className="dash-chat-input-bar">
            <input
              className="dash-chat-input"
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
              placeholder="Ask Waldo anything..."
              disabled={isChatting}
            />
            <button
              className="btn btn-accent"
              onClick={handleSendChat}
              disabled={!chatInput.trim() || isChatting}
              style={{ borderRadius: 10, padding: '10px 20px' }}
            >
              {isChatting ? '...' : 'Send'}
            </button>
          </div>
        )}
      </main>

      {/* ═══ RIGHT COLUMN — Data Cards ═══ */}
      <aside className="dash-right">
        <div className="dash-right-scroll">
          {/* Time range tabs */}
          <div className="time-tabs">
            {[
              { key: 'today' as TimeRange, label: 'Today' },
              { key: '7d' as TimeRange, label: '7 Days' },
              { key: '30d' as TimeRange, label: '30 Days' },
              { key: '3m' as TimeRange, label: '3 Months' },
              { key: '12m' as TimeRange, label: '12 Months' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`time-tab ${timeRange === tab.key ? 'active' : ''}`}
                onClick={() => {
                  setTimeRange(tab.key);
                  if (tab.key === 'today') {
                    const todayEntry = allDates.find(d => d.date === today);
                    setSelectedDate(todayEntry ? today : allDates[allDates.length - 1]?.date ?? null);
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date mini-timeline */}
          <div className="date-timeline">
            {recentDates.map(d => (
              <button
                key={d.date}
                className={`date-dot ${d.date === selectedDate ? 'selected' : ''}`}
                onClick={() => { setSelectedDate(d.date); setTimeRange('today'); }}
                title={`${formatDateLabel(d.date)} — CRS ${d.crs}`}
              >
                <span
                  className="date-dot-circle"
                  style={{ background: ZONE_DOT[d.zone] ?? ZONE_DOT.nodata }}
                />
                {d.date === selectedDate && (
                  <span className="date-dot-label">{formatDateLabel(d.date)}</span>
                )}
              </button>
            ))}
            {totalDays > 14 && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                +{totalDays - 14} days
              </span>
            )}
          </div>

          {/* Selected date info */}
          {selectedDate && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>{formatDateLabel(selectedDate)}</span>
              <span style={{ color: 'var(--text-dim)' }}>
                {richDays} rich / {totalDays} total days
              </span>
            </div>
          )}

          {/* Data cards — single day or aggregated range */}
          {isLoadingDay || isLoadingDates ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="loading" style={{ justifyContent: 'center' }}>
                <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>
                Loading {selectedDate ? formatDateLabel(selectedDate) : 'data'}...
              </p>
            </div>
          ) : timeRange !== 'today' ? (
            /* ── RANGE VIEW (7d / 30d / 3m / 12m) ── */
            <RangeView allDates={allDates} spots={filteredSpots} patterns={patterns} timeRange={timeRange} />
          ) : dayData ? (
            <>
              <FormCard data={dayData} />
              <SleepCard data={dayData} />
              <LoadCard data={dayData} />

              {/* Day's spots inline */}
              {filteredSpots.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
                    Spots for this day
                  </span>
                  {filteredSpots.slice(0, 4).map((s, i) => (
                    <div key={i} className="dash-card" style={{ padding: '12px 16px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10,
                          background: s.severity === 'warning' ? 'var(--flagging-bg)' : s.severity === 'positive' ? 'var(--peak-bg)' : 'var(--bg-surface-2)',
                          color: s.severity === 'warning' ? 'var(--flagging-text)' : s.severity === 'positive' ? 'var(--peak-text)' : 'var(--text-dim)',
                        }}>
                          {s.severity}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>{s.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="dash-empty-right">
              <img src="/watching-light-mode.svg" alt="" className="mascot-watching" style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.6 }} />
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 18, fontWeight: 400, marginBottom: 8 }}>
                {allDates.length === 0 ? 'No data yet' : 'No data for this date'}
              </h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
                {allDates.length === 0
                  ? 'Upload your Apple Health export or connect Google to get started.'
                  : 'Try selecting a different date from the timeline above.'}
              </p>
              {allDates.length > 0 && (
                <button
                  className="btn btn-accent"
                  onClick={handleBuildIntelligence}
                  disabled={buildingIntel}
                  style={{ marginTop: 16, padding: '10px 24px', fontSize: 13 }}
                >
                  {buildingIntel ? 'Building...' : 'Rebuild intelligence'}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

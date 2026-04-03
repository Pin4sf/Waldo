import { useEffect, useState, useCallback } from 'react';
import { Timeline } from './components/Timeline.js';
import { CrsCard } from './components/CrsCard.js';
import { HealthPanels } from './components/HealthPanels.js';
import { WaldoMessage } from './components/WaldoMessage.js';
import { DebugPanel } from './components/DebugPanel.js';
import { MetricsDashboard } from './components/MetricsDashboard.js';
import { WaldoIntelligence } from './components/WaldoIntelligence.js';
import { ConstellationView } from './components/ConstellationView.js';
import { IntegrationsPanel } from './components/IntegrationsPanel.js';
import { ConversationHistory } from './components/ConversationHistory.js';
import { UserProfilePanel } from './components/UserProfilePanel.js';
import { AgentLogsPanel } from './components/AgentLogsPanel.js';
import { AddUserModal } from './components/AddUserModal.js';
import { LandingPage } from './components/LandingPage.js';
import { PersonalSetup } from './components/PersonalSetup.js';
import * as cloud from './supabase-api.js';
import type { DateEntry, DayResponse, WaldoResponse, WaldoError, MessageMode, SummaryResponse, UserProfile } from './types.js';

type ConsoleTab = 'today' | 'history' | 'integrations' | 'profile' | 'logs';
// 'landing' = not logged in, 'setup' = just created account, 'personal' = user view, 'admin' = full multi-user console
type AppView = 'landing' | 'setup' | 'personal' | 'admin';

export function App() {
  const [appView, setAppView] = useState<AppView>('landing');
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [loggedInName, setLoggedInName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [dates, setDates] = useState<DateEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [waldoResponse, setWaldoResponse] = useState<WaldoResponse | null>(null);
  const [waldoError, setWaldoError] = useState<string | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [isLoadingWaldo, setIsLoadingWaldo] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showConstellation, setShowConstellation] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('today');
  const [showAddUser, setShowAddUser] = useState(false);

  // Multi-user support
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>(cloud.DEFAULT_USER_ID);

  // Handle login from LandingPage
  function handleLogin(userId: string, name: string, admin: boolean) {
    setLoggedInUserId(userId);
    setLoggedInName(name);
    setIsAdmin(admin);

    if (admin) {
      // Admin → full console, default to Ark data
      setActiveUserId(cloud.DEFAULT_USER_ID);
      setAppView('admin');
    } else if (userId && localStorage.getItem('waldo_linking_code')) {
      // Just created → show setup screen
      setActiveUserId(userId);
      setAppView('setup');
    } else {
      // Returning user
      setActiveUserId(userId);
      setAppView('personal');
    }
  }

  function signOut() {
    localStorage.removeItem('waldo_user_id');
    localStorage.removeItem('waldo_user_name');
    localStorage.removeItem('waldo_is_admin');
    localStorage.removeItem('waldo_linking_code');
    localStorage.removeItem('waldo_google_url');
    setAppView('landing');
    setLoggedInUserId(null);
  }

  // Load users + dates + summary on mount
  useEffect(() => {
    Promise.all([
      cloud.fetchAllUsers(),
      cloud.fetchDates(activeUserId),
      cloud.fetchSummary(activeUserId),
    ]).then(([users, datesData, summaryData]) => {
      setAllUsers(users);
      setDates(datesData);
      setSummary(summaryData as unknown as SummaryResponse);
      setIsInitializing(false);
      setApiError(null);

      const rich = datesData.filter(d => d.hasSleep && d.hasHrv);
      if (rich.length > 0) {
        setSelectedDate(rich[rich.length - 1]!.date);
      } else if (datesData.length > 0) {
        setSelectedDate(datesData[datesData.length - 1]!.date);
      }
    }).catch(err => {
      setIsInitializing(false);
      setApiError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  // Reload dates + summary when active user changes
  useEffect(() => {
    if (isInitializing) return;
    setDates([]);
    setDayData(null);
    setWaldoResponse(null);
    setWaldoError(null);
    Promise.all([
      cloud.fetchDates(activeUserId),
      cloud.fetchSummary(activeUserId),
    ]).then(([datesData, summaryData]) => {
      setDates(datesData);
      setSummary(summaryData as unknown as SummaryResponse);
      const rich = datesData.filter(d => d.hasSleep && d.hasHrv);
      if (rich.length > 0) setSelectedDate(rich[rich.length - 1]!.date);
      else if (datesData.length > 0) setSelectedDate(datesData[datesData.length - 1]!.date);
      else setSelectedDate(null);
    });
  }, [activeUserId]);

  // Load day data when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingDay(true);
    setWaldoResponse(null);
    setWaldoError(null);
    cloud.fetchDay(selectedDate, activeUserId)
      .then(data => { setDayData(data); setIsLoadingDay(false); })
      .catch(() => setIsLoadingDay(false));
  }, [selectedDate, activeUserId]);

  // Generate Waldo response
  const handleGenerate = useCallback(async (mode: MessageMode, question?: string): Promise<WaldoResponse | WaldoError> => {
    if (!selectedDate) return { error: 'No date selected' };
    setIsLoadingWaldo(true);
    setWaldoError(null);
    try {
      const data = await cloud.callWaldo(selectedDate, mode, question, activeUserId);
      if ('error' in data && !('message' in data)) {
        setWaldoError((data as WaldoError).error);
      } else {
        setWaldoResponse(data as unknown as WaldoResponse);
        setWaldoError(null);
      }
      return data;
    } catch (err) {
      const msg = `Cloud agent error: ${err instanceof Error ? err.message : String(err)}`;
      setWaldoError(msg);
      return { error: msg };
    } finally {
      setIsLoadingWaldo(false);
    }
  }, [selectedDate, activeUserId]);

  // ─── Loading ────────────────────────────────────────────────────
  // ─── Landing (not logged in) ──────────────────────────────────
  if (appView === 'landing') {
    return <LandingPage onLogin={handleLogin} />;
  }

  // ─── Setup (just created, show Google + Telegram steps) ───────
  if (appView === 'setup' && loggedInUserId) {
    return (
      <PersonalSetup
        userId={loggedInUserId}
        name={loggedInName}
        onDone={() => {
          localStorage.removeItem('waldo_linking_code');
          setAppView('personal');
        }}
      />
    );
  }

  // ─── Personal dashboard (non-admin user view) ─────────────────
  if (appView === 'personal' && loggedInUserId) {
    const userId = loggedInUserId;
    return (
      <div className="app">
        {/* Personal header */}
        <header className="header">
          <div className="header-brand">
            <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
            <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 22 }} />
          </div>
          <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F97316', display: 'inline-block', marginRight: 6 }} />
              {loggedInName}
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => setShowConstellation(true)}
              style={{ fontSize: 12 }}
            >
              Constellation
            </button>
            <button
              onClick={signOut}
              style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </header>

        {showConstellation && <ConstellationView onClose={() => setShowConstellation(false)} />}

        {/* Personal tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--bg)' }}>
          {(['today', 'history', 'integrations', 'profile'] as ConsoleTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setConsoleTab(tab)}
              style={{
                fontSize: 13, padding: '10px 16px', fontWeight: consoleTab === tab ? 600 : 400,
                color: consoleTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: consoleTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Personal content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {consoleTab === 'today' && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <IntegrationsPanel userId={userId} />
            </div>
          )}
          {consoleTab === 'history' && <ConversationHistory userId={userId} />}
          {consoleTab === 'integrations' && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <IntegrationsPanel userId={userId} />
            </div>
          )}
          {consoleTab === 'profile' && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <UserProfilePanel userId={userId} onUserSelect={() => {}} allUsers={[]} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Admin console (full multi-user view) follows below ────────

  if (isInitializing) {
    return (
      <div className="app">
        <div className="loading" style={{ flex: 1, flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
            <span>Connecting to Waldo Cloud...</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading from Supabase</span>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="app">
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 24, marginBottom: 12 }}>Connection failed</h3>
          <p style={{ maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>{apiError}</p>
          <button className="btn btn-accent" onClick={() => window.location.reload()} style={{ marginTop: 20 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selectedEntry = dates.find(d => d.date === selectedDate);
  const activeUser = allUsers.find(u => u.id === activeUserId);
  const userName = activeUser?.name ?? summary?.profile?.name ?? 'Ark';

  const TAB_DEFS: { id: ConsoleTab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'history', label: 'History' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'profile', label: 'Profile' },
    { id: 'logs', label: 'Agent Logs' },
  ];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
          <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 22 }} />
          <span className="tag">console</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', marginLeft: 4 }} title="Connected" />
        </div>

        <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Active user pill — always shown, click to open dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              style={{
                fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid var(--border)', borderRadius: 20,
                background: 'var(--bg-surface)',
              }}
              onClick={() => {
                const el = document.getElementById('user-dropdown');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{userName}</span>
              {dates.length > 0 && (
                <span style={{ color: 'var(--text-dim)' }}>
                  · {dates.filter(d => d.tier === 'rich').length}r · {dates.length}d
                </span>
              )}
              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>▾</span>
            </button>

            {/* User dropdown */}
            <div
              id="user-dropdown"
              style={{
                display: 'none', position: 'absolute', top: '110%', right: 0,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 200, zIndex: 100, overflow: 'hidden',
              }}
            >
              {allUsers.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-dim)' }}>
                  Loading users...
                </div>
              )}
              {allUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    setActiveUserId(u.id);
                    const el = document.getElementById('user-dropdown');
                    if (el) el.style.display = 'none';
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '9px 14px', border: 'none',
                    background: u.id === activeUserId ? 'var(--bg-surface)' : 'transparent',
                    cursor: 'pointer', fontSize: 13, textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: u.id === activeUserId ? '#F97316' : 'var(--text-dim)',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <span style={{ fontWeight: u.id === activeUserId ? 600 : 400 }}>{u.name}</span>
                  {u.id === activeUserId && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)' }}>active</span>}
                  {(u as any).is_admin && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>admin</span>}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowAddUser(true);
                  const el = document.getElementById('user-dropdown');
                  if (el) el.style.display = 'none';
                }}
                style={{
                  display: 'block', width: '100%', padding: '9px 14px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 12, color: 'var(--accent)', fontWeight: 600, textAlign: 'left',
                }}
              >
                + Add new user
              </button>
            </div>
          </div>

          <button
            className="btn btn-accent"
            onClick={() => setShowAddUser(true)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            + Add user
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowConstellation(true)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Constellation
          </button>
          <button
            onClick={signOut}
            style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Constellation overlay */}
      {showConstellation && (
        <ConstellationView onClose={() => setShowConstellation(false)} />
      )}

      {/* Add User modal */}
      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onCreated={(newId) => {
            // Refresh user list and switch to the new user
            cloud.fetchAllUsers().then(users => {
              setAllUsers(users);
              setActiveUserId(newId);
            });
            setShowAddUser(false);
          }}
        />
      )}

      {/* Console tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        padding: '0 20px', background: 'var(--bg)',
      }}>
        {TAB_DEFS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setConsoleTab(tab.id)}
            style={{
              fontSize: 13, padding: '10px 16px', fontWeight: consoleTab === tab.id ? 600 : 400,
              color: consoleTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: consoleTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TODAY tab ───────────────────────────────────────────── */}
      {consoleTab === 'today' && (
        <>
          <Timeline dates={dates} selected={selectedDate} onSelect={setSelectedDate} />
          <div className="panels">
            {/* LEFT */}
            <div className="panel">
              <div className="panel-title">
                The experience
                {selectedDate && (
                  <span style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {isLoadingDay && (
                <div className="loading">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </div>
              )}

              {!dayData && !isLoadingDay && (
                <div className="empty-state">
                  <h3>Pick a date</h3>
                  <p>Select a dot on the timeline above to see health data and talk to Waldo.</p>
                </div>
              )}

              {dayData && !isLoadingDay && (
                <>
                  <CrsCard data={dayData} />
                  <MetricsDashboard data={dayData} />
                  <WaldoMessage
                    date={selectedDate!}
                    hasStress={selectedEntry?.hasStress ?? false}
                    onGenerate={handleGenerate}
                    response={waldoResponse}
                    error={waldoError}
                    isLoading={isLoadingWaldo}
                    autoGenerate={true}
                  />
                  <WaldoIntelligence
                    actions={dayData.waldoActions ?? []}
                    patterns={dayData.patterns ?? []}
                    dayActivity={dayData.dayActivity ?? null}
                  />
                  <HealthPanels data={dayData} />
                </>
              )}
            </div>

            {/* RIGHT */}
            <div className="panel" style={{ background: '#F6F5F0' }}>
              <div className="panel-title">Under the hood</div>
              <DebugPanel day={dayData} waldoResponse={waldoResponse} />
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY tab ─────────────────────────────────────────── */}
      {consoleTab === 'history' && (
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>Conversation History</div>
          <ConversationHistory userId={activeUserId} />
        </div>
      )}

      {/* ── INTEGRATIONS tab ────────────────────────────────────── */}
      {consoleTab === 'integrations' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 20, padding: '20px 24px' }}>
          <div style={{ flex: 1 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Integrations</div>
            <IntegrationsPanel userId={activeUserId} />
          </div>
        </div>
      )}

      {/* ── PROFILE tab ─────────────────────────────────────────── */}
      {consoleTab === 'profile' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 20, padding: '20px 24px' }}>
          <div style={{ flex: 1, maxWidth: 600 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>User Profile</div>
            <UserProfilePanel
              userId={activeUserId}
              onUserSelect={setActiveUserId}
              allUsers={allUsers}
            />
          </div>
        </div>
      )}

      {/* ── LOGS tab ────────────────────────────────────────────── */}
      {consoleTab === 'logs' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>Agent Invocation Logs</div>
          <AgentLogsPanel userId={activeUserId} />
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Timeline } from './components/Timeline.js';
import { CrsCard } from './components/CrsCard.js';
import { HealthPanels } from './components/HealthPanels.js';
import { WaldoMessage } from './components/WaldoMessage.js';
import { DebugPanel } from './components/DebugPanel.js';
import { MetricsDashboard } from './components/MetricsDashboard.js';
import { WaldoIntelligence } from './components/WaldoIntelligence.js';
import { Onboarding } from './components/Onboarding.js';
import { ConstellationView } from './components/ConstellationView.js';
import type { DateEntry, DayResponse, WaldoResponse, WaldoError, MessageMode, SummaryResponse } from './types.js';

export function App() {
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showConstellation, setShowConstellation] = useState(false);

  // Load dates + summary on mount
  useEffect(() => {
    let retries = 0;
    const maxRetries = 8; // API takes ~8s to start (XML parse + weather)

    function tryConnect() {
      Promise.all([
        fetch('/api/dates').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
        fetch('/api/summary').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
        fetch('/api/profile').then(r => r.json()).catch(() => ({ onboardingComplete: false })),
      ]).then(([datesData, summaryData, profileData]) => {
        setDates(datesData as DateEntry[]);
        setSummary(summaryData as SummaryResponse);
        setIsInitializing(false);
        setApiError(null);

        // Check if onboarding is needed
        const profile = profileData as { onboardingComplete: boolean };
        if (!profile.onboardingComplete) {
          setShowOnboarding(true);
        }

        const rich = (datesData as DateEntry[]).filter(d => d.hasSleep && d.hasHrv);
        if (rich.length > 0) {
          setSelectedDate(rich[rich.length - 1]!.date);
        }
      }).catch(() => {
        retries++;
        if (retries < maxRetries) {
          setTimeout(tryConnect, 2000);
        } else {
          setIsInitializing(false);
          setApiError('Could not connect to the Waldo API server on port 3737. Make sure to start it first.');
        }
      });
    }

    tryConnect();
  }, []);

  // Load day data when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingDay(true);
    setWaldoResponse(null);
    setWaldoError(null);

    fetch(`/api/day/${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        setDayData(data as DayResponse);
        setIsLoadingDay(false);
      })
      .catch(() => setIsLoadingDay(false));
  }, [selectedDate]);

  // Generate Waldo response
  const handleGenerate = useCallback(async (mode: MessageMode, question?: string): Promise<WaldoResponse | WaldoError> => {
    if (!selectedDate) return { error: 'No date selected' };
    setIsLoadingWaldo(true);
    setWaldoError(null);

    try {
      const res = await fetch('/api/waldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, mode, question }),
      });
      const data = await res.json() as WaldoResponse | WaldoError;

      if ('error' in data) {
        const msg = data.error.includes('authentication')
          ? 'Set ANTHROPIC_API_KEY on the API server to enable Claude responses.'
          : data.error;
        setWaldoError(msg);
        // Still save debug info if available
        if (data.debug) {
          setWaldoResponse({ message: '', zone: '', mode, tokensIn: 0, tokensOut: 0, responseTimeMs: 0, debug: { ...data.debug, model: 'claude-haiku-4-5' } });
        }
      } else {
        setWaldoResponse(data);
        setWaldoError(null);
      }
      return data;
    } catch (err) {
      const msg = 'Failed to connect to API. Is the API server running on port 3737?';
      setWaldoError(msg);
      return { error: msg };
    } finally {
      setIsLoadingWaldo(false);
    }
  }, [selectedDate]);

  if (isInitializing) {
    return (
      <div className="app">
        <div className="loading" style={{ flex: 1, flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span>Connecting to Waldo API...</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Parsing Ark's health export (~2s)</span>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="app">
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 24, marginBottom: 12 }}>Waldo can't find the API</h3>
          <p style={{ maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            {apiError}
          </p>
          <div style={{ marginTop: 24, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: 20, textAlign: 'left', maxWidth: 500, margin: '24px auto 0', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 8 }}>Run this in a terminal:</div>
            <code style={{ color: 'var(--text)' }}>cd tools/health-parser</code><br />
            <code style={{ color: 'var(--text)' }}>./node_modules/.bin/tsx src/api.ts</code>
          </div>
          <button className="btn btn-accent" onClick={() => window.location.reload()} style={{ marginTop: 20 }}>
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="app">
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      </div>
    );
  }

  const selectedEntry = dates.find(d => d.date === selectedDate);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <img src="/logo.svg" alt="" style={{ width: 28, height: 28 }} />
          <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 22 }} />
          <span className="tag">console</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', marginLeft: 4 }} title="API connected" />
        </div>
        <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowConstellation(true)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            View constellation
          </button>
          {summary && (
            <span>
              {summary.profile.biologicalSex === 'Male' ? 'Ark' : 'User'}, age {summary.profile.age}
              {' · '}{dates.filter(d => d.tier === 'rich').length} rich days
              {' · '}{dates.length} total
            </span>
          )}
        </div>
      </header>

      {/* Constellation overlay */}
      {showConstellation && (
        <ConstellationView onClose={() => setShowConstellation(false)} />
      )}

      {/* Timeline */}
      <Timeline
        dates={dates}
        selected={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* Split panels */}
      <div className="panels">
        {/* LEFT — The experience */}
        <div className="panel">
          <div className="panel-title">
            The experience
            {selectedDate && (
              <span style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>

          {isLoadingDay && (
            <div className="loading">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          )}

          {!dayData && !isLoadingDay && (
            <div className="empty-state">
              <h3>Pick a date</h3>
              <p>Select a dot on the timeline above to see Ark's health data and talk to Waldo.</p>
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

        {/* RIGHT — Under the hood */}
        <div className="panel" style={{ background: '#F6F5F0' }}>
          <div className="panel-title">Under the hood</div>
          <DebugPanel
            day={dayData}
            waldoResponse={waldoResponse}
          />
        </div>
      </div>
    </div>
  );
}

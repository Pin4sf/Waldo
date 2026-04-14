import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { DemoPage } from './DemoPage.js';
import './styles.css';
import './components/dashboard/dashboard.css';

// Error boundary to prevent white screen crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Waldo] React crash caught:', error.message);
    console.error('[Waldo] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, fontFamily: 'DM Sans, sans-serif',
          backgroundColor: '#FAFAF8', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        }}>
          <h2 style={{ fontFamily: 'Corben, serif', fontSize: 28, color: '#1A1A1A', marginBottom: 12 }}>
            Waldo hit a snag.
          </h2>
          <p style={{ color: '#7C776D', fontSize: 16, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
            Something went wrong loading the data. Try refreshing the page.
          </p>
          <pre style={{
            background: '#F3F4F6', padding: 16, borderRadius: 12, marginTop: 20,
            fontSize: 12, color: '#991B1B', maxWidth: 600, overflow: 'auto',
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 12,
              backgroundColor: '#F97316', color: 'white', border: 'none',
              fontFamily: 'DM Sans, sans-serif', fontSize: 14, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const isDemo = window.location.pathname === '/demo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isDemo ? <DemoPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);

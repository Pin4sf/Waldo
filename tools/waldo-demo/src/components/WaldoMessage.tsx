import { useState, useRef, useEffect } from 'react';
import type { MessageMode, WaldoResponse, WaldoError } from '../types.js';

interface ChatMessage {
  role: 'waldo' | 'user';
  content: string;
  mode?: MessageMode;
  meta?: { tokensIn: number; tokensOut: number; responseTimeMs: number };
}

interface Props {
  date: string;
  hasStress: boolean;
  onGenerate: (mode: MessageMode, question?: string) => Promise<WaldoResponse | WaldoError>;
  response: WaldoResponse | null;
  error: string | null;
  isLoading: boolean;
  /** Trigger auto-generation of Morning Wag */
  autoGenerate: boolean;
}

export function WaldoMessage({ date, hasStress, onGenerate, response, error, isLoading, autoGenerate }: Props) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentDate, setCurrentDate] = useState(date);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasAutoFired = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Reset chat when date changes
  useEffect(() => {
    if (date !== currentDate) {
      setChatHistory([]);
      setCurrentDate(date);
      hasAutoFired.current = false;
    }
  }, [date, currentDate]);

  // Auto-generate Morning Wag when date is selected
  // Uses a timeout to debounce StrictMode double-invoke
  useEffect(() => {
    if (!autoGenerate || hasAutoFired.current || date !== currentDate || chatHistory.length > 0) return;
    hasAutoFired.current = true;
    const timer = setTimeout(() => {
      onGenerate('morning_wag');
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, date, currentDate]);

  // When response comes in, add to chat
  useEffect(() => {
    if (response && response.message) {
      setChatHistory(prev => {
        // Avoid duplicates
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.content === response.message) return prev;
        return [...prev, {
          role: 'waldo',
          content: response.message,
          mode: response.mode as MessageMode,
          meta: { tokensIn: response.tokensIn ?? 0, tokensOut: response.tokensOut ?? 0, responseTimeMs: response.responseTimeMs ?? 0 },
        }];
      });
    }
  }, [response]);

  // Add error as Waldo message
  useEffect(() => {
    if (error) {
      setChatHistory(prev => [...prev, { role: 'waldo', content: error }]);
    }
  }, [error]);

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    const q = input.trim();
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: q }]);
    onGenerate('conversational', q);
  };

  const triggerFetchAlert = () => {
    setChatHistory(prev => [...prev, {
      role: 'waldo',
      content: '— fetch alert —',
      mode: 'fetch_alert',
    }]);
    onGenerate('fetch_alert');
  };

  return (
    <div className="card stagger-5" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="card-label" style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Waldo</span>
        {hasStress && (
          <button
            className="btn-ghost"
            onClick={triggerFetchAlert}
            disabled={isLoading}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Trigger fetch alert
          </button>
        )}
      </div>

      {/* Chat thread */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px', minHeight: 120, maxHeight: 400 }}>
        {chatHistory.length === 0 && !isLoading && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Waldo is reading your data...
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
            animation: 'messageIn 0.3s ease both',
          }}>
            {msg.role === 'waldo' && (
              <img src="/logo.svg" alt="W" style={{ width: 28, height: 28, marginRight: 8, flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'var(--text)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? 'var(--bg)' : 'var(--text)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
              {msg.meta && (
                <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : 'var(--text-dim)', marginTop: 6 }}>
                  {msg.meta.tokensIn}→{msg.meta.tokensOut} tokens · {msg.meta.responseTimeMs}ms
                  {msg.mode && ` · ${msg.mode.replace('_', ' ')}`}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <img src="/thinking-light-mode.svg" alt="W" className="mascot-thinking" style={{ width: 36, height: 36 }} />
            <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '14px 14px 14px 4px' }}>
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Chat input */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
        <input
          className="waldo-input"
          placeholder="Ask Waldo..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={isLoading}
        />
        <button className="btn btn-accent" onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

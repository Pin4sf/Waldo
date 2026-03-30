import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async () => {
    setStarted(true);
    setIsLoading(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { reply: string; onboardingComplete: boolean };
      setMessages([{ role: 'assistant', content: data.reply }]);
      if (data.onboardingComplete) setTimeout(onComplete, 2000);
    } catch {
      setMessages([{ role: 'assistant', content: "Having trouble connecting. Is the API key set?" }]);
    }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json() as { reply: string; onboardingComplete: boolean };
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      if (data.onboardingComplete) {
        setTimeout(onComplete, 2500);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: "Connection issue. Try again." }]);
    }
    setIsLoading(false);
  };

  if (!started) {
    return (
      <div className="onboarding-start">
        {/* Decorative dalmatian spots */}
        <img src="/Vector-1.png" alt="" style={{ position: 'absolute', top: '12%', left: '8%', width: 60, opacity: 0.06 }} />
        <img src="/Vector-2.png" alt="" style={{ position: 'absolute', top: '25%', right: '12%', width: 40, opacity: 0.05 }} />
        <img src="/Vector-3.png" alt="" style={{ position: 'absolute', bottom: '18%', left: '15%', width: 50, opacity: 0.04 }} />
        <img src="/Vector-1.png" alt="" style={{ position: 'absolute', bottom: '30%', right: '8%', width: 70, opacity: 0.05 }} />
        <div className="onboarding-hero">
          <img src="/on-it-light-mode.svg" alt="Waldo" className="mascot-onit" style={{ width: 120, height: 120, marginBottom: 8 }} />
          <img src="/horizontal-stack.svg" alt="Waldo" style={{ height: 36 }} />
          <p>Already on it.</p>
        </div>
        <div className="onboarding-intro">
          <p>Before Waldo starts watching your body signals, it needs to know a few things about you.</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>
            Quick conversation. Under a minute.
          </p>
        </div>
        <button className="btn btn-accent" onClick={startConversation} style={{ padding: '14px 40px', fontSize: 15 }}>
          Meet Waldo
        </button>
        <button className="btn-ghost" onClick={onComplete} style={{ marginTop: 12, fontSize: 13, padding: '8px 20px', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <div className="onboarding-chat">
      <div className="onboarding-messages">
        {messages.map((m, i) => (
          <div key={i} className={`onboarding-msg ${m.role}`}>
            {m.role === 'assistant' && <img src="/logo.svg" alt="W" className="onboarding-avatar" style={{ background: 'transparent' }} />}
            <div className={`onboarding-bubble ${m.role}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="onboarding-msg assistant">
            <img src="/thinking-light-mode.svg" alt="W" className="mascot-thinking" style={{ width: 32, height: 32 }} />
            <div className="onboarding-bubble assistant">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="onboarding-input-row">
        <input
          className="waldo-input"
          placeholder="Type your answer..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={isLoading}
          autoFocus
        />
        <button className="btn btn-accent" onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

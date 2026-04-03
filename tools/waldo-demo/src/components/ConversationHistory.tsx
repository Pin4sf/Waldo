import { useState, useEffect, useRef } from 'react';
import { fetchConversationHistory } from '../supabase-api.js';
import type { ConversationMessage } from '../types.js';

interface Props { userId: string }

const MODE_LABEL: Record<string, string> = {
  morning_wag: 'Morning Wag',
  fetch_alert: 'Fetch Alert',
  conversational: 'Chat',
  evening_review: 'Evening Review',
  onboarding: 'Onboarding',
};

const CHANNEL_ICON: Record<string, string> = {
  telegram: '✈️',
  web: '🌐',
  mobile: '📱',
  api: '⚡',
};

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isWaldo = msg.role === 'waldo';
  const time = new Date(msg.createdAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: isWaldo ? 'row' : 'row-reverse',
      gap: 8,
      marginBottom: 12,
      alignItems: 'flex-end',
    }}>
      {isWaldo && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#F97316',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>
          🐕
        </div>
      )}
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isWaldo ? 'var(--bg-surface)' : '#F97316',
          color: isWaldo ? 'var(--text)' : '#fff',
          borderRadius: isWaldo ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
          padding: '10px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-dim)', marginTop: 4,
          textAlign: isWaldo ? 'left' : 'right',
          display: 'flex', gap: 6,
          justifyContent: isWaldo ? 'flex-start' : 'flex-end',
          flexDirection: isWaldo ? 'row' : 'row-reverse',
        }}>
          <span>{time}</span>
          {msg.mode && <span>· {MODE_LABEL[msg.mode] ?? msg.mode}</span>}
          <span>{CHANNEL_ICON[msg.channel] ?? msg.channel}</span>
        </div>
      </div>
    </div>
  );
}

export function ConversationHistory({ userId }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchConversationHistory(userId, 100).then(msgs => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [userId]);

  const filtered = filter === 'all' ? messages
    : messages.filter(m => m.mode === filter || (filter === 'user' && m.role === 'user'));

  const modes = ['all', 'morning_wag', 'fetch_alert', 'conversational', 'evening_review', 'user'];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        Loading conversation history...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <h3>No conversations yet</h3>
        <p>Waldo's messages will appear here once the agent starts sending Morning Wags and responding to questions.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 0 16px', flexWrap: 'wrap' }}>
        {modes.map(m => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            className={filter === m ? 'btn btn-accent' : 'btn btn-ghost'}
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            {m === 'all' ? `All (${messages.length})` : m === 'user' ? 'User replies' : (MODE_LABEL[m] ?? m)}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', paddingRight: 4,
        display: 'flex', flexDirection: 'column',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: 24 }}>
            No messages in this category.
          </div>
        ) : (
          filtered.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

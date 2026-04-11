/**
 * Sidebar — Left navigation panel
 *
 * Matches Figma: Waldo brand, New Chat, Connectors, user profile,
 * Fetches, Constellations, Your Chats, Recents
 */

type SidebarView = 'home' | 'chat' | 'connectors' | 'fetches' | 'constellations' | 'chats';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  userName: string;
  onSignOut: () => void;
  recentChats?: string[];
}

const NAV_ITEMS: Array<{ id: SidebarView; label: string; icon: string }> = [
  { id: 'chat', label: 'New Chat', icon: '+' },
  { id: 'connectors', label: 'Connectors', icon: '\u2295' },
];

const LOWER_ITEMS: Array<{ id: SidebarView; label: string; icon: string }> = [
  { id: 'fetches', label: 'The Patrol', icon: '\u21BB' },
  { id: 'constellations', label: 'Constellations', icon: '\u2728' },
];

export function Sidebar({ activeView, onViewChange, userName, onSignOut, recentChats }: SidebarProps) {
  return (
    <aside className="dash-sidebar">
      {/* Brand */}
      <div className="sidebar-brand" onClick={() => onViewChange('home')}>
        <span className="sidebar-logo">Waldo</span>
      </div>

      {/* Primary nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User profile */}
      <div className="sidebar-user">
        <div className="sidebar-avatar" />
        <div>
          <div className="sidebar-username">{userName}</div>
        </div>
      </div>

      {/* Lower nav */}
      <nav className="sidebar-nav" style={{ marginTop: 8 }}>
        {LOWER_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Separator */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 16px' }} />

      {/* Your Chats */}
      <button
        className={`sidebar-item ${activeView === 'chats' ? 'active' : ''}`}
        onClick={() => onViewChange('chats')}
        style={{ margin: '0 8px' }}
      >
        <span className="sidebar-icon">{'\u{1F4AC}'}</span>
        <span>Your Chats</span>
      </button>

      {/* Recents */}
      {recentChats && recentChats.length > 0 && (
        <div className="sidebar-recents">
          <span className="sidebar-recents-label">Recents</span>
          {recentChats.slice(0, 5).map((chat, i) => (
            <div key={i} className="sidebar-recent-item">
              {chat}
            </div>
          ))}
        </div>
      )}

      {/* Sign out at bottom */}
      <div style={{ marginTop: 'auto', padding: '12px 16px' }}>
        <button
          onClick={onSignOut}
          style={{
            fontSize: 12, color: 'var(--text-dim)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '6px 0',
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

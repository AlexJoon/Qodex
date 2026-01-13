import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquarePen, MessageSquare, Settings, User, Trash2, PanelLeftClose, PanelLeft, MoreVertical, Check, Copy } from 'lucide-react';
import { useDiscussionStore } from '../../stores/discussionStore';
import { Discussion } from '../../types';
import logo from '../../assets/logo.png';
import './Sidebar.css';

export function Sidebar() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    discussions,
    activeDiscussionId,
    isLoading,
    fetchDiscussions,
    createDiscussion,
    deleteDiscussion,
    activateDiscussion,
  } = useDiscussionStore();

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const handleNewChat = async () => {
    const discussion = await createDiscussion();
    // Navigate to the new discussion URL
    navigate(`/chat/${discussion.id}`);
  };

  const handleSelectDiscussion = (id: string) => {
    // Navigate to discussion URL - this will trigger the URL effect in ChatPage
    navigate(`/chat/${id}`);
    // Also call API to mark as active on backend (fire-and-forget)
    activateDiscussion(id);
  };

  // Group discussions by date
  const groupByDate = (items: Discussion[]) => {
    const today: Discussion[] = [];
    const yesterday: Discussion[] = [];
    const previous7Days: Discussion[] = [];
    const older: Discussion[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    items.forEach((item) => {
      const itemDate = new Date(item.updated_at);
      if (itemDate >= todayStart) {
        today.push(item);
      } else if (itemDate >= yesterdayStart) {
        yesterday.push(item);
      } else if (itemDate >= weekStart) {
        previous7Days.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, previous7Days, older };
  };

  const grouped = groupByDate(discussions);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logo} alt="Qodex" className="sidebar-logo-img" />
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sidebar-collapse-btn"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="sidebar-new-chat">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className="new-chat-btn"
        >
          <SquarePen size={18} />
          {!isCollapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="sidebar-conversations">
        {isLoading && discussions.length === 0 ? (
          <div className="sidebar-loading">
            <div className="spinner" />
          </div>
        ) : discussions.length === 0 ? (
          <div className="sidebar-empty">
            <MessageSquare size={24} />
            <p>No conversations yet</p>
          </div>
        ) : (
          <ConversationGroup
            title="Conversations"
            discussions={discussions}
            activeId={activeDiscussionId}
            onSelect={handleSelectDiscussion}
            onDelete={deleteDiscussion}
            onActivate={activateDiscussion}
            isCollapsed={isCollapsed}
          />
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <User size={16} />
          </div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">User</span>
              <span className="sidebar-user-plan">Free plan</span>
            </div>
          )}
          {!isCollapsed && (
            <button className="sidebar-user-settings">
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

interface ConversationGroupProps {
  title: string;
  discussions: Discussion[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
  isCollapsed?: boolean;
}

function ConversationGroup({ title, discussions, activeId, onSelect, onDelete, onActivate, isCollapsed }: ConversationGroupProps) {
  if (discussions.length === 0) return null;

  return (
    <div className="conversation-group">
      {!isCollapsed && <h3 className="conversation-group-title">{title}</h3>}
      <div className="conversation-group-list">
        {discussions.map((discussion) => (
          <ConversationItem
            key={discussion.id}
            discussion={discussion}
            isActive={discussion.id === activeId}
            onSelect={() => onSelect(discussion.id)}
            onDelete={() => onDelete(discussion.id)}
            onActivate={() => onActivate(discussion.id)}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  discussion: Discussion;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onActivate: () => void;
  isCollapsed?: boolean;
}

function ConversationItem({ discussion, isActive, onSelect, onDelete, onActivate, isCollapsed }: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = discussion.title || discussion.messages[0]?.content.slice(0, 30) || 'New conversation';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = discussion.messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowMenu(false);
    }, 1500);
  };

  const handleActivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate();
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setShowMenu(false);
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      {isCollapsed ? (
        <MessageSquare size={16} className="conversation-item-icon" />
      ) : (
        <>
          <span className="conversation-item-title">{title}</span>
          <div className="conversation-item-menu-container" ref={menuRef}>
            <button
              className="conversation-item-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <div className="conversation-menu">
                <button className="conversation-menu-item" onClick={handleActivate}>
                  <Check size={14} />
                  <span>Activate</span>
                </button>
                <button className="conversation-menu-item" onClick={handleCopy}>
                  <Copy size={14} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button className="conversation-menu-item delete" onClick={handleDelete}>
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

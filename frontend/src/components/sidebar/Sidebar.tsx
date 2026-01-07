import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, MessageSquare, Settings, User, Trash2 } from 'lucide-react';
import { useDiscussionStore } from '../../stores/discussionStore';
import { Discussion } from '../../types';
import logo from '../../assets/logo.png';
import './Sidebar.css';

export function Sidebar() {
  const navigate = useNavigate();
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
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logo} alt="Qodex" className="sidebar-logo-img" />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="sidebar-new-chat">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className="new-chat-btn"
        >
          <NotebookPen size={18} />
          <span>New chat</span>
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
          <>
            <ConversationGroup
              title="Today"
              discussions={grouped.today}
              activeId={activeDiscussionId}
              onSelect={handleSelectDiscussion}
              onDelete={deleteDiscussion}
            />
            <ConversationGroup
              title="Yesterday"
              discussions={grouped.yesterday}
              activeId={activeDiscussionId}
              onSelect={handleSelectDiscussion}
              onDelete={deleteDiscussion}
            />
            <ConversationGroup
              title="Previous 7 Days"
              discussions={grouped.previous7Days}
              activeId={activeDiscussionId}
              onSelect={handleSelectDiscussion}
              onDelete={deleteDiscussion}
            />
            <ConversationGroup
              title="Older"
              discussions={grouped.older}
              activeId={activeDiscussionId}
              onSelect={handleSelectDiscussion}
              onDelete={deleteDiscussion}
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <User size={16} />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">User</span>
            <span className="sidebar-user-plan">Free plan</span>
          </div>
          <button className="sidebar-user-settings">
            <Settings size={16} />
          </button>
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
}

function ConversationGroup({ title, discussions, activeId, onSelect, onDelete }: ConversationGroupProps) {
  if (discussions.length === 0) return null;

  return (
    <div className="conversation-group">
      <h3 className="conversation-group-title">{title}</h3>
      <div className="conversation-group-list">
        {discussions.map((discussion) => (
          <ConversationItem
            key={discussion.id}
            discussion={discussion}
            isActive={discussion.id === activeId}
            onSelect={() => onSelect(discussion.id)}
            onDelete={() => onDelete(discussion.id)}
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
}

function ConversationItem({ discussion, isActive, onSelect, onDelete }: ConversationItemProps) {
  const title = discussion.title || discussion.messages[0]?.content.slice(0, 30) || 'New conversation';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <MessageSquare size={16} className="conversation-item-icon" />
      <span className="conversation-item-title">{title}</span>
      <button
        className="conversation-item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

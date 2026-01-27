import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquarePen, MessageSquare, Settings, User, Trash2, PanelLeftClose, PanelLeft, MoreVertical, Check, Copy, Home, LogOut, Sparkles, Compass, GraduationCap, Mail } from 'lucide-react';
import { useDiscussionStore } from '@/features/discussions';
import { useChatStore } from '@/features/chat';
import { Discussion } from '@/shared/types';
import logo from '../../assets/qodex-logo.png';
import { SampleQuestionsDropdown } from './SampleQuestionsDropdown';
import { ContactModal } from './ContactModal';
import { SAMPLE_QUESTIONS } from '@/shared/constants/sampleQuestions';
import './Sidebar.css';

export function Sidebar() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSampleQuestions, setShowSampleQuestions] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const sampleQuestionsRef = useRef<HTMLDivElement>(null);
  const {
    discussions,
    activeDiscussionId,
    isLoading,
    fetchDiscussions,
    createDiscussion,
    deleteDiscussion,
    activateDiscussion,
    setActiveDiscussionId,
  } = useDiscussionStore();
  const { clearMessages } = useChatStore();

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  // Close sample questions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is inside the container OR inside the dropdown menu (which is position: fixed)
      const isInsideContainer = sampleQuestionsRef.current && sampleQuestionsRef.current.contains(target);
      const isInsideMenu = (target as Element).closest?.('.sample-questions-dropdown-menu');

      if (!isInsideContainer && !isInsideMenu) {
        setShowSampleQuestions(false);
      }
    };

    if (showSampleQuestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSampleQuestions]);

  const handleNewChat = () => {
    // Navigate to empty chat - discussion will be created when user sends first message
    navigate('/chat');
  };

  const handleSampleQuestionSelect = (question: string) => {
    setShowSampleQuestions(false);
    console.log('Sample question selected:', question);
    // Clear any existing messages and discussion, then navigate with the question
    clearMessages();
    setActiveDiscussionId(null);
    setPendingQuestion(question);
    console.log('Navigating to /chat with initialMessage');
    navigate('/chat', { state: { initialMessage: question } });
  };

  const handleHome = () => {
    navigate('/');
    setShowSettingsMenu(false);
  };

  const handleProfile = () => {
    console.log('Profile clicked');
    setShowSettingsMenu(false);
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    setShowSettingsMenu(false);
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

      {/* Navigation Links */}
      <div className="sidebar-nav-links">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className="sidebar-nav-link"
        >
          <SquarePen size={18} />
          {!isCollapsed && <span>New Chat</span>}
        </button>
        <a href="https://openclimatecurriculum.org/explore/" target="_blank" rel="noopener noreferrer" className="sidebar-nav-link">
          <Compass size={18} />
          {!isCollapsed && <span>Explore</span>}
        </a>
        <a href="https://openclimatecurriculum.org/educators/" target="_blank" rel="noopener noreferrer" className="sidebar-nav-link">
          <GraduationCap size={18} />
          {!isCollapsed && <span>Educators</span>}
        </a>
        <button className="sidebar-nav-link" onClick={() => setShowContactModal(true)}>
          <Mail size={18} />
          {!isCollapsed && <span>Contact</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="sidebar-conversations">
        {isLoading && discussions.length === 0 ? (
          <div className="sidebar-loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Conversations heading - always visible */}
            {!isCollapsed && <h3 className="sidebar-section-title">Conversations</h3>}

            {/* Journey button - always visible */}
            <div className="sidebar-journey-section">
              {/* Normal state - full journey button */}
              <div className="sidebar-journey-normal">
                <div className="sidebar-start-journey-container" ref={sampleQuestionsRef}>
                  <button className="sidebar-start-journey-btn" onClick={() => setShowSampleQuestions(!showSampleQuestions)}>
                    <Sparkles size={16} />
                    <span>Start a new journey</span>
                  </button>
                  <SampleQuestionsDropdown
                    isOpen={showSampleQuestions}
                    onToggle={() => setShowSampleQuestions(!showSampleQuestions)}
                    onQuestionSelect={handleSampleQuestionSelect}
                    questions={SAMPLE_QUESTIONS}
                    isCollapsed={isCollapsed}
                  />
                </div>
              </div>

              {/* Collapsed state - just sparkle icon */}
              <div className="sidebar-journey-collapsed">
                <button
                  className="sidebar-collapsed-sparkle-btn"
                  onClick={() => setShowSampleQuestions(!showSampleQuestions)}
                >
                  <Sparkles size={20} />
                </button>
                <SampleQuestionsDropdown
                  isOpen={showSampleQuestions}
                  onToggle={() => setShowSampleQuestions(!showSampleQuestions)}
                  onQuestionSelect={handleSampleQuestionSelect}
                  questions={SAMPLE_QUESTIONS}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>

            {/* Discussion list */}
            {discussions.length > 0 && (
              <div className="conversation-group-list">
                {discussions.map((discussion) => (
                  <ConversationItem
                    key={discussion.id}
                    discussion={discussion}
                    isActive={discussion.id === activeDiscussionId}
                    onSelect={() => handleSelectDiscussion(discussion.id)}
                    onDelete={() => deleteDiscussion(discussion.id)}
                    onActivate={() => activateDiscussion(discussion.id)}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            )}
          </>
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
              <span className="sidebar-user-plan">Educator</span>
            </div>
          )}
          {!isCollapsed && (
            <div className="sidebar-user-settings-container" ref={settingsMenuRef}>
              <button
                className="sidebar-user-settings"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                }}
              >
                <Settings size={16} />
              </button>
              {showSettingsMenu && (
                <div className="sidebar-settings-menu">
                  <button className="sidebar-settings-menu-item" onClick={handleHome}>
                    <Home size={14} />
                    <span>Home</span>
                  </button>
                  <button className="sidebar-settings-menu-item" onClick={handleProfile}>
                    <User size={14} />
                    <span>Profile</span>
                  </button>
                  <button className="sidebar-settings-menu-item delete" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact Modal */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
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

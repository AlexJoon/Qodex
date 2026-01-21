import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatArea } from '@/features/chat';
import { useDiscussionStore } from '@/features/discussions';
import { useDocumentStore } from '@/features/documents';
import './App.css';

function ChatPage() {
  const { discussionId } = useParams<{ discussionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveDiscussionId, discussions } = useDiscussionStore();
  const initialMessage = location.state?.initialMessage;

  // URL is the single source of truth - sync URL param to store
  useEffect(() => {
    if (discussionId) {
      // Check if discussion exists before setting
      const exists = discussions.length === 0 || discussions.some((d) => d.id === discussionId);
      if (exists) {
        setActiveDiscussionId(discussionId);
      } else {
        // Invalid discussion ID - redirect to base chat
        navigate('/chat', { replace: true });
      }
    } else {
      // No discussion ID in URL - clear active discussion
      setActiveDiscussionId(null);
    }
  }, [discussionId, discussions, setActiveDiscussionId, navigate]);

  return <ChatArea initialMessage={initialMessage} />;
}

function AppLayout() {
  const { fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:discussionId" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;

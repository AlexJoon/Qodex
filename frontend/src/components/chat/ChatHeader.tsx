import { useState } from 'react';
import { Share2, Download, Loader2 } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { exportConversationToPDF } from '../../services/pdfExport';
import { useChatStore } from '../../stores/chatStore';
import './ChatHeader.css';

interface ChatHeaderProps {
  discussionId: string;
  discussionTitle: string;
}

export function ChatHeader({ discussionId, discussionTitle }: ChatHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { messages } = useChatStore();

  const handleExport = async () => {
    if (isExporting || messages.length === 0) return;

    setIsExporting(true);
    try {
      await exportConversationToPDF({
        messages,
        title: discussionTitle || 'Qodex Conversation',
      });
    } catch (error) {
      console.error('Failed to export conversation:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-actions">
          <button
            className="chat-header-btn"
            onClick={handleExport}
            disabled={isExporting || messages.length === 0}
            title="Export conversation to PDF"
          >
            {isExporting ? <Loader2 size={18} className="spinning" /> : <Download size={18} />}
            <span>Export</span>
          </button>
          <button
            className="chat-header-btn"
            onClick={() => setShowShareModal(true)}
            title="Share conversation"
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        discussionId={discussionId}
        discussionTitle={discussionTitle}
      />
    </>
  );
}

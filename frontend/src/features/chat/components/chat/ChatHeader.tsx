import { useState, useEffect } from 'react';
import { Share2, Download, Loader2, Paperclip } from 'lucide-react';
import { ShareModal } from '../modals/ShareModal';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { exportConversationToPDF } from '@/shared/services/pdfExport';
import { useChatStore } from '../../store';
import { useAttachmentStore } from '@/features/attachments/store';
import './ChatHeader.css';

interface ChatHeaderProps {
  discussionId: string;
  discussionTitle: string;
}

export function ChatHeader({ discussionId, discussionTitle }: ChatHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { messages } = useChatStore();
  const { attachments, fetchAttachments, reset } = useAttachmentStore();

  // Load attachments when discussion changes
  useEffect(() => {
    reset();
    if (discussionId) {
      fetchAttachments(discussionId);
    }
  }, [discussionId, fetchAttachments, reset]);

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
            onClick={() => setShowAttachments(!showAttachments)}
            title="Conversation attachments"
          >
            <Paperclip size={18} />
            <span className="visually-hidden">Attachments</span>
            {attachments.length > 0 && (
              <span className="chat-header-badge">{attachments.length}</span>
            )}
          </button>
          <button
            className="chat-header-btn"
            onClick={handleExport}
            disabled={isExporting || messages.length === 0}
            title="Export conversation to PDF"
          >
            {isExporting ? <Loader2 size={18} className="spinning" /> : <Download size={18} />}
            <span className="visually-hidden">Export</span>
          </button>
          <button
            className="chat-header-btn"
            onClick={() => setShowShareModal(true)}
            title="Share conversation"
          >
            <Share2 size={18} />
            <span className="visually-hidden">Share</span>
          </button>
        </div>

        {showAttachments && (
          <AttachmentPanel
            discussionId={discussionId}
            isOpen={showAttachments}
            onClose={() => setShowAttachments(false)}
          />
        )}
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

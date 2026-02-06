import { useState } from 'react';
import { Modal } from '@/components/ui';
import { Copy, Check, Link } from 'lucide-react';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionId: string;
  discussionTitle: string;
}

export function ShareModal({ isOpen, onClose, discussionId, discussionTitle }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate shareable URL
  const shareUrl = `${window.location.origin}/chat/${discussionId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Conversation" size="md">
      <div className="share-modal-content">
        <div className="share-modal-info">
          <Link size={20} className="share-modal-icon" />
          <div className="share-modal-text">
            <h3 className="share-modal-title">{discussionTitle || 'Untitled Conversation'}</h3>
            <p className="share-modal-description">
              Anyone with this link can view this conversation
            </p>
          </div>
        </div>

        <div className="share-modal-url">
          <div className="share-url-container">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="share-url-input"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
          <button
            onClick={handleCopy}
            className="share-copy-btn"
            title={copied ? 'Copied!' : 'Copy link'}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        <div className="share-modal-footer">
          <p className="share-modal-note">
            This link will remain active as long as the conversation exists.
          </p>
        </div>
      </div>
    </Modal>
  );
}

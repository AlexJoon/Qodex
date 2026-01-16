import { Modal } from '../common/Modal';
import { DocumentPreviewPane } from './DocumentPreviewPane';
import { DocumentChat } from './DocumentChat';
import { useDocumentPreviewStore } from '../../stores/documentPreviewStore';
import { useProviderStore } from '../../stores/providerStore';
import { FileText, X } from 'lucide-react';
import './DocumentPreviewModal.css';

export function DocumentPreviewModal() {
  const {
    previewDocument,
    documentContent,
    isLoading,
    error,
    closeDocumentPreview,
    clearError
  } = useDocumentPreviewStore();

  const { activeProvider } = useProviderStore();

  if (!previewDocument) return null;

  const handleClose = () => {
    clearError();
    closeDocumentPreview();
  };

  return (
    <Modal 
      isOpen={!!previewDocument} 
      onClose={handleClose} 
      title={previewDocument.filename}
      size="xl"
    >
      <div className="document-preview-modal">
        {error && (
          <div className="document-preview-error">
            <span>{error}</span>
            <button onClick={clearError} className="error-close-btn">
              <X size={16} />
            </button>
          </div>
        )}
        
        {isLoading ? (
          <div className="document-preview-loading">
            <div className="loading-spinner"></div>
            <span>Loading document...</span>
          </div>
        ) : (
          <div className="document-preview-content">
            <div className="document-preview-pane">
              <DocumentPreviewPane 
                documentContent={documentContent}
              />
            </div>
            
            <div className="document-chat-pane">
              <DocumentChat 
                documentId={previewDocument.id}
                provider={activeProvider}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

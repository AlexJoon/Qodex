import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui';
import { DocumentSource } from '@/shared/types';
import { api } from '@/shared/services/api';
import { FormattedContent } from '../sources/FormattedContent';
import { exportDocumentToPDF } from '@/shared/services/pdfExport';
import { FileText, ArrowUpRight, Loader2, Download } from 'lucide-react';
import './AllSourcesModal.css';

interface AllSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: DocumentSource[];
  onSourceSelect: (source: DocumentSource) => void;
}

export function AllSourcesModal({
  isOpen,
  onClose,
  sources,
  onSourceSelect,
}: AllSourcesModalProps) {
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Select first source by default when modal opens
  useEffect(() => {
    if (isOpen && sources.length > 0 && !selectedSource) {
      setSelectedSource(sources[0]);
    }
  }, [isOpen, sources, selectedSource]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSource(null);
      setDocumentContent(null);
    }
  }, [isOpen]);

  // Fetch document content when source changes
  useEffect(() => {
    if (!selectedSource) return;

    const fetchContent = async () => {
      setIsLoading(true);
      try {
        const docId = selectedSource.document_id || selectedSource.id;
        const content = await api.getDocumentContent(docId);
        setDocumentContent(content);
      } catch (error) {
        console.error('Failed to fetch document content:', error);
        setDocumentContent(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [selectedSource]);

  const handleSourceClick = (source: DocumentSource) => {
    setSelectedSource(source);
  };

  const handleDiveClick = (source: DocumentSource) => {
    onClose();
    onSourceSelect(source);
  };

  const handleDownloadPDF = async () => {
    if (!documentContent || downloading) return;
    setDownloading(true);
    try {
      await exportDocumentToPDF({
        filename: documentContent.filename,
        fullContent: documentContent.full_content || '',
        chunks: documentContent.chunks,
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`All Sources (${sources.length})`}
      size="xl"
    >
      <div className="all-sources-modal">
        {/* Left Pane - Document Preview */}
        <div className="all-sources-left-pane">
          {isLoading ? (
            <div className="all-sources-loading">
              <Loader2 size={24} className="spinning" />
              <span>Loading document...</span>
            </div>
          ) : documentContent ? (
            <div className="all-sources-document">
              <div className="all-sources-document-header">
                <FileText size={16} />
                <span>{selectedSource?.filename}</span>
                <button
                  className="all-sources-download-btn"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  title="Download as PDF"
                >
                  <Download size={14} />
                  {downloading ? 'Downloading...' : 'PDF'}
                </button>
              </div>
              <div className="all-sources-document-content">
                {documentContent.chunks && documentContent.chunks.length > 0 ? (
                  <FormattedContent
                    chunks={documentContent.chunks}
                    highlightedChunk={selectedSource?.chunk_id}
                  />
                ) : documentContent.full_content ? (
                  <div className="all-sources-full-content">
                    {documentContent.full_content}
                  </div>
                ) : (
                  <div className="all-sources-no-content">No content available</div>
                )}
              </div>
            </div>
          ) : (
            <div className="all-sources-empty">
              Select a source to preview the document
            </div>
          )}
        </div>

        {/* Right Pane - Source Cards */}
        <div className="all-sources-right-pane">
          <div className="all-sources-cards-header">
            Sources
          </div>
          <div className="all-sources-cards-list">
            {sources.map((source) => {
              const isSelected = selectedSource?.chunk_id === source.chunk_id;
              const scorePercent = Math.round(source.score * 100);

              return (
                <div
                  key={source.chunk_id || `${source.id}-${source.citation_number}`}
                  className={`all-sources-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSourceClick(source)}
                >
                  <div className="all-sources-card-header">
                    {source.citation_number && (
                      <span className="all-sources-card-citation">[{source.citation_number}]</span>
                    )}
                    <span className="all-sources-card-filename" title={source.filename}>
                      {source.filename.length > 30
                        ? source.filename.slice(0, 27) + '...'
                        : source.filename}
                    </span>
                    <span className="all-sources-card-score">{scorePercent}%</span>
                  </div>

                  {source.chunk_preview && (
                    <div className="all-sources-card-preview">
                      {source.chunk_preview.length > 100
                        ? source.chunk_preview.slice(0, 97) + '...'
                        : source.chunk_preview}
                    </div>
                  )}

                  <button
                    className="all-sources-card-dive-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDiveClick(source);
                    }}
                  >
                    Dive Deeper
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

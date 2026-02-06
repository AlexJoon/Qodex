import { useState, useRef, useEffect } from 'react';
import { Search, FileText, ZoomIn, ZoomOut, Copy, Check, Download } from 'lucide-react';
import { FormattedContent } from './FormattedContent';
import { exportDocumentToPDF } from '@/shared/services/pdfExport';
import './DocumentPreviewPane.css';

interface DocumentPreviewPaneProps {
  documentContent: any;
  highlightedChunk?: string | null;
  onChunkClick?: (chunkId: string) => void;
}

export function DocumentPreviewPane({
  documentContent,
  highlightedChunk,
  onChunkClick
}: DocumentPreviewPaneProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted chunk when it changes
  useEffect(() => {
    if (!highlightedChunk || !contentRef.current) return;

    // Small delay to ensure DOM has rendered the chunks
    const timer = setTimeout(() => {
      const el = contentRef.current?.querySelector(
        `[data-chunk-id="${highlightedChunk}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightedChunk]);

  if (!documentContent) {
    return (
      <div className="document-preview-pane">
        <div className="document-preview-empty">
          <FileText size={48} className="empty-icon" />
          <h3>No Document Available</h3>
          <p>Document content could not be loaded</p>
        </div>
      </div>
    );
  }

  const chunks = documentContent.chunks || [];
  const fullContent = documentContent.full_content || '';

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadPDF = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await exportDocumentToPDF({
        filename: documentContent.filename,
        fullContent,
        chunks,
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="document-preview-pane">
      {/* Document Header */}
      <div className="document-preview-header">
        <div className="document-info">
          <div className="document-title-wrapper">
            <FileText size={20} className="document-icon" />
            <h3 className="document-title">{documentContent.filename}</h3>
          </div>
        </div>

        <div className="document-controls">
          <div className="search-input-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search in document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="zoom-controls">
            <button onClick={handleZoomOut} className="zoom-btn" title="Zoom out">
              <ZoomOut size={16} />
            </button>
            <span className="zoom-level">{zoomLevel}%</span>
            <button onClick={handleZoomIn} className="zoom-btn" title="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>
          <button
            onClick={handleCopyAll}
            className="copy-all-btn"
            title="Copy all content"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="copy-all-btn"
            title="Download as PDF"
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? 'Downloading...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Document Content - Continuous View */}
      <div className="document-content" ref={contentRef}>
        {chunks.length > 0 ? (
          <FormattedContent
            chunks={chunks}
            searchTerm={searchTerm}
            zoomLevel={zoomLevel}
            onChunkClick={onChunkClick}
            highlightedChunk={highlightedChunk}
          />
        ) : fullContent ? (
          <div className="document-full-content" style={{ fontSize: `${zoomLevel}%` }}>
            <p>{fullContent}</p>
          </div>
        ) : (
          <div className="document-preview-empty">
            <p>No content available</p>
          </div>
        )}
      </div>
    </div>
  );
}

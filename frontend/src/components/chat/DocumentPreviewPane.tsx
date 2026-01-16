import { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Highlight search terms
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  // Navigate chunks
  const goToChunk = (index: number) => {
    if (index >= 0 && index < chunks.length) {
      setCurrentChunkIndex(index);
      // Scroll to chunk
      const chunkElement = document.getElementById(`chunk-${index}`);
      if (chunkElement && contentRef.current) {
        chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const goToPreviousChunk = () => {
    goToChunk(currentChunkIndex - 1);
  };

  const goToNextChunk = () => {
    goToChunk(currentChunkIndex + 1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          <div className="document-meta">
            <span className="document-size">{formatFileSize(documentContent.file_size || 0)}</span>
            <span className="document-chunks-count">{chunks.length} chunks</span>
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
        </div>
      </div>

      {/* Chunk Navigation */}
      {chunks.length > 1 && (
        <div className="chunk-navigation">
          <div className="chunk-info">
            <span className="chunk-current">Chunk {currentChunkIndex + 1}</span>
            <span className="chunk-total">of {chunks.length}</span>
          </div>
          <div className="chunk-nav-buttons">
            <button
              onClick={goToPreviousChunk}
              disabled={currentChunkIndex === 0}
              className="chunk-nav-btn"
              title="Previous chunk"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToNextChunk}
              disabled={currentChunkIndex === chunks.length - 1}
              className="chunk-nav-btn"
              title="Next chunk"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Document Content */}
      <div className="document-content" ref={contentRef} style={{ fontSize: `${zoomLevel}%` }}>
        {chunks.length > 0 ? (
          <div className="document-chunks">
            {chunks.map((chunk: any, index: number) => (
              <div
                key={chunk.id}
                id={`chunk-${index}`}
                className={`document-chunk ${
                  highlightedChunk === chunk.id ? 'highlighted' : ''
                } ${
                  index === currentChunkIndex ? 'current-chunk' : ''
                }`}
                onClick={() => onChunkClick?.(chunk.id)}
              >
                <div className="chunk-header">
                  <div className="chunk-number">
                    <span>Chunk {index + 1}</span>
                    {chunk.chunk_index !== undefined && (
                      <span className="chunk-index">Index: {chunk.chunk_index}</span>
                    )}
                  </div>
                  <div className="chunk-actions">
                    <button 
                      className="chunk-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(chunk.content);
                      }}
                      title="Copy chunk content"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="chunk-content">
                  {highlightText(chunk.content, searchTerm)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="document-full-content">
            <div className="content-header">
              <h4>Full Document Content</h4>
              <button 
                className="copy-btn"
                onClick={() => navigator.clipboard.writeText(fullContent)}
              >
                Copy All
              </button>
            </div>
            <div className="content-body">
              {highlightText(fullContent, searchTerm)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

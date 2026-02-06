import { useRef, useState } from 'react';
import { BadgePlus, Paperclip, Search, Sparkles, BookOpen, X, FileText, Upload, Check } from 'lucide-react';
import { useDocumentStore } from '@/features/documents';
import { useResearchModeStore } from '@/features/research';
import { ResearchMode } from '@/shared/types';
import './InputActionsDropdown.css';

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

const MODE_CONFIG: Record<ResearchMode, { icon: typeof Search; label: string; description: string }> = {
  quick: { icon: Search, label: 'Quick', description: '7 sources - Fast answers' },
  enhanced: { icon: Sparkles, label: 'Enhanced', description: '12 sources - Balanced depth' },
  deep: { icon: BookOpen, label: 'Deep Research', description: '16 sources - Exhaustive analysis' },
};

export function InputActionsDropdown() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    documents,
    selectedDocumentIds,
    isLoading,
    uploadProgress,
    uploadDocument,
    toggleDocumentSelection,
    deleteDocument,
  } = useDocumentStore();

  const { activeMode, setActiveMode, modes } = useResearchModeStore();

  const validateFile = (file: File): boolean => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(extension)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB');
      return false;
    }
    return true;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    const file = files[0];

    if (!validateFile(file)) return;

    try {
      await uploadDocument(file);
      setShowDocuments(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAddFiles = () => {
    if (documents.length > 0) {
      setShowDocuments(true);
      setIsOpen(false);
    } else {
      fileInputRef.current?.click();
      setIsOpen(false);
    }
  };

  const handleModeSelect = (mode: ResearchMode) => {
    setActiveMode(mode);
    setIsOpen(false);
  };

  const activeModeConfig = MODE_CONFIG[activeMode];
  const ActiveModeIcon = activeModeConfig.icon;

  return (
    <div className="input-actions">
      {/* Main trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-actions-trigger"
        title="Actions"
      >
        <BadgePlus size={20} />
        {(selectedDocumentIds.length > 0) && (
          <span className="input-actions-badge">{selectedDocumentIds.length}</span>
        )}
      </button>

      {/* Current research mode indicator */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-actions-mode-indicator"
        title={`Research mode: ${activeModeConfig.label}`}
      >
        <ActiveModeIcon size={14} />
        <span>{activeModeConfig.label}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Dropdown menu */}
      {isOpen && (
        <>
          <div className="input-actions-backdrop" onClick={() => setIsOpen(false)} />
          <div className="input-actions-dropdown">
            {/* File upload option */}
            <button
              type="button"
              className="input-actions-item"
              onClick={handleAddFiles}
            >
              <Paperclip size={18} />
              <div className="input-actions-item-content">
                <span className="input-actions-item-label">Add files</span>
                <span className="input-actions-item-desc">Upload documents for context</span>
              </div>
              {selectedDocumentIds.length > 0 && (
                <span className="input-actions-item-count">{selectedDocumentIds.length}</span>
              )}
            </button>

            <div className="input-actions-divider" />

            {/* Research mode section */}
            <div className="input-actions-section-label">Research Depth</div>

            {modes.map((mode) => {
              const config = MODE_CONFIG[mode.mode];
              const Icon = config.icon;
              const isActive = mode.mode === activeMode;

              return (
                <button
                  key={mode.mode}
                  type="button"
                  className={`input-actions-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleModeSelect(mode.mode)}
                >
                  <Icon size={18} />
                  <div className="input-actions-item-content">
                    <span className="input-actions-item-label">{config.label}</span>
                    <span className="input-actions-item-desc">{config.description}</span>
                  </div>
                  {isActive && <Check size={16} className="input-actions-check" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Documents panel */}
      {showDocuments && documents.length > 0 && (
        <>
          <div className="input-actions-backdrop" onClick={() => setShowDocuments(false)} />
          <div className="input-actions-documents">
            <div className="input-actions-documents-header">
              <span>Documents</span>
              <button onClick={() => setShowDocuments(false)} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="input-actions-documents-list">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`input-actions-doc-item ${selectedDocumentIds.includes(doc.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(doc.id)}
                    onChange={() => toggleDocumentSelection(doc.id)}
                  />
                  <FileText size={16} />
                  <span className="input-actions-doc-name">{doc.filename}</span>
                  <button onClick={() => deleteDocument(doc.id)} type="button">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`input-actions-dropzone ${isDragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              <span>Drop file or click to upload</span>
            </div>
          </div>
        </>
      )}

      {/* Upload Progress */}
      {isLoading && uploadProgress > 0 && (
        <div className="input-actions-progress">
          <div className="input-actions-progress-bar">
            <div
              className="input-actions-progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="input-actions-error">
          {error}
          <button onClick={() => setError(null)} type="button">Dismiss</button>
        </div>
      )}
    </div>
  );
}

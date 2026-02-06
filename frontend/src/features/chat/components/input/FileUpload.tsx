import { useRef, useState } from 'react';
import { Paperclip, X, FileText, Upload } from 'lucide-react';
import { useDocumentStore } from '@/features/documents';
import './FileUpload.css';

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

export function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const {
    documents,
    selectedDocumentIds,
    isLoading,
    uploadProgress,
    uploadDocument,
    toggleDocumentSelection,
    deleteDocument,
  } = useDocumentStore();

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

  return (
    <div className="file-upload">
      {/* Upload Button */}
      <button
        type="button"
        onClick={() => documents.length > 0 ? setShowPanel(!showPanel) : fileInputRef.current?.click()}
        disabled={isLoading}
        className="file-upload-btn"
        title="Upload document"
      >
        <Paperclip size={20} />
        {selectedDocumentIds.length > 0 && (
          <span className="file-upload-badge">
            {selectedDocumentIds.length}
          </span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Document Panel (shows when documents exist and panel is open) */}
      {showPanel && documents.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            className="file-upload-backdrop"
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <div className="file-upload-panel">
            <div className="file-upload-panel-header">
              <span>Documents</span>
              <button
                onClick={() => setShowPanel(false)}
                className="file-upload-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="file-upload-list">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`file-upload-item ${selectedDocumentIds.includes(doc.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(doc.id)}
                    onChange={() => toggleDocumentSelection(doc.id)}
                    className="file-upload-checkbox"
                  />
                  <FileText size={16} className="file-upload-icon" />
                  <span className="file-upload-filename">
                    {doc.filename}
                  </span>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="file-upload-delete-btn"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Upload drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`file-upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} />
              <span>Drop file or click to upload</span>
            </div>
          </div>
        </>
      )}

      {/* Upload Progress */}
      {isLoading && uploadProgress > 0 && (
        <div className="file-upload-progress">
          <div className="file-upload-progress-header">
            <div className="file-upload-progress-dot" />
            <span>Uploading...</span>
          </div>
          <div className="file-upload-progress-bar">
            <div
              className="file-upload-progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="file-upload-error">
          {error}
          <button onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

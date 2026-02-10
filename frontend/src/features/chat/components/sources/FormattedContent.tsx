import './FormattedContent.css';

interface ContentBlock {
  id: string;
  content: string;
  chunk_index: number;
  content_type?: string;
}

interface FormattedContentProps {
  chunks: ContentBlock[];
  searchTerm?: string;
  zoomLevel?: number;
  onChunkClick?: (chunkId: string) => void;
  highlightedChunk?: string | null;
}

export function FormattedContent({
  chunks,
  searchTerm = '',
  zoomLevel = 100,
  onChunkClick,
  highlightedChunk
}: FormattedContentProps) {
  return (
    <div
      className="formatted-content"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      {chunks.map((chunk) => {
        const isHighlighted = highlightedChunk === chunk.id;

        return (
          <div
            key={chunk.id}
            className={`content-block ${isHighlighted ? 'content-block--highlighted' : ''}`}
            onClick={() => onChunkClick?.(chunk.id)}
            data-chunk-id={chunk.id}
          >
            {chunk.content_type === 'heading' ? (
              <h3 className="content-heading">
                {renderWithSearch(chunk.content, searchTerm, chunk.id)}
              </h3>
            ) : chunk.content_type === 'list' ? (
              <pre className="content-list-block">
                {renderWithSearch(chunk.content, searchTerm, chunk.id)}
              </pre>
            ) : (
              <p className="content-paragraph">
                {renderWithSearch(chunk.content, searchTerm, chunk.id)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderWithSearch(text: string, searchTerm: string, keyPrefix: string): React.ReactNode {
  if (!searchTerm) return text;

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={`${keyPrefix}-hl-${i}`} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

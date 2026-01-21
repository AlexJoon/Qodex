import { useMemo } from 'react';
import './FormattedContent.css';

interface ContentBlock {
  id: string;
  content: string;
  chunk_index: number;
  content_type?: string; // heading, paragraph, list
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
  // Parse and render content with structure
  const renderedContent = useMemo(() => {
    return chunks.map((chunk) => {
      const contentType = chunk.content_type || 'paragraph';
      const isHighlighted = highlightedChunk === chunk.id;

      // Split content by newlines to preserve paragraph structure
      const paragraphs = chunk.content.split('\n\n').filter(p => p.trim());

      return (
        <div
          key={chunk.id}
          className={`content-block content-block--${contentType} ${isHighlighted ? 'content-block--highlighted' : ''}`}
          onClick={() => onChunkClick?.(chunk.id)}
          data-chunk-id={chunk.id}
        >
          {paragraphs.map((para, idx) => (
            <ContentParagraph
              key={`${chunk.id}-${idx}`}
              content={para}
              type={contentType}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      );
    });
  }, [chunks, searchTerm, highlightedChunk, onChunkClick]);

  return (
    <div
      className="formatted-content"
      style={{ fontSize: `${zoomLevel}%` }}
    >
      {renderedContent}
    </div>
  );
}

interface ContentParagraphProps {
  content: string;
  type: string;
  searchTerm: string;
}

function ContentParagraph({ content, type, searchTerm }: ContentParagraphProps) {
  const highlightedContent = useMemo(() => {
    if (!searchTerm) return content;

    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    const parts = content.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  }, [content, searchTerm]);

  // Render based on content type
  switch (type) {
    case 'heading':
      return <h2 className="content-heading">{highlightedContent}</h2>;

    case 'list':
    case 'list_item':
      // Parse list items
      const listItems = content.split('\n').filter(line => line.trim());
      return (
        <ul className="content-list">
          {listItems.map((item, idx) => (
            <li key={idx} className="content-list-item">
              {searchTerm ? highlightText(item.replace(/^[•\-*●○]\s*/, '').replace(/^\d+[.)]\s*/, ''), searchTerm) : item.replace(/^[•\-*●○]\s*/, '').replace(/^\d+[.)]\s*/, '')}
            </li>
          ))}
        </ul>
      );

    case 'paragraph':
    default:
      return <p className="content-paragraph">{highlightedContent}</p>;
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term) return text;

  const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

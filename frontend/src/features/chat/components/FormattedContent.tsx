import { useMemo } from 'react';
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
  const renderedContent = useMemo(() => {
    return chunks.map((chunk) => {
      const isHighlighted = highlightedChunk === chunk.id;
      const elements = parseChunkContent(chunk.content, chunk.id, searchTerm, chunk.content_type);

      return (
        <div
          key={chunk.id}
          className={`content-block ${isHighlighted ? 'content-block--highlighted' : ''}`}
          onClick={() => onChunkClick?.(chunk.id)}
          data-chunk-id={chunk.id}
        >
          {elements}
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

type LineType = 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'hr' | 'paragraph';

interface ParsedLine {
  type: LineType;
  text: string;
}

/**
 * Pre-process raw chunk text to normalize structure.
 * PyPDF2 often embeds bullet/numbered items inline without line breaks.
 * This splits them onto their own lines so the line-by-line parser can detect them.
 */
function preprocessContent(content: string): string {
  let text = content;

  // Split inline bullets: "text • item1 • item2" → separate lines
  // Look for bullet chars preceded by content on the same line
  text = text.replace(/([^\n])(\s*[•●○]\s+)/g, '$1\n$2');

  // Split inline numbered items: "text 1. item 2. item" but only when preceded by
  // sentence-ending punctuation or at natural boundaries
  text = text.replace(/([.!?:;])\s+(\d+[.)]\s+[A-Z])/g, '$1\n$2');

  // Split "Class N" patterns common in syllabi onto their own lines
  text = text.replace(/([^\n])\s+(Class\s+\d+)/g, '$1\n$2');

  // Split "UNIT" headers onto their own lines
  text = text.replace(/([^\n])\s+(UNIT\s+[A-Z]+)/g, '$1\n$2');

  // Normalize multiple spaces to single
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text;
}

function classifyLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'paragraph', text: '' };

  // Markdown headings
  if (/^###\s+/.test(trimmed)) return { type: 'h3', text: trimmed.replace(/^###\s+/, '') };
  if (/^##\s+/.test(trimmed)) return { type: 'h2', text: trimmed.replace(/^##\s+/, '') };
  if (/^#\s+/.test(trimmed)) return { type: 'h1', text: trimmed.replace(/^#\s+/, '') };

  // "UNIT ONE:", "UNIT TWO:" etc. - major section headers
  if (/^UNIT\s+[A-Z]+/i.test(trimmed) && trimmed.length < 60) {
    return { type: 'h1', text: trimmed };
  }

  // ALL-CAPS lines as section headings (e.g. "COURSE OVERVIEW", "BACKGROUND")
  if (/^[A-Z][A-Z\s:&,\-]{3,}$/.test(trimmed) && trimmed.length < 80 && trimmed.length > 3) {
    return { type: 'h2', text: trimmed };
  }

  // Short title-case or mixed-case lines that look like section titles
  // e.g. "Course Description and Learning Objectives:" or "Required Readings:"
  if (/^[A-Z][A-Za-z\s,&\-]+:\s*$/.test(trimmed) && trimmed.length < 80) {
    return { type: 'h3', text: trimmed.replace(/:$/, '') };
  }

  // "Class N ... Topic" patterns in syllabi
  if (/^Class\s+\d+/.test(trimmed) && trimmed.length < 120) {
    return { type: 'h3', text: trimmed };
  }

  // Horizontal rules
  if (/^[-_*]{3,}\s*$/.test(trimmed)) return { type: 'hr', text: '' };

  // Bullet lists - match common bullet characters at start of line
  if (/^[•●○]\s+/.test(trimmed)) {
    return { type: 'bullet', text: trimmed.replace(/^[•●○]\s+/, '') };
  }

  // Also match dash bullets but only if short enough to not be a sentence starting with a dash
  if (/^[-*]\s+/.test(trimmed) && trimmed.length < 200) {
    return { type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') };
  }

  // Numbered lists
  if (/^\d+[.)]\s+/.test(trimmed)) {
    return { type: 'numbered', text: trimmed.replace(/^\d+[.)]\s+/, '') };
  }

  return { type: 'paragraph', text: trimmed };
}

function parseChunkContent(content: string, chunkId: string, searchTerm: string, contentType?: string): React.ReactNode[] {
  // Pre-process to split inline structural elements
  const processed = preprocessContent(content);
  const lines = processed.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: 'bullet' | 'numbered'; text: string }[] = [];
  let paragraphBuffer: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) {
        elements.push(
          <p key={`${chunkId}-p-${key++}`} className="content-paragraph">
            {renderInlineFormatting(text, searchTerm, `${chunkId}-p-${key}`)}
          </p>
        );
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      const isOrdered = listBuffer[0].type === 'numbered';
      const Tag = isOrdered ? 'ol' : 'ul';
      const cls = isOrdered ? 'content-ordered-list' : 'content-list';
      elements.push(
        <Tag key={`${chunkId}-list-${key++}`} className={cls}>
          {listBuffer.map((item, idx) => (
            <li key={idx} className="content-list-item">
              {renderInlineFormatting(item.text, searchTerm, `${chunkId}-li-${key}-${idx}`)}
            </li>
          ))}
        </Tag>
      );
      listBuffer = [];
    }
  };

  // If the backend has labeled this chunk as a heading, render the first
  // meaningful line as a heading
  let usedContentTypeHint = false;

  for (const line of lines) {
    const parsed = classifyLine(line);

    // Use backend content_type hint for first non-empty line if it's a heading chunk
    if (!usedContentTypeHint && contentType === 'heading' && parsed.type === 'paragraph' && parsed.text) {
      usedContentTypeHint = true;
      flushList();
      flushParagraph();
      elements.push(
        <h2 key={`${chunkId}-h-${key++}`} className="content-heading-2">
          {renderInlineFormatting(parsed.text, searchTerm, `${chunkId}-h-${key}`)}
        </h2>
      );
      continue;
    }
    usedContentTypeHint = true;

    // Empty line = paragraph break
    if (!parsed.text && parsed.type === 'paragraph') {
      flushList();
      flushParagraph();
      continue;
    }

    if (parsed.type === 'h1' || parsed.type === 'h2' || parsed.type === 'h3') {
      flushList();
      flushParagraph();
      const HeadingTag = parsed.type;
      const cls = parsed.type === 'h1' ? 'content-heading-1' : parsed.type === 'h2' ? 'content-heading-2' : 'content-heading-3';
      elements.push(
        <HeadingTag key={`${chunkId}-h-${key++}`} className={cls}>
          {renderInlineFormatting(parsed.text, searchTerm, `${chunkId}-h-${key}`)}
        </HeadingTag>
      );
      continue;
    }

    if (parsed.type === 'hr') {
      flushList();
      flushParagraph();
      elements.push(<hr key={`${chunkId}-hr-${key++}`} className="content-divider" />);
      continue;
    }

    if (parsed.type === 'bullet' || parsed.type === 'numbered') {
      flushParagraph();
      if (listBuffer.length > 0 && listBuffer[0].type !== parsed.type) {
        flushList();
      }
      listBuffer.push({ type: parsed.type, text: parsed.text });
      continue;
    }

    // Regular paragraph text — accumulate into buffer
    flushList();
    paragraphBuffer.push(parsed.text);
  }

  flushList();
  flushParagraph();

  return elements;
}

function renderInlineFormatting(text: string, searchTerm: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match bold, italic, inline code, and URLs
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(https?:\/\/[^\s),]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      parts.push(...applySearchHighlight(before, searchTerm, `${keyPrefix}-t-${i++}`));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={`${keyPrefix}-b-${i++}`}>
          {applySearchHighlight(match[2], searchTerm, `${keyPrefix}-bs-${i}`)}
        </strong>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <em key={`${keyPrefix}-i-${i++}`}>
          {applySearchHighlight(match[3], searchTerm, `${keyPrefix}-is-${i}`)}
        </em>
      );
    } else if (match[4]) {
      // Inline code
      parts.push(
        <code key={`${keyPrefix}-c-${i++}`} className="content-inline-code">
          {applySearchHighlight(match[4], searchTerm, `${keyPrefix}-cs-${i}`)}
        </code>
      );
    } else if (match[5]) {
      // URL - render as clickable link
      parts.push(
        <a key={`${keyPrefix}-a-${i++}`} href={match[5]} target="_blank" rel="noopener noreferrer" className="content-link">
          {applySearchHighlight(match[5], searchTerm, `${keyPrefix}-as-${i}`)}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...applySearchHighlight(text.slice(lastIndex), searchTerm, `${keyPrefix}-e-${i++}`));
  }

  return parts.length > 0 ? parts : applySearchHighlight(text, searchTerm, `${keyPrefix}-f-0`);
}

function applySearchHighlight(text: string, term: string, keyPrefix: string): React.ReactNode[] {
  if (!term) return [text];

  const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={`${keyPrefix}-hl-${index}`} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

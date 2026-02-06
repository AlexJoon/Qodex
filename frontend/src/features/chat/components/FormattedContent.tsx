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

// ============================================================================
// Utility: structural detection helpers (no keywords — only syntax/statistics)
// ============================================================================

/**
 * Check if text is ALL-CAPS.
 * Every word with letters must be fully uppercase, and at least one word
 * must have 2+ uppercase letters (filters out lone initials).
 */
function isAllCaps(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length < 1) return false;
  let hasSubstantialWord = false;
  for (const word of words) {
    const letters = word.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) continue;
    if (letters !== letters.toUpperCase()) return false;
    if (letters.length >= 2) hasSubstantialWord = true;
  }
  return hasSubstantialWord;
}

/**
 * Check if a line looks like a title/heading based on structure alone:
 *   - 2–8 words, < 80 chars
 *   - starts with a capital letter
 *   - ≥ 50 % of words are capitalised
 *   - does NOT end with sentence-closing punctuation (period is not a heading ender)
 */
function isTitleLike(text: string): boolean {
  const words = text.split(/\s+/);
  const wordCount = words.length;
  if (wordCount < 2 || wordCount > 8) return false;
  if (text.length >= 80) return false;
  if (/[.!?]\s*$/.test(text)) return false;
  if (!/^[A-Z]/.test(text)) return false;
  const capitalWords = words.filter(w => /^[A-Z]/.test(w)).length;
  return capitalWords >= wordCount * 0.5;
}

// ============================================================================
// Phase 1 — Remove noise (watermarks, page artifacts)
// ============================================================================

function removeNoise(text: string): string {
  let t = text;
  // Platform watermark
  t = t.replace(/Downloaded from Qodex[^\n]*/gi, '');
  // "Page X of Y" footers on their own line
  t = t.replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gm, '');
  // Standalone page numbers (1–3 digits alone on a line)
  t = t.replace(/^\s*\d{1,3}\s*$/gm, '');
  return t;
}

// ============================================================================
// Phase 2 — Defragment: rejoin lines broken by PDF text extraction.
//
// Default behaviour is JOIN.  We only start a new logical line when there is
// a strong structural signal (bullet, numbered item, ALL-CAPS, sentence
// boundary followed by capitalised text, etc.).
// ============================================================================

function defragment(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      result.push(buffer.join(' '));
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      result.push('');
      continue;
    }

    if (buffer.length === 0) {
      buffer = [trimmed];
      continue;
    }

    if (isNewLogicalLine(trimmed, buffer)) {
      flush();
      buffer = [trimmed];
    } else {
      // Handle hyphenation: "word-" + "continuation"
      const last = buffer[buffer.length - 1];
      if (last.endsWith('-') && /^[a-z]/.test(trimmed)) {
        buffer[buffer.length - 1] = last.slice(0, -1);
      }
      buffer.push(trimmed);
    }
  }

  flush();
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Should this line start a new logical line rather than joining the buffer?
 *
 * AGGRESSIVE JOIN: defragmentation's only job is undoing PDF line breaks.
 * We only break for unambiguous syntax-based elements (bullets, numbered
 * lists, markdown headings).  ALL structure detection (ALL-CAPS headings,
 * title-case headings, sentence boundaries) is deferred to Phase 3
 * (splitInlineStructure) and Phase 4 (classifyLine), which operate on
 * already-joined text.
 */
function isNewLogicalLine(line: string, buffer: string[]): boolean {
  // Bullet point (unicode)
  if (/^[•●○]\s/.test(line)) return true;
  // Dash / star bullet
  if (/^[-*]\s/.test(line) && line.length < 200) return true;
  // Numbered list item
  if (/^\d+[.)]\s/.test(line)) return true;
  // Markdown heading
  if (/^#{1,3}\s/.test(line)) return true;
  // Horizontal rule
  if (/^[-_*]{3,}\s*$/.test(line)) return true;

  // After a sentence boundary, only break if the new line is SUBSTANTIAL
  // (>= 40 chars).  Short fragments (single words, partial phrases) always
  // join regardless — they are PDF extraction artefacts.
  const prevText = buffer.join(' ');
  const prevEndedSentence = /[.!?]\s*$/.test(prevText);
  if (prevEndedSentence && /^[A-Z]/.test(line) && line.length >= 40) return true;

  // Everything else: JOIN
  return false;
}

// ============================================================================
// Phase 3 — Split inline structural elements that PDF extraction ran together.
// ============================================================================

function splitInlineStructure(text: string): string {
  let r = text;

  // Inline bullet characters: "text • item1 • item2" → separate lines
  r = r.replace(/([^\n])(\s*[•●○]\s+)/g, '$1\n$2');

  // Inline numbered items after terminal punctuation
  r = r.replace(/([.!?:;])\s+(\d+[.)]\s+[A-Z])/g, '$1\n$2');

  // Inline ALL-CAPS headers (2+ genuine caps words) between body text
  r = splitInlineCapsHeaders(r);

  // Inline dash-prefixed bullet items
  r = r.replace(/([^\n-])\s+(- [A-Za-z])/g, '$1\n$2');

  // Normalise multiple spaces
  r = r.replace(/[ \t]{2,}/g, ' ');

  return r;
}

/**
 * Find ALL-CAPS word runs that appear inline and break them onto their own
 * lines.  Detection is purely casing-based — no keywords.
 */
function splitInlineCapsHeaders(text: string): string {
  let r = text;

  // After sentence punctuation: 2+ ALL-CAPS words → split before & after
  r = r.replace(
    /([.!?)\d])\s+((?:[A-Z][A-Z\d&,\-()/%]+)(?:\s+(?:[A-Z][A-Z\d&,\-()/%]+|\w{1,3}))+)\s+(?=[A-Z][a-z])/g,
    (_match, before, capsRun) => {
      if (countGenuineCapsWords(capsRun) >= 2) return `${before}\n${capsRun.trim()}\n`;
      return _match;
    }
  );

  // Same pattern but at end of string (no following mixed-case word)
  r = r.replace(
    /([.!?)\d])\s+((?:[A-Z][A-Z\d&,\-()/%]+)(?:\s+(?:[A-Z][A-Z\d&,\-()/%]+|\w{1,3}))+)\s*$/g,
    (_match, before, capsRun) => {
      if (countGenuineCapsWords(capsRun) >= 2) return `${before}\n${capsRun.trim()}`;
      return _match;
    }
  );

  // 3+ ALL-CAPS words preceded by any character (stronger signal)
  r = r.replace(
    /([^\n])\s+((?:[A-Z]{2,})(?:\s+(?:[A-Z]{2,}|\w{1,3})){2,})\s+(?=[A-Z][a-z])/g,
    (_match, before, capsRun) => {
      if (countGenuineCapsWords(capsRun) >= 3) return `${before}\n${capsRun.trim()}\n`;
      return _match;
    }
  );
  r = r.replace(
    /([^\n])\s+((?:[A-Z]{2,})(?:\s+(?:[A-Z]{2,}|\w{1,3})){2,})\s*$/g,
    (_match, before, capsRun) => {
      if (countGenuineCapsWords(capsRun) >= 3) return `${before}\n${capsRun.trim()}`;
      return _match;
    }
  );

  return r;
}

/** Count words in a string that are genuinely ALL-CAPS (2+ uppercase letters). */
function countGenuineCapsWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => {
    const letters = w.replace(/[^a-zA-Z]/g, '');
    return letters.length >= 2 && letters === letters.toUpperCase();
  }).length;
}

// ============================================================================
// Phase 4 — Classify each line into a structural type.
// Uses ONLY syntax / casing / length / punctuation — zero keyword matching.
// ============================================================================

function classifyLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'paragraph', text: '' };

  // ---- Explicit syntax-based patterns ----

  // Markdown headings
  if (/^###\s+/.test(trimmed)) return { type: 'h3', text: trimmed.replace(/^###\s+/, '') };
  if (/^##\s+/.test(trimmed))  return { type: 'h2', text: trimmed.replace(/^##\s+/, '') };
  if (/^#\s+/.test(trimmed))   return { type: 'h1', text: trimmed.replace(/^#\s+/, '') };

  // Horizontal rules
  if (/^[-_*]{3,}\s*$/.test(trimmed)) return { type: 'hr', text: '' };

  // Bullet lists (unicode bullets)
  if (/^[•●○]\s+/.test(trimmed)) {
    return { type: 'bullet', text: trimmed.replace(/^[•●○]\s+/, '') };
  }
  // Dash / star bullets (length guard avoids matching long sentences starting with a dash)
  if (/^[-*]\s+/.test(trimmed) && trimmed.length < 200) {
    return { type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') };
  }

  // Numbered lists
  if (/^\d+[.)]\s+/.test(trimmed)) {
    return { type: 'numbered', text: trimmed.replace(/^\d+[.)]\s+/, '') };
  }

  // ---- Statistical heading detection (no keywords) ----

  // ALL-CAPS lines → h2
  if (isAllCaps(trimmed) && trimmed.length > 3 && trimmed.length < 100) {
    return { type: 'h2', text: trimmed };
  }

  // Short line ending with colon and nothing after it → h3
  // e.g. "Course Description:", "Required Readings:", "Grading Policy:"
  if (/^[A-Z][A-Za-z\s,&\-']+:\s*$/.test(trimmed) && trimmed.length < 80) {
    return { type: 'h3', text: trimmed.replace(/:\s*$/, '') };
  }

  // Title-like line (2–8 words, mostly capitalised, no sentence-end punctuation)
  if (isTitleLike(trimmed)) {
    // Word + Number pattern → h2 (slightly higher prominence)
    if (/^[A-Z]\w+\s+\d+/.test(trimmed)) {
      return { type: 'h2', text: trimmed };
    }
    return { type: 'h3', text: trimmed };
  }

  return { type: 'paragraph', text: trimmed };
}

// ============================================================================
// Pipeline: content → noise removal → defragment → inline split → classify → render
// ============================================================================

function processContent(content: string): string {
  let text = removeNoise(content);
  text = defragment(text);
  text = splitInlineStructure(text);
  return text;
}

function parseChunkContent(
  content: string,
  chunkId: string,
  searchTerm: string,
  contentType?: string
): React.ReactNode[] {
  const processed = processContent(content);
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

  // Backend content_type hint: if chunk is labeled "heading", render
  // the first meaningful line as a heading even if classifier disagrees.
  let usedContentTypeHint = false;

  for (const line of lines) {
    const parsed = classifyLine(line);

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

    // Empty line → paragraph break
    if (!parsed.text && parsed.type === 'paragraph') {
      flushList();
      flushParagraph();
      continue;
    }

    if (parsed.type === 'h1' || parsed.type === 'h2' || parsed.type === 'h3') {
      flushList();
      flushParagraph();
      const HeadingTag = parsed.type;
      const cls =
        parsed.type === 'h1' ? 'content-heading-1' :
        parsed.type === 'h2' ? 'content-heading-2' : 'content-heading-3';
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

// ============================================================================
// Inline formatting (bold, italic, code, URLs, grade labels)
// ============================================================================

function renderInlineFormatting(text: string, searchTerm: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(https?:\/\/[^\s),]+)|^((?:[A-D][+-]?(?:\/[A-D][+-]?)?):))/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      parts.push(...applySearchHighlight(before, searchTerm, `${keyPrefix}-t-${i++}`));
    }

    if (match[2]) {
      parts.push(
        <strong key={`${keyPrefix}-b-${i++}`}>
          {applySearchHighlight(match[2], searchTerm, `${keyPrefix}-bs-${i}`)}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={`${keyPrefix}-i-${i++}`}>
          {applySearchHighlight(match[3], searchTerm, `${keyPrefix}-is-${i}`)}
        </em>
      );
    } else if (match[4]) {
      parts.push(
        <code key={`${keyPrefix}-c-${i++}`} className="content-inline-code">
          {applySearchHighlight(match[4], searchTerm, `${keyPrefix}-cs-${i}`)}
        </code>
      );
    } else if (match[5]) {
      parts.push(
        <a key={`${keyPrefix}-a-${i++}`} href={match[5]} target="_blank" rel="noopener noreferrer" className="content-link">
          {applySearchHighlight(match[5], searchTerm, `${keyPrefix}-as-${i}`)}
        </a>
      );
    } else if (match[6]) {
      parts.push(
        <strong key={`${keyPrefix}-gl-${i++}`}>
          {applySearchHighlight(match[6], searchTerm, `${keyPrefix}-gls-${i}`)}
        </strong>
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

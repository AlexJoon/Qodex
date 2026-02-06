import { memo, useMemo } from 'react';

interface StreamingContentProps {
  content: string;
}

/**
 * Lightweight markdown renderer used only during streaming.
 * Uses fast regex transforms instead of a full AST parser (ReactMarkdown)
 * to keep per-chunk re-renders cheap. Once streaming completes, ChatMessage
 * swaps this out for the full ReactMarkdown renderer.
 *
 * HTML entities are escaped before any transforms, so the output is safe
 * for dangerouslySetInnerHTML even though the content comes from an LLM.
 */
export const StreamingContent = memo(function StreamingContent({
  content,
}: StreamingContentProps) {
  const html = useMemo(() => renderLightMarkdown(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

// ---------------------------------------------------------------------------
// Fast regex-based markdown → HTML
// ---------------------------------------------------------------------------

function renderLightMarkdown(text: string): string {
  // 1. Escape HTML entities (prevents XSS)
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Fenced code blocks — extract and protect from inline transforms
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `\x00CB${idx}\x00`;
  });

  // 3. Inline code (before other inline transforms)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 4. Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 5. Bold then italic (order matters — ** before *)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 6. Horizontal rules
  html = html.replace(/^---$/gm, '<hr/>');

  // 7. List items — indent visually without real <ul>/<ol> nesting
  html = html.replace(/^[-*+] (.+)$/gm, '<div class="streaming-li">\u2022 $1</div>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div class="streaming-li">$1. $2</div>');

  // 8. Double newlines → paragraph break, single newlines → <br>
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // 9. Restore protected code blocks
  html = html.replace(/\x00CB(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx)]);

  return `<p>${html}</p>`;
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Copy, Check, Download, Loader2, RotateCcw } from 'lucide-react';
import { Message } from '../../types';
import { useState, useMemo, memo } from 'react';
import { SourcesDisplay } from './SourcesDisplay';
import { exportMessageToPDF } from '../../services/pdfExport';
import './ChatMessage.css';

// Common emojis used as list markers
const listEmojis = [
  '✅', '❌', '✓', '✗', '•', '◦', '▪', '▫', '►', '▸',
  '🔥', '⚡', '🌿', '💡', '🎯', '🚀', '⭐', '🔴', '🟢', '🔵',
  '🟡', '🟠', '🟣', '⚪', '⚫', '📌', '📍', '🔸', '🔹', '🔶',
  '🔷', '💎', '🏆', '🎉', '🎊', '✨', '💫', '🌟', '⚠️', '❗',
  '❓', '❕', '❔', '➡️', '➜', '→', '⇒', '▶️', '☑️', '☐',
  '☒', '🔘', '🔲', '🔳', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩',
  '🟦', '🟪', '⏩', '⏭️', '👉', '👆', '👇', '☀️', '🌙', '💰',
  '📊', '📈', '📉', '🔑', '🔒', '🔓', '💪', '🤝', '👍', '👎'
];

// Pre-compile regex patterns once at module load (not per render)
const emojiPattern = listEmojis.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const emojiMatchRegex = new RegExp(`(${emojiPattern})\\s+[^${emojiPattern}]+`, 'g');
const emojiSplitRegex = new RegExp(`(?=${emojiPattern}\\s)`, 'g');
const listItemRegex = /^[-*+]\s/;
const numberedListRegex = /^\d+\.\s/;
const emojiListLineRegex = /^- [^\s]/;

// Create a Set for O(1) emoji lookup instead of O(n) array iteration
const emojiSet = new Set(listEmojis);

function startsWithEmoji(text: string): boolean {
  // Check first few characters (emojis can be 1-4 chars)
  for (let i = 1; i <= 4 && i <= text.length; i++) {
    if (emojiSet.has(text.slice(0, i))) return true;
  }
  return false;
}

function processEmojiLists(content: string): string {
  const lines = content.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Reset regex lastIndex for global regex reuse
    emojiMatchRegex.lastIndex = 0;
    const emojiMatches = line.match(emojiMatchRegex);

    if (emojiMatches && emojiMatches.length > 1) {
      const items = line.split(emojiSplitRegex).filter(Boolean);
      items.forEach(item => {
        const trimmed = item.trim();
        if (trimmed) {
          if (startsWithEmoji(trimmed)) {
            processedLines.push(`- ${trimmed}`);
          } else {
            processedLines.push(trimmed);
          }
        }
      });
    } else {
      const trimmedLine = line.trim();
      const hasEmoji = startsWithEmoji(trimmedLine);
      const isAlreadyListItem = listItemRegex.test(trimmedLine) || numberedListRegex.test(trimmedLine);

      if (hasEmoji && !isAlreadyListItem && trimmedLine.length > 2) {
        const prevLine = processedLines[processedLines.length - 1];
        const prevIsEmojiList = prevLine && emojiListLineRegex.test(prevLine);

        if (prevIsEmojiList || (i > 0 && startsWithEmoji(lines[i-1].trim()))) {
          processedLines.push(`- ${trimmedLine}`);
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }
  }

  return processedLines.join('\n');
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: (content: string) => void;
}

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  mistral: 'Mistral',
  claude: 'Claude',
  cohere: 'Cohere',
};

// Pre-define markdown components outside component to avoid recreation
const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const isInline = !className;
    if (isInline) {
      return <code className="inline-code" {...props}>{children}</code>;
    }
    return (
      <pre className="code-block">
        <code {...props}>{children}</code>
      </pre>
    );
  },
  p({ children }: { children?: React.ReactNode }) {
    return <p>{children}</p>;
  },
  ul({ children }: { children?: React.ReactNode }) {
    return <ul>{children}</ul>;
  },
  ol({ children }: { children?: React.ReactNode }) {
    return <ol>{children}</ol>;
  },
  li({ children }: { children?: React.ReactNode }) {
    return <li>{children}</li>;
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }: { children?: React.ReactNode }) {
    return <table className="markdown-table">{children}</table>;
  },
  thead({ children }: { children?: React.ReactNode }) {
    return <thead>{children}</thead>;
  },
  tbody({ children }: { children?: React.ReactNode }) {
    return <tbody>{children}</tbody>;
  },
  tr({ children }: { children?: React.ReactNode }) {
    return <tr>{children}</tr>;
  },
  th({ children }: { children?: React.ReactNode }) {
    return <th>{children}</th>;
  },
  td({ children }: { children?: React.ReactNode }) {
    return <td>{children}</td>;
  },
  hr() {
    return <hr />;
  },
  h1({ children }: { children?: React.ReactNode }) {
    return <h1>{children}</h1>;
  },
  h2({ children }: { children?: React.ReactNode }) {
    return <h2>{children}</h2>;
  },
  h3({ children }: { children?: React.ReactNode }) {
    return <h3>{children}</h3>;
  },
  h4({ children }: { children?: React.ReactNode }) {
    return <h4>{children}</h4>;
  },
};

const remarkPlugins = [remarkGfm];

export const ChatMessage = memo(function ChatMessage({ message, isStreaming, onRetry }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Memoize processed content to avoid re-processing on every render
  const processedContent = useMemo(
    () => processEmojiLists(message.content),
    [message.content]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMessageToPDF({
        content: message.content,
        provider: message.provider,
        timestamp: message.timestamp,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleRetry = async () => {
    if (retrying || !onRetry) return;
    setRetrying(true);
    try {
      await onRetry(message.content);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="message-content">
        <div className="message-header">
          <span className="message-author">{isUser ? 'You' : 'Qodex'}</span>
          {!isUser && message.provider && (
            <span className={`message-provider ${message.provider}`}>
              {providerNames[message.provider] || message.provider}
            </span>
          )}
          {message.response_time_ms && (
            <span className="message-time">
              {(message.response_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {!isStreaming && (
            <>
              {!isUser && onRetry && (
                <button className="message-retry" onClick={handleRetry} title="Retry question" disabled={retrying}>
                  {retrying ? <Loader2 size={14} className="spinning" /> : <RotateCcw size={14} />}
                </button>
              )}
              <button className="message-export" onClick={handleExportPDF} title="Export to PDF" disabled={exporting}>
                {exporting ? <Loader2 size={14} className="spinning" /> : <Download size={14} />}
              </button>
              <button className="message-copy" onClick={handleCopy} title="Copy message">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </>
          )}
        </div>

        <div className="message-body">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {processedContent}
          </ReactMarkdown>

          {/* Show source documents for assistant messages */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <SourcesDisplay sources={message.sources} />
          )}
        </div>
      </div>
    </div>
  );
});

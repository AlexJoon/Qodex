import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useDiscussionStore } from '../../stores/discussionStore';
import { useProviderStore } from '../../stores/providerStore';
import { useSSE } from '../../hooks/useSSE';
import { api } from '../../services/api';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Code, Lightbulb, FileText, Sparkles, HelpCircle, BookOpen } from 'lucide-react';
import './ChatArea.css';

// Throttle function for scroll operations
function useThrottledScroll(delay: number = 100) {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((element: HTMLElement | null, behavior: ScrollBehavior) => {
    if (!element) return;

    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now;
      element.scrollIntoView({ behavior });
    } else if (!timeoutRef.current) {
      // Schedule a scroll at the end of the throttle period
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        element.scrollIntoView({ behavior });
        timeoutRef.current = null;
      }, delay - timeSinceLastCall);
    }
  }, [delay]);
}

export function ChatArea() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const { messages, isStreaming, currentStreamContent, currentStreamProvider, currentStreamSources, setMessages } =
    useChatStore();
  const { activeDiscussionId, discussions } = useDiscussionStore();
  const { fetchProviders } = useProviderStore();
  const { sendMessage } = useSSE();
  const throttledScroll = useThrottledScroll(100); // Throttle to max 10 scrolls/second

  // Handler for retrying a message - finds the preceding user message and re-sends it
  const handleRetry = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;

      // Find the preceding user message
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          sendMessage(messages[i].content);
          break;
        }
      }
    },
    [messages, sendMessage]
  );

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (activeDiscussionId) {
      const discussion = discussions.find((d) => d.id === activeDiscussionId);
      if (discussion) {
        setMessages(discussion.messages);
      } else {
        api.getDiscussion(activeDiscussionId).then((d) => {
          setMessages(d.messages);
        });
      }
    } else {
      setMessages([]);
    }
  }, [activeDiscussionId, discussions, setMessages]);

  useEffect(() => {
    // Throttle scroll during streaming, smooth scroll on new messages
    if (isStreaming) {
      throttledScroll(messagesEndRef.current, 'instant');
    } else {
      // Direct scroll for final message (not throttled)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentStreamContent, isStreaming, throttledScroll]);

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={`chat-area ${isEmpty ? 'empty' : ''}`}>
      {isEmpty ? (
        /* Centered layout when empty - like Copilot */
        <>
          <EmptyState />
          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <ChatInput
                initialValue={inputValue}
                onValueChange={setInputValue}
              />
            </div>
          </div>
          <QuickActions onSelectAction={handleQuickAction} />
        </>
      ) : (
        /* Normal layout with messages */
        <>
          <div className="chat-messages">
            <div className="chat-messages-inner">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRetry={() => handleRetry(message.id)}
                />
              ))}

              {isStreaming && currentStreamContent && (
                <ChatMessage
                  message={{
                    id: 'streaming',
                    content: currentStreamContent,
                    role: 'assistant',
                    provider: currentStreamProvider || undefined,
                    timestamp: new Date().toISOString(),
                    sources: currentStreamSources.length > 0 ? currentStreamSources : undefined,
                  }}
                  isStreaming
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <ChatInput
                initialValue={inputValue}
                onValueChange={setInputValue}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
}

function QuickActions({ onSelectAction }: QuickActionsProps) {
  const quickActions = [
    { icon: Code, label: 'Write code', prompt: 'Help me write code for ' },
    { icon: Lightbulb, label: 'Explain concept', prompt: 'Explain the concept of ' },
    { icon: FileText, label: 'Summarize text', prompt: 'Summarize the following text: ' },
    { icon: Sparkles, label: 'Brainstorm ideas', prompt: 'Help me brainstorm ideas for ' },
    { icon: HelpCircle, label: 'Answer questions', prompt: 'I have a question about ' },
    { icon: BookOpen, label: 'Learn something', prompt: 'Teach me about ' },
  ];

  return (
    <div className="quick-actions">
      {quickActions.map((action) => (
        <button
          key={action.label}
          className="quick-action-btn"
          onClick={() => onSelectAction(action.prompt)}
        >
          <action.icon size={16} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h1 className="empty-state-title">How can I help you today?</h1>
      <p className="empty-state-subtitle">
        Select an AI provider and ask me anything. I can help with coding, writing, analysis, and more.
      </p>
    </div>
  );
}

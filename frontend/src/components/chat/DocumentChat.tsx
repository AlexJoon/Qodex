import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Bot, User } from 'lucide-react';
import { useDocumentPreviewStore } from '../../stores/documentPreviewStore';
import { useProviderStore } from '../../stores/providerStore';
import { ProviderToggles } from './ProviderToggles';
import './DocumentChat.css';

interface DocumentChatProps {
  documentId: string;
  provider?: string;
}

export function DocumentChat({ documentId, provider }: DocumentChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    documentChatMessages,
    documentChatContent,
    isDocumentChatStreaming,
    sendDocumentChatMessage,
    clearDocumentChat
  } = useDocumentPreviewStore();

  const { activeProvider, setActiveProvider } = useProviderStore();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [documentChatMessages, documentChatContent]);

  const handleSend = async () => {
    if (!inputValue.trim() || isDocumentChatStreaming) return;

    const message = inputValue.trim();
    setInputValue('');
    
    await sendDocumentChatMessage(message, activeProvider);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="document-chat">
      <div className="document-chat-header">
        <div className="chat-header-title">
          <MessageSquare size={18} />
          <span>Chat with Document</span>
        </div>
        
        <div className="chat-header-controls">
          <ProviderToggles 
            selectedProvider={activeProvider}
            onProviderChange={setActiveProvider}
            compact={true}
          />
          <button 
            onClick={clearDocumentChat}
            className="clear-chat-btn"
            title="Clear chat"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="document-chat-messages">
        {documentChatMessages.length === 0 && !isDocumentChatStreaming && (
          <div className="chat-welcome">
            <Bot size={24} className="welcome-icon" />
            <h4>Ask about this document</h4>
            <p>
              I can help you understand the content, answer questions, and find specific information in this document.
            </p>
            <div className="welcome-suggestions">
              <button 
                onClick={() => setInputValue("What is this document about?")}
                className="suggestion-btn"
              >
                What is this document about?
              </button>
              <button 
                onClick={() => setInputValue("Summarize the key points")}
                className="suggestion-btn"
              >
                Summarize the key points
              </button>
              <button 
                onClick={() => setInputValue("What are the main findings?")}
                className="suggestion-btn"
              >
                What are the main findings?
              </button>
            </div>
          </div>
        )}

        {documentChatMessages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.role}`}
          >
            <div className="message-avatar">
              {message.role === 'user' ? (
                <User size={16} />
              ) : (
                <Bot size={16} />
              )}
            </div>
            <div className="message-content">
              <div className="message-text">
                {message.content}
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isDocumentChatStreaming && (
          <div className="chat-message assistant streaming">
            <div className="message-avatar">
              <Bot size={16} />
            </div>
            <div className="message-content">
              <div className="message-text">
                {documentChatContent}
                <span className="streaming-cursor">|</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="document-chat-input">
        <div className="input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about this document..."
            className="chat-input"
            rows={1}
            disabled={isDocumentChatStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isDocumentChatStreaming}
            className="send-button"
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

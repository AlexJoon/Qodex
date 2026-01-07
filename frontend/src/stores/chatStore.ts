import { create } from 'zustand';
import { Message, MessageRole, DocumentSource } from '../types';

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamContent: string;
  currentStreamProvider: string | null;
  currentStreamSources: DocumentSource[];
  error: string | null;
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  startStream: (provider: string) => void;
  appendToStream: (chunk: string) => void;
  setStreamSources: (sources: DocumentSource[]) => void;
  finalizeStream: (messageId: string) => void;
  cancelStream: () => void;
  clearMessages: () => void;
  clearError: () => void;
}

type ChatStore = ChatState & ChatActions;

// Batching mechanism for stream updates
let pendingChunks: string[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const BATCH_INTERVAL_MS = 50; // Batch updates every 50ms instead of per-chunk

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messages: [],
  isStreaming: false,
  currentStreamContent: '',
  currentStreamProvider: null,
  currentStreamSources: [],
  error: null,

  // Actions
  setMessages: (messages: Message[]) => {
    set({ messages });
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [...state.messages, message],
    }));
  },

  startStream: (provider: string) => {
    // Clear any pending batches
    pendingChunks = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    set({
      isStreaming: true,
      currentStreamContent: '',
      currentStreamProvider: provider,
      currentStreamSources: [],
      error: null,
    });
  },

  appendToStream: (chunk: string) => {
    // Batch chunks instead of updating state immediately
    pendingChunks.push(chunk);

    if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        const batchedContent = pendingChunks.join('');
        pendingChunks = [];
        flushTimeout = null;

        set(state => ({
          currentStreamContent: state.currentStreamContent + batchedContent,
        }));
      }, BATCH_INTERVAL_MS);
    }
  },

  setStreamSources: (sources: DocumentSource[]) => {
    set({ currentStreamSources: sources });
  },

  finalizeStream: (messageId: string) => {
    // Flush any pending chunks before finalizing
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    const remainingContent = pendingChunks.join('');
    pendingChunks = [];

    const state = get();
    const finalContent = state.currentStreamContent + remainingContent;

    const assistantMessage: Message = {
      id: messageId,
      content: finalContent,
      role: 'assistant' as MessageRole,
      provider: state.currentStreamProvider || undefined,
      timestamp: new Date().toISOString(),
      sources: state.currentStreamSources.length > 0 ? state.currentStreamSources : undefined,
    };

    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
    }));
  },

  cancelStream: () => {
    // Clear pending batches on cancel
    pendingChunks = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    set({
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
    });
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  clearError: () => set({ error: null }),
}));

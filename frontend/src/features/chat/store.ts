import { create } from 'zustand';
import { Message, MessageRole, DocumentSource } from '@/shared/types';
import { api } from '@/shared/services/api';

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamContent: string;
  currentStreamProvider: string | null;
  currentStreamSources: DocumentSource[];
  currentStreamSuggestedQuestions: string[];
  error: string | null;
  isLoadingMessages: boolean;
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  loadMessagesForDiscussion: (discussionId: string | null) => Promise<void>;
  startStream: (provider: string) => void;
  appendToStream: (chunk: string) => void;
  setStreamSources: (sources: DocumentSource[]) => void;
  setStreamSuggestedQuestions: (questions: string[]) => void;
  finalizeStream: (messageId: string) => void;
  cancelStream: () => void;
  clearMessages: () => void;
  clearError: () => void;
}

type ChatStore = ChatState & ChatActions;


export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messages: [],
  isStreaming: false,
  currentStreamContent: '',
  currentStreamProvider: null,
  currentStreamSources: [],
  currentStreamSuggestedQuestions: [],
  error: null,
  isLoadingMessages: false,

  // Actions
  setMessages: (messages: Message[]) => {
    set({ messages });
  },

  loadMessagesForDiscussion: async (discussionId: string | null) => {
    if (!discussionId) {
      set({ messages: [], isLoadingMessages: false });
      return;
    }

    set({ isLoadingMessages: true, error: null });
    try {
      const discussion = await api.getDiscussion(discussionId);
      set({ messages: discussion.messages, isLoadingMessages: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoadingMessages: false });
    }
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [...state.messages, message],
    }));
  },

  startStream: (provider: string) => {
    set({
      isStreaming: true,
      currentStreamContent: '',
      currentStreamProvider: provider,
      currentStreamSources: [],
      currentStreamSuggestedQuestions: [],
      error: null,
    });
  },

  appendToStream: (chunk: string) => {
    set(state => ({
      currentStreamContent: state.currentStreamContent + chunk,
    }));
  },

  setStreamSources: (sources: DocumentSource[]) => {
    set({ currentStreamSources: sources });
  },

  setStreamSuggestedQuestions: (questions: string[]) => {
    set({ currentStreamSuggestedQuestions: questions });
  },

  finalizeStream: (messageId: string) => {
    const state = get();

    const assistantMessage: Message = {
      id: messageId,
      content: state.currentStreamContent,
      role: 'assistant' as MessageRole,
      provider: state.currentStreamProvider || undefined,
      timestamp: new Date().toISOString(),
      sources: state.currentStreamSources.length > 0 ? state.currentStreamSources : undefined,
      suggested_questions: state.currentStreamSuggestedQuestions.length > 0 ? state.currentStreamSuggestedQuestions : undefined,
    };

    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
      currentStreamSuggestedQuestions: [],
    }));
  },

  cancelStream: () => {
    set({
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
      currentStreamSuggestedQuestions: [],
    });
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  clearError: () => set({ error: null }),
}));

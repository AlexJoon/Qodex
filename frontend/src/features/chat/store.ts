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
  currentStreamIntent: { intent: string; label: string } | null;
  error: string | null;
  isLoadingMessages: boolean;
  _skipNextMessageLoad: boolean;
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  loadMessagesForDiscussion: (discussionId: string | null) => Promise<void>;
  skipNextMessageLoad: () => void;
  startStream: (provider: string) => void;
  appendToStream: (chunk: string) => void;
  setStreamSources: (sources: DocumentSource[]) => void;
  setStreamSuggestedQuestions: (questions: string[]) => void;
  setStreamIntent: (intent: string, label: string) => void;
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
  currentStreamIntent: null,
  error: null,
  isLoadingMessages: false,
  _skipNextMessageLoad: false,

  // Actions
  setMessages: (messages: Message[]) => {
    set({ messages });
  },

  loadMessagesForDiscussion: async (discussionId: string | null) => {
    if (!discussionId) {
      set({ messages: [], isLoadingMessages: false });
      return;
    }

    // Skip if a new discussion was just created — messages are managed by sendMessage
    if (get()._skipNextMessageLoad) {
      set({ _skipNextMessageLoad: false });
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

  skipNextMessageLoad: () => {
    set({ _skipNextMessageLoad: true });
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
      currentStreamIntent: null,
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

  setStreamIntent: (intent: string, label: string) => {
    set({ currentStreamIntent: { intent, label } });
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
      intent: state.currentStreamIntent?.intent || undefined,
    };

    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
      currentStreamSuggestedQuestions: [],
      currentStreamIntent: null,
    }));
  },

  cancelStream: () => {
    set({
      isStreaming: false,
      currentStreamContent: '',
      currentStreamProvider: null,
      currentStreamSources: [],
      currentStreamSuggestedQuestions: [],
      currentStreamIntent: null,
    });
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  clearError: () => set({ error: null }),
}));

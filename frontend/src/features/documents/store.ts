import { create } from 'zustand';
import { Document } from '@/shared/types';
import { api } from '@/shared/services/api';

interface DocumentState {
  documents: Document[];
  selectedDocumentIds: string[];
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
}

interface DocumentActions {
  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: File) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  toggleDocumentSelection: (id: string) => void;
  selectAllDocuments: () => void;
  clearSelection: () => void;
  clearError: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  // State
  documents: [],
  selectedDocumentIds: [],
  isLoading: false,
  uploadProgress: 0,
  error: null,

  // Actions
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const documents = await api.getDocuments();
      set({ documents, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  uploadDocument: async (file: File) => {
    set({ isLoading: true, uploadProgress: 0, error: null });
    try {
      // Simulate progress (actual progress would need XMLHttpRequest)
      set({ uploadProgress: 30 });

      const document = await api.uploadDocument(file);

      set({ uploadProgress: 100 });

      set(state => ({
        documents: [...state.documents, document],
        isLoading: false,
        uploadProgress: 0,
      }));

      return document;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false, uploadProgress: 0 });
      throw error;
    }
  },

  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteDocument(id);
      set(state => ({
        documents: state.documents.filter(d => d.id !== id),
        selectedDocumentIds: state.selectedDocumentIds.filter(did => did !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  toggleDocumentSelection: (id: string) => {
    set(state => {
      const isSelected = state.selectedDocumentIds.includes(id);
      return {
        selectedDocumentIds: isSelected
          ? state.selectedDocumentIds.filter(did => did !== id)
          : [...state.selectedDocumentIds, id],
      };
    });
  },

  selectAllDocuments: () => {
    set(state => ({
      selectedDocumentIds: state.documents.map(d => d.id),
    }));
  },

  clearSelection: () => {
    set({ selectedDocumentIds: [] });
  },

  clearError: () => set({ error: null }),
}));

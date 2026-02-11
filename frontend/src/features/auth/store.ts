import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/services/supabase';
import { useDiscussionStore } from '@/features/discussions';

interface AuthState {
  user: User | null;
  session: Session | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  // State
  user: null,
  session: null,
  isInitializing: true,
  isLoading: false,
  error: null,

  // Actions
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({
        session,
        user: session?.user ?? null,
        isInitializing: false,
      });

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
      });
    } catch {
      set({ isInitializing: false });
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    set({ error: null, isLoading: true });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
    set({ isLoading: false });
    return true;
  },

  signIn: async (email: string, password: string) => {
    set({ error: null, isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    useDiscussionStore.getState().reset();
    set({ user: null, session: null });
  },

  clearError: () => set({ error: null }),
}));

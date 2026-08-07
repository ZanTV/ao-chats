import { create } from 'zustand';

interface TypingState {
  typingConversations: Record<string, boolean>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  isTyping: (conversationId: string) => boolean;
  clearAll: () => void;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typingConversations: {},

  setTyping: (conversationId, isTyping) => {
    set((state) => {
      const next = { ...state.typingConversations };
      if (isTyping) {
        next[conversationId] = true;
      } else {
        delete next[conversationId];
      }
      return { typingConversations: next };
    });
  },

  isTyping: (conversationId) => Boolean(get().typingConversations[conversationId]),

  clearAll: () => set({ typingConversations: {} }),
}));

import { create } from 'zustand';
import { getSetting, setSetting } from '../services/storage';
import { ChatMessage } from '../utils/messages';

type DraftMap = Record<string, string>;
type PendingMap = Record<string, ChatMessage[]>;

const DRAFTS_KEY = 'chatDrafts';
const PENDING_KEY = 'chatPendingMessages';

interface ChatComposerState {
  drafts: DraftMap;
  pendingByConversation: PendingMap;
  isLoaded: boolean;
  loadAll: () => Promise<void>;
  getDraft: (conversationId: string) => string;
  setDraft: (conversationId: string, text: string) => Promise<void>;
  clearDraft: (conversationId: string) => Promise<void>;
  getPendingMessages: (conversationId: string) => ChatMessage[];
  setPendingMessages: (conversationId: string, messages: ChatMessage[]) => Promise<void>;
  syncPendingFromMessages: (conversationId: string, messages: ChatMessage[]) => Promise<void>;
}

export const useChatComposerStore = create<ChatComposerState>((set, get) => ({
  drafts: {},
  pendingByConversation: {},
  isLoaded: false,

  loadAll: async () => {
    const [drafts, pendingByConversation] = await Promise.all([
      getSetting<DraftMap>(DRAFTS_KEY, {}),
      getSetting<PendingMap>(PENDING_KEY, {}),
    ]);
    set({ drafts, pendingByConversation, isLoaded: true });
  },

  getDraft: (conversationId) => get().drafts[conversationId] || '',

  setDraft: async (conversationId, text) => {
    const drafts = { ...get().drafts };
    if (!text.trim()) {
      delete drafts[conversationId];
    } else {
      drafts[conversationId] = text;
    }
    set({ drafts });
    await setSetting(DRAFTS_KEY, drafts);
  },

  clearDraft: async (conversationId) => {
    await get().setDraft(conversationId, '');
  },

  getPendingMessages: (conversationId) => get().pendingByConversation[conversationId] || [],

  setPendingMessages: async (conversationId, messages) => {
    const pendingByConversation = { ...get().pendingByConversation };
    if (messages.length === 0) {
      delete pendingByConversation[conversationId];
    } else {
      pendingByConversation[conversationId] = messages;
    }
    set({ pendingByConversation });
    await setSetting(PENDING_KEY, pendingByConversation);
  },

  syncPendingFromMessages: async (conversationId, messages) => {
    const pending = messages.filter((m) => m.pending || m.failed);
    await get().setPendingMessages(conversationId, pending);
  },
}));

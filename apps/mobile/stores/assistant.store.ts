import { create } from 'zustand';

interface AssistantState {
  isOpen: boolean;
  projectId?: string;
  /** Bumped on New chat so suggestion chips can return. */
  conversationNonce: number;
  open: (projectId?: string) => void;
  close: () => void;
  restartConversation: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  isOpen: false,
  projectId: undefined,
  conversationNonce: 0,
  open: (projectId) => set({ isOpen: true, projectId }),
  close: () => set({ isOpen: false, projectId: undefined }),
  restartConversation: () => set((s) => ({ conversationNonce: s.conversationNonce + 1 })),
}));

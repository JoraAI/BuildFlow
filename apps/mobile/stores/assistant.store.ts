import { create } from 'zustand';

interface AssistantState {
  isOpen: boolean;
  projectId?: string;
  open: (projectId?: string) => void;
  close: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  isOpen: false,
  projectId: undefined,
  open: (projectId) => set({ isOpen: true, projectId }),
  close: () => set({ isOpen: false, projectId: undefined }),
}));

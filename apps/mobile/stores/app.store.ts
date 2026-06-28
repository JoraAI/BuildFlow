/**
 * BuildFlow Mobile - App store (Zustand)
 *
 * Holds global app state: active project, network status.
 */
import { create } from 'zustand';

type NetworkStatus = 'online' | 'offline';

interface AppState {
  activeProjectId: string | null;
  networkStatus: NetworkStatus;
  setActiveProject: (id: string | null) => void;
  setNetworkStatus: (status: NetworkStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  networkStatus: 'online',
  setActiveProject: (id) => set({ activeProjectId: id }),
  setNetworkStatus: (status) => set({ networkStatus: status }),
}));
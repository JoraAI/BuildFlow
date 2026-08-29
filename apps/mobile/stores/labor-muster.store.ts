/**
 * BuildFlow - Gang Labor Muster Store with local persistence.
 * Synchronizes morning site muster counts directly with Daily Progress Reports (DPR).
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TradeMusterItem {
  id: string;
  trade: string;
  headcount: number;
  otHours: number;
  dailyRate: number;
  color?: string;
  icon?: string;
}

export interface ProjectMusterRecord {
  projectId: string;
  date: string; // YYYY-MM-DD
  totalHeadcount: number;
  totalOtHours: number;
  totalEstimatedWage: number;
  trades: TradeMusterItem[];
  updatedAt: string;
}

interface LaborMusterState {
  musters: Record<string, ProjectMusterRecord>; // key: `${projectId}_${date}`
  setMuster: (record: ProjectMusterRecord) => Promise<void>;
  getMuster: (projectId: string, date: string) => ProjectMusterRecord | undefined;
  hydrateMusters: () => Promise<void>;
}

const MUSTER_STORAGE_KEY = 'bf_labor_musters_v1';

export const useLaborMusterStore = create<LaborMusterState>((set, get) => ({
  musters: {},

  setMuster: async (record: ProjectMusterRecord) => {
    const key = `${record.projectId}_${record.date}`;
    const nextMusters = {
      ...get().musters,
      [key]: record,
    };
    set({ musters: nextMusters });
    try {
      await AsyncStorage.setItem(MUSTER_STORAGE_KEY, JSON.stringify(nextMusters));
    } catch {
      // Ignore storage errors
    }
  },

  getMuster: (projectId: string, date: string) => {
    const key = `${projectId}_${date}`;
    return get().musters[key];
  },

  hydrateMusters: async () => {
    try {
      const stored = await AsyncStorage.getItem(MUSTER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, ProjectMusterRecord>;
        set({ musters: parsed });
      }
    } catch {
      // Ignore parse errors
    }
  },
}));

// Hydrate on module load
void useLaborMusterStore.getState().hydrateMusters();

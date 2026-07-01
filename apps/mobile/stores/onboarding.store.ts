/**
 * Dismissible in-app guides and first-run flags (AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const PREFIX = 'buildflow.guide.';

interface OnboardingState {
  loaded: boolean;
  dismissed: Record<string, boolean>;
  ownerWelcomeSeen: boolean;
  load: () => Promise<void>;
  dismiss: (key: string) => Promise<void>;
  markOwnerWelcomeSeen: () => Promise<void>;
  isDismissed: (key: string) => boolean;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  loaded: false,
  dismissed: {},
  ownerWelcomeSeen: false,

  load: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const guideKeys = keys.filter((k) => k.startsWith(PREFIX));
      const pairs = await AsyncStorage.multiGet(guideKeys);
      const dismissed: Record<string, boolean> = {};
      for (const [k, v] of pairs) {
        if (v === '1') dismissed[k.slice(PREFIX.length)] = true;
      }
      const ownerWelcomeSeen = (await AsyncStorage.getItem(`${PREFIX}ownerWelcome`)) === '1';
      set({ loaded: true, dismissed, ownerWelcomeSeen });
    } catch {
      set({ loaded: true });
    }
  },

  dismiss: async (key: string) => {
    await AsyncStorage.setItem(`${PREFIX}${key}`, '1');
    set((s) => ({ dismissed: { ...s.dismissed, [key]: true } }));
  },

  markOwnerWelcomeSeen: async () => {
    await AsyncStorage.setItem(`${PREFIX}ownerWelcome`, '1');
    set({ ownerWelcomeSeen: true });
  },

  isDismissed: (key: string) => !!get().dismissed[key],
}));

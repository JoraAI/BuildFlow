/**
 * BuildFlow - Language preference store with persistence.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type SupportedLanguage } from '@/constants/i18n';

const LANG_STORAGE_KEY = 'bf_user_lang_v1';

interface I18nState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  hydrateLanguage: () => Promise<void>;
}

export const useI18nStore = create<I18nState>((set) => ({
  language: 'en',
  setLanguage: async (lang: SupportedLanguage) => {
    set({ language: lang });
    try {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  },
  hydrateLanguage: async () => {
    try {
      const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
      if (stored) {
        set({ language: stored as SupportedLanguage });
      }
    } catch {
      // ignore
    }
  },
}));

// Hydrate on module load
void useI18nStore.getState().hydrateLanguage();

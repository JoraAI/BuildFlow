import React, { createContext, useContext, useMemo } from 'react';
import { SUPPORTED_LANGUAGES, t, type SupportedLanguage } from '@/constants/i18n';
import { useReportSettings } from '@/services/settings.queries';

type InventoryLanguageContextValue = {
  language: SupportedLanguage;
  translate: (key: string, fallback?: string) => string;
};

const InventoryLanguageContext = createContext<InventoryLanguageContextValue>({
  language: 'en',
  translate: (key, fallback) => fallback ?? t(key, 'en'),
});

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((entry) => entry.code === value);
}

export function InventoryLanguageProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useReportSettings();
  const language: SupportedLanguage = isSupportedLanguage(settings?.inventoryLanguage)
    ? settings.inventoryLanguage
    : 'en';

  const value = useMemo<InventoryLanguageContextValue>(
    () => ({
      language,
      translate: (key, fallback) => {
        const translated = t(key, language);
        return translated === key ? fallback ?? key : translated;
      },
    }),
    [language],
  );

  return (
    <InventoryLanguageContext.Provider value={value}>
      {children}
    </InventoryLanguageContext.Provider>
  );
}

export function useInventoryLanguage() {
  return useContext(InventoryLanguageContext);
}

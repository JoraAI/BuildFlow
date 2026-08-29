/**
 * BuildFlow - React hook for reactive vernacular translations.
 */
import { useI18nStore } from '@/stores/i18n.store';
import { t, type SupportedLanguage } from '@/constants/i18n';

export function useTranslation() {
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  return {
    t: (key: string) => t(key, language),
    language,
    setLanguage,
  };
}

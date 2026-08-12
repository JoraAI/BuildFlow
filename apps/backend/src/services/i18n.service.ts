/**
 * BuildFlow - I18n service (Phase 5 §8.9).
 * Serves translation dictionary and role dashboard configs via API.
 */
export async function getTranslations(lang: string) {
  // Read from mobile constants - in a real app this would be shared package
  // For now, return the supported languages + role dashboard config
  const supportedLanguages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
    { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  ];
  const roleDashboards: Record<string, string[]> = {
    OWNER: ['budget', 'progress', 'tasks', 'invoices', 'bills', 'punchItems', 'rfis', 'labourCost'],
    PM: ['progress', 'tasks', 'punchItems', 'rfis', 'boq', 'attendance', 'drawings'],
    DPM: ['tasks', 'attendance', 'punchItems', 'dailyReports'],
    QC: ['punchItems', 'rfis', 'drawings', 'submittals'],
    SITE_SUPERVISOR: ['attendance', 'dailyReports', 'punchItems', 'stock'],
    ACCOUNTANT: ['invoices', 'bills', 'budget', 'journalEntries'],
    STORE_INCHARGE: ['stock', 'procurement', 'grn', 'materialIssues'],
  };
  return { supportedLanguages, roleDashboards, requestedLang: lang || 'en' };
}

/**
 * BuildFlow - Internationalization constants (Phase 5 §8.9).
 *
 * Supports: English (en), Hindi (hi), Marathi (mr), Tamil (ta), Telugu (te).
 * Each key maps to translations. The mobile app uses `useTranslation()` hook
 * which resolves based on the user's language preference.
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'ta' | 'te';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
];

type TranslationDict = Record<string, Record<SupportedLanguage, string>>;

export const translations: TranslationDict = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड', mr: 'डॅशबोर्ड', ta: 'டாஷ்போர்டு', te: 'డాష్‌బోర్డ్' },
  'nav.projects': { en: 'Projects', hi: 'परियोजनाएं', mr: 'प्रकल्प', ta: 'திட்டங்கள்', te: 'ప్రాజెక్ట్‌లు' },
  'nav.estimation': { en: 'Estimation', hi: 'अनुमान', mr: 'अंदाज', ta: 'மதிப்பீடு', te: 'అంచనా' },
  'nav.boq': { en: 'BOQ', hi: 'बीओक्यू', mr: 'बीओक्यू', ta: 'பிஓக்யு', te: 'బిఓక్యూ' },
  'nav.procurement': { en: 'Procurement', hi: 'खरीद', mr: 'खरेदी', ta: 'கொள்முதல்', te: 'కొనుగోలు' },
  'nav.accounting': { en: 'Accounting', hi: 'लेखाशास्त्र', mr: 'हिशोब', ta: 'கணக்கியல்', te: 'అకౌంటింగ్' },
  'nav.reports': { en: 'Reports', hi: 'रिपोर्ट', mr: 'अहवाल', ta: 'அறிக்கைகள்', te: 'నివేదికలు' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు' },
  'nav.subcontractors': { en: 'Subcontractors', hi: 'उप-ठेकेदार', mr: 'उप-कंत्राटदार', ta: 'துணை-ஒப்பந்ததாரர்கள்', te: 'ఉప-కాంట్రాక్టర్‌లు' },
  'nav.chat': { en: 'Assistant', hi: 'सहायक', mr: 'सहाय्यक', ta: 'உதவியாளர்', te: 'సహాయకుడు' },

  // Common actions
  'common.create': { en: 'Create', hi: 'बनाएं', mr: 'तयार करा', ta: 'உருவாக்கு', te: 'సృష్టించు' },
  'common.edit': { en: 'Edit', hi: 'संपादित करें', mr: 'संपादित करा', ta: 'திருத்து', te: 'సవరించు' },
  'common.delete': { en: 'Delete', hi: 'हटाएं', mr: 'हटवा', ta: 'நீக்கு', te: 'తొలగించు' },
  'common.save': { en: 'Save', hi: 'सहेजें', mr: 'जतन करा', ta: 'சேமி', te: 'సేవ్ చేయి' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा', ta: 'ரத்து', te: 'రద్దు' },
  'common.approve': { en: 'Approve', hi: 'स्वीकृत करें', mr: 'मंजूर करा', ta: 'அங்கீகரி', te: 'ఆమోదించు' },
  'common.reject': { en: 'Reject', hi: 'अस्वीकृत करें', mr: 'नकार', ta: 'நிராகரி', te: 'తిరస్కరించు' },
  'common.search': { en: 'Search', hi: 'खोजें', mr: 'शोधा', ta: 'தேடு', te: 'వెతకండి' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...', mr: 'लोड होत आहे...', ta: 'ஏற்றுகிறது...', te: 'లోడ్ అవుతోంది...' },
  'common.error': { en: 'Error', hi: 'त्रुटि', mr: 'त्रुटी', ta: 'பிழை', te: 'లోపం' },
  'common.success': { en: 'Success', hi: 'सफल', mr: 'यशस्वी', ta: 'வெற்றி', te: 'విజయం' },

  // Auth
  'auth.login': { en: 'Login', hi: 'लॉगिन', mr: 'लॉगिन', ta: 'உள்நுழைய', te: 'లాగిన్' },
  'auth.logout': { en: 'Logout', hi: 'लॉगआउट', mr: 'लॉगआउट', ta: 'வெளியேறு', te: 'లాగ్అవుట్' },
  'auth.email': { en: 'Email', hi: 'ईमेल', mr: 'ईमेल', ta: 'மின்னஞ்சல்', te: 'ఇమెయిల్' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड', mr: 'पासवर्ड', ta: 'கடவுச்சொல்', te: 'పాస్‌వర్డ్' },

  // Project
  'project.name': { en: 'Project Name', hi: 'परियोजना नाम', mr: 'प्रकल्पाचे नाव', ta: 'திட்டத்தின் பெயர்', te: 'ప్రాజెక్ట్ పేరు' },
  'project.client': { en: 'Client', hi: 'ग्राहक', mr: 'ग्राहक', ta: 'வாடிக்கையாளர்', te: 'క్లయింట్' },
  'project.budget': { en: 'Budget', hi: 'बजट', mr: 'बजेट', ta: 'பட்ஜெட்', te: 'బడ్జెట్' },
  'project.status': { en: 'Status', hi: 'स्थिति', mr: 'स्थिती', ta: 'நிலை', te: 'స్థితి' },
  'project.progress': { en: 'Progress', hi: 'प्रगति', mr: 'प्रगती', ta: 'முன்னேற்றம்', te: 'పురోగతి' },

  // Phases
  'phase.planning': { en: 'Planning', hi: 'योजना', mr: 'नियोजन', ta: 'திட்டமிடல்', te: 'ప్రణాళిక' },
  'phase.inProgress': { en: 'In Progress', hi: 'प्रगति पर', mr: 'सुरू', ta: 'நடைபெறுகிறது', te: 'పురోగతిలో' },
  'phase.completed': { en: 'Completed', hi: 'पूर्ण', mr: 'पूर्ण', ta: 'முடந்தது', te: 'పూర్తయింది' },
  'phase.onHold': { en: 'On Hold', hi: 'रुका हुआ', mr: 'सस्पेंड', ta: 'நிறுத்தி வைக்கப்பட்டது', te: 'ఆగిపోయింది' },
};

export function t(key: string, lang: SupportedLanguage = 'en'): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}

// Role-based dashboard widget configurations
export const ROLE_DASHBOARD_CONFIG: Record<string, string[]> = {
  OWNER: ['budget', 'progress', 'tasks', 'invoices', 'bills', 'punchItems', 'rfis', 'labourCost'],
  PM: ['progress', 'tasks', 'punchItems', 'rfis', 'boq', 'attendance', 'drawings'],
  DPM: ['tasks', 'attendance', 'punchItems', 'dailyReports'],
  QC: ['punchItems', 'rfis', 'drawings', 'submittals'],
  SITE_SUPERVISOR: ['attendance', 'dailyReports', 'punchItems', 'stock'],
  ACCOUNTANT: ['invoices', 'bills', 'budget', 'journalEntries'],
  STORE_INCHARGE: ['stock', 'procurement', 'grn', 'materialIssues'],
  SUPERVISOR: ['attendance', 'dailyReports', 'punchItems'],
};

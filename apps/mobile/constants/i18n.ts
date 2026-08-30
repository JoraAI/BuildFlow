/**
 * BuildFlow - Internationalization constants (Phase 5 §8.9).
 *
 * Supports major Indian languages first, plus a few widely used international
 * languages for inventory teams.
 * Each key maps to translations. The mobile app uses `useTranslation()` hook
 * which resolves based on the user's language preference.
 */

export type SupportedLanguage =
  | 'en'
  | 'hi'
  | 'bn'
  | 'te'
  | 'mr'
  | 'ta'
  | 'ur'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'pa'
  | 'ar'
  | 'es'
  | 'fr';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'ur', label: 'اردو', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ar', label: 'العربية', flag: '🇦🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

type TranslationDict = Record<string, { en: string } & Partial<Record<SupportedLanguage, string>>>;

export const translations: TranslationDict = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड', mr: 'डॅशबोर्ड', ta: 'டாஷ்போர்டு', te: 'డాష్‌బోర్డ్', bn: 'ড্যাশবোর্ড', gu: 'ડેશબોર્ડ', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', ml: 'ഡാഷ്‌ബോർഡ്', pa: 'ਡੈਸ਼ਬੋਰਡ', ur: 'ڈیش بورڈ' },
  'nav.home': { en: 'Home', hi: 'होम', mr: 'मुख्यपृष्ठ', ta: 'முகப்பு', te: 'హోమ్', bn: 'হোম', gu: 'હોમ', kn: 'ಮುಖಪುಟ', ml: 'ഹോം', pa: 'ਹੋਮ', ur: 'ہوم' },
  'nav.projects': { en: 'Projects', hi: 'परियोजनाएं', mr: 'प्रकल्प', ta: 'திட்டங்கள்', te: 'ప్రాజెక్ట్‌లు', bn: 'প্রকল্প', gu: 'પ્રોજેક્ટ્સ', kn: 'ಯೋಜನೆಗಳು', ml: 'പ്രോജക്റ്റുകൾ', pa: 'ਪ੍ਰੋਜੈਕਟ', ur: 'پروجیکٹس' },
  'nav.proposals': { en: 'Proposals', hi: 'प्रस्ताव', mr: 'प्रस्ताव', ta: 'முன்மொழிவுகள்', te: 'ప్రతిపాదనలు', bn: 'প্রস্তাবনা', gu: 'દરખાસ્તો', kn: 'ಪ್ರಸ್ತಾಪಗಳು', ml: 'നിർദ്ദേശങ്ങൾ', pa: 'ਪ੍ਰਸਤਾਵ', ur: 'تجویزیں' },
  'nav.planning': { en: 'Planning', hi: 'प्लानिंग', mr: 'नियोजन', ta: 'திட்டமிடல்', te: 'ప్లానింగ్', bn: 'পরিকল্পনা', gu: 'આયોજન', kn: 'ಯೋಜನೆ', ml: 'പ്ലാനിംഗ്', pa: 'ਯੋਜਨਾਬੰਦੀ', ur: 'منصوبہ بندی' },
  'nav.estimation': { en: 'Estimation', hi: 'अनुमान', mr: 'अंदाज', ta: 'மதிப்பீடு', te: 'అంచనా', bn: 'প্রাক্কলন', gu: 'અંદાજ', kn: 'ಅಂದಾಜು', ml: 'എസ്റ്റിമേറ്റ്', pa: 'ਅੰਦਾਜ਼ਾ', ur: 'تخمینہ' },
  'nav.boq': { en: 'BOQ', hi: 'बीओक्यू', mr: 'बीओक्यू', ta: 'பிஓக்யு', te: 'బిఓక్యూ', bn: 'বিওকিউ', gu: 'બીઓક્યુ', kn: 'ಬಿಒಕ್ಯೂ', ml: 'ബിഒക്യു', pa: 'ਬੀਓਕਿਊ', ur: 'بی او کیو' },
  'nav.procurement': { en: 'Procurement', hi: 'खरीद', mr: 'खरेदी', ta: 'கொள்முதல்', te: 'కొనుగోలు', bn: 'ক্রয়', gu: 'ખરીદી', kn: 'ಖರೀದಿ', ml: 'സംഭരണം', pa: 'ਖਰੀਦ', ur: 'خریداری' },
  'nav.accounting': { en: 'Accounting', hi: 'लेखाशास्त्र', mr: 'हिशोब', ta: 'கணக்கியல்', te: 'అకౌంటింగ్', bn: 'হিসাববিজ্ঞান', gu: 'નામાપદ્ધતિ', kn: 'ಲೆಕ್ಕಪತ್ರ', ml: 'അക്കೌണ്ടിംഗ്', pa: 'ਲੇਖਾਕਾਰੀ', ur: 'اکاؤنٹنگ' },
  'nav.reports': { en: 'Reports', hi: 'रिपोर्ट्स', mr: 'अहवाल', ta: 'அறிக்கைகள்', te: 'నివేదికలు', bn: 'প্রতিবেদন', gu: 'અહેવાલો', kn: 'ವರದಿಗಳು', ml: 'റിപ്പോർട്ടുകൾ', pa: 'ਰਿਪੋਰਟਾਂ', ur: 'رپورٹس' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు', bn: 'সেটিংস', gu: 'સેટિંગ્સ', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', ml: 'ക്രമീകരണങ്ങൾ', pa: 'ਸੈਟਿੰਗਾਂ', ur: 'ترتیبات' },
  'nav.subcontractors': { en: 'Subcontractors', hi: 'उप-ठेकेदार', mr: 'उप-कंत्राटदार', ta: 'துணை-ஒப்பந்ததாரர்கள்', te: 'ఉప-కాంట్రాక్టర్‌లు', bn: 'সাবকন্ট্রাক্টর', gu: 'પેટા કોન્ટ્રાક્ટર', kn: 'ಉಪ ಗುತ್ತಿಗೆದಾರರು', ml: 'സബ് കോൺട്രാക്ടർമാർ', pa: 'ਸਬ-ਕੰਟਰੈਕਟਰ', ur: 'ذیلی ٹھیکیدار' },
  'nav.chat': { en: 'Assistant', hi: 'सहायक', mr: 'सहाय्यक', ta: 'உதவியாளர்', te: 'సహాయకుడు', bn: 'সহকারী', gu: 'સહાયક', kn: 'ಸಹಾಯಕ', ml: 'സഹായി', pa: 'ਸਹਾਇਕ', ur: 'معاون' },
  'nav.notifications': { en: 'Alerts', hi: 'अलर्ट', mr: 'सूचना', ta: 'எச்சரிக்கைகள்', te: 'హెచ్చరికలు', bn: 'সতর্কতা', gu: 'ચેતવણીઓ', kn: 'ಎಚ್ಚರಿಕೆಗಳು', ml: 'അലേർട്ടുകൾ', pa: 'ਚੇਤਾਵਨੀਆਂ', ur: 'انتباہات' },
  'nav.more': { en: 'More', hi: 'अधिक', mr: 'अधिक', ta: 'மேலும்', te: 'మరిన్ని', bn: 'আরও', gu: 'વધુ', kn: 'ಇನ್ನಷ್ಟು', ml: 'കൂടുതൽ', pa: 'ਹੋਰ', ur: 'مزید' },
  'nav.reportsHub': { en: 'Reports Hub', hi: 'रिपोर्ट्स हब', mr: 'अहवाल केंद्र', ta: 'அறிக்கை மையம்', te: 'రిపోర్ట్స్ హబ్', bn: 'রিপোর্ট হাব', gu: 'રિપોર્ટ હબ', kn: 'ವರದಿಗಳ ಹಬ್', ml: 'റിപ്പോർട്ട്സ് ಹಬ್', pa: 'ਰਿਪੋਰਟ ਹੱਬ', ur: 'رپورٹس حب' },

  // Project Tabs
  'tab.overview': { en: 'Overview', hi: 'अवलोकन', mr: 'आढावा', ta: 'மேலோட்டம்', te: 'అవలోకనం', bn: 'সংক্ষিপ্ত বিবরণ', gu: 'ઝાંખી', kn: 'ಅವಲೋಕನ', ml: 'അവലോകനം', pa: 'ਸੰਖੇਪ ਜਾਣਕਾਰੀ', ur: 'جائزہ' },
  'tab.estimate': { en: 'Estimate', hi: 'अनुमान', mr: 'अंदाज', ta: 'மதிப்பீடு', te: 'అంచనా', bn: 'প্রাক্কলন', gu: 'અંદાજ', kn: 'ಅಂದಾಜು', ml: 'എസ്റ്റിമേറ്റ്', pa: 'ਅੰਦਾਜ਼ਾ', ur: 'تخمینہ' },
  'tab.schedule': { en: 'Schedule', hi: 'शेड्यूल', mr: 'वेळापत्रक', ta: 'கால அட்டவணை', te: 'షెడ్యూల్', bn: 'সময়সূচী', gu: 'સમયપત્રક', kn: 'ವೇಳಾಪಟ್ಟಿ', ml: 'ഷെഡ്യൂൾ', pa: 'ਸਮਾਸੂਚੀ', ur: 'شیڈول' },
  'tab.boq': { en: 'BOQ', hi: 'बीओक्यू', mr: 'बीओक्यू', ta: 'பிஓக்யூ', te: 'బిఓక్యూ', bn: 'বিওকিউ', gu: 'બીઓક્યુ', kn: 'ಬಿಒಕ್ಯೂ', ml: 'ബിಒക്യു', pa: 'ਬੀਓਕਿਊ', ur: 'بی او کیو' },
  'tab.bills': { en: 'Bills', hi: 'बिल', mr: 'बिले', ta: 'பில்கள்', te: 'బిల్లులు', bn: 'বিল', gu: 'બિલ', kn: 'ಬಿಲ್ಲುಗಳು', ml: 'ബില്ലുകൾ', pa: 'ਬਿੱਲ', ur: 'بلز' },
  'tab.variations': { en: 'Variations', hi: 'विविधताएं', mr: 'बदल आदेश', ta: 'மாறுபாடுகள்', te: 'మార్పులు', bn: 'পরিবর্তন', gu: 'ફેરફારો', kn: 'ವ್ಯತ್ಯಾಸಗಳು', ml: 'വ്യതിയാനങ്ങൾ', pa: 'ਤਬਦੀਲੀਆਂ', ur: 'تبدیلیاں' },
  'tab.procurement': { en: 'Procurement', hi: 'खरीद', mr: 'खरेदी', ta: 'கொள்முதல்', te: 'కొనుగోలు', bn: 'ক্রয়', gu: 'ખરીદી', kn: 'ಖರೀದಿ', ml: 'സംഭരണം', pa: 'ਖਰੀਦ', ur: 'خریداری' },
  'tab.subcontracts': { en: 'Subcontracts', hi: 'उप-अनुबंध', mr: 'उप-कंत्राट', ta: 'துணை ஒப்பந்தங்கள்', te: 'ఉప కాంట్రాక్టులు', bn: 'সাবকন্ট্রাক্ট', gu: 'પેટા કરારો', kn: 'ಉಪ ಗುತ್ತಿಗೆಗಳು', ml: 'ഉപകരാറുകൾ', pa: 'ਸਬ-ਕੰਟਰੈਕਟ', ur: 'ذیلی معاہدے' },
  'tab.pettyCash': { en: 'Petty Cash', hi: 'पेटी कैश', mr: 'किरकोळ खर्च', ta: 'சில்லறை ரொக்கம்', te: 'పెట్టీ క్యాష్', bn: 'খুচরা নগদ', gu: 'પેટી કેશ', kn: 'ಚಿಲ್ಲರೆ ನಗದು', ml: 'പെറ്റി ക്യാഷ്', pa: 'ਪੈਟੀ ਕੈਸ਼', ur: 'پیٹی کیش' },
  'tab.drawings': { en: 'Drawings', hi: 'ड्राइंग्स', mr: 'नकाशे', ta: 'வரைபடங்கள்', te: 'డ్రాయింగ్స్', bn: 'নকশা', gu: 'ડ્રોઇંગ્સ', kn: 'ಚಿತ್ರಗಳು', ml: 'ഡ്രോയിംഗുകൾ', pa: 'ਡਰਾਇੰਗ', ur: 'ڈرائنگز' },
  'tab.snags': { en: 'Snags / NCR', hi: 'दोष सूची (स्नैग्स)', mr: 'दोष यादी / NCR', ta: 'குறைபாடுகள் / NCR', te: 'స్నాగ్స్ / NCR', bn: 'ত্রুটি / NCR', gu: 'ખામੀઓ / NCR', kn: 'ದೋಷಗಳು / NCR', ml: 'സ്നാഗ്സ് / NCR', pa: 'ਖਾਮੀਆਂ / NCR', ur: 'نقائص / این سی آر' },
  'tab.laborWages': { en: 'Labor & Wages', hi: 'श्रमिक व मजदूरी', mr: 'मजूर व मजुरी', ta: 'தொழிலாளர் & ஊதியம்', te: 'లేబర్ & వేతనాలు', bn: 'শ্রমিক ও মজুরি', gu: 'મજૂર અને વેતન', kn: 'ಕಾರ್ಮಿಕರು ಮತ್ತು ವೇತನ', ml: 'തൊഴിലാളികളും വേതനവും', pa: 'ਮਜ਼ਦੂਰ ਅਤੇ ਤਨਖਾਹ', ur: 'مزدور اور اجرت' },
  'tab.resources': { en: 'Resources', hi: 'संसाधन', mr: 'संसाधने', ta: 'வளங்கள்', te: 'వనరులు', bn: 'সম্পদ', gu: 'સંસાધનો', kn: 'ಸಂಪನ್ಮೂಲಗಳು', ml: 'ವಿಭವಗಳು', pa: 'ਸਰੋਤ', ur: 'وسائل' },

  // Common actions
  'common.create': { en: 'Create', hi: 'बनाएं', mr: 'तयार करा', ta: 'உருவாக்கு', te: 'సృష్టించు' },
  'common.edit': { en: 'Edit', hi: 'संपादित करें', mr: 'संपादित करा', ta: 'திருத்து', te: 'సవరించు' },
  'common.delete': { en: 'Delete', hi: 'हटाएं', mr: 'हटवा', ta: 'நீக்கு', te: 'తొలగించు' },
  'common.save': { en: 'Save', hi: 'सहेजें', mr: 'जतन करा', ta: 'சேமி', te: 'సేవ్ చేయి' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा', ta: 'ரத்து', te: 'రద్దు' },
  'common.approve': { en: 'Approve', hi: 'स्वीकृत करें', mr: 'मंजूर करा', ta: 'அங்கீகரி', te: 'ఆమోదించు' },
  'common.reject': { en: 'Reject', hi: 'अस्वीकृत करें', mr: 'नकार', ta: 'நிராகரி', te: 'తిరస్కరించు' },
  'common.search': { en: 'Search', hi: 'खोजें', mr: 'शोधा', ta: 'தேடு', te: 'వెతకండి' },
  'common.back': { en: 'Back', hi: 'वापस', mr: 'मागे', ta: 'பின்செல்', te: 'వెనుకకు', bn: 'ফিরে যান', gu: 'પાછળ', kn: 'ಹಿಂದೆ', ml: 'പിന്നോട്ട്', pa: 'ਪਿੱਛੇ', ur: 'پیچھے' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...', mr: 'लोड होत आहे...', ta: 'ஏற்றுகிறது...', te: 'లోడ్ అవుతోంది...' },
  'common.error': { en: 'Error', hi: 'त्रुटि', mr: 'त्रुटी', ta: 'பிழை', te: 'లోపం' },
  'common.success': { en: 'Success', hi: 'सफल', mr: 'यशस्वी', ta: 'வெற்றி', te: 'విజయం' },

  // Site Execution Modules
  'labor.morningMuster': { en: 'Morning Muster', hi: 'सुबह की हाजिरी (मस्टर)', mr: 'सकाळची हजेरी', ta: 'காலை வரவு', te: 'ఉదయం మస్టర్', bn: 'সকালের হাজিরা', gu: 'સવારની હાજરી', kn: 'ಬೆಳಗಿನ ಹಾಜರಾತಿ', ml: 'രാവിലത്തെ ഹാജർ', pa: 'ਸਵੇਰ ਦੀ ਹਾਜ਼ਰੀ', ur: 'صبح کی حاضری' },
  'labor.saveMuster': { en: 'Save Morning Muster', hi: 'हाजिरी सुरक्षित करें', mr: 'हजेरी जतन करा', ta: 'காலை வரவைச் சேமி', te: 'ఉదయం మస్టర్ సేవ్ చేయండి', bn: 'হাজিরা সংরক্ষণ করুন', gu: 'હાજरी સાચવો', kn: 'ಹಾಜರಾತಿ ಉಳಿಸಿ', ml: 'ഹാജർ സേവ് ചെയ്യുക', pa: 'ਹਾਜ਼ਰੀ ਸੰਭਾਲੋ', ur: 'حاضری محفوظ کریں' },
  'labor.pushDpr': { en: 'Push Headcount to DPR', hi: 'दैनिक रिपोर्ट (DPR) में भेजें', mr: 'DPR मध्ये पाठवा', ta: 'DPR-க்கு எண்ணிக்கை அனுப்பு', te: 'DPR కు సింక్ చేయండి', bn: 'DPR-এ পাঠান', gu: 'DPR માં મોકલો', kn: 'DPR ಗೆ ಕಳುಹಿಸಿ', ml: 'DPR-ലേക്ക് അയക്കുക', pa: 'DPR ਵਿੱਚ ਭੇਜੋ', ur: 'ڈی پی آر میں بھیجیں' },
  'labor.payroll': { en: 'Weekly Wage Payroll', hi: 'साप्ताहिक मजदूरी पेरोल', mr: 'साप्ताहिक मजुरी पेरोल', ta: 'வாராந்திர சம்பள பட்டியல்', te: 'వారపు వేతన పేరోల్', bn: 'সাপ্তাহিক মজুরি পেরোল', gu: 'સાપ્તાહિક વેતન પેરોલ', kn: 'ಸಾಪ್ತಾಹಿಕ ವೇತನ ಪಾವತಿ', ml: 'പ്രതിവാര വേതന പേറോൾ', pa: 'ਹਫ਼ਤਾਵਾਰੀ ਤਨਖਾਹ ਪੇਰੋਲ', ur: 'ہفتہ وار اجرت کا پے رول' },
  'drawings.upload': { en: 'Upload Drawing', hi: 'ड्राइंग अपलोड करें', mr: 'नकाशा अपलोड करा', ta: 'வரைபடம் பதிவேற்று', te: 'డ్రాయింగ్ అప్‌లోడ్ చేయండి', bn: 'নকশা আপলোড করুন', gu: 'ડ્રોઇંગ અપલોડ કરો', kn: 'ಡ್ರಾಯಿಂಗ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ', ml: 'ഡ്രോയിംഗ് അപ്‌ലോഡ് ചെയ്യുക', pa: 'ਡਰਾਇੰਗ ਅੱਪਲੋਡ ਕਰੋ', ur: 'ڈرائنگ اپ لوڈ کریں' },
  'snags.log': { en: 'Log Snag / NCR', hi: 'दोष दर्ज करें (NCR)', mr: 'दोष नोंदवा (NCR)', ta: 'குறைபாட்டைப் பதிவு செய்', te: 'స్నాగ్ నమోదు చేయండి', bn: 'ত্রুটি নথিভুক্ত করুন', gu: 'ખામી નોંધો', kn: 'ದೋಷ ದಾಖಲಿಸಿ', ml: 'സ്നാഗ് രേഖപ്പെടുത്തുക', pa: 'ਖਾਮੀ ਦਰਜ ਕਰੋ', ur: 'نقص درج کریں' },
  'pettyCash.log': { en: 'Log Site Expense', hi: 'साइट खर्च दर्ज करें', mr: 'साइट खर्च नोंदवा', ta: 'தள செலவை பதிவு செய்', te: 'సైట్ ఖర్చు నమోదు చేయండి', bn: 'সাইট খরচ নথিভুক্ত করুন', gu: 'સાઇટ ખર્ચ નોંધો', kn: 'ಸೈಟ್ ವೆಚ್ಚ ದಾಖಲಿಸಿ', ml: 'സൈറ്റ് ചെലവ് രേഖപ്പെടുത്തുക', pa: 'ਸਾਈਟ ਖਰਚ ਦਰਜ ਕਰੋ', ur: 'سائٹ کا خرچہ درج کریں' },

  // Auth
  'auth.login': { en: 'Login', hi: 'लॉगिन', mr: 'लॉगिन', ta: 'உள்நுழைய', te: 'లాగిన్' },
  'auth.logout': { en: 'Logout', hi: 'लॉगआउट', mr: 'लॉगआउट', ta: 'வெளியேறு', te: 'లాగ్అవుట్' },
  'auth.email': { en: 'Email', hi: 'ईमेल', mr: 'ईमेल', ta: 'மின்னஞ்சல்', te: 'ఇమెయిల్' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड', mr: 'पासवर्ड', ta: 'கடவுச்சொல்', te: 'పాస్‌వర్డ్' },

  // Inventory shell
  'inventory.shell.title': {
    en: 'BuildFlow · Inventory',
    hi: 'बिल्डफ्लो · इन्वेंटरी',
    bn: 'বিল্ডফ্লো · ইনভেন্টরি',
    te: 'బిల్డ్‌ఫ్లో · ఇన్వెంటరీ',
    mr: 'बिल्डफ्लो · इन्व्हेंटरी',
    ta: 'பில்ட்ஃப்ளோ · இன்வென்டரி',
    ur: 'بلڈ فلو · انوینٹری',
    gu: 'બિલ્ડફ્લો · ઇન્વેન્ટરી',
    kn: 'ಬಿಲ್ಡ್‌ಫ್ಲೋ · ಇನ್ವೆಂಟರಿ',
    ml: 'ബിൽഡ്‌ഫ്ലോ · ഇൻവെന്ററി',
    pa: 'ਬਿਲਡਫਲੋ · ਇਨਵੈਂਟਰੀ',
    ar: 'بيلدفلو · المخزون',
    es: 'BuildFlow · Inventario',
    fr: 'BuildFlow · Inventaire',
  },
  // M3: short phone header title so company name is not crushed.
  'inventory.shell.titleMobile': {
    en: 'Inventory',
    hi: 'इन्वेंटरी',
    bn: 'ইনভেন্টরি',
    te: 'ఇన్వెంటరీ',
    mr: 'इन्व्हेंटरी',
    ta: 'இன்வென்டரி',
    ur: 'انوینٹری',
    gu: 'ઇન્વેન્ટરી',
    kn: 'ಇನ್ವೆಂಟರಿ',
    ml: 'ഇൻവെന്ററി',
    pa: 'ਇਨਵੈਂਟਰੀ',
    ar: 'المخزون',
    es: 'Inventario',
    fr: 'Inventaire',
  },
  'inventory.shell.store': {
    en: 'Store',
    hi: 'स्टोर',
    bn: 'দোকান',
    te: 'స్టోర్',
    mr: 'स्टोअर',
    ta: 'கடை',
    ur: 'دکان',
    gu: 'દુકાન',
    kn: 'ಅಂಗಡಿ',
    ml: 'കട',
    pa: 'ਦੁਕਾਨ',
    ar: 'المتجر',
    es: 'Tienda',
    fr: 'Magasin',
  },
  'inventory.tab.stock': {
    en: 'Stock',
    hi: 'स्टॉक',
    bn: 'স্টক',
    te: 'స్టాక్',
    mr: 'साठा',
    ta: 'சரக்கு',
    ur: 'اسٹاک',
    gu: 'સ્ટોક',
    kn: 'ಸ್ಟಾಕ್',
    ml: 'സ്റ്റോക്ക്',
    pa: 'ਸਟਾਕ',
    ar: 'المخزون',
    es: 'Stock',
    fr: 'Stock',
  },
  'inventory.tab.parties': {
    en: 'Parties',
    hi: 'पार्टी',
    bn: 'পার্টি',
    te: 'పార్టీలు',
    mr: 'पार्टी',
    ta: 'பார்டிகள்',
    ur: 'پارٹیاں',
    gu: 'પાર્ટીઓ',
    kn: 'ಪಕ್ಷಗಳು',
    ml: 'പാർട്ടികൾ',
    pa: 'ਪਾਰਟੀਆਂ',
    ar: 'الأطراف',
    es: 'Partes',
    fr: 'Parties',
  },
  'inventory.tab.quotes': {
    en: 'Quotes',
    hi: 'कोट्स',
    bn: 'উদ্ধৃতি',
    te: 'కోట్స్',
    mr: 'कोटेशन',
    ta: 'மேற்கோள்கள்',
    ur: 'کوٹس',
    gu: 'અંદાજો',
    kn: 'ಉಲ್ಲೇಖಗಳು',
    ml: 'ക്വോട്ടുകൾ',
    pa: 'ਕੋਟਸ',
    ar: 'عروض الأسعار',
    es: 'Cotizaciones',
    fr: 'Devis',
  },
  'inventory.tab.sales': {
    en: 'Sales',
    hi: 'बिक्री',
    bn: 'বিক্রি',
    te: 'అమ్మకాలు',
    mr: 'विक्री',
    ta: 'விற்பனை',
    ur: 'فروخت',
    gu: 'વેચાણ',
    kn: 'ಮಾರಾಟ',
    ml: 'വില്പന',
    pa: 'ਵਿਕਰੀ',
    ar: 'المبيعات',
    es: 'Ventas',
    fr: 'Ventes',
  },
  'inventory.tab.warehouse': {
    en: 'Warehouse',
    hi: 'गोदाम',
    bn: 'গুদাম',
    te: 'గోదాం',
    mr: 'गोदाम',
    ta: 'கிடங்கு',
    ur: 'گودام',
    gu: 'ગોડાઉન',
    kn: 'ಗೋದಾಮು',
    ml: 'ഗോഡൗൺ',
    pa: 'ਗੋਦਾਮ',
    ar: 'المستودع',
    es: 'Almacén',
    fr: 'Entrepôt',
  },
  'inventory.tab.procurement': {
    en: 'Procurement',
    hi: 'खरीद',
    bn: 'ক্রয়',
    te: 'కొనుగోలు',
    mr: 'खरेदी',
    ta: 'கொள்முதல்',
    ur: 'خریداری',
    gu: 'ખરીદી',
    kn: 'ಖರೀದಿ',
    ml: 'വാങ്ങൽ',
    pa: 'ਖਰੀਦ',
    ar: 'المشتريات',
    es: 'Compras',
    fr: 'Achats',
  },
  'inventory.tab.invoices': {
    en: 'Invoices',
    hi: 'इनवॉइस',
    bn: 'ইনভয়েস',
    te: 'ఇన్వాయిస్‌లు',
    mr: 'चलन',
    ta: 'இன்வாய்ஸ்',
    ur: 'انوائس',
    gu: 'ઇન્વૉઇસ',
    kn: 'ಇನ್ವಾಯ್ಸ್‌ಗಳು',
    ml: 'ഇൻവോയിസുകൾ',
    pa: 'ਇਨਵਾਇਸ',
    ar: 'الفواتير',
    es: 'Facturas',
    fr: 'Factures',
  },
  'inventory.tab.bills': {
    en: 'Bills',
    hi: 'बिल',
    bn: 'বিল',
    te: 'బిల్లులు',
    mr: 'बिल',
    ta: 'பில்கள்',
    ur: 'بل',
    gu: 'બિલ',
    kn: 'ಬಿಲ್‌ಗಳು',
    ml: 'ബില്ലുകൾ',
    pa: 'ਬਿਲ',
    ar: 'الفواتير',
    es: 'Recibos',
    fr: 'Factures',
  },
  'inventory.tab.settings': {
    en: 'Settings',
    hi: 'सेटिंग्स',
    bn: 'সেটিংস',
    te: 'సెట్టింగ్‌లు',
    mr: 'सेटिंग्ज',
    ta: 'அமைப்புகள்',
    ur: 'سیٹنگز',
    gu: 'સેટિંગ્સ',
    kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    ml: 'സെറ്റിംഗ്സ്',
    pa: 'ਸੈਟਿੰਗਜ਼',
    ar: 'الإعدادات',
    es: 'Ajustes',
    fr: 'Paramètres',
  },
  'inventory.item': { en: 'Item', hi: 'आइटम', bn: 'আইটেম', te: 'అంశం', mr: 'आयटम', ta: 'பொருள்', ur: 'آئٹم', gu: 'આઇટમ', kn: 'ಐಟಂ', ml: 'ഇനം', pa: 'ਆਈਟਮ', ar: 'عنصر', es: 'Artículo', fr: 'Article' },
  'inventory.items': { en: 'Items', hi: 'आइटम', bn: 'আইটেম', te: 'అంశాలు', mr: 'आयटम', ta: 'பொருட்கள்', ur: 'آئٹمز', gu: 'આઇટમ્સ', kn: 'ಐಟಂಗಳು', ml: 'ഇനങ്ങൾ', pa: 'ਆਈਟਮ', ar: 'العناصر', es: 'Artículos', fr: 'Articles' },
  'inventory.materials': { en: 'Materials', hi: 'सामग्री', bn: 'উপকরণ', te: 'మెటీరియల్స్', mr: 'साहित्य', ta: 'பொருட்கள்', ur: 'مواد', gu: 'સામગ્રી', kn: 'ವಸ್ತುಗಳು', ml: 'സാധനങ്ങൾ', pa: 'ਸਮੱਗਰੀ', ar: 'المواد', es: 'Materiales', fr: 'Matériaux' },
  'inventory.settings.language.title': { en: 'Language', hi: 'भाषा', mr: 'भाषा', ta: 'மொழி', te: 'భాష' },
  'inventory.settings.language.help': {
    en: 'Choose the inventory app language. This affects only the inventory system.',
    hi: 'इन्वेंटरी ऐप की भाषा चुनें। यह केवल इन्वेंटरी सिस्टम पर लागू होगा।',
    mr: 'इन्व्हेंटरी अॅपची भाषा निवडा. हे फक्त इन्व्हेंटरी सिस्टीमवर लागू होईल.',
    ta: 'இன்வென்டரி பயன்பாட்டின் மொழியைத் தேர்ந்தெடுக்கவும். இது இன்வென்டரி அமைப்பிற்கே மட்டும் பொருந்தும்.',
    te: 'ఇన్వెంటరీ యాప్ భాషను ఎంచుకోండి. ఇది కేవలం ఇన్వెంటరీ సిస్టమ్‌కే వర్తిస్తుంది.',
  },
  'inventory.settings.language.label': { en: 'App language', hi: 'ऐप भाषा', mr: 'अॅप भाषा', ta: 'ஆப் மொழி', te: 'యాప్ భాష' },
  'inventory.settings.language.save': { en: 'Save language', hi: 'भाषा सहेजें', mr: 'भाषा जतन करा', ta: 'மொழியை சேமிக்கவும்', te: 'భాషను సేవ్ చేయండి' },
  'inventory.settings.language.saved': {
    en: 'Inventory language saved',
    hi: 'इन्वेंटरी भाषा सहेजी गई',
    mr: 'इन्व्हेंटरी भाषा जतन झाली',
    ta: 'இன்வென்டரி மொழி சேமிக்கப்பட்டது',
    te: 'ఇన్వెంటరీ భాష సేవ్ అయింది',
  },
  'inventory.stock.title': { en: 'Stock', hi: 'स्टॉक', mr: 'साठा', ta: 'சரக்கு', te: 'స్టాక్' },
  'inventory.stock.allStores': { en: 'All stores', hi: 'सभी स्टोर', mr: 'सर्व स्टोअर्स', ta: 'அனைத்து கடைகளும்', te: 'అన్ని స్టోర్లు' },
  'inventory.stock.oneStore': { en: '1 store', hi: '1 स्टोर', mr: '1 स्टोअर', ta: '1 கடை', te: '1 స్టోర్' },
  'inventory.stock.checkout': { en: 'Checkout', hi: 'चेकआउट', mr: 'चेकआउट', ta: 'செக்அவுட்', te: 'చెకౌట్' },
  'inventory.stock.bulkIssue': { en: 'Bulk issue', hi: 'एक साथ निर्गम', mr: 'एकत्र इश्यू', ta: 'மொத்த வழங்கல்', te: 'బల్క్ ఇష్యూ' },
  'inventory.stock.importOpening': { en: 'Import opening stock', hi: 'ओपनिंग स्टॉक आयात करें', mr: 'ओपनिंग स्टॉक आयात करा', ta: 'தொடக்க சரக்கை இறக்குமதி செய்', te: 'ఓపెనింగ్ స్టాక్‌ను దిగుమతి చేయండి' },
  'inventory.stock.warehouse': { en: 'Warehouse', hi: 'गोदाम', mr: 'गोदाम', ta: 'கிடங்கு', te: 'గోదాం' },
  'inventory.stock.barcode': { en: 'Barcode / scan', hi: 'बारकोड / स्कैन', mr: 'बारकोड / स्कॅन', ta: 'பார்கோடு / ஸ்கேன்', te: 'బార్‌కోడ్ / స్కాన్' },
  'inventory.stock.barcodePlaceholder': { en: 'Type or paste a barcode', hi: 'बारकोड लिखें या पेस्ट करें', mr: 'बारकोड टाइप करा किंवा पेस्ट करा', ta: 'பார்கோடை টাইப் செய்யவும் அல்லது ஒட்டவும்', te: 'బార్‌కోడ్ టైప్ చేయండి లేదా పేస్ట్ చేయండి' },
  'inventory.stock.scan': { en: 'Scan', hi: 'स्कैन', mr: 'स्कॅन', ta: 'ஸ்கேன்', te: 'స్కాన్' },
  'inventory.stock.find': { en: 'Find', hi: 'खोजें', mr: 'शोधा', ta: 'தேடு', te: 'వెతకండి' },
  'inventory.stock.searchPlaceholder': { en: 'Search items…', hi: 'आइटम खोजें…', mr: 'आयटम शोधा…', ta: 'பொருட்களை தேடு…', te: 'అంశాలను వెతకండి…' },
  'inventory.stock.onHand': { en: 'On hand', hi: 'हाथ में', mr: 'हातात', ta: 'கையிருப்பு', te: 'చేతిలో' },
  'inventory.stock.received': { en: 'Received', hi: 'प्राप्त', mr: 'प्राप्त', ta: 'பெற்றது', te: 'అందింది' },
  'inventory.stock.issued': { en: 'Issued', hi: 'जारी', mr: 'जारी', ta: 'வழங்கியது', te: 'జారీ' },
  'inventory.stock.storeOverview': { en: 'Store overview', hi: 'स्टोर अवलोकन', mr: 'स्टोअर आढावा', ta: 'கடை சுருக்கம்', te: 'స్టోర్ అవలోకనం' },
  'inventory.stock.executiveOverview': { en: 'Executive overview', hi: 'कार्यकारी अवलोकन', mr: 'कार्यकारी आढावा', ta: 'நிர்வாக சுருக்கம்', te: 'ఎగ్జిక్యూటివ్ అవలోకనం' },
  'inventory.stock.summary': { en: 'Stock summary', hi: 'स्टॉक सारांश', mr: 'साठा सारांश', ta: 'சரக்கு சுருக்கம்', te: 'స్టాక్ సారాంశം' },
  'inventory.stock.issue': { en: 'Issue', hi: 'निर्गम', mr: 'इश्यू', ta: 'வழங்கு', te: 'ఇష్యూ' },
  'inventory.stock.adjust': { en: 'Adjust', hi: 'समायोजित करें', mr: 'समायोजित करा', ta: 'சரி செய்', te: 'సర్దుబాటు చేయండి' },
  'inventory.materials.masterSubtitle': {
    en: 'Your item master - prices, tax and tracking',
    hi: 'आपका आइटम मास्टर - कीमत, टैक्स और ट्रैकिंग',
    mr: 'तुमची आयटम मास्टर यादी - किंमत, कर आणि ट्रॅकिंग',
    ta: 'உங்கள் பொருள் பட்டியல் - விலை, வரி மற்றும் கண்காணிப்பு',
    te: 'మీ ఐటమ్ మాస్టర్ - ధరలు, పన్ను మరియు ట్రాకింగ్',
  },
  'inventory.materials.importCsv': { en: 'Import CSV', hi: 'CSV आयात करें', mr: 'CSV आयात करा', ta: 'CSV இறக்குமதி', te: 'CSV దిగుమతి' },
  'inventory.materials.addItem': { en: 'Add item', hi: 'आइटम जोड़ें', mr: 'आयटम जोडा', ta: 'பொருள் சேர்க்க', te: 'అంశాన్ని జోಡించండి' },
  'inventory.materials.searchLabel': { en: 'Search items', hi: 'आइटम खोजें', mr: 'आयटम शोधा', ta: 'பொருட்களை தேடு', te: 'అంశాలను వెతకండి' },
  'inventory.materials.inStock': { en: 'in stock', hi: 'स्टॉक में', mr: 'स्टॉकमध्ये', ta: 'கையிருப்பில்', te: 'స్టాక్‌లో' },
  'inventory.materials.outOfStock': { en: 'Out of stock', hi: 'स्टॉक खत्म', mr: 'स्टॉक संपला', ta: 'சரக்கு இல்லை', te: 'స్టాక్ లేదు' },
  'inventory.materials.batchTracked': { en: 'batch expiry tracked', hi: 'बैच एक्सपायरी ट्रैकिंग', mr: 'बॅच एक्सपायरी ट्रॅकिंग', ta: 'பேச் காலாவதி கண்காணிப்பு', te: 'బ్యాచ్ గడువు ట్రాకింగ్' },
  'inventory.materials.earliestExpiry': { en: 'Earliest expiry', hi: 'सबसे नज़दीकी एक्सपायरी', mr: 'सर्वात जवळची एक्सपायरी', ta: 'அடுத்த காலாவதி', te: 'అత్యంత దగ్గరి గడువు' },
  'inventory.materials.activeBatches': { en: 'active batches', hi: 'सक्रिय बैच', mr: 'सक्रिय बॅच', ta: 'செயலில் உள்ள பேட்ச்கள்', te: 'ಸಕ్రియ ಬ್ಯಾಚ್‌లు' },
  'inventory.materials.receiveStock': { en: 'Receive stock', hi: 'स्टॉक प्राप्त करें', mr: 'स्टॉक घ्या', ta: 'சரக்கு பெறுக', te: 'స్టాక్ స్వీకరించండి' },
  'inventory.page.procurement': { en: 'Procurement', hi: 'खरीद', bn: 'ক্রয়', te: 'కొనుగోలు', mr: 'खरेदी', ta: 'கொள்முதல்', ur: 'خریداری', gu: 'ખરીદી', kn: 'ಖರೀದಿ', ml: 'വാങ്ങൽ', pa: 'ਖਰੀਦ', ar: 'المشتريات', es: 'Compras', fr: 'Achats' },
  'inventory.page.sales': { en: 'Sales', hi: 'बिक्री', bn: 'বিক্রি', te: 'అమ్మకాలు', mr: 'विक्री', ta: 'விற்பனை', ur: 'فروخت', gu: 'વેચાણ', kn: 'ಮಾರಾಟ', ml: 'വില്പന', pa: 'ਵਿਕਰੀ', ar: 'المبيعات', es: 'Ventas', fr: 'Ventes' },
  'inventory.page.invoices': { en: 'Sales invoices', hi: 'बिक्री इनवॉइस', bn: 'বিক্রয় ইনভয়েস', te: 'అమ్మకాల ఇన్వాయిస్‌లు', mr: 'विक्री चलन', ta: 'விற்பனை இன்வாய்ஸ்கள்', ur: 'فروخت انوائس', gu: 'વેચાણ ઇન્વૉઇસ', kn: 'ಮಾರಾಟ ಇನ್ವಾಯ್ಸ್‌ಗಳು', ml: 'വില്പന ഇൻവോയിസുകൾ', pa: 'ਵਿਕਰੀ ਇਨਵਾਇਸ', ar: 'فواتير المبيعات', es: 'Facturas de venta', fr: 'Factures de vente' },
  'inventory.page.bills': { en: 'Vendor bills', hi: 'विक्रेता बिल', bn: 'সরবরাহকারী বিল', te: 'వెండర్ బిల్లులు', mr: 'पुरवठादार बिल', ta: 'விற்பனையாளர் பில்கள்', ur: 'وینڈر بل', gu: 'વેન્ડર બિલ', kn: 'ವಿಕ್ರೇತಾ ಬಿಲ್‌ಗಳು', ml: 'വെൻഡർ ബില്ലുകൾ', pa: 'ਵੈਂਡਰ ਬਿਲ', ar: 'فواتير الموردين', es: 'Facturas de proveedores', fr: 'Factures fournisseurs' },
  'inventory.page.warehouse': { en: 'Warehouse', hi: 'गोदाम', bn: 'গুদাম', te: 'గోదాం', mr: 'गोदाम', ta: 'கிடங்கு', ur: 'گودام', gu: 'ગોડાઉન', kn: 'ಗೋದಾಮು', ml: 'ഗോഡൗൺ', pa: 'ਗੋਦਾਮ', ar: 'المستودع', es: 'Almacén', fr: 'Entrepôt' },
  'inventory.page.parties': { en: 'Parties', hi: 'पार्टी', bn: 'পার্টি', te: 'పార్టీలు', mr: 'पार्टी', ta: 'பார்டிகள்', ur: 'پارٹیاں', gu: 'પાર્ટીઓ', kn: 'ಪಕ್ಷಗಳು', ml: 'പാർട്ടികൾ', pa: 'ਪਾਰਟੀਆਂ', ar: 'الأطراف', es: 'Partes', fr: 'Parties' },
  'inventory.page.notifications': { en: 'Notifications', hi: 'सूचनाएं', bn: 'বিজ্ঞপ্তি', te: 'నోటిఫಿಕేషన్‌లు', mr: 'सूचना', ta: 'அறிவிப்புகள்', ur: 'اطلاعات', gu: 'સૂચનાઓ', kn: 'ಅಧಿಸೂಚನೆಗಳು', ml: 'അറിയിപ്പുകൾ', pa: 'ਸੂਚਨਾਵਾਂ', ar: 'الإشعارات', es: 'Notificaciones', fr: 'Notifications' },
  'inventory.page.reports': { en: 'Reports & analytics', hi: 'रिपोर्ट और विश्लेषण', bn: 'রিপোর্ট ও বিশ্লেষণ', te: 'రిపోర్టులు మరియు విశ్లేషణలు', mr: 'अहवाल आणि विश्लेषण', ta: 'அறிக்கைகள் மற்றும் பகுப்பாய்வு', ur: 'رپورٹس اور تجزیات', gu: 'રિપોર્ટ અને એનાલિટિક્સ', kn: 'ವರದಿ ಮತ್ತು ವಿಶ್ಲೇಷಣೆ', ml: 'റിപ്പോർട്ടുകളും വിശകലനവും', pa: 'ਰਿਪੋਰਟਾਂ ਅਤੇ ਵਿਸ਼ਲੇਸ਼ਣ', ar: 'التقارير والتحليلات', es: 'Informes y analíticas', fr: 'Rapports et analyses' },
  'inventory.parties.customers': { en: 'Customers', hi: 'ग्राहक', bn: 'গ্রাহক', te: 'కస్టమర్లు', mr: 'ग्राहक', ta: 'வாடிக்கையாளர்கள்', ur: 'گاہک', gu: 'ગ્રાહકો', kn: 'ಗ್ರಾಹಕರು', ml: 'ഉപഭോക്താക്കൾ', pa: 'ਗਾਹਕ', ar: 'العملاء', es: 'Clientes', fr: 'Clients' },
  'inventory.parties.vendors': { en: 'Vendors', hi: 'विक्रेता', bn: 'বিক্রেতা', te: 'వెండర్లు', mr: 'पुरवठादार', ta: 'விற்பனையாளர்கள்', ur: 'فروخت کنندہ', gu: 'વેન્ડરો', kn: 'ವಿಕ್ರೇತರು', ml: 'വെൻഡർമാർ', pa: 'ਵਿਕਰੇਤਾ', ar: 'الموردون', es: 'Proveedores', fr: 'Fournisseurs' },
  'inventory.parties.priceLists': { en: 'Price lists', hi: 'मूल्य सूची', bn: 'মূল্য তালিকা', te: 'ధరల జాబితా', mr: 'किंमत सूची', ta: 'விலைப்பட்டியல்', ur: 'قیمت کی فہرست', gu: 'કિંમત યાદી', kn: 'ಬೆಲೆಪಟ್ಟಿಗಳು', ml: 'വിലപ്പട്ടിക', pa: 'ਕੀਮਤ ਸੂਚੀ', ar: 'قوائم الأسعار', es: 'Listas de precios', fr: 'Listes de prix' },
  'inventory.notifications.markAllRead': { en: 'Mark all read', hi: 'सभी को पढ़ा हुआ चिह्नित करें', bn: 'সব পড়া হিসেবে চিহ্নিত করুন', te: 'అన్నీ చదివినట్లుగా గుర్తించండి', mr: 'सर्व वाचले म्हणून चिन्हांकित करा', ta: 'அனைத்தையும் படித்ததாக குறிக்கவும்', ur: 'سب کو پڑھا ہوا نشان زد کریں', gu: 'બધાને વાંચેલ તરીકે ચિહ્નિત કરો', kn: 'ಎಲ್ಲವನ್ನೂ ಓದಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ', ml: 'എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക', pa: 'ਸਭ ਪੜ੍ਹੇ ਹੋਏ ਵਜੋਂ ਨਿਸ਼ਾਨ ਲਗਾਓ', ar: 'تحديد الكل كمقروء', es: 'Marcar todo como leído', fr: 'Tout marquer comme lu' },

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
  if (!key) return '';
  if (lang === 'en') {
    const entry = translations[key];
    if (entry) return entry.en ?? key;
    return key;
  }
  
  // 1. Direct translation key lookup
  const entry = translations[key];
  if (entry) {
    return entry[lang] ?? entry.en ?? key;
  }

  // 2. Direct string match on English dictionary entry
  const trimmed = key.trim().toLowerCase();
  for (const k in translations) {
    if (translations[k].en?.toLowerCase() === trimmed) {
      return translations[k][lang] ?? translations[k].en ?? key;
    }
  }

  return key;
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

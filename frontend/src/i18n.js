// frontend/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', english: 'English', native: 'English' },
  { code: 'ml', english: 'Malayalam', native: 'മലയാളം' },
  { code: 'hi', english: 'Hindi', native: 'हिन्दी' },
];

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Settings": "Settings",
      "Billing": "Billing",
      "Reports": "Reports",
      "Team": "Team",
      "Automations": "Automations",
      "Integrations": "Integrations",
      "Board": "Board",
      "Language": "Language",
      "Workspace": "Workspace",
      "Overview": "Overview",
      "Gantt": "Gantt",
      "Timeline": "Timeline",
      "Calendar": "Calendar",
      "Templates": "Templates",
      "Onboarding": "Onboarding",
      "Resources": "Resources",
      "Feedback": "Feedback",
      "Audit Log": "Audit Log",
      "Quick access": "Quick access",
      "Projects": "Projects",
      "New project...": "New project...",
      "Create project": "Create project",
      "Enter a project name to create it.": "Enter a project name to create it.",
      "No projects yet": "No projects yet",
      "Create your first project": "Create your first project",
      "Name your project in the sidebar to get started. Nothing is created automatically.": "Name your project in the sidebar to get started. Nothing is created automatically.",
      "Select a project": "Select a project",
      "Export CSV": "Export CSV",
      "Notifications": "Notifications",
      "unread": "unread",
      "No new notifications": "No new notifications",
      "Mark all read": "Mark all read",
      "Upgrade": "Upgrade",
      "Account settings": "Account settings",
      "Rename board...": "Rename board...",
      "Rename": "Rename",
      "Delete": "Delete",
      "Sign Out": "Sign Out",
      "Sign In": "Sign In",
      "Sign Up": "Sign Up",
      "Team Members": "Team Members",
      "Email address": "Email address",
      "Password for new user": "Password for new user",
      "Send Invite": "Send Invite",
      "Activity Log": "Activity Log",
      "No activity recorded yet.": "No activity recorded yet.",
      "Owner": "Owner",
      "Administrator": "Administrator",
      "Editor": "Editor",
      "Guest": "Guest",
      "Subscriber": "Subscriber",
      "plan": "plan",
      "Hide sidebar": "Hide sidebar",
      "Show sidebar": "Show sidebar",
      "Welcome back": "Welcome back",
      "Create account": "Create account",
      "Sign in to your workspace": "Sign in to your workspace",
      "Create your workspace account": "Create your workspace account",
      "Select your role to continue": "Select your role to continue",
      "Choose a role to get started": "Choose a role to get started",
      "Full Name": "Full Name",
      "Email": "Email",
      "Password": "Password",
      "Select Role": "Select Role",
      "Please wait...": "Please wait...",
      "Email and password are required": "Email and password are required",
      "Please select a role": "Please select a role",
      "Full access to everything": "Full access to everything",
      "Manage boards, members & settings": "Manage boards, members & settings",
      "Create, edit, delete tasks": "Create, edit, delete tasks",
      "View board + create tasks only": "View board + create tasks only",
      "View only access": "View only access",
      "Role can be changed later by Owner/Admin in Team settings": "Role can be changed later by Owner/Admin in Team settings",
    }
  },
  ml: {
    translation: {
      "Dashboard": "ഡാഷ്ബോർഡ്",
      "Settings": "സെറ്റിംഗ്സ്",
      "Billing": "ബില്ലിംഗ്",
      "Reports": "റിപ്പോർട്ടുകൾ",
      "Team": "ടീം",
      "Automations": "ഓട്ടോമേഷൻസ്",
      "Integrations": "ഇന്റഗ്രേഷൻസ്",
      "Board": "ബോർഡ്",
      "Language": "ഭാഷ",
      "Workspace": "വർക്ക്‌സ്പേസ്",
      "Overview": "അവലോകനം",
      "Gantt": "ഗാന്റ്റ്",
      "Timeline": "ടൈംലൈൻ",
      "Calendar": "കലണ്ടർ",
      "Templates": "ടെംപ്ലേറ്റുകൾ",
      "Onboarding": "ഓൺബോർഡിംഗ്",
      "Resources": "വിഭവങ്ങൾ",
      "Feedback": "പ്രതികരണം",
      "Audit Log": "ഓഡിറ്റ് ലോഗ്",
      "Quick access": "വേഗത്തിൽ ലഭ്യമാകുന്നവ",
      "Projects": "പ്രോജക്റ്റുകൾ",
      "New project...": "പുതിയ പ്രോജക്റ്റ്...",
      "Create project": "പ്രോജക്റ്റ് സൃഷ്ടിക്കുക",
      "Enter a project name to create it.": "സൃഷ്ടിക്കാൻ ഒരു പ്രോജക്റ്റിന്റെ പേര് നൽകുക.",
      "No projects yet": "ഇതുവരെ പ്രോജക്റ്റുകളില്ല",
      "Create your first project": "നിങ്ങളുടെ ആദ്യ പ്രോജക്റ്റ് സൃഷ്ടിക്കുക",
      "Name your project in the sidebar to get started. Nothing is created automatically.": "തുടങ്ങാൻ സൈഡ്ബാറിൽ നിങ്ങളുടെ പ്രോജക്റ്റിന് പേര് നൽകുക. ഒന്നും സ്വയമായി സൃഷ്ടിക്കപ്പെടില്ല.",
      "Select a project": "ഒരു പ്രോജക്റ്റ് തിരഞ്ഞെടുക്കുക",
      "Export CSV": "CSV എക്സ്പോർട്ട് ചെയ്യുക",
      "Notifications": "അറിയിപ്പുകൾ",
      "unread": "വായിച്ചതില്ലാത്ത",
      "No new notifications": "പുതിയ അറിയിപ്പുകളില്ല",
      "Mark all read": "എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക",
      "Upgrade": "അപ്ഗ്രേഡ് ചെയ്യുക",
      "Account settings": "അക്കൗണ്ട് സെറ്റിംഗ്സ്",
      "Rename board...": "ബോർഡിന്റെ പേരുമാറ്റുക...",
      "Rename": "പേരുമാറ്റുക",
      "Delete": "ഇല്ലാതാക്കുക",
      "Sign Out": "സൈൻ ഔട്ട്",
      "Sign In": "സൈൻ ഇൻ",
      "Sign Up": "സൈൻ അപ്പ്",
      "Team Members": "ടീം അംഗങ്ങൾ",
      "Email address": "ഇമെയിൽ വിലാസം",
      "Password for new user": "പുതിയ ഉപയോക്താവിനുള്ള പാസ്‌വേഡ്",
      "Send Invite": "ക്ഷണനിഷേധനം അയയ്ക്കുക",
      "Activity Log": "പ്രവൃത്തി ലോഗ്",
      "No activity recorded yet.": "ഇതുവരെ പ്രവൃത്തി രേക്കർഡ് ചെയ്തിട്ടില്ല.",
      "Owner": "ഉടമ",
      "Administrator": "നിരൂപകൻ",
      "Editor": "എഡിറ്റർ",
      "Guest": "അതിഥി",
      "Subscriber": "സബ്‌സ്ക്രൈബർ",
      "plan": "പ്ലാൻ",
      "Hide sidebar": "സൈഡ്ബാർ മറയ്ക്കുക",
      "Show sidebar": "സൈഡ്ബാർ കാണിക്കുക",
      "Welcome back": "തിരികെ സ്വാഗതം",
      "Create account": "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
      "Sign in to your workspace": "നിങ്ങളുടെ വർക്ക്‌സ്പേസിലേക്ക് സൈൻ ഇൻ ചെയ്യുക",
      "Create your workspace account": "നിങ്ങളുടെ വർക്ക്‌സ്പേസ് അക്കൗണ്ട് സൃഷ്ടിക്കുക",
      "Select your role to continue": "തുടരാൻ നിങ്ങളുടെ റോൾ തിരഞ്ഞെടുക്കുക",
      "Choose a role to get started": "തുടങ്ങാൻ ഒരു റോൾ തിരഞ്ഞെടുക്കുക",
      "Full Name": "പൂർണ്ണ നാമം",
      "Email": "ഇമെയിൽ",
      "Password": "പാസ്‌വേഡ്",
      "Select Role": "റോൾ തിരഞ്ഞെടുക്കുക",
      "Please wait...": "ദയവേടിക്ക് കാത്തിരിക്കുക...",
      "Email and password are required": "ഇമെയിലും പാസ്‌വേഡും ആവശ്യമാണ്",
      "Please select a role": "ദയവേടിക്ക് ഒരു റോൾ തിരഞ്ഞെടുക്കുക",
      "Full access to everything": "എല്ലാതിനും പൂർണ്ണ ആക്സസ്",
      "Manage boards, members & settings": "ബോർഡുകൾ, അംഗങ്ങൾ, സെറ്റിംഗ്സ് നിരൂപിക്കുക",
      "Create, edit, delete tasks": "ടാസ്കുകൾ സൃഷ്ടിക്കുക, എഡിറ്റ് ചെയ്യുക, ഇല്ലാതാക്കുക",
      "View board + create tasks only": "ബോർഡ് കാണുക, ടാസ്കുകൾ സൃഷ്ടിക്കുക മാത്രം",
      "View only access": "കാണുന്നതിന് മാത്രം ആക്സസ്",
      "Role can be changed later by Owner/Admin in Team settings": "റോൾ പിന്നീട് Team സെറ്റിംഗ്സിൽ Owner/Admin മാറ്റാം",
    }
  },
  hi: {
    translation: {
      "Dashboard": "डैशबोर्ड",
      "Settings": "सेटिंग्स",
      "Billing": "बिलिंग",
      "Reports": "रिपोर्ट",
      "Team": "टीम",
      "Automations": "स्वचालन",
      "Integrations": "एकीकरण",
      "Board": "बोर्ड",
      "Language": "भाषा",
      "Workspace": "कार्यक्षेत्र",
      "Overview": "अवलोकन",
      "Gantt": "गैंट",
      "Timeline": "टाइमलाइन",
      "Calendar": "कैलेंडर",
      "Templates": "टेम्पलेट",
      "Onboarding": "ऑनबोर्डिंग",
      "Resources": "संसाधन",
      "Feedback": "प्रतिक्रिया",
      "Audit Log": "ऑडिट लॉग",
      "Quick access": "त्वरित पहुँच",
      "Projects": "प्रोजेक्ट",
      "New project...": "नया प्रोजेक्ट...",
      "Create project": "प्रोजेक्ट बनाएँ",
      "Enter a project name to create it.": "बनाने के लिए प्रोजेक्ट का नाम दर्ज करें।",
      "No projects yet": "अभी तक कोई प्रोजेक्ट नहीं",
      "Create your first project": "अपना पहला प्रोजेक्ट बनाएँ",
      "Name your project in the sidebar to get started. Nothing is created automatically.": "शुरू करने के लिए साइडबार में अपने प्रोजेक्ट का नाम रखें। कुछ भी स्वतः नहीं बनाया जाता।",
      "Select a project": "प्रोजेक्ट चुनें",
      "Export CSV": "CSV निर्यात",
      "Notifications": "सूचनाएँ",
      "unread": "अपठित",
      "No new notifications": "कोई नई सूचना नहीं",
      "Mark all read": "सभी को पढ़ा हुआ चिह्नित करें",
      "Upgrade": "अपग्रेड करें",
      "Account settings": "खाता सेटिंग्स",
      "Rename board...": "बोर्ड का नाम बदलें...",
      "Rename": "नाम बदलें",
      "Delete": "हटाएँ",
      "Sign Out": "साइन आउट",
      "Sign In": "साइन इन",
      "Sign Up": "साइन अप",
      "Team Members": "टीम सदस्य",
      "Email address": "ईमेल पता",
      "Password for new user": "नए उपयोगकर्ता का पासवर्ड",
      "Send Invite": "आमंत्रण भेजें",
      "Activity Log": "गतिविधि लॉग",
      "No activity recorded yet.": "अभी तक कोई गतिविधि दर्ज नहीं हुई है।",
      "Owner": "स्वामी",
      "Administrator": "प्रशासक",
      "Editor": "संपादक",
      "Guest": "अतिथि",
      "Subscriber": "सदस्य",
      "plan": "प्लान",
      "Hide sidebar": "साइडबार छिपाएँ",
      "Show sidebar": "साइडबार दिखाएँ",
      "Welcome back": "वापसी पर स्वागत है",
      "Create account": "खाता बनाएँ",
      "Sign in to your workspace": "अपने कार्यक्षेत्र में साइन इन करें",
      "Create your workspace account": "अपना कार्यक्षेत्र खाता बनाएँ",
      "Select your role to continue": "जारी रखने के लिए अपनी भूमिका चुनें",
      "Choose a role to get started": "शुरू करने के लिए एक भूमिका चुनें",
      "Full Name": "पूरा नाम",
      "Email": "ईमेल",
      "Password": "पासवर्ड",
      "Select Role": "भूमिका चुनें",
      "Please wait...": "कृपया प्रतीक्षा करें...",
      "Email and password are required": "ईमेल और पासवर्ड आवश्यक हैं",
      "Please select a role": "कृपया एक भूमिका चुनें",
      "Full access to everything": "सब कुछ तक पूर्ण पहुँच",
      "Manage boards, members & settings": "बोर्ड, सदस्य और सेटिंग्स प्रबंधित करें",
      "Create, edit, delete tasks": "कार्य बनाएँ, संपादित करें, हटाएँ",
      "View board + create tasks only": "केवल बोर्ड देखें और कार्य बनाएँ",
      "View only access": "केवल देखने की पहुँच",
      "Role can be changed later by Owner/Admin in Team settings": "भूमिका बाद में Team सेटिंग्स में Owner/Admin द्वारा बदली जा सकती है",
    }
  }
};

const isSupported = (code) => SUPPORTED_CODES.includes(code);

const readStoredLanguage = () => {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const storedLanguage = typeof window !== 'undefined' ? readStoredLanguage() : null;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: isSupported(storedLanguage) ? storedLanguage : 'en', // ഡിഫോൾട്ട് ഭാഷ
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_CODES,
    load: 'currentOnly',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// ഭാഷ മാറ്റുമ്പോൾ സ്റ്റോറേജിലും document lang attribute-ലും സിങ്ക് ചെയ്യുക
i18n.on('languageChanged', (lng) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* storage unavailable - language still applies for this session */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || 'en';
}

export default i18n;

// frontend/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
      "Language": "Language"
      // ഭാവിയിൽ നിങ്ങൾക്ക് ആവശ്യമായ ഇംഗ്ലീഷ് വാക്കുകൾ ഇവിടെ ചേർക്കാം
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
      "Language": "ഭാഷ"
      // ഭാവിയിൽ നിങ്ങൾക്ക് ആവശ്യമായ മലയാളം വാക്കുകൾ ഇവിടെ ചേർക്കാം
    }
  },
  hi: {
    translation: {
      "Dashboard": "डैशबोर्ड (Dashboard)",
      "Settings": "सेटिंग्स (Settings)",
      "Billing": "बिलिंग (Billing)",
      "Reports": "रिपोर्ट (Reports)",
      "Team": "टीम (Team)",
      "Automations": "स्वचालन (Automations)",
      "Integrations": "एकीकरण (Integrations)",
      "Board": "बोर्ड (Board)",
      "Language": "भाषा (Language)"
      // ഭാവിയിൽ നിങ്ങൾക്ക് ആവശ്യമായ ഹിന്ദി വാക്കുകൾ ഇവിടെ ചേർക്കാം
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // ഡിഫോൾട്ട് ഭാഷ
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
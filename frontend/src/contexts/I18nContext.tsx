import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Translations = Record<string, any>;

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: Translations;
  languages: { code: string; name: string; flag: string }[];
}

const defaultTranslations: Translations = {
  app_name: "Life",
  create_character: "Create Character",
  name: "Name",
  age: "Age",
  gender: "Gender",
  male: "Male",
  female: "Female",
  other: "Other",
  login: "Login",
  register: "Register",
  logout: "Logout",
  settings: "Settings",
  language: "Language",
  travel: "Travel",
  simulate: "Simulate Life",
  have_baby: "Have a Baby",
  premium: { title: "Premium", features: [], price: "$4.99/month" },
  needs: { hunger: "Hunger", energy: "Energy", social: "Social", hygiene: "Hygiene", fun: "Fun", bladder: "Bladder", comfort: "Comfort" },
  chat: { send: "Send", placeholder: "Type a message..." }
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('en');
  const [translations, setTranslations] = useState<Translations>(defaultTranslations);

  const loadTranslations = async (lang: string) => {
    try {
      const response = await axios.get(`${API_BASE}/api/translations/${lang}`);
      setTranslations(response.data);
    } catch (error) {
      console.error('Failed to load translations:', error);
      setTranslations(defaultTranslations);
    }
  };

  useEffect(() => {
    loadTranslations(language);
  }, [language]);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    loadTranslations(lang);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import tr from './locales/tr.json';

const LANG_KEY = '@pratik_kelime_lang';

const resources = { en: { translation: en }, tr: { translation: tr } };

i18n.use(initReactI18next).init({
  resources,
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export async function loadSavedLanguage() {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  if (saved && (saved === 'tr' || saved === 'en')) {
    await i18n.changeLanguage(saved);
  }
}

export async function changeLanguage(lang: string) {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_KEY, lang);
}

export default i18n;

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Import locale JSON files
import enLocale from '@/locales/en.json';
import trLocale from '@/locales/tr.json';
import prLocale from '@/locales/pr.json';
import deLocale from '@/locales/de.json';
import esLocale from '@/locales/es.json';
import frLocale from '@/locales/fr.json';
import ptLocale from '@/locales/pt.json';

const LanguageContext = createContext();

// Locale data map
const locales = {
  en: enLocale,
  tr: trLocale,
  pr: prLocale,  // Brazilian Portuguese
  de: deLocale,
  es: esLocale,
  fr: frLocale,
  pt: ptLocale
};

// Helper function to get nested value from object using dot notation
const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }

  return current;
};

// Supported UI locales (only TR and EN for now)
const supportedUILocales = ['tr', 'en'];

export function LanguageProvider({ children }) {
  // Default to Turkish
  const [locale, setLocale] = useState('tr');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Default to Turkish if not set
      let saved = localStorage.getItem('locale') || 'tr';
      // If PR was previously selected, fallback to EN (PR removed from UI languages)
      if (!supportedUILocales.includes(saved)) {
        saved = 'en';
        localStorage.setItem('locale', saved);
      }
      setLocale(saved);
    }
  }, []);

  const changeLocale = (newLocale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
  };

  // Translation function - looks up key in locale JSON files
  const t = useCallback((key) => {
    if (!key) return '';

    // Get the current locale data
    const localeData = locales[locale] || locales['en'];

    // Try to get the value from current locale
    let value = getNestedValue(localeData, key);

    // If not found in current locale, fallback to English
    if (value === undefined && locale !== 'en') {
      value = getNestedValue(locales['en'], key);
    }

    // If still not found, return the key itself (for debugging)
    if (value === undefined) {
      // Only warn in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Translation key not found: ${key}`);
      }
      // Return the last part of the key as readable text
      const lastPart = key.split('.').pop();
      return lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    }

    return value;
  }, [locale]);

  // Legacy tr function for dynamic translations (API-based)
  // Kept for backward compatibility but now just returns the text
  const tr = useCallback((text) => {
    return text;
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, changeLocale, tr, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

export default LanguageContext;

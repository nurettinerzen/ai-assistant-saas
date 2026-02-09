'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Import locale JSON files
import enLocale from '@/locales/en.json';
import trLocale from '@/locales/tr.json';
import deLocale from '@/locales/de.json';
import esLocale from '@/locales/es.json';
import frLocale from '@/locales/fr.json';

const LanguageContext = createContext();

// Locale data map - add new languages here when ready
const locales = {
  en: enLocale,
  tr: trLocale,
  de: deLocale,
  es: esLocale,
  fr: frLocale,
};

// Supported UI locales - add locale codes here to enable them in the UI
const supportedUILocales = ['tr', 'en'];

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

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('tr');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('locale') || 'tr';
      // If saved locale is not in supported list, fallback to TR
      if (!supportedUILocales.includes(saved)) {
        saved = 'tr';
        localStorage.setItem('locale', saved);
      }
      setLocale(saved);
      // Update HTML lang attribute
      document.documentElement.lang = saved;
    }
  }, []);

  const changeLocale = useCallback((newLocale) => {
    if (!supportedUILocales.includes(newLocale)) return;
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  // Translation function - looks up key in locale JSON files
  // Supports optional interpolation: t('key', { name: 'John' }) replaces {name} in the value
  const t = useCallback((key, params) => {
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

    // Apply interpolation if params provided
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) =>
        params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`
      );
    }

    return value;
  }, [locale]);

  // Legacy tr function for dynamic translations (API-based)
  // Kept for backward compatibility but now just returns the text
  const tr = useCallback((text) => {
    return text;
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, changeLocale, tr, t, supportedUILocales }}>
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

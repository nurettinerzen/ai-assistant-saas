'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Statik locale imports
import tr from '@/locales/tr.json';
import en from '@/locales/en.json';
import de from '@/locales/de.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';
import it from '@/locales/it.json';
import pt from '@/locales/pt.json';
import ru from '@/locales/ru.json';
import ar from '@/locales/ar.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import zh from '@/locales/zh.json';
import hi from '@/locales/hi.json';
import nl from '@/locales/nl.json';
import pl from '@/locales/pl.json';
import sv from '@/locales/sv.json';

const locales = { tr, en, de, fr, es, it, pt, ru, ar, ja, ko, zh, hi, nl, pl, sv };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('tr'); // Default Türkçe

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('locale');
      if (saved && locales[saved]) {
        setLocale(saved);
      }
    }
  }, []);

  const changeLocale = useCallback((newLocale) => {
    if (locales[newLocale]) {
      setLocale(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('locale', newLocale);
      }
    }
  }, []);

  // Nested key resolver: 'landing.hero.title' → locales.tr.landing.hero.title
  const t = useCallback((key) => {
    if (!key) return '';

    const getNestedValue = (obj, path) => {
      const keys = path.split('.');
      let value = obj;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) return undefined;
      }
      return value;
    };

    // Try current locale
    let value = getNestedValue(locales[locale], key);

    // Fallback to Turkish (primary)
    if (value === undefined && locale !== 'tr') {
      value = getNestedValue(locales['tr'], key);
    }

    // Fallback to English
    if (value === undefined && locale !== 'en') {
      value = getNestedValue(locales['en'], key);
    }

    // Fallback to key itself
    return value ?? key;
  }, [locale]);

  // Backward compatibility: tr() function that just returns the key's translation
  // Previously this sent text to Google Translate API
  const tr = useCallback((text) => {
    if (!text) return '';
    return text; // Now just returns the original text - translations should use t() with keys
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    locale,
    language: locale, // alias for backward compatibility
    changeLocale,
    setLocale: changeLocale, // alias for backward compatibility
    t,
    tr
  }), [locale, changeLocale, t, tr]);

  return (
    <LanguageContext.Provider value={contextValue}>
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

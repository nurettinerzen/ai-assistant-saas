'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext();
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache
const cache = {};

const getCache = (text, locale) => {
  const key = `${locale}:${text}`;
  if (cache[key]) return cache[key];
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`tr_${key}`);
      if (stored) { cache[key] = stored; return stored; }
    } catch(e) {}
  }
  return null;
};

const setCache = (text, locale, translation) => {
  const key = `${locale}:${text}`;
  cache[key] = translation;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(`tr_${key}`, translation); } catch(e) {}
  }
};

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [, forceUpdate] = useState(0);
  const queue = useRef([]);
  const timer = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('locale') || 'en';
      setLocale(saved);
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (queue.current.length === 0 || locale === 'en') return;

    const texts = [...new Set(queue.current)];
    queue.current = [];

    const uncached = texts.filter(t => !getCache(t, locale));
    if (uncached.length === 0) return;

    try {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: uncached, targetLang: locale })
      });

      const data = await response.json();

      if (data.translations) {
        uncached.forEach((text, i) => {
          if (data.translations[i]) {
            setCache(text, locale, data.translations[i]);
          }
        });
        forceUpdate(n => n + 1);
      }
    } catch (e) {
      console.error('Translation error:', e);
    }
  }, [locale]);

  const changeLocale = (newLocale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
  };

  const tr = useCallback((text) => {
    if (!text || locale === 'en') return text;

    const cached = getCache(text, locale);
    if (cached) return cached;

    // Add to queue
    if (!queue.current.includes(text)) {
      queue.current.push(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(processQueue, 500);
    }

    return text;
  }, [locale, processQueue]);

  const t = useCallback((key) => {
    if (!key) return '';

    // Look up the key in translations object
    const englishText = translations[key];

    // If key exists in translations, use it
    if (englishText) {
      return tr(englishText);
    }

    // Fallback: handle dotted keys (e.g., "dashboard.navBuild")
    // This is for backward compatibility - convert to readable text
    if (key.includes('.')) {
      const last = key.split('.').pop();
      const readable = last.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      console.warn(`Translation key not found: ${key}, using fallback: ${readable}`);
      return tr(readable);
    }

    // Last resort: return the key itself
    console.warn(`Translation key not found: ${key}`);
    return tr(key);
  }, [tr]);

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

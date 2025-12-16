'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext();
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Global in-memory cache (persists across renders)
const memoryCache = new Map();

// Track pending translations to avoid duplicate requests
const pendingTranslations = new Set();

// Track texts that have been requested (even if not yet translated)
const requestedTexts = new Set();

const getCache = (text, locale) => {
  const key = `${locale}:${text}`;

  // Check memory cache first (fastest)
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  // Check localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`tr_${key}`);
      if (stored) {
        memoryCache.set(key, stored); // Populate memory cache
        return stored;
      }
    } catch(e) {}
  }
  return null;
};

const setCache = (text, locale, translation) => {
  const key = `${locale}:${text}`;
  memoryCache.set(key, translation);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`tr_${key}`, translation);
    } catch(e) {}
  }
};

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [, forceUpdate] = useState(0);
  const queue = useRef([]);
  const timer = useRef(null);
  const isProcessing = useRef(false);
  const updateTimer = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('locale') || 'en';
      setLocale(saved);
    }
  }, []);

  // Debounced update trigger - only triggers once after all translations complete
  const triggerUpdate = useCallback(() => {
    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(() => {
      forceUpdate(n => n + 1);
    }, 500); // Wait 500ms after last translation before re-rendering
  }, []);

  // Stable processQueue function - doesn't depend on locale from closure
  const processQueue = useCallback(async (currentLocale) => {
    if (queue.current.length === 0 || currentLocale === 'en' || isProcessing.current) return;

    isProcessing.current = true;
    const texts = [...new Set(queue.current)];
    queue.current = [];

    // Filter out already cached, pending, and previously requested translations
    const uncached = texts.filter(t => {
      const key = `${currentLocale}:${t}`;
      if (getCache(t, currentLocale)) return false;
      if (pendingTranslations.has(key)) return false;
      if (requestedTexts.has(key)) return false;
      return true;
    });

    if (uncached.length === 0) {
      isProcessing.current = false;
      return;
    }

    // Mark as pending AND requested (requested persists even after completion)
    uncached.forEach(t => {
      const key = `${currentLocale}:${t}`;
      pendingTranslations.add(key);
      requestedTexts.add(key);
    });

    try {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: uncached, targetLang: currentLocale })
      });

      const data = await response.json();

      if (data.translations) {
        let hasNewTranslations = false;
        uncached.forEach((text, i) => {
          if (data.translations[i]) {
            const existingCache = getCache(text, currentLocale);
            if (!existingCache) {
              setCache(text, currentLocale, data.translations[i]);
              hasNewTranslations = true;
            }
          }
          // Remove from pending (but keep in requestedTexts)
          pendingTranslations.delete(`${currentLocale}:${text}`);
        });

        // Debounced update - don't trigger immediately
        if (hasNewTranslations) {
          triggerUpdate();
        }
      }
    } catch (e) {
      console.error('Translation error:', e);
      // Remove from pending on error (but keep in requestedTexts to prevent retry)
      uncached.forEach(t => pendingTranslations.delete(`${currentLocale}:${t}`));
    } finally {
      isProcessing.current = false;
    }
  }, [triggerUpdate]);

  const changeLocale = useCallback((newLocale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
    // Clear requested texts when locale changes so new translations can be fetched
    requestedTexts.clear();
  }, []);

  // Stable tr function - uses ref to access current locale
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const tr = useCallback((text) => {
    if (!text || localeRef.current === 'en') return text;

    const currentLocale = localeRef.current;
    const cached = getCache(text, currentLocale);
    if (cached) return cached;

    const key = `${currentLocale}:${text}`;

    // Skip if already pending or previously requested
    if (pendingTranslations.has(key) || requestedTexts.has(key)) {
      return text;
    }

    // Add to queue if not already there
    if (!queue.current.includes(text)) {
      queue.current.push(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => processQueue(currentLocale), 200);
    }

    return text;
  }, [processQueue]); // Only depends on stable processQueue

  const t = useCallback((key) => {
    if (!key) return '';

    // Look up the key in translations object
    const englishText = translations[key];

    // If key exists in translations, use it
    if (englishText) {
      return tr(englishText);
    }

    // Fallback: handle dotted keys (e.g., "dashboard.navBuild")
    if (key.includes('.')) {
      const last = key.split('.').pop();
      const readable = last.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      return tr(readable);
    }

    // Last resort: return the key itself
    return tr(key);
  }, [tr]); // Only depends on stable tr

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    locale,
    changeLocale,
    tr,
    t
  }), [locale, changeLocale, tr, t]);

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

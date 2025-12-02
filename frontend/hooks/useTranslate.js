import { useState, useEffect, useCallback } from 'react';

// Cache translations in memory and localStorage
const translationCache = {};

const getFromCache = (text, locale) => {
  const key = `${locale}:${text}`;
  if (translationCache[key]) return translationCache[key];
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`tr_${key}`);
    if (stored) {
      translationCache[key] = stored;
      return stored;
    }
  }
  return null;
};

const saveToCache = (text, locale, translation) => {
  const key = `${locale}:${text}`;
  translationCache[key] = translation;
  if (typeof window !== 'undefined') {
    localStorage.setItem(`tr_${key}`, translation);
  }
};

const translateText = async (text, targetLang) => {
  if (!text || targetLang === 'en') return text;
  
  const cached = getFromCache(text, targetLang);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translation = data.responseData.translatedText;
      saveToCache(text, targetLang, translation);
      return translation;
    }
    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};

export function useTranslate(locale) {
  const [translations, setTranslations] = useState({});
  
  const tr = useCallback((text) => {
    if (!text || locale === 'en') return text;
    
    const cached = getFromCache(text, locale);
    if (cached) return cached;
    
    // Return original while loading, trigger async translation
    if (!translations[text]) {
      translateText(text, locale).then(translated => {
        setTranslations(prev => ({ ...prev, [text]: translated }));
      });
    }
    
    return translations[text] || text;
  }, [locale, translations]);
  
  return { tr };
}

// Simple sync version using only cache
export function useTranslateSync(locale) {
  const tr = useCallback((text) => {
    if (!text || locale === 'en') return text;
    return getFromCache(text, locale) || text;
  }, [locale]);
  
  return { tr };
}

export default useTranslate;

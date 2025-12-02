'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

// 🌍 15+ LANGUAGES SUPPORT
const languages = [
  // Main languages
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', group: 'main' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', group: 'main' },
  
  // European languages
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', group: 'europe' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', group: 'europe' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', group: 'europe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', group: 'europe' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', group: 'europe' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', group: 'europe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', group: 'europe' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', group: 'europe' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', group: 'europe' },
  
  // Asian & Middle Eastern languages
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', group: 'asia' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', group: 'asia' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', group: 'asia' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', group: 'asia' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', group: 'asia' },
];

export default function LanguageSwitcher() {
  const { locale, changeLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleChangeLocale = (newLocale) => {
    changeLocale(newLocale);
    setIsOpen(false);
    // Sayfayı yenilemeye gerek yok, context otomatik günceller
  };

  const currentLang = languages.find(lang => lang.code === locale);
  const mainLanguages = languages.filter(l => l.group === 'main');
  const europeLanguages = languages.filter(l => l.group === 'europe');
  const asiaLanguages = languages.filter(l => l.group === 'asia');

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-xl">{currentLang?.flag}</span>
          <span className="hidden md:inline">{currentLang?.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
        {/* Main Languages */}
        <DropdownMenuLabel className="text-xs text-neutral-500">Main</DropdownMenuLabel>
        {mainLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLocale(lang.code)}
            className={`cursor-pointer ${locale === lang.code ? 'bg-primary-50' : ''}`}
          >
            <span className="text-xl mr-2">{lang.flag}</span>
            <span className="flex-1">{lang.nativeName}</span>
            {locale === lang.code && <span className="text-primary-600">✓</span>}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* European Languages */}
        <DropdownMenuLabel className="text-xs text-neutral-500">Europe</DropdownMenuLabel>
        {europeLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLocale(lang.code)}
            className={`cursor-pointer ${locale === lang.code ? 'bg-primary-50' : ''}`}
          >
            <span className="text-xl mr-2">{lang.flag}</span>
            <span className="flex-1">{lang.nativeName}</span>
            {locale === lang.code && <span className="text-primary-600">✓</span>}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Asian & Middle Eastern Languages */}
        <DropdownMenuLabel className="text-xs text-neutral-500">Asia & Middle East</DropdownMenuLabel>
        {asiaLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLocale(lang.code)}
            className={`cursor-pointer ${locale === lang.code ? 'bg-primary-50' : ''}`}
          >
            <span className="text-xl mr-2">{lang.flag}</span>
            <span className="flex-1">{lang.nativeName}</span>
            {locale === lang.code && <span className="text-primary-600">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

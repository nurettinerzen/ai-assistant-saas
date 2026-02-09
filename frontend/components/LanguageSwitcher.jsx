'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

// All available languages - only those in supportedUILocales will be shown
const ALL_LANGUAGES = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '\u{1F1EB}\u{1F1F7}' },
];

export default function LanguageSwitcher() {
  const { locale, changeLocale, supportedUILocales } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Filter to only show supported languages
  const languages = ALL_LANGUAGES.filter(lang => supportedUILocales.includes(lang.code));

  const handleChangeLocale = (newLocale) => {
    changeLocale(newLocale);
    setIsOpen(false);
  };

  const currentLang = languages.find(lang => lang.code === locale) || languages[0];

  // If only one language, just show the flag without dropdown
  if (languages.length === 1) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 cursor-default" disabled>
        <Globe className="h-4 w-4" />
        <span className="text-xl">{currentLang?.flag}</span>
        <span className="hidden md:inline">{currentLang?.nativeName}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-xl">{currentLang?.flag}</span>
          <span className="hidden md:inline">{currentLang?.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
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

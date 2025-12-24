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

// Supported languages (UI language only - does not affect region/pricing)
const languages = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'pr', name: 'Portuguese (BR)', nativeName: 'Português (BR)', flag: '🇧🇷' },
];

export default function LanguageSwitcher() {
  const { locale, changeLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

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

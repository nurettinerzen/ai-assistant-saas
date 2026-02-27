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

const LOCALE_DISPLAY_MAP = {
  tr: { codeLabel: 'TR', nativeName: 'Türkçe' },
  en: { codeLabel: 'EN', nativeName: 'English' },
  de: { codeLabel: 'DE', nativeName: 'Deutsch' },
  es: { codeLabel: 'ES', nativeName: 'Español' },
  fr: { codeLabel: 'FR', nativeName: 'Français' },
};

// All available languages - only those in supportedUILocales will be shown
const ALL_LANGUAGES = [
  { code: 'tr' },
  { code: 'en' },
  { code: 'de' },
  { code: 'es' },
  { code: 'fr' },
];

export default function LanguageSwitcher() {
  const { locale, changeLocale, supportedUILocales } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Filter to only show supported languages and map display labels
  const languages = ALL_LANGUAGES
    .filter((lang) => supportedUILocales.includes(lang.code))
    .map((lang) => {
      const display = LOCALE_DISPLAY_MAP[lang.code] || {
        codeLabel: lang.code.toUpperCase(),
        nativeName: lang.code.toUpperCase(),
      };
      return {
        code: lang.code,
        codeLabel: display.codeLabel,
        nativeName: display.nativeName,
      };
    });

  const handleChangeLocale = (newLocale) => {
    changeLocale(newLocale);
    setIsOpen(false);
  };

  const currentLang = languages.find(lang => lang.code === locale) || languages[0];
  const availableCodesLabel = languages.map((lang) => lang.codeLabel).join(' / ');

  // If only one language, show current locale label without dropdown
  if (languages.length === 1) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 cursor-default" disabled>
        <Globe className="h-4 w-4" />
        <span className="font-medium tracking-wide">{currentLang?.codeLabel}</span>
        <span className="hidden md:inline text-xs text-muted-foreground">{currentLang?.nativeName}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="font-medium tracking-wide md:hidden">{currentLang?.codeLabel}</span>
          <span className="hidden md:inline font-medium tracking-wide">{availableCodesLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLocale(lang.code)}
            className={`cursor-pointer ${locale === lang.code ? 'bg-accent' : ''}`}
          >
            <span className="w-10 text-xs font-semibold text-muted-foreground">{lang.codeLabel}</span>
            <span className="flex-1">{lang.nativeName}</span>
            {locale === lang.code && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

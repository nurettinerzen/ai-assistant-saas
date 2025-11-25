'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrentLanguage, setLanguage } from '@/lib/translations';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(getCurrentLanguage());
  }, []);

  const changeLocale = (newLocale) => {
    setLanguage(newLocale);
    setLocale(newLocale);
    window.location.reload(); // Refresh to apply translations
  };

  const currentLang = languages.find(lang => lang.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="text-xl">{currentLang?.flag}</span>
          <span className="hidden md:inline">{currentLang?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLocale(lang.code)}
            className={locale === lang.code ? 'bg-primary-50' : ''}
          >
            <span className="text-xl mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
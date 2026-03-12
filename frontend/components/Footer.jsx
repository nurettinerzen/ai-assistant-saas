'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export const Footer = () => {
  const { t } = useLanguage();

  const links = [
    { labelKey: 'landing.footer.about', href: '/about' },
    { labelKey: 'landing.footer.contact', href: '/contact' },
    { labelKey: 'landing.footer.features', href: '/features' },
    { labelKey: 'landing.footer.pricing', href: '/pricing' },
    { labelKey: 'landing.footer.integrations', href: '/integrations' },
    { labelKey: 'landing.footer.help', href: '/help' },
    { labelKey: 'landing.footer.api', href: '/docs/api' },
    { labelKey: 'landing.footer.privacy', href: '/privacy' },
    { labelKey: 'landing.footer.terms', href: '/terms' },
  ];

  return (
    <footer className="py-8 px-6 sm:px-12 border-t border-gray-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400 dark:text-neutral-500 bg-white dark:bg-neutral-950">
      <div>{t('landing.footer.copyright')}</div>
      <div className="flex flex-wrap gap-5 justify-center">
        {links.map((link, i) => (
          <Link
            key={i}
            href={link.href}
            className="hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </div>
    </footer>
  );
};

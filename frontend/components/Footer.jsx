'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export const Footer = () => {
  const { t } = useLanguage();

  const footerLinks = {
    company: [
      { labelKey: 'landing.footer.about', href: '/about' },
      { labelKey: 'landing.footer.contact', href: '/contact' },
      { labelKey: 'landing.footer.careers', href: '/careers' }
    ],
    product: [
      { labelKey: 'landing.footer.features', href: '/features' },
      { labelKey: 'landing.footer.pricing', href: '/pricing' },
      { labelKey: 'landing.footer.integrations', href: '/features#integrations' }
    ],
    resources: [
      { labelKey: 'landing.footer.blog', href: '/blog' },
      { labelKey: 'landing.footer.help', href: '/help' },
      { labelKey: 'landing.footer.api', href: '/api-docs' }
    ],
    legal: [
      { labelKey: 'landing.footer.privacy', href: '/privacy' },
      { labelKey: 'landing.footer.terms', href: '/terms' }
    ]
  };

  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="text-2xl font-bold gradient-text">
              TELYX.AI
            </Link>
            <p className="text-gray-400 mt-4 text-sm">
              {t('landing.footer.tagline')}
            </p>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.company')}</h4>
            <ul className="space-y-3 text-gray-400">
              {footerLinks.company.map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="hover:text-white transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-3 text-gray-400">
              {footerLinks.product.map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="hover:text-white transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.resources')}</h4>
            <ul className="space-y-3 text-gray-400">
              {footerLinks.resources.map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="hover:text-white transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.legal')}</h4>
            <ul className="space-y-3 text-gray-400">
              {footerLinks.legal.map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="hover:text-white transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400 text-sm">
          <p>{t('landing.footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
};

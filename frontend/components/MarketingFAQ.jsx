'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FAQ_ITEMS = [
  'integrationTime',
  'requiredData',
  'aiToHuman',
  'kvkk',
  'pricingOverage',
];

export default function MarketingFAQ({ className = '' }) {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={`py-16 ${className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {t('marketingFaq.title')}
          </h2>
          <p className="mt-3 text-base text-gray-600 dark:text-neutral-400">
            {t('marketingFaq.subtitle')}
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((itemKey, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={itemKey}
                className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    {t(`marketingFaq.items.${itemKey}.question`)}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-gray-600 dark:text-neutral-300 leading-relaxed">
                    {t(`marketingFaq.items.${itemKey}.answer`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

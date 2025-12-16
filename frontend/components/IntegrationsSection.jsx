'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

export const IntegrationsSection = () => {
  const { t } = useLanguage();

  const integrations = [
    { name: 'ikas', logo: '/integrations/ikas.svg' },
    { name: 'Shopify', logo: '/integrations/shopify.svg' },
    { name: 'WooCommerce', logo: '/integrations/woocommerce.svg' },
    { name: 'Ticimax', logo: '/integrations/ticimax.svg' },
    { name: 'Gmail', logo: '/integrations/gmail.svg' },
    { name: 'Outlook', logo: '/integrations/outlook.svg' },
    { name: 'Google Calendar', logo: '/integrations/google-calendar.svg' },
    { name: 'Stripe', logo: '/integrations/stripe.svg' }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            {t('landing.integrations.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('landing.integrations.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center"
        >
          {integrations.map((integration, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 w-full max-w-[180px] h-24 flex items-center justify-center"
            >
              <div className="relative w-full h-10">
                <Image
                  src={integration.logo}
                  alt={integration.name}
                  fill
                  className="object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<span class="text-lg font-semibold text-gray-600">${integration.name}</span>`;
                  }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

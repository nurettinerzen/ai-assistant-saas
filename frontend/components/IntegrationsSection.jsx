'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight } from 'lucide-react';

export const IntegrationsSection = () => {
  const { t } = useLanguage();

  const integrations = [
    { name: 'ikas', logo: '/integrations/ikas.svg' },
    { name: 'Shopify', logo: '/integrations/shopify.svg' },
    { name: 'IdeaSoft', logo: '/integrations/ideasoft.svg' },
    { name: 'Ticimax', logo: '/integrations/ticimax.svg' },
    { name: 'Gmail', logo: '/integrations/gmail.svg' },
    { name: 'Outlook', logo: '/integrations/outlook.svg' },
    { name: 'Google Calendar', logo: '/integrations/google-calendar.svg' },
    { name: 'iyzico', logo: '/integrations/iyzico.svg' },
    { name: 'Stripe', logo: '/integrations/stripe.svg' },
    { name: 'Parasut', logo: '/integrations/parasut.svg' }
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
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 items-center justify-items-center"
        >
          {integrations.map((integration, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 w-full h-20 flex items-center justify-center group cursor-pointer"
            >
              <div className="relative w-full h-8 group-hover:scale-105 transition-transform duration-300">
                <Image
                  src={integration.logo}
                  alt={integration.name}
                  fill
                  className="object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<span class="text-sm font-semibold text-gray-700">${integration.name}</span>`;
                  }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors group"
          >
            {t('landing.integrations.viewAll')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

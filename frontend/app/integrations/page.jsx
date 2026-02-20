'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plug } from 'lucide-react';

export default function IntegrationsPage() {
  const { t } = useLanguage();

  // Only show actually implemented integrations
  const categories = [
    {
      id: 'data',
      titleKey: 'integrationsPage.categories.data',
      icon: Plug,
      color: 'from-green-500 to-emerald-500',
      integrations: [
        {
          name: 'Shopify',
          descKey: 'integrationsPage.shopify.desc',
          textOnly: true
        },
        {
          name: 'ikas',
          descKey: 'integrationsPage.ikas.desc',
          textOnly: true
        },
        {
          name: 'WhatsApp Business',
          descKey: 'integrationsPage.whatsapp.desc',
          textOnly: true
        },
        {
          name: 'Google Calendar',
          descKey: 'integrationsPage.googleCalendar.desc',
          textOnly: true
        },
        {
          name: 'Webhook API',
          descKey: 'integrationsPage.webhookApi.desc',
          textOnly: true
        },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="w-20 h-20 bg-gradient-to-br from-teal-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-8"
            >
              <Plug className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white"
            >
              {t('integrationsPage.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-600 dark:text-gray-300"
            >
              {t('integrationsPage.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-16">
            {categories.map((category, catIndex) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: catIndex * 0.1 }}
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className={`w-12 h-12 bg-gradient-to-br ${category.color} rounded-xl flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {t(category.titleKey)}
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.integrations.map((integration, intIndex) => (
                      <motion.div
                        key={integration.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: intIndex * 0.05 }}
                        className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-100 dark:border-neutral-700 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="h-12 mb-4 flex items-center">
                          <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            {integration.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t(integration.descKey)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto dark:bg-neutral-800/50 dark:border dark:border-neutral-700">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('integrationsPage.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              {t('integrationsPage.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
                  {t('integrationsPage.cta.button')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  {t('integrationsPage.cta.contact')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

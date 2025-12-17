'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ShoppingCart,
  Calendar,
  Mail,
  Receipt,
  CreditCard,
  MessageSquare,
  Plug
} from 'lucide-react';

export default function IntegrationsPage() {
  const { t } = useLanguage();

  const categories = [
    {
      id: 'ecommerce',
      titleKey: 'integrationsPage.categories.ecommerce',
      icon: ShoppingCart,
      color: 'from-green-500 to-emerald-500',
      integrations: [
        {
          name: 'ikas',
          descKey: 'integrationsPage.ikas.desc',
          logo: '/integrations/ikas.svg'
        },
        {
          name: 'Ticimax',
          descKey: 'integrationsPage.ticimax.desc',
          logo: '/integrations/ticimax.svg'
        },
        {
          name: 'IdeaSoft',
          descKey: 'integrationsPage.ideasoft.desc',
          logo: '/integrations/ideasoft.svg'
        },
        {
          name: 'Shopify',
          descKey: 'integrationsPage.shopify.desc',
          logo: '/integrations/shopify.svg'
        },
      ]
    },
    {
      id: 'calendar',
      titleKey: 'integrationsPage.categories.calendar',
      icon: Calendar,
      color: 'from-blue-500 to-indigo-500',
      integrations: [
        {
          name: 'Google Calendar',
          descKey: 'integrationsPage.googleCalendar.desc',
          logo: '/integrations/google-calendar.svg'
        },
      ]
    },
    {
      id: 'email',
      titleKey: 'integrationsPage.categories.email',
      icon: Mail,
      color: 'from-red-500 to-orange-500',
      integrations: [
        {
          name: 'Gmail',
          descKey: 'integrationsPage.gmail.desc',
          logo: '/integrations/gmail.svg'
        },
        {
          name: 'Outlook',
          descKey: 'integrationsPage.outlook.desc',
          logo: '/integrations/outlook.svg'
        },
      ]
    },
    {
      id: 'accounting',
      titleKey: 'integrationsPage.categories.accounting',
      icon: Receipt,
      color: 'from-purple-500 to-pink-500',
      integrations: [
        {
          name: 'Parasut',
          descKey: 'integrationsPage.parasut.desc',
          logo: '/integrations/parasut.svg'
        },
      ]
    },
    {
      id: 'payment',
      titleKey: 'integrationsPage.categories.payment',
      icon: CreditCard,
      color: 'from-yellow-500 to-orange-500',
      integrations: [
        {
          name: 'iyzico',
          descKey: 'integrationsPage.iyzico.desc',
          logo: '/integrations/iyzico.svg'
        },
        {
          name: 'Stripe',
          descKey: 'integrationsPage.stripe.desc',
          logo: '/integrations/stripe.svg'
        },
      ]
    },
    {
      id: 'sms',
      titleKey: 'integrationsPage.categories.sms',
      icon: MessageSquare,
      color: 'from-cyan-500 to-blue-500',
      integrations: [
        {
          name: 'NetGSM',
          descKey: 'integrationsPage.netgsm.desc',
          logo: '/integrations/netgsm.svg'
        },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-8"
            >
              <Plug className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl font-bold mb-6"
            >
              {t('integrationsPage.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-600"
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
                    <h2 className="text-2xl font-bold text-gray-900">
                      {t(category.titleKey)}
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {category.integrations.map((integration, intIndex) => (
                      <motion.div
                        key={integration.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: intIndex * 0.05 }}
                        className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="h-12 mb-4 flex items-center">
                          <div className="relative w-full h-8">
                            <Image
                              src={integration.logo}
                              alt={integration.name}
                              fill
                              className="object-contain object-left"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<span class="text-lg font-semibold text-gray-800">${integration.name}</span>`;
                              }}
                            />
                          </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {integration.name}
                        </h3>
                        <p className="text-sm text-gray-600">
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
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">
              {t('integrationsPage.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('integrationsPage.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
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

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShoppingCart, Package, Truck, RotateCcw, MessageCircle, Check } from 'lucide-react';

export default function EcommerceSolutionPage() {
  const { t } = useLanguage();

  const useCases = [
    {
      icon: Package,
      titleKey: 'solutions.ecommerce.useCase1.title',
      descKey: 'solutions.ecommerce.useCase1.desc',
    },
    {
      icon: Truck,
      titleKey: 'solutions.ecommerce.useCase2.title',
      descKey: 'solutions.ecommerce.useCase2.desc',
    },
    {
      icon: RotateCcw,
      titleKey: 'solutions.ecommerce.useCase3.title',
      descKey: 'solutions.ecommerce.useCase3.desc',
    },
    {
      icon: MessageCircle,
      titleKey: 'solutions.ecommerce.useCase4.title',
      descKey: 'solutions.ecommerce.useCase4.desc',
    },
  ];

  const integrations = ['ikas', 'Shopify', 'WooCommerce', 'Ticimax'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-8">
                <ShoppingCart className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                {t('solutions.ecommerce.hero.title')}
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                {t('solutions.ecommerce.hero.subtitle')}
              </p>
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                  {t('solutions.startFree')}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('solutions.ecommerce.useCases.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6 h-full bg-white border-gray-100 hover:shadow-lg transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {t(useCase.titleKey)}
                        </h3>
                        <p className="text-gray-600">
                          {t(useCase.descKey)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            {t('solutions.ecommerce.integrations.title')}
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            {t('solutions.ecommerce.integrations.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
            {integrations.map((integration, index) => (
              <div
                key={index}
                className="bg-white rounded-xl px-8 py-4 shadow-sm border border-gray-100"
              >
                <span className="text-lg font-semibold text-gray-700">{integration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              {t('solutions.ecommerce.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('solutions.ecommerce.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                  {t('solutions.startFree')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  {t('solutions.contactSales')}
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

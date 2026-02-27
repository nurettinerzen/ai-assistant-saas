'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { UtensilsCrossed, Calendar, Clock, BookOpen, Phone } from 'lucide-react';

export default function RestaurantSolutionPage() {
  const { t } = useLanguage();
  const flowSteps = [
    'solutions.restaurant.exampleFlow.step1',
    'solutions.restaurant.exampleFlow.step2',
    'solutions.restaurant.exampleFlow.step3',
  ];

  const useCases = [
    {
      icon: Calendar,
      titleKey: 'solutions.restaurant.useCase1.title',
      descKey: 'solutions.restaurant.useCase1.desc',
    },
    {
      icon: BookOpen,
      titleKey: 'solutions.restaurant.useCase2.title',
      descKey: 'solutions.restaurant.useCase2.desc',
    },
    {
      icon: Clock,
      titleKey: 'solutions.restaurant.useCase3.title',
      descKey: 'solutions.restaurant.useCase3.desc',
    },
    {
      icon: Phone,
      titleKey: 'solutions.restaurant.useCase4.title',
      descKey: 'solutions.restaurant.useCase4.desc',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
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
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-8">
                <UtensilsCrossed className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                {t('solutions.restaurant.hero.title')}
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                {t('solutions.restaurant.hero.subtitle')}
              </p>
              <Link href="/waitlist">
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
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
            {t('solutions.restaurant.useCases.title')}
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
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-orange-600" />
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

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-700 p-6 md:p-8 shadow-sm">
            <h2 className="text-3xl font-bold mb-3 text-gray-900 dark:text-white">
              {t('solutions.exampleFlow.title')}
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mb-6">
              {t('solutions.exampleFlow.subtitle')}
            </p>
            <div className="space-y-3">
              {flowSteps.map((stepKey, index) => (
                <div key={stepKey} className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-4">
                  <p className="text-sm font-semibold text-primary mb-1">{index + 1}</p>
                  <p className="text-sm md:text-base text-gray-700 dark:text-neutral-200">
                    {t(stepKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              {t('solutions.restaurant.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('solutions.restaurant.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
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

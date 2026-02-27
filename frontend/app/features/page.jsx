'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import MarketingFAQ from '@/components/MarketingFAQ';
import {
  BarChart3,
  Bot,
  Calendar,
  Check,
  Globe,
  HeadphonesIcon,
  MessageSquare,
  Puzzle,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';

export default function FeaturesPage() {
  const { t } = useLanguage();

  const features = [
    {
      id: 'multichannel',
      icon: MessageSquare,
      titleKey: 'features.multichannel.title',
      descKey: 'features.multichannel.desc',
      items: [
        'features.multichannel.item1',
        'features.multichannel.item2',
        'features.multichannel.item3',
        'features.multichannel.item4',
      ],
      color: 'from-blue-500 to-teal-500'
    },
    {
      id: 'ai',
      icon: Bot,
      titleKey: 'features.ai.title',
      descKey: 'features.ai.desc',
      items: [
        'features.ai.item1',
        'features.ai.item2',
        'features.ai.item3',
        'features.ai.item4',
      ],
      color: 'from-teal-500 to-pink-500'
    },
    {
      id: 'ecommerce',
      icon: ShoppingCart,
      titleKey: 'features.ecommerce.title',
      descKey: 'features.ecommerce.desc',
      items: [
        'features.ecommerce.item1',
        'features.ecommerce.item2',
        'features.ecommerce.item3',
        'features.ecommerce.item4',
      ],
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'calendar',
      icon: Calendar,
      titleKey: 'features.calendar.title',
      descKey: 'features.calendar.desc',
      items: [
        'features.calendar.item1',
        'features.calendar.item2',
        'features.calendar.item3',
      ],
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'languages',
      icon: Globe,
      titleKey: 'features.languages.title',
      descKey: 'features.languages.desc',
      items: [
        'features.languages.item1',
        'features.languages.item2',
        'features.languages.item3',
      ],
      color: 'from-cyan-500 to-blue-500'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      titleKey: 'features.analytics.title',
      descKey: 'features.analytics.desc',
      items: [
        'features.analytics.item1',
        'features.analytics.item2',
        'features.analytics.item3',
      ],
      color: 'from-violet-500 to-teal-500'
    },
  ];

  const deepDiveSections = [
    {
      id: 'dashboardKpi',
      icon: BarChart3,
      color: 'from-cyan-500 to-blue-500',
      items: [
        'features.deepDive.dashboardKpi.item1',
        'features.deepDive.dashboardKpi.item2',
        'features.deepDive.dashboardKpi.item3',
        'features.deepDive.dashboardKpi.item4',
      ]
    },
    {
      id: 'securityKvkk',
      icon: ShieldCheck,
      color: 'from-emerald-500 to-teal-500',
      items: [
        'features.deepDive.securityKvkk.item1',
        'features.deepDive.securityKvkk.item2',
        'features.deepDive.securityKvkk.item3',
      ]
    },
    {
      id: 'integrations',
      icon: Puzzle,
      color: 'from-indigo-500 to-blue-500',
      items: [
        'features.deepDive.integrations.item1',
        'features.deepDive.integrations.item2',
        'features.deepDive.integrations.item3',
      ]
    },
  ];

  const solutionCards = [
    {
      href: '/solutions/ecommerce',
      titleKey: 'features.solutions.ecommerce.title',
      descKey: 'features.solutions.ecommerce.desc',
      icon: ShoppingCart
    },
    {
      href: '/solutions/restaurant',
      titleKey: 'features.solutions.restaurant.title',
      descKey: 'features.solutions.restaurant.desc',
      icon: UtensilsCrossed
    },
    {
      href: '/solutions/salon',
      titleKey: 'features.solutions.salon.title',
      descKey: 'features.solutions.salon.desc',
      icon: Scissors
    },
    {
      href: '/solutions/support',
      titleKey: 'features.solutions.support.title',
      descKey: 'features.solutions.support.desc',
      icon: HeadphonesIcon
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <Navigation />

      <section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 text-gray-900 dark:text-white"
            >
              {t('features.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base sm:text-xl text-gray-600 dark:text-neutral-400"
            >
              {t('features.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6 md:p-8 h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-gray-600 dark:text-neutral-400 mb-4">
                      {t(feature.descKey)}
                    </p>
                    <ul className="space-y-2">
                      {feature.items.map((itemKey) => (
                        <li key={itemKey} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{t(itemKey)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {t('features.deepDive.title')}
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3">
              {t('features.deepDive.subtitle')}
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {deepDiveSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.id}
                  className="p-6 bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {t(`features.deepDive.${section.id}.title`)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
                    {t(`features.deepDive.${section.id}.desc`)}
                  </p>
                  <ul className="space-y-2">
                    {section.items.map((itemKey) => (
                      <li key={itemKey} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{t(itemKey)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {t('features.solutions.title')}
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3">
              {t('features.solutions.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {solutionCards.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <motion.div
                  key={solution.href}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <Card className="p-6 bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 h-full">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {t(solution.titleKey)}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                          {t(solution.descKey)}
                        </p>
                        <Link href={solution.href} className="inline-flex mt-4 text-sm font-semibold text-primary hover:underline">
                          {t('features.solutions.link')}
                        </Link>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        <MarketingFAQ />
      </div>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto dark:bg-neutral-800/60 dark:border dark:border-neutral-700">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('features.cta.title')}
            </h2>
            <p className="text-base md:text-xl text-gray-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto">
              {t('features.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
                  {t('features.cta.applyEarlyAccess')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  {t('features.cta.contact')}
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

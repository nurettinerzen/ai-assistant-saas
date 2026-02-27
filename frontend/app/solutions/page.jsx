'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import MarketingFAQ from '@/components/MarketingFAQ';
import { ShoppingCart, UtensilsCrossed, Scissors, HeadphonesIcon, ArrowRight } from 'lucide-react';

export default function SolutionsPage() {
  const { t } = useLanguage();

  const solutions = [
    {
      id: 'ecommerce',
      icon: ShoppingCart,
      titleKey: 'solutions.ecommerce.title',
      descKey: 'solutions.ecommerce.desc',
      href: '/solutions/ecommerce',
      color: 'from-blue-500 to-cyan-500',
      features: [
        'solutions.ecommerce.feature1',
        'solutions.ecommerce.feature2',
        'solutions.ecommerce.feature3',
      ]
    },
    {
      id: 'restaurant',
      icon: UtensilsCrossed,
      titleKey: 'solutions.restaurant.title',
      descKey: 'solutions.restaurant.desc',
      href: '/solutions/restaurant',
      color: 'from-orange-500 to-red-500',
      features: [
        'solutions.restaurant.feature1',
        'solutions.restaurant.feature2',
        'solutions.restaurant.feature3',
      ]
    },
    {
      id: 'salon',
      icon: Scissors,
      titleKey: 'solutions.salon.title',
      descKey: 'solutions.salon.desc',
      href: '/solutions/salon',
      color: 'from-pink-500 to-teal-500',
      features: [
        'solutions.salon.feature1',
        'solutions.salon.feature2',
        'solutions.salon.feature3',
      ]
    },
    {
      id: 'support',
      icon: HeadphonesIcon,
      titleKey: 'solutions.support.title',
      descKey: 'solutions.support.desc',
      href: '/solutions/support',
      color: 'from-green-500 to-emerald-500',
      features: [
        'solutions.support.feature1',
        'solutions.support.feature2',
        'solutions.support.feature3',
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6"
            >
              {t('solutions.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600"
            >
              {t('solutions.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <motion.div
                  key={solution.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-8 h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white border-gray-100">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${solution.color} flex items-center justify-center mb-6`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {t(solution.titleKey)}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {t(solution.descKey)}
                    </p>
                    <ul className="space-y-2 mb-6">
                      {solution.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span>{t(feature)}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={solution.href}>
                      <Button variant="outline" className="group">
                        {t('solutions.learnMore')}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>
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

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              {t('solutions.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('solutions.cta.subtitle')}
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
                {t('solutions.cta.contact')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

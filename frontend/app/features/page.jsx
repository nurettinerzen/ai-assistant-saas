'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Phone,
  MessageCircle,
  MessagesSquare,
  Mail,
  Bot,
  ShoppingCart,
  Calendar,
  Globe,
  BarChart3,
  FileText,
  Check
} from 'lucide-react';

export default function FeaturesPage() {
  const { t } = useLanguage();

  const features = [
    {
      id: 'multichannel',
      icon: MessagesSquare,
      titleKey: 'features.multichannel.title',
      descKey: 'features.multichannel.desc',
      items: [
        'features.multichannel.item1',
        'features.multichannel.item2',
        'features.multichannel.item3',
        'features.multichannel.item4',
      ],
      color: 'from-blue-500 to-indigo-500'
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
      color: 'from-purple-500 to-pink-500'
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
      color: 'from-violet-500 to-purple-500'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl md:text-6xl font-bold mb-6"
            >
              {t('features.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600"
            >
              {t('features.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
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
                  <Card className="p-8 h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white border-gray-100">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {t(feature.descKey)}
                    </p>
                    <ul className="space-y-2">
                      {feature.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{t(item)}</span>
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

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              {t('features.cta.title')}
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('features.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                  {t('features.cta.applyEarlyAccess')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
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

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
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  Check,
  Globe,
  HeadphonesIcon,
  Link2,
  MessageSquare,
  Puzzle,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  TestTube,
  Upload,
  UtensilsCrossed,
  Sparkles,
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
      color: 'from-blue-500 to-primary'
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
      color: 'from-primary to-pink-500'
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
      color: 'from-violet-500 to-primary'
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
      color: 'from-emerald-500 to-primary',
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

  const setupSteps = [
    { step: 1, icon: Bot, key: 'step1', color: 'from-blue-500 to-primary' },
    { step: 2, icon: Link2, key: 'step2', color: 'from-emerald-500 to-teal-500' },
    { step: 3, icon: Upload, key: 'step3', color: 'from-orange-500 to-red-500' },
    { step: 4, icon: TestTube, key: 'step4', color: 'from-violet-500 to-primary' },
  ];

  const solutionCards = [
    { href: '/solutions/ecommerce', titleKey: 'features.solutions.ecommerce.title', descKey: 'features.solutions.ecommerce.desc', icon: ShoppingCart, color: 'from-blue-500 to-cyan-500' },
    { href: '/solutions/restaurant', titleKey: 'features.solutions.restaurant.title', descKey: 'features.solutions.restaurant.desc', icon: UtensilsCrossed, color: 'from-orange-500 to-red-500' },
    { href: '/solutions/salon', titleKey: 'features.solutions.salon.title', descKey: 'features.solutions.salon.desc', icon: Scissors, color: 'from-pink-500 to-rose-500' },
    { href: '/solutions/support', titleKey: 'features.solutions.support.title', descKey: 'features.solutions.support.desc', icon: HeadphonesIcon, color: 'from-violet-500 to-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navigation />

      {/* ═══ Hero ═══ */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              {t('features.hero.badge')}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-5 text-gray-900 dark:text-white"
            >
              {t('features.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg sm:text-xl text-gray-600 dark:text-neutral-400 max-w-2xl mx-auto"
            >
              {t('features.hero.subtitle')}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mt-8"
            >
              <Link href="/waitlist">
                <Button size="lg" className="rounded-full bg-primary text-white hover:bg-primary/90 px-8">
                  {t('features.cta.applyEarlyAccess')}
                </Button>
              </Link>
              <Link href="#features-grid">
                <Button size="lg" variant="outline" className="rounded-full px-8">
                  {t('features.hero.explore')}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Feature Cards ═══ */}
      <section className="py-16 md:py-20" id="features-grid">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-7xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <Card className="p-6 md:p-8 h-full rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-neutral-800/80 border-gray-100 dark:border-neutral-700/80 group">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-gray-600 dark:text-neutral-400 text-sm leading-relaxed mb-5">
                      {t(feature.descKey)}
                    </p>
                    <ul className="space-y-2.5">
                      {feature.items.map((itemKey) => (
                        <li key={itemKey} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-neutral-300">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          </div>
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

      {/* ═══ Deep Dive ═══ */}
      <section className="py-16 md:py-20 bg-gray-50/70 dark:bg-neutral-900/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t('features.deepDive.title')}
            </motion.h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3 text-lg">
              {t('features.deepDive.subtitle')}
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {deepDiveSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6 md:p-8 h-full rounded-2xl bg-white dark:bg-neutral-800/80 border-gray-100 dark:border-neutral-700/80 hover:shadow-lg transition-all duration-300">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${section.color} flex items-center justify-center mb-5`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {t(`features.deepDive.${section.id}.title`)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-neutral-400 mb-5 leading-relaxed">
                      {t(`features.deepDive.${section.id}.desc`)}
                    </p>
                    <ul className="space-y-2.5">
                      {section.items.map((itemKey) => (
                        <li key={itemKey} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-neutral-300">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          </div>
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

      {/* ═══ Easy Setup ═══ */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t('features.easySetup.title')}
            </motion.h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3 text-lg">
              {t('features.easySetup.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {setupSteps.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.12 }}
                  className="text-center relative"
                >
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold mb-2">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {t(`features.easySetup.${item.key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                    {t(`features.easySetup.${item.key}.desc`)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Sector Flow ═══ */}
      <section className="py-16 md:py-20 bg-gray-50/70 dark:bg-neutral-900/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t('features.sectorFlows.title')}
            </motion.h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3 text-lg">
              {t('features.sectorFlows.subtitle')}
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <Card className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-800/80 border-gray-100 dark:border-neutral-700/80 shadow-lg">
              <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-neutral-700">
                {/* Left - Overview */}
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{t('features.sectorFlows.solutionLabel')}</span>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-neutral-700">{t('features.sectorFlows.ecommerceLabel')}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {t('features.sectorFlows.ecommerce.title')}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mb-5 leading-relaxed">
                    {t('features.sectorFlows.ecommerce.desc')}
                  </p>
                  <ul className="space-y-2">
                    {(t('features.sectorFlows.ecommerce.features') || []).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/solutions/ecommerce" className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-primary hover:underline">
                    {t('features.sectorFlows.detail')} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Center - Sample Flow */}
                <div className="p-6 md:p-8">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {t('features.sectorFlows.sampleFlow')}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mb-5">
                    {t('features.sectorFlows.sampleFlowDesc')}
                  </p>
                  <div className="space-y-3">
                    {['step1', 'step2', 'step3'].map((step, i) => (
                      <div
                        key={step}
                        className={`rounded-xl p-4 ${
                          i === 2
                            ? 'bg-gradient-to-r from-slate-900 to-blue-900 dark:from-neutral-700 dark:to-neutral-700 text-white'
                            : 'bg-gray-50 dark:bg-neutral-700/50'
                        }`}
                      >
                        <div className={`text-sm font-semibold mb-1 ${i === 2 ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                          {i + 1}) {t(`features.sectorFlows.ecommerce.flow.${step}`)}
                        </div>
                        <p className={`text-xs leading-relaxed ${i === 2 ? 'text-blue-100' : 'text-gray-600 dark:text-neutral-400'}`}>
                          {t(`features.sectorFlows.ecommerce.flow.${step}Desc`)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-4">
                    {t('features.sectorFlows.ecommerce.flowNote')}
                  </p>
                </div>

                {/* Right - KPIs */}
                <div className="p-6 md:p-8">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {t('features.sectorFlows.kpis')}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mb-5">
                    {t('features.sectorFlows.kpisDesc')}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {(t('features.sectorFlows.ecommerce.kpiList') || []).map((kpi, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span>{kpi}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-100 dark:border-neutral-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">{t('features.sectorFlows.suggestedIntegrations')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {(t('features.sectorFlows.ecommerce.integrations') || []).map((integration) => (
                        <span key={integration} className="px-3 py-1 text-xs rounded-full border border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300">
                          {integration}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Link href="/solutions">
                      <Button variant="outline" size="sm" className="rounded-full">{t('features.sectorFlows.seeAll')}</Button>
                    </Link>
                    <Link href="/waitlist">
                      <Button size="sm" className="rounded-full">{t('features.sectorFlows.tryFree')}</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══ Solution Cards ═══ */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t('features.solutions.title')}
            </motion.h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-3 text-lg">
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
                  <Link href={solution.href}>
                    <Card className="p-6 rounded-2xl bg-white dark:bg-neutral-800/80 border-gray-100 dark:border-neutral-700/80 h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${solution.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">
                            {t(solution.titleKey)}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                            {t(solution.descKey)}
                          </p>
                          <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-primary">
                            {t('features.solutions.link')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-8 md:py-12 bg-gray-50/70 dark:bg-neutral-900/40">
        <div className="container mx-auto px-4">
          <MarketingFAQ />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl p-8 md:p-14 text-center max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-blue-900 dark:from-neutral-800 dark:to-neutral-800 border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-white">
                {t('features.cta.title')}
              </h2>
              <p className="text-lg text-blue-100 dark:text-neutral-400 mb-8 max-w-2xl mx-auto">
                {t('features.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/waitlist">
                  <Button size="lg" className="w-full sm:w-auto rounded-full bg-white text-slate-900 hover:bg-gray-100 px-8 font-semibold">
                    {t('features.cta.applyEarlyAccess')}
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full border-white/30 text-white hover:bg-white/10 px-8">
                    {t('features.cta.contact')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

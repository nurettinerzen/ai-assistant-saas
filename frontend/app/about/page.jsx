'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Building2, Globe, Heart, Mail, Target, Users } from 'lucide-react';

const COMPANY_CITY = process.env.NEXT_PUBLIC_COMPANY_CITY;
const COMPANY_COUNTRY = process.env.NEXT_PUBLIC_COMPANY_COUNTRY;
const COMPANY_CONTACT_CHANNEL = process.env.NEXT_PUBLIC_COMPANY_CONTACT_CHANNEL || 'info@telyx.ai';
const COMPANY_LEGAL_ADDRESS = process.env.NEXT_PUBLIC_COMPANY_LEGAL_ADDRESS;

export default function AboutPage() {
  const { t } = useLanguage();

  const locationText = COMPANY_CITY && COMPANY_COUNTRY
    ? `${COMPANY_CITY}, ${COMPANY_COUNTRY}`
    : t('about.companyInfo.locationFallback');

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
              className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white"
            >
              {t('about.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base sm:text-xl text-gray-600 dark:text-neutral-400"
            >
              {t('about.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.companyInfo.title')}</h2>
              </div>
              <p className="text-gray-600 dark:text-neutral-300 mb-6 leading-relaxed">
                {t('about.companyInfo.description')}
              </p>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">{t('about.companyInfo.locationLabel')}</p>
                  <p className="text-gray-600 dark:text-neutral-400">{locationText}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">{t('about.companyInfo.contactLabel')}</p>
                  <p className="text-gray-600 dark:text-neutral-400">{COMPANY_CONTACT_CHANNEL}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                <p className="font-semibold text-gray-900 dark:text-white mb-1">{t('about.companyInfo.legalAddressLabel')}</p>
                <p className="text-gray-600 dark:text-neutral-400">
                  {COMPANY_LEGAL_ADDRESS || t('about.companyInfo.legalAddressFallback')}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.team.title')}</h2>
              </div>
              <p className="text-gray-600 dark:text-neutral-300 mb-6 leading-relaxed">
                {t('about.team.content')}
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{t('about.team.roles.founder.title')}</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">{t('about.team.roles.founder.desc')}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{t('about.team.roles.product.title')}</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">{t('about.team.roles.product.desc')}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{t('about.team.roles.customerOps.title')}</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">{t('about.team.roles.customerOps.desc')}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.story.title')}</h2>
              </div>
              <p className="text-gray-600 dark:text-neutral-300 text-base leading-relaxed">
                {t('about.story.content')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-br from-teal-600 to-blue-500 rounded-2xl p-6 md:p-8 text-white"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold">{t('about.mission.title')}</h2>
              </div>
              <p className="text-blue-100 text-base leading-relaxed">
                {t('about.mission.content')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.whyTurkey.title')}</h2>
              </div>
              <p className="text-gray-600 dark:text-neutral-300 text-base leading-relaxed">
                {t('about.whyTurkey.content')}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{t('about.cta.title')}</h2>
            <p className="text-gray-600 dark:text-neutral-400 text-lg mb-8">
              {t('about.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600">
                  {t('about.cta.button')}
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <Mail className="h-4 w-4 mr-2" />
                  {t('navigation.contact')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

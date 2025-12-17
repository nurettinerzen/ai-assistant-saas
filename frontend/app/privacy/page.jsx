'use client';

import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  const { t } = useLanguage();

  const sections = [
    { titleKey: 'privacy.sections.dataCollected.title', contentKey: 'privacy.sections.dataCollected.content' },
    { titleKey: 'privacy.sections.dataUsage.title', contentKey: 'privacy.sections.dataUsage.content' },
    { titleKey: 'privacy.sections.dataStorage.title', contentKey: 'privacy.sections.dataStorage.content' },
    { titleKey: 'privacy.sections.thirdParty.title', contentKey: 'privacy.sections.thirdParty.content' },
    { titleKey: 'privacy.sections.cookies.title', contentKey: 'privacy.sections.cookies.content' },
    { titleKey: 'privacy.sections.userRights.title', contentKey: 'privacy.sections.userRights.content' },
    { titleKey: 'privacy.sections.contact.title', contentKey: 'privacy.sections.contact.content' },
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
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              {t('privacy.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-gray-600"
            >
              {t('privacy.lastUpdated')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100"
            >
              <div className="prose prose-gray max-w-none">
                {sections.map((section, index) => (
                  <div key={index} className={index > 0 ? 'mt-8' : ''}>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      {index + 1}. {t(section.titleKey)}
                    </h2>
                    <p className="text-gray-600 whitespace-pre-line">
                      {t(section.contentKey)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

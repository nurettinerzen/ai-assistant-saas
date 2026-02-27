'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, HelpCircle, Mail } from 'lucide-react';

export default function HelpPage() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    { questionKey: 'help.faq.q1', answerKey: 'help.faq.a1' },
    { questionKey: 'help.faq.q2', answerKey: 'help.faq.a2' },
    { questionKey: 'help.faq.q3', answerKey: 'help.faq.a3' },
    { questionKey: 'help.faq.q4', answerKey: 'help.faq.a4' },
    { questionKey: 'help.faq.q5', answerKey: 'help.faq.a5' },
    { questionKey: 'help.faq.q6', answerKey: 'help.faq.a6' },
    { questionKey: 'help.faq.q7', answerKey: 'help.faq.a7' },
    { questionKey: 'help.faq.q8', answerKey: 'help.faq.a8' },
    { questionKey: 'help.faq.q9', answerKey: 'help.faq.a9' },
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-4 py-2 rounded-full text-sm font-medium mb-6"
            >
              <HelpCircle className="w-4 h-4" />
              {t('help.badge')}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white"
            >
              {t('help.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-gray-600 dark:text-neutral-400"
            >
              {t('help.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-100 dark:border-neutral-700 overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors"
                    >
                      <span className="font-semibold text-gray-900 dark:text-white pr-4">{t(faq.questionKey)}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 dark:text-neutral-400 flex-shrink-0 transition-transform duration-300 ${
                          openIndex === index ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {openIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="px-6 pb-5 text-gray-600 dark:text-neutral-300 border-t border-gray-100 dark:border-neutral-700 pt-4">
                            {t(faq.answerKey)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-neutral-700"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('help.contact.title')}</h3>
            <p className="text-gray-600 dark:text-neutral-400 mb-4">{t('help.contact.text')}</p>
            <a
              href="mailto:info@telyx.ai"
              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-semibold text-lg"
            >
              info@telyx.ai
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

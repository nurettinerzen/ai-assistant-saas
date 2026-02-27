'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Link2, MessageCircleMore, Rocket, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import { WaveformAnimation } from './animations/WaveformAnimation';
import { useLanguage } from '@/contexts/LanguageContext';

export const Hero = () => {
  const { t } = useLanguage();
  const demoSteps = [
    { icon: UserPlus, title: t('landing.hero.demoProcess.step1') },
    { icon: Link2, title: t('landing.hero.demoProcess.step2') },
    { icon: Rocket, title: t('landing.hero.demoProcess.step3') },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-gray-50 to-background dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
        <WaveformAnimation />
      </div>

      {/* Content - Centered */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6"
          >
            <span className="px-5 py-2.5 bg-primary/10 dark:bg-primary/20 text-primary rounded-full text-sm font-semibold border border-primary/20 dark:border-primary/30 shadow-sm">
              {t('landing.hero.badge')}
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground dark:text-white leading-[1.1] mb-6"
          >
            {t('landing.hero.title')}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-lg sm:text-xl lg:text-2xl text-muted-foreground dark:text-neutral-400 mb-10 leading-relaxed max-w-3xl mx-auto"
          >
            {t('landing.hero.subtitle')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-blue-lg group px-8 py-6 text-lg h-auto"
              >
                {t('landing.hero.ctaPrimary')}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-border hover:border-primary hover:bg-primary/5 group px-8 py-6 text-lg h-auto"
              >
                <MessageCircleMore className="mr-2 h-5 w-5" />
                {t('landing.hero.ctaDemo')}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-sm p-4 sm:p-6"
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm sm:text-base font-semibold text-foreground dark:text-white">
                {t('landing.hero.demoProcess.title')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {demoSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-3"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-200 text-left">
                          {step.title}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PricingPage() {
  const { t, language } = useLanguage();

  // Determine currency based on language
  const isTR = language === 'tr';

  const plans = [
    {
      id: 'STARTER',
      nameKey: 'pricing.starter.name',
      price: isTR ? 899 : 27,
      currency: isTR ? '₺' : '$',
      period: isTR ? '/ay' : '/month',
      descKey: 'pricing.starter.desc',
      features: [
        'pricing.starter.feature1',
        'pricing.starter.feature2',
        'pricing.starter.feature3',
        'pricing.starter.feature4',
        'pricing.starter.feature5',
        'pricing.starter.feature6',
      ],
      popular: true,
    },
    {
      id: 'PROFESSIONAL',
      nameKey: 'pricing.professional.name',
      price: isTR ? 2599 : 77,
      currency: isTR ? '₺' : '$',
      period: isTR ? '/ay' : '/month',
      descKey: 'pricing.professional.desc',
      features: [
        'pricing.professional.feature1',
        'pricing.professional.feature2',
        'pricing.professional.feature3',
        'pricing.professional.feature4',
        'pricing.professional.feature5',
        'pricing.professional.feature6',
        'pricing.professional.feature7',
      ],
      popular: false,
    },
    {
      id: 'ENTERPRISE',
      nameKey: 'pricing.enterprise.name',
      price: isTR ? 6799 : 199,
      currency: isTR ? '₺' : '$',
      period: isTR ? '/ay' : '/month',
      descKey: 'pricing.enterprise.desc',
      features: [
        'pricing.enterprise.feature1',
        'pricing.enterprise.feature2',
        'pricing.enterprise.feature3',
        'pricing.enterprise.feature4',
        'pricing.enterprise.feature5',
        'pricing.enterprise.feature6',
        'pricing.enterprise.feature7',
      ],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {t('pricing.title')}
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              {t('pricing.subtitle')}
            </p>
            <p className="text-sm text-primary font-medium">
              {t('pricing.trial')}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-8 shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                  plan.popular
                    ? 'border-primary scale-105'
                    : 'border-gray-100 hover:border-primary/30'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                      {t('pricing.recommended')}
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {t(plan.descKey)}
                  </p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.currency}
                      {plan.price.toLocaleString(isTR ? 'tr-TR' : 'en-US')}
                    </span>
                    <span className="text-gray-600 ml-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{t(feature)}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/waitlist" className="block">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {t('pricing.ctaWaitlist')}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-16 text-center max-w-2xl mx-auto">
            <p className="text-gray-600">
              {t('pricing.questions')}{' '}
              <Link href="/contact" className="text-primary font-medium hover:underline">
                {t('pricing.contactUs')}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

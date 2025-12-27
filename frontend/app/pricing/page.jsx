'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

// Regional pricing configuration - YENİ PAKET YAPISI
const REGIONAL_PRICING = {
  TR: {
    currency: '₺',
    currencyPosition: 'after',
    locale: 'tr-TR',
    plans: {
      // YENİ PAKETLER
      STARTER: { price: 799, minutes: 100, concurrent: 1, overageRate: 7.5 },
      PRO: { price: 3999, minutes: 800, concurrent: 5, overageRate: 6.5 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 5.5 }
    },
    creditPackages: [
      { minutes: 100, price: 650, unitPrice: 6.5 },
      { minutes: 300, price: 1650, unitPrice: 5.5 },
      { minutes: 500, price: 2500, unitPrice: 5.0 }
    ]
  },
  // Türkiye odaklı - diğer bölgeler referans için
  BR: {
    currency: 'R$',
    currencyPosition: 'before',
    locale: 'pt-BR',
    plans: {
      STARTER: { price: 99, minutes: 100, concurrent: 1, overageRate: 2.5 },
      PRO: { price: 499, minutes: 800, concurrent: 5, overageRate: 2.0 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 1.5 }
    },
    creditPackages: [
      { minutes: 100, price: 200, unitPrice: 2.0 },
      { minutes: 300, price: 525, unitPrice: 1.75 },
      { minutes: 500, price: 750, unitPrice: 1.5 }
    ]
  },
  US: {
    currency: '$',
    currencyPosition: 'before',
    locale: 'en-US',
    plans: {
      STARTER: { price: 49, minutes: 100, concurrent: 1, overageRate: 0.35 },
      PRO: { price: 199, minutes: 800, concurrent: 5, overageRate: 0.25 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 0.20 }
    },
    creditPackages: [
      { minutes: 100, price: 30, unitPrice: 0.30 },
      { minutes: 300, price: 75, unitPrice: 0.25 },
      { minutes: 500, price: 100, unitPrice: 0.20 }
    ]
  }
};

// Map locale to region
const LOCALE_TO_REGION = {
  tr: 'TR',
  pr: 'BR',
  pt: 'BR',
  en: 'US'
};

export default function PricingPage() {
  const { t, locale } = useLanguage();

  // Determine region based on locale
  const region = LOCALE_TO_REGION[locale] || 'US';
  const pricing = REGIONAL_PRICING[region] || REGIONAL_PRICING.US;
  const isTR = region === 'TR';
  const isBR = region === 'BR';

  // Format price with currency
  const formatPrice = (price) => {
    if (price === null) return null;
    const formatted = price.toLocaleString(pricing.locale);
    return pricing.currencyPosition === 'before'
      ? `${pricing.currency}${formatted}`
      : `${formatted}${pricing.currency}`;
  };

  /**
   * Feature Master List (ordered) - same order for ALL plans
   * Features appear in this exact order, no gaps
   */
  const FEATURE_ORDER = [
    'minutes',
    'concurrent',
    'assistants',
    'phoneNumbers',
    'phone',
    'whatsapp',
    'chatWidget',
    'ecommerce',
    'calendar',
    'analytics',
    'email',
    'googleSheets',
    'batchCalls',
    'prioritySupport',
    'apiAccess',
    'slaGuarantee'
  ];

  // Feature availability per plan (in display order) - YENİ PAKET YAPISI
  const PLAN_FEATURES = {
    STARTER: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics'],
    PRO: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls', 'prioritySupport', 'apiAccess'],
    ENTERPRISE: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls', 'prioritySupport', 'apiAccess', 'slaGuarantee']
  };

  // Plan names by region - YENİ
  const planNames = {
    STARTER: isTR ? 'Başlangıç' : 'Starter',
    PRO: isTR ? 'Profesyonel' : 'Pro',
    ENTERPRISE: isTR ? 'Kurumsal' : 'Enterprise'
  };

  // Plan descriptions by region - YENİ
  const planDescriptions = {
    STARTER: isTR
      ? 'Küçük işletmeler için ideal başlangıç paketi'
      : 'Perfect starter package for small businesses',
    PRO: isTR
      ? 'Yüksek hacimli işletmeler için tam donanımlı paket'
      : 'Full-featured package for high-volume businesses',
    ENTERPRISE: isTR
      ? 'Özel ihtiyaçlar için kişiselleştirilmiş çözümler'
      : 'Customized solutions for specific needs'
  };

  const period = isTR ? '/ay' : '/month';
  const popularBadge = isTR ? 'Popüler' : 'Popular';

  // YENİ PAKET YAPISI - 3 paket
  const plans = [
    {
      id: 'STARTER',
      name: planNames.STARTER,
      ...pricing.plans.STARTER,
      period,
      description: planDescriptions.STARTER,
      popular: false,
    },
    {
      id: 'PRO',
      name: planNames.PRO,
      ...pricing.plans.PRO,
      period,
      description: planDescriptions.PRO,
      popular: true,
      badge: popularBadge,
    },
    {
      id: 'ENTERPRISE',
      name: planNames.ENTERPRISE,
      ...pricing.plans.ENTERPRISE,
      period: '',
      description: planDescriptions.ENTERPRISE,
      popular: false,
    },
  ];

  // Feature labels by key - YENİ PAKET YAPISI
  const getFeatureLabel = (key, plan) => {
    const isEnterprise = plan.id === 'ENTERPRISE';

    const labels = {
      minutes: isEnterprise
        ? (isTR ? '800+ dk (özel)' : '800+ min (custom)')
        : (isTR ? `${plan.minutes} dk görüşme` : `${plan.minutes} min calls`),
      concurrent: isEnterprise
        ? (isTR ? '10+ eşzamanlı çağrı' : '10+ concurrent calls')
        : (isTR ? `${plan.concurrent} eşzamanlı çağrı` : `${plan.concurrent} concurrent call${plan.concurrent > 1 ? 's' : ''}`),
      assistants: isTR ? 'Sınırsız asistan' : 'Unlimited assistants',
      phoneNumbers: isTR ? 'Sınırsız telefon numarası' : 'Unlimited phone numbers',
      phone: isTR ? 'Telefon AI' : 'Phone AI',
      whatsapp: isTR ? 'WhatsApp' : 'WhatsApp',
      chatWidget: isTR ? 'Chat widget' : 'Chat widget',
      email: isTR ? 'E-posta AI' : 'Email AI',
      ecommerce: isTR ? 'E-ticaret entegrasyonu' : 'E-commerce integration',
      calendar: isTR ? 'Google Takvim' : 'Google Calendar',
      googleSheets: isTR ? 'Google Sheets' : 'Google Sheets',
      batchCalls: isTR ? 'Toplu arama' : 'Batch calls',
      analytics: isTR ? 'Analitik' : 'Analytics',
      prioritySupport: isTR ? 'Öncelikli destek' : 'Priority support',
      apiAccess: isTR ? 'API erişimi' : 'API access',
      slaGuarantee: isTR ? 'SLA garantisi' : 'SLA guarantee'
    };
    return labels[key] || key;
  };

  // Get only included features for a plan (no gaps, maintains order)
  const getPlanFeatures = (plan) => {
    const includedFeatures = PLAN_FEATURES[plan.id] || [];
    // Filter FEATURE_ORDER to only include features in this plan's list
    return FEATURE_ORDER
      .filter(key => includedFeatures.includes(key))
      .map(key => ({
        key,
        text: getFeatureLabel(key, plan)
      }));
  };

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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 hover:shadow-xl flex flex-col ${
                  plan.popular
                    ? 'border-primary'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {plan.popular && plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 h-[40px]">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center h-[40px]">
                    {plan.price !== null ? (
                      <>
                        <span className="text-3xl font-bold text-gray-900">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-gray-600 ml-1">{plan.period}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        {isTR ? 'İletişime Geçin' : isBR ? 'Entre em Contato' : 'Contact Us'}
                      </span>
                    )}
                  </div>
                  <div className="h-[20px] mt-2">
                    {plan.overageRate ? (
                      <p className="text-xs text-gray-500">
                        {isTR ? `Aşım: ${plan.overageRate} ₺/dk` : isBR ? `Excedente: R$${plan.overageRate}/min` : `Overage: $${plan.overageRate}/min`}
                      </p>
                    ) : plan.id === 'ENTERPRISE' ? (
                      <p className="text-xs text-gray-500">
                        {isTR ? 'Özel fiyatlandırma' : isBR ? 'Preços personalizados' : 'Custom pricing'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Features list - only shows included features, no gaps */}
                <ul className="space-y-2 mb-6 flex-grow">
                  {getPlanFeatures(plan).map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2"
                    >
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Button always at bottom */}
                <div className="mt-auto">
                  <Link href={plan.id === 'ENTERPRISE' ? '/contact' : '/waitlist'} className="block">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      size="lg"
                    >
                      {plan.id === 'ENTERPRISE'
                        ? (isTR ? 'Bize Ulaşın' : 'Contact Us')
                        : (isTR ? 'Hemen Başla' : 'Get Started')}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Ekstra Kredi Bölümü - YENİ PAKET YAPISI */}
          <div className="mt-20 text-center max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {isTR ? 'Ekstra Dakika mı Lazım?' : 'Need Extra Minutes?'}
            </h3>
            <p className="text-gray-600 mb-8">
              {isTR
                ? 'Kredi paketleri satın alın, süresi dolmaz'
                : 'Buy credit packages, they never expire'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {pricing.creditPackages.map((pkg, index) => {
                const isLast = index === pricing.creditPackages.length - 1;

                return (
                  <div
                    key={index}
                    className={`rounded-xl p-6 shadow-md border ${
                      isLast
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className={`text-3xl font-bold mb-2 ${isLast ? 'text-primary' : 'text-gray-900'}`}>
                      {pkg.minutes} {isTR ? 'dk' : 'min'}
                    </div>
                    <div className={`text-xl font-semibold mb-1 ${isLast ? 'text-primary' : 'text-gray-700'}`}>
                      {formatPrice(pkg.price)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatPrice(pkg.unitPrice)}/{isTR ? 'dk' : 'min'}
                    </div>
                  </div>
                );
              })}
            </div>
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

'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

// Regional pricing configuration
const REGIONAL_PRICING = {
  TR: {
    currency: '₺',
    currencyPosition: 'after',
    locale: 'tr-TR',
    plans: {
      STARTER: { price: 299, minutes: 50, assistants: 1, phoneNumbers: 1, overageRate: 12 },
      BASIC: { price: 999, minutes: 150, assistants: 3, phoneNumbers: 2, overageRate: 11 },
      PROFESSIONAL: { price: 3499, minutes: 500, assistants: 10, phoneNumbers: 5, overageRate: 10 },
      ENTERPRISE: { price: null, minutes: null, assistants: null, phoneNumbers: null, overageRate: null }
    },
    creditTiers: [
      { min: 1, max: 49, price: 9 },
      { min: 50, max: 99, price: 8.5 },
      { min: 100, max: 249, price: 8 },
      { min: 250, max: Infinity, price: 7.5 }
    ]
  },
  BR: {
    currency: 'R$',
    currencyPosition: 'before',
    locale: 'pt-BR',
    plans: {
      STARTER: { price: 99, minutes: 60, assistants: 1, phoneNumbers: 0, overageRate: 3 },
      BASIC: { price: 299, minutes: 250, assistants: 3, phoneNumbers: 0, overageRate: 2.5 },
      PROFESSIONAL: { price: 999, minutes: 1000, assistants: 10, phoneNumbers: 1, overageRate: 2 },
      ENTERPRISE: { price: null, minutes: null, assistants: null, phoneNumbers: null, overageRate: null }
    },
    creditTiers: [
      { min: 1, max: 49, price: 2.75 },
      { min: 50, max: 99, price: 2.5 },
      { min: 100, max: 249, price: 2.25 },
      { min: 250, max: Infinity, price: 2 }
    ]
  },
  US: {
    currency: '$',
    currencyPosition: 'before',
    locale: 'en-US',
    plans: {
      STARTER: { price: 29, minutes: 60, assistants: 1, phoneNumbers: 1, overageRate: 0.5 },
      BASIC: { price: 99, minutes: 250, assistants: 3, phoneNumbers: 2, overageRate: 0.45 },
      PROFESSIONAL: { price: 349, minutes: 1000, assistants: 10, phoneNumbers: 5, overageRate: 0.4 },
      ENTERPRISE: { price: null, minutes: null, assistants: null, phoneNumbers: null, overageRate: null }
    },
    creditTiers: [
      { min: 1, max: 49, price: 0.45 },
      { min: 50, max: 99, price: 0.42 },
      { min: 100, max: 249, price: 0.38 },
      { min: 250, max: Infinity, price: 0.35 }
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
    'assistants',
    'phoneNumbers',
    'phone',
    'whatsapp',
    'chatWidget',
    'analytics',
    'ecommerce',
    'calendar',
    'batchCalls',
    'email',
    'prioritySupport',
    'apiAccess',
    'customTraining',
    'slaGuarantee'
  ];

  // Feature availability per plan (in display order)
  const PLAN_FEATURES = {
    STARTER: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics'],
    BASIC: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics', 'ecommerce'],
    PROFESSIONAL: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics', 'ecommerce', 'calendar', 'batchCalls', 'email', 'prioritySupport', 'apiAccess'],
    ENTERPRISE: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics', 'ecommerce', 'calendar', 'batchCalls', 'email', 'prioritySupport', 'apiAccess', 'customTraining', 'slaGuarantee']
  };

  // Plan names by region
  const planNames = {
    STARTER: isTR ? 'Başlangıç' : isBR ? 'Inicial' : 'Starter',
    BASIC: isTR ? 'Temel' : isBR ? 'Básico' : 'Basic',
    PROFESSIONAL: isTR ? 'Pro' : isBR ? 'Profissional' : 'Pro',
    ENTERPRISE: isTR ? 'Kurumsal' : isBR ? 'Empresarial' : 'Enterprise'
  };

  // Plan descriptions by region
  const planDescriptions = {
    STARTER: isTR
      ? 'Küçük işletmeler için ideal başlangıç paketi'
      : isBR
      ? 'Pacote inicial ideal para pequenas empresas'
      : 'Perfect starter package for small businesses',
    BASIC: isTR
      ? 'Büyüyen işletmeler için çok kanallı çözüm'
      : isBR
      ? 'Solução multicanal para empresas em crescimento'
      : 'Multi-channel solution for growing businesses',
    PROFESSIONAL: isTR
      ? 'Yüksek hacimli işletmeler için tam donanımlı paket'
      : isBR
      ? 'Pacote completo para empresas de alto volume'
      : 'Full-featured package for high-volume businesses',
    ENTERPRISE: isTR
      ? 'Özel ihtiyaçlar için kişiselleştirilmiş çözümler'
      : isBR
      ? 'Soluções personalizadas para necessidades específicas'
      : 'Customized solutions for specific needs'
  };

  const period = isTR ? '/ay' : isBR ? '/mês' : '/month';
  const popularBadge = isTR ? 'Popüler' : isBR ? 'Popular' : 'Popular';

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
      id: 'BASIC',
      name: planNames.BASIC,
      ...pricing.plans.BASIC,
      period,
      description: planDescriptions.BASIC,
      popular: true,
      badge: popularBadge,
    },
    {
      id: 'PROFESSIONAL',
      name: planNames.PROFESSIONAL,
      ...pricing.plans.PROFESSIONAL,
      period,
      description: planDescriptions.PROFESSIONAL,
      popular: false,
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

  // Feature labels by key - shorter versions for Enterprise
  const getFeatureLabel = (key, plan) => {
    const isEnterprise = plan.id === 'ENTERPRISE';

    const labels = {
      minutes: isEnterprise
        ? (isTR ? '500+ dk (özel)' : '500+ min (custom)')
        : (isTR ? `${plan.minutes} dk görüşme` : `${plan.minutes} min calls`),
      assistants: isEnterprise
        ? (isTR ? '10+ asistan (özel)' : '10+ assistants (custom)')
        : (isTR ? `${plan.assistants} AI asistan` : `${plan.assistants} AI assistant${plan.assistants > 1 ? 's' : ''}`),
      phoneNumbers: isEnterprise
        ? (isTR ? '5+ numara (özel)' : '5+ numbers (custom)')
        : (isTR ? `${plan.phoneNumbers} telefon no` : `${plan.phoneNumbers} phone number${plan.phoneNumbers > 1 ? 's' : ''}`),
      phone: isTR ? 'Telefon AI' : 'Phone AI',
      whatsapp: isTR ? 'WhatsApp' : 'WhatsApp',
      chatWidget: isTR ? 'Chat widget' : 'Chat widget',
      email: isTR ? 'E-posta AI' : 'Email AI',
      ecommerce: isTR ? 'E-ticaret' : 'E-commerce',
      calendar: isTR ? 'Takvim' : 'Calendar',
      batchCalls: isTR ? 'Toplu Arama' : 'Batch Calls',
      analytics: isTR ? 'Analitik' : 'Analytics',
      prioritySupport: isTR ? 'Öncelikli destek' : 'Priority support',
      apiAccess: isTR ? 'API erişimi' : 'API access',
      customTraining: isTR ? 'Özel eğitim' : 'Custom training',
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
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

          {/* Ekstra Kredi Bölümü */}
          <div className="mt-20 text-center max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {isTR ? 'Ekstra Dakika mı Lazım?' : isBR ? 'Precisa de Minutos Extras?' : 'Need Extra Minutes?'}
            </h3>
            <p className="text-gray-600 mb-8">
              {isTR
                ? 'İstediğiniz kadar kredi satın alın, süresi dolmaz'
                : isBR
                ? 'Compre quantos créditos precisar, eles nunca expiram'
                : 'Buy as many credits as you need, they never expire'}
            </p>

            <div className="inline-flex flex-wrap justify-center gap-4">
              {pricing.creditTiers.map((tier, index) => {
                const isLast = index === pricing.creditTiers.length - 1;
                const tierLabel = tier.max === Infinity
                  ? `${tier.min}+ ${isTR ? 'dk' : 'min'}`
                  : `${tier.min}-${tier.max} ${isTR ? 'dk' : 'min'}`;
                const priceLabel = `${formatPrice(tier.price)}/${isTR ? 'dk' : 'min'}`;

                return (
                  <div
                    key={index}
                    className={`rounded-xl px-6 py-4 shadow-md border ${
                      isLast
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <span className={`font-semibold ${isLast ? 'text-primary' : 'text-gray-900'}`}>
                      {tierLabel}:
                    </span>
                    <span className={`ml-2 ${isLast ? 'text-primary' : 'text-gray-600'}`}>
                      {priceLabel}
                    </span>
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

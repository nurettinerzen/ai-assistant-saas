'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PricingPage() {
  const { t, locale } = useLanguage();

  // Determine currency based on locale
  const isTR = locale === 'tr';

  /**
   * Feature Master List (ordered)
   * All plans will show features in this exact order
   * Empty/null for features not included in a plan
   */
  const FEATURE_ORDER = [
    'minutes',
    'assistants',
    'phoneNumbers',
    'phone',
    'whatsapp',
    'chatWidget',
    'email',
    'ecommerce',
    'calendar',
    'batchCalls',
    'analytics',
    'prioritySupport',
    'apiAccess',
    'customTraining',
    'slaGuarantee'
  ];

  // Feature availability per plan
  const PLAN_FEATURES = {
    STARTER: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics'],
    BASIC: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'analytics'],
    PROFESSIONAL: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'batchCalls', 'analytics', 'prioritySupport', 'apiAccess'],
    ENTERPRISE: ['minutes', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'batchCalls', 'analytics', 'prioritySupport', 'apiAccess', 'customTraining', 'slaGuarantee']
  };

  const plans = [
    {
      id: 'STARTER',
      name: isTR ? 'Başlangıç' : 'Starter',
      price: 299,
      currency: '₺',
      period: isTR ? '/ay' : '/month',
      description: isTR
        ? 'Küçük işletmeler için ideal başlangıç paketi'
        : 'Perfect starter package for small businesses',
      minutes: 50,
      assistants: 1,
      phoneNumbers: 1,
      overageRate: 12,
      popular: false,
    },
    {
      id: 'BASIC',
      name: isTR ? 'Temel' : 'Basic',
      price: 999,
      currency: '₺',
      period: isTR ? '/ay' : '/month',
      description: isTR
        ? 'Büyüyen işletmeler için çok kanallı çözüm'
        : 'Multi-channel solution for growing businesses',
      minutes: 150,
      assistants: 3,
      phoneNumbers: 2,
      overageRate: 11,
      popular: true,
      badge: isTR ? 'Popüler' : 'Popular',
    },
    {
      id: 'PROFESSIONAL',
      name: isTR ? 'Pro' : 'Pro',
      price: 3499,
      currency: '₺',
      period: isTR ? '/ay' : '/month',
      description: isTR
        ? 'Yüksek hacimli işletmeler için tam donanımlı paket'
        : 'Full-featured package for high-volume businesses',
      minutes: 500,
      assistants: 10,
      phoneNumbers: 5,
      overageRate: 10,
      popular: false,
    },
    {
      id: 'ENTERPRISE',
      name: isTR ? 'Kurumsal' : 'Enterprise',
      price: null,
      currency: '₺',
      period: '',
      description: isTR
        ? 'Özel ihtiyaçlar için kişiselleştirilmiş çözümler'
        : 'Customized solutions for specific needs',
      minutes: null,
      assistants: null,
      phoneNumbers: null,
      overageRate: null,
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

  // Generate ALL features for a plan (with null for not included)
  const getAllFeatures = (plan) => {
    const includedFeatures = PLAN_FEATURES[plan.id] || [];
    return FEATURE_ORDER.map(key => ({
      key,
      included: includedFeatures.includes(key),
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
                          {plan.currency}
                          {plan.price.toLocaleString('tr-TR')}
                        </span>
                        <span className="text-gray-600 ml-1">{plan.period}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        {isTR ? 'İletişime Geçin' : 'Contact Us'}
                      </span>
                    )}
                  </div>
                  <div className="h-[20px] mt-2">
                    {plan.overageRate ? (
                      <p className="text-xs text-gray-500">
                        {isTR ? `Aşım: ${plan.overageRate} ₺/dk` : `Overage: ${plan.overageRate} ₺/min`}
                      </p>
                    ) : plan.id === 'ENTERPRISE' ? (
                      <p className="text-xs text-gray-500">
                        {isTR ? 'Özel fiyatlandırma' : 'Custom pricing'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Features list - same height for all plans */}
                <ul className="space-y-2 mb-6 flex-grow">
                  {getAllFeatures(plan).map((feature, idx) => (
                    <li
                      key={idx}
                      className={`flex items-center gap-2 h-[24px] ${!feature.included ? 'invisible' : ''}`}
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
              {isTR ? 'Ekstra Dakika mı Lazım?' : 'Need Extra Minutes?'}
            </h3>
            <p className="text-gray-600 mb-8">
              {isTR
                ? 'İstediğiniz kadar kredi satın alın, süresi dolmaz'
                : 'Buy as many credits as you need, they never expire'}
            </p>

            <div className="inline-flex flex-wrap justify-center gap-4">
              <div className="bg-white rounded-xl px-6 py-4 shadow-md border border-gray-100">
                <span className="font-semibold text-gray-900">1-49 dk:</span>
                <span className="text-gray-600 ml-2">9 ₺/dk</span>
              </div>
              <div className="bg-white rounded-xl px-6 py-4 shadow-md border border-gray-100">
                <span className="font-semibold text-gray-900">50-99 dk:</span>
                <span className="text-gray-600 ml-2">8.50 ₺/dk</span>
              </div>
              <div className="bg-white rounded-xl px-6 py-4 shadow-md border border-gray-100">
                <span className="font-semibold text-gray-900">100-249 dk:</span>
                <span className="text-gray-600 ml-2">8 ₺/dk</span>
              </div>
              <div className="bg-primary/10 rounded-xl px-6 py-4 shadow-md border border-primary/20">
                <span className="font-semibold text-primary">250+ dk:</span>
                <span className="text-primary ml-2">7.50 ₺/dk</span>
              </div>
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

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
   * Only show features that are included in each plan
   * All plans follow the same order
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

  // Feature labels by key
  const getFeatureLabel = (key, plan) => {
    const labels = {
      minutes: isTR
        ? `${plan.minutes || '500+'} dakika telefon görüşmesi${plan.id === 'ENTERPRISE' ? ' (özelleştirilebilir)' : ''}`
        : `${plan.minutes || '500+'} minutes of phone calls${plan.id === 'ENTERPRISE' ? ' (customizable)' : ''}`,
      assistants: isTR
        ? `${plan.assistants || '10+'} AI asistan${plan.id === 'ENTERPRISE' ? ' (özelleştirilebilir)' : ''}`
        : `${plan.assistants || '10+'} AI assistant${(plan.assistants || 10) > 1 ? 's' : ''}${plan.id === 'ENTERPRISE' ? ' (customizable)' : ''}`,
      phoneNumbers: isTR
        ? `${plan.phoneNumbers || '5+'} telefon numarası${plan.id === 'ENTERPRISE' ? ' (özelleştirilebilir)' : ''}`
        : `${plan.phoneNumbers || '5+'} phone number${(plan.phoneNumbers || 5) > 1 ? 's' : ''}${plan.id === 'ENTERPRISE' ? ' (customizable)' : ''}`,
      phone: isTR ? 'Telefon AI desteği' : 'Phone AI support',
      whatsapp: isTR ? 'WhatsApp entegrasyonu' : 'WhatsApp integration',
      chatWidget: isTR ? 'Chat widget' : 'Chat widget',
      email: isTR ? 'E-posta AI' : 'Email AI',
      ecommerce: isTR ? 'E-ticaret entegrasyonu' : 'E-commerce integration',
      calendar: isTR ? 'Takvim entegrasyonu' : 'Calendar integration',
      batchCalls: isTR ? 'Toplu Arama (Giden)' : 'Batch Calls (Outbound)',
      analytics: isTR ? 'Temel analitik' : 'Basic analytics',
      prioritySupport: isTR ? 'Öncelikli destek' : 'Priority support',
      apiAccess: isTR ? 'API erişimi' : 'API access',
      customTraining: isTR ? 'Özel eğitim' : 'Custom training',
      slaGuarantee: isTR ? 'SLA garantisi' : 'SLA guarantee'
    };
    return labels[key] || key;
  };

  // Feature availability per plan (only included features are shown)
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

  // Generate features for a plan based on FEATURE_ORDER (only included ones)
  const getPlanFeatures = (plan) => {
    const includedFeatures = PLAN_FEATURES[plan.id] || [];
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                  plan.popular
                    ? 'border-primary scale-105 z-10'
                    : 'border-gray-100 hover:border-primary/30'
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
                  <p className="text-gray-600 text-sm mb-4 min-h-[40px]">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center">
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
                  {plan.overageRate && (
                    <p className="text-xs text-gray-500 mt-2">
                      {isTR ? `Aşım: ${plan.overageRate} ₺/dk` : `Overage: ${plan.overageRate} ₺/min`}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {getPlanFeatures(plan).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

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

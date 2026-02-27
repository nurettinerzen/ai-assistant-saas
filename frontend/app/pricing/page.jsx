'use client';

import { Check, Zap } from 'lucide-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  SHARED_REGIONAL_PRICING,
  SHARED_PLAN_META,
  LOCALE_TO_REGION,
  formatSharedPrice,
  getFeatureLabel,
} from '@shared/pricing';

export default function PricingPage() {
  const { t, locale } = useLanguage();

  // Determine region based on locale
  const region = LOCALE_TO_REGION[locale] || 'US';
  const pricing = SHARED_REGIONAL_PRICING[region] || SHARED_REGIONAL_PRICING.US;
  const isTR = region === 'TR';
  const lang = isTR ? 'tr' : 'en';

  const period = isTR ? '/ay' : '/month';
  const popularBadge = isTR ? 'Popüler' : 'Popular';

  // Build plan cards: TRIAL + STARTER + PRO + ENTERPRISE
  const planIds = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'];
  const plans = planIds.map((id) => {
    const meta = SHARED_PLAN_META[id];
    const planPricing = pricing.plans[id];
    return {
      id,
      name: isTR ? meta.nameTR : meta.nameEN,
      description: isTR ? meta.descTR : meta.descEN,
      price: planPricing.price,
      minutes: planPricing.minutes,
      overageRate: planPricing.overageRate,
      concurrentLimit: planPricing.concurrentLimit,
      assistantsLimit: planPricing.assistantsLimit,
      chatDays: planPricing.chatDays,
      features: meta.features,
      period: id === 'ENTERPRISE' ? '' : (id === 'TRIAL' ? '' : period),
      popular: id === 'PRO',
      badge: id === 'PRO' ? popularBadge : null,
    };
  });

  // Get features for a plan
  const getPlanFeatures = (plan) => {
    // Always show minutes, concurrent, assistants first, then plan-specific features
    const display = ['minutes', 'concurrent', 'assistants', ...plan.features];
    // Deduplicate while keeping order
    const seen = new Set();
    return display
      .filter((key) => {
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((key) => ({
        key,
        text: getFeatureLabel(key, lang, plan),
      }));
  };

  // PAYG pricing info
  const payg = pricing.plans.PAYG;
  const overageRatePerMinute = pricing.plans.STARTER?.overageRate || pricing.plans.PRO?.overageRate || payg.pricePerMinute;
  const overageRows = [
    {
      channel: isTR ? 'Arama dakikası' : 'Voice minute',
      unit: isTR ? '1 dk' : '1 min',
      rate: `${formatSharedPrice(overageRatePerMinute, region)}/${isTR ? 'dk' : 'min'}`,
      note: isTR ? 'Plan dakikası bittikten sonra uygulanır.' : 'Applies after plan minutes are consumed.',
    },
    {
      channel: isTR ? 'WhatsApp mesajı' : 'WhatsApp message',
      unit: isTR ? '1 mesaj' : '1 message',
      rate: isTR ? 'Ek ücret yok' : 'No extra fee',
      note: isTR ? 'Mevcut plan kapsamında kullanılır.' : 'Handled within current plan scope.',
    },
    {
      channel: isTR ? 'E-posta yanıt/draft' : 'Email reply/draft',
      unit: isTR ? '1 e-posta' : '1 email',
      rate: isTR ? 'Ek ücret yok' : 'No extra fee',
      note: isTR ? 'Ayrı mesaj başı aşım tanımı yok.' : 'No separate per-message overage is defined.',
    },
    {
      channel: isTR ? 'Web chat mesajı' : 'Web chat message',
      unit: isTR ? '1 mesaj' : '1 message',
      rate: isTR ? 'Ek ücret yok' : 'No extra fee',
      note: isTR ? 'Mevcut plan kapsamında kullanılır.' : 'Handled within current plan scope.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('pricing.title')}
            </h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-neutral-400 mb-4">
              {t('pricing.subtitle')}
            </p>
            <p className="text-sm text-primary font-medium">
              {isTR
                ? '15 dakika ücretsiz deneme — Kredi kartı gerekmez'
                : '15-minute free trial — No credit card required'}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 hover:shadow-xl flex flex-col ${
                  plan.popular
                    ? 'border-primary'
                    : 'border-gray-100 dark:border-neutral-700 hover:border-gray-200 dark:hover:border-neutral-600'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 dark:text-neutral-400 text-sm mb-4 min-h-[40px]">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center min-h-[40px]">
                    {plan.id === 'TRIAL' ? (
                      <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {isTR ? 'Ücretsiz' : 'Free'}
                      </span>
                    ) : plan.price !== null ? (
                      <>
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          {formatSharedPrice(plan.price, region)}
                        </span>
                        <span className="text-gray-600 dark:text-neutral-400 ml-1">{plan.period}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {isTR ? 'İletişime Geçin' : 'Contact Us'}
                      </span>
                    )}
                  </div>
                  <div className="min-h-[20px] mt-2">
                    {plan.id === 'TRIAL' && plan.chatDays ? (
                      <p className="text-xs text-gray-500 dark:text-neutral-500">
                        {isTR ? `${plan.chatDays} gün chat/WhatsApp` : `${plan.chatDays}-day chat/WhatsApp`}
                      </p>
                    ) : plan.overageRate ? (
                      <p className="text-xs text-gray-500 dark:text-neutral-500">
                        {isTR ? `Aşım: ${formatSharedPrice(plan.overageRate, region)}/dk` : `Overage: ${formatSharedPrice(plan.overageRate, region)}/min`}
                      </p>
                    ) : plan.id === 'ENTERPRISE' ? (
                      <p className="text-xs text-gray-500 dark:text-neutral-500">
                        {isTR ? 'Özel fiyatlandırma' : 'Custom pricing'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Features list */}
                <ul className="space-y-2 mb-6 flex-grow">
                  {getPlanFeatures(plan).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-neutral-300 leading-snug">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Button always at bottom */}
                <div className="mt-auto">
                  <Link href={plan.id === 'ENTERPRISE' ? '/contact' : '/signup'} className="block">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? 'bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      size="lg"
                    >
                      {plan.id === 'ENTERPRISE'
                        ? (isTR ? 'Bize Ulaşın' : 'Contact Us')
                        : plan.id === 'TRIAL'
                          ? (isTR ? 'Ücretsiz Dene' : 'Try Free')
                          : (isTR ? 'Hemen Başla' : 'Get Started')}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* PAYG Section */}
          <div className="mt-20 text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="h-6 w-6 text-primary" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isTR ? 'Kullandıkça Öde' : 'Pay As You Go'}
              </h3>
            </div>
            <p className="text-gray-600 dark:text-neutral-400 mb-8">
              {isTR
                ? 'Aylık taahhüt yok. Dakika başı ödeme yapın.'
                : 'No monthly commitment. Pay per minute.'}
            </p>

            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 md:p-8 shadow-lg border border-gray-100 dark:border-neutral-700 max-w-lg mx-auto">
              <div className="text-4xl font-bold text-primary mb-2">
                {formatSharedPrice(payg.pricePerMinute, region)}<span className="text-lg text-gray-500 dark:text-neutral-400">/{isTR ? 'dk' : 'min'}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
                {isTR
                  ? `Minimum ${payg.minTopup} dk yükleme (${formatSharedPrice(payg.minTopup * payg.pricePerMinute, region)})`
                  : `Minimum ${payg.minTopup} min top-up (${formatSharedPrice(payg.minTopup * payg.pricePerMinute, region)})`}
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500 dark:text-neutral-500">
                <span className="bg-gray-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  {isTR ? 'Tüm kanallar dahil' : 'All channels included'}
                </span>
                <span className="bg-gray-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  {isTR ? `${payg.assistantsLimit} asistan` : `${payg.assistantsLimit} assistants`}
                </span>
                <span className="bg-gray-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  {isTR ? 'Bakiye süresi dolmaz' : 'Balance never expires'}
                </span>
              </div>
              <div className="mt-6">
                <Link href="/signup">
                  <Button variant="outline" size="lg" className="w-full">
                    {isTR ? 'Hemen Başla' : 'Get Started'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Overage Details */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {isTR ? 'Paket aşım detayları' : 'Plan overage details'}
              </h3>
              <p className="text-gray-600 dark:text-neutral-400 max-w-3xl mx-auto">
                {isTR
                  ? 'Paket aşımı, planınızda tanımlı dakikaların bitmesinden sonra oluşan ek kullanımı ifade eder.'
                  : 'Plan overage means extra usage after the included plan minutes are exhausted.'}
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-700 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-100 dark:border-neutral-700">
                    <tr>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {isTR ? 'Kanal' : 'Channel'}
                      </th>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {isTR ? 'Birim' : 'Unit'}
                      </th>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {isTR ? 'Aşım ücreti' : 'Overage rate'}
                      </th>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {isTR ? 'Not' : 'Note'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overageRows.map((row) => (
                      <tr key={row.channel} className="border-b border-gray-100 dark:border-neutral-700/80 last:border-b-0">
                        <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{row.channel}</td>
                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-neutral-300">{row.unit}</td>
                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-neutral-300">{row.rate}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-neutral-400">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Decision CTA */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="rounded-3xl border border-gray-200 dark:border-neutral-700 bg-gradient-to-r from-slate-900 to-blue-900 p-10 text-center shadow-xl">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {isTR ? 'Hâlâ kararsız mısınız?' : 'Still undecided?'}
              </h3>
              <p className="text-lg text-blue-100 mb-8">
                {isTR
                  ? 'İhtiyacınıza göre doğru paketi birlikte seçelim.'
                  : 'Let’s choose the right package together for your needs.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contact">
                  <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                    {isTR ? 'Demo Talep Et' : 'Request Demo'}
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isTR ? 'Ücretsiz Dene' : 'Try Free'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-16 text-center max-w-2xl mx-auto">
            <p className="text-gray-600 dark:text-neutral-400">
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

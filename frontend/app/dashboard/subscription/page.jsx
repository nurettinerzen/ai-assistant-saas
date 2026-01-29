/**
 * Subscription Page
 * View current plan, usage, and upgrade options
 * Updated with Credit System support
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, CreditCard, TrendingUp, Loader2, AlertCircle, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import CreditBalance from '@/components/CreditBalance';
import BuyCreditModal from '@/components/BuyCreditModal';
import {
  REGIONAL_PRICING,
  PLAN_HIERARCHY,
  LEGACY_PLAN_MAP,
  getPlanDisplayName,
} from '@/lib/planConfig';
import {
  useSubscription,
  useBillingHistory,
  useUpgradeSubscription,
} from '@/hooks/useSubscription';
import { useProfile } from '@/hooks/useSettings';

// Note: Region is determined by business.country, NOT by UI language
// Language (locale) only affects UI text, not pricing

// Map locale to UI language key (for text translations)
const LOCALE_TO_LANG = {
  tr: 'TR',
  en: 'EN',
  pr: 'PR'
};

// Base plan configurations - YENİ FİYATLANDIRMA SİSTEMİ
// Sıralama: PAYG → Başlangıç → Pro → Kurumsal
// NOT: TRIAL plan burada gösterilmez, yeni kayıtlarda otomatik başlar
// PAYG = PREPAID (bakiye), Paketler = POSTPAID (ay sonu fatura)
// Calendar ve Sheets tüm planlarda açık
const BASE_PLANS = [
  {
    id: 'PAYG',
    name: { TR: 'Kullandıkça Öde', EN: 'Pay As You Go' },
    description: { TR: 'Taahhütsüz, bakiye yükle kullan', EN: 'No commitment, top up and use' },
    includedFeatures: ['payPerMinute', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics', 'email'],
    isPayg: true,
    paymentModel: 'PREPAID',
  },
  {
    id: 'STARTER',
    name: { TR: 'Başlangıç', EN: 'Starter' },
    description: { TR: '150 dakika dahil, aşım ay sonu faturalanır', EN: '150 minutes included, overage billed monthly' },
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'analytics', 'email'],
    paymentModel: 'POSTPAID',
  },
  {
    id: 'PRO',
    name: { TR: 'Pro', EN: 'Pro' },
    description: { TR: '500 dakika dahil, öncelikli destek', EN: '500 minutes included, priority support' },
    popular: true,
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'googleSheets', 'analytics', 'email', 'batchCalls', 'prioritySupport', 'apiAccess'],
    paymentModel: 'POSTPAID',
  },
  {
    id: 'ENTERPRISE',
    name: { TR: 'Kurumsal', EN: 'Enterprise' },
    description: { TR: 'Özel fiyatlandırma, SLA garantisi', EN: 'Custom pricing, SLA guarantee' },
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'googleSheets', 'analytics', 'email', 'batchCalls', 'prioritySupport', 'apiAccess', 'slaGuarantee'],
    paymentModel: 'POSTPAID',
  },
];

export default function SubscriptionPage() {
  const { t, locale } = useLanguage();
  const { can, loading: permissionsLoading } = usePermissions();

  // React Query hooks
  const { data: subscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useSubscription();
  const { data: billingHistory = [], isLoading: billingLoading } = useBillingHistory();
  const { data: profileData } = useProfile();
  const upgradeSubscription = useUpgradeSubscription();

  const loading = subscriptionLoading || billingLoading;
  const [upgrading, setUpgrading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutFormHtml, setCheckoutFormHtml] = useState('');
  const checkoutContainerRef = useRef(null);
  // Credit modal state
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditRefreshTrigger, setCreditRefreshTrigger] = useState(0);
  const [userCountry, setUserCountry] = useState(() => {
    // Initial detection from browser locale
    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || navigator.userLanguage;
      if (lang === 'tr' || lang === 'tr-TR' || lang.startsWith('tr-')) {
        return 'TR';
      }
      if (lang === 'pt' || lang === 'pt-BR' || lang.startsWith('pt-')) {
        return 'BR';
      }
    }
    return 'US';
  });

  // Update user country from profile data
  useEffect(() => {
    if (profileData?.business?.country || profileData?.country) {
      const country = profileData.business?.country || profileData.country;
      setUserCountry(country);
    }
  }, [profileData]);

  // Determine region from business country (NOT from UI language)
  const getRegion = () => {
    // Region is based on business.country, not locale
    if (userCountry === 'TR' || userCountry === 'Turkey') return 'TR';
    if (userCountry === 'BR' || userCountry === 'Brazil') return 'BR';
    if (userCountry === 'US' || userCountry === 'United States') return 'US';
    return 'US'; // Default fallback
  };

  const region = getRegion(); // For pricing (based on country)
  const uiLang = LOCALE_TO_LANG[locale] || 'EN'; // For UI text (based on language)
  const regionConfig = REGIONAL_PRICING[region] || REGIONAL_PRICING.US;

  // Format currency based on region
  const formatPrice = (amount) => {
    if (amount === null || amount === undefined) return null;
    const formatted = amount.toLocaleString(regionConfig.locale);
    return regionConfig.currencyPosition === 'after'
      ? `${formatted}${regionConfig.currency}`
      : `${regionConfig.currency}${formatted}`;
  };

  // Get plan pricing for current region
  const getPlanPricing = (planId) => {
    return regionConfig.plans[planId] || null;
  };

  // Get plan name based on UI language (not region)
  const getPlanName = (plan) => {
    return plan.name[uiLang] || plan.name.EN;
  };

  // Handle iyzico checkout form rendering
  useEffect(() => {
    if (showPaymentModal && checkoutFormHtml && checkoutContainerRef.current) {
      const container = checkoutContainerRef.current;
      container.innerHTML = checkoutFormHtml;

      // Execute scripts in the checkout form
      const scripts = container.getElementsByTagName('script');
      Array.from(scripts).forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.text = oldScript.text;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  }, [showPaymentModal, checkoutFormHtml]);

  // Check for success/error in URL params (after payment callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const success = params.get('success');
    const session_id = params.get('session_id');

    // Verify Stripe session if present
    if (success === 'true' && session_id) {
      apiClient.get(`/api/subscription/verify-session?session_id=${session_id}`)
        .then(() => {
          toast.success(t('dashboard.subscriptionPage.upgradeSuccess') || 'Plan başarıyla yükseltildi!');
          // Reload subscription data
          refetchSubscription();
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((error) => {
          console.error('Session verification error:', error);
          toast.error('Abonelik aktivasyonunda hata oluştu');
        });
      return;
    }

    if (status === 'success' || success === 'true') {
      toast.success(t('dashboard.subscriptionPage.upgradeSuccess') || 'Plan basariyla yukseltildi!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload subscription data
      refetchSubscription();
    } else if (status === 'error' || params.get('error')) {
      const errorMsg = params.get('message') || t('dashboard.subscriptionPage.upgradeFailed') || 'Odeme basarisiz oldu';
      toast.error(decodeURIComponent(errorMsg));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refetchSubscription]);

  const handleUpgrade = async (planId) => {
    // Get plan name from BASE_PLANS
    const planInfo = BASE_PLANS.find(p => p.id === planId);
    const planName = planInfo ? planInfo.name[uiLang] : planId;

    if (!confirm(`${t('dashboard.subscriptionPage.upgradeConfirm') || 'Planı değiştirmek istediğinize emin misiniz?'} ${planName}`)) return;

    try {
      setUpgrading(true);
      const response = await apiClient.subscription.upgrade(planId);

      // Handle different response types
      if (response.data?.type === 'payg_switch') {
        // Switched to PAYG (pay as you go)
        toast.success(uiLang === 'TR' ? 'Kullandıkça öde planına geçildi. Bakiye yükleyerek kullanmaya başlayabilirsiniz.' : 'Switched to Pay As You Go. Top up your balance to start using.');
        loadData();
      } else if (response.data?.type === 'upgrade') {
        // Immediate upgrade (with proration)
        toast.success('Plan başarıyla yükseltildi! Fark tutarı hesaplanarak tahsil edildi.');
        loadData();
      } else if (response.data?.type === 'reactivate') {
        // Reactivated canceled subscription with new plan
        const effectiveDate = response.data.effectiveDate
          ? new Date(response.data.effectiveDate).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'bir sonraki dönem';
        toast.success(`Abonelik yeniden başlatıldı! ${effectiveDate} tarihinden itibaren ${planName} planı aktif olacak.`);
        loadData();
      } else if (response.data?.type === 'downgrade') {
        // Scheduled downgrade (end of period)
        const effectiveDate = response.data.effectiveDate
          ? new Date(response.data.effectiveDate).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'dönem sonunda';
        toast.success(`Plan değişikliği planlandı. ${effectiveDate} tarihinde ${planName} planına geçilecek.`);
        loadData();
      } else if (response.data?.checkoutFormContent) {
        // iyzico checkout form
        setCheckoutFormHtml(response.data.checkoutFormContent);
        setShowPaymentModal(true);
      } else if (response.data?.sessionUrl) {
        // Stripe checkout (new subscription)
        window.location.href = response.data.sessionUrl;
      } else {
        toast.success(t('dashboard.subscriptionPage.upgradeSuccess') || 'Plan başarıyla güncellendi!');
        loadData();
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error(error.response?.data?.error || t('dashboard.subscriptionPage.upgradeFailed') || 'İşlem başlatılamadı');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(t('dashboard.subscriptionPage.cancelConfirm') || 'Aboneliğinizi iptal etmek istediğinize emin misiniz? Mevcut dönem sonunda planınız sona erecektir.')) {
      return;
    }

    try {
      setUpgrading(true);
      const response = await apiClient.post('/api/subscription/cancel');

      if (response.data?.success) {
        const cancelDate = response.data.cancelAt
          ? new Date(response.data.cancelAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'dönem sonunda';
        toast.success(`Abonelik iptal edildi. ${cancelDate} tarihinde sona erecek.`);
        loadData();
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast.error(error.response?.data?.error || 'İptal işlemi başarısız oldu');
    } finally {
      setUpgrading(false);
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCheckoutFormHtml('');
  };

  const usagePercent = subscription
    ? (subscription.creditsUsed / subscription.creditsLimit) * 100
    : 0;

  // Show loading while permissions are being loaded
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Check permission for billing
  if (!can('billing:view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle className="h-16 w-16 text-neutral-300 mb-4" />
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">{t('dashboard.subscriptionPage.accessDenied')}</h2>
        <p className="text-neutral-500">{t('dashboard.subscriptionPage.noBillingPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.subscriptionPage.title')}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.subscriptionPage.description')}</p>
      </div>

      {/* Current plan & usage */}
      {!loading && subscription && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current plan */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.subscriptionPage.currentPlan')}</h2>
              <Badge className="bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400">
                {getPlanDisplayName(subscription.plan, locale)}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('dashboard.subscriptionPage.monthlyCost')}</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {(() => {
                    // Get price from REGIONAL_PRICING based on subscription.plan
                    const planPricing = getPlanPricing(subscription.plan);
                    if (planPricing && planPricing.price !== null) {
                      return formatPrice(planPricing.price);
                    }
                    // FREE plan or custom pricing
                    if (subscription.plan === 'FREE') return formatPrice(0);
                    if (subscription.plan === 'ENTERPRISE') return t('dashboard.subscriptionPage.custom');
                    return formatPrice(subscription.price || 0);
                  })()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('dashboard.subscriptionPage.billingCycle')}</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {subscription.billingCycle || t('dashboard.subscriptionPage.monthly')}
                </span>
              </div>
              {subscription.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('dashboard.subscriptionPage.nextBilling')}</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {formatDate(subscription.currentPeriodEnd || subscription.nextBillingDate, 'short')}
                </span>
              </div>
              )}
              {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Abonelik Bitiş Tarihi</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {formatDate(subscription.currentPeriodEnd, 'short')}
                </span>
              </div>
              )}
            </div>

            {/* Cancel Subscription Button - Only show for paid plans */}
            {subscription.plan !== 'FREE' && !subscription.cancelAtPeriodEnd && (
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelSubscription}
                  disabled={upgrading}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {upgrading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('dashboard.subscriptionPage.processing') || 'İşleniyor...'}
                    </>
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      {t('dashboard.subscriptionPage.cancelSubscription') || 'Aboneliği İptal Et'}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Canceled status message */}
            {subscription.cancelAtPeriodEnd && (
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-orange-800 dark:text-orange-400">
                  <strong>Abonelik iptal edildi.</strong>
                  <br />
                  {subscription.currentPeriodEnd && (
                    <>Planınız {formatDate(subscription.currentPeriodEnd, 'short')} tarihinde sona erecek.</>
                  )}
                  {!subscription.currentPeriodEnd && <>Planınız dönem sonunda sona erecek.</>}
                </div>
              </div>
            )}
          </div>

          {/* Credit Balance - YENİ KREDİ SİSTEMİ */}
          <div className="lg:col-span-2">
            <CreditBalance
              onBuyCredit={() => setCreditModalOpen(true)}
              refreshTrigger={creditRefreshTrigger}
            />
          </div>
        </div>
      )}

      {/* Pricing plans */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
          {uiLang === 'TR' ? 'Planlar' : 'Plans'}
        </h2>
        {/* 4 plan kartı: mobilde 1, tablette 2, büyük ekranda 4 yan yana */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {BASE_PLANS.map((plan) => {
            const planPricing = getPlanPricing(plan.id);
            // Legacy plan mapping from centralized config
            const userPlanMapped = LEGACY_PLAN_MAP[subscription?.plan] || subscription?.plan;
            const isCurrentPlan = userPlanMapped === plan.id;
            // Only show "Popular" badge if user has no plan or is on FREE plan
            const showPopularBadge = plan.popular && !isCurrentPlan && (!subscription?.plan || subscription?.plan === 'FREE');

            // Plan order for upgrade/downgrade logic from centralized config
            const currentPlanIndex = PLAN_HIERARCHY[subscription?.plan] || 0;
            const thisPlanIndex = PLAN_HIERARCHY[plan.id];
            const isUpgrade = thisPlanIndex > currentPlanIndex;
            const isDowngrade = thisPlanIndex < currentPlanIndex;

            // Button text based on plan comparison and UI language
            const getButtonText = () => {
              const texts = {
                TR: {
                  contact: 'Bize Ulaşın',
                  current: 'Mevcut Plan',
                  upgrade: 'Yükselt',
                  downgrade: 'Düşür',
                  select: 'Seç'
                },
                EN: {
                  contact: 'Contact Us',
                  current: 'Current Plan',
                  upgrade: 'Upgrade',
                  downgrade: 'Downgrade',
                  select: 'Select'
                }
              };
              const txt = texts[uiLang] || texts.EN;
              // Önce mevcut plan kontrolü - ENTERPRISE dahil
              if (isCurrentPlan) return txt.current;
              // Enterprise için "Bize Ulaşın" (mevcut plan değilse)
              if (plan.id === 'ENTERPRISE') return txt.contact;
              if (isUpgrade) return txt.upgrade;
              if (isDowngrade) return txt.downgrade;
              return txt.select;
            };

            // Feature order - YENİ FİYATLANDIRMA SİSTEMİ
            const FEATURE_ORDER = [
              'trialMinutes', 'trialChat', 'payPerMinute', 'minutes', 'concurrent',
              'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget',
              'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls',
              'prioritySupport', 'apiAccess', 'slaGuarantee'
            ];

            // Feature labels - YENİ FİYATLANDIRMA SİSTEMİ
            const getFeatureLabel = (key) => {
              const isEnterprise = plan.id === 'ENTERPRISE';
              const isPro = plan.id === 'PRO';
              const isStarter = plan.id === 'STARTER';
              const isPayg = plan.id === 'PAYG';

              // Get assistant count from planPricing
              const assistantCount = planPricing?.assistants ||
                (isEnterprise ? 25 : isPro ? 10 : 5);

              // UI language-based label maps
              const labelMaps = {
                TR: {
                  trialMinutes: '15 dakika telefon görüşmesi',
                  trialChat: '7 gün chat/WhatsApp',
                  payPerMinute: `${formatPrice(planPricing?.pricePerMinute || 0)}/dk kullandıkça öde`,
                  minutes: isEnterprise ? '500+ dk (özel)' : `${planPricing?.minutes || 0} dk dahil`,
                  concurrent: isEnterprise
                    ? '5+ eşzamanlı çağrı (özel)'
                    : `${planPricing?.concurrent || 1} eşzamanlı çağrı`,
                  assistants: isEnterprise
                    ? '25+ asistan (özel)'
                    : isPro
                      ? '10 asistan'
                      : '5 asistan',
                  phoneNumbers: '1 telefon numarası',
                  phone: 'Telefon AI',
                  whatsapp: 'WhatsApp',
                  chatWidget: 'Chat widget',
                  email: 'E-posta AI',
                  ecommerce: 'E-ticaret entegrasyonu',
                  calendar: 'Google Takvim',
                  googleSheets: 'Google Sheets',
                  batchCalls: 'Toplu arama',
                  analytics: 'Analitik',
                  prioritySupport: 'Öncelikli destek',
                  apiAccess: 'API erişimi',
                  slaGuarantee: 'SLA garantisi',
                },
                EN: {
                  trialMinutes: '15 minutes phone calls',
                  trialChat: '7 days chat/WhatsApp',
                  payPerMinute: `${formatPrice(planPricing?.pricePerMinute || 0)}/min pay as you go`,
                  minutes: isEnterprise ? '500+ min (custom)' : `${planPricing?.minutes || 0} min included`,
                  concurrent: isEnterprise
                    ? '5+ concurrent calls (custom)'
                    : `${planPricing?.concurrent || 1} concurrent call${(planPricing?.concurrent || 1) > 1 ? 's' : ''}`,
                  assistants: isEnterprise
                    ? '25+ assistants (custom)'
                    : isPro
                      ? '10 assistants'
                      : '5 assistants',
                  phoneNumbers: '1 phone number',
                  phone: 'Phone AI',
                  whatsapp: 'WhatsApp',
                  chatWidget: 'Chat widget',
                  email: 'Email AI',
                  ecommerce: 'E-commerce integration',
                  calendar: 'Google Calendar',
                  googleSheets: 'Google Sheets',
                  batchCalls: 'Batch calls',
                  analytics: 'Analytics',
                  prioritySupport: 'Priority support',
                  apiAccess: 'API access',
                  slaGuarantee: 'SLA guarantee',
                }
              };

              return labelMaps[uiLang]?.[key] || labelMaps.EN[key] || key;
            };

            // Get only included features (no gaps, maintains order)
            const getPlanFeatures = () => {
              return FEATURE_ORDER
                .filter(key => plan.includedFeatures.includes(key))
                .map(key => ({
                  key,
                  text: getFeatureLabel(key)
                }));
            };

            return (
              <div
                key={plan.id}
                className={`bg-white dark:bg-neutral-900 rounded-xl border-2 p-6 shadow-sm relative flex flex-col h-full ${
                  isCurrentPlan ? 'border-green-500 ring-2 ring-green-200 dark:ring-green-900' : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {/* Show "Current Plan" badge if this is the current plan */}
                {isCurrentPlan && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-neutral-900 px-1">
                    <Badge className="bg-green-600 text-white px-3 py-1">
                      {t('dashboard.subscriptionPage.currentPlan')}
                    </Badge>
                  </div>
                )}
                {/* Show "Popular" badge only if user has no plan */}
                {showPopularBadge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-neutral-900 px-1">
                    <Badge className="bg-primary-600 text-white px-3 py-1">
                      {t('dashboard.subscriptionPage.popular')}
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                    {getPlanName(plan)}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1 h-[40px]">
                    {plan.id === 'PAYG' ? (
                      /* PAYG: Dakika başına fiyat */
                      <>
                        <span className="text-3xl font-bold text-neutral-900 dark:text-white">
                          {formatPrice(planPricing?.pricePerMinute || 0)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">/{uiLang === 'TR' ? 'dk' : 'min'}</span>
                      </>
                    ) : planPricing?.price !== null ? (
                      /* Normal planlar: Aylık fiyat */
                      <>
                        <span className="text-3xl font-bold text-neutral-900 dark:text-white">
                          {formatPrice(planPricing.price)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">{t('dashboard.subscriptionPage.perMonth')}</span>
                      </>
                    ) : (
                      /* Enterprise: Özel */
                      <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {uiLang === 'TR' ? 'Özel' : uiLang === 'PR' ? 'Personalizado' : 'Custom'}
                      </span>
                    )}
                  </div>
                  <div className="h-[20px] mt-2">
                    {plan.id === 'PAYG' ? (
                      /* PAYG: Prepaid - Taahhütsüz */
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {uiLang === 'TR' ? 'Taahhütsüz, bakiye yükle kullan' : 'No commitment, top up and use'}
                      </p>
                    ) : planPricing?.overageRate ? (
                      /* Paket planları: POSTPAID aşım (ay sonu fatura) */
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {uiLang === 'TR'
                          ? `Aşım: ${formatPrice(planPricing.overageRate)}/dk (ay sonu fatura)`
                          : `Overage: ${formatPrice(planPricing.overageRate)}/min (billed monthly)`}
                      </p>
                    ) : plan.id === 'ENTERPRISE' ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {uiLang === 'TR' ? 'Özel fiyatlandırma' : uiLang === 'PR' ? 'Preço personalizado' : 'Custom pricing'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Features list - only shows included features, no gaps */}
                <ul className="space-y-2 mb-6 flex-1 min-h-0">
                  {getPlanFeatures().map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-neutral-700 dark:text-neutral-300 truncate">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                {plan.id === 'ENTERPRISE' ? (
                  isCurrentPlan ? (
                    <Button
                      className="w-full bg-neutral-100 text-neutral-500 cursor-not-allowed border-neutral-200"
                      variant="outline"
                      disabled
                    >
                      {getButtonText()}
                    </Button>
                  ) : (
                    <Button
                      className="w-full border-primary-600 text-primary-600 hover:bg-primary-50"
                      variant="outline"
                      onClick={() => window.location.href = '/contact'}
                    >
                      {getButtonText()}
                    </Button>
                  )
                ) : (
                  <Button
                    className={`w-full ${
                      isCurrentPlan
                        ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed border-neutral-200'
                        : isUpgrade
                          ? 'bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600 text-white'
                          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                    variant={isCurrentPlan ? 'outline' : (isUpgrade ? 'default' : 'outline')}
                    disabled={isCurrentPlan || !can('billing:manage') || upgrading}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {upgrading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uiLang === 'TR' ? 'İşleniyor...' : 'Processing...'}
                      </>
                    ) : (
                      getButtonText()
                    )}
                  </Button>
                )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing history - Hidden until real invoices are available */}
      {/*
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900">{t('dashboard.subscriptionPage.billingHistory')}</h2>
          </div>
        </div>
        <div className="p-8 text-center text-sm text-neutral-500">
          {t('dashboard.subscriptionPage.noBillingHistory')}
        </div>
      </div>
      */}

      {/* iyzico Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">
                {t('dashboard.subscriptionPage.payment') || 'Ödeme'}
              </h3>
              <button
                onClick={closePaymentModal}
                className="text-neutral-500 hover:text-neutral-700 transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <div ref={checkoutContainerRef} id="iyzico-checkout-container" />
            </div>
          </div>
        </div>
      )}

      {/* Buy Credit Modal - YENİ KREDİ SİSTEMİ */}
      <BuyCreditModal
        isOpen={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        onSuccess={() => {
          // Refresh credit balance
          setCreditRefreshTrigger(prev => prev + 1);
          // Also reload subscription data
          loadData();
        }}
      />
    </div>
  );
}

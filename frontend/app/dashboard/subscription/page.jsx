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

// Regional pricing configuration - YENİ PAKET YAPISI
const REGIONAL_PRICING = {
  TR: {
    currency: '₺',
    currencyPosition: 'after',
    locale: 'tr-TR',
    plans: {
      // YENİ PAKET YAPISI - 3 paket: Başlangıç, Profesyonel, Kurumsal
      STARTER: { price: 799, minutes: 100, concurrent: 1, overageRate: 10 },
      PRO: { price: 3999, minutes: 800, concurrent: 5, overageRate: 8 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 6 },
      // Legacy plan aliases - yeni plan değerlerini kullan
      BASIC: { price: 799, minutes: 100, concurrent: 1, overageRate: 10 },        // → STARTER
      PROFESSIONAL: { price: 3999, minutes: 800, concurrent: 5, overageRate: 8 }  // → PRO
    }
  },
  BR: {
    currency: 'R$',
    currencyPosition: 'before',
    locale: 'pt-BR',
    plans: {
      STARTER: { price: 99, minutes: 100, concurrent: 1, overageRate: 3.5 },
      PRO: { price: 499, minutes: 800, concurrent: 5, overageRate: 2.5 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 2.0 },
      BASIC: { price: 99, minutes: 100, concurrent: 1, overageRate: 3.5 },
      PROFESSIONAL: { price: 499, minutes: 800, concurrent: 5, overageRate: 2.5 }
    }
  },
  US: {
    currency: '$',
    currencyPosition: 'before',
    locale: 'en-US',
    plans: {
      STARTER: { price: 49, minutes: 100, concurrent: 1, overageRate: 0.35 },
      PRO: { price: 199, minutes: 800, concurrent: 5, overageRate: 0.25 },
      ENTERPRISE: { price: null, minutes: null, concurrent: 10, overageRate: 0.20 },
      BASIC: { price: 49, minutes: 100, concurrent: 1, overageRate: 0.35 },
      PROFESSIONAL: { price: 199, minutes: 800, concurrent: 5, overageRate: 0.25 }
    }
  }
};

// Note: Region is determined by business.country, NOT by UI language
// Language (locale) only affects UI text, not pricing

// Map locale to UI language key (for text translations)
const LOCALE_TO_LANG = {
  tr: 'TR',
  en: 'EN',
  pr: 'PR'
};

// Base plan configurations - YENİ PAKET YAPISI
const BASE_PLANS = [
  {
    id: 'STARTER',
    name: { TR: 'Başlangıç', EN: 'Starter' },
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics'],
  },
  {
    id: 'PRO',
    name: { TR: 'Profesyonel', EN: 'Pro' },
    popular: true,
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls', 'prioritySupport', 'apiAccess'],
  },
  {
    id: 'ENTERPRISE',
    name: { TR: 'Kurumsal', EN: 'Enterprise' },
    includedFeatures: ['minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget', 'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls', 'prioritySupport', 'apiAccess', 'slaGuarantee'],
  },
];

export default function SubscriptionPage() {
  const { t, locale } = useLanguage();
  const { can, loading: permissionsLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
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
          loadData();
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
      loadData();
    } else if (status === 'error' || params.get('error')) {
      const errorMsg = params.get('message') || t('dashboard.subscriptionPage.upgradeFailed') || 'Odeme basarisiz oldu';
      toast.error(decodeURIComponent(errorMsg));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load data when permissions are ready and user has billing:view permission
  useEffect(() => {
    // Wait for permissions to be loaded from localStorage
    if (permissionsLoading) {
      return;
    }

    if (can('billing:view')) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [can, permissionsLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, billingRes, profileRes] = await Promise.all([
        apiClient.subscription.getCurrent(),
        apiClient.subscription.getBillingHistory(),
        apiClient.settings.getProfile(),
      ]);
      console.log('Subscription API response:', subRes.data);
      setSubscription(subRes.data);
      setBillingHistory(billingRes.data.history || []);

      // Get user's country from business settings or profile
      const businessCountry = profileRes.data?.business?.country;
      const userProfileCountry = profileRes.data?.country;
      const country = businessCountry || userProfileCountry;

      // Only update if we got a valid country from API
      if (country) {
        setUserCountry(country);
      }

      // Debug log
      console.log('Subscription page - userCountry:', country, 'isTurkish:', country === 'TR' || country === 'Turkey');
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    // Get plan name from BASE_PLANS
    const planInfo = BASE_PLANS.find(p => p.id === planId);
    const planName = planInfo ? planInfo.name[uiLang] : planId;

    if (!confirm(`${t('dashboard.subscriptionPage.upgradeConfirm') || 'Planı değiştirmek istediğinize emin misiniz?'} ${planName}`)) return;

    try {
      setUpgrading(true);
      const response = await apiClient.subscription.upgrade(planId);

      // Handle different response types
      if (response.data?.type === 'upgrade') {
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
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.subscriptionPage.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.subscriptionPage.description')}</p>
      </div>

      {/* Current plan & usage */}
      {!loading && subscription && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current plan */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.subscriptionPage.currentPlan')}</h2>
              <Badge className="bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400">
                {subscription.plan === 'FREE' ? t('dashboard.subscriptionPage.freePlan') :
                 subscription.plan === 'STARTER' ? (uiLang === 'TR' ? 'Başlangıç' : 'Starter') :
                 subscription.plan === 'PRO' ? (uiLang === 'TR' ? 'Profesyonel' : 'Pro') :
                 subscription.plan === 'BASIC' ? (uiLang === 'TR' ? 'Temel' : 'Basic') :
                 subscription.plan === 'PROFESSIONAL' ? (uiLang === 'TR' ? 'Profesyonel' : 'Professional') :
                 subscription.plan === 'ENTERPRISE' ? t('dashboard.subscriptionPage.enterprisePlan') :
                 subscription.planName || t('dashboard.subscriptionPage.freePlan')}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {BASE_PLANS.map((plan) => {
            const planPricing = getPlanPricing(plan.id);
            // Legacy plan mapping: BASIC → STARTER, PROFESSIONAL → PRO
            const LEGACY_PLAN_MAP = { BASIC: 'STARTER', PROFESSIONAL: 'PRO' };
            const userPlanMapped = LEGACY_PLAN_MAP[subscription?.plan] || subscription?.plan;
            const isCurrentPlan = userPlanMapped === plan.id;
            // Only show "Popular" badge if user has no plan or is on FREE plan
            const showPopularBadge = plan.popular && !isCurrentPlan && (!subscription?.plan || subscription?.plan === 'FREE');

            // Plan order for upgrade/downgrade logic - YENİ PAKET YAPISI
            const PLAN_ORDER = { FREE: 0, STARTER: 1, BASIC: 1, PRO: 2, PROFESSIONAL: 2, ENTERPRISE: 3 };
            const currentPlanIndex = PLAN_ORDER[subscription?.plan] || 0;
            const thisPlanIndex = PLAN_ORDER[plan.id];
            const isUpgrade = thisPlanIndex > currentPlanIndex;
            const isDowngrade = thisPlanIndex < currentPlanIndex;

            // Button text based on plan comparison and UI language
            const getButtonText = () => {
              const texts = {
                TR: { contact: 'Bize Ulaşın', current: 'Mevcut Plan', upgrade: 'Yükselt', downgrade: 'Düşür', select: 'Seç' },
                EN: { contact: 'Contact Us', current: 'Current Plan', upgrade: 'Upgrade', downgrade: 'Downgrade', select: 'Select' }
              };
              const txt = texts[uiLang] || texts.EN;
              if (plan.id === 'ENTERPRISE') return txt.contact;
              if (isCurrentPlan) return txt.current;
              if (isUpgrade) return txt.upgrade;
              if (isDowngrade) return txt.downgrade;
              return txt.select;
            };

            // Feature order - YENİ PAKET YAPISI
            const FEATURE_ORDER = [
              'minutes', 'concurrent', 'assistants', 'phoneNumbers', 'phone', 'whatsapp', 'chatWidget',
              'ecommerce', 'calendar', 'analytics', 'email', 'googleSheets', 'batchCalls',
              'prioritySupport', 'apiAccess', 'slaGuarantee'
            ];

            // Feature labels - YENİ PAKET YAPISI
            const getFeatureLabel = (key) => {
              const isEnterprise = plan.id === 'ENTERPRISE';

              // UI language-based label maps
              const labelMaps = {
                TR: {
                  minutes: isEnterprise ? '800+ dk (özel)' : `${planPricing?.minutes || 0} dk görüşme`,
                  concurrent: isEnterprise ? '10+ eşzamanlı çağrı' : `${planPricing?.concurrent || 1} eşzamanlı çağrı`,
                  assistants: 'Sınırsız asistan',
                  phoneNumbers: 'Sınırsız telefon numarası',
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
                  minutes: isEnterprise ? '800+ min (custom)' : `${planPricing?.minutes || 0} min calls`,
                  concurrent: isEnterprise ? '10+ concurrent calls' : `${planPricing?.concurrent || 1} concurrent call${(planPricing?.concurrent || 1) > 1 ? 's' : ''}`,
                  assistants: 'Unlimited assistants',
                  phoneNumbers: 'Unlimited phone numbers',
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
                className={`bg-white dark:bg-neutral-900 rounded-xl border-2 p-6 shadow-sm relative flex flex-col ${
                  isCurrentPlan ? 'border-green-500 ring-2 ring-green-200 dark:ring-green-900' : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {/* Show "Current Plan" badge if this is the current plan */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 text-white">
                      {t('dashboard.subscriptionPage.currentPlan')}
                    </Badge>
                  </div>
                )}
                {/* Show "Popular" badge only if user has no plan */}
                {showPopularBadge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary-600 text-white">
                      {t('dashboard.subscriptionPage.popular')}
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                    {getPlanName(plan)}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1 h-[40px]">
                    {planPricing?.price !== null ? (
                      <>
                        <span className="text-3xl font-bold text-neutral-900 dark:text-white">
                          {formatPrice(planPricing.price)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">{t('dashboard.subscriptionPage.perMonth')}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                          {uiLang === 'TR' ? 'Özel' : uiLang === 'PR' ? 'Personalizado' : 'Custom'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="h-[20px] mt-2">
                    {planPricing?.overageRate ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t('dashboard.subscriptionPage.overage')}: {formatPrice(planPricing.overageRate)}{t('dashboard.subscriptionPage.perMinute')}
                      </p>
                    ) : plan.id === 'ENTERPRISE' ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {uiLang === 'TR' ? 'Özel fiyatlandırma' : uiLang === 'PR' ? 'Preço personalizado' : 'Custom pricing'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Features list - only shows included features, no gaps */}
                <ul className="space-y-2 mb-6 flex-grow">
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
                  <Button
                    className="w-full border-primary-600 text-primary-600 hover:bg-primary-50"
                    variant="outline"
                    onClick={() => window.location.href = '/contact'}
                  >
                    {getButtonText()}
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      isCurrentPlan
                        ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed border-neutral-200'
                        : isUpgrade
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white'
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

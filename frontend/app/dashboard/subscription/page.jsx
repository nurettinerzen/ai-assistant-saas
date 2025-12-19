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
import { Check, CreditCard, TrendingUp, X, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import CreditBalance from '@/components/CreditBalance';
import BuyCreditModal from '@/components/BuyCreditModal';

// Plan configurations - features will be loaded from translations
// Updated prices: Starter ₺899, Professional ₺2.599, Enterprise ₺6.799
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceUSD: 27,
    priceTRY: 899,
    featureKeys: ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6'],
    notIncludedKeys: [],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceUSD: 77,
    priceTRY: 2599,
    popular: true,
    featureKeys: ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6', 'feature7'],
    notIncludedKeys: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUSD: 199,
    priceTRY: 6799,
    featureKeys: ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6', 'feature7'],
    notIncludedKeys: [],
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
    }
    return 'US';
  });

  // Determine currency based on user's country or locale
  const isTurkishUser = userCountry === 'TR' || userCountry === 'Turkey' || locale === 'tr';
  const currencySymbol = isTurkishUser ? '₺' : '$';

  // Format currency based on user's country
  const formatPrice = (amount) => {
    if (isTurkishUser) {
      return `₺${amount.toLocaleString('tr-TR')}`;
    }
    return `$${amount.toLocaleString('en-US')}`;
  };

  // Get price based on user's country
  const getPlanPrice = (plan) => {
    return isTurkishUser ? plan.priceTRY : plan.priceUSD;
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
    const planName = t(`pricing.${planId}.name`);
    if (!confirm(`${t('dashboard.subscriptionPage.upgradeConfirm') || 'Planı yükseltmek istediğinize emin misiniz?'} ${planName}`)) return;

    try {
      setUpgrading(true);
      const response = await apiClient.subscription.upgrade(planId);

      // Check if iyzico checkout form is returned
      if (response.data?.checkoutFormContent) {
        setCheckoutFormHtml(response.data.checkoutFormContent);
        setShowPaymentModal(true);
      } else if (response.data?.sessionUrl) {
        // Stripe redirect
        window.location.href = response.data.sessionUrl;
      } else {
        toast.success(t('dashboard.subscriptionPage.upgradeSuccess') || 'Plan başarıyla yükseltildi!');
        loadData();
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error(error.response?.data?.error || t('dashboard.subscriptionPage.upgradeFailed') || 'Ödeme başlatılamadı');
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
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.subscriptionPage.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('dashboard.subscriptionPage.description')}</p>
      </div>

      {/* Current plan & usage */}
      {!loading && subscription && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current plan */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">{t('dashboard.subscriptionPage.currentPlan')}</h2>
              <Badge className="bg-primary-100 text-primary-800">
                {subscription.plan === 'FREE' ? t('dashboard.subscriptionPage.freePlan') :
                 subscription.plan === 'STARTER' ? 'Starter' :
                 subscription.plan === 'PROFESSIONAL' ? 'Professional' :
                 subscription.plan === 'ENTERPRISE' ? 'Enterprise' :
                 subscription.planName || t('dashboard.subscriptionPage.freePlan')}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('dashboard.subscriptionPage.monthlyCost')}</span>
                <span className="font-semibold text-neutral-900">
                  {(() => {
                    // Get price from PLANS based on subscription.plan
                    const currentPlan = PLANS.find(p => p.id.toUpperCase() === subscription.plan);
                    if (currentPlan) {
                      return formatPrice(isTurkishUser ? currentPlan.priceTRY : currentPlan.priceUSD);
                    }
                    // Fallback to subscription data or 0 for FREE plan
                    return formatPrice(subscription.price || (isTurkishUser ? (subscription.priceTRY || 0) : (subscription.priceUSD || 0)));
                  })()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('dashboard.subscriptionPage.billingCycle')}</span>
                <span className="font-medium text-neutral-900">
                  {subscription.billingCycle || t('dashboard.subscriptionPage.monthly')}
                </span>
              </div>
              {subscription.currentPeriodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('dashboard.subscriptionPage.nextBilling')}</span>
                <span className="font-medium text-neutral-900">
                  {formatDate(subscription.currentPeriodEnd || subscription.nextBillingDate, 'short')}
                </span>
              </div>
              )}
            </div>
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">{t('dashboard.subscriptionPage.availablePlans')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = subscription?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border-2 p-6 shadow-sm relative ${
                  plan.popular ? 'border-primary-600' : 'border-neutral-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary-600 text-white">{t('dashboard.subscriptionPage.mostPopular')}</Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">{t(`pricing.${plan.id}.name`)}</h3>
                  <p className="text-sm text-neutral-600 mb-3">{t(`pricing.${plan.id}.desc`)}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-neutral-900">
                      {currencySymbol}{getPlanPrice(plan).toLocaleString()}
                    </span>
                    <span className="text-neutral-500">{t('dashboard.subscriptionPage.perMonth')}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.featureKeys.map((featureKey, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-neutral-700">{t(`pricing.${plan.id}.${featureKey}`)}</span>
                    </li>
                  ))}
                  {plan.notIncludedKeys?.map((featureKey, i) => (
                    <li key={`not-${i}`} className="flex items-start gap-2 text-sm">
                      <X className="h-4 w-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                      <span className="text-neutral-400">{t(`pricing.${plan.id}.${featureKey}`)}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : 'default'}
                  disabled={isCurrentPlan || !can('billing:manage') || upgrading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {upgrading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('dashboard.subscriptionPage.processing') || 'İşleniyor...'}
                    </>
                  ) : isCurrentPlan ? (
                    t('dashboard.subscriptionPage.currentPlanBtn')
                  ) : (
                    t('dashboard.subscriptionPage.upgradeBtn')
                  )}
                </Button>
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

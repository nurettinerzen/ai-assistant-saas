/**
 * Subscription Page
 * View current plan, usage, and upgrade options
 * UPDATE EXISTING FILE: frontend/app/dashboard/subscription/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, CreditCard, TrendingUp, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { t, getCurrentLanguage } from '@/lib/translations';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    credits: 100,
    features: [
      '100 call credits/month',
      '1 AI assistant',
      '1 phone number',
      'Basic analytics',
      'Email support',
    ],
    notIncluded: ['Priority support', 'Custom voices', 'Advanced analytics'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    credits: 500,
    popular: true,
    features: [
      '500 call credits/month',
      'Unlimited assistants',
      '5 phone numbers',
      'Advanced analytics',
      'Priority support',
      'Custom voices',
    ],
    notIncluded: ['Dedicated account manager', 'SLA guarantee'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    credits: 2000,
    features: [
      '2000+ call credits/month',
      'Unlimited everything',
      'Advanced analytics',
      'Priority support',
      'Custom voices',
      'Dedicated account manager',
      '99.9% SLA guarantee',
      'Custom integrations',
    ],
    notIncluded: [],
  },
];

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState('en');
  const [subscription, setSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);

  useEffect(() => {
    setLocale(getCurrentLanguage());
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, billingRes] = await Promise.all([
        apiClient.subscription.getCurrent(),
        apiClient.subscription.getBillingHistory(),
      ]);
      setSubscription(subRes.data);
      setBillingHistory(billingRes.data.history || []);
    } catch (error) {
      toast.error(t('saveError', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    if (!confirm(`${t('upgradeConfirm', locale)} ${PLANS.find((p) => p.id === planId)?.name} ${t('planQuestion', locale)}`)) return;

    try {
      await toastHelpers.async(
        apiClient.subscription.upgrade(planId),
        t('processingUpgrade', locale),
        t('planUpgradedSuccess', locale)
      );
      loadData();
    } catch (error) {
      // Error handled
    }
  };

  const usagePercent = subscription
    ? (subscription.creditsUsed / subscription.creditsLimit) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('subscriptionTitle2', locale)}</h1>
        <p className="text-neutral-600 mt-1">{t('managePlanBilling', locale)}</p>
      </div>

      {/* Current plan & usage */}
      {!loading && subscription && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current plan */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">{t('currentPlanLabel', locale)}</h2>
              <Badge className="bg-primary-100 text-primary-800">
                {subscription.planName || t('freePlanLabel', locale)}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('monthlyCostLabel', locale)}</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(subscription.price || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('billingCycleLabel', locale)}</span>
                <span className="font-medium text-neutral-900">
                  {subscription.billingCycle || t('monthlyLabel', locale)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('nextBillingLabel', locale)}</span>
                <span className="font-medium text-neutral-900">
                  {formatDate(subscription.nextBillingDate, 'short')}
                </span>
              </div>
            </div>
          </div>

          {/* Usage */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-neutral-900">{t('creditUsageLabel', locale)}</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t('usedThisMonth', locale)}</span>
                <span className="font-semibold text-neutral-900">
                  {subscription.creditsUsed || 0} / {subscription.creditsLimit || 0} {t('creditsLabel', locale)}
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
              <p className="text-xs text-neutral-500">
                {usagePercent < 80
                  ? `${Math.round(100 - usagePercent)}% ${t('remaining', locale)}`
                  : usagePercent < 100
                  ? t('runningLowOnCredits', locale)
                  : t('limitReachedUpgrade', locale)}
              </p>
            </div>
            <Button className="w-full mt-4" variant="outline">
              {t('addCreditsBtn', locale)}
            </Button>
          </div>
        </div>
      )}

      {/* Pricing plans */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">{t('availablePlans', locale)}</h2>
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
                    <Badge className="bg-primary-600 text-white">{t('mostPopular', locale)}</Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-neutral-900">
                      ${plan.price}
                    </span>
                    <span className="text-neutral-500">{t('perMonthLabel2', locale)}</span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2">{plan.credits} {t('creditsIncluded', locale)}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-neutral-700">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, i) => (
                    <li key={`not-${i}`} className="flex items-start gap-2 text-sm">
                      <X className="h-4 w-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                      <span className="text-neutral-400">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : 'default'}
                  disabled={isCurrentPlan}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isCurrentPlan ? t('currentPlanBtn', locale) : t('upgradeBtn', locale)}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing history */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900">{t('billingHistoryTitle', locale)}</h2>
          </div>
        </div>

        {billingHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    {t('dateHeader', locale)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    {t('descriptionHeader', locale)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    {t('amountHeader', locale)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    {t('statusHeader', locale)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    {t('invoiceHeader', locale)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {billingHistory.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      {formatDate(invoice.date, 'short')}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {invoice.description}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        {t(invoice.status === 'paid' ? 'paidStatus' : 'pendingStatus', locale)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="link" size="sm" className="p-0 h-auto">
                        {t('downloadBtn', locale)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-neutral-500">
            {t('noBillingHistory', locale)}
          </div>
        )}
      </div>
    </div>
  );
}

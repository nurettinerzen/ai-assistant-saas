/**
 * Phone Numbers Page
 * Manage provisioned phone numbers
 * 🔧 BUG FIX 5: Plan bazlı erişim kontrolü
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import PhoneNumberModal from '@/components/PhoneNumberModal';
import { Phone, Plus, Trash2, TestTube2, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { formatPhone, formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

// Plan limitleri
const PLAN_LIMITS = {
  FREE: { phoneNumbers: 0 },
  BASIC: { phoneNumbers: 1 },
  PROFESSIONAL: { phoneNumbers: 3 },
  ENTERPRISE: { phoneNumbers: -1 } // unlimited
};

export default function PhoneNumbersPage() {
  const { t } = useLanguage();
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadPhoneNumbers();
  }, []);

  // 🔧 Load subscription to check plan
  const loadSubscription = async () => {
    try {
      const response = await apiClient.subscription.get();
      const sub = response.data.subscription;
      setSubscription(sub);
      
      // Check if FREE plan
      if (sub?.plan === 'FREE') {
        setIsLocked(true);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const loadPhoneNumbers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.getAll();
      setPhoneNumbers(response.data.phoneNumbers || []);
    } catch (error) {
      toast.error(t('dashboard.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleTestCall = async (phoneNumber) => {
    try {
      await toastHelpers.async(
        apiClient.phoneNumbers.test(phoneNumber.id),
        t('dashboard.initiatingTestCall'),
        t('dashboard.testCallStarted')
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleRelease = async (phoneNumber) => {
    if (
      !confirm(
        `${t('dashboard.releaseNumberConfirm')} ${formatPhone(phoneNumber.phoneNumber)}${t('dashboard.numberWillReturn')}`
      )
    )
      return;

    try {
      await toastHelpers.async(
        apiClient.phoneNumbers.release(phoneNumber.id),
        t('dashboard.releasingNumber'),
        t('dashboard.phoneNumberReleased')
      );
      loadPhoneNumbers();
    } catch (error) {
      // Error handled
    }
  };

  // 🔧 Check if user can add more numbers
  const canAddNumber = () => {
    if (!subscription) return false;
    const limit = PLAN_LIMITS[subscription.plan]?.phoneNumbers || 0;
    if (limit === -1) return true; // unlimited
    return phoneNumbers.length < limit;
  };

  // 🔧 Locked view for FREE plan
  if (isLocked) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.phoneNumbersTitle2')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.managePhoneNumbers')}</p>
        </div>

        {/* Locked State */}
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-100 rounded-full mb-6">
            <Lock className="h-10 w-10 text-neutral-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3">
            {t('dashboard.upgradeToGetPhone') || 'Planınızı Yükseltin'}
          </h2>
          <p className="text-neutral-600 mb-6 max-w-md mx-auto">
            {t('dashboard.phoneNumbersLockedDesc') || 'Telefon numarası özelliği BASIC ve üzeri planlarda mevcuttur. Gerçek aramalar almaya başlamak için planınızı yükseltin.'}
          </p>
          <Link href="/dashboard/subscription">
            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500">
              {t('dashboard.upgrade')} →
            </Button>
          </Link>
        </div>

        {/* Plan comparison */}
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-primary-900 mb-3">
            {t('dashboard.planFeatures') || 'Plan Özellikleri'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 mb-2">{t('dashboard.basicPlan')}</div>
              <div className="text-neutral-600">1 {t('dashboard.phoneNumber')}</div>
              <div className="text-xs text-neutral-500 mt-1">$29/ay</div>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-primary-300">
              <div className="font-semibold text-primary-700 mb-2">
                {t('dashboard.professionalPlan')} ⭐
              </div>
              <div className="text-neutral-600">3 {t('dashboard.phoneNumber')}</div>
              <div className="text-xs text-neutral-500 mt-1">$99/ay</div>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 mb-2">{t('dashboard.enterprisePlan')}</div>
              <div className="text-neutral-600">{t('dashboard.unlimited') || 'Sınırsız'}</div>
              <div className="text-xs text-neutral-500 mt-1">{t('dashboard.contactSales')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.phoneNumbersTitle2')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.managePhoneNumbers')}</p>
          {/* 🔧 Plan limit indicator */}
          {subscription && (
            <p className="text-sm text-primary-600 mt-2">
              {phoneNumbers.length}/{PLAN_LIMITS[subscription.plan]?.phoneNumbers === -1 ? '∞' : PLAN_LIMITS[subscription.plan]?.phoneNumbers} {t('dashboard.phoneNumbersUsed') || 'numara kullanılıyor'}
            </p>
          )}
        </div>
        <Button 
          onClick={() => setShowProvisionModal(true)}
          disabled={!canAddNumber()}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.getPhoneNumberBtn')}
        </Button>
      </div>

      {/* Limit warning */}
      {!canAddNumber() && phoneNumbers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ {t('dashboard.phoneLimitReached') || 'Telefon numarası limitinize ulaştınız. Daha fazla numara eklemek için planınızı yükseltin.'}
            <Link href="/dashboard/subscription" className="ml-2 underline font-medium">
              {t('dashboard.upgrade')}
            </Link>
          </p>
        </div>
      )}

      {/* Phone numbers grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse"
            >
              <div className="h-8 w-48 bg-neutral-200 rounded mb-4"></div>
              <div className="h-4 w-32 bg-neutral-200 rounded mb-2"></div>
              <div className="h-10 w-full bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : phoneNumbers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phoneNumbers.map((number) => (
            <div
              key={number.id}
              className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Phone className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-mono font-bold text-neutral-900">
                      {formatPhone(number.phoneNumber)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('dashboard.provisionedLabel')} {formatDate(number.createdAt, 'short')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{t('dashboard.assistantColonLabel')}</span>
                  <span className="font-medium text-neutral-900">
                    {number.assistantName || t('dashboard.notAssignedLabel')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{t('dashboard.statusColonLabel')}</span>
                  <Badge className="bg-green-100 text-green-800">{t('dashboard.activeLabel')}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{t('dashboard.monthlyCostColonLabel')}</span>
                  <span className="font-medium text-neutral-900">$1.00</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTestCall(number)}
                >
                  <TestTube2 className="h-3 w-3 mr-2" />
                  {t('dashboard.testBtn')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRelease(number)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <EmptyState
            icon={Phone}
            title={t('dashboard.noPhoneNumbersTitle')}
            description={t('dashboard.getNumberToStartDesc')}
            actionLabel={t('dashboard.getPhoneNumberBtn')}
            onAction={() => setShowProvisionModal(true)}
          />
        </div>
      )}

      {/* Info banner */}
      {phoneNumbers.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-primary-900 mb-2">{t('dashboard.billingInformationTitle')}</h3>
          <p className="text-sm text-primary-700">
            {t('dashboard.phoneNumberBillingDesc')}
          </p>
        </div>
      )}

      {/* Provision modal */}
      <PhoneNumberModal
        isOpen={showProvisionModal}
        onClose={() => setShowProvisionModal(false)}
        onSuccess={() => {
          setShowProvisionModal(false);
          loadPhoneNumbers();
        }}
      />
    </div>
  );
}

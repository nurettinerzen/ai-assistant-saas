/**
 * Phone Numbers Page
 * Manage provisioned phone numbers
 * 🔧 BUG FIX 5: Plan bazlı erişim kontrolü
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import PhoneNumberModal from '@/components/PhoneNumberModal';
import { Phone, Plus, Trash2, Lock, Bot, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { formatPhone, formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

// Plan limitleri - Backend plan isimlerine uygun
// NOT: FREE ve TRIAL planlarında 1 telefon numarası + 15 dk deneme hakkı var
const PLAN_LIMITS = {
  FREE: { phoneNumbers: 1, trialMinutes: 15 },
  TRIAL: { phoneNumbers: 1, trialMinutes: 15 },
  PAYG: { phoneNumbers: 1 },
  STARTER: { phoneNumbers: 1 },
  PRO: { phoneNumbers: 3 },
  ENTERPRISE: { phoneNumbers: 10 }
};

export default function PhoneNumbersPage() {
  const { t } = useLanguage();
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingPhoneId, setUpdatingPhoneId] = useState(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Prevent multiple API calls in strict mode
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load subscription - API returns subscription directly, not wrapped
        const subResponse = await apiClient.subscription.getCurrent();
        const sub = subResponse.data;
        console.log('Phone page - subscription:', sub);
        setSubscription(sub);
        // FREE ve TRIAL planları artık deneme hakkı ile erişebilir
        // Sadece deneme süresi/dakikası bitmişse kilitle
        const plan = sub?.plan || 'FREE';
        const trialMinutesUsed = sub?.trialMinutesUsed || 0;
        const trialChatExpiry = sub?.trialChatExpiry ? new Date(sub.trialChatExpiry) : null;
        const now = new Date();

        // Trial bitmiş mi kontrol et
        const trialExpired = (plan === 'FREE' || plan === 'TRIAL') && (
          trialMinutesUsed >= 15 ||
          (trialChatExpiry && trialChatExpiry < now)
        );

        if (trialExpired) {
          setIsLocked(true);
        }

        // Load phone numbers and assistants in parallel
        const [phoneResponse, assistantsResponse] = await Promise.all([
          apiClient.phoneNumbers.getAll(),
          apiClient.assistants.getAll()
        ]);
        setPhoneNumbers(phoneResponse.data.phoneNumbers || []);
        // Filter to only INBOUND active assistants
        // Phone numbers should only be assigned to inbound assistants
        // Outbound assistants (outbound, outbound_sales, outbound_collection) are selected in batch call campaigns
        const allAssistants = assistantsResponse.data.assistants || [];
        setAssistants(allAssistants.filter(a => a.isActive && !a.callDirection?.startsWith('outbound')));
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error(t('dashboard.phoneNumbersPage.failedToLoad') || 'Telefon numaraları yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadPhoneNumbers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.getAll();
      setPhoneNumbers(response.data.phoneNumbers || []);
    } catch (error) {
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssistantChange = async (phoneNumberId, newAssistantId) => {
    if (!newAssistantId) return;

    setUpdatingPhoneId(phoneNumberId);
    try {
      await apiClient.phoneNumbers.updateAssistant(phoneNumberId, newAssistantId);
      toast.success(t('dashboard.phoneNumbersPage.assistantUpdated') || 'Assistant updated successfully');

      // Update local state
      setPhoneNumbers(prev => prev.map(p => {
        if (p.id === phoneNumberId) {
          const assistant = assistants.find(a => a.id === newAssistantId);
          return { ...p, assistantId: newAssistantId, assistantName: assistant?.name };
        }
        return p;
      }));
    } catch (error) {
      console.error('Failed to update assistant:', error);
      toast.error(error.response?.data?.error || t('dashboard.phoneNumbersPage.failedToUpdateAssistant') || 'Asistan güncellenemedi');
    } finally {
      setUpdatingPhoneId(null);
    }
  };

  const handleRelease = async (phoneNumber) => {
    if (
      !confirm(
        `${t('dashboard.phoneNumbersPage.releaseConfirm')} ${formatPhone(phoneNumber.phoneNumber)}?`
      )
    )
      return;

    try {
      await toastHelpers.async(
        apiClient.phoneNumbers.delete(phoneNumber.id),
        t('dashboard.phoneNumbersPage.releasingNumber'),
        t('dashboard.phoneNumbersPage.phoneNumberReleased')
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

  // 🔧 Locked view - Trial expired
  if (isLocked) {
    // Deneme süresi/dakikası bitti
    const trialMinutesUsed = subscription?.trialMinutesUsed || 0;
    const minutesExpired = trialMinutesUsed >= 15;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.phoneNumbersPage.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.phoneNumbersPage.description')}</p>
        </div>

        {/* Trial Expired State */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-6">
            <Lock className="h-10 w-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            {minutesExpired ? 'Deneme Dakikalarınız Bitti' : 'Deneme Süreniz Bitti'}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            {minutesExpired
              ? `15 dakikalık ücretsiz deneme hakkınızı kullandınız (${trialMinutesUsed.toFixed(1)} dk).`
              : '7 günlük ücretsiz deneme süreniz sona erdi.'}
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
            Telefon AI özelliğini kullanmaya devam etmek için bakiye yükleyin veya bir plan seçin.
          </p>
          <Link href="/dashboard/subscription">
            <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-500">
              Plan Seç veya Bakiye Yükle →
            </Button>
          </Link>
        </div>

        {/* Plan comparison - Minute limits */}
        <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-3">
            {t('dashboard.phoneNumbersPage.planFeatures')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 dark:text-white mb-2">Kullandıkça Öde</div>
              <div className="text-neutral-600 dark:text-neutral-400">23 ₺/dk</div>
              <div className="text-xs text-neutral-500 mt-1">Bakiye yükle, taahhütsüz</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 dark:text-white mb-2">Başlangıç</div>
              <div className="text-neutral-600 dark:text-neutral-400">150 dk dahil</div>
              <div className="text-xs text-neutral-500 mt-1">2.499 ₺/ay + 23 ₺ aşım</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 dark:text-white mb-2">Pro</div>
              <div className="text-neutral-600 dark:text-neutral-400">500 dk dahil</div>
              <div className="text-xs text-neutral-500 mt-1">7.499 ₺/ay + 23 ₺ aşım</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg">
              <div className="font-semibold text-neutral-900 dark:text-white mb-2">Kurumsal</div>
              <div className="text-neutral-600 dark:text-neutral-400">500+ dk (özel)</div>
              <div className="text-xs text-neutral-500 mt-1">{t('solutions.contactSales')}</div>
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
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.phoneNumbersPage.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.phoneNumbersPage.description')}</p>
          {/* 🔧 Plan limit indicator */}
          {subscription && (
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
              {phoneNumbers.length}/{PLAN_LIMITS[subscription.plan]?.phoneNumbers === -1 ? '∞' : PLAN_LIMITS[subscription.plan]?.phoneNumbers} {t('dashboard.phoneNumbersPage.numbersUsed')}
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowProvisionModal(true)}
          disabled={!canAddNumber()}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.phoneNumbersPage.getPhoneNumber')}
        </Button>
      </div>

      {/* Trial info banner for FREE/TRIAL plans */}
      {(subscription?.plan === 'FREE' || subscription?.plan === 'TRIAL') && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                🎁 Ücretsiz Deneme Hakkınız
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {15 - (subscription?.trialMinutesUsed || 0) > 0
                  ? `${(15 - (subscription?.trialMinutesUsed || 0)).toFixed(1)} dakika kaldı`
                  : 'Dakikalarınız bitti'
                }
                {subscription?.trialChatExpiry && (
                  <span className="ml-2">
                    • {new Date(subscription.trialChatExpiry) > new Date()
                      ? `${Math.ceil((new Date(subscription.trialChatExpiry) - new Date()) / (1000 * 60 * 60 * 24))} gün kaldı`
                      : 'Süre doldu'
                    }
                  </span>
                )}
              </p>
            </div>
            <Link href="/dashboard/subscription">
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                Plan Yükselt
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Limit warning */}
      {!canAddNumber() && phoneNumbers.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ {t('dashboard.phoneNumbersPage.phoneLimitReached')}
            <Link href="/dashboard/subscription" className="ml-2 underline font-medium">
              {t('dashboard.subscriptionPage.upgrade')}
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
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 animate-pulse"
            >
              <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-700 rounded mb-4"></div>
              <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
              <div className="h-10 w-full bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : phoneNumbers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phoneNumbers.map((number) => (
            <div
              key={number.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                    <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-mono font-bold text-neutral-900 dark:text-white">
                      {formatPhone(number.phoneNumber)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('dashboard.phoneNumbersPage.provisioned')} {formatDate(number.createdAt, 'short')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {/* Assistant Selector */}
                <div>
                  <label className="text-sm text-neutral-600 dark:text-neutral-400 mb-1 block">
                    {t('dashboard.phoneNumbersPage.assistant')}
                  </label>
                  <div className="relative">
                    {(() => {
                      // Check if assigned assistant still exists in the list
                      const assignedAssistantExists = number.assistantId && assistants.some(a => a.id === number.assistantId);
                      const displayValue = assignedAssistantExists ? number.assistantId : '';
                      const displayName = assignedAssistantExists
                        ? number.assistantName
                        : t('dashboard.phoneNumbersPage.notAssigned') || 'Not assigned';

                      return (
                        <Select
                          value={displayValue}
                          onValueChange={(value) => handleAssistantChange(number.id, value)}
                          disabled={updatingPhoneId === number.id || assistants.length === 0}
                        >
                          <SelectTrigger className="w-full">
                            {updatingPhoneId === number.id ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{t('common.updating') || 'Updating...'}</span>
                              </div>
                            ) : (
                              <SelectValue placeholder={t('dashboard.phoneNumbersPage.selectAssistant') || 'Select assistant'}>
                                <div className="flex items-center gap-2">
                                  <Bot className={`h-4 w-4 ${assignedAssistantExists ? 'text-primary-500' : 'text-neutral-400'}`} />
                                  <span className={!assignedAssistantExists ? 'text-neutral-400' : ''}>
                                    {displayName}
                                  </span>
                                </div>
                              </SelectValue>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {assistants.map((assistant) => (
                              <SelectItem key={assistant.id} value={assistant.id}>
                                <div className="flex items-center gap-2">
                                  <Bot className="h-4 w-4" />
                                  <span>{assistant.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                            {assistants.length === 0 && (
                              <div className="px-2 py-1 text-sm text-neutral-500">
                                {t('dashboard.phoneNumbersPage.noAssistants') || 'No assistants available'}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                </div>
                {/* Status */}
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{t('dashboard.phoneNumbersPage.status')}</span>
                  <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">{t('dashboard.phoneNumbersPage.active')}</Badge>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRelease(number)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  {t('common.delete') || 'Sil'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8">
          <EmptyState
            icon={Phone}
            title={t('dashboard.phoneNumbersPage.noPhoneNumbersYet')}
            description={t('dashboard.phoneNumbersPage.getNumberToStart')}
            actionLabel={t('dashboard.phoneNumbersPage.getPhoneNumber')}
            onAction={() => setShowProvisionModal(true)}
          />
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

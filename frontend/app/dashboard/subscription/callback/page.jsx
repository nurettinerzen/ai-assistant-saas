'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SubscriptionCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const statusParam = searchParams.get('status');

    if (statusParam === 'success') {
      setStatus('success');
      toast.success(t('dashboard.subscriptionPage.upgradeSuccess'));
    } else if (statusParam === 'error') {
      setStatus('error');
      const message = searchParams.get('message');
      toast.error(message || t('dashboard.subscriptionPage.upgradeFailed'));
    } else {
      // No explicit state in the URL; keep a short processing state before redirect.
      setStatus('processing');
    }

    // Redirect to subscription page after delay
    const timer = setTimeout(() => {
      router.push('/dashboard/subscription');
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams, router, t]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              {t('dashboard.subscriptionPage.paymentSuccess')}
            </h1>
            <p className="mb-4 text-neutral-600 dark:text-neutral-300">
              {t('dashboard.subscriptionPage.subscriptionActivated')}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('dashboard.subscriptionPage.redirecting')}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              {t('dashboard.subscriptionPage.paymentFailed')}
            </h1>
            <p className="mb-4 text-neutral-600 dark:text-neutral-300">
              {t('dashboard.subscriptionPage.paymentFailedDesc')}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('dashboard.subscriptionPage.redirecting')}
            </p>
          </>
        )}

        {(status === 'loading' || status === 'processing') && (
          <>
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              {t('dashboard.subscriptionPage.processingPayment')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-300">
              {t('dashboard.subscriptionPage.pleaseWait')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

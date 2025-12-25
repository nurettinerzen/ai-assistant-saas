'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Plus,
  Phone,
  Zap
} from 'lucide-react';

// UI translations for CreditBalance - Only Turkish for now
// See docs/MULTI_REGION_ARCHITECTURE.md for adding new languages
const TRANSLATIONS = {
  TR: {
    usageStatus: 'Kullanım Durumu',
    minutesRemaining: 'dk kaldı',
    packageMinutes: 'Paket Dakikaları',
    creditMinutes: 'Kredi Dakikaları',
    used80Package: "Paket dakikalarınızın %80'ini kullandınız",
    usedAllPackage: 'Paket dakikalarınız tükendi',
    noCredits: 'Henüz kredi satın almadınız',
    used80Credits: "Kredi dakikalarınızın %80'ini kullandınız",
    overageThisMonth: 'Bu Ay Aşım',
    overageLimit: 'Aşım limit:',
    overageNote: '(Ay sonunda kartınızdan çekilecektir)',
    overageLimitReached: 'Aşım Limitine Ulaşıldı!',
    overageLimitNote: 'Telefon aramaları devre dışı bırakıldı. Kredi satın alarak aramaya devam edebilirsiniz.',
    periodEnd: 'Dönem sonu:',
    buyCredits: 'Kredi Al',
    retry: 'Tekrar Dene',
    loadError: 'Bakiye yüklenemedi',
    min: 'dk'
  }
};

// Map locale to translation key
const LOCALE_TO_LANG = { tr: 'TR' };

/**
 * CreditBalance Component
 * Displays package minutes, credit minutes, and overage usage
 */
export default function CreditBalance({ onBuyCredit, refreshTrigger }) {
  const { t, locale } = useLanguage();
  const lang = LOCALE_TO_LANG[locale] || 'TR';
  const txt = TRANSLATIONS[lang] || TRANSLATIONS.TR;
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBalance();
  }, [refreshTrigger]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/credits/balance');
      setBalance(response.data);
    } catch (err) {
      console.error('Balance fetch error:', err);
      setError(err.response?.data?.error || 'load_error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-neutral-200 rounded w-1/3"></div>
          <div className="h-3 bg-neutral-200 rounded"></div>
          <div className="h-3 bg-neutral-200 rounded"></div>
          <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="text-center text-neutral-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p>{error === 'load_error' ? txt.loadError : error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalance}
            className="mt-2"
          >
            {txt.retry}
          </Button>
        </div>
      </div>
    );
  }

  if (!balance) return null;

  const packagePercent = balance.package.limit > 0
    ? Math.min((balance.package.used / balance.package.limit) * 100, 100)
    : 0;

  const creditPercent = balance.credit.total > 0
    ? Math.min((balance.credit.used / balance.credit.total) * 100, 100)
    : 0;

  const totalRemaining = balance.package.remaining + balance.credit.remaining;

  // Date locale mapping
  const dateLocale = lang === 'TR' ? 'tr-TR' : lang === 'PR' ? 'pt-BR' : 'en-US';

  // Currency symbol based on region (this comes from balance API or could be passed as prop)
  const currencySymbol = lang === 'TR' ? '₺' : lang === 'PR' ? 'R$' : '$';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-neutral-900">
            {txt.usageStatus}
          </h3>
        </div>
        <Badge variant={balance.overage.limitReached ? 'destructive' : 'secondary'}>
          {totalRemaining} {txt.minutesRemaining}
        </Badge>
      </div>

      {/* Package Minutes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-neutral-700">{txt.packageMinutes}</span>
          </div>
          <span className="text-neutral-600">
            {balance.package.used}/{balance.package.limit} {txt.min}
          </span>
        </div>
        <Progress
          value={packagePercent}
          className={`h-2 ${packagePercent >= 80 ? '[&>div]:bg-orange-500' : '[&>div]:bg-blue-600'}`}
        />
        {packagePercent >= 80 && packagePercent < 100 && (
          <p className="text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {txt.used80Package}
          </p>
        )}
        {packagePercent >= 100 && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {txt.usedAllPackage}
          </p>
        )}
      </div>

      {/* Credit Minutes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" />
            <span className="font-medium text-neutral-700">{txt.creditMinutes}</span>
          </div>
          <span className="text-neutral-600">
            {balance.credit.remaining} {txt.minutesRemaining}
          </span>
        </div>
        {balance.credit.total > 0 ? (
          <Progress
            value={creditPercent}
            className={`h-2 ${creditPercent >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
          />
        ) : (
          <div className="h-2 bg-neutral-100 rounded-full">
            <div className="h-full bg-neutral-200 rounded-full w-0"></div>
          </div>
        )}
        {balance.credit.total === 0 && (
          <p className="text-xs text-neutral-500">
            {txt.noCredits}
          </p>
        )}
        {creditPercent >= 80 && balance.credit.total > 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {txt.used80Credits}
          </p>
        )}
      </div>

      {/* Overage Status */}
      {balance.overage.minutes > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-red-700 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {txt.overageThisMonth}
            </span>
            <span className="text-red-700 font-semibold">
              {balance.overage.minutes} {txt.min} × {currencySymbol}{balance.overage.rate} = {currencySymbol}{balance.overage.amount.toLocaleString(dateLocale)}
            </span>
          </div>
          <p className="text-xs text-red-600">
            {txt.overageLimit} {balance.overage.limit} {txt.min} {txt.overageNote}
          </p>
        </div>
      )}

      {/* Overage Limit Warning */}
      {balance.overage.limitReached && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">
                {txt.overageLimitReached}
              </p>
              <p className="text-sm text-red-700 mt-1">
                {txt.overageLimitNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Period Info */}
      {balance.periodEnd && (
        <div className="text-xs text-neutral-500 flex items-center justify-between pt-2 border-t border-neutral-100">
          <span>{txt.periodEnd}</span>
          <span>{new Date(balance.periodEnd).toLocaleDateString(dateLocale)}</span>
        </div>
      )}

      {/* Buy Credits Button */}
      <Button
        onClick={onBuyCredit}
        className="w-full bg-primary-600 hover:bg-primary-700"
      >
        <Plus className="h-4 w-4 mr-2" />
        {txt.buyCredits}
      </Button>
    </div>
  );
}

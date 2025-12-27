'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X,
  Loader2,
  CreditCard,
  Info,
  Check,
  Zap
} from 'lucide-react';

// UI translations - Only Turkish for now
// See docs/MULTI_REGION_ARCHITECTURE.md for adding new languages
const TRANSLATIONS = {
  TR: {
    title: 'Ekstra Kredi Al',
    howManyMinutes: 'Kaç dakika almak istiyorsunuz?',
    enterMinutes: 'Dakika girin',
    min: 'dk',
    pricing: 'Fiyatlandırma',
    unitPrice: 'Birim fiyat:',
    total: 'Toplam:',
    creditInfo: 'Krediler aylık sıfırlanmaz. Paket dakikalarınız bittikten sonra otomatik olarak kredi dakikalarından düşer.',
    cancel: 'İptal',
    processing: 'İşleniyor...',
    purchase: 'Satın Al',
    invalidMinutes: 'Geçersiz dakika miktarı',
    creditsAdded: 'dakika krediniz eklendi!',
    purchaseFailed: 'Satın alma başarısız',
    requiresCard: 'Kredi satın almak için önce bir kart kaydetmeniz gerekiyor.',
    perMin: '/dk',
    flatPrice: 'Sabit fiyat'
  }
};

const LOCALE_TO_LANG = { tr: 'TR' };

/**
 * BuyCreditModal Component
 * Modal for purchasing additional credit minutes
 */
export default function BuyCreditModal({ isOpen, onClose, onSuccess }) {
  const { t, locale } = useLanguage();
  const lang = LOCALE_TO_LANG[locale] || 'TR';
  const txt = TRANSLATIONS[lang] || TRANSLATIONS.TR;

  // Only Turkish Lira for now
  const currency = '₺';
  const dateLocale = 'tr-TR';
  const [minutes, setMinutes] = useState(100);
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Quick select options
  const quickOptions = [
    { minutes: 50, label: `50 ${txt.min}` },
    { minutes: 100, label: `100 ${txt.min}` },
    { minutes: 250, label: `250 ${txt.min}` },
    { minutes: 500, label: `500 ${txt.min}` }
  ];

  // Calculate price when minutes change
  useEffect(() => {
    if (isOpen && minutes > 0) {
      const timer = setTimeout(() => {
        calculatePrice(minutes);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [minutes, isOpen]);

  const calculatePrice = async (mins) => {
    if (mins < 1) {
      setCalculation(null);
      return;
    }

    try {
      setCalculating(true);
      const response = await apiClient.post('/api/credits/calculate', { minutes: mins });
      setCalculation(response.data);
    } catch (error) {
      console.error('Calculate error:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleMinutesChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setMinutes(value);
  };

  const handleQuickSelect = (mins) => {
    setMinutes(mins);
  };

  const handlePurchase = async () => {
    if (minutes < 1) {
      toast.error(txt.invalidMinutes);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/credits/purchase', { minutes });

      toast.success(response.data.message || `${minutes} ${txt.creditsAdded}`);
      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.error || txt.purchaseFailed;

      if (error.response?.data?.requiresCard) {
        toast.error(txt.requiresCard);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Tek fiyat: 7₺/dk
  const flatUnitPrice = 7;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900">
              {txt.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors p-1 rounded-lg hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Minutes Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {txt.howManyMinutes}
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={minutes}
                onChange={handleMinutesChange}
                min="1"
                className="text-lg font-medium"
                placeholder={txt.enterMinutes}
              />
              <span className="text-neutral-500 font-medium">{txt.min}</span>
            </div>
          </div>

          {/* Quick Select */}
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((option) => (
              <button
                key={option.minutes}
                onClick={() => handleQuickSelect(option.minutes)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  minutes === option.minutes
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Pricing - Tek fiyat */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">{txt.flatPrice}</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {currency}{flatUnitPrice}{txt.perMin}
              </span>
            </div>
          </div>

          {/* Calculation Result */}
          {calculation && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-neutral-600">
                <span>{txt.unitPrice}</span>
                <span className="font-medium">{currency}{calculation.unitPrice}{txt.perMin}</span>
              </div>
              <hr className="border-primary-200" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-neutral-900">{txt.total}</span>
                <span className="text-xl font-bold text-primary-700">
                  {calculating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    `${currency}${calculation.totalAmount.toLocaleString(dateLocale)}`
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="flex items-start gap-2 text-xs text-neutral-500 bg-blue-50 rounded-lg p-3">
            <Check className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p>{txt.creditInfo}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              {txt.cancel}
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={loading || minutes < 1 || !calculation}
              className="flex-1 bg-primary-600 hover:bg-primary-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {txt.processing}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {txt.purchase}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

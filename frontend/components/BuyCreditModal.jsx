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

/**
 * BuyCreditModal Component
 * Modal for purchasing additional credit minutes
 */
export default function BuyCreditModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [minutes, setMinutes] = useState(100);
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Quick select options
  const quickOptions = [
    { minutes: 50, label: '50 dk' },
    { minutes: 100, label: '100 dk' },
    { minutes: 250, label: '250 dk' },
    { minutes: 500, label: '500 dk' }
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
      toast.error('Geçersiz dakika miktarı');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/credits/purchase', { minutes });

      toast.success(response.data.message || `${minutes} dakika krediniz eklendi!`);
      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Satın alma başarısız';

      if (error.response?.data?.requiresCard) {
        toast.error('Kredi satın almak için önce bir kart kaydetmeniz gerekiyor.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900">
              Ekstra Kredi Al
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
              Kaç dakika almak istiyorsunuz?
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={minutes}
                onChange={handleMinutesChange}
                min="1"
                className="text-lg font-medium"
                placeholder="Dakika girin"
              />
              <span className="text-neutral-500 font-medium">dk</span>
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

          {/* Pricing Table */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">Fiyatlandırma</span>
            </div>
            <div className="space-y-1 text-sm text-neutral-600">
              <div className="flex justify-between">
                <span>1-49 dk</span>
                <span className="font-medium">₺9/dk</span>
              </div>
              <div className="flex justify-between">
                <span>50-99 dk</span>
                <span className="font-medium">₺8.50/dk</span>
              </div>
              <div className="flex justify-between">
                <span>100-249 dk</span>
                <span className="font-medium">₺8/dk</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>250+ dk</span>
                <span className="font-semibold">₺7.50/dk</span>
              </div>
            </div>
          </div>

          {/* Calculation Result */}
          {calculation && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Birim fiyat:</span>
                <span className="font-medium">₺{calculation.unitPrice}/dk</span>
              </div>
              <hr className="border-primary-200" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-neutral-900">Toplam:</span>
                <span className="text-xl font-bold text-primary-700">
                  {calculating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    `₺${calculation.totalAmount.toLocaleString('tr-TR')}`
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="flex items-start gap-2 text-xs text-neutral-500 bg-blue-50 rounded-lg p-3">
            <Check className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p>
              Krediler süresiz geçerlidir ve aylık sıfırlanmaz.
              Paket dakikalarınız bittikten sonra otomatik olarak kredi dakikalarından düşer.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              İptal
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={loading || minutes < 1 || !calculation}
              className="flex-1 bg-primary-600 hover:bg-primary-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Satın Al
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

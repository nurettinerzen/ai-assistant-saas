/**
 * PhoneNumberModal Component with Auto-Provision
 * Simplified 1-click provisioning based on country
 * Updated: Turkish translations, NetGSM redirect, no VAPI references
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Check, Loader2, ExternalLink, Zap, CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PhoneNumberModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countries, setCountries] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [businessCountry, setBusinessCountry] = useState('TR');

  useEffect(() => {
    if (isOpen) {
      loadCountries();
      loadAssistants();
    }
  }, [isOpen]);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const response = await apiClient.phoneNumbers.getCountries();
      const countryList = response.data.countries || [];
      setCountries(countryList);
      setBusinessCountry(response.data.businessCountry || 'TR');

      // Auto-select first country (should be filtered by backend)
      if (countryList.length > 0) {
        setSelectedCountry(countryList[0]);
      }
    } catch (error) {
      console.error('Failed to load countries:', error);
      toast.error(t('dashboard.phoneNumbersPage.modal.failedToLoadCountries'));
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadAssistants = async () => {
    try {
      const response = await apiClient.assistants.getAll();
      const assistantList = response.data.assistants || [];
      setAssistants(assistantList.filter(a => a.isActive));

      // Auto-select first assistant if available
      if (assistantList.length > 0) {
        setSelectedAssistant(assistantList[0].id);
      }
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  };

  const handleProvision = async () => {
    if (!selectedCountry) {
      toast.error(t('dashboard.phoneNumbersPage.modal.pleaseSelectCountry'));
      return;
    }

    // Handle NetGSM redirect for Turkey
    if (selectedCountry.requiresRedirect && selectedCountry.redirectUrl) {
      window.open(selectedCountry.redirectUrl, '_blank');
      toast.info(t('dashboard.phoneNumbersPage.modal.redirectingToNetgsm'));
      return;
    }

    // Handle US numbers (requires payment setup)
    if (selectedCountry.requiresPayment) {
      toast.info(t('dashboard.phoneNumbersPage.modal.paymentRequired'));
      // TODO: Redirect to payment page or show payment modal
      return;
    }

    if (!selectedAssistant && assistants.length > 0) {
      toast.error(t('dashboard.phoneNumbersPage.modal.pleaseSelectAssistant'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.provision({
        countryCode: selectedCountry.code,
        assistantId: selectedAssistant || undefined
      });

      toast.success(`${t('dashboard.phoneNumbersPage.modal.numberProvisioned')} ${response.data.phoneNumber}`);
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Provision error:', error);

      if (error.response?.status === 403) {
        toast.error(error.response.data.error || t('dashboard.phoneNumbersPage.modal.upgradeRequired'));
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(t('dashboard.phoneNumbersPage.modal.provisionFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCountry(null);
    setSelectedAssistant('');
    onClose();
  };

  // Determine button text and action based on country
  const getButtonConfig = () => {
    if (!selectedCountry) {
      return {
        text: t('dashboard.phoneNumbersPage.modal.selectCountryFirst'),
        disabled: true,
        icon: Phone
      };
    }

    if (selectedCountry.requiresRedirect) {
      return {
        text: t('dashboard.phoneNumbersPage.modal.goToNetgsm'),
        disabled: false,
        icon: ExternalLink
      };
    }

    if (selectedCountry.requiresPayment) {
      return {
        text: t('dashboard.phoneNumbersPage.modal.setupPayment'),
        disabled: false,
        icon: CreditCard
      };
    }

    return {
      text: `${selectedCountry.name} ${t('dashboard.phoneNumbersPage.modal.getNumber')}`,
      disabled: false,
      icon: Phone
    };
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {t('dashboard.phoneNumbersPage.modal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dashboard.phoneNumbersPage.modal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Country Selection */}
          <div>
            <Label className="text-base mb-3 block">{t('dashboard.phoneNumbersPage.modal.selectCountry')}</Label>
            {loadingCountries ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-neutral-100 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => setSelectedCountry(country)}
                    className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                      selectedCountry?.code === country.code
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-3xl">{country.flag}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{country.name}</h4>
                            {country.requiresRedirect && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                NetGSM
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600 mb-2">
                            {country.pricing.displayCurrency}{country.pricing.monthly}/{country.pricing.currency === 'USD' ? 'mo' : 'ay'}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {country.features?.map((feature, i) => (
                              <span key={i} className="text-xs bg-neutral-100 px-2 py-0.5 rounded">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {selectedCountry?.code === country.code && (
                        <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assistant Selection - Only show if not redirect */}
          {assistants.length > 0 && selectedCountry && !selectedCountry.requiresRedirect && (
            <div>
              <Label className="text-base mb-3 block">{t('dashboard.phoneNumbersPage.modal.assignToAssistant')}</Label>
              <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dashboard.phoneNumbersPage.modal.selectAssistant')} />
                </SelectTrigger>
                <SelectContent>
                  {assistants.map((assistant) => (
                    <SelectItem key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 mt-2">
                {t('dashboard.phoneNumbersPage.modal.assistantConnectionNote')}
              </p>
            </div>
          )}

          {/* Info Alert - Turkey (NetGSM Redirect) */}
          {selectedCountry?.requiresRedirect && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">{t('dashboard.phoneNumbersPage.modal.turkeyFlowTitle')}</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{t('dashboard.phoneNumbersPage.modal.turkeyStep1')}</li>
                  <li>{t('dashboard.phoneNumbersPage.modal.turkeyStep2')}</li>
                  <li>{t('dashboard.phoneNumbersPage.modal.turkeyStep3')}</li>
                  <li>{t('dashboard.phoneNumbersPage.modal.turkeyStep4')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Info Alert - US (Payment Required) */}
          {selectedCountry?.requiresPayment && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">{t('dashboard.phoneNumbersPage.modal.usFlowTitle')}</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{t('dashboard.phoneNumbersPage.modal.usStep1')}</li>
                  <li>{t('dashboard.phoneNumbersPage.modal.usStep2')}</li>
                  <li>{t('dashboard.phoneNumbersPage.modal.usStep3')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Provision Button */}
          <Button
            onClick={handleProvision}
            disabled={buttonConfig.disabled || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('dashboard.phoneNumbersPage.modal.processing')}
              </>
            ) : (
              <>
                <ButtonIcon className="mr-2 h-5 w-5" />
                {buttonConfig.text}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

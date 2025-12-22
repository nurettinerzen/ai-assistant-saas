/**
 * PhoneNumberModal Component with SIP Form Support
 * Supports:
 * - Turkey: SIP form for NetGSM numbers
 * - US: Payment flow (coming soon)
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Check, Loader2, ExternalLink, Zap, CreditCard, HelpCircle, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

  // SIP Form State
  const [sipForm, setSipForm] = useState({
    phoneNumber: '',
    sipServer: 'sip.netgsm.com.tr',
    sipUsername: '',
    sipPassword: '',
    sipPort: '5060',
    sipTransport: 'UDP'
  });

  useEffect(() => {
    if (isOpen) {
      loadCountries();
      loadAssistants();
    }
  }, [isOpen]);

  // Update SIP defaults when country changes
  useEffect(() => {
    if (selectedCountry?.sipDefaults) {
      setSipForm(prev => ({
        ...prev,
        sipServer: selectedCountry.sipDefaults.server || prev.sipServer,
        sipPort: String(selectedCountry.sipDefaults.port || prev.sipPort),
        sipTransport: selectedCountry.sipDefaults.transport || prev.sipTransport
      }));
    }
  }, [selectedCountry]);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const response = await apiClient.phoneNumbers.getCountries();
      const countryList = response.data.countries || [];
      setCountries(countryList);

      // Auto-select first country
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

      if (assistantList.length > 0) {
        setSelectedAssistant(assistantList[0].id);
      }
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  };

  const handleSipFormChange = (field, value) => {
    setSipForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImportSip = async () => {
    // Validate form
    if (!sipForm.phoneNumber) {
      toast.error(t('dashboard.phoneNumbersPage.modal.sipPhoneRequired'));
      return;
    }
    if (!sipForm.sipUsername) {
      toast.error(t('dashboard.phoneNumbersPage.modal.sipUsernameRequired'));
      return;
    }
    if (!sipForm.sipPassword) {
      toast.error(t('dashboard.phoneNumbersPage.modal.sipPasswordRequired'));
      return;
    }
    if (!selectedAssistant && assistants.length > 0) {
      toast.error(t('dashboard.phoneNumbersPage.modal.pleaseSelectAssistant'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.importSip({
        phoneNumber: sipForm.phoneNumber,
        sipServer: sipForm.sipServer,
        sipUsername: sipForm.sipUsername,
        sipPassword: sipForm.sipPassword,
        sipPort: parseInt(sipForm.sipPort) || 5060,
        sipTransport: sipForm.sipTransport,
        assistantId: selectedAssistant || undefined
      });

      toast.success(response.data.message || t('dashboard.phoneNumbersPage.modal.numberProvisioned'));
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Import SIP error:', error);

      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          t('dashboard.phoneNumbersPage.modal.sipImportFailed');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    if (!selectedCountry) {
      toast.error(t('dashboard.phoneNumbersPage.modal.pleaseSelectCountry'));
      return;
    }

    // Handle SIP form submission for Turkey
    if (selectedCountry.requiresSipForm) {
      await handleImportSip();
      return;
    }

    // Handle US numbers (requires payment setup)
    if (selectedCountry.requiresPayment) {
      toast.info(t('dashboard.phoneNumbersPage.modal.paymentRequired'));
      return;
    }

    // Default provision flow
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
    setSipForm({
      phoneNumber: '',
      sipServer: 'sip.netgsm.com.tr',
      sipUsername: '',
      sipPassword: '',
      sipPort: '5060',
      sipTransport: 'UDP'
    });
    setShowPassword(false);
    onClose();
  };

  // Determine button text
  const getButtonConfig = () => {
    if (!selectedCountry) {
      return {
        text: t('dashboard.phoneNumbersPage.modal.selectCountryFirst'),
        disabled: true,
        icon: Phone
      };
    }

    if (selectedCountry.requiresSipForm) {
      return {
        text: t('dashboard.phoneNumbersPage.modal.connectSip'),
        disabled: false,
        icon: Phone
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                            {country.requiresSipForm && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                SIP
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

          {/* SIP Form - Turkey */}
          {selectedCountry?.requiresSipForm && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">{t('dashboard.phoneNumbersPage.modal.sipFormTitle')}</h4>
              </div>

              {/* Help Link */}
              <div className="text-sm text-blue-700 flex items-center gap-2 mb-4">
                <HelpCircle className="h-4 w-4" />
                <span>{t('dashboard.phoneNumbersPage.modal.sipHelpText')}</span>
                {selectedCountry.helpUrl && (
                  <a
                    href={selectedCountry.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-800 underline hover:text-blue-900 inline-flex items-center gap-1"
                  >
                    NetGSM <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="phoneNumber">{t('dashboard.phoneNumbersPage.modal.sipPhoneLabel')}</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+90 850 XXX XX XX"
                  value={sipForm.phoneNumber}
                  onChange={(e) => handleSipFormChange('phoneNumber', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* SIP Server */}
              <div>
                <Label htmlFor="sipServer">{t('dashboard.phoneNumbersPage.modal.sipServerLabel')}</Label>
                <Input
                  id="sipServer"
                  placeholder="sip.netgsm.com.tr"
                  value={sipForm.sipServer}
                  onChange={(e) => handleSipFormChange('sipServer', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* SIP Username */}
              <div>
                <Label htmlFor="sipUsername">{t('dashboard.phoneNumbersPage.modal.sipUsernameLabel')}</Label>
                <Input
                  id="sipUsername"
                  placeholder={t('dashboard.phoneNumbersPage.modal.sipUsernamePlaceholder')}
                  value={sipForm.sipUsername}
                  onChange={(e) => handleSipFormChange('sipUsername', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* SIP Password */}
              <div>
                <Label htmlFor="sipPassword">{t('dashboard.phoneNumbersPage.modal.sipPasswordLabel')}</Label>
                <div className="relative mt-1">
                  <Input
                    id="sipPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('dashboard.phoneNumbersPage.modal.sipPasswordPlaceholder')}
                    value={sipForm.sipPassword}
                    onChange={(e) => handleSipFormChange('sipPassword', e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Port and Transport */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sipPort">{t('dashboard.phoneNumbersPage.modal.sipPortLabel')}</Label>
                  <Input
                    id="sipPort"
                    placeholder="5060"
                    value={sipForm.sipPort}
                    onChange={(e) => handleSipFormChange('sipPort', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sipTransport">{t('dashboard.phoneNumbersPage.modal.sipTransportLabel')}</Label>
                  <Select
                    value={sipForm.sipTransport}
                    onValueChange={(value) => handleSipFormChange('sipTransport', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UDP">UDP</SelectItem>
                      <SelectItem value="TCP">TCP</SelectItem>
                      <SelectItem value="TLS">TLS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Assistant Selection */}
          {assistants.length > 0 && selectedCountry && (
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

          {/* Submit Button */}
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

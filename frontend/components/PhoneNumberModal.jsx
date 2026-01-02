/**
 * PhoneNumberModal Component with Generic SIP Provider Support
 * Supports multiple SIP providers (NetGSM, Bulutfon, VoIP Telekom, etc.)
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
import { Phone, Check, Loader2, ExternalLink, HelpCircle, Eye, EyeOff, Info } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PhoneNumberModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countries, setCountries] = useState([]);
  const [sipProviders, setSipProviders] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // SIP Form State
  const [sipForm, setSipForm] = useState({
    phoneNumber: '',
    sipServer: '',
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

  // Update SIP defaults when provider changes
  useEffect(() => {
    if (selectedProvider) {
      setSipForm(prev => ({
        ...prev,
        sipServer: selectedProvider.defaultServer || prev.sipServer,
        sipPort: String(selectedProvider.defaultPort || 5060),
        sipTransport: selectedProvider.defaultTransport || 'UDP'
      }));
    }
  }, [selectedProvider]);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const response = await apiClient.phoneNumbers.getCountries();
      const countryList = response.data.countries || [];
      const providerList = response.data.sipProviders || [];

      setCountries(countryList);
      setSipProviders(providerList);

      // Auto-select first country
      if (countryList.length > 0) {
        setSelectedCountry(countryList[0]);

        // Auto-select first provider for this country
        const countryProviders = countryList[0].sipProviders || providerList;
        if (countryProviders.length > 0) {
          setSelectedProvider(countryProviders[0]);
        }
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
      // Only show INBOUND assistants for phone number assignment
      const inboundAssistants = assistantList.filter(a => a.isActive && a.callDirection === 'inbound');
      setAssistants(inboundAssistants);

      if (inboundAssistants.length > 0) {
        setSelectedAssistant(inboundAssistants[0].id);
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

  const handleProviderChange = (providerId) => {
    const provider = (selectedCountry?.sipProviders || sipProviders).find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
    }
  };

  const handleImportSip = async () => {
    // Validate form
    if (!sipForm.phoneNumber) {
      toast.error(t('dashboard.phoneNumbersPage.modal.sipPhoneRequired'));
      return;
    }
    if (!sipForm.sipServer) {
      toast.error(t('dashboard.phoneNumbersPage.modal.sipServerRequired') || 'SIP sunucu adresi gerekli');
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
        provider: selectedProvider?.id || 'other',
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

  const handleClose = () => {
    setSelectedCountry(null);
    setSelectedProvider(null);
    setSelectedAssistant('');
    setSipForm({
      phoneNumber: '',
      sipServer: '',
      sipUsername: '',
      sipPassword: '',
      sipPort: '5060',
      sipTransport: 'UDP'
    });
    setShowPassword(false);
    onClose();
  };

  // Get current providers list
  const currentProviders = selectedCountry?.sipProviders || sipProviders;

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
                  <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => {
                      setSelectedCountry(country);
                      // Auto-select first provider for this country
                      if (country.sipProviders?.length > 0) {
                        setSelectedProvider(country.sipProviders[0]);
                      }
                    }}
                    className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                      selectedCountry?.code === country.code
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{country.flag}</span>
                        <div>
                          <h4 className="font-semibold text-neutral-900 dark:text-white">{country.name}</h4>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            SIP Trunk
                          </p>
                        </div>
                      </div>
                      {selectedCountry?.code === country.code && (
                        <Check className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SIP Form */}
          {selectedCountry?.requiresSipForm && (
            <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h4 className="font-medium text-neutral-900 dark:text-white">
                  SIP Bağlantı Bilgileri
                </h4>
              </div>

              {/* SIP Provider Selection */}
              <div>
                <Label htmlFor="sipProvider">SIP Sağlayıcı</Label>
                <Select
                  value={selectedProvider?.id || ''}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sağlayıcı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Help Link */}
              {selectedProvider && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span>{selectedProvider.helpText}</span>
                    {selectedProvider.helpUrl && (
                      <a
                        href={selectedProvider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
                      >
                        {selectedProvider.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Phone Number */}
              <div>
                <Label htmlFor="phoneNumber">Telefon Numarası</Label>
                <Input
                  id="phoneNumber"
                  placeholder="örn: 02121234567 veya 08501234567"
                  value={sipForm.phoneNumber}
                  onChange={(e) => handleSipFormChange('phoneNumber', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* SIP Server */}
              <div>
                <Label htmlFor="sipServer">SIP Sunucu</Label>
                <Input
                  id="sipServer"
                  placeholder="örn: sip.provider.com.tr"
                  value={sipForm.sipServer}
                  onChange={(e) => handleSipFormChange('sipServer', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* SIP Username */}
              <div>
                <Label htmlFor="sipUsername">Kullanıcı Adı</Label>
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
                <Label htmlFor="sipPassword">Şifre</Label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Port and Transport */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sipPort">Port</Label>
                  <Input
                    id="sipPort"
                    placeholder="5060"
                    value={sipForm.sipPort}
                    onChange={(e) => handleSipFormChange('sipPort', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sipTransport">Transport</Label>
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

          {/* Assistant Selection - Only Inbound Assistants */}
          {selectedCountry && (
            <div>
              <Label className="text-base mb-3 block">{t('dashboard.phoneNumbersPage.modal.assignToAssistant')}</Label>
              {assistants.length > 0 ? (
                <>
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
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    {t('dashboard.phoneNumbersPage.modal.assistantConnectionNote')}
                  </p>
                </>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Gelen arama asistanı bulunamadı. Lütfen önce "Gelen Arama" tipinde bir asistan oluşturun.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleImportSip}
            disabled={!selectedCountry || loading}
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
                <Phone className="mr-2 h-5 w-5" />
                Numarayı Ekle
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

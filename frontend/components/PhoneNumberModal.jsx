/**
 * PhoneNumberModal Component with BYOC Support
 * Supports: VAPI US numbers + BYOC (Bring Your Own Carrier)
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Phone, Globe, Check, ExternalLink, Star, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

const US_AREA_CODES = [
  { code: '212', location: 'New York, NY' },
  { code: '310', location: 'Los Angeles, CA' },
  { code: '415', location: 'San Francisco, CA' },
  { code: '512', location: 'Austin, TX' },
  { code: '206', location: 'Seattle, WA' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'XX', name: 'Other', flag: '🌍' },
];

export default function PhoneNumberModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('select_method'); // select_method, vapi_us, byoc_setup
  const [loading, setLoading] = useState(false);
  
  // VAPI US number states
  const [selectedAreaCode, setSelectedAreaCode] = useState('');
  
  // BYOC states
  const [selectedCountry, setSelectedCountry] = useState('TR');
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [sipConfig, setSipConfig] = useState({
    sipServer: '',
    sipUsername: '',
    sipPassword: '',
    phoneNumber: ''
  });

  // Load providers when country changes
  useEffect(() => {
    if (step === 'byoc_setup' && selectedCountry) {
      loadProviders(selectedCountry);
    }
  }, [selectedCountry, step]);

  const loadProviders = async (countryCode) => {
    try {
      const response = await apiClient.get(`/phone-numbers/providers/${countryCode}`);
      setProviders(response.data.providers || []);
      
      // Auto-select recommended provider
      const recommended = response.data.providers.find(
        p => p.id === response.data.recommended
      );
      if (recommended) {
        setSelectedProvider(recommended);
        setSipConfig(prev => ({
          ...prev,
          sipServer: recommended.sipServer || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const handleCreateVapiNumber = async () => {
    if (!selectedAreaCode) {
      toast.error('Please select an area code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/phone-numbers/vapi/create', {
        areaCode: selectedAreaCode
      });

      toast.success('US phone number created! 🎉');
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Create VAPI number error:', error);
      toast.error(error.response?.data?.error || 'Failed to create phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectBYOC = async () => {
    const { sipServer, sipUsername, sipPassword, phoneNumber } = sipConfig;

    if (!sipServer || !sipUsername || !sipPassword || !phoneNumber) {
      toast.error('Please fill in all SIP configuration fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/phone-numbers/byoc/connect', {
        provider: selectedProvider?.id || 'custom',
        sipServer,
        sipUsername,
        sipPassword,
        phoneNumber
      });

      toast.success('BYOC number connected successfully! 🎉');
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Connect BYOC error:', error);
      toast.error(error.response?.data?.error || 'Failed to connect BYOC number');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select_method');
    setSelectedAreaCode('');
    setSelectedCountry('TR');
    setSelectedProvider(null);
    setSipConfig({
      sipServer: '',
      sipUsername: '',
      sipPassword: '',
      phoneNumber: ''
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Add Phone Number
          </DialogTitle>
          <DialogDescription>
            Choose how to add a phone number to your account
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: SELECT METHOD */}
        {step === 'select_method' && (
          <div className="space-y-4 py-4">
            {/* Option 1: VAPI US Number (Free) */}
            <button
              onClick={() => setStep('vapi_us')}
              className="w-full p-6 border-2 border-neutral-200 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <span className="text-3xl">🇺🇸</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">US Phone Number</h3>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      FREE
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Get a free US phone number instantly with VAPI. Perfect for testing and US customers.
                  </p>
                  <ul className="text-sm text-neutral-500 space-y-1">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Instant activation
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Choose area code
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Free (up to 10 numbers)
                    </li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Option 2: BYOC (Bring Your Own Carrier) */}
            <button
              onClick={() => setStep('byoc_setup')}
              className="w-full p-6 border-2 border-neutral-200 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <Globe className="h-8 w-8 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Bring Your Own Number (BYOC)</h3>
                    <Badge variant="outline">Recommended for Turkey</Badge>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Connect your existing VoIP provider via SIP trunk. Supports worldwide numbers.
                  </p>
                  <ul className="text-sm text-neutral-500 space-y-1">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Any country number
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Use existing provider (Netgsm, Bulutfon, etc.)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Full control over your number
                    </li>
                  </ul>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* STEP 2A: VAPI US NUMBER */}
        {step === 'vapi_us' && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('select_method')}
              className="mb-2"
            >
              ← Back
            </Button>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="text-sm text-primary-800">
                🎉 <strong>Free US Phone Number</strong> - Get instant access to a US number powered by VAPI.
              </p>
            </div>

            <div>
              <Label>Select Area Code</Label>
              <Select value={selectedAreaCode} onValueChange={setSelectedAreaCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an area code" />
                </SelectTrigger>
                <SelectContent>
                  {US_AREA_CODES.map(area => (
                    <SelectItem key={area.code} value={area.code}>
                      ({area.code}) {area.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreateVapiNumber}
              disabled={!selectedAreaCode || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Get US Phone Number
                </>
              )}
            </Button>
          </div>
        )}

        {/* STEP 2B: BYOC SETUP */}
        {step === 'byoc_setup' && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('select_method')}
              className="mb-2"
            >
              ← Back
            </Button>

            {/* Country Selection */}
            <div>
              <Label>Select Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(country => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.flag} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider Selection */}
            {providers.length > 0 && (
              <div>
                <Label className="mb-3 block">Recommended VoIP Providers</Label>
                <div className="space-y-3">
                  {providers.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setSelectedProvider(provider);
                        setSipConfig(prev => ({
                          ...prev,
                          sipServer: provider.sipServer || ''
                        }));
                      }}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        selectedProvider?.id === provider.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{provider.name}</h4>
                            {provider.id === providers.find(p => p.difficulty === 'auto' || p.difficulty === 'easy')?.id && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <p className="text-sm text-neutral-600 mb-2">{provider.pricing}</p>
                          <div className="flex flex-wrap gap-1">
                            {provider.features?.slice(0, 3).map((feature, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {selectedProvider?.id === provider.id && (
                          <Check className="h-5 w-5 text-primary-600" />
                        )}
                      </div>
                      {provider.setupGuide && (
                        <a
                          href={provider.setupGuide}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Setup Guide <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SIP Configuration Form */}
            {selectedProvider && (
              <div className="space-y-4 mt-6 p-4 bg-neutral-50 rounded-lg">
                <h4 className="font-semibold text-sm">SIP Configuration</h4>
                
                <div>
                  <Label>SIP Server</Label>
                  <Input
                    value={sipConfig.sipServer}
                    onChange={(e) => setSipConfig({ ...sipConfig, sipServer: e.target.value })}
                    placeholder={selectedProvider.sipServer}
                  />
                </div>

                <div>
                  <Label>SIP Username</Label>
                  <Input
                    value={sipConfig.sipUsername}
                    onChange={(e) => setSipConfig({ ...sipConfig, sipUsername: e.target.value })}
                    placeholder="Your SIP username"
                  />
                </div>

                <div>
                  <Label>SIP Password</Label>
                  <Input
                    type="password"
                    value={sipConfig.sipPassword}
                    onChange={(e) => setSipConfig({ ...sipConfig, sipPassword: e.target.value })}
                    placeholder="Your SIP password"
                  />
                </div>

                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={sipConfig.phoneNumber}
                    onChange={(e) => setSipConfig({ ...sipConfig, phoneNumber: e.target.value })}
                    placeholder="+908501234567"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Include country code (e.g., +90 for Turkey)
                  </p>
                </div>

                <Button
                  onClick={handleConnectBYOC}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Connect Number
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Need help setting up?</p>
                <p>Check our setup guides for step-by-step instructions on connecting your VoIP provider.</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * PhoneNumberModal Component with Auto-Provision
 * Simplified 1-click provisioning based on country
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
import { Phone, Check, Loader2, AlertCircle, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function PhoneNumberModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countries, setCountries] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState('');

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

      // Auto-select Turkey as default
      const turkey = countryList.find(c => c.code === 'TR');
      if (turkey) {
        setSelectedCountry(turkey);
      }
    } catch (error) {
      console.error('Failed to load countries:', error);
      toast.error('Failed to load available countries');
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
      toast.error('Please select a country');
      return;
    }

    if (!selectedAssistant && assistants.length > 0) {
      toast.error('Please select an assistant');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.provision({
        countryCode: selectedCountry.code,
        assistantId: selectedAssistant || undefined
      });

      toast.success(`✅ Phone number provisioned successfully! ${response.data.phoneNumber}`);
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Provision error:', error);

      // Handle specific error cases
      if (error.response?.status === 403) {
        toast.error(error.response.data.error || 'Upgrade required to provision phone numbers');
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to provision phone number. Please try again.');
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Get Phone Number
          </DialogTitle>
          <DialogDescription>
            Provision a new phone number in 1 click - automatically connected to your assistant
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Country Selection */}
          <div>
            <Label className="text-base mb-3 block">Select Country</Label>
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
                            {country.provider === 'VAPI' && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                Instant
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

          {/* Assistant Selection */}
          {assistants.length > 0 && (
            <div>
              <Label className="text-base mb-3 block">Assign to Assistant</Label>
              <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an assistant" />
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
                The phone number will be automatically connected to this assistant
              </p>
            </div>
          )}

          {/* Info Alert */}
          {selectedCountry && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="space-y-1 list-disc list-inside">
                  {selectedCountry.provider === 'NETGSM' ? (
                    <>
                      <li>We'll purchase a Turkish 0850 number from Netgsm</li>
                      <li>Number will be automatically configured with VAPI</li>
                      <li>Your assistant will be ready to receive calls</li>
                      <li>Setup takes ~30 seconds</li>
                    </>
                  ) : (
                    <>
                      <li>We'll provision a US local number via VAPI</li>
                      <li>Number activates instantly</li>
                      <li>Your assistant will be ready to receive calls</li>
                      <li>No additional configuration needed</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Provision Button */}
          <Button
            onClick={handleProvision}
            disabled={!selectedCountry || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-5 w-5" />
                Get {selectedCountry?.name || 'Phone'} Number
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

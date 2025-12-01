/**
 * PhoneNumberModal Component
 * Phone number provisioning flow with VAPI
 */

import React, { useState } from 'react';
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
import { Phone, Search, Loader2, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatPhone } from '@/lib/utils';

const AREA_CODES = [
  { code: '212', location: 'New York, NY' },
  { code: '310', location: 'Los Angeles, CA' },
  { code: '312', location: 'Chicago, IL' },
  { code: '415', location: 'San Francisco, CA' },
  { code: '617', location: 'Boston, MA' },
  { code: '202', location: 'Washington, DC' },
  { code: '305', location: 'Miami, FL' },
  { code: '404', location: 'Atlanta, GA' },
  { code: '512', location: 'Austin, TX' },
  { code: '206', location: 'Seattle, WA' },
];

const STEPS = {
  SELECT_AREA: 'select_area',
  SEARCH_NUMBERS: 'search_numbers',
  CONFIRM: 'confirm',
  SUCCESS: 'success',
};

export default function PhoneNumberModal({ isOpen, onClose, onSuccess, assistantId }) {
  const [step, setStep] = useState(STEPS.SELECT_AREA);
  const [loading, setLoading] = useState(false);
  const [selectedAreaCode, setSelectedAreaCode] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [provisionedNumber, setProvisionedNumber] = useState(null);

  const handleSearchNumbers = async () => {
    if (!selectedAreaCode) {
      toast.error('Please select an area code');
      return;
    }

    setLoading(true);
    try {
      // Mock search - In production, call VAPI to search available numbers
      // const response = await apiClient.phoneNumbers.search({ areaCode: selectedAreaCode });
      
      // Simulated available numbers
      const mockNumbers = Array.from({ length: 5 }, (_, i) => ({
        id: `num-${i}`,
        number: `+1${selectedAreaCode}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        monthlyPrice: 1.00,
        setupFee: 0,
      }));

      setAvailableNumbers(mockNumbers);
      setStep(STEPS.SEARCH_NUMBERS);
    } catch (error) {
      toast.error('Failed to search numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNumber = (number) => {
    setSelectedNumber(number);
    setStep(STEPS.CONFIRM);
  };

  const handleProvision = async () => {
    if (!selectedNumber) return;

    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.provision({
        phoneNumber: selectedNumber.number,
        assistantId: assistantId,
      });

      setProvisionedNumber(response.data);
      setStep(STEPS.SUCCESS);
      toast.success('Phone number provisioned successfully!');
      
      // Notify parent component
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      toast.error('Failed to provision number');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(STEPS.SELECT_AREA);
    setSelectedAreaCode('');
    setAvailableNumbers([]);
    setSelectedNumber(null);
    setProvisionedNumber(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary-600" />
            Get a Phone Number
          </DialogTitle>
          <DialogDescription>
            {step === STEPS.SELECT_AREA && 'Choose an area code to search for available numbers'}
            {step === STEPS.SEARCH_NUMBERS && 'Select a number from the available options'}
            {step === STEPS.CONFIRM && 'Review and confirm your selection'}
            {step === STEPS.SUCCESS && 'Your phone number is ready to use!'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px]">
          {/* Step 1: Select Area Code */}
          {step === STEPS.SELECT_AREA && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="areaCode">Area Code</Label>
                <Select value={selectedAreaCode} onValueChange={setSelectedAreaCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area code" />
                  </SelectTrigger>
                  <SelectContent>
                    {AREA_CODES.map((area) => (
                      <SelectItem key={area.code} value={area.code}>
                        {area.code} - {area.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSearchNumbers}
                disabled={!selectedAreaCode || loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search Available Numbers
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Select Number */}
          {step === STEPS.SEARCH_NUMBERS && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-neutral-600">
                  Found {availableNumbers.length} available numbers in area code {selectedAreaCode}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(STEPS.SELECT_AREA)}
                >
                  Change Area Code
                </Button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableNumbers.map((number) => (
                  <div
                    key={number.id}
                    className="border border-neutral-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer transition-all flex items-center justify-between"
                    onClick={() => handleSelectNumber(number)}
                  >
                    <div>
                      <p className="font-mono font-semibold text-lg text-neutral-900">
                        {formatPhone(number.number)}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        ${number.monthlyPrice}/month
                        {number.setupFee > 0 && ` + $${number.setupFee} setup fee`}
                      </p>
                    </div>
                    <Button size="sm">Select</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === STEPS.CONFIRM && selectedNumber && (
            <div className="space-y-6">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 text-center">
                <Phone className="h-12 w-12 text-primary-600 mx-auto mb-3" />
                <p className="text-2xl font-bold font-mono text-neutral-900 mb-2">
                  {formatPhone(selectedNumber.number)}
                </p>
                <p className="text-sm text-neutral-600">
                  ${selectedNumber.monthlyPrice}/month
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Monthly Cost:</span>
                  <span className="font-medium text-neutral-900">
                    ${selectedNumber.monthlyPrice.toFixed(2)}
                  </span>
                </div>
                {selectedNumber.setupFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">One-time Setup Fee:</span>
                    <span className="font-medium text-neutral-900">
                      ${selectedNumber.setupFee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-neutral-200">
                  <span className="font-semibold text-neutral-900">Total Today:</span>
                  <span className="font-semibold text-neutral-900">
                    ${(selectedNumber.monthlyPrice + selectedNumber.setupFee).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(STEPS.SEARCH_NUMBERS)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleProvision}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    'Confirm & Purchase'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === STEPS.SUCCESS && provisionedNumber && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                Number Provisioned!
              </h3>
              <p className="text-neutral-600 mb-4">
                Your new phone number is ready to receive calls
              </p>
              <p className="text-3xl font-bold font-mono text-primary-600 mb-6">
                {formatPhone(provisionedNumber.phoneNumber)}
              </p>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

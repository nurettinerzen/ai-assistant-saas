/**
 * Phone Numbers Page
 * Manage provisioned phone numbers
 * CREATE NEW FILE: frontend/app/dashboard/phone-numbers/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import PhoneNumberModal from '@/components/PhoneNumberModal';
import { Phone, Plus, Trash2, TestTube2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { formatPhone, formatDate } from '@/lib/utils';

export default function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  useEffect(() => {
    loadPhoneNumbers();
  }, []);

  const loadPhoneNumbers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.phoneNumbers.getAll();
      setPhoneNumbers(response.data.phoneNumbers || []);
    } catch (error) {
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCall = async (phoneNumber) => {
    try {
      await toastHelpers.async(
        apiClient.phoneNumbers.test(phoneNumber.id),
        'Initiating test call...',
        'Test call started! Check your phone.'
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleRelease = async (phoneNumber) => {
    if (
      !confirm(
        `Release ${formatPhone(phoneNumber.phoneNumber)}? This number will be returned to the pool.`
      )
    )
      return;

    try {
      await toastHelpers.async(
        apiClient.phoneNumbers.release(phoneNumber.id),
        'Releasing number...',
        'Phone number released!'
      );
      loadPhoneNumbers();
    } catch (error) {
      // Error handled
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Phone Numbers</h1>
          <p className="text-neutral-600 mt-1">Manage your provisioned phone numbers</p>
        </div>
        <Button onClick={() => setShowProvisionModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Get Phone Number
        </Button>
      </div>

      {/* Phone numbers grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse"
            >
              <div className="h-8 w-48 bg-neutral-200 rounded mb-4"></div>
              <div className="h-4 w-32 bg-neutral-200 rounded mb-2"></div>
              <div className="h-10 w-full bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : phoneNumbers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phoneNumbers.map((number) => (
            <div
              key={number.id}
              className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Phone className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-mono font-bold text-neutral-900">
                      {formatPhone(number.phoneNumber)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Provisioned {formatDate(number.createdAt, 'short')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Assistant:</span>
                  <span className="font-medium text-neutral-900">
                    {number.assistantName || 'Not assigned'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Status:</span>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Monthly Cost:</span>
                  <span className="font-medium text-neutral-900">$1.00</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTestCall(number)}
                >
                  <TestTube2 className="h-3 w-3 mr-2" />
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRelease(number)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <EmptyState
            icon={Phone}
            title="No phone numbers yet"
            description="Get a phone number to start receiving calls"
            actionLabel="Get Phone Number"
            onAction={() => setShowProvisionModal(true)}
          />
        </div>
      )}

      {/* Info banner */}
      {phoneNumbers.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-primary-900 mb-2">Billing Information</h3>
          <p className="text-sm text-primary-700">
            Each phone number costs $1.00/month. Numbers are billed on the first of each month.
            You can release a number at any time to stop charges.
          </p>
        </div>
      )}

      {/* Provision modal */}
      <PhoneNumberModal
        isOpen={showProvisionModal}
        onClose={() => setShowProvisionModal(false)}
        onSuccess={() => {
          setShowProvisionModal(false);
          loadPhoneNumbers();
        }}
      />
    </div>
  );
}

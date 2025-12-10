'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) setUser(data);
      });
  }, []);

  const handleSubscribe = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/subscription/create-checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        priceId: 'price_1SUjlxRJeFH9VDJoJst7CKKz'
      })
    });

    const data = await res.json();

    if (res.ok) {
      // Stripe Checkout sayfasına yönlendir
      window.location.href = data.sessionUrl;
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Failed: ' + err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-lg text-gray-600">Select the perfect plan for your business needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

          {/* Free Trial */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Free Trial</h2>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-900">$0</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">AI Assistant</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Basic Training</span>
              </li>
              <li className="flex items-center gap-3">
                <X className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">Phone Number</span>
              </li>
              <li className="flex items-center gap-3">
                <X className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">Advanced Features</span>
              </li>
            </ul>
            <Button variant="outline" disabled className="w-full">
              Current Plan
            </Button>
          </div>

          {/* Basic Plan */}
          <div className="bg-white rounded-xl border-3 border-primary p-8 shadow-lg relative transform scale-105">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary px-6 py-1 rounded-full">
              <span className="text-sm font-semibold text-white">RECOMMENDED</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Plan</h2>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-900">$29</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">AI Assistant</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Unlimited Training</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">1 Phone Number</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Call Analytics</span>
              </li>
            </ul>
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pro Plan</h2>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-900">$79</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Everything in Basic</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">3 Phone Numbers</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Advanced Analytics</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">Priority Support</span>
              </li>
            </ul>
            <Button variant="outline" disabled className="w-full">
              Coming Soon
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
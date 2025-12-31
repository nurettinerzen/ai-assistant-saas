'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function IyzicoCheckoutPage() {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initialized.current) return;
    initialized.current = true;

    // Get checkout content from sessionStorage
    const checkoutContent = sessionStorage.getItem('iyzicoCheckoutContent');

    if (!checkoutContent) {
      setError('Ödeme bilgisi bulunamadı. Lütfen abonelik sayfasına geri dönün ve tekrar deneyin.');
      setLoading(false);
      return;
    }

    // Don't clear sessionStorage immediately - let iyzico load first
    // It will be cleared when user navigates away

    try {
      if (containerRef.current) {
        // Clear any previous content
        containerRef.current.innerHTML = '';

        // Create a div to hold the checkout form
        const formDiv = document.createElement('div');
        formDiv.innerHTML = checkoutContent;
        containerRef.current.appendChild(formDiv);

        // Execute scripts
        const scripts = formDiv.getElementsByTagName('script');
        Array.from(scripts).forEach(oldScript => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          newScript.textContent = oldScript.textContent;
          document.head.appendChild(newScript);
        });

        setLoading(false);

        // Clear sessionStorage after scripts are loaded
        setTimeout(() => {
          sessionStorage.removeItem('iyzicoCheckoutContent');
        }, 2000);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Ödeme formu yüklenemedi');
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <p className="text-red-600 mb-6">{error}</p>
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Abonelik Sayfasına Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <div className="mb-4">
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri Dön
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            Ödeme Bilgileri
          </h1>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              <span className="ml-2 text-gray-600">Ödeme formu yükleniyor...</span>
            </div>
          )}

          <div
            ref={containerRef}
            id="iyzico-checkout-form"
            className="min-h-[400px]"
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [user, setUser] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState('stripe');
  const [plans, setPlans] = useState([]);
  const [iyzicoCheckout, setIyzicoCheckout] = useState(null);
  const iyzicoContainerRef = useRef(null);

  // Check for error/success params
  useEffect(() => {
    const error = searchParams.get('error');
    const canceled = searchParams.get('canceled');

    if (error) {
      toast.error(error === 'payment_failed' ? 'Ödeme başarısız oldu' : 'Bir hata oluştu');
    }
    if (canceled) {
      toast.info('Ödeme iptal edildi');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Get user info
        const userRes = await apiClient.get('/api/auth/me');
        if (userRes.data?.id) {
          setUser(userRes.data);
        }

        // Get payment provider
        const providerRes = await apiClient.subscription.getPaymentProvider();
        setPaymentProvider(providerRes.data.provider);

        // Get plans
        const plansRes = await apiClient.subscription.getPlans();
        setPlans(plansRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [router]);

  // Handle iyzico checkout form render
  useEffect(() => {
    if (iyzicoCheckout && iyzicoContainerRef.current) {
      // Clear previous content
      iyzicoContainerRef.current.innerHTML = '';

      // Insert iyzico checkout form HTML
      const scriptMatch = iyzicoCheckout.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (scriptMatch) {
        // Create a div for the form
        const formDiv = document.createElement('div');
        formDiv.id = 'iyzipay-checkout-form';
        formDiv.className = 'popup';
        iyzicoContainerRef.current.appendChild(formDiv);

        // Execute the script
        const script = document.createElement('script');
        script.textContent = scriptMatch[1];
        iyzicoContainerRef.current.appendChild(script);
      }
    }
  }, [iyzicoCheckout]);

  const handleSubscribe = async (planId) => {
    setLoadingPlan(planId);
    try {
      const response = await apiClient.subscription.createCheckout({ planId });
      const data = response.data;

      if (data.provider === 'iyzico') {
        // Show iyzico checkout form
        setIyzicoCheckout(data.checkoutFormContent);
      } else if (data.provider === 'stripe' && data.sessionUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.sessionUrl;
      } else {
        toast.error('Ödeme başlatılamadı');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Ödeme başlatılamadı');
    } finally {
      setLoadingPlan(null);
    }
  };

  const formatPrice = (plan) => {
    if (paymentProvider === 'iyzico') {
      return `₺${plan.priceTRY?.toLocaleString('tr-TR') || 0}`;
    }
    return `$${plan.price || 0}`;
  };

  const isIyzico = paymentProvider === 'iyzico';

  // Plan features
  const planFeatures = {
    FREE: {
      included: ['AI Assistant', 'Basic Training'],
      excluded: ['Phone Number', 'Advanced Features']
    },
    STARTER: {
      included: ['1 AI Assistant', 'Unlimited Training', '1 Phone Number', '300 Minutes/Month', 'Basic Analytics', 'Email Support'],
      excluded: []
    },
    PROFESSIONAL: {
      included: ['2 AI Assistants', 'Unlimited Training', '3 Phone Numbers', '1500 Minutes/Month', 'Advanced Analytics', 'Priority Support', 'API Access'],
      excluded: []
    },
    ENTERPRISE: {
      included: ['5 AI Assistants', 'Unlimited Everything', '10 Phone Numbers', 'Custom Voice Cloning', 'White-label Option', 'Dedicated Manager', 'SLA Guarantee'],
      excluded: []
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {isIyzico ? 'Planınızı Seçin' : 'Choose Your Plan'}
          </h1>
          <p className="text-lg text-gray-600">
            {isIyzico
              ? 'İşletmeniz için en uygun planı seçin'
              : 'Select the perfect plan for your business needs'}
          </p>

          {/* Payment provider indicator */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border">
            <CreditCard className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              {isIyzico ? (
                <>Ödeme: <span className="font-semibold text-blue-600">iyzico</span> (Türkiye)</>
              ) : (
                <>Payment: <span className="font-semibold text-purple-600">Stripe</span> (Global)</>
              )}
            </span>
          </div>
        </div>

        {/* iyzico Checkout Modal */}
        {iyzicoCheckout && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Ödeme</h3>
                <button
                  onClick={() => setIyzicoCheckout(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div ref={iyzicoContainerRef} className="p-4" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* FREE Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isIyzico ? 'Ücretsiz' : 'Free'}
            </h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">{formatPrice({ price: 0, priceTRY: 0 })}</span>
              <span className="text-gray-600 ml-2">/{isIyzico ? 'ay' : 'month'}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {planFeatures.FREE.included.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
              {planFeatures.FREE.excluded.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-400">{feature}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" disabled className="w-full">
              {isIyzico ? 'Mevcut Plan' : 'Current Plan'}
            </Button>
          </div>

          {/* STARTER Plan */}
          <div className="bg-white rounded-xl border-2 border-primary p-6 shadow-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-4 py-1 rounded-full">
              <span className="text-xs font-semibold text-white">
                {isIyzico ? 'ÖNERİLEN' : 'RECOMMENDED'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Starter</h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(plans.find(p => p.id === 'STARTER') || { price: 27, priceTRY: 899 })}
              </span>
              <span className="text-gray-600 ml-2">/{isIyzico ? 'ay' : 'month'}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {planFeatures.STARTER.included.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handleSubscribe('STARTER')}
              disabled={loadingPlan === 'STARTER'}
              className="w-full"
            >
              {loadingPlan === 'STARTER' ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isIyzico ? 'İşleniyor...' : 'Processing...'}</>
              ) : (
                isIyzico ? 'Abone Ol' : 'Subscribe Now'
              )}
            </Button>
          </div>

          {/* PROFESSIONAL Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 px-4 py-1 rounded-full">
              <span className="text-xs font-semibold text-white">
                {isIyzico ? 'EN İYİ DEĞER' : 'BEST VALUE'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Professional</h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(plans.find(p => p.id === 'PROFESSIONAL') || { price: 77, priceTRY: 2599 })}
              </span>
              <span className="text-gray-600 ml-2">/{isIyzico ? 'ay' : 'month'}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {planFeatures.PROFESSIONAL.included.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handleSubscribe('PROFESSIONAL')}
              disabled={loadingPlan === 'PROFESSIONAL'}
              variant="outline"
              className="w-full"
            >
              {loadingPlan === 'PROFESSIONAL' ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isIyzico ? 'İşleniyor...' : 'Processing...'}</>
              ) : (
                isIyzico ? 'Abone Ol' : 'Subscribe Now'
              )}
            </Button>
          </div>

          {/* ENTERPRISE Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(plans.find(p => p.id === 'ENTERPRISE') || { price: 199, priceTRY: 6799 })}
              </span>
              <span className="text-gray-600 ml-2">/{isIyzico ? 'ay' : 'month'}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {planFeatures.ENTERPRISE.included.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handleSubscribe('ENTERPRISE')}
              disabled={loadingPlan === 'ENTERPRISE'}
              variant="outline"
              className="w-full"
            >
              {loadingPlan === 'ENTERPRISE' ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isIyzico ? 'İşleniyor...' : 'Processing...'}</>
              ) : (
                isIyzico ? 'Abone Ol' : 'Subscribe Now'
              )}
            </Button>
          </div>
        </div>

        {/* Payment Security Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            {isIyzico ? (
              <>
                🔒 Güvenli ödeme <span className="font-semibold">iyzico</span> altyapısı ile sağlanmaktadır.
                <br />
                Tüm kart bilgileriniz 256-bit SSL ile şifrelenmektedir.
              </>
            ) : (
              <>
                🔒 Secure payments powered by <span className="font-semibold">Stripe</span>.
                <br />
                Your card information is encrypted with 256-bit SSL.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

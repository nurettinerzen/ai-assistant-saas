'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getBusinessTypes = (t) => [
  { value: 'RESTAURANT', label: `🍽️ ${t('auth.businessTypes.restaurant')}`, description: t('auth.businessTypes.restaurantDesc') },
  { value: 'SALON', label: `💇 ${t('auth.businessTypes.salon')}`, description: t('auth.businessTypes.salonDesc') },
  { value: 'ECOMMERCE', label: `🛍️ ${t('auth.businessTypes.ecommerce')}`, description: t('auth.businessTypes.ecommerceDesc') },
  { value: 'SERVICE', label: `🔧 ${t('auth.businessTypes.service')}`, description: t('auth.businessTypes.serviceDesc') },
  { value: 'OTHER', label: `📋 ${t('auth.businessTypes.other')}`, description: t('auth.businessTypes.otherDesc') }
];

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const BUSINESS_TYPES = getBusinessTypes(t);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
    businessType: 'RESTAURANT'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo/Header */}
        <div className="text-center mb-8 flex items-center justify-between max-w-2xl mx-auto">
          <Link href="/" className="inline-block flex-1">
            <h1 className="text-4xl font-bold gradient-text mb-2">TELYX.AI</h1>
            <p className="text-gray-600">{t('auth.signupSubtitle')}</p>
          </Link>
          <LanguageSwitcher />
        </div>

        <Card className="glass border-white/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('common.signup')}</CardTitle>
            <CardDescription>
              {t('auth.freeTrial')}. {t('auth.noCreditCard')}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200" data-testid="error-message">
                  {error}
                </div>
              )}

              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="businessName">{t('auth.businessName')} *</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder={t('auth.businessNamePlaceholder')}
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  required
                  data-testid="business-name-input"
                />
              </div>

              {/* Business Type */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">{t('auth.businessType')} *</Label>
                <div className="space-y-3">
                  {BUSINESS_TYPES.map(type => (
                    <div
                      key={type.value}
                      onClick={() => setFormData({ ...formData, businessType: type.value })}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                        formData.businessType === type.value
                          ? 'border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      data-testid={`business-type-${type.value.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">
                            {type.label}
                          </div>
                          <div className="text-sm text-gray-600">
                            {type.description}
                          </div>
                        </div>
                        {formData.businessType === type.value && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 ml-4">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="email-input"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')} *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  data-testid="password-input"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-lg py-6"
                disabled={loading}
                data-testid="submit-button"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('auth.creatingAccount')}</span>
                  </div>
                ) : (
                  t('common.createAccount')
                )}
              </Button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/login" className="text-indigo-600 hover:underline font-medium" data-testid="login-link">
                  {t('common.signIn')}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('auth.freeTrial')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('auth.noCreditCard')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('auth.cancelAnytime')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

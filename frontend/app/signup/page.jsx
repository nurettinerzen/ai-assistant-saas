/**
 * Signup Page
 * User registration with email verification
 * UPDATE EXISTING FILE: frontend/app/signup/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Lock, User, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import OnboardingModal from '@/components/OnboardingModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getCurrentLanguage, t } from '@/lib/translations';

const STEPS = {
  SIGNUP: 'signup',
  VERIFY: 'verify',
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.SIGNUP);
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState('en');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newBusinessId, setNewBusinessId] = useState(null);

  useEffect(() => {
    setLocale(getCurrentLanguage());
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error(t('pleaseFillAllFields', locale));
      return;
    }

    if (formData.password.length < 8) {
      toast.error(t('passwordMustBe8', locale));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.register({
        email: formData.email,
        password: formData.password,
        businessName: formData.name,
        businessType: 'OTHER',
      });
      
      // Save token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Show onboarding modal
      setNewBusinessId(response.data.user.businessId);
      setShowOnboarding(true);
      
      toast.success(t('accountCreatedSuccess', locale));
    } catch (error) {
      console.error('API ERROR:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || error.message || t('signupFailed', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    const code = verificationCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.verifyEmail(code);
      
      // Save token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      toast.success('Account verified! Welcome to Telyx! 🎉');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (index, value) => {
    if (value.length > 1) value = value[0];
    if (!/^[0-9]*$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleGoogleSignup = async () => {
    toast.info(t('googleSignUpComingSoon', locale));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-neutral-900">Telyx</span>
            </div>
            <LanguageSwitcher />
          </div>

          {step === STEPS.SIGNUP ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                  {t('signupTitle', locale)}
                </h1>
                <p className="text-neutral-600">{t('signupSubtitle', locale)}</p>
              </div>

              {/* Google Sign-Up */}
              <Button
                variant="outline"
                className="w-full mb-6"
                onClick={handleGoogleSignup}
                disabled={loading}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('continueWithGoogle', locale)}
              </Button>

              <div className="relative mb-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-neutral-500">
                  {t('orSignUpWith', locale)}
                </span>
              </div>

              {/* Signup form */}
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('fullName', locale)}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      className="pl-10"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">{t('email', locale)}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">{t('password', locale)}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{t('mustBe8Chars', locale)}</p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('creatingAccount', locale)}
                    </>
                  ) : (
                    t('createAccount', locale)
                  )}
                </Button>
              </form>

              {/* Terms */}
              <p className="text-xs text-center text-neutral-500 mt-4">
                {t('byCreatingAccount', locale)}{' '}
                <Link href="/terms" className="text-primary-600 hover:underline">
                  {t('termsOfService', locale)}
                </Link>{' '}
                {t('and', locale)}{' '}
                <Link href="/privacy" className="text-primary-600 hover:underline">
                  {t('privacyPolicy', locale)}
                </Link>
              </p>

              {/* Login link */}
              <p className="text-center text-sm text-neutral-600 mt-6">
                {t('alreadyHaveAccount', locale)}{' '}
                <Link href="/login" className="text-primary-600 font-medium hover:underline">
                  {t('signIn', locale)}
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Verification step */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                  {t('verifyYourEmail', locale)}
                </h1>
                <p className="text-neutral-600">
                  {t('weSentCode', locale)} <strong>{formData.email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <Label>{t('verificationCode', locale)}</Label>
                  <div className="flex gap-2 mt-2">
                    {verificationCode.map((digit, index) => (
                      <Input
                        key={index}
                        id={`code-${index}`}
                        type="text"
                        maxLength={1}
                        className="text-center text-2xl font-bold h-14 w-14"
                        value={digit}
                        onChange={(e) => handleCodeInput(index, e.target.value)}
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('verifying', locale)}
                    </>
                  ) : (
                    t('verifyEmail', locale)
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-neutral-600 mt-6">
                {t('didntReceiveCode', locale)}{' '}
                <button className="text-primary-600 font-medium hover:underline">
                  {t('resend', locale)}
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-600 to-primary-800 p-12 items-center justify-center">
        <div className="max-w-lg text-white">
          <h2 className="text-4xl font-bold mb-6">{t('joinThousands', locale)}</h2>
          <p className="text-lg text-primary-100 mb-8">
            {t('automatePhoneSupport', locale)}
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-1 bg-primary-500 rounded-full">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">{t('freeTrialIncluded', locale)}</p>
                <p className="text-sm text-primary-100">{t('tryAllFeatures', locale)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 p-1 bg-primary-500 rounded-full">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">{t('noSetupFees', locale)}</p>
                <p className="text-sm text-primary-100">{t('startWithStarter', locale)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 p-1 bg-primary-500 rounded-full">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">{t('cancelAnytime', locale)}</p>
                <p className="text-sm text-primary-100">{t('noCommitments', locale)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          onClose={() => {
            setShowOnboarding(false);
            router.push('/dashboard');
          }}
          businessId={newBusinessId}
        />
      )}

      {/* Toaster for notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
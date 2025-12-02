/**
 * Signup Page
 * User registration with email verification
 * UPDATE EXISTING FILE: frontend/app/signup/page.jsx
 */

'use client';

import React, { useState } from 'react';
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
import { useLanguage } from '@/contexts/LanguageContext';

const STEPS = {
  SIGNUP: 'signup',
  VERIFY: 'verify',
};

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(STEPS.SIGNUP);
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [userId, setUserId] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.email || !formData.password || !formData.fullName) {
        toast.error(t('auth.pleaseFillAllFields'));
        return;
      }

      if (formData.password.length < 8) {
        toast.error(t('auth.passwordMinLength'));
        return;
      }

      const response = await apiClient.auth.signup(formData);
      setUserId(response.data.userId);
      setStep(STEPS.VERIFY);
      toast.success(t('auth.verificationCodeSent'));
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error.response?.data?.error || t('auth.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.auth.verifyEmail({
        userId,
        code: verificationCode,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setShowOnboarding(true);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(error.response?.data?.error || t('auth.verificationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    router.push('/dashboard');
  };

  if (showOnboarding) {
    return (
      <OnboardingModal 
        isOpen={true} 
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            <Phone className="inline-block mr-2 h-8 w-8" />
            TELYX.AI
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === STEPS.SIGNUP ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {t('auth.signupTitle')}
                </h1>
                <p className="text-gray-600">{t('auth.signupSubtitle')}</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-6">
                <div>
                  <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={t('auth.fullName')}
                      className="pl-10"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      className="pl-10"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('auth.mustBe8Chars')}</p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.creatingAccount')}
                    </>
                  ) : (
                    t('common.createAccount')
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/login" className="text-indigo-600 hover:underline font-medium">
                  {t('common.signIn')}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {t('auth.verifyEmail')}
                </h1>
                <p className="text-gray-600">
                  {t('auth.verificationCodeSentTo')} <strong>{formData.email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerification} className="space-y-6">
                <div>
                  <Label htmlFor="code">{t('auth.verificationCode')}</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.verifying')}
                    </>
                  ) : (
                    t('auth.verifyEmail')
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600">
                {t('auth.didntReceiveCode')}{' '}
                <button className="text-indigo-600 hover:underline font-medium">
                  {t('auth.resendCode')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
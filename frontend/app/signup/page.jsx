'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2, Ticket } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { TelyxLogoFull } from '@/components/TelyxLogo';

export default function SignupPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    router.push('/dashboard/assistant');
  }
}, [router]);
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    inviteCode: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkExistingAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await apiClient.get('/api/auth/me');
          // User is authenticated, redirect to assistant page
          // Dashboard will handle onboarding if needed
          router.push('/dashboard/assistant');
          return;
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setCheckingAuth(false);
    };

    checkExistingAuth();
  }, [router]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.email || !formData.password || !formData.fullName) {
        toast.error(t('auth.pleaseFillAllFields'));
        setLoading(false);
        return;
      }

      if (!formData.inviteCode) {
        toast.error(t('invite.codeRequired'));
        setLoading(false);
        return;
      }

      if (!acceptedTerms) {
        toast.error(t('auth.acceptTermsRequired'));
        setLoading(false);
        return;
      }

      // Validate password strength
      const passwordErrors = [];
      if (formData.password.length < 8) {
        passwordErrors.push(locale === 'tr' ? 'en az 8 karakter' : 'at least 8 characters');
      }
      if (!/[A-Z]/.test(formData.password)) {
        passwordErrors.push(locale === 'tr' ? 'en az 1 büyük harf' : 'at least 1 uppercase letter');
      }
      if (!/[a-z]/.test(formData.password)) {
        passwordErrors.push(locale === 'tr' ? 'en az 1 küçük harf' : 'at least 1 lowercase letter');
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        passwordErrors.push(locale === 'tr' ? 'en az 1 noktalama işareti' : 'at least 1 punctuation mark');
      }
      if (passwordErrors.length > 0) {
        const errorMsg = locale === 'tr'
          ? `Şifre şunları içermeli: ${passwordErrors.join(', ')}`
          : `Password must contain: ${passwordErrors.join(', ')}`;
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      const response = await apiClient.auth.signup(formData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success('Account created successfully!');
      // Redirect to email verification pending page
      router.push('/auth/email-pending');
    } catch (error) {
      console.error('Signup error:', error);
      // Handle invite code specific errors
      if (error.response?.data?.code === 'INVITE_REQUIRED' ||
          error.response?.data?.code === 'INVALID_CODE' ||
          error.response?.data?.code === 'CODE_USED' ||
          error.response?.data?.code === 'CODE_EXPIRED' ||
          error.response?.data?.code === 'EMAIL_MISMATCH') {
        toast.error(t('invite.codeRequired'));
      } else {
        toast.error(error.response?.data?.error || t('auth.signupFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <Link href="/">
            <TelyxLogoFull width={200} height={60} darkMode={mounted && resolvedTheme === 'dark'} />
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl dark:border dark:border-neutral-700 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('auth.signupTitle')}
            </h1>
            <p className="text-gray-600 dark:text-neutral-400">{t('auth.signupSubtitle')}</p>
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
                  placeholder="email@example.com"
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
                  placeholder="••••••••"
                  className="pl-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                {locale === 'tr'
                  ? 'En az 8 karakter, büyük/küçük harf ve noktalama işareti içermeli'
                  : 'Must be 8+ chars with uppercase, lowercase and punctuation'}
              </p>
            </div>

            <div>
              <Label htmlFor="inviteCode">{t('invite.codeLabel')}</Label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder={t('invite.codePlaceholder')}
                  className="pl-10"
                  value={formData.inviteCode}
                  onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-2">
                {t('invite.noCode')}{' '}
                <Link href="/waitlist" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  {t('invite.applyEarlyAccess')}
                </Link>
              </p>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-neutral-600 dark:bg-neutral-700"
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-neutral-400">
                {t('auth.acceptTermsAndPrivacy')}{' '}
                <Link href="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  {t('auth.termsOfService')}
                </Link>
                {' '}{t('auth.and')}{' '}
                <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  {t('auth.privacyPolicy')}
                </Link>
              </label>
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

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-neutral-400">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              {t('common.signIn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

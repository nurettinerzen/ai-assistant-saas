'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Mail, Lock, User, Loader2, Ticket } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import { OnboardingModal } from '@/components/OnboardingModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    inviteCode: '',
  });

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

      if (formData.password.length < 8) {
        toast.error(t('auth.passwordMinLength'));
        setLoading(false);
        return;
      }

      const response = await apiClient.auth.signup(formData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success('Account created!');
      setShowOnboarding(true);
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

  const handleOnboardingComplete = () => {
    router.push('/dashboard');
  };

  if (showOnboarding) {
    return <OnboardingModal open={true} onClose={handleOnboardingComplete} />;
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
              <p className="text-xs text-gray-500 mt-1">{t('auth.mustBe8Chars')}</p>
            </div>

            <div>
              <Label htmlFor="inviteCode">{t('invite.codeLabel')}</Label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              <p className="text-xs text-gray-500 mt-2">
                {t('invite.noCode')}{' '}
                <Link href="/waitlist" className="text-indigo-600 hover:underline font-medium">
                  {t('invite.applyEarlyAccess')}
                </Link>
              </p>
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
        </div>
      </div>
    </div>
  );
}

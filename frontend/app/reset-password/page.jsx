'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Phone, Loader2, ArrowLeft, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { apiClient } from '@/lib/api';
import { TelyxLogoFull } from '@/components/TelyxLogo';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError(locale === 'tr' ? 'Geçersiz veya eksik token' : 'Invalid or missing token');
    }
  }, [token, locale]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(locale === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error(locale === 'tr' ? 'Şifre en az 6 karakter olmalı' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/api/auth/reset-password', {
        token,
        password: formData.password,
      });
      setSuccess(true);
      toast.success(locale === 'tr' ? 'Şifreniz başarıyla sıfırlandı!' : 'Your password has been reset successfully!');
    } catch (err) {
      console.error('Reset password error:', err);
      const errorCode = err.response?.data?.code;
      if (errorCode === 'INVALID_TOKEN') {
        setError(locale === 'tr' ? 'Bu link geçersiz veya kullanılmış.' : 'This link is invalid or has been used.');
      } else if (errorCode === 'TOKEN_EXPIRED') {
        setError(locale === 'tr' ? 'Bu linkin süresi dolmuş. Lütfen yeni bir link isteyin.' : 'This link has expired. Please request a new one.');
      } else {
        toast.error(
          locale === 'tr'
            ? 'Şifre sıfırlanamadı. Lütfen tekrar deneyin.'
            : 'Failed to reset password. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Error state
  if (error) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-8 w-8 text-error-600 dark:text-error-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          {locale === 'tr' ? 'Link Geçersiz' : 'Invalid Link'}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {error}
        </p>
        <Link href="/forgot-password">
          <Button>
            {locale === 'tr' ? 'Yeni Link İste' : 'Request New Link'}
          </Button>
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-success-600 dark:text-success-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          {locale === 'tr' ? 'Şifre Sıfırlandı!' : 'Password Reset!'}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {locale === 'tr'
            ? 'Şifreniz başarıyla değiştirildi. Artık yeni şifrenizle giriş yapabilirsiniz.'
            : 'Your password has been changed successfully. You can now log in with your new password.'}
        </p>
        <Link href="/login">
          <Button>
            {locale === 'tr' ? 'Giriş Yap' : 'Log In'}
          </Button>
        </Link>
      </div>
    );
  }

  // Form state
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          {locale === 'tr' ? 'Yeni Şifre Belirle' : 'Set New Password'}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {locale === 'tr'
            ? 'Yeni şifrenizi girin.'
            : 'Enter your new password.'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="password">{locale === 'tr' ? 'Yeni Şifre' : 'New Password'}</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="******"
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {locale === 'tr' ? 'En az 6 karakter' : 'At least 6 characters'}
          </p>
        </div>

        <div>
          <Label htmlFor="confirmPassword">{locale === 'tr' ? 'Şifreyi Onayla' : 'Confirm Password'}</Label>
          <div className="relative mt-1">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="******"
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {locale === 'tr' ? 'Sıfırlanıyor...' : 'Resetting...'}
            </>
          ) : (
            locale === 'tr' ? 'Şifreyi Sıfırla' : 'Reset Password'
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  const { locale } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <Toaster position="top-right" richColors />

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-8">
          {/* Logo and Language Switcher */}
          <div className="flex items-center justify-between mb-8">
            <TelyxLogoFull width={200} height={60} />
            <LanguageSwitcher />
          </div>

          {/* Back Link */}
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {locale === 'tr' ? 'Giriş sayfasına dön' : 'Back to login'}
          </Link>

          <Suspense fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          }>
            <ResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

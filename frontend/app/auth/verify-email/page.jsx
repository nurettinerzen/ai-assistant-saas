'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Phone, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Doğrulama linki geçersiz. Token bulunamadı.');
      return;
    }

    verifyEmail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verifyEmail = async () => {
    try {
      setStatus('verifying');

      const response = await apiClient.get(`/api/auth/verify-email?token=${token}`);
      const data = response.data;

      setStatus('success');
      setEmail(data.email);
      toast.success('Email adresiniz başarıyla doğrulandı!');

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Verification error:', error);

      const data = error.response?.data;
      if (data?.code === 'TOKEN_EXPIRED') {
        setStatus('expired');
        setErrorMessage('Doğrulama linkinin süresi dolmuş. Yeni bir link talep edebilirsiniz.');
      } else {
        setStatus('error');
        setErrorMessage(data?.error || 'Doğrulama başarısız oldu.');
      }
    }
  };

  const handleRequestNewLink = () => {
    router.push('/auth/email-pending');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <Toaster position="top-right" richColors />

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-8">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-neutral-900 dark:text-white">Telyx</span>
            </div>
          </div>

          {/* Verifying State */}
          {status === 'verifying' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Email Doğrulanıyor
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400">
                Lütfen bekleyin, email adresiniz doğrulanıyor...
              </p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Email Doğrulandı!
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {email && <span className="font-medium">{email}</span>} adresi başarıyla doğrulandı.
                Dashboard&apos;a yönlendiriliyorsunuz...
              </p>
              <Button onClick={handleGoToDashboard} className="w-full">
                Dashboard&apos;a Git
              </Button>
            </div>
          )}

          {/* Expired State */}
          {status === 'expired' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Link Süresi Dolmuş
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Button onClick={handleRequestNewLink} className="w-full">
                  Yeni Link Talep Et
                </Button>
                <Button variant="outline" onClick={handleGoToLogin} className="w-full">
                  Giriş Sayfasına Dön
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Doğrulama Başarısız
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Button onClick={handleRequestNewLink} className="w-full">
                  Yeni Link Talep Et
                </Button>
                <Button variant="outline" onClick={handleGoToLogin} className="w-full">
                  Giriş Sayfasına Dön
                </Button>
              </div>
            </div>
          )}

          {/* Help Link */}
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mt-6">
            Sorun mu yaşıyorsunuz?{' '}
            <Link href="mailto:support@telyx.ai" className="text-primary-600 dark:text-primary-400 hover:underline">
              Destek alın
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Yükleniyor...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

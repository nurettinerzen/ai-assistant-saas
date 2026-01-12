'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Mail, RefreshCw, Loader2, CheckCircle, Edit3, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import { apiClient } from '@/lib/api';
import { TelyxLogoFull } from '@/components/TelyxLogo';

export default function EmailPendingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmailData, setNewEmailData] = useState({
    newEmail: '',
    password: ''
  });

  useEffect(() => {
    checkAuthStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await apiClient.get('/api/auth/me');
      const userData = response.data;
      setUser(userData);

      // If already verified, redirect to dashboard
      if (userData.emailVerified) {
        router.push('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResending(true);
      const response = await apiClient.post('/api/auth/resend-verification');

      toast.success('Doğrulama emaili gönderildi!');

      // Set countdown to 3 minutes
      setCountdown(180);
    } catch (error) {
      console.error('Resend error:', error);

      if (error.response?.data?.code === 'RATE_LIMITED') {
        const remainingSeconds = error.response.data.remainingSeconds;
        setCountdown(remainingSeconds);
        toast.error(`Lütfen ${Math.ceil(remainingSeconds / 60)} dakika bekleyin.`);
      } else {
        toast.error(error.response?.data?.error || 'Email gönderilemedi.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();

    try {
      setChangingEmail(true);

      const response = await apiClient.post('/api/auth/change-email', newEmailData);

      toast.success('Email adresiniz değiştirildi. Yeni adresinize doğrulama linki gönderildi.');
      setUser(prev => ({ ...prev, email: response.data.email }));
      setShowChangeEmail(false);
      setNewEmailData({ newEmail: '', password: '' });
      setCountdown(180);
    } catch (error) {
      console.error('Change email error:', error);
      toast.error(error.response?.data?.error || 'Email değiştirilemedi.');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <Toaster position="top-right" richColors />

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-8">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <TelyxLogoFull width={200} height={60} />
          </div>

          {/* Main Content */}
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Email Doğrulama Bekleniyor
            </h1>

            <p className="text-neutral-600 dark:text-neutral-400 mb-2">
              Hesabınızı kullanmaya başlamak için email adresinizi doğrulamanız gerekiyor.
            </p>

            <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3 mb-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Doğrulama linki gönderildi:</p>
              <p className="font-medium text-neutral-900 dark:text-white">{user?.email}</p>
            </div>

            {!showChangeEmail ? (
              <div className="space-y-3">
                {/* Resend Button */}
                <Button
                  onClick={handleResendVerification}
                  disabled={resending || countdown > 0}
                  className="w-full"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tekrar Gönder ({formatCountdown(countdown)})
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Doğrulama Emailini Tekrar Gönder
                    </>
                  )}
                </Button>

                {/* Change Email Button */}
                <Button
                  variant="outline"
                  onClick={() => setShowChangeEmail(true)}
                  className="w-full"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Email Adresini Değiştir
                </Button>

                {/* Logout Button */}
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full text-neutral-500 hover:text-neutral-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Çıkış Yap
                </Button>
              </div>
            ) : (
              /* Change Email Form */
              <form onSubmit={handleChangeEmail} className="space-y-4 text-left">
                <div>
                  <Label htmlFor="newEmail">Yeni Email Adresi</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    placeholder="yeni@email.com"
                    value={newEmailData.newEmail}
                    onChange={(e) => setNewEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Şifreniz (Doğrulama için)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mevcut şifreniz"
                    value={newEmailData.password}
                    onChange={(e) => setNewEmailData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowChangeEmail(false);
                      setNewEmailData({ newEmail: '', password: '' });
                    }}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    disabled={changingEmail}
                    className="flex-1"
                  >
                    {changingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Değiştiriliyor...
                      </>
                    ) : (
                      'Email Değiştir'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
            <div className="flex gap-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Spam klasörünü kontrol edin</p>
                <p>Doğrulama emaili gelmediyse spam veya gereksiz klasörünüzü kontrol edin.</p>
              </div>
            </div>
          </div>

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

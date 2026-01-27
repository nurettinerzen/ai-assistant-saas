'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Mail,
  Building2,
  UserPlus,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function getRoleDisplayName(role) {
  const names = {
    OWNER: 'İşletme Sahibi',
    MANAGER: 'Yönetici',
    STAFF: 'Personel'
  };
  return names[role] || role;
}

function getRoleBadgeColor(role) {
  const colors = {
    OWNER: 'bg-teal-100 text-teal-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    STAFF: 'bg-gray-100 text-gray-800'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [existingUser, setExistingUser] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Form state for new users
  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    setLoading(true);
    try {
      const response = await apiClient.team.getInvitationByToken(token);
      setInvitation(response.data.invitation);
      setExistingUser(response.data.existingUser);
    } catch (error) {
      const message = error.response?.data?.error || 'Davet bulunamadı';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();

    // Validate form for new users
    if (!existingUser) {
      if (!form.name.trim()) {
        toast.error('İsim alanı gerekli');
        return;
      }
      if (form.password.length < 6) {
        toast.error('Şifre en az 6 karakter olmalı');
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error('Şifreler eşleşmiyor');
        return;
      }
    }

    setAccepting(true);
    try {
      const data = existingUser ? {} : { name: form.name, password: form.password };
      const response = await apiClient.team.acceptInvitation(token, data);

      // Save token and user to localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      setAccepted(true);
      toast.success('Daveti kabul ettiniz! Yönlendiriliyorsunuz...');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      const message = error.response?.data?.error || 'Davet kabul edilemedi';
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-neutral-600">Davet yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Davet Geçersiz</h2>
              <p className="text-neutral-600 mb-6">{error}</p>
              <Button onClick={() => router.push('/login')}>
                Giriş Sayfasına Git
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (accepted) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Hoş Geldiniz!</h2>
              <p className="text-neutral-600 mb-2">
                {invitation.businessName} ekibine katıldınız.
              </p>
              <p className="text-sm text-neutral-500">
                Dashboard'a yönlendiriliyorsunuz...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invitation details
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="h-8 w-8 text-primary-600" />
          </div>
          <CardTitle className="text-2xl">Ekibe Katılın</CardTitle>
          <CardDescription>
            {invitation.businessName} işletmesine davet edildiniz
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Invitation Details */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
              <Building2 className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm text-neutral-500">İşletme</p>
                <p className="font-medium">{invitation.businessName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
              <Mail className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm text-neutral-500">Email</p>
                <p className="font-medium">{invitation.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
              <Shield className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm text-neutral-500">Rol</p>
                <Badge className={getRoleBadgeColor(invitation.role)}>
                  {getRoleDisplayName(invitation.role)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
              <Clock className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm text-neutral-500">Davet Eden</p>
                <p className="font-medium">{invitation.invitedBy}</p>
              </div>
            </div>
          </div>

          {/* Accept Form */}
          <form onSubmit={handleAccept}>
            {/* New user registration fields */}
            {!existingUser && (
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Adınız</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ad Soyad"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="En az 6 karakter"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Şifrenizi tekrar girin"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={accepting}>
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Daveti Kabul Et
                </>
              )}
            </Button>
          </form>

          {/* Expiry notice */}
          <p className="text-xs text-neutral-500 text-center mt-4">
            Bu davet{' '}
            {new Date(invitation.expiresAt).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            tarihine kadar geçerlidir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

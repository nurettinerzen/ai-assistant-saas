/**
 * Settings Page
 * User profile, notifications, and account settings
 * UPDATE EXISTING FILE: frontend/app/dashboard/settings/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Bell, AlertTriangle, Globe, Mail, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: '', email: '', company: '' });
  const [region, setRegion] = useState({ language: 'TR', country: 'TR', timezone: 'Europe/Istanbul' });
  const [notifications, setNotifications] = useState({
    emailOnCall: true,
    emailOnLimit: true,
    weeklySummary: true,
    smsNotifications: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailSignature, setEmailSignature] = useState({
    signature: '',
    signatureType: 'PLAIN',
  });
  const [signatureLoading, setSignatureLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [profileRes, notificationsRes] = await Promise.all([
        apiClient.settings.getProfile(),
        apiClient.settings.getNotifications(),
      ]);

      setProfile({
        name: profileRes.data?.name || '',
        email: profileRes.data?.email || '',
        company: profileRes.data?.company || ''
      });

      setNotifications({
        emailOnCall: notificationsRes.data?.emailOnCall ?? true,
        emailOnLimit: notificationsRes.data?.emailOnLimit ?? true,
        weeklySummary: notificationsRes.data?.weeklySummary ?? true,
        smsNotifications: notificationsRes.data?.smsNotifications ?? false
      });

      // Business bilgisini profileRes'ten al
      const bizData = profileRes.data?.business || {};
      setRegion({
        language: bizData.language || 'TR',
        country: bizData.country || 'TR',
        timezone: bizData.timezone || 'Europe/Istanbul'
      });

      // Load email signature
      try {
        const signatureRes = await apiClient.email.getSignature();
        if (signatureRes.data) {
          setEmailSignature({
            signature: signatureRes.data.emailSignature || '',
            signatureType: signatureRes.data.signatureType || 'PLAIN',
          });
        }
      } catch (sigError) {
        // Email integration might not exist yet, ignore
        console.log('Email signature not found:', sigError.message);
      }
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateProfile(profile),
        t('dashboard.settingsPage.savingProfile'),
        t('dashboard.settingsPage.profileUpdatedSuccess')
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateNotifications(notifications),
        t('dashboard.settingsPage.savingPreferences'),
        t('dashboard.settingsPage.notificationPreferencesUpdated')
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleSaveRegion = async () => {
  try {
    await toastHelpers.async(
      apiClient.settings.updateProfile(region),
      t('dashboard.settingsPage.savingRegion'),
      t('dashboard.settingsPage.regionUpdated')
    );
  } catch (error) {
    console.error('Update region error:', error);
    toast.error(t('dashboard.settingsPage.regionUpdateFailed'));
  }
};

  const handleSaveSignature = async () => {
    setSignatureLoading(true);
    try {
      await apiClient.email.updateSignature({
        emailSignature: emailSignature.signature,
        signatureType: emailSignature.signatureType,
      });
      toast.success(t('dashboard.settingsPage.signatureSaved') || 'Email imzası kaydedildi');
    } catch (error) {
      toast.error(t('dashboard.settingsPage.signatureFailed') || 'İmza kaydedilemedi');
    } finally {
      setSignatureLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('dashboard.settingsPage.passwordsDoNotMatch'));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error(t('errors.passwordTooShort'));
      return;
    }

    try {
      await toastHelpers.async(
        apiClient.settings.changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
        t('dashboard.settingsPage.changingPassword'),
        t('dashboard.settingsPage.passwordChangedSuccess')
      );
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      // Error handled
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.settingsPage.manageAccountPreferences')}</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.profileInformation')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.updatePersonalDetails')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">{t('dashboard.settingsPage.fullNameLabel')}</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">{t('dashboard.settingsPage.emailAddressLabel')}</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company">{t('dashboard.settingsPage.companyNameOptional')}</Label>
            <Input
              id="company"
              value={profile.company || ''}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveProfile}>{t('dashboard.settingsPage.saveChangesBtn')}</Button>
        </div>
      </div>

      {/* Business Type Section - Removed
         Business type is now set during onboarding and cannot be changed afterwards.
         This prevents confusion and ensures integrations remain consistent. */}

      {/* Region & Language Section */}
      {can('settings:edit') && (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Globe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.regionSettings')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.regionDescription')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{t('dashboard.settingsPage.language')}</Label>
            <Select value={region.language} onValueChange={(val) => setRegion({...region, language: val})}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder={t('dashboard.settingsPage.selectLanguage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TR">Türkçe</SelectItem>
                <SelectItem value="EN">English</SelectItem>
                <SelectItem value="DE">Deutsch</SelectItem>
                <SelectItem value="ES">Español</SelectItem>
                <SelectItem value="FR">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="country">{t('dashboard.settingsPage.country')}</Label>
            <Select value={region.country} onValueChange={(val) => setRegion({...region, country: val})}>
              <SelectTrigger id="country" className="w-full">
                <SelectValue placeholder={t('dashboard.settingsPage.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TR">Türkiye</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="NL">Netherlands</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="timezone">{t('dashboard.settingsPage.timezone')}</Label>
            <Select value={region.timezone} onValueChange={(val) => setRegion({...region, timezone: val})}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue placeholder={t('dashboard.settingsPage.selectTimezone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Istanbul">(UTC+3) Istanbul</SelectItem>
                <SelectItem value="Europe/London">(UTC+0) London</SelectItem>
                <SelectItem value="Europe/Paris">(UTC+1) Paris</SelectItem>
                <SelectItem value="Europe/Berlin">(UTC+1) Berlin</SelectItem>
                <SelectItem value="America/New_York">(UTC-5) New York</SelectItem>
                <SelectItem value="America/Los_Angeles">(UTC-8) Los Angeles</SelectItem>
                <SelectItem value="Asia/Dubai">(UTC+4) Dubai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveRegion}>{t('dashboard.settingsPage.saveRegion')}</Button>
        </div>
      </div>
      )}

      {/* Email Signature Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {t('dashboard.settingsPage.emailSignatureTitle') || 'Email İmzası'}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('dashboard.settingsPage.emailSignatureDescription') || 'AI asistanınız tarafından gönderilen emaillerde kullanılacak imza'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="signatureType">
              {t('dashboard.settingsPage.signatureTypeLabel') || 'İmza Türü'}
            </Label>
            <Select
              value={emailSignature.signatureType}
              onValueChange={(val) => setEmailSignature({...emailSignature, signatureType: val})}
            >
              <SelectTrigger id="signatureType" className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLAIN">Düz Metin</SelectItem>
                <SelectItem value="HTML">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="emailSignature">
              {t('dashboard.settingsPage.signatureLabel') || 'İmza İçeriği'}
            </Label>
            <Textarea
              id="emailSignature"
              rows={6}
              placeholder={emailSignature.signatureType === 'HTML'
                ? '<p>Saygılarımla,</p><p><strong>Ad Soyad</strong></p><p>Şirket Adı</p>'
                : 'Saygılarımla,\nAd Soyad\nŞirket Adı\nTel: +90 xxx xxx xx xx'
              }
              value={emailSignature.signature}
              onChange={(e) => setEmailSignature({...emailSignature, signature: e.target.value})}
              className="font-mono text-sm"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {emailSignature.signatureType === 'HTML'
                ? 'HTML etiketleri kullanabilirsiniz (p, strong, a, br vb.)'
                : 'Her satır için yeni satır karakteri kullanın'
              }
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveSignature} disabled={signatureLoading}>
            {signatureLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('dashboard.settingsPage.saveSignatureBtn') || 'İmzayı Kaydet'}
          </Button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.notificationsTitle')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.configureUpdates')}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{t('dashboard.settingsPage.emailOnNewCall')}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.notifyOnCall')}</p>
            </div>
            <Switch
              checked={notifications.emailOnCall}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, emailOnCall: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{t('dashboard.settingsPage.usageLimitAlerts')}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.alertApproachingLimit')}</p>
            </div>
            <Switch
              checked={notifications.emailOnLimit}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, emailOnLimit: checked })
              }
            />
          </div>

          <Separator className="dark:bg-neutral-700" />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{t('dashboard.settingsPage.weeklySummaryLabel')}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.receiveWeeklyReports')}</p>
            </div>
            <Switch
              checked={notifications.weeklySummary}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, weeklySummary: checked })
              }
            />
          </div>

          <Separator className="dark:bg-neutral-700" />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{t('dashboard.settingsPage.smsNotificationsLabel')}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.criticalAlertsViaSms')}</p>
            </div>
            <Switch
              checked={notifications.smsNotifications}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, smsNotifications: checked })
              }
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveNotifications}>{t('dashboard.settingsPage.savePreferencesBtn')}</Button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.securityTitle')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.managePasswordLabel')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">{t('dashboard.settingsPage.currentPasswordLabel')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="newPassword">{t('dashboard.settingsPage.newPasswordLabel')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t('dashboard.settingsPage.confirmNewPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleChangePassword}>{t('dashboard.settingsPage.changePasswordBtn')}</Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-300">{t('dashboard.settingsPage.dangerZoneTitle')}</h2>
        </div>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4">
          {t('dashboard.settingsPage.deleteAccountWarning')}
        </p>
        <Button variant="destructive">{t('dashboard.settingsPage.deleteAccountBtn')}</Button>
      </div>
    </div>
  );
}


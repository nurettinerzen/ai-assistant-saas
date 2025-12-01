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
import { User, Bell, CreditCard, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { t, getCurrentLanguage } from '@/lib/translations';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState('en');
  const [profile, setProfile] = useState({ name: '', email: '', company: '' });
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

  useEffect(() => {
    setLocale(getCurrentLanguage());
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [profileRes, notificationsRes] = await Promise.all([
        apiClient.settings.getProfile(),
        apiClient.settings.getNotifications(),
      ]);
      setProfile(profileRes.data);
      setNotifications(notificationsRes.data);
    } catch (error) {
      toast.error(t('saveError', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateProfile(profile),
        t('savingProfile', locale),
        t('profileUpdatedSuccess', locale)
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateNotifications(notifications),
        t('savingPreferences', locale),
        t('notificationPreferencesUpdated', locale)
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('passwordsDoNotMatch2', locale));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error(t('passwordMinLength', locale));
      return;
    }

    try {
      await toastHelpers.async(
        apiClient.settings.changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
        t('changingPassword', locale),
        t('passwordChangedSuccess', locale)
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
        <h1 className="text-3xl font-bold text-neutral-900">{t('settingsTitle2', locale)}</h1>
        <p className="text-neutral-600 mt-1">{t('manageAccountPreferences', locale)}</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <User className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('profileInformation', locale)}</h2>
            <p className="text-sm text-neutral-500">{t('updatePersonalDetails', locale)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">{t('fullNameLabel', locale)}</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">{t('emailAddressLabel', locale)}</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company">{t('companyNameOptional', locale)}</Label>
            <Input
              id="company"
              value={profile.company || ''}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveProfile}>{t('saveChangesBtn', locale)}</Button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Bell className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('notificationsTitle', locale)}</h2>
            <p className="text-sm text-neutral-500">{t('configureUpdates', locale)}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">{t('emailOnNewCall', locale)}</p>
              <p className="text-sm text-neutral-500">{t('notifyOnCall', locale)}</p>
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
              <p className="font-medium text-neutral-900">{t('usageLimitAlerts', locale)}</p>
              <p className="text-sm text-neutral-500">{t('alertApproachingLimit', locale)}</p>
            </div>
            <Switch
              checked={notifications.emailOnLimit}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, emailOnLimit: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">{t('weeklySummaryLabel', locale)}</p>
              <p className="text-sm text-neutral-500">{t('receiveWeeklyReports', locale)}</p>
            </div>
            <Switch
              checked={notifications.weeklySummary}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, weeklySummary: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">{t('smsNotificationsLabel', locale)}</p>
              <p className="text-sm text-neutral-500">{t('criticalAlertsViaSms', locale)}</p>
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
          <Button onClick={handleSaveNotifications}>{t('savePreferencesBtn', locale)}</Button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('securityTitle', locale)}</h2>
            <p className="text-sm text-neutral-500">{t('managePasswordLabel', locale)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">{t('currentPasswordLabel', locale)}</Label>
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
            <Label htmlFor="newPassword">{t('newPasswordLabel', locale)}</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t('confirmNewPassword', locale)}</Label>
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
          <Button onClick={handleChangePassword}>{t('changePasswordBtn', locale)}</Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">{t('dangerZoneTitle', locale)}</h2>
        </div>
        <p className="text-sm text-red-700 mb-4">
          {t('deleteAccountWarning2', locale)}
        </p>
        <Button variant="destructive">{t('deleteAccountBtn', locale)}</Button>
      </div>
    </div>
  );
}

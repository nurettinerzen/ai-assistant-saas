/**
 * Settings Page
 * User profile, notifications, and account settings
 * UPDATE EXISTING FILE: frontend/app/dashboard/settings/page.jsx
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SecurePasswordInput } from '@/components/ui/secure-password-input';
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
import { User, Bell, AlertTriangle, Globe, Mail, Loader2, Phone, Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import PageIntro from '@/components/PageIntro';
import { getPageHelp } from '@/content/pageHelp';

import {
  useProfile,
  useNotifications,
  useEmailSignature,
  useEmailPairStats,
  usePhoneNumbers,
  useUpdateProfile,
  useUpdateNotifications,
  useUpdateEmailSignature,
  useChangePassword,
} from '@/hooks/useSettings';

export default function SettingsPage() {
  const { t, locale, changeLocale } = useLanguage();
  const { can } = usePermissions();
  const pageHelp = getPageHelp('settings', locale);

  // React Query hooks
  const { data: profileData, isLoading: profileLoading } = useProfile();
  const { data: notificationsData, isLoading: notificationsLoading } = useNotifications();
  const { data: signatureData, isLoading: signatureLoading } = useEmailSignature();
  const { data: pairStats } = useEmailPairStats();
  const { data: phoneNumbers = [] } = usePhoneNumbers();

  const updateProfile = useUpdateProfile();
  const updateNotifications = useUpdateNotifications();
  const updateEmailSignature = useUpdateEmailSignature();
  const changePassword = useChangePassword();

  const loading = profileLoading || notificationsLoading || signatureLoading;

  // Local state for form inputs
  const [profile, setProfile] = useState({ name: '', email: '', company: '' });
  const [region, setRegion] = useState({ language: 'TR', country: 'TR', timezone: 'Europe/Istanbul' });
  const [businessIdentity, setBusinessIdentity] = useState({
    aliases: '',
    identitySummary: '',
  });
  const [notifications, setNotifications] = useState({
    emailOnCall: true,
    emailOnLimit: true,
    weeklySummary: true,
    smsNotifications: false,
  });
  const [emailSignature, setEmailSignature] = useState({
    signature: '',
    signatureType: 'PLAIN',
  });
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Password values stored in refs to avoid React DevTools exposure
  const passwordValues = useRef({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Update local state when data is loaded
  useEffect(() => {
    if (profileData) {
      setProfile({
        name: profileData.name,
        email: profileData.email,
        company: profileData.company,
      });
      const bizData = profileData.business || {};
      setRegion({
        language: bizData.language || 'TR',
        country: bizData.country || 'TR',
        timezone: bizData.timezone || 'Europe/Istanbul',
      });
      setBusinessIdentity({
        aliases: Array.isArray(bizData.aliases) ? bizData.aliases.join(', ') : '',
        identitySummary: bizData.identitySummary || '',
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (notificationsData) {
      setNotifications(notificationsData);
    }
  }, [notificationsData]);

  useEffect(() => {
    if (signatureData) {
      setEmailSignature(signatureData);
    }
  }, [signatureData]);

  const handleSaveProfile = async () => {
    try {
      await toastHelpers.async(
        updateProfile.mutateAsync(profile),
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
        updateNotifications.mutateAsync(notifications),
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
      updateProfile.mutateAsync(region),
      t('dashboard.settingsPage.savingRegion'),
      t('dashboard.settingsPage.regionUpdated')
    );
  } catch (error) {
    console.error('Update region error:', error);
    toast.error(t('dashboard.settingsPage.regionUpdateFailed'));
  }
};

  const handleSaveBusinessIdentity = async () => {
    const parsedAliases = businessIdentity.aliases
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      await toastHelpers.async(
        updateProfile.mutateAsync({
          aliases: parsedAliases,
          identitySummary: businessIdentity.identitySummary,
        }),
        'Saving business identity...',
        'Business identity updated'
      );
    } catch (error) {
      console.error('Update business identity error:', error);
      toast.error('Failed to update business identity');
    }
  };

  const handleSaveSignature = async () => {
    try {
      await updateEmailSignature.mutateAsync({
        emailSignature: emailSignature.signature,
        signatureType: emailSignature.signatureType,
      });
      toast.success(t('dashboard.settingsPage.signatureSaved'));
    } catch (error) {
      toast.error(t('dashboard.settingsPage.signatureFailed'));
    }
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordValues.current;

    if (newPassword !== confirmPassword) {
      toast.error(t('dashboard.settingsPage.passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('errors.passwordTooShort'));
      return;
    }

    try {
      await toastHelpers.async(
        changePassword.mutateAsync({
          currentPassword,
          newPassword,
        }),
        t('dashboard.settingsPage.changingPassword'),
        t('dashboard.settingsPage.passwordChangedSuccess')
      );
      // Clear password values after successful change
      passwordValues.current = { currentPassword: '', newPassword: '', confirmPassword: '' };
      // Force re-render to clear inputs
      window.location.reload();
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
      <PageIntro
        title={pageHelp?.title || t('dashboard.settingsPage.title')}
        subtitle={pageHelp?.subtitle}
        locale={locale}
        help={pageHelp ? { tooltipTitle: pageHelp.tooltipTitle, tooltipBody: pageHelp.tooltipBody, quickSteps: pageHelp.quickSteps } : undefined}
      />

      {/* Profile Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.profileInformation')}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.updatePersonalDetails')}</p>
          </div>
        </div>

        <div className="space-y-3">
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

      {/* Business Identity Section */}
      {can('settings:edit') && (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <Globe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Business Identity</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Alternative spellings and short company summary used by resolver.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="aliases">Şirket adının farklı yazımları</Label>
            <Textarea
              id="aliases"
              value={businessIdentity.aliases}
              onChange={(e) => setBusinessIdentity({ ...businessIdentity, aliases: e.target.value })}
              placeholder="Örn: Telyx, Telix, Telyks"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="identitySummary">Identity Summary</Label>
            <Textarea
              id="identitySummary"
              value={businessIdentity.identitySummary}
              onChange={(e) => setBusinessIdentity({ ...businessIdentity, identitySummary: e.target.value })}
              placeholder="Şirketinizi 1-2 cümleyle tanımlayın"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveBusinessIdentity}>Save Identity</Button>
        </div>
      </div>
      )}

      {/* Business Type Section - Removed
         Business type is now set during onboarding and cannot be changed afterwards.
         This prevents confusion and ensures integrations remain consistent. */}

      {/* Region & Language Section */}
      {can('settings:edit') && (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <Globe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.regionSettings')}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.regionDescription')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{t('dashboard.settingsPage.language')}</Label>
            <Select value={region.language} onValueChange={(val) => {
              setRegion({...region, language: val});
              changeLocale(val.toLowerCase());
            }}>
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
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t('dashboard.settingsPage.emailSignatureTitle')}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('dashboard.settingsPage.emailSignatureDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="signatureType">
              {t('dashboard.settingsPage.signatureTypeLabel')}
            </Label>
            <Select
              value={emailSignature.signatureType}
              onValueChange={(val) => setEmailSignature({...emailSignature, signatureType: val})}
            >
              <SelectTrigger id="signatureType" className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLAIN">{t('dashboard.settingsPage.signatureTypePlain')}</SelectItem>
                <SelectItem value="HTML">{t('dashboard.settingsPage.signatureTypeHtml')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="emailSignature">
              {t('dashboard.settingsPage.signatureLabel')}
            </Label>
            <Textarea
              id="emailSignature"
              rows={6}
              placeholder={emailSignature.signatureType === 'HTML'
                ? t('dashboard.settingsPage.signaturePlaceholderHtml')
                : t('dashboard.settingsPage.signaturePlaceholderPlain')
              }
              value={emailSignature.signature}
              onChange={(e) => setEmailSignature({...emailSignature, signature: e.target.value})}
              className="font-mono text-sm"
            />
            {!emailSignature.signature && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('dashboard.settingsPage.signatureWarning')}
              </p>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {emailSignature.signatureType === 'HTML'
                ? t('dashboard.settingsPage.signatureHelpHtml')
                : t('dashboard.settingsPage.signatureHelpPlain')
              }
            </p>
          </div>

          {/* Pair Stats */}
          {pairStats && pairStats.total > 0 && (
            <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                <span className="font-semibold text-neutral-900 dark:text-white">{pairStats.total}</span> {t('dashboard.settingsPage.learnedEmailPatterns')}
                {pairStats.byLanguage && pairStats.byLanguage.length > 0 && (
                  <span className="ml-2">
                    ({pairStats.byLanguage.map(l => `${l._count._all} ${l.language}`).join(', ')})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveSignature} disabled={updateEmailSignature.isPending}>
            {updateEmailSignature.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('dashboard.settingsPage.saveSignatureBtn')}
          </Button>
        </div>
      </div>

      {/* Channels Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg">
              <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t('dashboard.settingsPage.channelsTitle')}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('dashboard.settingsPage.channelsDescription')}
              </p>
            </div>
          </div>
        </div>

        {phoneNumbers.length > 0 ? (
          <div className="space-y-3">
            {/* Phone Number Card */}
            {phoneNumbers.map((number) => (
              <div
                key={number.id}
                className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    <div>
                      <p className="font-mono font-semibold text-lg text-neutral-900 dark:text-white">
                        {number.phoneNumber}
                      </p>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {number.assistantName ? (
                          <span>{t('dashboard.settingsPage.assignedTo')} <span className="text-neutral-900 dark:text-white font-medium">{number.assistantName}</span></span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">{t('dashboard.settingsPage.noAssistantAssigned')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => window.location.href = '/dashboard/phone-numbers'}
                    className="flex-1"
                  >
                    {t('dashboard.settingsPage.manage')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPhoneModal(true)}
                  >
                    {t('dashboard.settingsPage.change')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-50 text-neutral-400" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t('dashboard.settingsPage.noPhoneConnected')}
            </p>
            <Button
              size="sm"
              onClick={() => setShowPhoneModal(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.settingsPage.connectPhoneNumber')}
            </Button>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.notificationsTitle')}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.configureUpdates')}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{t('dashboard.settingsPage.emailOnNewCall')}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.notifyOnCall')}</p>
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.alertApproachingLimit')}</p>
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.receiveWeeklyReports')}</p>
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.criticalAlertsViaSms')}</p>
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
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.settingsPage.securityTitle')}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.settingsPage.managePasswordLabel')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="currentPassword">{t('dashboard.settingsPage.currentPasswordLabel')}</Label>
            <SecurePasswordInput
              id="currentPassword"
              autoComplete="current-password"
              onValueChange={(val) => passwordValues.current.currentPassword = val}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">{t('dashboard.settingsPage.newPasswordLabel')}</Label>
            <SecurePasswordInput
              id="newPassword"
              autoComplete="new-password"
              showToggle
              onValueChange={(val) => passwordValues.current.newPassword = val}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t('dashboard.settingsPage.confirmNewPassword')}</Label>
            <SecurePasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              onValueChange={(val) => passwordValues.current.confirmPassword = val}
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleChangePassword}>{t('dashboard.settingsPage.changePasswordBtn')}</Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h2 className="text-base font-semibold text-red-900 dark:text-red-300">{t('dashboard.settingsPage.dangerZoneTitle')}</h2>
        </div>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4">
          {t('dashboard.settingsPage.deleteAccountWarning')}
        </p>
        <Button variant="destructive">{t('dashboard.settingsPage.deleteAccountBtn')}</Button>
      </div>
    </div>
  );
}

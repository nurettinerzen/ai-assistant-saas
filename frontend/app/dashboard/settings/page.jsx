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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
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
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateProfile(profile),
        'Saving profile...',
        'Profile updated successfully!'
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await toastHelpers.async(
        apiClient.settings.updateNotifications(notifications),
        'Saving preferences...',
        'Notification preferences updated!'
      );
    } catch (error) {
      // Error handled
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await toastHelpers.async(
        apiClient.settings.changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
        'Changing password...',
        'Password changed successfully!'
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
        <h1 className="text-3xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-600 mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <User className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Profile Information</h2>
            <p className="text-sm text-neutral-500">Update your personal details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company">Company Name (Optional)</Label>
            <Input
              id="company"
              value={profile.company || ''}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveProfile}>Save Changes</Button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Bell className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Notifications</h2>
            <p className="text-sm text-neutral-500">Configure how you receive updates</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">Email on new call</p>
              <p className="text-sm text-neutral-500">Get notified when you receive a call</p>
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
              <p className="font-medium text-neutral-900">Usage limit alerts</p>
              <p className="text-sm text-neutral-500">Alert when approaching credit limit</p>
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
              <p className="font-medium text-neutral-900">Weekly summary</p>
              <p className="text-sm text-neutral-500">Receive weekly performance reports</p>
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
              <p className="font-medium text-neutral-900">SMS notifications</p>
              <p className="text-sm text-neutral-500">Get critical alerts via SMS</p>
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
          <Button onClick={handleSaveNotifications}>Save Preferences</Button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Security</h2>
            <p className="text-sm text-neutral-500">Manage your password</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
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
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
          <Button onClick={handleChangePassword}>Change Password</Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        <p className="text-sm text-red-700 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button variant="destructive">Delete Account</Button>
      </div>
    </div>
  );
}

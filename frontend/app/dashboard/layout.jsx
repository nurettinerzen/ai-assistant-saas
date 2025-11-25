/**
 * Dashboard Layout
 * Main layout wrapper with sidebar navigation
 * UPDATE EXISTING FILE: frontend/app/dashboard/layout.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { apiClient } from '@/lib/api';
import { Toaster } from 'sonner';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load user data
    loadUserData();

  }, [router]);

  const loadUserData = async () => {
    try {
      // Load user profile
      const userResponse = await apiClient.settings.getProfile();
      setUser(userResponse.data);

      // Load subscription/credits
      const subResponse = await apiClient.subscription.getCurrent();
      setCredits(subResponse.data.credits || 0);
    } catch (error) {
      console.error('Failed to load user data:', error);
      // If unauthorized, redirect to login
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
  localStorage.setItem('onboarding_completed', 'true');
  setShowOnboarding(false);
  // Reload data to show new assistant
  window.location.reload();
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <Sidebar user={user} credits={credits} />

      {/* Main content */}
      <div className="flex-1 lg:ml-64 overflow-auto">
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />

      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}

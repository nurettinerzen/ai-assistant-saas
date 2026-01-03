'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { apiClient } from '@/lib/api';
import { Toaster } from 'sonner';
import { OnboardingModal } from '@/components/OnboardingModal';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔥 YENİ: Ayrı useEffect - Sidebar scroll position'ını koru
  useEffect(() => {
    const sidebar = document.querySelector('[data-sidebar-nav]');
    if (sidebar) {
      const scrollPos = sessionStorage.getItem('sidebar-scroll');
      if (scrollPos) {
        sidebar.scrollTop = parseInt(scrollPos);
      }
    }
  }, [pathname]);

  const loadUserData = async () => {
    try {
      // Load user profile from /api/auth/me (includes onboardingCompleted)
      const userResponse = await apiClient.get('/api/auth/me');
      setUser(userResponse.data);

      const userData = userResponse.data;

      // Check if email verification is needed
      // Skip for invited members (they got invited to verified account)
      // Skip for users who signed up with Google OAuth (emailVerified will be true)
      const isInvitedMember = userData.acceptedAt || (userData.role && userData.role !== 'OWNER');
      if (!userData.emailVerified && !isInvitedMember) {
        // Redirect to email pending page
        router.push('/auth/email-pending');
        return;
      }

      // Check if onboarding is needed
      // Team members (non-owners) who were invited should skip onboarding
      if (userData.onboardingCompleted === false) {
        // If user was invited (has acceptedAt) or is not owner, skip onboarding
        if (isInvitedMember) {
          // Auto-complete onboarding for invited members
          try {
            await apiClient.onboarding.complete();
          } catch (err) {
            console.warn('Auto-complete onboarding failed:', err);
          }
        } else {
          setShowOnboarding(true);
        }
      }

      // Load subscription/credits - hatası olsa bile devam et
      try {
        const subResponse = await apiClient.subscription.getCurrent();
        setCredits(subResponse.data.credits || 0);
        // Add subscription info to user object for Sidebar feature visibility
        setUser(prev => ({
          ...prev,
          subscription: subResponse.data
        }));
      } catch (subError) {
        console.warn('Failed to load subscription:', subError);
        setCredits(0);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await apiClient.onboarding.complete();
      setShowOnboarding(false);
      // Reload to refresh user data
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-800 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar user={user} credits={credits} />

      {/* Main content - adjusted for 240px sidebar (w-60) */}
      <div className="flex-1 lg:ml-60 overflow-auto h-screen">
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal open={showOnboarding} onClose={handleOnboardingComplete} />
      )}
    </div>
  );
}
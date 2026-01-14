'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { apiClient } from '@/lib/api';
import { Toaster } from 'sonner';
import { OnboardingModal } from '@/components/OnboardingModal';

// Cache for user data (5 minutes)
const USER_CACHE_KEY = 'dashboard_user_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedUserData = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(USER_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setCachedUserData = (data) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore storage errors
  }
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Try to load from cache first for instant display
    const cachedData = getCachedUserData();
    if (cachedData && !initialLoadDone.current) {
      setUser(cachedData.user);
      setCredits(cachedData.credits);
      setLoading(false);
      // Check onboarding from cached data
      if (cachedData.user?.onboardingCompleted === false && !cachedData.isInvitedMember) {
        setShowOnboarding(true);
      }
    }

    // Load fresh user data (in background if cache exists)
    loadUserData(!cachedData);
    initialLoadDone.current = true;
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

  const loadUserData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Load user profile from /api/auth/me (includes onboardingCompleted)
      const userResponse = await apiClient.get('/api/auth/me');
      const userData = userResponse.data;
      setUser(userData);

      // Email verification check disabled - users can access dashboard without verification
      const isInvitedMember = userData.acceptedAt || (userData.role && userData.role !== 'OWNER');

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
      let creditsValue = 0;
      let subscriptionData = null;
      try {
        const subResponse = await apiClient.subscription.getCurrent();
        creditsValue = subResponse.data.credits || 0;
        subscriptionData = subResponse.data;
        setCredits(creditsValue);
        // Add subscription info to user object for Sidebar feature visibility
        setUser(prev => ({
          ...prev,
          subscription: subResponse.data
        }));
      } catch (subError) {
        console.warn('Failed to load subscription:', subError);
        setCredits(0);
      }

      // Cache the data for next page navigation
      setCachedUserData({
        user: { ...userData, subscription: subscriptionData },
        credits: creditsValue,
        isInvitedMember
      });
    } catch (error) {
      console.error('Failed to load user data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        sessionStorage.removeItem(USER_CACHE_KEY);
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

  // Check if there's a pending enterprise payment
  // pendingPlanId = 'ENTERPRISE' ve enterprisePaymentStatus = 'pending' ise ödeme bekleniyor
  const hasPendingEnterprise = user?.subscription?.pendingPlanId === 'ENTERPRISE' &&
    user?.subscription?.enterprisePaymentStatus === 'pending';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar user={user} credits={credits} />

      {/* Main content - adjusted for 240px sidebar (w-60) */}
      <div className="flex-1 lg:ml-60 overflow-auto h-screen">
        {/* Payment pending banner for pending enterprise upgrade */}
        {hasPendingEnterprise && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-semibold">Kurumsal Plan Teklifi:</span> Kurumsal plana geçiş için ödeme bekleniyor. Ödeme yapıldığında planınız otomatik olarak güncellenecektir.
              </p>
            </div>
          </div>
        )}
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
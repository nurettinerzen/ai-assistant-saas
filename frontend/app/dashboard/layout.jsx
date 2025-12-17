'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // usePathname ekle
import Sidebar from '@/components/Sidebar';
import { apiClient } from '@/lib/api';
import { Toaster } from 'sonner';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname(); // EKLE
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

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
      // Load user profile
      const userResponse = await apiClient.settings.getProfile();
      setUser(userResponse.data);

      // Load subscription/credits - hatası olsa bile devam et
      try {
        const subResponse = await apiClient.subscription.getCurrent();
        setCredits(subResponse.data.credits || 0);
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
      <div className="flex-1 lg:ml-64 overflow-auto h-screen">
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
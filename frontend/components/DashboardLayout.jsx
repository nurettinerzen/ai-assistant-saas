'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Bot, Calendar, Package, Phone, Settings, CreditCard, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from './LanguageSwitcher';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState('en');
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useTranslation(lang);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const navigation = [
    { name: t.dashboard, href: '/dashboard', icon: Home },
    { name: t.assistant, href: '/dashboard/assistant', icon: Bot },
    { name: t.calendar, href: '/dashboard/calendar', icon: Calendar },
    { name: t.inventory, href: '/dashboard/inventory', icon: Package },
    { name: t.callLogs, href: '/dashboard/calls', icon: Phone },
    { name: t.settings, href: '/dashboard/settings', icon: Settings },
    { name: t.subscription, href: '/dashboard/subscription', icon: CreditCard },
  ];

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-primary">AI Assistant</h1>
            <p className="text-sm text-gray-600 mt-1">{user.business?.name}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  data-testid={`nav-${item.href}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t">
            <button
              onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
              data-testid="language-toggle"
            >
              {lang === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe'}
            </button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5 mr-3" />
              {t.logout}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
            data-testid="menu-button"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {user.email} • {user.role}
            </div>
            {/* Language Switcher */}
            <LanguageSwitcher />
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
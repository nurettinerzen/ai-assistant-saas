/**
 * Sidebar Component
 * Main navigation sidebar with grouped sections
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Phone,
  BarChart3,
  Settings,
  CreditCard,
  Calculator,
  Puzzle,
  BookOpen,
  Mic,
  PhoneCall,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User,
  MessageSquare,
  Mail,
  Receipt,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Sidebar({ user, credits }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState([]);

  const NAVIGATION = [
    {
      label: t('sidebarBuild'),
      items: [
        { icon: Bot, label: t('sidebarAssistants'), href: '/dashboard/assistant' },
        { icon: BookOpen, label: t('sidebarKnowledge'), href: '/dashboard/knowledge' },
        { icon: Mic, label: t('sidebarVoices'), href: '/dashboard/voices' },
        { icon: MessageSquare, label: t('sidebarChatWidget'), href: '/dashboard/chat-widget' },
      ],
    },
    {
      label: t('sidebarDeploy'),
      items: [
        { icon: PhoneCall, label: t('sidebarPhoneNumbers'), href: '/dashboard/phone-numbers' },
        { icon: Mail, label: 'Email Inbox', href: '/dashboard/email' },
        { icon: Puzzle, label: t('sidebarIntegrations'), href: '/dashboard/integrations' },
      ],
    },
    {
      label: t('sidebarMonitor'),
      items: [
        { icon: LayoutDashboard, label: t('sidebarDashboard'), href: '/dashboard' },
        { icon: Phone, label: t('sidebarCalls'), href: '/dashboard/calls' },
        { icon: BarChart3, label: t('sidebarAnalytics'), href: '/dashboard/analytics' },
      ],
    },
    {
      label: 'Tahsilat',
      items: [
        { icon: Receipt, label: 'Vadesi Geçenler', href: '/dashboard/collections' },
        { icon: Megaphone, label: 'Kampanyalar', href: '/dashboard/campaigns' },
      ],
    },
    {
      label: t('sidebarSystem'),
      items: [
        { icon: Calculator, label: t('sidebarCostCalculator'), href: '/dashboard/cost-calculator' },
        { icon: Settings, label: t('sidebarSettings'), href: '/dashboard/settings' },
        { icon: CreditCard, label: t('sidebarSubscription'), href: '/dashboard/subscription' },
      ],
    },
  ];

  const toggleSection = (label) => {
    setCollapsedSections((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-900">Telyx</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav 
  data-sidebar-nav
  onScroll={(e) => {
    sessionStorage.setItem('sidebar-scroll', e.target.scrollTop);
  }}
  className="flex-1 overflow-y-auto py-4 px-3"
>
  {NAVIGATION.map((section) => {
    const sectionLabel = section.label;
    const isCollapsed = collapsedSections.includes(sectionLabel);
    
    return (
      <div key={section.label} className="mb-6">
        {/* Section header */}
        <button
          onClick={() => toggleSection(sectionLabel)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-700 transition-colors"
        >
          <span>{sectionLabel}</span>
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

              {/* Section items */}
              {!isCollapsed && (
                <div className="space-y-1 mt-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Credits display */}
      {credits !== undefined && (
        <div className="px-6 py-3 border-t border-neutral-200">
          <div className="bg-primary-50 rounded-lg p-3">
            <p className="text-xs text-neutral-600 mb-1">{t('availableCredits')}</p>
            <p className="text-2xl font-bold text-primary-600">${credits.toFixed(2)}</p>
            <Link href="/dashboard/subscription">
              <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-1">
                {t('addCredits')}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Language Switcher */}
      <div className="px-6 py-3 border-t border-neutral-200">
        <LanguageSwitcher />
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-neutral-200"></div>

      {/* User profile */}
      <div className="p-3 border-t border-neutral-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary-600 text-white">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                {t('profileSettings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              {t('logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-neutral-200"
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="w-64 h-full bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
<div className="hidden lg:block w-64 bg-white border-r border-neutral-200 fixed left-0 top-0 bottom-0 overflow-hidden">
  <SidebarContent />
</div>
    </>
  );
}

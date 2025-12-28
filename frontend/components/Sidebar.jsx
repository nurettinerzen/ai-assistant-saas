/**
 * Sidebar Component
 * Main navigation sidebar with grouped sections
 * Updated with feature visibility based on subscription plan
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Bot,
  Phone,
  BarChart3,
  Settings,
  CreditCard,
  Puzzle,
  BookOpen,
  Mic,
  PhoneCall,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Mail,
  Megaphone,
  Users,
  Lock,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import UpgradeModal from './UpgradeModal';
import { FEATURES, VISIBILITY, getFeatureVisibility, getPrimaryVoiceChannel } from '@/lib/features';

export default function Sidebar({ user, credits, business }) {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const language = locale; // alias for backward compatibility
  const { can } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState([]);

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);

  // Get user's current plan and country from user/business object
  const userPlan = user?.subscription?.plan || user?.plan || 'STARTER';
  const userCountry = business?.country || user?.business?.country || 'TR';

  // Navigation items with permission requirements and feature visibility
  const NAVIGATION = [
    {
      label: t('dashboard.sidebar.build'),
      items: [
        { icon: Bot, label: t('dashboard.sidebar.assistants'), href: '/dashboard/assistant', permission: 'assistants:view' },
        { icon: BookOpen, label: t('dashboard.sidebar.knowledgeBase'), href: '/dashboard/knowledge', permission: 'knowledge:view' },
        { icon: Mic, label: t('dashboard.sidebar.voices'), href: '/dashboard/voices', permission: 'voices:view' },
        { icon: MessageSquare, label: t('dashboard.sidebar.chatWidget'), href: '/dashboard/chat-widget', permission: 'widget:view' },
      ],
    },
    {
      label: t('dashboard.sidebar.deploy'),
      items: [
        { icon: PhoneCall, label: t('dashboard.sidebar.phoneNumbers'), href: '/dashboard/phone-numbers', permission: 'phone:view' },
        { icon: Mail, label: t('dashboard.sidebar.emailInbox'), href: '/dashboard/email', permission: 'email:view', featureId: 'email' },
        { icon: Puzzle, label: t('dashboard.sidebar.integrations'), href: '/dashboard/integrations', permission: 'integrations:view', featureId: 'integrations' },
      ],
    },
    {
      label: t('dashboard.sidebar.outbound'),
      items: [
        { icon: Megaphone, label: t('dashboard.sidebar.batchCalls'), href: '/dashboard/batch-calls', permission: 'campaigns:view', featureId: 'batch_calls' },
      ],
    },
    {
      label: t('dashboard.sidebar.monitor'),
      items: [
        { icon: LayoutDashboard, label: t('dashboard.sidebar.overview'), href: '/dashboard', permission: 'dashboard:view' },
        { icon: Phone, label: t('dashboard.sidebar.calls'), href: '/dashboard/calls', permission: 'calls:view' },
        { icon: BarChart3, label: t('dashboard.sidebar.analytics'), href: '/dashboard/analytics', permission: 'analytics:view' },
      ],
    },
    {
      label: t('dashboard.sidebar.system'),
      items: [
        { icon: Users, label: t('dashboard.sidebar.team'), href: '/dashboard/team', permission: 'team:view' },
        { icon: Settings, label: t('dashboard.sidebar.settings'), href: '/dashboard/settings', permission: 'settings:view' },
        { icon: CreditCard, label: t('dashboard.sidebar.subscription'), href: '/dashboard/subscription', permission: 'billing:view' },
      ],
    },
  ];

  // Handle locked feature click
  const handleLockedFeatureClick = (featureId) => {
    setSelectedFeatureId(featureId);
    setUpgradeModalOpen(true);
  };

  // Get feature visibility for an item (now region-aware)
  const getItemVisibility = (item) => {
    if (!item.featureId) return VISIBILITY.VISIBLE;
    return getFeatureVisibility(item.featureId, userPlan, userCountry);
  };

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
      <div className="h-16 flex items-center px-6 border-b border-neutral-200 dark:border-neutral-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-900 dark:text-white">Telyx</span>
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

    // Filter visible items first
    const visibleItems = section.items.filter((item) => {
      // First check role permissions
      if (item.permission && !can(item.permission)) return false;
      // Then check feature visibility - hide if hidden
      const visibility = getItemVisibility(item);
      return visibility !== VISIBILITY.HIDDEN;
    });

    // Don't render section if no visible items
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.label} className="mb-6">
        {/* Section header */}
        <button
          onClick={() => toggleSection(sectionLabel)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <span>{sectionLabel}</span>
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

              {/* Section items - filtered by permissions and feature visibility */}
              {!isCollapsed && (
                <div className="space-y-1 mt-1">
                  {visibleItems
                    .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    const visibility = getItemVisibility(item);
                    const isLocked = visibility === VISIBILITY.LOCKED;

                    // If locked, render as a button instead of a link
                    if (isLocked) {
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            setIsMobileOpen(false);
                            handleLockedFeatureClick(item.featureId);
                          }}
                          className={cn(
                            'flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          <Lock className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
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

      {/* Language Switcher */}
      <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-700">
        <LanguageSwitcher />
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-700">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary-600 text-white">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                {mounted && theme === 'dark' ? (
                  <Moon className="h-4 w-4 mr-2" />
                ) : mounted && theme === 'light' ? (
                  <Sun className="h-4 w-4 mr-2" />
                ) : (
                  <Monitor className="h-4 w-4 mr-2" />
                )}
                {t('dashboard.theme') || 'Tema'}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
                    <Sun className="h-4 w-4 mr-2" />
                    {t('dashboard.themeLight') || 'Açık'}
                    {mounted && theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                    <Moon className="h-4 w-4 mr-2" />
                    {t('dashboard.themeDark') || 'Koyu'}
                    {mounted && theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('dashboard.themeSystem') || 'Sistem'}
                    {mounted && theme === 'system' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              {t('dashboard.logOut')}
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700"
      >
        {isMobileOpen ? <X className="h-6 w-6 dark:text-white" /> : <Menu className="h-6 w-6 dark:text-white" />}
      </button>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="w-64 h-full bg-white dark:bg-neutral-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
<div className="hidden lg:block w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 fixed left-0 top-0 bottom-0 overflow-hidden">
  <SidebarContent />
</div>

      {/* Upgrade Modal for locked features */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureId={selectedFeatureId}
      />
    </>
  );
}

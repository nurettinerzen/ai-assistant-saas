/**
 * Sidebar Component
 * Retell AI inspired navigation sidebar
 * Clean, minimal design with grouped sections
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Bot,
  Phone,
  BarChart3,
  Settings,
  CreditCard,
  Puzzle,
  BookOpen,
  PhoneCall,
  PhoneMissed,
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
  Database,
  Sparkles,
  Shield,
} from 'lucide-react';
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
import { VISIBILITY, getFeatureVisibility } from '@/lib/features';
import { TelyxLogoCompact } from './TelyxLogo';

// Admin email whitelist - should match backend
const ADMIN_EMAILS = [
  'nurettin@telyx.ai'
];

export default function Sidebar({ user, credits, business }) {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
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

  // Get user's current plan and country
  const userPlan = user?.subscription?.plan || user?.plan || 'STARTER';
  const userCountry = business?.country || user?.business?.country || 'TR';

  // Navigation structure - Retell AI inspired
  const NAVIGATION = [
    {
      label: t('dashboard.sidebar.build'),
      items: [
        { icon: Bot, label: t('dashboard.sidebar.assistants'), href: '/dashboard/assistant', permission: 'assistants:view' },
        { icon: BookOpen, label: t('dashboard.sidebar.knowledgeBase'), href: '/dashboard/knowledge', permission: 'knowledge:view' },
      ],
    },
    {
      label: t('dashboard.sidebar.deploy'),
      items: [
        { icon: MessageSquare, label: t('dashboard.sidebar.chatWidget'), href: '/dashboard/chat-widget', permission: 'widget:view' },
        { icon: PhoneCall, label: t('dashboard.sidebar.phoneNumbers'), href: '/dashboard/phone-numbers', permission: 'phone:view' },
        { icon: Mail, label: t('dashboard.sidebar.emailInbox'), href: '/dashboard/email', permission: 'email:view', featureId: 'email' },
      ],
    },
    {
      label: t('dashboard.sidebar.calls'),
      items: [
        { icon: Megaphone, label: t('dashboard.sidebar.outboundCalls'), href: '/dashboard/batch-calls', permission: 'campaigns:view', featureId: 'batch_calls' },
        { icon: Database, label: t('dashboard.sidebar.inboundCalls'), href: '/dashboard/customer-data', permission: 'campaigns:view' },
      ],
    },
    {
      label: t('dashboard.sidebar.monitor'),
      items: [
        { icon: BarChart3, label: t('dashboard.sidebar.analytics'), href: '/dashboard/analytics', permission: 'analytics:view' },
        { icon: Phone, label: t('dashboard.sidebar.callHistory'), href: '/dashboard/calls', permission: 'calls:view' },
        { icon: PhoneMissed, label: locale === 'tr' ? 'Geri Aramalar' : 'Callbacks', href: '/dashboard/callbacks', permission: 'calls:view' },
      ],
    },
    {
      label: t('dashboard.sidebar.system'),
      items: [
        { icon: Puzzle, label: t('dashboard.sidebar.integrations'), href: '/dashboard/integrations', permission: 'integrations:view' },
        { icon: Users, label: t('dashboard.sidebar.team'), href: '/dashboard/team', permission: 'team:view' },
        { icon: Settings, label: t('dashboard.sidebar.settings'), href: '/dashboard/settings', permission: 'settings:view' },
        { icon: CreditCard, label: t('dashboard.sidebar.subscription'), href: '/dashboard/subscription', permission: 'billing:view' },
      ],
    },
  ];

  // Admin-only navigation
  const isUserAdmin = ADMIN_EMAILS.includes(user?.email);
  const ADMIN_NAVIGATION = isUserAdmin ? [
    {
      label: 'Admin',
      items: [
        { icon: Shield, label: 'Admin Panel', href: '/dashboard/admin' },
        { icon: Users, label: 'Kullanıcılar', href: '/dashboard/admin/users' },
        { icon: Bot, label: 'Asistanlar', href: '/dashboard/admin/assistants' },
        { icon: Phone, label: 'Aramalar', href: '/dashboard/admin/calls' },
        { icon: PhoneMissed, label: 'Callbacks', href: '/dashboard/admin/callbacks' },
        { icon: CreditCard, label: 'Abonelikler', href: '/dashboard/admin/subscriptions' },
        { icon: Database, label: 'Kurumsal', href: '/dashboard/admin/enterprise' },
        { icon: BarChart3, label: 'Audit Log', href: '/dashboard/admin/audit-log' },
      ],
    },
  ] : [];

  const handleLockedFeatureClick = (featureId) => {
    setSelectedFeatureId(featureId);
    setUpgradeModalOpen(true);
  };

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

  // Get plan display name - Turkish names for TR locale
  const getPlanDisplay = () => {
    const plansEn = {
      FREE: 'Free',
      TRIAL: 'Trial',
      PAYG: 'PAYG',
      STARTER: 'Starter',
      BASIC: 'Basic',
      PRO: 'Pro',
      PROFESSIONAL: 'Pro',
      ENTERPRISE: 'Enterprise',
    };
    const plansTr = {
      FREE: 'Ücretsiz',
      TRIAL: 'Deneme',
      PAYG: 'Kullandıkça Öde',
      STARTER: 'Başlangıç',
      BASIC: 'Temel',
      PRO: 'Pro',
      PROFESSIONAL: 'Pro',
      ENTERPRISE: 'Kurumsal',
    };
    const plans = locale === 'tr' ? plansTr : plansEn;
    return plans[userPlan] || userPlan || (locale === 'tr' ? 'Ücretsiz' : 'Free');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard/assistant" className="flex items-center">
          <TelyxLogoCompact />
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
        {[...NAVIGATION, ...ADMIN_NAVIGATION].map((section) => {
          const sectionLabel = section.label;
          const isCollapsed = collapsedSections.includes(sectionLabel);

          // Filter visible items
          const visibleItems = section.items.filter((item) => {
            if (item.permission && !can(item.permission)) return false;
            const visibility = getItemVisibility(item);
            return visibility !== VISIBILITY.HIDDEN;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-6">
              {/* Section header */}
              <button
                onClick={() => toggleSection(sectionLabel)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                <div className="mt-1 space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    const visibility = getItemVisibility(item);
                    const isLocked = visibility === VISIBILITY.LOCKED;

                    if (isLocked) {
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            setIsMobileOpen(false);
                            handleLockedFeatureClick(item.featureId);
                          }}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                          isActive
                            ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        )}
                      >
                        <Icon className="h-4.5 w-4.5 flex-shrink-0" />
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
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <LanguageSwitcher />
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-600 text-white text-sm">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {getPlanDisplay()} Plan
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
                    {t('dashboard.themeLight') || 'Light'}
                    {mounted && theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                    <Moon className="h-4 w-4 mr-2" />
                    {t('dashboard.themeDark') || 'Dark'}
                    {mounted && theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('dashboard.themeSystem') || 'System'}
                    {mounted && theme === 'system' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-error-600 dark:text-error-400">
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-md shadow-md border border-gray-200 dark:border-gray-800"
      >
        {isMobileOpen ? (
          <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="w-60 h-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar - 240px width as per spec */}
      <div className="hidden lg:block w-60 border-r border-gray-200 dark:border-gray-800 fixed left-0 top-0 bottom-0 overflow-hidden">
        <SidebarContent />
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureId={selectedFeatureId}
      />
    </>
  );
}

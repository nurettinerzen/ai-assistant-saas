// ============================================================================
// DASHBOARD SIDEBAR COMPONENT
// ============================================================================
// FILE: frontend/components/DashboardSidebar.jsx
//
// Collapsible sidebar navigation for dashboard
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  Mic, 
  Phone, 
  TrendingUp, 
  Settings, 
  CreditCard,
  Book,
  Menu,
  X,
  Lock,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const NAVIGATION_ITEMS = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    requiresPlan: null
  },
  {
    title: 'Assistant',
    href: '/dashboard/assistant',
    icon: Mic,
    requiresPlan: null
  },
  {
    title: 'Call Logs',
    href: '/dashboard/analytics',
    icon: Phone,
    requiresPlan: 'STARTER'
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: TrendingUp,
    requiresPlan: 'STARTER',
    badge: 'PRO',
    badgeCondition: (plan) => plan === 'PROFESSIONAL' || plan === 'ENTERPRISE'
  },
  {
    title: 'Integrations',
    href: '/dashboard/integrations',
    icon: Book,
    requiresPlan: 'STARTER'
  },
  {
    title: 'Billing',
    href: '/dashboard/settings?tab=billing',
    icon: CreditCard,
    requiresPlan: null
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    requiresPlan: null
  }
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/subscription/current`, { headers });
      setSubscription(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Subscription fetch error:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const canAccessRoute = (item) => {
    if (!item.requiresPlan) return true;
    if (!subscription) return false;
    
    const planHierarchy = { FREE: 0, STARTER: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };
    const userPlanLevel = planHierarchy[subscription.plan] || 0;
    const requiredLevel = planHierarchy[item.requiresPlan] || 0;
    
    return userPlanLevel >= requiredLevel;
  };

  const shouldShowBadge = (item) => {
    if (!item.badge) return false;
    if (item.badgeCondition) {
      return !item.badgeCondition(subscription?.plan);
    }
    return true;
  };

  const plan = subscription?.plan || 'FREE';

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="sidebar-toggle"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="dashboard-sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-purple-600">Telyx</h1>
            {!loading && (
              <Badge 
                variant={plan === 'FREE' ? 'secondary' : 'default'}
                className="mt-2"
              >
                {plan}
              </Badge>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {NAVIGATION_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const canAccess = canAccessRoute(item);
              const showBadge = shouldShowBadge(item);

              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    "w-full justify-start",
                    isActive && "bg-purple-50 text-purple-700 hover:bg-purple-100",
                    !canAccess && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (canAccess) {
                      router.push(item.href);
                      setIsOpen(false);
                    }
                  }}
                  disabled={!canAccess}
                  data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="flex-1 text-left">{item.title}</span>
                  {!canAccess && <Lock className="w-4 h-4 text-gray-400" />}
                  {showBadge && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t space-y-2">
            {/* Upgrade CTA for FREE users */}
            {plan === 'FREE' && (
              <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg mb-2">
                <p className="text-sm font-semibold mb-1">Upgrade to unlock all features</p>
                <Button 
                  size="sm" 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    router.push('/pricing');
                    setIsOpen(false);
                  }}
                  data-testid="upgrade-cta"
                >
                  Upgrade Now
                </Button>
              </div>
            )}

            {/* Help & Docs */}
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => window.open('https://docs.telyx.ai', '_blank')}
            >
              <Book className="w-5 h-5 mr-3" />
              Help & Docs
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Spacer (for desktop) */}
      <div className="hidden lg:block w-64" />
    </>
  );
}

export default DashboardSidebar;

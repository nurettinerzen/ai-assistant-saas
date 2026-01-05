'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { canAccessFeature, getPlanDisplayName, getRequiredPlanForFeature } from '@/lib/planFeatures';
import Link from 'next/link';

/**
 * LockedFeature Component
 * Wraps content and shows a lock overlay if the user's plan doesn't have access
 *
 * @param {string} feature - Feature name from planFeatures.js (e.g., 'outboundCalls', 'customCrm')
 * @param {string} userPlan - User's current subscription plan
 * @param {React.ReactNode} children - Content to display (will be dimmed if locked)
 * @param {string} customMessage - Optional custom message to show
 */
export function LockedFeature({ feature, userPlan, children, customMessage }) {
  const { locale } = useLanguage();

  const isLocked = !canAccessFeature(userPlan, feature);

  if (!isLocked) {
    return children;
  }

  const requiredPlan = getRequiredPlanForFeature(feature);
  const requiredPlanName = getPlanDisplayName(requiredPlan, locale);

  return (
    <div className="relative">
      {/* Dimmed content */}
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 rounded-lg backdrop-blur-sm">
        <div className="text-center p-6 max-w-xs">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-fit mx-auto mb-3">
            <Lock className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {customMessage || (
              locale === 'tr'
                ? `Bu özellik ${requiredPlanName} planında aktif.`
                : `This feature is available in ${requiredPlanName} plan.`
            )}
          </p>
          <Link href="/dashboard/subscription">
            <Button variant="default" size="sm">
              {locale === 'tr' ? 'Planı Yükselt' : 'Upgrade Plan'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * LockedPage Component
 * Full page lock for restricted pages
 */
export function LockedPage({ feature, userPlan, title, description }) {
  const { locale } = useLanguage();

  const isLocked = !canAccessFeature(userPlan, feature);

  if (!isLocked) {
    return null;
  }

  const requiredPlan = getRequiredPlanForFeature(feature);
  const requiredPlanName = getPlanDisplayName(requiredPlan, locale);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="p-4 bg-amber-100 dark:bg-amber-900 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <Lock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
          {title || (locale === 'tr' ? 'Planınızı Yükseltin' : 'Upgrade Your Plan')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {description || (
            locale === 'tr'
              ? `Bu özellik ${requiredPlanName} ve üzeri planlarda kullanılabilir.`
              : `This feature is available on ${requiredPlanName} and higher plans.`
          )}
        </p>
        <Link href="/dashboard/subscription">
          <Button size="lg">
            <Lock className="h-4 w-4 mr-2" />
            {locale === 'tr' ? 'Planı Yükselt' : 'Upgrade Plan'}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default LockedFeature;

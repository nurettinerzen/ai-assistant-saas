/**
 * UpgradeModal Component
 * Shows when user tries to access a locked feature
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getRequiredPlanName, getFeatureDescription, getFeatureName } from '@/lib/features';

export default function UpgradeModal({
  isOpen,
  onClose,
  featureId,
  featureName: customFeatureName,
  featureDescription: customDescription,
  requiredPlan: customRequiredPlan
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const locale = language || 'tr';

  // Get feature info from config or use custom props
  const featureName = customFeatureName || getFeatureName(featureId, locale);
  const description = customDescription || getFeatureDescription(featureId, locale);
  const requiredPlan = customRequiredPlan || getRequiredPlanName(featureId, locale);

  const handleUpgrade = () => {
    onClose();
    router.push('/dashboard/subscription');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <DialogTitle className="text-xl font-bold text-neutral-900 dark:text-white">
            {locale === 'tr'
              ? `Bu özellik ${requiredPlan} planında`
              : `This feature requires ${requiredPlan} plan`}
          </DialogTitle>
          <DialogDescription className="text-neutral-600 dark:text-neutral-400 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">{featureName}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {locale === 'tr'
                    ? `${requiredPlan} ve üzeri planlarda kullanılabilir`
                    : `Available in ${requiredPlan} and above plans`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            {locale === 'tr' ? 'Kapat' : 'Close'}
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-teal-600 to-blue-500 hover:from-teal-700 hover:to-blue-600"
          >
            {locale === 'tr' ? 'Planları İncele' : 'View Plans'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

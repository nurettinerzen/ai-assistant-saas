'use client';

import SolutionPageTemplate from '@/components/solutions/SolutionPageTemplate';
import {
  ShoppingCart,
  Package,
  Truck,
  RotateCcw,
  Tag,
  ShoppingBag,
  ArrowUpRight,
  Globe,
} from 'lucide-react';

export default function EcommerceSolutionPage() {
  return (
    <SolutionPageTemplate
      sector="ecommerce"
      accentColor="#3b82f6"
      accentLight="#60a5fa"
      heroIcon={ShoppingCart}
      badgeColorClasses="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
      statColorClasses="text-blue-600 dark:text-blue-400"
      ctaGradient="bg-gradient-to-br from-slate-900 to-blue-900 dark:from-neutral-800 dark:to-neutral-800"
      ctaGlowColors={['bg-blue-500/20', 'bg-cyan-500/15']}
      ctaTextColor="text-blue-100 dark:text-neutral-400"
      howItWorksSteps={[
        { key: 'step1', color: 'from-blue-500 to-cyan-500', icon: Package },
        { key: 'step2', color: 'from-primary to-blue-500', icon: RotateCcw },
        { key: 'step3', color: 'from-green-500 to-emerald-500', icon: Tag },
      ]}
      useCases={[
        { key: 'uc1', icon: Package, titleKey: 'solutions.ecommerce.useCase1.title', descKey: 'solutions.ecommerce.useCase1.desc', color: 'from-blue-500 to-cyan-500' },
        { key: 'uc2', icon: Truck, titleKey: 'solutions.ecommerce.useCase2.title', descKey: 'solutions.ecommerce.useCase2.desc', color: 'from-green-500 to-emerald-500' },
        { key: 'uc3', icon: RotateCcw, titleKey: 'solutions.ecommerce.useCase3.title', descKey: 'solutions.ecommerce.useCase3.desc', color: 'from-violet-500 to-purple-500' },
        { key: 'uc4', icon: ShoppingBag, titleKey: 'solutions.ecommerce.useCase4.title', descKey: 'solutions.ecommerce.useCase4.desc', color: 'from-orange-500 to-red-500' },
      ]}
      highlights={[
        { icon: ShoppingBag, key: 'item1', color: 'from-blue-500 to-primary' },
        { icon: ArrowUpRight, key: 'item2', color: 'from-green-500 to-emerald-500' },
        { icon: Globe, key: 'item3', color: 'from-violet-500 to-purple-500' },
      ]}
    />
  );
}

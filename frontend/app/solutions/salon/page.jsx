'use client';

import SolutionPageTemplate from '@/components/solutions/SolutionPageTemplate';
import {
  Scissors,
  Calendar,
  Bell,
  Users,
  Clock,
  CalendarClock,
  BookOpen,
} from 'lucide-react';

export default function SalonSolutionPage() {
  return (
    <SolutionPageTemplate
      sector="salon"
      accentColor="#ec4899"
      accentLight="#f472b6"
      heroIcon={Scissors}
      badgeColorClasses="border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
      statColorClasses="text-pink-600 dark:text-pink-400"
      ctaGradient="bg-gradient-to-br from-slate-900 to-pink-900 dark:from-neutral-800 dark:to-neutral-800"
      ctaGlowColors={['bg-pink-500/20', 'bg-rose-500/15']}
      ctaTextColor="text-pink-100 dark:text-neutral-400"
      howItWorksSteps={[
        { key: 'step1', color: 'from-pink-500 to-rose-500', icon: Calendar },
        { key: 'step2', color: 'from-primary to-blue-500', icon: Bell },
        { key: 'step3', color: 'from-green-500 to-emerald-500', icon: BookOpen },
      ]}
      useCases={[
        { key: 'uc1', icon: Calendar, titleKey: 'solutions.salon.useCase1.title', descKey: 'solutions.salon.useCase1.desc', color: 'from-pink-500 to-rose-500' },
        { key: 'uc2', icon: Bell, titleKey: 'solutions.salon.useCase2.title', descKey: 'solutions.salon.useCase2.desc', color: 'from-violet-500 to-purple-500' },
        { key: 'uc3', icon: Users, titleKey: 'solutions.salon.useCase3.title', descKey: 'solutions.salon.useCase3.desc', color: 'from-blue-500 to-cyan-500' },
        { key: 'uc4', icon: Clock, titleKey: 'solutions.salon.useCase4.title', descKey: 'solutions.salon.useCase4.desc', color: 'from-emerald-500 to-teal-500' },
      ]}
      highlights={[
        { icon: CalendarClock, key: 'item1', color: 'from-pink-500 to-rose-500' },
        { icon: Bell, key: 'item2', color: 'from-blue-500 to-primary' },
        { icon: BookOpen, key: 'item3', color: 'from-emerald-500 to-teal-500' },
      ]}
    />
  );
}

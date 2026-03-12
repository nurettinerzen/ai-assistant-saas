'use client';

import Navigation from '@/components/Navigation';
import { Hero } from '@/components/Hero';
import { DashboardPreview } from '@/components/DashboardPreview';
import { IconRibbon } from '@/components/IconRibbon';
import { FeatureSections } from '@/components/FeatureSections';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';

// Telyx embed key for landing page chat widget
const TELYX_EMBED_KEY = 'emb_0f875ba550dde1c4836193e02231b7f6';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <Hero />

      {/* Dashboard Preview */}
      <div className="bg-white dark:bg-neutral-950 px-4 sm:px-6 lg:px-8 pb-16">
        <DashboardPreview />
      </div>

      {/* Icon Ribbon */}
      <IconRibbon />

      {/* Feature Sections (4x two-column with mock visuals) */}
      <FeatureSections />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />

      {/* Chat Widget for visitor support */}
      <ChatWidget
        embedKey={TELYX_EMBED_KEY}
        position="bottom-right"
        primaryColor="#17a2b3"
        showBranding={false}
        buttonText="Bize Yazın"
      />
    </div>
  );
}

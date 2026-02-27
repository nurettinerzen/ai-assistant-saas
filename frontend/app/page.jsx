'use client';

import Navigation from '@/components/Navigation';
import { Hero } from '@/components/Hero';
import { ChannelsSection } from '@/components/ChannelsSection';
import { SectorsSection } from '@/components/SectorsSection';
import { IntegrationsSection } from '@/components/IntegrationsSection';
import { HowItWorks } from '@/components/HowItWorks';
import { Footer } from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

// Telyx embed key for landing page chat widget
const TELYX_EMBED_KEY = 'emb_0f875ba550dde1c4836193e02231b7f6';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <Hero />

      {/* Channels Section */}
      <ChannelsSection />

      {/* Sectors Section */}
      <SectorsSection />

      {/* Integrations Section */}
      <IntegrationsSection />

      {/* How It Works Section */}
      <HowItWorks />

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-teal-600 via-blue-500 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            {t('landing.cta.title')}
          </h2>
          <p className="text-base md:text-xl text-blue-100 mb-10 md:mb-12 max-w-2xl mx-auto">
            {t('landing.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/waitlist">
              <Button size="lg" className="w-full sm:w-auto bg-white text-teal-600 hover:bg-gray-100 shadow-xl text-lg px-8 py-6">
                {t('landing.cta.applyEarlyAccess')}
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto glass border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6">
                {t('landing.cta.talkToSales')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Chat Widget for visitor support */}
      <ChatWidget
        embedKey={TELYX_EMBED_KEY}
        position="bottom-right"
        primaryColor="#00A2B3"
        showBranding={false}
        buttonText="Bize Yazın"
      />
    </div>
  );
}

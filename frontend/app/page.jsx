'use client';

import Navigation from '@/components/Navigation';
import { LandingPage } from '@/components/LandingPage';
import { Footer } from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';

// Telyx embed key for landing page chat widget
const TELYX_EMBED_KEY = 'emb_0f875ba550dde1c4836193e02231b7f6';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />

      <LandingPage />

      <Footer />

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

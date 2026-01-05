'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Loader2, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export const LiveDemoSection = () => {
  const { t, locale: language } = useLanguage();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [callInitiated, setCallInitiated] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error(language === 'tr' ? 'Geçerli bir telefon numarası girin' : 'Please enter a valid phone number');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/demo/request-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          language: language === 'tr' ? 'TR' : 'EN'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCallInitiated(true);
        toast.success(language === 'tr'
          ? 'Demo araması başlatılıyor! Telefonunuz birkaç saniye içinde çalacak.'
          : 'Demo call initiated! Your phone will ring shortly.');
        setPhoneNumber('');

        // Reset after 30 seconds
        setTimeout(() => setCallInitiated(false), 30000);
      } else {
        toast.error(data.error || (language === 'tr' ? 'Demo araması başlatılamadı' : 'Failed to initiate demo call'));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(language === 'tr' ? 'Bir hata oluştu. Lütfen tekrar deneyin.' : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="live-demo" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-gray-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            {t('landing.demo.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.demo.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Card className="max-w-2xl mx-auto border-2 border-primary/20 shadow-blue-lg bg-card">
            <div className="p-8 sm:p-12">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-center text-foreground mb-2">
                {t('landing.demo.formTitle')}
              </h3>
              <p className="text-center text-muted-foreground mb-8">
                {t('landing.demo.formSubtitle')}
              </p>

              {callInitiated ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    {language === 'tr' ? 'Arama Başlatıldı!' : 'Call Initiated!'}
                  </h4>
                  <p className="text-muted-foreground">
                    {language === 'tr'
                      ? 'Telefonunuz birkaç saniye içinde çalacak. AI asistanımız sizinle konuşmak için bekliyor.'
                      : 'Your phone will ring shortly. Our AI assistant is waiting to talk with you.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                      {language === 'tr' ? 'Telefon Numaranız' : 'Your Phone Number'}
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={language === 'tr' ? '+90 5XX XXX XX XX' : '+1 (555) 000-0000'}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="h-12 border-border focus:border-primary focus:ring-primary text-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === 'tr'
                        ? 'Numaranızı girin, sizi arayalım ve AI asistanımızı deneyin!'
                        : 'Enter your number and we\'ll call you to demo our AI assistant!'}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-blue h-14 text-lg font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {language === 'tr' ? 'Aranıyor...' : 'Calling...'}
                      </>
                    ) : (
                      <>
                        <Phone className="w-5 h-5 mr-2" />
                        {language === 'tr' ? 'Beni Ara' : 'Call Me Now'}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    {language === 'tr'
                      ? '1-2 dakikalık ücretsiz demo görüşmesi. Numaranız kaydedilmez.'
                      : '1-2 minute free demo call. Your number won\'t be stored.'}
                  </p>
                </form>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6 mt-16"
        >
          {[
            { titleKey: 'landing.demo.feature1.title', descKey: 'landing.demo.feature1.desc' },
            { titleKey: 'landing.demo.feature2.title', descKey: 'landing.demo.feature2.desc' },
            { titleKey: 'landing.demo.feature3.title', descKey: 'landing.demo.feature3.desc' },
          ].map((feature, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <h4 className="font-semibold text-foreground mb-2">{t(feature.titleKey)}</h4>
              <p className="text-sm text-muted-foreground">{t(feature.descKey)}</p>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

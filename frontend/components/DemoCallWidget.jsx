'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Loader2, CheckCircle, Star, Mic, MicOff, PhoneOff } from 'lucide-react';
import { getCurrentLanguage, t } from '@/lib/translations';
import { apiClient as api } from '@/lib/api';
import Vapi from '@vapi-ai/web';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DemoCallWidget({ variant = 'full' }) {
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [callId, setCallId] = useState(null);
  const [assistantId, setAssistantId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const vapiRef = useRef(null);

  useEffect(() => {
    setLanguage(getCurrentLanguage());
    const handleLanguageChange = () => setLanguage(getCurrentLanguage());
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);

  const startWebCall = async () => {
    setIsLoading(true);
    setCallState('connecting');

    try {
      const response = await api.demo.requestCall({
        language: language.toUpperCase(),
        name: 'Demo User'
      });

      const { assistantId: newAssistantId, publicKey, callType, callId: newCallId } = response.data;

      if (callType === 'web' && newAssistantId && publicKey && Vapi) {
        setAssistantId(newAssistantId);
        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on('call-start', () => {
          setCallState('active');
          toast.success(language === 'tr' ? 'Arama başladı!' : 'Call started!');
        });

        vapi.on('call-end', () => {
          setCallState('ended');
          setShowFeedback(true);
        });

        vapi.on('error', (error) => {
          console.error('VAPI error:', error);
          toast.error(language === 'tr' ? 'Arama hatası' : 'Call error');
          setCallState('idle');
        });

        await vapi.start(newAssistantId);
      } else {
        setCallId(newCallId);
        setCallState('active');
        toast.success(t('phoneWillRing', language));
      }
    } catch (error) {
      console.error('Demo call error:', error);
      toast.error(t('demoCallFailed', language));
      setCallState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const endCall = () => {
    if (vapiRef.current) vapiRef.current.stop();
    setCallState('ended');
    setShowFeedback(true);
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      vapiRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleFeedback = async (rating) => {
    setFeedbackRating(rating);
    try {
      await api.demo.submitFeedback({ callId: callId || assistantId, rating, wouldRecommend: rating >= 4 });
      toast.success(t('thankYouFeedback', language));
      setShowFeedback(false);
      resetWidget();
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const resetWidget = () => {
    setCallState('idle');
    setCallId(null);
    setAssistantId(null);
    setIsMuted(false);
    vapiRef.current = null;
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{t('demoCallTitle', language)}</p>
          <p className="text-xs text-muted-foreground truncate">{t('demoCallDesc', language)}</p>
        </div>
        <Button size="sm" onClick={startWebCall} disabled={isLoading}>
          {language === 'tr' ? 'Dene' : 'Try'}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground border-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        
        <CardContent className="relative pt-8 pb-8">
          {callState === 'active' ? (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mx-auto animate-pulse">
                <Phone className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  {language === 'tr' ? 'Arama Devam Ediyor...' : 'Call in Progress...'}
                </h3>
                <p className="text-primary-foreground/80">
                  {language === 'tr' ? 'Demo asistanımızla konuşuyorsunuz' : 'Talking with our demo assistant'}
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <Button variant="secondary" size="lg" onClick={toggleMute} className="h-14 w-14 rounded-full">
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                <Button variant="destructive" size="lg" onClick={endCall} className="h-14 w-14 rounded-full">
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            </div>
          ) : callState === 'ended' ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mx-auto">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  {language === 'tr' ? 'Arama Tamamlandı' : 'Call Completed'}
                </h3>
                <p className="text-primary-foreground/80">
                  {language === 'tr' ? 'Demo için teşekkürler!' : 'Thanks for trying our demo!'}
                </p>
              </div>
              <Button variant="secondary" onClick={resetWidget} className="mt-4">
                {t('tryAgain', language)}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-4">
                  <Phone className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">{t('demoCallTitle', language)}</h2>
                <p className="text-xl font-medium text-primary-foreground/90">
                  {language === 'tr' ? 'Hemen Deneyin!' : 'Try It Now!'}
                </p>
                <p className="text-primary-foreground/70 mt-2">{t('demoCallDesc', language)}</p>
              </div>
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-white text-primary hover:bg-white/90 gap-2"
                onClick={startWebCall}
                disabled={isLoading || callState === 'connecting'}
              >
                {isLoading || callState === 'connecting' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {language === 'tr' ? 'Bağlanıyor...' : 'Connecting...'}
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    {language === 'tr' ? 'Şimdi Konuş' : 'Talk Now'}
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-primary-foreground/60">{t('demoDisclaimer', language)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{t('howWasDemo', language)}</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-center text-muted-foreground mb-4">{t('rateExperience', language)}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => handleFeedback(star)} className="p-2 hover:scale-110 transition-transform">
                  <Star className={`h-8 w-8 ${star <= feedbackRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

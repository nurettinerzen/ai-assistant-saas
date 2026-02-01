'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import VoiceDemo from './VoiceDemo';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Play,
  Loader2,
  UtensilsCrossed,
  Scissors,
  ShoppingCart,
  Briefcase,
  Package,
  Mic2,
  FileText
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function OnboardingModal({ open, onClose }) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  // Map locale to our language codes
  const getLanguageFromLocale = (loc) => {
    const mapping = { tr: 'TR', en: 'EN', pr: 'PR' };
    return mapping[loc] || 'TR';
  };

  const [data, setData] = useState({
    industry: '',
    language: 'TR', // Will be updated from locale in useEffect
    country: 'TR',
    voice: null,
    firstMessage: '',
    systemPrompt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // Update language when locale changes (handles SSR -> client hydration)
  useEffect(() => {
    if (locale) {
      const lang = getLanguageFromLocale(locale);
      setData(prev => ({ ...prev, language: lang }));
    }
  }, [locale]);

  // Fetch voices when entering step 2 or when language changes
  useEffect(() => {
    const fetchVoices = async () => {
      // Map our language codes to backend voice keys
      const langToVoiceKey = {
        'TR': 'tr',
        'EN': 'en',
        'PR': 'pt' // Brazilian Portuguese uses 'pt' key in backend
      };
      const voiceKey = langToVoiceKey[data.language] || 'tr';

      console.log('🎤 Fetching voices... API_URL:', API_URL, 'language:', data.language, '-> key:', voiceKey, 'step:', step);
      setVoicesLoading(true);

      try {
        // Request specific language only with samples to speed up loading
        const response = await axios.get(`${API_URL}/api/voices?language=${voiceKey}&withSamples=true`);
        console.log('🎤 Voice API response:', response.status);

        // When language is specified, response is { voices: [...], count: N }
        const voices = response.data.voices || [];
        console.log('🎤 Found', voices.length, 'voices for', voiceKey);

        setAvailableVoices(voices);
      } catch (error) {
        console.error('❌ Failed to fetch voices:', error.message, error.response?.status, error.response?.data);
        setAvailableVoices([]);
      } finally {
        setVoicesLoading(false);
      }
    };

    // Fetch voices when modal is open AND (entering step 2 OR language changed while on step 2)
    if (open && data.language && (step === 2 || step === 1)) {
      fetchVoices();
    }
  }, [open, data.language, step]);

  const STEPS = [
    { id: 1, title: t('onboarding.steps.chooseIndustry'), description: t('onboarding.descriptions.tellUsAboutBusiness') },
    { id: 2, title: t('onboarding.steps.pickVoice'), description: t('onboarding.descriptions.selectAssistantVoice') },
    { id: 3, title: t('onboarding.steps.addTraining'), description: t('onboarding.descriptions.createFirstGreeting') },
    { id: 4, title: t('onboarding.steps.testAssistant'), description: t('onboarding.descriptions.tryItOut') },
    { id: 5, title: t('onboarding.steps.complete'), description: t('onboarding.descriptions.allSet') }
  ];

  const INDUSTRIES = [
    { id: 'RESTAURANT', icon: UtensilsCrossed, name: t('onboarding.industries.restaurant'), color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { id: 'SALON', icon: Scissors, name: t('onboarding.industries.salonSpa'), color: 'text-pink-600', bgColor: 'bg-pink-100' },
    { id: 'ECOMMERCE', icon: ShoppingCart, name: t('onboarding.industries.ecommerce'), color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { id: 'SERVICE', icon: Briefcase, name: t('onboarding.industries.professionalServices'), color: 'text-teal-600', bgColor: 'bg-teal-100' },
    { id: 'OTHER', icon: Package, name: t('onboarding.industries.other'), color: 'text-gray-600', bgColor: 'bg-gray-100' }
  ];

  // Only Turkey supported for now - other regions will be added later
  // See docs/MULTI_REGION_ARCHITECTURE.md for adding new regions
  const COUNTRIES = [
    { id: 'TR', name: 'Türkiye', nameLocal: 'Türkiye', flag: '🇹🇷', timezone: 'Europe/Istanbul', currency: 'TRY' }
  ];

  // Only Turkish for now - other languages will be added with multi-region support
  const LANGUAGES = [
    { id: 'TR', name: 'Türkçe', flag: '🇹🇷' }
  ];

  const TIMEZONES = [
    { id: 'Europe/Istanbul', name: '(UTC+3) Istanbul, Turkey' },
    { id: 'Europe/London', name: '(UTC+0) London, UK' },
    { id: 'Europe/Paris', name: '(UTC+1) Paris, France' },
    { id: 'Europe/Berlin', name: '(UTC+1) Berlin, Germany' },
    { id: 'America/New_York', name: '(UTC-5) New York, Eastern Time' },
    { id: 'America/Los_Angeles', name: '(UTC-8) Los Angeles, Pacific Time' },
    { id: 'America/Chicago', name: '(UTC-6) Chicago, Central Time' },
    { id: 'America/Denver', name: '(UTC-7) Denver, Mountain Time' },
    { id: 'America/Toronto', name: '(UTC-5) Toronto, Canada' },
    { id: 'America/Sao_Paulo', name: '(UTC-3) São Paulo, Brazil' },
    { id: 'Europe/Moscow', name: '(UTC+3) Moscow, Russia' },
    { id: 'Asia/Dubai', name: '(UTC+4) Dubai, UAE' },
    { id: 'Asia/Kolkata', name: '(UTC+5:30) Mumbai, India' },
    { id: 'Asia/Singapore', name: '(UTC+8) Singapore' },
    { id: 'Asia/Tokyo', name: '(UTC+9) Tokyo, Japan' },
    { id: 'Australia/Sydney', name: '(UTC+11) Sydney, Australia' }
  ];

  const PROMPTS = {
    RESTAURANT: t('onboarding.prompts.restaurant'),
    SALON: t('onboarding.prompts.salon'),
    ECOMMERCE: t('onboarding.prompts.ecommerce'),
    SERVICE: t('onboarding.prompts.service'),
    OTHER: t('onboarding.prompts.other')
  };

  const handleIndustrySelect = (industry) => {
    setData({ ...data, industry, systemPrompt: PROMPTS[industry] || '' });
  };

  const handleVoiceSelect = (voice) => {
    // Language-based default greeting
    const greetings = {
      TR: `Merhaba, ben ${voice.name}. Size nasıl yardımcı olabilirim?`,
      EN: `Hello, I'm ${voice.name}. How can I help you today?`,
      PR: `Olá, sou ${voice.name}. Como posso ajudar você hoje?`
    };
    const greeting = greetings[data.language] || greetings.EN;
    setData({ ...data, voice, firstMessage: greeting });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      toast.success(t('onboarding.messages.completed'));
      onClose();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(t('onboarding.messages.error'));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return data.industry !== '';
      case 2: return data.voice !== null;
      case 3: return data.firstMessage.trim() !== '' && data.systemPrompt.trim() !== '';
      default: return true;
    }
  };

  const nextStep = async () => {
    if (step === 3 && !createdAssistantId) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API_URL}/api/assistants`,
          {
            name: data.voice.name,
            voiceId: data.voice.id,
            firstMessage: data.firstMessage,
            customNotes: data.systemPrompt,  // Onboarding'deki talimatlar customNotes olarak kaydedilir
            language: data.language,
            country: data.country,
            industry: data.industry,
            timezone: data.timezone
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Use internal assistant ID (database ID, NOT elevenLabsAgentId)
        const assistantId = response.data.assistant?.id;
        console.log('✅ Assistant created with ID:', assistantId);
        setCreatedAssistantId(assistantId);
        toast.success(t('onboarding.messages.assistantCreated'));
        setStep(4);
      } catch (error) {
        console.error('Failed to create assistant:', error);
        toast.error(t('onboarding.messages.failedToCreate'));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (step === 5) {
      handleComplete();
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{STEPS[step - 1]?.title}</DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">{STEPS[step - 1]?.description}</p>
        </DialogHeader>

        <div className="flex items-center justify-between my-4">
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s.id < step ? 'bg-green-500 text-white' :
                s.id === step ? 'bg-teal-600 text-white' :
                'bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300'
              }`}>
                {s.id < step ? <Check className="w-3 h-3" /> : s.id}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-10 h-0.5 mx-1.5 ${s.id < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'}`}></div>
              )}
            </div>
      ))}
    </div>

    <div className="min-h-[280px]">

        {step === 1 && (
    <div className="space-y-4">
      {/* Industry Selection */}
      <div>
        <Label className="text-sm font-medium">{t('onboarding.labels.businessType')}</Label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('onboarding.descriptions.tellUsAboutBusiness')}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            return (
              <Card
                key={industry.id}
                className={`p-4 cursor-pointer hover:shadow transition-all ${
                  data.industry === industry.id ? 'ring-2 ring-teal-600 bg-teal-50 dark:bg-teal-900/30' : ''
                }`}
                onClick={() => handleIndustrySelect(industry.id)}
              >
                <div className={`p-3 rounded-lg ${industry.bgColor} mb-2 w-fit mx-auto`}>
                  <Icon className={`h-6 w-6 ${industry.color}`} />
                </div>
                <h3 className="text-sm font-medium text-center dark:text-white">{industry.name}</h3>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
)}

          {step === 2 && (
            <div>
              {voicesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 mx-auto text-teal-600 animate-spin mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.voice.loading') || 'Loading voices...'}</p>
                </div>
              ) : availableVoices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.voice.noVoices') || 'No voices available for this language. Please try another language.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableVoices.map((voice) => (
                    <Card
                      key={voice.id}
                      className={`p-3 cursor-pointer hover:shadow transition-all ${
                        data.voice?.id === voice.id ? 'ring-2 ring-teal-600 bg-teal-50 dark:bg-teal-900/30' : ''
                      }`}
                      onClick={() => handleVoiceSelect(voice)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-medium dark:text-white">{voice.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{voice.accent}</p>
                        </div>
                        {voice.sampleUrl && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => {
                            e.stopPropagation();
                            const audio = new Audio(voice.sampleUrl);
                            audio.play().catch(() => toast.error('Could not play sample'));
                          }}>
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">{voice.gender === 'male' ? t('onboarding.voice.male') : t('onboarding.voice.female')}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mic2 className="h-3.5 w-3.5" />
                  {t('onboarding.labels.greetingMessage')}
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('onboarding.labels.greetingMessageDesc')}</p>
                <textarea
                  value={data.firstMessage}
                  onChange={(e) => setData({ ...data, firstMessage: e.target.value })}
                  className="w-full min-h-[70px] p-2.5 text-sm border dark:border-neutral-700 rounded-lg resize-none bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {t('onboarding.labels.assistantInstructions')}
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('onboarding.labels.assistantInstructionsDesc')}</p>
                <textarea
                  value={data.systemPrompt}
                  onChange={(e) => setData({ ...data, systemPrompt: e.target.value })}
                  className="w-full min-h-[100px] p-2.5 text-sm border dark:border-neutral-700 rounded-lg resize-none bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              {createdAssistantId ? (
                <VoiceDemo assistantId={createdAssistantId} />
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 mx-auto text-teal-600 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">{t('onboarding.messages.creatingAssistant')}</p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 dark:text-white">{t('onboarding.final.allSet')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.final.assistantReady')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t dark:border-neutral-700">
          <Button variant="outline" size="sm" onClick={prevStep} disabled={step === 1 || loading}>
            <ChevronLeft className="w-3 h-3 mr-1" />
            {t('onboarding.buttons.back')}
          </Button>
          <div className="text-xs text-gray-500 dark:text-gray-400">{step} / {STEPS.length}</div>
          <Button size="sm" onClick={nextStep} disabled={!canProceed() || loading}>
            {loading ? t('onboarding.buttons.loading') : step === 5 ? t('onboarding.buttons.complete') : t('onboarding.buttons.next')}
            {step < 5 && <ChevronRight className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;

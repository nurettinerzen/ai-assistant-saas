'use client';

import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
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

const COUNTRY_CONFIG = [
  { id: 'TR', flag: '🇹🇷', timezone: 'Europe/Istanbul' },
  { id: 'US', flag: '🇺🇸', timezone: 'America/New_York' }
];

const TIMEZONE_IDS = [
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const TIMEZONE_TRANSLATION_KEYS = {
  'Europe/Istanbul': 'europeIstanbul',
  'Europe/London': 'europeLondon',
  'Europe/Paris': 'europeParis',
  'Europe/Berlin': 'europeBerlin',
  'America/New_York': 'americaNewYork',
  'America/Los_Angeles': 'americaLosAngeles',
  'America/Chicago': 'americaChicago',
  'America/Denver': 'americaDenver',
  'America/Toronto': 'americaToronto',
  'America/Sao_Paulo': 'americaSaoPaulo',
  'Europe/Moscow': 'europeMoscow',
  'Asia/Dubai': 'asiaDubai',
  'Asia/Kolkata': 'asiaKolkata',
  'Asia/Singapore': 'asiaSingapore',
  'Asia/Tokyo': 'asiaTokyo',
  'Australia/Sydney': 'australiaSydney'
};

const getLanguageFromLocale = (loc) => {
  const mapping = { tr: 'TR', en: 'EN' };
  return mapping[loc] || 'TR';
};

const getBrowserCountry = () => {
  if (typeof navigator === 'undefined') return 'TR';

  const region = (navigator.language || 'tr-TR').split('-')[1]?.toUpperCase();
  const isSupported = COUNTRY_CONFIG.some((country) => country.id === region);
  return isSupported ? region : 'TR';
};

const getBrowserTimezone = () => {
  if (typeof Intl === 'undefined') return 'Europe/Istanbul';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';
};

const getOnboardingStorageKey = (businessId) => `onboarding_completed_business_${businessId}`;

export function OnboardingModal({ open, onClose, business, phoneInboundEnabled = false }) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [autoDetected, setAutoDetected] = useState({ country: true, timezone: true });

  const [data, setData] = useState({
    industry: '',
    language: 'TR',
    country: getBrowserCountry(),
    voice: null,
    firstMessage: '',
    systemPrompt: '',
    timezone: getBrowserTimezone()
  });

  const isFullV2Mode = phoneInboundEnabled === true;

  const stepSequence = useMemo(
    () => (isFullV2Mode ? [1, 2, 3, 4, 5] : [1, 2, 5]),
    [isFullV2Mode]
  );

  const STEPS = useMemo(
    () => ({
      1: { id: 1, title: t('onboarding.steps.chooseIndustry'), description: t('onboarding.descriptions.tellUsAboutBusiness') },
      2: { id: 2, title: t('onboarding.steps.pickVoice'), description: t('onboarding.descriptions.selectAssistantVoice') },
      3: { id: 3, title: t('onboarding.steps.addTraining'), description: t('onboarding.descriptions.createFirstGreeting') },
      4: { id: 4, title: t('onboarding.steps.testAssistant'), description: t('onboarding.descriptions.tryItOut') },
      5: { id: 5, title: t('onboarding.steps.complete'), description: t('onboarding.descriptions.allSet') }
    }),
    [t]
  );

  const INDUSTRIES = useMemo(
    () => [
      { id: 'RESTAURANT', icon: UtensilsCrossed, name: t('onboarding.industries.restaurant'), color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { id: 'SALON', icon: Scissors, name: t('onboarding.industries.salonSpa'), color: 'text-pink-600', bgColor: 'bg-pink-100' },
      { id: 'ECOMMERCE', icon: ShoppingCart, name: t('onboarding.industries.ecommerce'), color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { id: 'SERVICE', icon: Briefcase, name: t('onboarding.industries.professionalServices'), color: 'text-teal-600', bgColor: 'bg-teal-100' },
      { id: 'OTHER', icon: Package, name: t('onboarding.industries.other'), color: 'text-gray-600', bgColor: 'bg-gray-100' }
    ],
    [t]
  );

  const PROMPTS = useMemo(
    () => ({
      RESTAURANT: t('onboarding.prompts.restaurant'),
      SALON: t('onboarding.prompts.salon'),
      ECOMMERCE: t('onboarding.prompts.ecommerce'),
      SERVICE: t('onboarding.prompts.service'),
      OTHER: t('onboarding.prompts.other')
    }),
    [t]
  );

  const COUNTRIES = useMemo(
    () => COUNTRY_CONFIG.map((country) => ({
      ...country,
      name: t(`onboarding.location.countries.${country.id}`)
    })),
    [t]
  );

  const TIMEZONES = useMemo(
    () => TIMEZONE_IDS.map((timezoneId) => ({
      id: timezoneId,
      name: t(`onboarding.location.timezones.${TIMEZONE_TRANSLATION_KEYS[timezoneId]}`)
    })),
    [t]
  );

  const currentStepIndex = stepSequence.indexOf(step);
  const visibleSteps = stepSequence.map((id) => STEPS[id]).filter(Boolean);
  const currentStepMeta = STEPS[step];
  const isLastStep = currentStepIndex === stepSequence.length - 1;

  useEffect(() => {
    if (!open) return;

    setStep(stepSequence[0]);

    const localeLanguage = getLanguageFromLocale(locale);
    const browserCountry = getBrowserCountry();
    const browserTimezone = getBrowserTimezone();
    const businessType = business?.businessType;
    const knownIndustry = INDUSTRIES.some((i) => i.id === businessType) ? businessType : '';

    setData((prev) => ({
      ...prev,
      language: business?.language || localeLanguage,
      country: business?.country || browserCountry,
      timezone: business?.timezone || browserTimezone,
      industry: prev.industry || knownIndustry
    }));

    setAutoDetected({
      country: !business?.country,
      timezone: !business?.timezone
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, business, locale, stepSequence]);

  useEffect(() => {
    if (!stepSequence.includes(step)) {
      setStep(stepSequence[0]);
    }
  }, [step, stepSequence]);

  useEffect(() => {
    const fetchVoices = async () => {
      const langToVoiceKey = {
        TR: 'tr',
        EN: 'en',
        PT: 'pt'
      };
      const voiceKey = langToVoiceKey[data.language] || 'tr';

      setVoicesLoading(true);

      try {
        const response = await axios.get(`${API_URL}/api/voices?language=${voiceKey}&withSamples=true`);
        const voices = response.data.voices || [];
        setAvailableVoices(voices);
      } catch (error) {
        console.error('Failed to fetch voices:', error.message);
        setAvailableVoices([]);
      } finally {
        setVoicesLoading(false);
      }
    };

    if (open && data.language && (step === 1 || step === 2)) {
      fetchVoices();
    }
  }, [open, data.language, step]);

  const handleIndustrySelect = (industry) => {
    setData((prev) => ({ ...prev, industry, systemPrompt: PROMPTS[industry] || '' }));
  };

  const handleVoiceSelect = (voice) => {
    const greetings = {
      TR: `Merhaba, ben ${voice.name}. Size nasıl yardımcı olabilirim?`,
      EN: `Hello, I'm ${voice.name}. How can I help you today?`,
      PT: `Olá, sou ${voice.name}. Como posso ajudar você hoje?`
    };
    const greeting = greetings[data.language] || greetings.EN;

    setData((prev) => ({
      ...prev,
      voice,
      firstMessage: greeting
    }));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      let businessId = business?.id;
      if (!businessId) {
        try {
          const authResponse = await apiClient.auth.me();
          businessId = authResponse.data?.businessId || authResponse.data?.business?.id || null;
        } catch (_error) {
          businessId = null;
        }
      }

      if (businessId) {
        await apiClient.business.update(businessId, {
          businessType: data.industry || 'OTHER',
          country: data.country,
          timezone: data.timezone,
          language: data.language
        });

        localStorage.setItem(getOnboardingStorageKey(businessId), '1');
      }

      if (data.voice?.id && typeof window !== 'undefined') {
        localStorage.setItem('onboarding_preferred_outbound_voice_id', data.voice.id);
      }

      await onClose?.();
      toast.success(t('onboarding.messages.completed'));
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(t('onboarding.messages.error'));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.industry !== '' && data.country !== '' && data.timezone !== '';
      case 2:
        return isFullV2Mode ? data.voice !== null : true;
      case 3:
        return data.firstMessage.trim() !== '' && data.systemPrompt.trim() !== '';
      default:
        return true;
    }
  };

  const nextStep = async () => {
    if (isLastStep) {
      await handleComplete();
      return;
    }

    if (step === 3 && !createdAssistantId) {
      setCreatedAssistantId('SKIPPED_LEGACY_PREVIEW');
    }

    setStep(stepSequence[currentStepIndex + 1]);
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(stepSequence[currentStepIndex - 1]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[85vh] !overflow-hidden !flex !flex-col p-4 sm:p-6 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold">{currentStepMeta?.title}</DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentStepMeta?.description}</p>
        </DialogHeader>

        <div className="flex items-center justify-start sm:justify-between gap-1 my-2 sm:my-4 shrink-0 overflow-x-auto pb-1">
          {visibleSteps.map((s, index) => (
            <div key={s.id} className="flex items-center shrink-0">
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                index < currentStepIndex
                  ? 'bg-green-500 text-white'
                  : index === currentStepIndex
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300'
              }`}>
                {index < currentStepIndex ? <Check className="w-3 h-3" /> : index + 1}
              </div>
              {index < visibleSteps.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mx-1 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {t('onboarding.location.countryRegion')}
                    {autoDetected.country && <Badge variant="secondary" className="text-[10px]">{t('onboarding.location.autoDetected')}</Badge>}
                  </Label>
                  <select
                    value={data.country}
                    onChange={(e) => {
                      const selectedCountry = COUNTRIES.find((country) => country.id === e.target.value);
                      setData((prev) => ({
                        ...prev,
                        country: e.target.value,
                        timezone: selectedCountry?.timezone || prev.timezone
                      }));
                      setAutoDetected((prev) => ({ ...prev, country: false }));
                    }}
                    className="w-full mt-1 p-2.5 text-sm border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 dark:text-white"
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {t('onboarding.location.timezone')}
                    {autoDetected.timezone && <Badge variant="secondary" className="text-[10px]">{t('onboarding.location.autoDetected')}</Badge>}
                  </Label>
                  <select
                    value={data.timezone}
                    onChange={(e) => {
                      setData((prev) => ({ ...prev, timezone: e.target.value }));
                      setAutoDetected((prev) => ({ ...prev, timezone: false }));
                    }}
                    className="w-full mt-1 p-2.5 text-sm border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 dark:text-white"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.id} value={tz.id}>{tz.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {t('onboarding.voice.outboundUsage')}
                </p>
                {!isFullV2Mode && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('onboarding.voice.optionalStep')}</p>
                )}
              </div>

              {voicesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 mx-auto text-teal-600 animate-spin mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.voice.loading')}</p>
                </div>
              ) : availableVoices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.voice.noVoices')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              const audio = new Audio(voice.sampleUrl);
                              audio.play().catch(() => toast.error(t('onboarding.voice.playSampleError')));
                            }}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {voice.gender === 'male' ? t('onboarding.voice.male') : t('onboarding.voice.female')}
                        </Badge>
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
                  onChange={(e) => setData((prev) => ({ ...prev, firstMessage: e.target.value }))}
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
                  onChange={(e) => setData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  className="w-full min-h-[100px] p-2.5 text-sm border dark:border-neutral-700 rounded-lg resize-none bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              {createdAssistantId && createdAssistantId !== 'SKIPPED_LEGACY_PREVIEW' ? (
                <VoiceDemo assistantId={createdAssistantId} />
              ) : createdAssistantId === 'SKIPPED_LEGACY_PREVIEW' ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">{t('onboarding.messages.previewStepSkipped')}</p>
                </div>
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

        <div className="flex items-center justify-between mt-3 pt-3 border-t dark:border-neutral-700 shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={prevStep} disabled={currentStepIndex === 0 || loading}>
            <ChevronLeft className="w-3 h-3 mr-1" />
            {t('onboarding.buttons.back')}
          </Button>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {currentStepIndex + 1} / {stepSequence.length}
          </div>
          <Button size="sm" onClick={nextStep} disabled={!canProceed() || loading}>
            {loading ? t('onboarding.buttons.loading') : isLastStep ? t('onboarding.buttons.complete') : t('onboarding.buttons.next')}
            {!isLastStep && <ChevronRight className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;

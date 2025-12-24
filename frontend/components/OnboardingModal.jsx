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
  FileText,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function OnboardingModal({ open, onClose }) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [data, setData] = useState({
    industry: '',
    language: locale?.toUpperCase() || 'TR',
    country: 'TR',
    voice: null,
    firstMessage: '',
    systemPrompt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  useEffect(() => {
    const fetchVoices = async () => {
      // Map our language codes to backend voice keys
      const langToVoiceKey = {
        'TR': 'tr',
        'EN': 'en',
        'PR': 'pt' // Brazilian Portuguese uses 'pt' key in backend
      };
      const voiceKey = langToVoiceKey[data.language] || 'en';

      console.log('🎤 Fetching voices... API_URL:', API_URL, 'language:', data.language, '-> key:', voiceKey);
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

    if (open) {
      fetchVoices();
    }
  }, [open, data.language]);

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
    { id: 'SERVICE', icon: Briefcase, name: t('onboarding.industries.professionalServices'), color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { id: 'OTHER', icon: Package, name: t('onboarding.industries.other'), color: 'text-gray-600', bgColor: 'bg-gray-100' }
  ];

  // Only supported countries for now
  const COUNTRIES = [
    { id: 'TR', name: 'Türkiye', nameLocal: 'Türkiye', flag: '🇹🇷', timezone: 'Europe/Istanbul', currency: 'TRY' },
    { id: 'BR', name: 'Brazil', nameLocal: 'Brasil', flag: '🇧🇷', timezone: 'America/Sao_Paulo', currency: 'BRL' },
    { id: 'US', name: 'United States', nameLocal: 'United States', flag: '🇺🇸', timezone: 'America/New_York', currency: 'USD' }
  ];

  // Only supported languages for now
  const LANGUAGES = [
    { id: 'TR', name: 'Türkçe', flag: '🇹🇷' },
    { id: 'EN', name: 'English', flag: '🇺🇸' },
    { id: 'PR', name: 'Português (BR)', flag: '🇧🇷' }
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
            systemPrompt: data.systemPrompt,
            language: data.language,
            country: data.country,
            industry: data.industry,
            timezone: data.timezone
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Use internal assistant ID (works for both VAPI legacy and 11Labs assistants)
        setCreatedAssistantId(response.data.assistant?.id || response.data.assistant?.elevenLabsAgentId);
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
        className="max-w-3xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{STEPS[step - 1]?.title}</DialogTitle>
          <p className="text-gray-600">{STEPS[step - 1]?.description}</p>
        </DialogHeader>

        <div className="flex items-center justify-between my-6">
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                s.id < step ? 'bg-green-500 text-white' :
                s.id === step ? 'bg-purple-600 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {s.id < step ? <Check className="w-4 h-4" /> : s.id}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-12 h-1 mx-2 ${s.id < step ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              )}
            </div>
      ))}
    </div>

    <div className="min-h-[300px]">

        {step === 1 && (
    <div className="space-y-6">
      {/* Language Selection */}
      <div>
        <Label className="text-base font-semibold">{t('onboarding.labels.language')}</Label>
        <p className="text-sm text-gray-500 mb-2">{t('onboarding.labels.selectAssistantLanguage')}</p>
        <div className="grid grid-cols-5 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setData({ ...data, language: lang.id })}
              className={`p-3 border rounded-lg text-center transition-all ${
                data.language === lang.id ? 'ring-2 ring-purple-600 bg-purple-50 border-purple-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Country Selection */}
      <div>
        <Label className="text-base font-semibold">{t('onboarding.labels.country')}</Label>
        <p className="text-sm text-gray-500 mb-2">{t('onboarding.labels.selectBusinessLocation')}</p>
        <div className="grid grid-cols-3 gap-3">
          {COUNTRIES.map((country) => (
            <button
              key={country.id}
              type="button"
              onClick={() => {
                // Only set country and timezone, language is selected separately
                setData({
                  ...data,
                  country: country.id,
                  timezone: country.timezone
                });
              }}
              className={`p-3 border rounded-lg text-center transition-all ${
                data.country === country.id ? 'ring-2 ring-purple-600 bg-purple-50 border-purple-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl block mb-1">{country.flag}</span>
              <span className="font-medium text-sm">{country.nameLocal}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Industry Selection */}
      <div>
        <Label className="text-base font-semibold">{t('onboarding.labels.businessType')}</Label>
        <p className="text-sm text-gray-500 mb-2">{t('onboarding.descriptions.tellUsAboutBusiness')}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            return (
              <Card
                key={industry.id}
                className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                  data.industry === industry.id ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                }`}
                onClick={() => handleIndustrySelect(industry.id)}
              >
                <div className={`p-4 rounded-lg ${industry.bgColor} mb-3 w-fit mx-auto`}>
                  <Icon className={`h-8 w-8 ${industry.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-center">{industry.name}</h3>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Timezone Selection */}
      <div>
        <Label className="text-base font-semibold">{t('onboarding.labels.businessTimezone')}</Label>
        <p className="text-sm text-gray-500 mb-2">{t('onboarding.labels.selectBusinessTimezone')}</p>
        <select
          value={data.timezone}
          onChange={(e) => setData({ ...data, timezone: e.target.value })}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.id} value={tz.id}>{tz.name}</option>
          ))}
        </select>
      </div>
    </div>
)}

          {step === 2 && (
            <div>
              {voicesLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto text-purple-600 animate-spin mb-4" />
                  <p className="text-gray-600">{t('onboarding.voice.loading') || 'Loading voices...'}</p>
                </div>
              ) : availableVoices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">{t('onboarding.voice.noVoices') || 'No voices available for this language. Please try another language.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {availableVoices.map((voice) => (
                    <Card
                      key={voice.id}
                      className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                        data.voice?.id === voice.id ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                      }`}
                      onClick={() => handleVoiceSelect(voice)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{voice.name}</h3>
                          <p className="text-xs text-gray-500">{voice.accent}</p>
                        </div>
                        {voice.sampleUrl && (
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            // Play voice sample
                            const audio = new Audio(voice.sampleUrl);
                            audio.play().catch(() => toast.error('Could not play sample'));
                          }}>
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{voice.gender === 'male' ? t('onboarding.voice.male') : t('onboarding.voice.female')}</Badge>
                        {voice.description && <Badge variant="outline">{voice.description}</Badge>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Mic2 className="h-4 w-4" />
                  {t('onboarding.labels.greetingMessage')}
                </Label>
                <p className="text-sm text-gray-500 mb-2">{t('onboarding.labels.greetingMessageDesc')}</p>
                <textarea
                  value={data.firstMessage}
                  onChange={(e) => setData({ ...data, firstMessage: e.target.value })}
                  className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('onboarding.labels.assistantInstructions')}
                </Label>
                <p className="text-sm text-gray-500 mb-2">{t('onboarding.labels.assistantInstructionsDesc')}</p>
                <textarea
                  value={data.systemPrompt}
                  onChange={(e) => setData({ ...data, systemPrompt: e.target.value })}
                  className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
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
                  <Loader2 className="h-12 w-12 mx-auto text-purple-600 animate-spin mb-4" />
                  <p className="text-gray-600">{t('onboarding.messages.creatingAssistant')}</p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('onboarding.final.allSet')}</h3>
              <p className="text-gray-600 mb-6">{t('onboarding.final.assistantReady')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <Button variant="outline" onClick={prevStep} disabled={step === 1 || loading}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('onboarding.buttons.back')}
          </Button>
          <div className="text-sm text-gray-500">{step} / {STEPS.length}</div>
          <Button onClick={nextStep} disabled={!canProceed() || loading}>
            {loading ? t('onboarding.buttons.loading') : step === 5 ? t('onboarding.buttons.complete') : t('onboarding.buttons.next')}
            {step < 5 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;

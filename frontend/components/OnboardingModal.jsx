// ============================================================================
// ONBOARDING MODAL COMPONENT
// ============================================================================
// FILE: frontend/components/OnboardingModal.jsx
//
// Multi-step onboarding flow for new users
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import VoiceDemo from './VoiceDemo';
import { ChevronRight, ChevronLeft, Check, Play, Mic, Loader2 } from 'lucide-react';
import { t, getCurrentLanguage } from '@/lib/translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const VOICES = {
  EN: [
    { id: 'male-1-professional', nameKey: 'voiceMaleProfessional', gender: 'MALE', tone: 'PROFESSIONAL' },
    { id: 'male-2-friendly', nameKey: 'voiceMaleFriendly', gender: 'MALE', tone: 'FRIENDLY' },
    { id: 'female-1-professional', nameKey: 'voiceFemaleProfessional', gender: 'FEMALE', tone: 'PROFESSIONAL' },
    { id: 'female-2-warm', nameKey: 'voiceFemaleWarm', gender: 'FEMALE', tone: 'WARM' }
  ],
  TR: [
    { id: 'tr-male-1', nameKey: 'voiceMaleProfessional', gender: 'MALE', tone: 'PROFESSIONAL' },
    { id: 'tr-male-2', nameKey: 'voiceMaleFriendly', gender: 'MALE', tone: 'FRIENDLY' },
    { id: 'tr-female-1', nameKey: 'voiceFemaleProfessional', gender: 'FEMALE', tone: 'PROFESSIONAL' },
    { id: 'tr-female-2', nameKey: 'voiceFemaleWarm', gender: 'FEMALE', tone: 'WARM' }
  ]
};

export function OnboardingModal({ open, onClose, businessId }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState(null);
  const [locale, setLocale] = useState(getCurrentLanguage());
  const [data, setData] = useState({
    language: '',
    industry: '',
    voice: null,
    greeting: ''
  });
  
  // Update locale when language changes
  useEffect(() => {
    setLocale(getCurrentLanguage());
  }, []);
  
  // Define steps and industries based on current locale
  const STEPS = [
    { id: 1, title: t('step1Title', locale), description: t('step1Desc', locale) },
    { id: 2, title: t('step2Title', locale), description: t('step2Desc', locale) },
    { id: 3, title: t('step3Title', locale), description: t('step3Desc', locale) },
    { id: 4, title: t('step4Title', locale), description: t('step4Desc', locale) },
    { id: 5, title: t('step5Title', locale), description: t('step5Desc', locale) },
    { id: 6, title: t('step6Title', locale), description: t('step6Desc', locale) }
  ];

  const INDUSTRIES = [
    { id: 'RESTAURANT', icon: '🍴', nameKey: 'industryRestaurant', exampleKey: 'greetingRestaurant' },
    { id: 'SALON', icon: '💇', nameKey: 'industrySalon', exampleKey: 'greetingSalon' },
    { id: 'ECOMMERCE', icon: '🛒', nameKey: 'industryEcommerce', exampleKey: 'greetingEcommerce' },
    { id: 'SERVICE', icon: '💼', nameKey: 'industryProfessional', exampleKey: 'greetingProfessional' },
    { id: 'OTHER', icon: '📦', nameKey: 'industryOther', exampleKey: 'greetingOther' }
  ];

  const handleLanguageSelect = (lang) => {
    setData({ ...data, language: lang });
  };

  const handleIndustrySelect = (industry) => {
    const industryData = INDUSTRIES.find(i => i.id === industry);
    setData({ 
      ...data, 
      industry,
      greeting: t(industryData.exampleKey, locale)
    });
  };

  const handleVoiceSelect = (voice) => {
    setData({ ...data, voice });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Update business settings with language
      await axios.put(
        `${API_URL}/api/business/${businessId}`,
        {
          language: data.language,
          businessType: data.industry,
          vapiVoiceId: data.voice.id,
          vapiVoiceGender: data.voice.gender,
          vapiTone: data.voice.tone,
          customGreeting: data.greeting
        },
        { headers }
      );

      // Create first AI training
      await axios.post(
        `${API_URL}/api/ai-training`,
        {
          title: t('greetingLabel', locale),
          instructions: data.greeting,
          category: 'greeting'
        },
        { headers }
      );

      toast.success(t('onboardingComplete', locale));
      
      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');
      
      // Close modal and redirect
      onClose();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(t('saveError', locale));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return data.language !== '';
      case 2: return data.industry !== '';
      case 3: return data.voice !== null;
      case 4: return data.greeting.trim() !== '';
      case 5: return true;
      case 6: return true;  // ← BUNU EKLEDİK
      default: return false;
    }
  };

  const nextStep = async () => {
    // Step 4'ten 5'e geçerken asistanı oluştur
    if (step === 4 && !createdAssistantId) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API_URL}/api/assistants`,
          {
            name: 'Test Assistant',
            voiceId: data.voice.id,
            systemPrompt: data.greeting,
            language: data.language // Pass language parameter
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCreatedAssistantId(response.data.assistant.vapiAssistantId);
        toast.success(t('saveSuccess', locale));
        setStep(5);
      } catch (error) {
        console.error('Failed to create assistant:', error);
        toast.error(t('saveError', locale));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      handleComplete();
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const availableVoices = data.language ? VOICES[data.language] : [];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="onboarding-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl">{STEPS[step - 1].title}</DialogTitle>
          <p className="text-gray-600">{STEPS[step - 1].description}</p>
        </DialogHeader>

        {/* Progress Indicators */}
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
                <div className={`w-12 h-1 mx-2 ${
                  s.id < step ? 'bg-green-500' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {/* STEP 1: Language */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className={`p-8 cursor-pointer hover:shadow-lg transition-all ${
                  data.language === 'EN' ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                }`}
                onClick={() => handleLanguageSelect('EN')}
                data-testid="language-en"
              >
                <div className="text-6xl mb-4 text-center">🇬🇧</div>
                <h3 className="text-xl font-bold text-center">English</h3>
                <p className="text-sm text-gray-600 text-center mt-2">International</p>
              </Card>

              <Card 
                className={`p-8 cursor-pointer hover:shadow-lg transition-all ${
                  data.language === 'TR' ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                }`}
                onClick={() => handleLanguageSelect('TR')}
                data-testid="language-tr"
              >
                <div className="text-6xl mb-4 text-center">🇹🇷</div>
                <h3 className="text-xl font-bold text-center">Türkçe</h3>
                <p className="text-sm text-gray-600 text-center mt-2">Türkiye</p>
              </Card>
            </div>
          )}

          {/* STEP 2: Industry */}
          {step === 2 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INDUSTRIES.map((industry) => (
                <Card
                  key={industry.id}
                  className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                    data.industry === industry.id ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                  }`}
                  onClick={() => handleIndustrySelect(industry.id)}
                  data-testid={`industry-${industry.id.toLowerCase()}`}
                >
                  <div className="text-4xl mb-3 text-center">{industry.icon}</div>
                  <h3 className="text-lg font-semibold text-center">{t(industry.nameKey, locale)}</h3>
                </Card>
              ))}
            </div>
          )}

          {/* STEP 3: Voice Selection */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              {availableVoices.map((voice) => (
                <Card
                  key={voice.id}
                  className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                    data.voice?.id === voice.id ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                  }`}
                  onClick={() => handleVoiceSelect(voice)}
                  data-testid={`voice-${voice.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t(voice.nameKey, locale)}</h3>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      toast.info('Voice preview coming soon');
                    }}>
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{voice.gender}</Badge>
                    <Badge variant="outline">{voice.tone}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* STEP 4: First Training */}
          {step === 4 && (
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-900">
                  {t('greetingTip', locale)}
                </p>
              </Card>

              <div>
                <Label htmlFor="greeting">{t('greetingLabel', locale)}</Label>
                <textarea
                  id="greeting"
                  value={data.greeting}
                  onChange={(e) => setData({ ...data, greeting: e.target.value })}
                  className="w-full min-h-[120px] p-3 border rounded-lg mt-2 resize-none"
                  placeholder={t('greetingPlaceholder', locale)}
                  data-testid="greeting-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {data.greeting.length} / 500 characters
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">
                  {t('greetingExample', locale)} {t(INDUSTRIES.find(i => i.id === data.industry)?.nameKey, locale)}:
                </h4>
                <p className="text-sm text-gray-700 italic">
                  "{t(INDUSTRIES.find(i => i.id === data.industry)?.exampleKey, locale)}"
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Test Assistant */}
          {step === 5 && (
            <div>
              {createdAssistantId ? (
                <VoiceDemo assistantId={createdAssistantId} />
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 mx-auto text-purple-600 animate-spin mb-4" />
                  <p className="text-gray-600">{t('creatingAssistant', locale)}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Complete */}
          {step === 6 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('onboardingComplete', locale)}</h3>
              <p className="text-gray-600 mb-6">
                {t('onboardingCompleteDesc', locale)}
              </p>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-semibold">{t('upgradeToGetPhone', locale)}</p>
                    <p className="text-sm text-gray-600">{t('upgradeDesc', locale)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-semibold">{t('addMoreTrainings', locale)}</p>
                    <p className="text-sm text-gray-600">{t('addTrainingsDesc', locale)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-semibold">{t('setupIntegrations', locale)}</p>
                    <p className="text-sm text-gray-600">{t('setupIntegrationsDesc', locale)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1 || loading}
            data-testid="prev-step-btn"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="text-sm text-gray-500">
            Step {step} of {STEPS.length}
          </div>

          <Button
            onClick={nextStep}
            disabled={!canProceed() || loading}
            data-testid="next-step-btn"
          >
            {loading ? 'Saving...' : step === 6 ? 'Complete' : 'Next'}
            {step < 6 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;

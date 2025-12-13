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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function OnboardingModal({ open, onClose }) {
  const { tr, locale } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [data, setData] = useState({
    industry: '',
    voice: null,
    firstMessage: '',
    systemPrompt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/voices`);
        const voiceData = response.data.voices;
        setAvailableVoices(voiceData[locale] || voiceData['en'] || []);
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      }
    };
    fetchVoices();
  }, [locale]);

  const STEPS = [
    { id: 1, title: tr('Choose Industry'), description: tr('Tell us about your business') },
    { id: 2, title: tr('Pick Your Voice'), description: tr('Select your assistant voice') },
    { id: 3, title: tr('Add Training'), description: tr('Create your first greeting') },
    { id: 4, title: tr('Test Assistant'), description: tr('Try it out!') },
    { id: 5, title: tr('Complete'), description: tr('You are all set!') }
  ];

  const INDUSTRIES = [
    { id: 'RESTAURANT', icon: UtensilsCrossed, name: tr('Restaurant'), color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { id: 'SALON', icon: Scissors, name: tr('Salon & Spa'), color: 'text-pink-600', bgColor: 'bg-pink-100' },
    { id: 'ECOMMERCE', icon: ShoppingCart, name: tr('E-commerce'), color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { id: 'SERVICE', icon: Briefcase, name: tr('Professional Services'), color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { id: 'OTHER', icon: Package, name: tr('Other'), color: 'text-gray-600', bgColor: 'bg-gray-100' }
  ];

  const TIMEZONES = [
    { id: 'America/Los_Angeles', name: '(UTC-8) Los Angeles, Pacific Time' },
    { id: 'America/Denver', name: '(UTC-7) Denver, Mountain Time' },
    { id: 'America/Chicago', name: '(UTC-6) Chicago, Central Time' },
    { id: 'America/New_York', name: '(UTC-5) New York, Eastern Time' },
    { id: 'America/Toronto', name: '(UTC-5) Toronto, Canada' },
    { id: 'America/Sao_Paulo', name: '(UTC-3) São Paulo, Brazil' },
    { id: 'Europe/London', name: '(UTC+0) London, UK' },
    { id: 'Europe/Paris', name: '(UTC+1) Paris, France' },
    { id: 'Europe/Berlin', name: '(UTC+1) Berlin, Germany' },
    { id: 'Europe/Istanbul', name: '(UTC+3) Istanbul, Turkey' },
    { id: 'Europe/Moscow', name: '(UTC+3) Moscow, Russia' },
    { id: 'Asia/Dubai', name: '(UTC+4) Dubai, UAE' },
    { id: 'Asia/Kolkata', name: '(UTC+5:30) Mumbai, India' },
    { id: 'Asia/Singapore', name: '(UTC+8) Singapore' },
    { id: 'Asia/Tokyo', name: '(UTC+9) Tokyo, Japan' },
    { id: 'Australia/Sydney', name: '(UTC+11) Sydney, Australia' }
  ];

  const PROMPTS = {
    RESTAURANT: tr('You are a restaurant assistant. Take reservations, provide menu information, share working hours, answer customer questions.'),
    SALON: tr('You are a salon assistant. Book appointments, provide information about services and prices, share available times.'),
    ECOMMERCE: tr('You are an e-commerce assistant. Provide stock information, order status updates, explain return and exchange processes.'),
    SERVICE: tr('You are a professional service assistant. Book appointments, provide service information, help with pricing.'),
    OTHER: tr('You are a business assistant. Answer customer questions, provide information, be helpful.')
  };

  const handleIndustrySelect = (industry) => {
    setData({ ...data, industry, systemPrompt: PROMPTS[industry] || '' });
  };

  const handleVoiceSelect = (voice) => {
    const greeting = tr("Hi, I'm " + voice.name + ", how can I help you?");
    setData({ ...data, voice, firstMessage: greeting });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      localStorage.setItem('onboarding_completed', 'true');
      toast.success(tr('Completed!'));
      onClose();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(tr('An error occurred'));
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
            language: locale.toUpperCase(),
            industry: data.industry,
            timezone: data.timezone
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCreatedAssistantId(response.data.assistant?.vapiAssistantId);
        toast.success(tr('Assistant created!'));
        setStep(4);
      } catch (error) {
        console.error('Failed to create assistant:', error);
        toast.error(tr('Failed to create assistant'));
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
      
      {/* Timezone Selection */}
      <div>
        <Label className="text-base font-semibold">{tr('Business Timezone')}</Label>
        <p className="text-sm text-gray-500 mb-2">{tr('Select your business operating timezone')}</p>
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
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      toast.info(tr('Voice preview coming soon'));
                    }}>
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{voice.gender === 'male' ? tr('Male') : tr('Female')}</Badge>
                    <Badge variant="outline">{voice.description}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Mic2 className="h-4 w-4" />
                  {tr('Greeting Message')}
                </Label>
                <p className="text-sm text-gray-500 mb-2">{tr('The first sentence your assistant will say')}</p>
                <textarea
                  value={data.firstMessage}
                  onChange={(e) => setData({ ...data, firstMessage: e.target.value })}
                  className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                  placeholder={tr('Hi, how can I help you?')}
                />
              </div>
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {tr('Assistant Instructions')}
                </Label>
                <p className="text-sm text-gray-500 mb-2">{tr('Instructions for how your assistant should behave')}</p>
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
                  <p className="text-gray-600">{tr('Creating assistant...')}</p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{tr('All Set!')}</h3>
              <p className="text-gray-600 mb-6">{tr('Your AI assistant is ready to use.')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <Button variant="outline" onClick={prevStep} disabled={step === 1 || loading}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {tr('Back')}
          </Button>
          <div className="text-sm text-gray-500">{step} / {STEPS.length}</div>
          <Button onClick={nextStep} disabled={!canProceed() || loading}>
            {loading ? tr('Loading...') : step === 5 ? tr('Complete') : tr('Next')}
            {step < 5 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;

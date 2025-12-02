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
import { ChevronRight, ChevronLeft, Check, Play, Loader2 } from 'lucide-react';
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
    systemPrompt: ''
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
    { id: 'RESTAURANT', icon: '🍴', name: tr('Restaurant') },
    { id: 'SALON', icon: '💇', name: tr('Salon & Spa') },
    { id: 'ECOMMERCE', icon: '🛒', name: tr('E-commerce') },
    { id: 'SERVICE', icon: '💼', name: tr('Professional Services') },
    { id: 'OTHER', icon: '📦', name: tr('Other') }
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
            industry: data.industry
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INDUSTRIES.map((industry) => (
                <Card
                  key={industry.id}
                  className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                    data.industry === industry.id ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                  }`}
                  onClick={() => handleIndustrySelect(industry.id)}
                >
                  <div className="text-4xl mb-3 text-center">{industry.icon}</div>
                  <h3 className="text-lg font-semibold text-center">{industry.name}</h3>
                </Card>
              ))}
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
                <Label className="text-base font-semibold">🎙️ {tr('Greeting Message')}</Label>
                <p className="text-sm text-gray-500 mb-2">{tr('The first sentence your assistant will say')}</p>
                <textarea
                  value={data.firstMessage}
                  onChange={(e) => setData({ ...data, firstMessage: e.target.value })}
                  className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                  placeholder={tr('Hi, how can I help you?')}
                />
              </div>
              <div>
                <Label className="text-base font-semibold">📋 {tr('Assistant Instructions')}</Label>
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
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3">🎉 {tr('All Set!')}</h3>
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

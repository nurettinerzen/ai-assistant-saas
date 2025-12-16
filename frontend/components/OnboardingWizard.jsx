/**
 * OnboardingWizard Component
 * Multi-step onboarding flow for first-time users
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ChevronRight, ChevronLeft, Mic } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';

const STEPS = [
  {
    id: 1,
    title: 'Welcome to Telyx',
    description: 'Let\'s set up your business and first AI assistant',
  },
  {
    id: 2,
    title: 'Business Information',
    description: 'Tell us about your business',
  },
  {
    id: 3,
    title: 'Assistant Setup',
    description: 'Name your AI assistant',
  },
  {
    id: 4,
    title: 'Select Voice',
    description: 'Choose how your assistant sounds',
  },
  {
    id: 5,
    title: 'Configure Behavior',
    description: 'Define your assistant\'s personality',
  },
];

export default function OnboardingWizard({ isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessType: '',
    name: '',
    voiceId: '',
    systemPrompt: '',
  });
  const [voices, setVoices] = useState([]);
  const [businessTypeFromDB, setBusinessTypeFromDB] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('tr');

  // Load business info on mount
  React.useEffect(() => {
    loadBusinessInfo();
  }, []);

  const loadBusinessInfo = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        const response = await apiClient.business.get(user.businessId);
        const business = response.data;
        // Check if business type is already set (not OTHER or empty)
        if (business.businessType && business.businessType !== 'OTHER') {
          setBusinessTypeFromDB(business.businessType);
          setFormData(prev => ({ ...prev, businessType: business.businessType.toLowerCase() }));
        }
        // Get business language for voice selection
        if (business.language) {
          setBusinessLanguage(business.language.toLowerCase());
        }
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
    }
  };

  // Load voices for step 4 (or step 3 if business type already set)
  React.useEffect(() => {
    const voiceStep = businessTypeFromDB ? 3 : 4;
    if (currentStep === voiceStep && voices.length === 0) {
      loadVoices();
    }
  }, [currentStep, businessTypeFromDB]);

  const loadVoices = async () => {
    try {
      const response = await apiClient.voices.getAll();
      // Backend returns { voices: { tr: [...], en: [...], ... } }
      const voicesData = response.data.voices || {};

      // Get voices based on business language
      const langVoices = voicesData[businessLanguage] || voicesData['tr'] || [];
      setVoices(langVoices);
    } catch (error) {
      toast.error('Failed to load voices');
    }
  };

  // Calculate actual steps based on whether business type is already set
  const getActualSteps = () => {
    if (businessTypeFromDB) {
      // Skip step 2 (Business Type) - return steps without it
      return STEPS.filter(step => step.id !== 2);
    }
    return STEPS;
  };

  const actualSteps = getActualSteps();

  // Map current step to actual step ID
  const getCurrentStepId = () => {
    if (businessTypeFromDB) {
      // When business type is set: step 1 = Welcome, step 2 = Assistant Name, step 3 = Voice, step 4 = Behavior
      const stepMapping = { 1: 1, 2: 3, 3: 4, 4: 5 };
      return stepMapping[currentStep] || currentStep;
    }
    return currentStep;
  };

  const currentStepId = getCurrentStepId();
  const totalSteps = actualSteps.length;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validate current step based on actual step ID
    if (currentStepId === 2 && !formData.businessType) {
      toast.error('Please select your business type');
      return;
    }
    if (currentStepId === 3 && !formData.name) {
      toast.error('Please enter an assistant name');
      return;
    }
    if (currentStepId === 4 && !formData.voiceId) {
      toast.error('Please select a voice');
      return;
    }
    if (currentStepId === 5 && !formData.systemPrompt) {
      toast.error('Please provide a system prompt');
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // First, update business type
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        await apiClient.put(`/api/business/${user.businessId}`, {
          businessType: formData.businessType.toUpperCase()
        });
      }

      // Create the assistant
      await apiClient.assistants.create({
        name: formData.name,
        voiceId: formData.voiceId,
        systemPrompt: formData.systemPrompt,
        metadata: {
          businessType: formData.businessType,
          createdViaOnboarding: true,
        },
      });

      toast.success('Setup completed successfully!');

      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');

      onComplete();
    } catch (error) {
      toast.error('Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  // Get step info by actual step ID
  const currentStepInfo = STEPS.find(s => s.id === currentStepId) || STEPS[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{currentStepInfo.title}</DialogTitle>
          <DialogDescription>{currentStepInfo.description}</DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-neutral-500 mt-2 text-right">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStepId === 1 && (
            <div className="text-center py-8">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Mic className="h-10 w-10 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-3">
                Ready to build your first AI assistant?
              </h3>
              <p className="text-neutral-600 max-w-md mx-auto">
                In just a few minutes, you'll have a fully functional AI phone assistant ready to handle your calls.
              </p>
            </div>
          )}

          {currentStepId === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessType">What type of business do you have? *</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) => handleInputChange('businessType', value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant / Food Service</SelectItem>
                    <SelectItem value="ecommerce">E-commerce / Online Store</SelectItem>
                    <SelectItem value="healthcare">Healthcare / Medical</SelectItem>
                    <SelectItem value="realestate">Real Estate</SelectItem>
                    <SelectItem value="salon">Salon / Beauty Services</SelectItem>
                    <SelectItem value="professional">Professional Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-2">
                  This helps us customize your AI assistant for your industry.
                </p>
              </div>
            </div>
          )}

          {currentStepId === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Assistant Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Customer Support Bot"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Give your assistant a friendly name that your customers will recognize.
                </p>
              </div>
            </div>
          )}

          {currentStepId === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Select a Voice *</Label>
                <div className="grid grid-cols-2 gap-3 mt-2 max-h-[300px] overflow-y-auto">
                  {voices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        formData.voiceId === voice.id
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                      onClick={() => handleInputChange('voiceId', voice.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-neutral-900">{voice.name}</h4>
                        {formData.voiceId === voice.id && (
                          <Check className="h-4 w-4 text-primary-600" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {voice.gender} • {voice.accent}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStepId === 5 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <Textarea
                  id="systemPrompt"
                  rows={8}
                  placeholder="Example: You are a friendly customer service assistant for a restaurant. Help customers make reservations, answer menu questions, and provide information about hours and location. Always be polite and professional."
                  value={formData.systemPrompt}
                  onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  This defines your assistant's personality and behavior. Be specific!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-6 border-t border-neutral-200">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button onClick={handleNext} disabled={loading}>
            {loading ? (
              'Setting up...'
            ) : currentStep === totalSteps ? (
              'Complete Setup'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';

const STEPS = [
  {
    id: 1,
    title: 'Welcome to Telyx! 👋',
    description: 'Let\'s set up your first AI assistant in 4 easy steps',
  },
  {
    id: 2,
    title: 'Basic Information',
    description: 'Tell us about your assistant',
  },
  {
    id: 3,
    title: 'Select Voice',
    description: 'Choose how your assistant sounds',
  },
  {
    id: 4,
    title: 'Configure Behavior',
    description: 'Define your assistant\'s personality',
  },
];

export default function OnboardingWizard({ isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    businessType: '',
    voiceId: '',
    systemPrompt: '',
  });
  const [voices, setVoices] = useState([]);

  // Load voices for step 3
  React.useEffect(() => {
    if (currentStep === 3 && voices.length === 0) {
      loadVoices();
    }
  }, [currentStep]);

  const loadVoices = async () => {
    try {
      const response = await apiClient.voices.getAll();
      setVoices(response.data.voices || []);
    } catch (error) {
      toast.error('Failed to load voices');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validate current step
    if (currentStep === 2 && (!formData.name || !formData.businessType)) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (currentStep === 3 && !formData.voiceId) {
      toast.error('Please select a voice');
      return;
    }
    if (currentStep === 4 && !formData.systemPrompt) {
      toast.error('Please provide a system prompt');
      return;
    }

    if (currentStep < 4) {
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

      toast.success('Assistant created successfully! 🎉');
      
      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');
      
      onComplete();
    } catch (error) {
      toast.error('Failed to create assistant');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{STEPS[currentStep - 1].title}</DialogTitle>
          <DialogDescription>{STEPS[currentStep - 1].description}</DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-neutral-500 mt-2 text-right">
            Step {currentStep} of {STEPS.length}
          </p>
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStep === 1 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-6">🚀</div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-3">
                Ready to build your first AI assistant?
              </h3>
              <p className="text-neutral-600 max-w-md mx-auto">
                In just a few minutes, you'll have a fully functional AI phone assistant ready to handle your calls.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Assistant Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Customer Support Bot"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="businessType">Business Type *</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) => handleInputChange('businessType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="retail">Retail / E-commerce</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="realestate">Real Estate</SelectItem>
                    <SelectItem value="professional">Professional Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 3 && (
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

          {currentStep === 4 && (
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
              'Creating...'
            ) : currentStep === 4 ? (
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

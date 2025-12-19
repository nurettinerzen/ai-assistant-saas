/**
 * TemplateSelector Component
 * Modal with assistant templates filtered by business type
 * Shows only relevant template + Start from Scratch option
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Calendar,
  ShoppingBag,
  Headphones,
  Stethoscope,
  Home,
  Briefcase,
  Plus,
  Loader2,
  Sparkles,
} from 'lucide-react';

// Icon mapping for template industries
const INDUSTRY_ICONS = {
  'Restaurant': Calendar,
  'Salon': Briefcase,
  'E-commerce': ShoppingBag,
  'Support': Headphones,
  'Healthcare': Stethoscope,
  'Real Estate': Home,
  'Professional': Briefcase,
};

// Map business types (from Prisma enum) to template industries
const BUSINESS_TYPE_TO_INDUSTRY = {
  'RESTAURANT': 'Restaurant',
  'SALON': 'Salon',
  'ECOMMERCE': 'E-commerce',
  'E-COMMERCE': 'E-commerce',
  'CLINIC': 'Healthcare',
  'SERVICE': 'Support',
  'HEALTHCARE': 'Healthcare',
  'SUPPORT': 'Support',
  'REAL_ESTATE': 'Real Estate',
  'PROFESSIONAL': 'Professional',
  'OTHER': null, // Show all for OTHER
};

export default function TemplateSelector({ isOpen, onClose, onSelectTemplate, selectedLanguage }) {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const init = async () => {
      setLoading(true);
      try {
        // Load business info to get type and language
        let lang = 'tr'; // Default to Turkish
        let bizType = null;
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (user.businessId) {
          try {
            const response = await apiClient.business.get(user.businessId);
            // API returns business directly, not wrapped in { business: ... }
            const business = response.data;
            const businessLang = business?.language?.toLowerCase();
            if (businessLang) {
              lang = businessLang;
            }
            bizType = business?.businessType;
            setBusinessType(bizType);
            console.log('🏢 Business info loaded:', { language: businessLang, businessType: bizType });
          } catch (error) {
            console.error('Failed to load business info:', error);
          }
        }

        // Use selectedLanguage prop only if explicitly provided and different from business language
        if (selectedLanguage && selectedLanguage !== 'en') {
          lang = selectedLanguage;
        }

        // Load templates with the correct language
        console.log('🎯 Loading templates for language:', lang, 'businessType:', bizType);
        const response = await apiClient.assistants.getTemplates(lang);
        let allTemplates = response.data.templates || [];

        console.log('📋 All templates received:', allTemplates.length, allTemplates.map(t => ({ name: t.name, industry: t.industry, language: t.language })));

        // Filter by business type if set and not OTHER
        if (bizType && bizType !== 'OTHER') {
          const targetIndustry = BUSINESS_TYPE_TO_INDUSTRY[bizType.toUpperCase()];
          console.log('🔍 Filtering for industry:', targetIndustry, 'from businessType:', bizType);
          if (targetIndustry) {
            allTemplates = allTemplates.filter(t => t.industry === targetIndustry);
          }
        }

        console.log('✅ Filtered templates:', allTemplates.length);
        setTemplates(allTemplates);
      } catch (error) {
        console.error('Failed to load templates:', error);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isOpen, selectedLanguage]);

  const handleSelectTemplate = (template) => {
    onSelectTemplate({
      name: template.name,
      prompt: template.systemPrompt,
      language: template.language?.toLowerCase() || 'en',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('templates.chooseTemplate')}</DialogTitle>
          <DialogDescription>
            {t('templates.startWithTemplateOrScratch')}
          </DialogDescription>
        </DialogHeader>

        {/* Templates */}
        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Recommended template based on business type */}
              {templates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-primary-600">
                    <Sparkles className="h-4 w-4" />
                    <span>{t('templates.recommendedForYou')}</span>
                  </div>
                  {templates.map((template) => {
                    const Icon = INDUSTRY_ICONS[template.industry] || Briefcase;
                    return (
                      <div
                        key={template.id}
                        className="border-2 border-primary-200 bg-primary-50/50 rounded-lg p-6 hover:border-primary-400 hover:bg-primary-50 cursor-pointer transition-all group"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                            <Icon className="h-6 w-6 text-primary-600" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-neutral-900">
                                {template.name}
                              </h3>
                              <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-700">
                                {template.language}
                              </Badge>
                            </div>
                            <p className="text-sm text-neutral-600">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-sm text-neutral-500">
                    {t('common.or')}
                  </span>
                </div>
              </div>

              {/* Start from scratch option */}
              <div
                className="border border-neutral-200 rounded-lg p-6 hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer transition-all group"
                onClick={() => {
                  onSelectTemplate(null);
                  onClose();
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-neutral-100 rounded-lg group-hover:bg-neutral-200 transition-colors">
                    <Plus className="h-6 w-6 text-neutral-600" />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900">
                      {t('templates.startFromScratch')}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      {t('templates.createCustomAssistant')}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

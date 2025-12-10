/**
 * TemplateSelector Component
 * Modal with assistant templates for quick creation
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  Loader2,
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

export default function TemplateSelector({ isOpen, onClose, onSelectTemplate, selectedLanguage }) {
  const { t, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessLanguage, setBusinessLanguage] = useState('en');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadBusinessLanguage();
    }
  }, [isOpen, selectedLanguage]);

  const loadBusinessLanguage = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        const response = await apiClient.business.get(user.businessId);
        const language = response.data.business?.language?.toLowerCase() || 'en';
        setBusinessLanguage(language);
      }
    } catch (error) {
      console.error('Failed to load business language:', error);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Use selectedLanguage if provided, otherwise use locale or business language
      const lang = selectedLanguage || locale || businessLanguage;
      const response = await apiClient.assistants.getTemplates(lang);
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('chooseTemplate')}</DialogTitle>
          <DialogDescription>
            {t('startWithTemplateOrScratch')}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('searchTemplates')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Templates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => {
              const Icon = INDUSTRY_ICONS[template.industry] || Briefcase;
              return (
                <div
                  key={template.id}
                  className="border border-neutral-200 rounded-lg p-6 hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer transition-all group"
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
                        <Badge variant="secondary" className="text-xs">
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
            })
          ) : (
            <div className="col-span-2 text-center py-12 text-neutral-500">
              {t('noTemplatesFound')}
            </div>
          )}
        </div>

        {/* Blank template option */}
        <div className="border-t border-neutral-200 pt-4 mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onSelectTemplate(null);
              onClose();
            }}
          >
            Start from Scratch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

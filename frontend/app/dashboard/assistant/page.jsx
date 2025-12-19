/**
 * Assistants Page
 * Manage AI assistants with template selector
 * UPDATE EXISTING FILE: frontend/app/dashboard/assistant/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import TemplateSelector from '@/components/TemplateSelector';
import { Bot, Plus, Edit, Trash2, Play, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

// Language code to accent name mapping
const LANGUAGE_TO_ACCENT = {
  'tr': 'Turkish',
  'en': 'American',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
};

const LANGUAGE_NAMES = {
  'tr': 'Turkish',
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
};

export default function AssistantsPage() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();
  const [assistants, setAssistants] = useState([]);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('tr'); // Default to Turkish
  const [formData, setFormData] = useState({
    name: '',
    voiceId: '',
    systemPrompt: '',
    model: 'gpt-4',
    language: locale || 'tr',
    tone: 'professional',  // "friendly" or "professional"
    customNotes: '',       // Business-specific notes
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get business info (language and type)
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        try {
          const businessRes = await apiClient.business.get(user.businessId);
          // API returns business directly, not wrapped in { business: ... }
          const business = businessRes.data;
          const language = business?.language?.toLowerCase() || 'tr';
          setBusinessLanguage(language);
          // Set default language in form
          setFormData(prev => ({ ...prev, language }));
        } catch (error) {
          console.error('Failed to load business info:', error);
        }
      }

      const [assistantsRes, voicesRes] = await Promise.all([
        apiClient.assistants.getAll(),
        apiClient.voices.getAll(),
      ]);
      setAssistants(assistantsRes.data.assistants || []);

      // Flatten all language voices into single array with language property
      const voiceData = voicesRes.data.voices || {};
      const allVoices = [];
      Object.keys(voiceData).forEach(lang => {
        if (Array.isArray(voiceData[lang])) {
          allVoices.push(...voiceData[lang].map(v => ({ ...v, language: lang })));
        }
      });
      setVoices(allVoices);
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template) => {
    if (template) {
      setFormData({
        name: template.name,
        voiceId: '',
        systemPrompt: template.prompt,
        model: 'gpt-4',
        language: template.language || businessLanguage || 'tr',
        tone: 'professional',
        customNotes: '',
      });
    } else {
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: '',
        model: 'gpt-4',
        language: businessLanguage || 'tr',
        tone: 'professional',
        customNotes: '',
      });
    }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.voiceId || !formData.systemPrompt) {
      toast.error(t('dashboard.assistantsPage.fillAllRequired'));
      return;
    }

    try {
      await apiClient.assistants.create(formData);
      toast.success(t('dashboard.assistantsPage.createdSuccess'));
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const handleEdit = (assistant) => {
    setEditingAssistant(assistant);
    // Try to infer language from voice if not stored
    const voice = voices.find(v => v.id === assistant.voiceId);
    const inferredLang = voice?.language || businessLanguage || 'en';
    setFormData({
      name: assistant.name,
      voiceId: assistant.voiceId,
      systemPrompt: assistant.systemPrompt,
      model: assistant.model || 'gpt-4',
      language: assistant.language || inferredLang,
      tone: assistant.tone || 'professional',
      customNotes: assistant.customNotes || '',
    });
    setShowCreateModal(true);
  };

  const handleUpdate = async () => {
    if (!editingAssistant) return;

    try {
      await apiClient.assistants.update(editingAssistant.id, formData);
      toast.success(t('dashboard.assistantsPage.updatedSuccess'));
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const handleDelete = async (assistant) => {
    try {
      await apiClient.assistants.delete(assistant.id);
      toast.success(t('dashboard.assistantsPage.deletedSuccess'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', voiceId: '', systemPrompt: '', model: 'gpt-4', language: businessLanguage || 'tr', tone: 'professional', customNotes: '' });
    setEditingAssistant(null);
  };

  // Filter voices by selected language
  const filteredVoices = voices.filter(voice => {
    const selectedAccent = LANGUAGE_TO_ACCENT[formData.language];
    return voice.accent === selectedAccent;
  });

  const filteredAssistants = assistants.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.assistantsPage.title')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.assistantsPage.description')}</p>
        </div>
{can('assistants:create') && (
        <Button onClick={() => setShowTemplateSelector(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.assistantsPage.create')}
        </Button>
        )}
      </div>

      {/* Search */}
      {assistants.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('dashboard.assistantsPage.searchAssistants')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Assistants grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse">
              <div className="h-6 w-32 bg-neutral-200 rounded mb-3"></div>
              <div className="h-4 w-full bg-neutral-200 rounded mb-2"></div>
              <div className="h-4 w-2/3 bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredAssistants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssistants.map((assistant) => {
            const voice = voices.find((v) => v.id === assistant.voiceId);
            return (
              <div
                key={assistant.id}
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Bot className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">{assistant.name}</h3>
                      <p className="text-xs text-neutral-500">
                        {formatDate(assistant.createdAt, 'short')}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-neutral-600 line-clamp-2 mb-4">
                  {assistant.systemPrompt}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary">{voice?.name || t('dashboard.voicesPage.noVoicesFound')}</Badge>
                  <Badge variant="outline">{assistant.model}</Badge>
                </div>

                <div className="flex gap-2">
                  {can('assistants:edit') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(assistant)}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    {t('dashboard.assistantsPage.edit')}
                  </Button>
                  )}
                  {can('assistants:delete') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(assistant)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bot}
          title={t('dashboard.assistantsPage.noAssistants')}
          description={t('dashboard.assistantsPage.createFirstDesc')}
          actionLabel={t('dashboard.assistantsPage.create')}
          onAction={() => setShowTemplateSelector(true)}
        />
      )}

      {/* Template selector modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelect}
        selectedLanguage={businessLanguage}
      />

      {/* Create/Edit modal */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAssistant ? t('common.edit') : t('common.create')} {t('dashboard.assistantsPage.name')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.assistantsPage.configureSettings')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('dashboard.assistantsPage.nameRequired')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={locale === 'tr' ? 'örn: Müşteri Destek Asistanı' : 'e.g., Customer Support Bot'}
              />
            </div>

            <div>
              <Label htmlFor="language">{t('dashboard.assistantsPage.assistantLanguage')}</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value, voiceId: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tr">{locale === 'tr' ? 'Türkçe' : 'Turkish'}</SelectItem>
                  <SelectItem value="en">{locale === 'tr' ? 'İngilizce' : 'English'}</SelectItem>
                  <SelectItem value="de">{locale === 'tr' ? 'Almanca' : 'German'}</SelectItem>
                  <SelectItem value="fr">{locale === 'tr' ? 'Fransızca' : 'French'}</SelectItem>
                  <SelectItem value="es">{locale === 'tr' ? 'İspanyolca' : 'Spanish'}</SelectItem>
                  <SelectItem value="it">{locale === 'tr' ? 'İtalyanca' : 'Italian'}</SelectItem>
                  <SelectItem value="pt">{locale === 'tr' ? 'Portekizce' : 'Portuguese'}</SelectItem>
                  <SelectItem value="ru">{locale === 'tr' ? 'Rusça' : 'Russian'}</SelectItem>
                  <SelectItem value="ar">{locale === 'tr' ? 'Arapça' : 'Arabic'}</SelectItem>
                  <SelectItem value="ja">{locale === 'tr' ? 'Japonca' : 'Japanese'}</SelectItem>
                  <SelectItem value="ko">{locale === 'tr' ? 'Korece' : 'Korean'}</SelectItem>
                  <SelectItem value="zh">{locale === 'tr' ? 'Çince' : 'Chinese'}</SelectItem>
                  <SelectItem value="hi">{locale === 'tr' ? 'Hintçe' : 'Hindi'}</SelectItem>
                  <SelectItem value="nl">{locale === 'tr' ? 'Felemenkçe' : 'Dutch'}</SelectItem>
                  <SelectItem value="pl">{locale === 'tr' ? 'Lehçe' : 'Polish'}</SelectItem>
                  <SelectItem value="sv">{locale === 'tr' ? 'İsveççe' : 'Swedish'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 mt-1">
                {t('dashboard.assistantsPage.voicesFilteredByLanguage')}
              </p>
            </div>

            <div>
              <Label htmlFor="voice">{t('dashboard.assistantsPage.voiceRequired')}</Label>
              <Select
                value={formData.voiceId}
                onValueChange={(value) => setFormData({ ...formData, voiceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dashboard.assistantsPage.selectVoice')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredVoices.length > 0 ? (
                    filteredVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.gender})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-sm text-neutral-500">
                      {t('dashboard.assistantsPage.noVoicesForLanguage')}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model">{locale === 'tr' ? 'AI Modeli' : 'AI Model'}</Label>
              <Select
                value={formData.model}
                onValueChange={(value) => setFormData({ ...formData, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tone Selector */}
            <div>
              <Label htmlFor="tone">{t('dashboard.assistantsPage.communicationTone')}</Label>
              <Select
                value={formData.tone}
                onValueChange={(value) => setFormData({ ...formData, tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">
                    {t('dashboard.assistantsPage.toneProf')}
                  </SelectItem>
                  <SelectItem value="friendly">
                    {t('dashboard.assistantsPage.toneFriendly')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 mt-1">
                {formData.tone === 'friendly'
                  ? t('dashboard.assistantsPage.toneFriendlyDesc')
                  : t('dashboard.assistantsPage.toneProfDesc')}
              </p>
            </div>

            <div>
              <Label htmlFor="prompt">{t('dashboard.assistantsPage.systemPromptRequired')}</Label>
              <Textarea
                id="prompt"
                rows={6}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder={t('dashboard.assistantsPage.systemPromptPlaceholder')}
              />
            </div>

            {/* Custom Notes */}
            <div>
              <Label htmlFor="customNotes">
                {t('dashboard.assistantsPage.customNotes')}
              </Label>
              <Textarea
                id="customNotes"
                rows={4}
                value={formData.customNotes}
                onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
                placeholder={t('dashboard.assistantsPage.customNotesPlaceholder')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={editingAssistant ? handleUpdate : handleCreate}>
              {editingAssistant ? t('dashboard.assistantsPage.updateBtn') : t('dashboard.assistantsPage.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
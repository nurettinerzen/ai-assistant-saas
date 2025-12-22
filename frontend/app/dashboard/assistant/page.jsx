/**
 * Assistants Page
 * Manage AI assistants with inbound/outbound type selection
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
import { Bot, Plus, Edit, Trash2, Search, Phone, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
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

// Call purpose options for outbound calls
const CALL_PURPOSES = [
  { value: 'collection', labelTr: 'Tahsilat', labelEn: 'Collection' },
  { value: 'reminder', labelTr: 'Randevu Hatırlatma', labelEn: 'Appointment Reminder' },
  { value: 'survey', labelTr: 'Anket', labelEn: 'Survey' },
  { value: 'info', labelTr: 'Bilgilendirme', labelEn: 'Information' },
  { value: 'custom', labelTr: 'Özel', labelEn: 'Custom' },
];

// Default dynamic variables
const DEFAULT_DYNAMIC_VARIABLES = [
  { key: 'customer_name', labelTr: 'Müşteri Adı', labelEn: 'Customer Name' },
  { key: 'debt_amount', labelTr: 'Borç Tutarı', labelEn: 'Debt Amount' },
  { key: 'due_date', labelTr: 'Vade Tarihi', labelEn: 'Due Date' },
  { key: 'appointment_date', labelTr: 'Randevu Tarihi', labelEn: 'Appointment Date' },
  { key: 'custom_1', labelTr: 'Özel 1', labelEn: 'Custom 1' },
  { key: 'custom_2', labelTr: 'Özel 2', labelEn: 'Custom 2' },
];

export default function AssistantsPage() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();
  const [assistants, setAssistants] = useState([]);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [selectedCallDirection, setSelectedCallDirection] = useState('inbound');

  const [businessLanguage, setBusinessLanguage] = useState('tr');
  const [formData, setFormData] = useState({
    name: '',
    voiceId: '',
    systemPrompt: '',
    model: 'gpt-4',
    language: locale || 'tr',
    tone: 'formal',
    customNotes: '',
    callDirection: 'inbound',
    callPurpose: '',
    dynamicVariables: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        try {
          const businessRes = await apiClient.business.get(user.businessId);
          const business = businessRes.data;
          const language = business?.language?.toLowerCase() || 'tr';
          setBusinessLanguage(language);
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

  // Handle "Yeni Asistan" button click - show type selector first
  const handleNewAssistant = () => {
    setShowTypeSelector(true);
  };

  // Handle type selection
  const handleTypeSelect = (direction) => {
    setSelectedCallDirection(direction);
    setShowTypeSelector(false);

    if (direction === 'inbound') {
      // For inbound, show template selector
      setShowTemplateSelector(true);
    } else {
      // For outbound, go directly to create modal with outbound settings
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: '',
        model: 'gpt-4',
        language: businessLanguage || 'tr',
        tone: 'formal',
        customNotes: '',
        callDirection: 'outbound',
        callPurpose: 'collection',
        dynamicVariables: ['customer_name', 'debt_amount'],
      });
      setShowCreateModal(true);
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
        tone: 'formal',
        customNotes: '',
        callDirection: 'inbound',
        callPurpose: '',
        dynamicVariables: [],
      });
    } else {
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: '',
        model: 'gpt-4',
        language: businessLanguage || 'tr',
        tone: 'formal',
        customNotes: '',
        callDirection: 'inbound',
        callPurpose: '',
        dynamicVariables: [],
      });
    }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.voiceId) {
      toast.error(t('dashboard.assistantsPage.fillAllRequired'));
      return;
    }

    // For outbound, systemPrompt is required
    if (formData.callDirection === 'outbound' && !formData.systemPrompt) {
      toast.error(locale === 'tr' ? 'Sistem promptu gerekli' : 'System prompt is required');
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
    const voice = voices.find(v => v.id === assistant.voiceId);
    const inferredLang = voice?.language || businessLanguage || 'en';
    setFormData({
      name: assistant.name,
      voiceId: assistant.voiceId,
      systemPrompt: '',
      model: assistant.model || 'gpt-4',
      language: assistant.language || inferredLang,
      tone: assistant.tone || 'formal',
      customNotes: assistant.customNotes || '',
      callDirection: assistant.callDirection || 'inbound',
      callPurpose: assistant.callPurpose || '',
      dynamicVariables: assistant.dynamicVariables || [],
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
    if (!confirm(locale === 'tr' ? 'Bu asistanı silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this assistant?')) {
      return;
    }
    try {
      await apiClient.assistants.delete(assistant.id);
      toast.success(t('dashboard.assistantsPage.deletedSuccess'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      voiceId: '',
      systemPrompt: '',
      model: 'gpt-4',
      language: businessLanguage || 'tr',
      tone: 'formal',
      customNotes: '',
      callDirection: 'inbound',
      callPurpose: '',
      dynamicVariables: [],
    });
    setEditingAssistant(null);
    setSelectedCallDirection('inbound');
  };

  const toggleDynamicVariable = (varKey) => {
    setFormData(prev => {
      const vars = prev.dynamicVariables || [];
      if (vars.includes(varKey)) {
        return { ...prev, dynamicVariables: vars.filter(v => v !== varKey) };
      } else {
        return { ...prev, dynamicVariables: [...vars, varKey] };
      }
    });
  };

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
          <Button onClick={handleNewAssistant}>
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
            const isOutbound = assistant.callDirection === 'outbound';

            return (
              <div
                key={assistant.id}
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOutbound ? 'bg-orange-100' : 'bg-primary-100'}`}>
                      {isOutbound ? (
                        <PhoneOutgoing className="h-5 w-5 text-orange-600" />
                      ) : (
                        <PhoneIncoming className="h-5 w-5 text-primary-600" />
                      )}
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
                  {isOutbound
                    ? (locale === 'tr' ? 'Giden Arama Asistanı' : 'Outbound Call Assistant')
                    : (locale === 'tr' ? 'Gelen Arama Asistanı' : 'Inbound Call Assistant')
                  }
                  {assistant.callPurpose && (
                    <span className="text-primary-600"> • {
                      CALL_PURPOSES.find(p => p.value === assistant.callPurpose)?.[locale === 'tr' ? 'labelTr' : 'labelEn'] || assistant.callPurpose
                    }</span>
                  )}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Call Direction Badge */}
                  <Badge
                    variant="secondary"
                    className={isOutbound ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}
                  >
                    {isOutbound
                      ? (locale === 'tr' ? 'Giden' : 'Outbound')
                      : (locale === 'tr' ? 'Gelen' : 'Inbound')
                    }
                  </Badge>
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
          onAction={handleNewAssistant}
        />
      )}

      {/* Type Selector Modal */}
      <Dialog open={showTypeSelector} onOpenChange={setShowTypeSelector}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {locale === 'tr' ? 'Ne tür bir asistan oluşturmak istiyorsunuz?' : 'What type of assistant do you want to create?'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'tr'
                ? 'Asistanınızın kullanım amacını seçin'
                : 'Select the purpose of your assistant'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Inbound Option */}
            <button
              onClick={() => handleTypeSelect('inbound')}
              className="flex flex-col items-center p-6 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
            >
              <div className="p-4 bg-blue-100 rounded-full mb-4 group-hover:bg-blue-200 transition-colors">
                <PhoneIncoming className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-1">
                {locale === 'tr' ? 'Gelen Arama' : 'Inbound Call'}
              </h3>
              <p className="text-xs text-neutral-500 text-center">
                {locale === 'tr'
                  ? 'Müşterileriniz sizi aradığında yanıt verir'
                  : 'Answers when customers call you'
                }
              </p>
            </button>

            {/* Outbound Option */}
            <button
              onClick={() => handleTypeSelect('outbound')}
              className="flex flex-col items-center p-6 border-2 border-neutral-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all group"
            >
              <div className="p-4 bg-orange-100 rounded-full mb-4 group-hover:bg-orange-200 transition-colors">
                <PhoneOutgoing className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-1">
                {locale === 'tr' ? 'Giden Arama' : 'Outbound Call'}
              </h3>
              <p className="text-xs text-neutral-500 text-center">
                {locale === 'tr'
                  ? 'Müşterilerinizi siz aradığında konuşur'
                  : 'Speaks when you call customers'
                }
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template selector modal (for inbound) */}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.callDirection === 'outbound' ? (
                <PhoneOutgoing className="h-5 w-5 text-orange-600" />
              ) : (
                <PhoneIncoming className="h-5 w-5 text-blue-600" />
              )}
              {editingAssistant ? t('common.edit') : t('common.create')} {t('dashboard.assistantsPage.name')}
              <Badge
                variant="secondary"
                className={formData.callDirection === 'outbound' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}
              >
                {formData.callDirection === 'outbound'
                  ? (locale === 'tr' ? 'Giden Arama' : 'Outbound')
                  : (locale === 'tr' ? 'Gelen Arama' : 'Inbound')
                }
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {t('dashboard.assistantsPage.configureSettings')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="name">{t('dashboard.assistantsPage.nameRequired')}</Label>
                <span className={`text-xs ${formData.name.length > 25 ? 'text-red-500' : 'text-neutral-500'}`}>
                  {formData.name.length}/25
                </span>
              </div>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  if (e.target.value.length <= 25) {
                    setFormData({ ...formData, name: e.target.value });
                  }
                }}
                maxLength={25}
                placeholder={locale === 'tr' ? 'örn: Müşteri Destek' : 'e.g., Customer Support'}
              />
            </div>

            {/* Call Purpose (only for outbound) */}
            {formData.callDirection === 'outbound' && (
              <div>
                <Label>{locale === 'tr' ? 'Arama Amacı' : 'Call Purpose'}</Label>
                <Select
                  value={formData.callPurpose}
                  onValueChange={(value) => setFormData({ ...formData, callPurpose: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={locale === 'tr' ? 'Amaç seçin' : 'Select purpose'} />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_PURPOSES.map((purpose) => (
                      <SelectItem key={purpose.value} value={purpose.value}>
                        {locale === 'tr' ? purpose.labelTr : purpose.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Language */}
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

            {/* Voice */}
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

            {/* AI Model */}
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
                  <SelectItem value="formal">
                    {t('dashboard.assistantsPage.toneProf')}
                  </SelectItem>
                  <SelectItem value="casual">
                    {t('dashboard.assistantsPage.toneFriendly')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Variables (only for outbound) */}
            {formData.callDirection === 'outbound' && (
              <div>
                <Label>{locale === 'tr' ? 'Dinamik Değişkenler' : 'Dynamic Variables'}</Label>
                <p className="text-xs text-neutral-500 mb-2">
                  {locale === 'tr'
                    ? 'Bu değişkenler Excel/CSV dosyasından eşleştirilebilir ve prompt içinde {{değişken}} şeklinde kullanılabilir.'
                    : 'These variables can be mapped from Excel/CSV and used in prompts as {{variable}}.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_DYNAMIC_VARIABLES.map((variable) => {
                    const isSelected = (formData.dynamicVariables || []).includes(variable.key);
                    return (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => toggleDynamicVariable(variable.key)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {locale === 'tr' ? variable.labelTr : variable.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* System Prompt / Instructions */}
            <div>
              <Label htmlFor="prompt">
                {formData.callDirection === 'outbound'
                  ? (locale === 'tr' ? 'Sistem Promptu *' : 'System Prompt *')
                  : (locale === 'tr' ? 'Ek Talimatlar (Opsiyonel)' : 'Additional Instructions (Optional)')
                }
              </Label>
              <Textarea
                id="prompt"
                rows={formData.callDirection === 'outbound' ? 6 : 4}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder={
                  formData.callDirection === 'outbound'
                    ? (locale === 'tr'
                        ? 'Örn: Merhaba {{customer_name}}, X şirketinden arıyorum. {{debt_amount}} TL tutarında vadesi geçmiş borcunuz bulunmaktadır...'
                        : 'E.g., Hello {{customer_name}}, I am calling from X company. You have an overdue balance of {{debt_amount}}...')
                    : (locale === 'tr'
                        ? 'Asistanın davranışı için ek talimatlar... (Temel kurallar otomatik eklenir)'
                        : 'Additional instructions for assistant behavior... (Base rules are added automatically)')
                }
              />
              {formData.callDirection === 'outbound' && (
                <p className="text-xs text-neutral-500 mt-1">
                  {locale === 'tr'
                    ? 'Seçtiğiniz dinamik değişkenleri {{değişken}} formatında kullanabilirsiniz.'
                    : 'You can use selected dynamic variables in {{variable}} format.'}
                </p>
              )}
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
              <p className="text-xs text-neutral-500 mt-1">
                {locale === 'tr'
                  ? 'Çalışma saatleri, adres, özel kurallar vb. asistanın bilmesi gereken bilgiler.'
                  : 'Working hours, address, special rules, etc. that the assistant should know.'}
              </p>
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

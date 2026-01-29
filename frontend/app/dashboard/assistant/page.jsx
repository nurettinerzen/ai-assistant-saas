/**
 * Assistants Page
 * Manage AI assistants with inbound/outbound type selection
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  useAssistants,
  useVoices,
  useBusiness,
  useCreateAssistant,
  useUpdateAssistant,
  useDeleteAssistant,
  useSyncAssistant
} from '@/hooks/useAssistants';
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
import { Bot, Plus, Edit, Trash2, Search, Phone, PhoneOutgoing, PhoneIncoming, Loader2, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NAVIGATION_ITEMS } from '@/lib/navigationConfig';

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

// Call purpose options for outbound calls - simplified to 3 main purposes
const CALL_PURPOSES = {
  // All available purposes (same for all business types)
  common: [
    { value: 'sales', labelTr: 'Satış', labelEn: 'Sales' },
    { value: 'collection', labelTr: 'Tahsilat', labelEn: 'Collection' },
    { value: 'general', labelTr: 'Genel Bilgilendirme', labelEn: 'General Information' },
  ],
  // All purpose definitions
  definitions: {
    sales: { labelTr: 'Satış', labelEn: 'Sales' },
    collection: { labelTr: 'Tahsilat', labelEn: 'Collection' },
    general: { labelTr: 'Genel Bilgilendirme', labelEn: 'General Information' },
  }
};

// Default first messages - simple and dynamic based on assistant name
const DEFAULT_FIRST_MESSAGES = {
  // Inbound: "Merhaba! Ben (asistan adı). Size nasıl yardımcı olabilirim?"
  inbound: {
    tr: (businessName, assistantName) => assistantName
      ? `Merhaba! Ben ${assistantName}. Size nasıl yardımcı olabilirim?`
      : `Merhaba! Size nasıl yardımcı olabilirim?`,
    en: (businessName, assistantName) => assistantName
      ? `Hello! I'm ${assistantName}. How can I help you?`
      : `Hello! How can I help you?`
  },
  // Outbound: "Merhaba! Ben (asistan adı). (şirket adı) adına arıyorum."
  outbound: {
    tr: (businessName, assistantName) => {
      const name = assistantName || '';
      const company = businessName || '';
      if (name && company) return `Merhaba! Ben ${name}. ${company} adına arıyorum.`;
      if (name) return `Merhaba! Ben ${name}.`;
      if (company) return `Merhaba! ${company} adına arıyorum.`;
      return `Merhaba!`;
    },
    en: (businessName, assistantName) => {
      const name = assistantName || '';
      const company = businessName || '';
      if (name && company) return `Hello! I'm ${name}. I'm calling on behalf of ${company}.`;
      if (name) return `Hello! I'm ${name}.`;
      if (company) return `Hello! I'm calling on behalf of ${company}.`;
      return `Hello!`;
    }
  }
};

// Default system prompts based on call purpose (simple instructions)
const DEFAULT_SYSTEM_PROMPTS = {
  sales: {
    tr: `Satış araması yap. Ürün veya hizmeti tanıt. Müşterinin ihtiyaçlarını dinle ve uygun çözümler sun.`,
    en: `Make a sales call. Introduce the product or service. Listen to customer needs and offer suitable solutions.`
  },
  collection: {
    tr: `Borç hatırlatma araması yap. Kibar ol. Ödeme ne zaman yapılacak diye sor.`,
    en: `Make a debt reminder call. Be polite. Ask when the payment will be made.`
  },
  general: {
    tr: `Müşteriye bilgilendirme araması yap. Yüklenen müşteri verilerini kullanarak kişiselleştirilmiş bilgi ver. Bilgi Bankası'ndaki içerikleri referans al.`,
    en: `Make an information call to the customer. Use uploaded customer data for personalized information. Reference Knowledge Base content.`
  }
};

export default function AssistantsPage() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');

  // Get user from localStorage
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  // React Query hooks
  const { data: assistantsData, isLoading: assistantsLoading } = useAssistants();
  const { data: voicesData, isLoading: voicesLoading } = useVoices();
  const { data: businessData } = useBusiness(user.businessId);
  const createAssistant = useCreateAssistant();
  const updateAssistant = useUpdateAssistant();
  const deleteAssistant = useDeleteAssistant();
  const syncAssistant = useSyncAssistant();

  // Extract data from queries
  const assistants = assistantsData?.data?.assistants || [];
  const loading = assistantsLoading || voicesLoading;

  // Process voices data
  const voiceData = voicesData?.data?.voices || {};
  const allVoices = [];
  Object.keys(voiceData).forEach(lang => {
    if (Array.isArray(voiceData[lang])) {
      allVoices.push(...voiceData[lang].map(v => ({ ...v, language: lang })));
    }
  });
  const voices = allVoices;

  // Business info
  const businessLanguage = businessData?.data?.language?.toLowerCase() || locale || 'tr';
  const businessName = businessData?.data?.name || '';
  const businessType = businessData?.data?.businessType || 'OTHER';

  // Modal states
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [selectedCallDirection, setSelectedCallDirection] = useState('inbound');

  const [formData, setFormData] = useState({
    name: '',
    voiceId: '',
    systemPrompt: '',
    firstMessage: '',
    language: businessLanguage || locale || 'tr',
    tone: 'formal',
    customNotes: '',
    callDirection: 'inbound',
    callPurpose: '',
  });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(null);

  // Update first message when assistant name changes
  useEffect(() => {
    if (editingAssistant) return; // Don't update when editing existing assistant

    if (formData.callDirection === 'outbound') {
      // Outbound: "Merhaba! Ben (asistan adı). (şirket adı) adına arıyorum."
      const lang = businessLanguage === 'tr' ? 'tr' : 'en';
      const outboundGreeting = DEFAULT_FIRST_MESSAGES.outbound?.[lang]?.(businessName, formData.name) || '';
      setFormData(prev => ({
        ...prev,
        firstMessage: outboundGreeting,
      }));
    } else if (formData.callDirection === 'inbound') {
      // Inbound: "Merhaba! Ben (asistan adı). Size nasıl yardımcı olabilirim?"
      const lang = businessLanguage === 'tr' ? 'tr' : 'en';
      const inboundGreeting = DEFAULT_FIRST_MESSAGES.inbound?.[lang]?.(businessName, formData.name) || '';
      setFormData(prev => ({
        ...prev,
        firstMessage: inboundGreeting,
      }));
    }
  }, [formData.name, formData.callDirection, editingAssistant, businessName, businessLanguage]);

  // Handle "Yeni Asistan" button click - show type selector first
  const handleNewAssistant = () => {
    setShowTypeSelector(true);
  };

  // Get available call purposes (simplified - same for all business types)
  const getAvailablePurposes = () => {
    return CALL_PURPOSES.common.map(p => ({
      value: p.value,
      labelTr: p.labelTr,
      labelEn: p.labelEn,
    }));
  };

  // Get default first message based on call direction
  const getDefaultFirstMessage = (direction, assistantName) => {
    const lang = businessLanguage === 'tr' ? 'tr' : 'en';
    const type = direction === 'outbound' ? 'outbound' : 'inbound';
    const messageFn = DEFAULT_FIRST_MESSAGES[type]?.[lang];
    return messageFn ? messageFn(businessName, assistantName) : '';
  };

  // Get default system prompt for a call purpose
  const getDefaultSystemPrompt = (purpose) => {
    const lang = businessLanguage === 'tr' ? 'tr' : 'en';
    return DEFAULT_SYSTEM_PROMPTS[purpose]?.[lang] || '';
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
      const defaultPurpose = 'collection';
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: getDefaultSystemPrompt(defaultPurpose),
        firstMessage: getDefaultFirstMessage('outbound', ''),
        language: businessLanguage || 'tr',
        tone: 'formal',
        customNotes: '',
        callDirection: 'outbound',
        callPurpose: defaultPurpose,
      });
      setShowCreateModal(true);
    }
  };

  // Handle call purpose change - update prompts automatically
  const handlePurposeChange = (purpose) => {
    setFormData(prev => ({
      ...prev,
      callPurpose: purpose,
      systemPrompt: getDefaultSystemPrompt(purpose),
      firstMessage: getDefaultFirstMessage('outbound', prev.name),
    }));
  };

  const handleTemplateSelect = (template) => {
    // Get default inbound greeting
    const lang = businessLanguage === 'tr' ? 'tr' : 'en';
    const inboundGreeting = DEFAULT_FIRST_MESSAGES.inbound?.[lang]?.(businessName, template?.name || '') || '';

    if (template) {
      setFormData({
        name: template.name,
        voiceId: '',
        systemPrompt: template.prompt,
        firstMessage: inboundGreeting,
        language: template.language || businessLanguage || 'tr',
        tone: 'formal',
        customNotes: '',
        callDirection: 'inbound',
        callPurpose: '',
      });
    } else {
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: '',
        firstMessage: inboundGreeting,
        language: businessLanguage || 'tr',
        tone: 'formal',
        customNotes: '',
        callDirection: 'inbound',
        callPurpose: '',
      });
    }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.voiceId) {
      toast.error(t('dashboard.assistantsPage.fillAllRequired'));
      return;
    }

    // For outbound, firstMessage is auto-generated so just check if it exists
    if (formData.callDirection === 'outbound' && !formData.firstMessage) {
      toast.error(locale === 'tr' ? 'Lütfen asistan adı girin' : 'Please enter assistant name');
      return;
    }

    setCreating(true);
    try {
      await createAssistant.mutateAsync(formData);
      toast.success(t('dashboard.assistantsPage.createdSuccess'));
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (assistant) => {
    setEditingAssistant(assistant);
    const voice = voices.find(v => v.id === assistant.voiceId);
    const inferredLang = voice?.language || businessLanguage || 'en';

    // For outbound assistants, show a simple default prompt based on callPurpose
    // instead of the full generated system prompt (which is too technical for customers)
    // For inbound, also show empty since full prompt is generated in backend
    // Check for all outbound variants: 'outbound', 'outbound_sales', 'outbound_collection'
    const isOutbound = assistant.callDirection?.startsWith('outbound');
    let displayPrompt = '';

    if (isOutbound && assistant.callPurpose) {
      // Show simple default prompt for editing
      displayPrompt = DEFAULT_SYSTEM_PROMPTS[assistant.callPurpose]?.[inferredLang] || '';
    }
    // For both outbound without callPurpose and inbound, displayPrompt stays empty
    // The full system prompt is generated in backend and should not be shown to customers

    setFormData({
      name: assistant.name,
      voiceId: assistant.voiceId,
      systemPrompt: displayPrompt,
      firstMessage: assistant.firstMessage || '',
      language: assistant.language || inferredLang,
      tone: assistant.tone || 'formal',
      customNotes: assistant.customNotes || '',
      callDirection: assistant.callDirection || 'inbound',
      callPurpose: assistant.callPurpose || '',
    });
    setShowCreateModal(true);
  };

  const handleUpdate = async () => {
    if (!editingAssistant) return;

    setUpdating(true);
    try {
      await updateAssistant.mutateAsync({ id: editingAssistant.id, formData });
      toast.success(t('dashboard.assistantsPage.updatedSuccess'));
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (assistant) => {
    if (!confirm(locale === 'tr' ? 'Bu asistanı silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this assistant?')) {
      return;
    }
    try {
      await deleteAssistant.mutateAsync(assistant.id);
      toast.success(t('dashboard.assistantsPage.deletedSuccess'));
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const handleSync = async (assistant) => {
    setSyncing(assistant.id);
    try {
      const response = await syncAssistant.mutateAsync(assistant.id);
      toast.success(locale === 'tr'
        ? `11Labs senkronize edildi: ${response.data.tools?.join(', ') || 'tools updated'}`
        : `11Labs synced: ${response.data.tools?.join(', ') || 'tools updated'}`
      );
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    } finally {
      setSyncing(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      voiceId: '',
      systemPrompt: '',
      firstMessage: '',
      language: businessLanguage || 'tr',
      tone: 'formal',
      customNotes: '',
      callDirection: 'inbound',
      callPurpose: '',
    });
    setEditingAssistant(null);
    setSelectedCallDirection('inbound');
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
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {locale === 'tr' ? NAVIGATION_ITEMS.assistants.labelTr : NAVIGATION_ITEMS.assistants.labelEn}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {locale === 'tr' ? NAVIGATION_ITEMS.assistants.descriptionTr : NAVIGATION_ITEMS.assistants.descriptionEn}
          </p>
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

      {/* Assistants Table */}
      {loading ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : filteredAssistants.length > 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Asistan Adı' : 'Assistant Name'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Yön' : 'Direction'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Amaç' : 'Purpose'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Ses' : 'Voice'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Dil' : 'Language'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Oluşturulma' : 'Created'}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İşlemler' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filteredAssistants.map((assistant) => {
                const voice = voices.find((v) => v.id === assistant.voiceId);
                const isOutbound = assistant.callDirection?.startsWith('outbound');
                const languageCode = assistant.language || 'tr';
                const accentName = LANGUAGE_TO_ACCENT[languageCode] || languageCode.toUpperCase();

                return (
                  <tr key={assistant.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isOutbound ? (
                          <PhoneOutgoing className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <PhoneIncoming className="h-4 w-4 text-neutral-400" />
                        )}
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">
                          {assistant.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="secondary" className="text-xs">
                        {isOutbound
                          ? (locale === 'tr' ? 'Giden' : 'Outbound')
                          : (locale === 'tr' ? 'Gelen' : 'Inbound')
                        }
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {assistant.callPurpose
                          ? CALL_PURPOSES.definitions[assistant.callPurpose]?.[locale === 'tr' ? 'labelTr' : 'labelEn'] || assistant.callPurpose
                          : '-'
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {voice?.name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {accentName}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(assistant.createdAt, 'short')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('assistants:edit') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(assistant)}
                            className="h-8 px-2"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {can('assistants:edit') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(assistant)}
                            disabled={syncing === assistant.id}
                            title={locale === 'tr' ? '11Labs ile senkronize et' : 'Sync with 11Labs'}
                            className="h-8 px-2"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncing === assistant.id ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        {can('assistants:delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(assistant)}
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              className="flex flex-col items-center p-6 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
            >
              <PhoneIncoming className="h-8 w-8 text-neutral-600 dark:text-neutral-400 mb-4" />
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                {locale === 'tr' ? 'Gelen Arama' : 'Inbound Call'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                {locale === 'tr'
                  ? 'Müşterileriniz sizi aradığında yanıt verir'
                  : 'Answers when customers call you'
                }
              </p>
            </button>

            {/* Outbound Option */}
            <button
              onClick={() => handleTypeSelect('outbound')}
              className="flex flex-col items-center p-6 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
            >
              <PhoneOutgoing className="h-8 w-8 text-neutral-600 dark:text-neutral-400 mb-4" />
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                {locale === 'tr' ? 'Giden Arama' : 'Outbound Call'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
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
                  onValueChange={handlePurposeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={locale === 'tr' ? 'Amaç seçin' : 'Select purpose'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailablePurposes().map((purpose) => (
                      <SelectItem key={purpose.value} value={purpose.value}>
                        {locale === 'tr' ? purpose.labelTr : purpose.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">
                  {locale === 'tr'
                    ? 'Amaç değiştiğinde örnek prompt otomatik güncellenir'
                    : 'Sample prompt updates automatically when purpose changes'
                  }
                </p>
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

            {/* First Message - Greeting */}
            <div>
              <Label htmlFor="firstMessage">
                {locale === 'tr' ? 'Karşılama Mesajı' : 'Greeting Message'}
              </Label>
              {formData.callDirection === 'outbound' ? (
                // Outbound: Read-only, auto-generated
                <>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-sm text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300">
                    {formData.firstMessage || (locale === 'tr' ? 'Asistan adı girilince otomatik oluşturulacak' : 'Will be auto-generated when assistant name is entered')}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {locale === 'tr'
                      ? 'Bu mesaj asistan ve işletme adına göre otomatik oluşturulur.'
                      : 'This message is auto-generated based on assistant and business name.'
                    }
                  </p>
                </>
              ) : (
                // Inbound: Editable
                <>
                  <Textarea
                    id="firstMessage"
                    rows={2}
                    value={formData.firstMessage}
                    onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
                    placeholder={locale === 'tr'
                      ? 'örn: Merhaba, ben Asistan. Size nasıl yardımcı olabilirim?'
                      : 'e.g., Hello, I\'m Assistant. How can I help you?'
                    }
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    {locale === 'tr'
                      ? 'Asistanın aramayı açarken söyleyeceği ilk mesaj.'
                      : 'The first message the assistant says when answering a call.'
                    }
                  </p>
                </>
              )}
            </div>

            {/* System Prompt / Instructions - Only for outbound */}
            {formData.callDirection === 'outbound' && (
              <div>
                <Label htmlFor="prompt">
                  {locale === 'tr' ? 'Talimatlar' : 'Instructions'}
                </Label>
                <Textarea
                  id="prompt"
                  rows={3}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder={locale === 'tr'
                    ? 'örn: Kibar ol, ödeme tarihini sor...'
                    : 'e.g., Be polite, ask for payment date...'}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {locale === 'tr'
                    ? 'Asistanın nasıl davranması gerektiğini kısa ve öz yazın.'
                    : 'Write briefly how the assistant should behave.'}
                </p>
              </div>
            )}

            {/* Custom Notes / Additional Instructions */}
            <div>
              <Label htmlFor="customNotes">
                {formData.callDirection === 'inbound'
                  ? (locale === 'tr' ? 'Ek Talimatlar ve Bilgiler' : 'Additional Instructions & Info')
                  : t('dashboard.assistantsPage.customNotes')
                }
              </Label>
              <Textarea
                id="customNotes"
                rows={4}
                value={formData.customNotes}
                onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
                placeholder={formData.callDirection === 'inbound'
                  ? (locale === 'tr'
                    ? 'örn: Çalışma saatleri 09:00-18:00, Cumartesi kapalı. Randevu için telefon numarası mutlaka alınmalı...'
                    : 'e.g., Working hours 9AM-6PM, closed on Saturday. Phone number must be collected for appointments...')
                  : t('dashboard.assistantsPage.customNotesPlaceholder')
                }
              />
              <p className="text-xs text-neutral-500 mt-1">
                {formData.callDirection === 'inbound'
                  ? (locale === 'tr'
                    ? 'Asistanın bilmesi gereken özel kurallar, çalışma saatleri, adres vb. bilgiler.'
                    : 'Special rules, working hours, address, etc. that the assistant should know.')
                  : (locale === 'tr'
                    ? 'Çalışma saatleri, adres, özel kurallar vb. asistanın bilmesi gereken bilgiler.'
                    : 'Working hours, address, special rules, etc. that the assistant should know.')
                }
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating || updating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={editingAssistant ? handleUpdate : handleCreate} disabled={creating || updating}>
              {(creating || updating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {creating
                ? (locale === 'tr' ? 'Oluşturuluyor...' : 'Creating...')
                : updating
                  ? (locale === 'tr' ? 'Güncelleniyor...' : 'Updating...')
                  : editingAssistant ? t('dashboard.assistantsPage.updateBtn') : t('dashboard.assistantsPage.create')
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

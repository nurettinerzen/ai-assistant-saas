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

export default function AssistantsPage() {
  const { t } = useLanguage();
  const [assistants, setAssistants] = useState([]);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    voiceId: '',
    systemPrompt: '',
    model: 'gpt-4',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assistantsRes, voicesRes] = await Promise.all([
        apiClient.assistants.getAll(),
        apiClient.voices.getAll(),
      ]);
      setAssistants(assistantsRes.data.assistants || []);
      
      // voices object olarak geliyor, düz array'e çevir
      const voiceData = voicesRes.data.voices || {};
      const allVoices = [
        ...(voiceData.turkish || []),
        ...(voiceData.english || [])
      ];
      setVoices(allVoices);
    } catch (error) {
      toast.error(t('dashboard.saveError'));
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
      });
    } else {
      setFormData({
        name: '',
        voiceId: '',
        systemPrompt: '',
        model: 'gpt-4',
      });
    }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.voiceId || !formData.systemPrompt) {
      toast.error(t('dashboard.fillAllRequired'));
      return;
    }

    try {
      await apiClient.assistants.create(formData);
      toast.success(t('dashboard.assistantCreatedSuccess'));
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('dashboard.saveError'));
    }
  };

  const handleEdit = (assistant) => {
    setEditingAssistant(assistant);
    setFormData({
      name: assistant.name,
      voiceId: assistant.voiceId,
      systemPrompt: assistant.systemPrompt,
      model: assistant.model || 'gpt-4',
    });
    setShowCreateModal(true);
  };

  const handleUpdate = async () => {
    if (!editingAssistant) return;

    try {
      await apiClient.assistants.update(editingAssistant.id, formData);
      toast.success(t('dashboard.assistantUpdatedSuccess'));
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('dashboard.saveError'));
    }
  };

  const handleDelete = async (assistant) => {
    try {
      await apiClient.assistants.delete(assistant.id);
      toast.success(t('dashboard.assistantDeletedSuccess'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('dashboard.deleteError'));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', voiceId: '', systemPrompt: '', model: 'gpt-4' });
    setEditingAssistant(null);
  };

  const filteredAssistants = assistants.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.assistantsTitle')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.createManageAssistants')}</p>
        </div>
        <Button onClick={() => setShowTemplateSelector(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.newAssistant')}
        </Button>
      </div>

      {/* Search */}
      {assistants.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('dashboard.searchAssistants')}
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
                  <Badge variant="secondary">{voice?.name || t('dashboard.noVoice')}</Badge>
                  <Badge variant="outline">{assistant.model}</Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(assistant)}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    {t('dashboard.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(assistant)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bot}
          title={t('dashboard.noAssistantsTitle')}
          description={t('dashboard.createFirstAssistantDesc')}
          actionLabel={t('dashboard.createAssistantBtn')}
          onAction={() => setShowTemplateSelector(true)}
        />
      )}

      {/* Template selector modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelect}
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
            <DialogTitle>{editingAssistant ? t('dashboard.editAssistantTitle') : t('dashboard.createAssistantTitle')} {t('dashboard.assistant')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.configureSettings')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('dashboard.nameRequired')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('dashboard.customerSupportBot')}
              />
            </div>

            <div>
              <Label htmlFor="voice">{t('dashboard.voiceRequired')}</Label>
              <Select
                value={formData.voiceId}
                onValueChange={(value) => setFormData({ ...formData, voiceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dashboard.selectVoiceLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model">{t('dashboard.aiModelLabel')}</Label>
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

            <div>
              <Label htmlFor="prompt">{t('dashboard.systemPromptRequired')}</Label>
              <Textarea
                id="prompt"
                rows={6}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder={t('dashboard.systemPromptPlaceholder')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('dashboard.cancel')}
            </Button>
            <Button onClick={editingAssistant ? handleUpdate : handleCreate}>
              {editingAssistant ? t('dashboard.updateAssistantBtn') : t('dashboard.createAssistantBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
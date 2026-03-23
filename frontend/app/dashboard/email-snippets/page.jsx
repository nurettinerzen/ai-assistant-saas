/**
 * Email Snippets Management Page
 * CRUD for quick reply templates used in email composer
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Zap,
  Search,
  Copy,
  ToggleLeft,
  ToggleRight,
  FileText,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import EmptyState from '@/components/EmptyState';

const INTENT_OPTIONS = [
  { value: 'ORDER_STATUS', labelTr: 'Sipariş Durumu', labelEn: 'Order Status' },
  { value: 'RETURN_REQUEST', labelTr: 'İade Talebi', labelEn: 'Return Request' },
  { value: 'COMPLAINT', labelTr: 'Şikayet', labelEn: 'Complaint' },
  { value: 'GENERAL_INQUIRY', labelTr: 'Genel Bilgi', labelEn: 'General Inquiry' },
  { value: 'TECHNICAL_SUPPORT', labelTr: 'Teknik Destek', labelEn: 'Technical Support' },
  { value: 'BILLING', labelTr: 'Fatura/Ödeme', labelEn: 'Billing' },
  { value: 'CANCELLATION', labelTr: 'İptal', labelEn: 'Cancellation' },
  { value: 'GREETING', labelTr: 'Selamlama', labelEn: 'Greeting' },
  { value: 'CLOSING', labelTr: 'Kapanış', labelEn: 'Closing' },
  { value: 'OTHER', labelTr: 'Diğer', labelEn: 'Other' },
];

const TONE_OPTIONS = [
  { value: 'professional', labelTr: 'Profesyonel', labelEn: 'Professional' },
  { value: 'friendly', labelTr: 'Samimi', labelEn: 'Friendly' },
  { value: 'formal', labelTr: 'Resmi', labelEn: 'Formal' },
  { value: 'empathetic', labelTr: 'Empatik', labelEn: 'Empathetic' },
];

export default function EmailSnippetsPage() {
  const { t, locale } = useLanguage();
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    intent: 'GENERAL_INQUIRY',
    language: 'TR',
    tone: 'professional',
    subject: '',
    body: '',
  });

  const fetchSnippets = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/email-snippets');
      setSnippets(res.data?.snippets || []);
    } catch (err) {
      toast.error(locale === 'tr' ? 'Yanıtlar yüklenemedi' : 'Failed to load snippets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSnippets(); }, []);

  const resetForm = () => {
    setForm({ name: '', intent: 'GENERAL_INQUIRY', language: 'TR', tone: 'professional', subject: '', body: '' });
    setEditingSnippet(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (snippet) => {
    setEditingSnippet(snippet);
    setForm({
      name: snippet.name || '',
      intent: snippet.intent || 'GENERAL_INQUIRY',
      language: snippet.language || 'TR',
      tone: snippet.tone || 'professional',
      subject: snippet.subject || '',
      body: snippet.body || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error(locale === 'tr' ? 'Ad ve içerik zorunlu' : 'Name and body are required');
      return;
    }
    setSaving(true);
    try {
      if (editingSnippet) {
        await apiClient.put(`/api/email-snippets/${editingSnippet.id}`, form);
        toast.success(locale === 'tr' ? 'Yanıt güncellendi' : 'Snippet updated');
      } else {
        await apiClient.post('/api/email-snippets', form);
        toast.success(locale === 'tr' ? 'Yanıt oluşturuldu' : 'Snippet created');
      }
      setDialogOpen(false);
      resetForm();
      fetchSnippets();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/api/email-snippets/${id}`);
      toast.success(locale === 'tr' ? 'Yanıt silindi' : 'Snippet deleted');
      setDeleteConfirm(null);
      fetchSnippets();
    } catch (err) {
      toast.error(locale === 'tr' ? 'Silinemedi' : 'Delete failed');
    }
  };

  const handleToggle = async (snippet) => {
    try {
      await apiClient.put(`/api/email-snippets/${snippet.id}`, { enabled: !snippet.enabled });
      fetchSnippets();
    } catch (err) {
      toast.error(locale === 'tr' ? 'Güncellenemedi' : 'Update failed');
    }
  };

  const handleCopy = (body) => {
    navigator.clipboard.writeText(body);
    toast.success(locale === 'tr' ? 'Kopyalandı' : 'Copied');
  };

  const filtered = snippets.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.body?.toLowerCase().includes(q) || s.intent?.toLowerCase().includes(q);
  });

  const getIntentLabel = (intent) => {
    const opt = INTENT_OPTIONS.find(o => o.value === intent);
    return opt ? (locale === 'tr' ? opt.labelTr : opt.labelEn) : intent;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            {locale === 'tr' ? 'Hazır Yanıtlar' : 'Quick Replies'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {locale === 'tr'
              ? 'E-posta yanıtlarında kullanılacak hazır şablonları yönetin'
              : 'Manage quick reply templates for email responses'}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {locale === 'tr' ? 'Yeni Yanıt' : 'New Snippet'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={locale === 'tr' ? 'Yanıt ara...' : 'Search snippets...'}
          className="pl-10"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={locale === 'tr' ? 'Henüz hazır yanıt yok' : 'No snippets yet'}
          description={locale === 'tr'
            ? 'E-posta yanıtlarınızı hızlandırmak için şablon oluşturun'
            : 'Create templates to speed up your email replies'}
          actionLabel={locale === 'tr' ? 'İlk Yanıtı Oluştur' : 'Create First Snippet'}
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map(snippet => (
            <div
              key={snippet.id}
              className={`rounded-lg border p-4 transition-all ${
                snippet.enabled !== false
                  ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50'
                  : 'border-neutral-200/50 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{snippet.name}</h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">{getIntentLabel(snippet.intent)}</Badge>
                    {snippet.tone && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {TONE_OPTIONS.find(t => t.value === snippet.tone)?.[locale === 'tr' ? 'labelTr' : 'labelEn'] || snippet.tone}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] shrink-0">{snippet.language || 'TR'}</Badge>
                  </div>
                  {snippet.subject && (
                    <p className="text-xs text-neutral-500 mb-1">
                      <span className="font-medium">{locale === 'tr' ? 'Konu:' : 'Subject:'}</span> {snippet.subject}
                    </p>
                  )}
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 whitespace-pre-wrap">
                    {snippet.body}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(snippet.body)} title={locale === 'tr' ? 'Kopyala' : 'Copy'}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(snippet)} title={snippet.enabled !== false ? (locale === 'tr' ? 'Devre Dışı Bırak' : 'Disable') : (locale === 'tr' ? 'Etkinleştir' : 'Enable')}>
                    {snippet.enabled !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-neutral-400" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(snippet)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {deleteConfirm === snippet.id ? (
                    <div className="flex gap-1">
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={() => handleDelete(snippet.id)}>
                        {locale === 'tr' ? 'Sil' : 'Delete'}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setDeleteConfirm(null)}>
                        {locale === 'tr' ? 'İptal' : 'Cancel'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setDeleteConfirm(snippet.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSnippet
                ? (locale === 'tr' ? 'Yanıtı Düzenle' : 'Edit Snippet')
                : (locale === 'tr' ? 'Yeni Yanıt' : 'New Snippet')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>{locale === 'tr' ? 'Ad' : 'Name'}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={locale === 'tr' ? 'örn. Sipariş Durumu Yanıtı' : 'e.g. Order Status Reply'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{locale === 'tr' ? 'Kategori' : 'Category'}</Label>
                <select
                  value={form.intent}
                  onChange={(e) => setForm(f => ({ ...f, intent: e.target.value }))}
                  className="w-full h-9 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm px-3"
                >
                  {INTENT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{locale === 'tr' ? o.labelTr : o.labelEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{locale === 'tr' ? 'Ton' : 'Tone'}</Label>
                <select
                  value={form.tone}
                  onChange={(e) => setForm(f => ({ ...f, tone: e.target.value }))}
                  className="w-full h-9 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm px-3"
                >
                  {TONE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{locale === 'tr' ? o.labelTr : o.labelEn}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Konu (opsiyonel)' : 'Subject (optional)'}</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder={locale === 'tr' ? 'E-posta konu satırı' : 'Email subject line'}
              />
            </div>

            <div>
              <Label>{locale === 'tr' ? 'İçerik' : 'Body'}</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder={locale === 'tr'
                  ? 'Sayın {müşteri_adı},\n\nSiparişinizin durumu: {sipariş_durumu}\n\nSaygılarımızla'
                  : 'Dear {customer_name},\n\nYour order status: {order_status}\n\nBest regards'}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                {locale === 'tr'
                  ? 'Değişken kullanmak için {değişken_adı} yazın'
                  : 'Use {variable_name} for dynamic values'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                {locale === 'tr' ? 'İptal' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {editingSnippet
                  ? (locale === 'tr' ? 'Güncelle' : 'Update')
                  : (locale === 'tr' ? 'Oluştur' : 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

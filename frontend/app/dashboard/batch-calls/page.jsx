'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Megaphone,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Pause,
  ArrowUpCircle,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';

const STATUS_CONFIG = {
  PENDING: {
    label: { tr: 'Bekliyor', en: 'Pending' },
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock
  },
  IN_PROGRESS: {
    label: { tr: 'Devam Ediyor', en: 'In Progress' },
    color: 'bg-blue-100 text-blue-800',
    icon: Loader2
  },
  COMPLETED: {
    label: { tr: 'Tamamlandı', en: 'Completed' },
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2
  },
  FAILED: {
    label: { tr: 'Başarısız', en: 'Failed' },
    color: 'bg-red-100 text-red-800',
    icon: XCircle
  },
  CANCELLED: {
    label: { tr: 'İptal Edildi', en: 'Cancelled' },
    color: 'bg-neutral-100 text-neutral-800',
    icon: Pause
  }
};

// Dynamic variable labels (simplified - only essential fields)
const VARIABLE_LABELS = {
  debt_amount: { tr: 'Borç Tutarı', en: 'Debt Amount' },
  currency: { tr: 'Para Birimi', en: 'Currency' },
  due_date: { tr: 'Vade Tarihi', en: 'Due Date' },
  appointment_date: { tr: 'Randevu Tarihi', en: 'Appointment Date' }
};

export default function BatchCallsPage() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();
  const [batchCalls, setBatchCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Basic, 2: Upload, 3: Mapping, 4: Schedule, 5: Preview

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    assistantId: '',
    phoneNumberId: '',
    scheduledAt: null,
    startImmediately: true
  });

  // File data
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState({ columns: [], preview: [], totalRows: 0 });
  const [columnMapping, setColumnMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Options
  const [assistants, setAssistants] = useState([]);
  const [phoneNumbers, setPhoneNumbers] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh when there are in-progress campaigns
  useEffect(() => {
    const hasInProgress = batchCalls.some(b => b.status === 'IN_PROGRESS' || b.status === 'PENDING');
    console.log('📊 Polling check - hasInProgress:', hasInProgress, 'hasAccess:', hasAccess);
    if (hasInProgress) {
      const interval = setInterval(() => {
        console.log('🔄 Polling batch calls...');
        refreshBatchCalls();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [batchCalls, hasAccess]);

  const refreshBatchCalls = async () => {
    try {
      const batchRes = await apiClient.get('/api/batch-calls');
      console.log('📊 Batch calls refreshed:', batchRes.data.batchCalls?.map(b => ({ id: b.id, status: b.status })));
      setBatchCalls(batchRes.data.batchCalls || []);
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Check access first
      try {
        const accessRes = await apiClient.get('/api/batch-calls/check-access');
        setHasAccess(accessRes.data.hasAccess);
      } catch (err) {
        if (err.response?.data?.upgrade) {
          setHasAccess(false);
        }
      }

      // Load batch calls
      try {
        const batchRes = await apiClient.get('/api/batch-calls');
        setBatchCalls(batchRes.data.batchCalls || []);
      } catch (err) {
        if (err.response?.data?.upgrade) {
          setHasAccess(false);
        } else {
          console.error('Failed to load batch calls:', err);
        }
      }

      // Load assistants (only outbound)
      const assistantsRes = await apiClient.assistants.getAll();
      const outboundAssistants = (assistantsRes.data.assistants || []).filter(
        a => a.callDirection === 'outbound'
      );
      setAssistants(outboundAssistants);

      // Load phone numbers
      const phonesRes = await apiClient.phoneNumbers.getAll();
      setPhoneNumbers(phonesRes.data.phoneNumbers || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error(locale === 'tr' ? 'Sadece CSV ve Excel dosyaları yüklenebilir' : 'Only CSV and Excel files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(locale === 'tr' ? 'Dosya boyutu 5MB\'dan büyük olamaz' : 'File size cannot exceed 5MB');
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await apiClient.post('/api/batch-calls/parse', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFileData({
        columns: response.data.columns,
        preview: response.data.preview,
        totalRows: response.data.totalRows
      });

      // Auto-detect phone column
      const phoneColumn = response.data.columns.find(col =>
        col.toLowerCase().includes('phone') ||
        col.toLowerCase().includes('telefon') ||
        col.toLowerCase().includes('tel') ||
        col.toLowerCase().includes('gsm')
      );

      if (phoneColumn) {
        setColumnMapping(prev => ({ ...prev, phone: phoneColumn }));
      }

      // Auto-detect name column
      const nameColumn = response.data.columns.find(col =>
        col.toLowerCase().includes('name') ||
        col.toLowerCase().includes('ad') ||
        col.toLowerCase().includes('isim') ||
        col.toLowerCase().includes('müşteri')
      );

      if (nameColumn) {
        setColumnMapping(prev => ({ ...prev, customer_name: nameColumn }));
      }

      setCreateStep(3);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error.response?.data?.error || (locale === 'tr' ? 'Dosya okunamadı' : 'Failed to parse file'));
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.assistantId || !formData.phoneNumberId) {
      toast.error(locale === 'tr' ? 'Lütfen tüm zorunlu alanları doldurun' : 'Please fill all required fields');
      return;
    }

    if (!selectedFile) {
      toast.error(locale === 'tr' ? 'Lütfen bir dosya yükleyin' : 'Please upload a file');
      return;
    }

    if (!columnMapping.phone) {
      toast.error(locale === 'tr' ? 'Lütfen telefon numarası kolonunu seçin' : 'Please select the phone number column');
      return;
    }

    setSubmitting(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append('file', selectedFile);
      submitFormData.append('name', formData.name);
      submitFormData.append('assistantId', formData.assistantId);
      submitFormData.append('phoneNumberId', formData.phoneNumberId);
      submitFormData.append('columnMapping', JSON.stringify(columnMapping));

      if (!formData.startImmediately && formData.scheduledAt) {
        submitFormData.append('scheduledAt', formData.scheduledAt);
      }

      const response = await apiClient.post('/api/batch-calls', submitFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(locale === 'tr'
        ? `Kampanya başarıyla oluşturuldu (${response.data.batchCall.totalRecipients} kişi)`
        : `Campaign created successfully (${response.data.batchCall.totalRecipients} recipients)`
      );

      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errorTR || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (batchCallId) => {
    if (!confirm(locale === 'tr' ? 'Bu kampanyayı iptal etmek istediğinize emin misiniz?' : 'Are you sure you want to cancel this campaign?')) {
      return;
    }

    try {
      await apiClient.post(`/api/batch-calls/${batchCallId}/cancel`);
      toast.success(locale === 'tr' ? 'Kampanya iptal edildi' : 'Campaign cancelled');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      assistantId: '',
      phoneNumberId: '',
      scheduledAt: null,
      startImmediately: true
    });
    setSelectedFile(null);
    setFileData({ columns: [], preview: [], totalRows: 0 });
    setColumnMapping({});
    setCreateStep(1);
  };

  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get('/api/batch-calls/template', {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'toplu-arama-sablon.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Template download error:', error);
      toast.error(locale === 'tr' ? 'Şablon indirilemedi' : 'Failed to download template');
    }
  };

  // Render upgrade message for non-PRO users
  if (!hasAccess && !loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="p-4 bg-primary-100 dark:bg-primary-900 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <ArrowUpCircle className="h-10 w-10 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            {locale === 'tr' ? 'Planınızı Yükseltin' : 'Upgrade Your Plan'}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {locale === 'tr'
              ? 'Toplu arama özelliği Profesyonel ve Kurumsal planlarda kullanılabilir. Planınızı yükselterek bu özelliğe erişebilirsiniz.'
              : 'Batch calling is available on Professional and Enterprise plans. Upgrade your plan to access this feature.'
            }
          </p>
          <Link href="/dashboard/subscription">
            <Button size="lg">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              {locale === 'tr' ? 'Planı Yükselt' : 'Upgrade Plan'}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {locale === 'tr' ? 'Toplu Arama' : 'Batch Calls'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {locale === 'tr'
              ? 'Excel veya CSV dosyası yükleyerek toplu arama kampanyaları oluşturun'
              : 'Create batch calling campaigns by uploading Excel or CSV files'
            }
          </p>
        </div>
        {can('campaigns:view') && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {locale === 'tr' ? 'Yeni Kampanya' : 'New Campaign'}
          </Button>
        )}
      </div>

      {/* Batch Calls List */}
      {loading ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : batchCalls.length > 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Kampanya' : 'Campaign'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Asistan' : 'Assistant'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Durum' : 'Status'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İlerleme' : 'Progress'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Tarih' : 'Date'}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İşlemler' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {batchCalls.map((batch) => {
                const statusConfig = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = statusConfig.icon;
                const progress = batch.totalRecipients > 0
                  ? Math.round((batch.completedCalls / batch.totalRecipients) * 100)
                  : 0;

                return (
                  <tr key={batch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg mr-3">
                          <Megaphone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">{batch.name}</div>
                          <div className="text-xs text-neutral-500">
                            {batch.totalRecipients} {locale === 'tr' ? 'kişi' : 'recipients'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-900 dark:text-white">{batch.assistant?.name || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                        <StatusIcon className={`h-3 w-3 ${batch.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
                        {statusConfig.label[locale]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">
                          {batch.completedCalls}/{batch.totalRecipients}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(batch.createdAt, 'short')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/batch-calls/${batch.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3 mr-1" />
                            {locale === 'tr' ? 'Detay' : 'Details'}
                          </Button>
                        </Link>
                        {(batch.status === 'PENDING' || batch.status === 'IN_PROGRESS') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(batch.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            {locale === 'tr' ? 'İptal' : 'Cancel'}
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
          icon={Megaphone}
          title={locale === 'tr' ? 'Henüz kampanya yok' : 'No campaigns yet'}
          description={locale === 'tr'
            ? 'Excel veya CSV dosyası yükleyerek ilk toplu arama kampanyanızı oluşturun.'
            : 'Create your first batch calling campaign by uploading an Excel or CSV file.'
          }
          actionLabel={locale === 'tr' ? 'Yeni Kampanya' : 'New Campaign'}
          onAction={() => setShowCreateModal(true)}
        />
      )}

      {/* Create Campaign Modal */}
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
              <Megaphone className="h-5 w-5 text-primary-600" />
              {locale === 'tr' ? 'Yeni Kampanya Oluştur' : 'Create New Campaign'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'tr'
                ? `Adım ${createStep}/5 - ${
                    createStep === 1 ? 'Temel Bilgiler' :
                    createStep === 2 ? 'Dosya Yükleme' :
                    createStep === 3 ? 'Kolon Eşleştirme' :
                    createStep === 4 ? 'Zamanlama' :
                    'Önizleme'
                  }`
                : `Step ${createStep}/5 - ${
                    createStep === 1 ? 'Basic Info' :
                    createStep === 2 ? 'File Upload' :
                    createStep === 3 ? 'Column Mapping' :
                    createStep === 4 ? 'Scheduling' :
                    'Preview'
                  }`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Basic Info */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>{locale === 'tr' ? 'Kampanya Adı *' : 'Campaign Name *'}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={locale === 'tr' ? 'örn: Ocak Tahsilat' : 'e.g., January Collection'}
                  />
                </div>

                <div>
                  <Label>{locale === 'tr' ? 'Telefon Numarası *' : 'Phone Number *'}</Label>
                  <Select
                    value={formData.phoneNumberId}
                    onValueChange={(value) => setFormData({ ...formData, phoneNumberId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={locale === 'tr' ? 'Numara seçin' : 'Select number'} />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((phone) => (
                        <SelectItem key={phone.id} value={phone.id}>
                          {phone.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {phoneNumbers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {locale === 'tr' ? 'Henüz telefon numaranız yok.' : 'No phone numbers found.'}
                    </p>
                  )}
                </div>

                <div>
                  <Label>{locale === 'tr' ? 'Asistan *' : 'Assistant *'}</Label>
                  <Select
                    value={formData.assistantId}
                    onValueChange={(value) => setFormData({ ...formData, assistantId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={locale === 'tr' ? 'Giden arama asistanı seçin' : 'Select outbound assistant'} />
                    </SelectTrigger>
                    <SelectContent>
                      {assistants.map((assistant) => (
                        <SelectItem key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assistants.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {locale === 'tr'
                        ? 'Önce "Giden Arama" tipinde bir asistan oluşturmalısınız.'
                        : 'You need to create an "Outbound" type assistant first.'
                      }
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: File Upload */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    {locale === 'tr' ? 'Örnek Şablon İndir' : 'Download Template'}
                  </Button>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                    ${selectedFile ? 'border-primary-300 bg-primary-50' : 'border-neutral-300 hover:border-primary-400'}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-12 w-12 text-primary-600 animate-spin mb-3" />
                      <p className="text-neutral-600">
                        {locale === 'tr' ? 'Dosya okunuyor...' : 'Reading file...'}
                      </p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="h-12 w-12 text-primary-600 mb-3" />
                      <p className="font-medium text-neutral-900">{selectedFile.name}</p>
                      <p className="text-sm text-neutral-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-neutral-400 mb-3" />
                      <p className="font-medium text-neutral-700 mb-1">
                        {locale === 'tr' ? 'Dosya yüklemek için tıklayın' : 'Click to upload file'}
                      </p>
                      <p className="text-sm text-neutral-500">
                        CSV, XLS, XLSX (max 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Column Mapping */}
            {createStep === 3 && (
              <div className="space-y-4">
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {locale === 'tr'
                      ? `Dosyada ${fileData.totalRows} satır bulundu. Kolonları eşleştirin:`
                      : `Found ${fileData.totalRows} rows in file. Map the columns:`
                    }
                  </p>
                </div>

                <div className="grid gap-4">
                  {/* Phone column (required) */}
                  <div>
                    <Label className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {locale === 'tr' ? 'Telefon Numarası Kolonu *' : 'Phone Number Column *'}
                    </Label>
                    <Select
                      value={columnMapping.phone || ''}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, phone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={locale === 'tr' ? 'Kolon seçin' : 'Select column'} />
                      </SelectTrigger>
                      <SelectContent>
                        {fileData.columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Other dynamic variable columns */}
                  {Object.entries(VARIABLE_LABELS).map(([key, labels]) => (
                    <div key={key}>
                      <Label>{labels[locale]}</Label>
                      <Select
                        value={columnMapping[key] || ''}
                        onValueChange={(value) => setColumnMapping({
                          ...columnMapping,
                          [key]: value === '_none_' ? undefined : value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={locale === 'tr' ? 'Opsiyonel' : 'Optional'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_">{locale === 'tr' ? '-- Seçme --' : '-- None --'}</SelectItem>
                          {fileData.columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                {fileData.preview.length > 0 && (
                  <div className="mt-4">
                    <Label className="mb-2 block">{locale === 'tr' ? 'Önizleme (ilk 5 satır)' : 'Preview (first 5 rows)'}</Label>
                    <div className="overflow-x-auto border dark:border-neutral-700 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50 dark:bg-neutral-800">
                          <tr>
                            {fileData.columns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {fileData.preview.map((row, idx) => (
                            <tr key={idx} className="border-t dark:border-neutral-700">
                              {fileData.columns.map((col) => (
                                <td key={col} className="px-3 py-2 text-neutral-900 dark:text-white">
                                  {String(row[col] || '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Scheduling */}
            {createStep === 4 && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, startImmediately: true })}
                    className={`flex-1 p-4 border-2 rounded-xl text-left transition-colors ${
                      formData.startImmediately ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="h-5 w-5 text-primary-600" />
                      <span className="font-medium">
                        {locale === 'tr' ? 'Hemen Başlat' : 'Start Immediately'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500">
                      {locale === 'tr'
                        ? 'Aramalar hemen başlayacak'
                        : 'Calls will start immediately'
                      }
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, startImmediately: false })}
                    className={`flex-1 p-4 border-2 rounded-xl text-left transition-colors ${
                      !formData.startImmediately ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-5 w-5 text-primary-600" />
                      <span className="font-medium">
                        {locale === 'tr' ? 'İleri Tarihte' : 'Schedule for Later'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500">
                      {locale === 'tr'
                        ? 'Belirli bir tarih ve saat seçin'
                        : 'Choose a specific date and time'
                      }
                    </p>
                  </button>
                </div>

                {!formData.startImmediately && (
                  <div>
                    <Label>{locale === 'tr' ? 'Başlangıç Zamanı' : 'Start Time'}</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledAt || ''}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Preview/Confirm */}
            {createStep === 5 && (
              <div className="space-y-4">
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">{locale === 'tr' ? 'Kampanya Adı' : 'Campaign Name'}</span>
                    <span className="font-medium dark:text-white">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">{locale === 'tr' ? 'Asistan' : 'Assistant'}</span>
                    <span className="font-medium dark:text-white">
                      {assistants.find(a => a.id === formData.assistantId)?.name || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">{locale === 'tr' ? 'Telefon' : 'Phone'}</span>
                    <span className="font-medium dark:text-white">
                      {phoneNumbers.find(p => p.id === formData.phoneNumberId)?.phoneNumber || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">{locale === 'tr' ? 'Toplam Alıcı' : 'Total Recipients'}</span>
                    <span className="font-medium text-primary-600 dark:text-primary-400">{fileData.totalRows}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">{locale === 'tr' ? 'Zamanlama' : 'Scheduling'}</span>
                    <span className="font-medium dark:text-white">
                      {formData.startImmediately
                        ? (locale === 'tr' ? 'Hemen başlat' : 'Start immediately')
                        : formatDate(formData.scheduledAt, 'long')
                      }
                    </span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {locale === 'tr'
                        ? `${fileData.totalRows} kişiye otomatik arama yapılacaktır. Bu işlem geri alınamaz.`
                        : `${fileData.totalRows} recipients will be called automatically. This action cannot be undone.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (createStep === 1) {
                  setShowCreateModal(false);
                  resetForm();
                } else {
                  setCreateStep(createStep - 1);
                }
              }}
            >
              {createStep === 1
                ? t('common.cancel')
                : (locale === 'tr' ? 'Geri' : 'Back')
              }
            </Button>

            {createStep < 5 ? (
              <Button
                onClick={() => {
                  if (createStep === 1) {
                    if (!formData.name || !formData.assistantId || !formData.phoneNumberId) {
                      toast.error(locale === 'tr' ? 'Tüm alanları doldurun' : 'Fill all fields');
                      return;
                    }
                    setCreateStep(2);
                  } else if (createStep === 2) {
                    if (!selectedFile) {
                      toast.error(locale === 'tr' ? 'Dosya yükleyin' : 'Upload a file');
                      return;
                    }
                    // File already processed, move to step 3
                  } else if (createStep === 3) {
                    if (!columnMapping.phone) {
                      toast.error(locale === 'tr' ? 'Telefon kolonunu seçin' : 'Select phone column');
                      return;
                    }
                    setCreateStep(4);
                  } else if (createStep === 4) {
                    if (!formData.startImmediately && !formData.scheduledAt) {
                      toast.error(locale === 'tr' ? 'Tarih seçin' : 'Select a date');
                      return;
                    }
                    setCreateStep(5);
                  }
                }}
                disabled={uploading}
              >
                {locale === 'tr' ? 'Devam' : 'Continue'}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {locale === 'tr' ? 'Oluşturuluyor...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Megaphone className="h-4 w-4 mr-2" />
                    {locale === 'tr' ? 'Kampanyayı Başlat' : 'Start Campaign'}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

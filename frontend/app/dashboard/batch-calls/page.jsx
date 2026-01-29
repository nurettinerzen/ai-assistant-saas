'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AlertCircle,
  X,
  Search,
  Filter
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import { NAVIGATION_ITEMS } from '@/lib/navigationConfig';
import { useBatchCalls, useBatchCallsAccess } from '@/hooks/useBatchCalls';
import { useAssistants } from '@/hooks/useAssistants';
import { usePhoneNumbers } from '@/hooks/usePhoneNumbers';

const STATUS_CONFIG = {
  PENDING: {
    label: { tr: 'Bekliyor', en: 'Pending' },
    color: 'text-neutral-700 dark:text-neutral-400',
    icon: Clock
  },
  IN_PROGRESS: {
    label: { tr: 'Devam Ediyor', en: 'In Progress' },
    color: 'text-neutral-700 dark:text-neutral-400',
    icon: Loader2
  },
  COMPLETED: {
    label: { tr: 'Tamamlandı', en: 'Completed' },
    color: 'text-neutral-700 dark:text-neutral-400',
    icon: CheckCircle2
  },
  FAILED: {
    label: { tr: 'Başarısız', en: 'Failed' },
    color: 'text-neutral-700 dark:text-neutral-400',
    icon: XCircle
  },
  CANCELLED: {
    label: { tr: 'İptal Edildi', en: 'Cancelled' },
    color: 'text-neutral-700 dark:text-neutral-400',
    icon: Pause
  }
};

// Call purpose options - simplified to 3 main purposes
const CALL_PURPOSE_OPTIONS = {
  sales: { tr: 'Satış', en: 'Sales' },
  collection: { tr: 'Tahsilat', en: 'Collection' },
  general: { tr: 'Genel Bilgilendirme', en: 'General Information' }
};

// Template variable labels based on purpose
const TEMPLATE_VARIABLES = {
  collection: {
    debt_amount: { tr: 'Borç Tutarı', en: 'Debt Amount' },
    currency: { tr: 'Para Birimi', en: 'Currency' },
    due_date: { tr: 'Vade Tarihi', en: 'Due Date' }
  },
  sales: {
    product_name: { tr: 'Ürün/Hizmet Adı', en: 'Product/Service Name' },
    product_price: { tr: 'Fiyat', en: 'Price' },
    campaign_name: { tr: 'Kampanya Adı', en: 'Campaign Name' }
  },
  general: {
    info_type: { tr: 'Bilgi Türü', en: 'Info Type' },
    custom_data: { tr: 'Özel Veri', en: 'Custom Data' }
  }
};

export default function BatchCallsPage() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();

  // React Query hooks
  const { data: batchCalls = [], isLoading: batchCallsLoading, refetch: refetchBatchCalls } = useBatchCalls();
  const { data: accessData, isLoading: accessLoading } = useBatchCallsAccess();
  const { data: assistantsData, isLoading: assistantsLoading } = useAssistants();
  const { data: phoneNumbers = [], isLoading: phoneNumbersLoading } = usePhoneNumbers();

  const loading = batchCallsLoading || accessLoading || assistantsLoading || phoneNumbersLoading;
  const hasAccess = accessData?.hasAccess ?? true;
  const assistants = (assistantsData?.data?.assistants || []).filter(
    a => a.callDirection?.startsWith('outbound')
  );

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assistantFilter, setAssistantFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    assistantId: '',
    phoneNumberId: '',
    callPurpose: '',
    scheduledAt: null,
    startImmediately: true
  });

  // File data
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState({ columns: [], preview: [], totalRows: 0 });
  const [columnMapping, setColumnMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // Filter batch calls based on search and filters
  const filteredBatchCalls = useMemo(() => {
    let filtered = [...batchCalls];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(call =>
        call.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => call.status === statusFilter);
    }

    // Assistant filter
    if (assistantFilter !== 'all') {
      filtered = filtered.filter(call => call.assistantId === assistantFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(call => {
        const callDate = new Date(call.createdAt);
        const daysDiff = Math.floor((now - callDate) / (1000 * 60 * 60 * 24));

        switch (dateFilter) {
          case 'today':
            return callDate >= today;
          case 'week':
            return daysDiff <= 7;
          case 'month':
            return daysDiff <= 30;
          case 'quarter':
            return daysDiff <= 90;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [batchCalls, searchQuery, statusFilter, assistantFilter, dateFilter]);

  // Auto-refresh when there are in-progress campaigns
  useEffect(() => {
    const hasInProgress = batchCalls.some(b => b.status === 'IN_PROGRESS' || b.status === 'PENDING');
    if (hasInProgress) {
      const interval = setInterval(() => {
        refetchBatchCalls();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [batchCalls, refetchBatchCalls]);

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

    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error.response?.data?.error || (locale === 'tr' ? 'Dosya okunamadı' : 'Failed to parse file'));
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.assistantId || !formData.phoneNumberId || !formData.callPurpose) {
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
      submitFormData.append('callPurpose', formData.callPurpose);

      // Set dataType based on purpose for backend processing
      const dataType = (formData.callPurpose === 'collection' || formData.callPurpose === 'sales')
        ? formData.callPurpose
        : 'custom';
      submitFormData.append('dataType', dataType);

      if (!formData.startImmediately && formData.scheduledAt) {
        submitFormData.append('scheduledAt', formData.scheduledAt);
      }

      const response = await apiClient.post('/api/batch-calls', submitFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(locale === 'tr'
        ? `Arama başarıyla oluşturuldu (${response.data.batchCall.totalRecipients} kişi)`
        : `Call created successfully (${response.data.batchCall.totalRecipients} recipients)`
      );

      setShowCreateModal(false);
      resetForm();
      refetchBatchCalls();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errorTR || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (batchCallId) => {
    if (!confirm(locale === 'tr' ? 'Bu aramayı iptal etmek istediğinize emin misiniz?' : 'Are you sure you want to cancel this call?')) {
      return;
    }

    try {
      await apiClient.post(`/api/batch-calls/${batchCallId}/cancel`);
      toast.success(locale === 'tr' ? 'Arama iptal edildi' : 'Call cancelled');
      refetchBatchCalls();
    } catch (error) {
      toast.error(error.response?.data?.error || t('errors.generic'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      assistantId: '',
      phoneNumberId: '',
      callPurpose: '',
      scheduledAt: null,
      startImmediately: true
    });
    setSelectedFile(null);
    setFileData({ columns: [], preview: [], totalRows: 0 });
    setColumnMapping({});
    setCreateStep(1);
  };

  const downloadTemplate = async (type = 'collection') => {
    try {
      const response = await apiClient.get(`/api/batch-calls/template?type=${type}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', type === 'sales' ? 'satis-sablon.xlsx' : 'tahsilat-sablon.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Template download error:', error);
      toast.error(locale === 'tr' ? 'Şablon indirilemedi' : 'Failed to download template');
    }
  };

  // Check if current purpose has template
  const hasTemplate = formData.callPurpose === 'collection' || formData.callPurpose === 'sales';

  // Get template variables for current purpose
  const getTemplateVariables = () => {
    return TEMPLATE_VARIABLES[formData.callPurpose] || {};
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
              ? 'Toplu arama özelliği Profesyonel ve Kurumsal planlarda kullanılabilir.'
              : 'Batch calling is available on Professional and Enterprise plans.'
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
            {locale === 'tr' ? NAVIGATION_ITEMS.campaigns.labelTr : NAVIGATION_ITEMS.campaigns.labelEn}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {locale === 'tr'
              ? NAVIGATION_ITEMS.campaigns.descriptionTr
              : 'Manage your batch outbound call campaigns'
            }
          </p>
        </div>
        {can('campaigns:view') && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {locale === 'tr' ? 'Yeni Arama Oluştur' : 'Create New Call'}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder={locale === 'tr' ? 'Kampanya adı ara...' : 'Search campaign name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={locale === 'tr' ? 'Durum' : 'Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</SelectItem>
              <SelectItem value="PENDING">{STATUS_CONFIG.PENDING.label[locale]}</SelectItem>
              <SelectItem value="IN_PROGRESS">{STATUS_CONFIG.IN_PROGRESS.label[locale]}</SelectItem>
              <SelectItem value="COMPLETED">{STATUS_CONFIG.COMPLETED.label[locale]}</SelectItem>
              <SelectItem value="FAILED">{STATUS_CONFIG.FAILED.label[locale]}</SelectItem>
              <SelectItem value="CANCELLED">{STATUS_CONFIG.CANCELLED.label[locale]}</SelectItem>
            </SelectContent>
          </Select>

          {/* Assistant Filter */}
          <Select value={assistantFilter} onValueChange={setAssistantFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={locale === 'tr' ? 'Asistan' : 'Assistant'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'tr' ? 'Tüm Asistanlar' : 'All Assistants'}</SelectItem>
              {assistants.map((assistant) => (
                <SelectItem key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={locale === 'tr' ? 'Tarih' : 'Date'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'tr' ? 'Tüm Zamanlar' : 'All Time'}</SelectItem>
              <SelectItem value="today">{locale === 'tr' ? 'Bugün' : 'Today'}</SelectItem>
              <SelectItem value="week">{locale === 'tr' ? 'Son 7 Gün' : 'Last 7 Days'}</SelectItem>
              <SelectItem value="month">{locale === 'tr' ? 'Son 30 Gün' : 'Last 30 Days'}</SelectItem>
              <SelectItem value="quarter">{locale === 'tr' ? 'Son 90 Gün' : 'Last 90 Days'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Call History Table */}
      {loading ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : filteredBatchCalls.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={locale === 'tr' ? 'Henüz arama yok' : 'No calls yet'}
          description={locale === 'tr'
            ? 'Toplu arama oluşturarak müşterilerinize ulaşın'
            : 'Create batch calls to reach your customers'
          }
          action={
            can('campaigns:view') && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {locale === 'tr' ? 'İlk Aramayı Oluştur' : 'Create First Call'}
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Arama' : 'Call'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Asistan' : 'Assistant'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Durum' : 'Status'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İlerleme' : 'Progress'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Tarih' : 'Date'}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İşlemler' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filteredBatchCalls.map((batch) => {
                const statusConfig = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = statusConfig.icon;
                const progress = batch.totalRecipients > 0
                  ? Math.round((batch.completedCalls / batch.totalRecipients) * 100)
                  : 0;

                return (
                  <tr key={batch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">{batch.name}</div>
                          <div className="text-xs text-neutral-500">
                            {batch.totalRecipients} {locale === 'tr' ? 'kişi' : 'recipients'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-900 dark:text-white">{batch.assistant?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="ghost" className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                        <StatusIcon className={`h-3 w-3 ${batch.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
                        {statusConfig.label[locale]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(batch.createdAt, 'short')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
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
      )}

      {/* Create Modal - Full Screen */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary-600" />
                {locale === 'tr' ? 'Yeni Arama Oluştur' : 'Create New Call'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {createStep === 1 && (locale === 'tr' ? 'Arama bilgilerini girin' : 'Enter call information')}
              {createStep === 2 && (locale === 'tr' ? 'Dosya yükleyin ve kolonları eşleştirin' : 'Upload file and map columns')}
              {createStep === 3 && (locale === 'tr' ? 'Zamanlamayı ayarlayın ve onaylayın' : 'Set scheduling and confirm')}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  createStep >= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 rounded-full transition-colors ${
                    createStep > step
                      ? 'bg-primary-600'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-6 py-4">
            {/* Step 1: Basic Info */}
            {createStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>{locale === 'tr' ? 'Arama Adı *' : 'Call Name *'}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={locale === 'tr' ? 'örn: Ocak Tahsilat Araması' : 'e.g., January Collection Call'}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>{locale === 'tr' ? 'Arama Amacı *' : 'Call Purpose *'}</Label>
                    <Select
                      value={formData.callPurpose}
                      onValueChange={(value) => setFormData({ ...formData, callPurpose: value, assistantId: '' })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={locale === 'tr' ? 'Arama amacını seçin' : 'Select call purpose'} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CALL_PURPOSE_OPTIONS).map(([key, labels]) => (
                          <SelectItem key={key} value={key}>
                            {labels[locale]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>{locale === 'tr' ? 'Telefon Numarası *' : 'Phone Number *'}</Label>
                    <Select
                      value={formData.phoneNumberId}
                      onValueChange={(value) => setFormData({ ...formData, phoneNumberId: value })}
                    >
                      <SelectTrigger className="mt-1">
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
                  </div>

                  <div>
                    <Label>{locale === 'tr' ? 'Asistan *' : 'Assistant *'}</Label>
                    <Select
                      value={formData.assistantId}
                      onValueChange={(value) => setFormData({ ...formData, assistantId: value })}
                      disabled={!formData.callPurpose}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={
                          !formData.callPurpose
                            ? (locale === 'tr' ? 'Önce arama amacı seçin' : 'Select call purpose first')
                            : (locale === 'tr' ? 'Giden arama asistanı seçin' : 'Select outbound assistant')
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {assistants
                          .filter(a => a.callPurpose === formData.callPurpose)
                          .map((assistant) => (
                            <SelectItem key={assistant.id} value={assistant.id}>
                              {assistant.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {formData.callPurpose && assistants.filter(a => a.callPurpose === formData.callPurpose).length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {locale === 'tr'
                          ? `"${CALL_PURPOSE_OPTIONS[formData.callPurpose]?.tr}" amacına uygun asistan bulunamadı. Önce bu amaç için bir giden arama asistanı oluşturun.`
                          : `No assistant found for "${CALL_PURPOSE_OPTIONS[formData.callPurpose]?.en}" purpose. Create an outbound assistant for this purpose first.`
                        }
                      </p>
                    )}
                    {!formData.callPurpose && assistants.length === 0 && (
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
              </div>
            )}

            {/* Step 2: File Upload & Column Mapping */}
            {createStep === 2 && (
              <div className="space-y-6">
                {/* Template Download Section */}
                {hasTemplate && (
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {formData.callPurpose === 'sales'
                          ? (locale === 'tr' ? 'Satış Şablonu' : 'Sales Template')
                          : (locale === 'tr' ? 'Tahsilat Şablonu' : 'Collection Template')
                        }
                      </p>
                      <p className="text-sm text-neutral-500">
                        {locale === 'tr' ? 'Hazır şablonu indirip doldurun' : 'Download and fill the template'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadTemplate(formData.callPurpose)}>
                      <Download className="h-4 w-4 mr-2" />
                      {locale === 'tr' ? 'Şablon İndir' : 'Download'}
                    </Button>
                  </div>
                )}

                {/* File Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                    ${selectedFile ? 'border-primary-300 bg-primary-50 dark:bg-primary-950' : 'border-neutral-300 hover:border-primary-400 dark:border-neutral-600'}
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
                      <p className="text-neutral-600 dark:text-neutral-400">
                        {locale === 'tr' ? 'Dosya okunuyor...' : 'Reading file...'}
                      </p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="h-12 w-12 text-primary-600 mb-3" />
                      <p className="font-medium text-neutral-900 dark:text-white">{selectedFile.name}</p>
                      <p className="text-sm text-neutral-500 mb-2">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {fileData.totalRows} {locale === 'tr' ? 'satır' : 'rows'}
                      </p>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileData({ columns: [], preview: [], totalRows: 0 }); setColumnMapping({}); }}>
                        <X className="h-4 w-4 mr-1" />
                        {locale === 'tr' ? 'Kaldır' : 'Remove'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-neutral-400 mb-3" />
                      <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        {locale === 'tr' ? 'Dosya yüklemek için tıklayın' : 'Click to upload file'}
                      </p>
                      <p className="text-sm text-neutral-500">
                        CSV, XLS, XLSX (max 5MB)
                      </p>
                    </div>
                  )}
                </div>

                {/* Column Mapping */}
                {fileData.columns.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-neutral-900 dark:text-white">
                      {locale === 'tr' ? 'Kolon Eşleştirme' : 'Column Mapping'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Phone column (required) */}
                      <div>
                        <Label className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {locale === 'tr' ? 'Telefon Numarası *' : 'Phone Number *'}
                        </Label>
                        <Select
                          value={columnMapping.phone || ''}
                          onValueChange={(value) => setColumnMapping({ ...columnMapping, phone: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={locale === 'tr' ? 'Kolon seçin' : 'Select column'} />
                          </SelectTrigger>
                          <SelectContent>
                            {fileData.columns.map((col) => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Customer name column */}
                      <div>
                        <Label>{locale === 'tr' ? 'Müşteri Adı' : 'Customer Name'}</Label>
                        <Select
                          value={columnMapping.customer_name || ''}
                          onValueChange={(value) => setColumnMapping({
                            ...columnMapping,
                            customer_name: value === '_none_' ? undefined : value
                          })}
                        >
                          <SelectTrigger className="mt-1">
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

                      {/* Template-specific columns */}
                      {hasTemplate && Object.entries(getTemplateVariables()).map(([key, labels]) => (
                        <div key={key}>
                          <Label>{labels[locale]}</Label>
                          <Select
                            value={columnMapping[key] || ''}
                            onValueChange={(value) => setColumnMapping({
                              ...columnMapping,
                              [key]: value === '_none_' ? undefined : value
                            })}
                          >
                            <SelectTrigger className="mt-1">
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
              </div>
            )}

            {/* Step 3: Scheduling & Confirm */}
            {createStep === 3 && (
              <div className="space-y-6">
                {/* Scheduling Options */}
                <div>
                  <Label className="mb-3 block">{locale === 'tr' ? 'Zamanlama' : 'Scheduling'}</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, startImmediately: true })}
                      className={`flex-1 p-4 border-2 rounded-xl text-left transition-colors ${
                        formData.startImmediately ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="h-5 w-5 text-primary-600" />
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {locale === 'tr' ? 'Hemen Başlat' : 'Start Immediately'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500">
                        {locale === 'tr' ? 'Aramalar hemen başlayacak' : 'Calls will start immediately'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, startImmediately: false })}
                      className={`flex-1 p-4 border-2 rounded-xl text-left transition-colors ${
                        !formData.startImmediately ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-5 w-5 text-primary-600" />
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {locale === 'tr' ? 'İleri Tarihte' : 'Schedule for Later'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500">
                        {locale === 'tr' ? 'Belirli bir tarih ve saat seçin' : 'Choose a specific date and time'}
                      </p>
                    </button>
                  </div>

                  {!formData.startImmediately && (
                    <div className="mt-4">
                      <Label>{locale === 'tr' ? 'Başlangıç Zamanı' : 'Start Time'}</Label>
                      <Input
                        type="datetime-local"
                        value={formData.scheduledAt || ''}
                        onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                        min={new Date().toISOString().slice(0, 16)}
                        className="mt-1 max-w-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-neutral-900 dark:text-white mb-3">
                    {locale === 'tr' ? 'Özet' : 'Summary'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Arama Adı' : 'Call Name'}</span>
                      <p className="font-medium text-neutral-900 dark:text-white">{formData.name}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Arama Amacı' : 'Call Purpose'}</span>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {CALL_PURPOSE_OPTIONS[formData.callPurpose]?.[locale] || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Asistan' : 'Assistant'}</span>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {assistants.find(a => a.id === formData.assistantId)?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Telefon' : 'Phone'}</span>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {phoneNumbers.find(p => p.id === formData.phoneNumberId)?.phoneNumber || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Toplam Alıcı' : 'Total Recipients'}</span>
                      <p className="font-medium text-primary-600 dark:text-primary-400">{fileData.totalRows}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">{locale === 'tr' ? 'Zamanlama' : 'Scheduling'}</span>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {formData.startImmediately
                          ? (locale === 'tr' ? 'Hemen başlat' : 'Start immediately')
                          : formatDate(formData.scheduledAt, 'long')
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
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

            {createStep < 3 ? (
              <Button
                onClick={() => {
                  if (createStep === 1) {
                    if (!formData.name || !formData.assistantId || !formData.phoneNumberId || !formData.callPurpose) {
                      toast.error(locale === 'tr' ? 'Tüm zorunlu alanları doldurun' : 'Fill all required fields');
                      return;
                    }
                    setCreateStep(2);
                  } else if (createStep === 2) {
                    if (!selectedFile) {
                      toast.error(locale === 'tr' ? 'Dosya yükleyin' : 'Upload a file');
                      return;
                    }
                    if (!columnMapping.phone) {
                      toast.error(locale === 'tr' ? 'Telefon kolonunu seçin' : 'Select phone column');
                      return;
                    }
                    setCreateStep(3);
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
                    {locale === 'tr' ? 'Aramayı Başlat' : 'Start Call'}
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

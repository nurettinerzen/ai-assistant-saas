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
  DialogFooter,
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
  Users,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  Search,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Calculator,
  Wrench,
  Calendar,
  Package,
  HelpCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

// Data type options for inbound calls
const DATA_TYPE_OPTIONS = {
  accounting: {
    tr: 'Muhasebe',
    en: 'Accounting',
    description: { tr: 'SGK borcu, vergi borcu, beyanname bilgileri', en: 'SSI debt, tax debt, declaration info' },
    icon: Calculator,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
  },
  support: {
    tr: 'Arıza Takip',
    en: 'Support Tracking',
    description: { tr: 'Müşteri destek talepleri, arıza kayıtları', en: 'Customer support requests, fault records' },
    icon: Wrench,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400'
  },
  appointment: {
    tr: 'Randevu',
    en: 'Appointment',
    description: { tr: 'Randevu bilgileri, hatırlatmalar', en: 'Appointment info, reminders' },
    icon: Calendar,
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
  },
  order: {
    tr: 'Sipariş',
    en: 'Order',
    description: { tr: 'Sipariş durumu, kargo bilgileri', en: 'Order status, shipping info' },
    icon: Package,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
  },
  other: {
    tr: 'Diğer',
    en: 'Other',
    description: { tr: 'Özel müşteri verileri', en: 'Custom customer data' },
    icon: HelpCircle,
    color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400'
  }
};

// Format money for display
const formatMoney = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value) + ' TL';
};

// Format date for display
const formatDateDisplay = (dateValue, locale = 'tr') => {
  if (!dateValue) return '-';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateValue;
  }
};

export default function CustomerDataPage() {
  const { t, locale } = useLanguage();
  const [customerData, setCustomerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Current customer for edit/view
  const [currentCustomer, setCurrentCustomer] = useState(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [uploadStep, setUploadStep] = useState(1); // 1: Select type, 2: Upload file, 3: Preview, 4: Result
  const [selectedDataType, setSelectedDataType] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    vkn: '',
    tcNo: '',
    notes: '',
    customFields: {}
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load data when search or page changes
  useEffect(() => {
    loadData();
  }, [debouncedSearch, pagination.page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.customerData.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined
      });
      setCustomerData(res.data.customerData || []);
      setPagination(prev => ({
        ...prev,
        ...res.data.pagination
      }));
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast.error(locale === 'tr' ? 'Veriler yüklenirken hata oluştu' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async (type = 'accounting') => {
    try {
      const res = await apiClient.customerData.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'musteri-verileri-sablon.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(locale === 'tr' ? 'Şablon indirildi' : 'Template downloaded');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error(locale === 'tr' ? 'Şablon indirilemedi' : 'Failed to download template');
    }
  };

  // File select for upload
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

    setUploadFile(file);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.customerData.parseFile(formData);
      setUploadPreview(res.data);
      setUploadStep(3);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error(error.response?.data?.error || (locale === 'tr' ? 'Dosya okunamadı' : 'Failed to parse file'));
      setUploadFile(null);
    } finally {
      setUploading(false);
    }
  };

  // Import file
  const handleImport = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await apiClient.customerData.importFile(formData);
      setImportResult(res.data.results);
      setUploadStep(4);
      loadData(); // Reload list
    } catch (error) {
      console.error('Error importing file:', error);
      toast.error(error.response?.data?.error || (locale === 'tr' ? 'İçe aktarma başarısız' : 'Import failed'));
    } finally {
      setUploading(false);
    }
  };

  // Reset upload modal
  const resetUploadModal = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setImportResult(null);
    setUploadStep(1);
    setSelectedDataType('');
    setShowUploadModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open create/edit modal
  const openCreateModal = (customer = null) => {
    if (customer) {
      setFormData({
        companyName: customer.companyName || '',
        contactName: customer.contactName || '',
        phone: customer.phone || '',
        email: customer.email || '',
        vkn: customer.vkn || '',
        tcNo: customer.tcNo || '',
        notes: customer.notes || '',
        customFields: customer.customFields || {}
      });
      setCurrentCustomer(customer);
    } else {
      setFormData({
        companyName: '',
        contactName: '',
        phone: '',
        email: '',
        vkn: '',
        tcNo: '',
        notes: '',
        customFields: {}
      });
      setCurrentCustomer(null);
    }
    setShowCreateModal(true);
  };

  // Save customer
  const handleSave = async () => {
    if (!formData.companyName || !formData.phone) {
      toast.error(locale === 'tr' ? 'İşletme adı ve telefon zorunludur' : 'Company name and phone are required');
      return;
    }

    setSaving(true);
    try {
      if (currentCustomer) {
        await apiClient.customerData.update(currentCustomer.id, formData);
        toast.success(locale === 'tr' ? 'Müşteri güncellendi' : 'Customer updated');
      } else {
        await apiClient.customerData.create(formData);
        toast.success(locale === 'tr' ? 'Müşteri eklendi' : 'Customer added');
      }
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errorTR || (locale === 'tr' ? 'Kayıt başarısız' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // Delete customer(s)
  const handleDelete = async () => {
    if (selectedIds.length === 0 && !currentCustomer) return;

    const idsToDelete = selectedIds.length > 0 ? selectedIds : [currentCustomer.id];

    try {
      if (idsToDelete.length === 1) {
        await apiClient.customerData.delete(idsToDelete[0]);
      } else {
        await apiClient.customerData.bulkDelete(idsToDelete);
      }
      toast.success(locale === 'tr'
        ? `${idsToDelete.length} müşteri silindi`
        : `${idsToDelete.length} customer(s) deleted`
      );
      setSelectedIds([]);
      setCurrentCustomer(null);
      setShowDeleteModal(false);
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(locale === 'tr' ? 'Silme başarısız' : 'Delete failed');
    }
  };

  // View customer detail
  const openDetailModal = (customer) => {
    setCurrentCustomer(customer);
    setShowDetailModal(true);
  };

  // Toggle selection
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedIds.length === customerData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customerData.map(c => c.id));
    }
  };

  // Pagination
  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {locale === 'tr' ? 'Gelen Arama' : 'Inbound Calls'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {locale === 'tr'
              ? 'Gelen aramalarda müşteri telefon numarasına göre eşleşen veriler'
              : 'Data matched by customer phone number for inbound calls'}
          </p>
        </div>

        <Button onClick={() => setShowUploadModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {locale === 'tr' ? 'Yeni Veri Ekle' : 'Add New Data'}
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-3">
          <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {locale === 'tr' ? 'Telefon Numarası Eşleştirme' : 'Phone Number Matching'}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {locale === 'tr'
                ? 'Gelen aramalarda arayan kişinin telefon numarası bu veritabanı ile eşleştirilir. Eşleşen müşterinin bilgileri asistana iletilir.'
                : 'Caller\'s phone number is matched against this database during inbound calls. Matched customer info is sent to the assistant.'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={locale === 'tr' ? 'İsim, telefon, VKN ile ara...' : 'Search by name, phone, VKN...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">
              {selectedIds.length} {locale === 'tr' ? 'seçili' : 'selected'}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {locale === 'tr' ? 'Sil' : 'Delete'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading && customerData.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : customerData.length === 0 ? (
        <EmptyState
          icon={Users}
          title={locale === 'tr' ? 'Henüz müşteri verisi yok' : 'No customer data yet'}
          description={locale === 'tr'
            ? 'Excel dosyası yükleyerek veya manuel olarak müşteri ekleyebilirsiniz'
            : 'Upload an Excel file or add customers manually'}
          action={
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {locale === 'tr' ? 'Veri Ekle' : 'Add Data'}
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === customerData.length && customerData.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-neutral-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'İşletme / Müşteri' : 'Company / Customer'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'Telefon' : 'Phone'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'SGK Borcu' : 'SSI Debt'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'Vergi Borcu' : 'Tax Debt'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'Son Güncelleme' : 'Last Updated'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {locale === 'tr' ? 'İşlemler' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {customerData.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                        className="rounded border-neutral-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {customer.companyName}
                        </p>
                        {customer.contactName && (
                          <p className="text-sm text-neutral-500">
                            {customer.contactName}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {formatMoney(customer.customFields?.sgkDebt)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {formatMoney(customer.customFields?.taxDebt)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-sm">
                      {formatDateDisplay(customer.updatedAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailModal(customer)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateModal(customer)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentCustomer(customer);
                            setSelectedIds([]);
                            setShowDeleteModal(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                {locale === 'tr'
                  ? `Toplam ${pagination.total} kayıt`
                  : `Total ${pagination.total} records`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal - Full Screen Style */}
      <Dialog open={showUploadModal} onOpenChange={(open) => !open && resetUploadModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-600" />
              {locale === 'tr' ? 'Müşteri Verisi Ekle' : 'Add Customer Data'}
            </DialogTitle>
            <DialogDescription>
              {uploadStep === 1 && (locale === 'tr' ? 'Veri tipini seçin' : 'Select data type')}
              {uploadStep === 2 && (locale === 'tr' ? 'Dosya yükleyin' : 'Upload file')}
              {uploadStep === 3 && (locale === 'tr' ? 'Verileri önizleyin' : 'Preview data')}
              {uploadStep === 4 && (locale === 'tr' ? 'İçe aktarma sonucu' : 'Import result')}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3, 4].map((step) => (
              <React.Fragment key={step}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  uploadStep >= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-12 h-1 rounded-full transition-colors ${
                    uploadStep > step
                      ? 'bg-primary-600'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Select Data Type */}
          {uploadStep === 1 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {locale === 'tr'
                  ? 'Hangi tür müşteri verisi yüklemek istiyorsunuz?'
                  : 'What type of customer data do you want to upload?'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(DATA_TYPE_OPTIONS).map(([key, option]) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDataType(key)}
                      className={`p-4 border-2 rounded-xl text-left transition-colors ${
                        selectedDataType === key
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${option.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {option[locale]}
                          </p>
                          <p className="text-sm text-neutral-500">
                            {option.description[locale]}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {uploadStep === 2 && (
            <div className="space-y-6 py-4">
              {/* Template Download */}
              {selectedDataType === 'accounting' && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {locale === 'tr' ? 'Muhasebe Şablonu' : 'Accounting Template'}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {locale === 'tr' ? 'SGK, vergi borcu ve beyanname bilgileri' : 'SSI, tax debt and declaration info'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate('accounting')}>
                    <Download className="h-4 w-4 mr-2" />
                    {locale === 'tr' ? 'İndir' : 'Download'}
                  </Button>
                </div>
              )}

              {/* File Upload Area */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${uploadFile ? 'border-primary-300 bg-primary-50 dark:bg-primary-950' : 'border-neutral-300 hover:border-primary-400 dark:border-neutral-600'}
                `}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-primary-600 animate-spin mb-3" />
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {locale === 'tr' ? 'Dosya okunuyor...' : 'Reading file...'}
                    </p>
                  </div>
                ) : uploadFile ? (
                  <div className="flex flex-col items-center">
                    <FileSpreadsheet className="h-12 w-12 text-primary-600 mb-3" />
                    <p className="font-medium text-neutral-900 dark:text-white">{uploadFile.name}</p>
                    <p className="text-sm text-neutral-500 mb-2">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}>
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
            </div>
          )}

          {/* Step 3: Preview */}
          {uploadStep === 3 && uploadPreview && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-green-700 dark:text-green-300">
                  {locale === 'tr'
                    ? `${uploadPreview.totalRows} satır bulundu`
                    : `${uploadPreview.totalRows} rows found`}
                </span>
              </div>

              <div className="max-h-64 overflow-auto border dark:border-neutral-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
                    <tr>
                      {uploadPreview.columns.slice(0, 6).map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-[120px]">
                          {col}
                        </th>
                      ))}
                      {uploadPreview.columns.length > 6 && (
                        <th className="px-3 py-2 text-left font-medium text-neutral-400">
                          +{uploadPreview.columns.length - 6}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {uploadPreview.preview.map((row, i) => (
                      <tr key={i}>
                        {uploadPreview.columns.slice(0, 6).map((col, j) => (
                          <td key={j} className="px-3 py-2 text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
                            {String(row[col] || '').substring(0, 20)}
                          </td>
                        ))}
                        {uploadPreview.columns.length > 6 && (
                          <td className="px-3 py-2 text-neutral-400">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone Matching Info */}
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {locale === 'tr'
                      ? 'Telefon numarası kolonu otomatik olarak algılanacaktır. Gelen aramalarda bu numara ile eşleşme yapılacak.'
                      : 'Phone number column will be auto-detected. Inbound calls will be matched against these numbers.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {uploadStep === 4 && importResult && (
            <div className="space-y-4 py-4">
              {importResult.success > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 dark:text-green-300">
                    {importResult.success} {locale === 'tr' ? 'yeni kayıt oluşturuldu' : 'new records created'}
                  </span>
                </div>
              )}
              {importResult.updated > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700 dark:text-blue-300">
                    {importResult.updated} {locale === 'tr' ? 'kayıt güncellendi' : 'records updated'}
                  </span>
                </div>
              )}
              {importResult.failed > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700 dark:text-red-300">
                      {importResult.failed} {locale === 'tr' ? 'kayıt başarısız' : 'records failed'}
                    </span>
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside max-h-32 overflow-auto">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          {locale === 'tr' ? `Satır ${err.row}: ${err.error}` : `Row ${err.row}: ${err.error}`}
                        </li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>...{locale === 'tr' ? `ve ${importResult.errors.length - 10} hata daha` : `and ${importResult.errors.length - 10} more errors`}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (uploadStep === 1) {
                  resetUploadModal();
                } else if (uploadStep === 4) {
                  // Go back to step 2 to try again with a different file
                  setUploadFile(null);
                  setUploadPreview(null);
                  setImportResult(null);
                  setUploadStep(2);
                } else {
                  setUploadStep(uploadStep - 1);
                  if (uploadStep === 3) {
                    setUploadFile(null);
                    setUploadPreview(null);
                  }
                }
              }}
            >
              {uploadStep === 1
                ? (locale === 'tr' ? 'Kapat' : 'Close')
                : (locale === 'tr' ? 'Geri' : 'Back')
              }
            </Button>

            {uploadStep === 1 && (
              <Button
                onClick={() => setUploadStep(2)}
                disabled={!selectedDataType}
              >
                {locale === 'tr' ? 'Devam' : 'Continue'}
              </Button>
            )}

            {uploadStep === 2 && (
              <Button
                onClick={() => {}}
                disabled={!uploadFile || uploading}
              >
                {locale === 'tr' ? 'Dosya Yükleyin' : 'Upload File'}
              </Button>
            )}

            {uploadStep === 3 && (
              <Button onClick={handleImport} disabled={uploading}>
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {locale === 'tr' ? 'İçe Aktar' : 'Import'}
              </Button>
            )}

            {uploadStep === 4 && (
              <Button onClick={resetUploadModal}>
                {locale === 'tr' ? 'Tamam' : 'Done'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {currentCustomer
                ? (locale === 'tr' ? 'Müşteri Düzenle' : 'Edit Customer')
                : (locale === 'tr' ? 'Yeni Müşteri' : 'New Customer')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{locale === 'tr' ? 'İşletme / Müşteri Adı *' : 'Company / Customer Name *'}</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder={locale === 'tr' ? 'ABC Ticaret Ltd. Şti.' : 'ABC Company Ltd.'}
                className="mt-1"
              />
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Telefon *' : 'Phone *'}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="5321234567"
                className="mt-1"
              />
              <p className="text-xs text-neutral-500 mt-1">
                {locale === 'tr'
                  ? 'Bu numara gelen aramalarda eşleştirme için kullanılır'
                  : 'This number is used for matching inbound calls'}
              </p>
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Yetkili Kişi' : 'Contact Person'}</Label>
              <Input
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Ahmet Yılmaz"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@sirket.com"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>VKN</Label>
                <Input
                  value={formData.vkn}
                  onChange={(e) => setFormData({ ...formData, vkn: e.target.value })}
                  placeholder="1234567890"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>TC No</Label>
                <Input
                  value={formData.tcNo}
                  onChange={(e) => setFormData({ ...formData, tcNo: e.target.value })}
                  placeholder="12345678901"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Notlar' : 'Notes'}</Label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                rows={3}
                placeholder={locale === 'tr' ? 'Ek notlar...' : 'Additional notes...'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {locale === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {locale === 'tr' ? 'Kaydet' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {currentCustomer?.companyName}
            </DialogTitle>
          </DialogHeader>

          {currentCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {currentCustomer.contactName && (
                  <div>
                    <p className="text-neutral-500">{locale === 'tr' ? 'Yetkili' : 'Contact'}</p>
                    <p className="font-medium text-neutral-900 dark:text-white">{currentCustomer.contactName}</p>
                  </div>
                )}
                <div>
                  <p className="text-neutral-500">{locale === 'tr' ? 'Telefon' : 'Phone'}</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{currentCustomer.phone}</p>
                </div>
                {currentCustomer.email && (
                  <div>
                    <p className="text-neutral-500">Email</p>
                    <p className="font-medium text-neutral-900 dark:text-white">{currentCustomer.email}</p>
                  </div>
                )}
                {currentCustomer.vkn && (
                  <div>
                    <p className="text-neutral-500">VKN</p>
                    <p className="font-medium text-neutral-900 dark:text-white">{currentCustomer.vkn}</p>
                  </div>
                )}
              </div>

              {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 && (
                <>
                  <hr className="border-neutral-200 dark:border-neutral-700" />
                  <div>
                    <h4 className="font-medium text-neutral-900 dark:text-white mb-3">
                      {locale === 'tr' ? 'Mali Bilgiler' : 'Financial Information'}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {currentCustomer.customFields.sgkDebt !== undefined && (
                        <div>
                          <p className="text-neutral-500">{locale === 'tr' ? 'SGK Borcu' : 'SSI Debt'}</p>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {formatMoney(currentCustomer.customFields.sgkDebt)}
                          </p>
                          {currentCustomer.customFields.sgkDueDate && (
                            <p className="text-xs text-neutral-400">
                              {locale === 'tr' ? 'Vade' : 'Due'}: {formatDateDisplay(currentCustomer.customFields.sgkDueDate, locale)}
                            </p>
                          )}
                        </div>
                      )}
                      {currentCustomer.customFields.taxDebt !== undefined && (
                        <div>
                          <p className="text-neutral-500">{locale === 'tr' ? 'Vergi Borcu' : 'Tax Debt'}</p>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {formatMoney(currentCustomer.customFields.taxDebt)}
                          </p>
                          {currentCustomer.customFields.taxDueDate && (
                            <p className="text-xs text-neutral-400">
                              {locale === 'tr' ? 'Vade' : 'Due'}: {formatDateDisplay(currentCustomer.customFields.taxDueDate, locale)}
                            </p>
                          )}
                        </div>
                      )}
                      {currentCustomer.customFields.declarationType && (
                        <div className="col-span-2">
                          <p className="text-neutral-500">{locale === 'tr' ? 'Beyanname' : 'Declaration'}</p>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {currentCustomer.customFields.declarationType}
                            {currentCustomer.customFields.declarationPeriod && ` - ${currentCustomer.customFields.declarationPeriod}`}
                          </p>
                          {currentCustomer.customFields.declarationDueDate && (
                            <p className="text-xs text-neutral-400">
                              {locale === 'tr' ? 'Son Tarih' : 'Due Date'}: {formatDateDisplay(currentCustomer.customFields.declarationDueDate, locale)}
                            </p>
                          )}
                          {currentCustomer.customFields.declarationStatus && (
                            <Badge variant="outline" className="mt-1">
                              {currentCustomer.customFields.declarationStatus}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {currentCustomer.notes && (
                <>
                  <hr className="border-neutral-200 dark:border-neutral-700" />
                  <div>
                    <p className="text-neutral-500 text-sm">{locale === 'tr' ? 'Notlar' : 'Notes'}</p>
                    <p className="text-neutral-900 dark:text-white mt-1">{currentCustomer.notes}</p>
                  </div>
                </>
              )}

              {currentCustomer.tags && currentCustomer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentCustomer.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              {locale === 'tr' ? 'Kapat' : 'Close'}
            </Button>
            <Button onClick={() => {
              setShowDetailModal(false);
              openCreateModal(currentCustomer);
            }}>
              <Pencil className="w-4 h-4 mr-2" />
              {locale === 'tr' ? 'Düzenle' : 'Edit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {locale === 'tr' ? 'Silme Onayı' : 'Confirm Delete'}
            </DialogTitle>
            <DialogDescription>
              {selectedIds.length > 0
                ? (locale === 'tr'
                    ? `${selectedIds.length} müşteri silinecek. Bu işlem geri alınamaz.`
                    : `${selectedIds.length} customer(s) will be deleted. This action cannot be undone.`)
                : (locale === 'tr'
                    ? `"${currentCustomer?.companyName}" silinecek. Bu işlem geri alınamaz.`
                    : `"${currentCustomer?.companyName}" will be deleted. This action cannot be undone.`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {locale === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {locale === 'tr' ? 'Sil' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

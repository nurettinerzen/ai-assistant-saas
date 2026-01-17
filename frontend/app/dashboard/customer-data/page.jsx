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
  HelpCircle,
  FileText,
  ArrowLeft,
  MoreVertical,
  Clock
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  custom: {
    tr: 'Diğer',
    en: 'Other',
    description: { tr: 'Özel müşteri verileri', en: 'Custom customer data' },
    icon: HelpCircle,
    color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400'
  }
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

  // View mode: 'files' or 'records'
  const [viewMode, setViewMode] = useState('files');
  const [selectedFile, setSelectedFile] = useState(null);

  // Files state
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // Records state (when viewing a file)
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsPagination, setRecordsPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false);
  const [showRecordDetailModal, setShowRecordDetailModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [currentRecord, setCurrentRecord] = useState(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [uploadStep, setUploadStep] = useState(1);
  const [selectedDataType, setSelectedDataType] = useState('');

  const fileInputRef = useRef(null);

  // Records view state (for bulk operations, edit, add)
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [addFormData, setAddFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // {recordId, columnName}
  const [editingValue, setEditingValue] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Load records when file is selected or search changes
  useEffect(() => {
    if (viewMode === 'records' && selectedFile) {
      loadRecords();
    }
  }, [selectedFile, debouncedSearch, recordsPagination.page]);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await apiClient.customerData.getFiles();
      setFiles(res.data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error(locale === 'tr' ? 'Dosyalar yüklenirken hata oluştu' : 'Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadRecords = async () => {
    if (!selectedFile) return;

    setLoadingRecords(true);
    try {
      const res = await apiClient.customerData.getFile(selectedFile.id, {
        page: recordsPagination.page,
        limit: recordsPagination.limit,
        search: debouncedSearch || undefined
      });
      setRecords(res.data.records || []);
      setRecordsPagination(prev => ({
        ...prev,
        ...res.data.pagination
      }));
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error(locale === 'tr' ? 'Kayıtlar yüklenirken hata oluştu' : 'Failed to load records');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Open file to view records
  const openFile = (file) => {
    setSelectedFile(file);
    setViewMode('records');
    setSearchQuery('');
    setDebouncedSearch('');
    setRecordsPagination(prev => ({ ...prev, page: 1 }));
  };

  // Go back to file list
  const goBackToFiles = () => {
    setViewMode('files');
    setSelectedFile(null);
    setRecords([]);
    setSearchQuery('');
    setDebouncedSearch('');
  };

  // Delete file
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      await apiClient.customerData.deleteFile(fileToDelete.id);
      toast.success(locale === 'tr' ? 'Dosya silindi' : 'File deleted');
      setShowDeleteFileModal(false);
      setFileToDelete(null);
      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(locale === 'tr' ? 'Silme başarısız' : 'Delete failed');
    }
  };

  // Download template based on selected data type
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.customerData.downloadTemplate(selectedDataType || 'custom');
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      // Use data type specific filename
      const fileNames = {
        accounting: 'muhasebe-sablon.xlsx',
        support: 'ariza-takip-sablon.xlsx',
        appointment: 'randevu-sablon.xlsx',
        order: 'siparis-sablon.xlsx',
        custom: 'musteri-verileri-sablon.xlsx'
      };
      link.download = fileNames[selectedDataType] || 'musteri-verileri-sablon.xlsx';
      document.body.appendChild(link);
      link.click();
      // Clean up after a delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
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
      formData.append('dataType', selectedDataType);

      const res = await apiClient.customerData.importFile(formData);
      setImportResult(res.data.results);
      setUploadStep(4);
      loadFiles();
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

  // Get data type info
  const getDataTypeInfo = (dataType) => {
    return DATA_TYPE_OPTIONS[dataType] || DATA_TYPE_OPTIONS.custom;
  };

  // Pagination
  const goToPage = (page) => {
    setRecordsPagination(prev => ({ ...prev, page }));
  };

  // ============================================================
  // FILE LIST VIEW
  // ============================================================
  if (viewMode === 'files') {
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
            {locale === 'tr' ? 'Yeni Veri Yükle' : 'Upload New Data'}
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

        {/* File List */}
        {loadingFiles ? (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={locale === 'tr' ? 'Henüz dosya yüklenmemiş' : 'No files uploaded yet'}
            description={locale === 'tr'
              ? 'Excel veya CSV dosyası yükleyerek müşteri verilerinizi ekleyin'
              : 'Upload an Excel or CSV file to add your customer data'}
            action={
              <Button onClick={() => setShowUploadModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {locale === 'tr' ? 'Dosya Yükle' : 'Upload File'}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => {
              const typeInfo = getDataTypeInfo(file.dataType);
              const TypeIcon = typeInfo.icon;

              return (
                <div
                  key={file.id}
                  className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer group"
                  onClick={() => openFile(file)}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete(file);
                            setShowDeleteFileModal(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {locale === 'tr' ? 'Sil' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-medium text-neutral-900 dark:text-white truncate">
                      {file.fileName}
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {typeInfo[locale]}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-sm text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{file.recordCount} {locale === 'tr' ? 'kayıt' : 'records'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDateDisplay(file.createdAt, locale)}</span>
                    </div>
                  </div>

                  {file.status === 'PROCESSING' && (
                    <Badge variant="secondary" className="mt-3">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {locale === 'tr' ? 'İşleniyor' : 'Processing'}
                    </Badge>
                  )}
                  {file.status === 'FAILED' && (
                    <Badge variant="destructive" className="mt-3">
                      <XCircle className="h-3 w-3 mr-1" />
                      {locale === 'tr' ? 'Başarısız' : 'Failed'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Modal */}
        <Dialog open={showUploadModal} onOpenChange={(open) => !open && resetUploadModal()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary-600" />
                {locale === 'tr' ? 'Müşteri Verisi Yükle' : 'Upload Customer Data'}
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
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {locale === 'tr' ? 'Örnek Şablon' : 'Sample Template'}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {locale === 'tr' ? 'Doğru format için şablonu indirin' : 'Download template for correct format'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    {locale === 'tr' ? 'İndir' : 'Download'}
                  </Button>
                </div>

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
                        ? 'Telefon numarası kolonu otomatik olarak algılanacaktır. Gelen aramalarda bu numara ile eşleştirme yapılacak.'
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
                <Button disabled>
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

        {/* Delete File Confirmation Modal */}
        <Dialog open={showDeleteFileModal} onOpenChange={setShowDeleteFileModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-600">
                {locale === 'tr' ? 'Dosya Sil' : 'Delete File'}
              </DialogTitle>
              <DialogDescription>
                {locale === 'tr'
                  ? `"${fileToDelete?.fileName}" dosyası ve tüm kayıtları silinecek. Bu işlem geri alınamaz.`
                  : `"${fileToDelete?.fileName}" and all its records will be deleted. This action cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteFileModal(false)}>
                {locale === 'tr' ? 'İptal' : 'Cancel'}
              </Button>
              <Button variant="destructive" onClick={handleDeleteFile}>
                <Trash2 className="w-4 h-4 mr-2" />
                {locale === 'tr' ? 'Sil' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================================================
  // RECORDS VIEW (when a file is selected)
  // ============================================================
  const typeInfo = selectedFile ? getDataTypeInfo(selectedFile.dataType) : null;
  const fileColumns = selectedFile?.columns || [];

  // Toggle single record selection
  const toggleRecordSelection = (recordId) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  // Toggle all records selection
  const toggleAllRecords = () => {
    if (selectedRecords.length === records.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(records.map(r => r.id));
    }
  };

  // Start inline editing
  const startEditing = (record, columnName) => {
    setEditingCell({ recordId: record.id, columnName });
    setEditingValue(getRecordValue(record, columnName) === '-' ? '' : getRecordValue(record, columnName));
  };

  // Save inline edit
  const saveInlineEdit = async (record, columnName) => {
    if (!editingCell) return;

    const newValue = editingValue.trim();
    const oldValue = getRecordValue(record, columnName);

    // If value hasn't changed, just cancel
    if (newValue === oldValue || (newValue === '' && oldValue === '-')) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    // Clear editing state immediately for better UX
    setEditingCell(null);
    setEditingValue('');

    try {
      // Determine which field to update
      const fieldMapping = {
        'Müşteri Adı': 'companyName',
        'İşletme/Müşteri Adı': 'companyName',
        'Firma': 'companyName',
        'İsim Soyisim': 'companyName',
        'Yetkili': 'contactName',
        'Telefon': 'phone',
        'Telefon No': 'phone',
        'Email': 'email',
        'E-mail': 'email',
        'VKN': 'vkn',
        'TC No': 'tcNo',
        'Notlar': 'notes'
      };

      const standardField = fieldMapping[columnName];
      const currentRecord = records.find(r => r.id === record.id);
      const existingCustomFields = currentRecord?.customFields || record.customFields || {};
      let updateData = {};

      if (standardField) {
        // Update standard field
        updateData[standardField] = newValue || null;
        // Also update the same value in customFields if it exists there (for display consistency)
        if (existingCustomFields[columnName] !== undefined) {
          updateData.customFields = { ...existingCustomFields, [columnName]: newValue || null };
        }
      } else {
        // Update in customFields - merge with existing data
        const updatedCustomFields = { ...existingCustomFields, [columnName]: newValue || null };
        updateData.customFields = updatedCustomFields;
      }

      const response = await apiClient.customerData.update(record.id, updateData);
      console.log('[Inline Edit] Update response:', response.data);
      toast.success(locale === 'tr' ? 'Kaydedildi' : 'Saved');

      // Update local state with server response for consistency
      if (response.data?.customer) {
        setRecords(prevRecords => prevRecords.map(r => {
          if (r.id === record.id) {
            return response.data.customer;
          }
          return r;
        }));
      } else {
        // Fallback: reload from server
        loadRecords();
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(locale === 'tr' ? 'Kaydetme başarısız' : 'Save failed');
      // Reload to restore original state on error
      loadRecords();
    }
  };

  // Cancel inline edit
  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // Delete single record
  const handleDeleteRecord = async (recordId) => {
    try {
      await apiClient.customerData.delete(recordId);
      toast.success(locale === 'tr' ? 'Kayıt silindi' : 'Record deleted');
      loadRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error(locale === 'tr' ? 'Silme başarısız' : 'Delete failed');
    }
  };

  // Bulk delete selected records
  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) return;

    try {
      await apiClient.customerData.bulkDelete(selectedRecords);
      toast.success(locale === 'tr' ? `${selectedRecords.length} kayıt silindi` : `${selectedRecords.length} records deleted`);
      setSelectedRecords([]);
      setShowDeleteConfirmModal(false);
      loadRecords();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error(locale === 'tr' ? 'Silme başarısız' : 'Delete failed');
    }
  };

  // Add new record manually - dynamic based on file columns
  const handleAddRecord = async () => {
    // Find phone column dynamically
    const phoneColNames = ['Telefon', 'Telefon No', 'Tel', 'Phone', 'Numara', 'GSM', 'Cep'];
    const nameColNames = ['Müşteri Adı', 'İşletme/Müşteri Adı', 'Firma', 'İsim', 'Ad Soyad', 'İsim Soyisim', 'Şirket', 'Company', 'Name'];

    // Get column names from file
    const columnNames = fileColumns.map(c => c.name);

    // Find which columns exist for phone and name
    const phoneCol = columnNames.find(col => phoneColNames.some(p => col.toLowerCase().includes(p.toLowerCase())));
    const nameCol = columnNames.find(col => nameColNames.some(n => col.toLowerCase().includes(n.toLowerCase())));

    // Get values from form data
    const phoneValue = phoneCol ? addFormData[phoneCol] : addFormData.phone;
    const nameValue = nameCol ? addFormData[nameCol] : addFormData.companyName;

    if (!nameValue || !phoneValue) {
      toast.error(locale === 'tr' ? 'Ad ve telefon zorunludur' : 'Name and phone are required');
      return;
    }

    setIsSaving(true);
    try {
      // Build customFields from all form data
      const customFields = { ...addFormData };

      // Extract standard fields and keep rest in customFields
      const companyName = nameValue;
      const phone = phoneValue;

      await apiClient.customerData.create({
        companyName,
        phone,
        customFields,
        fileId: selectedFile?.id
      });
      toast.success(locale === 'tr' ? 'Kayıt eklendi' : 'Record added');
      setShowAddModal(false);
      setAddFormData({});
      loadRecords();
    } catch (error) {
      console.error('Error adding record:', error);
      const errorMsg = error.response?.data?.errorTR || error.response?.data?.error || (locale === 'tr' ? 'Ekleme başarısız' : 'Add failed');
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Get value for a column from record
  const getRecordValue = (record, columnName) => {
    // First check customFields - this is where most imported data goes
    if (record.customFields) {
      // Direct match in customFields
      if (record.customFields[columnName] !== undefined && record.customFields[columnName] !== null) {
        const value = record.customFields[columnName];
        // Format date values
        if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
          return formatDateDisplay(value, locale);
        }
        // Format currency values
        if (typeof value === 'number') {
          return value.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');
        }
        return String(value);
      }
    }

    // Map common column names to record fields (for standard fields)
    const fieldMapping = {
      'İşletme/Müşteri Adı': 'companyName',
      'Müşteri Adı': 'companyName',
      'Firma': 'companyName',
      'Şirket': 'companyName',
      'İsim Soyisim': 'companyName',
      'İsim': 'companyName',
      'Ad Soyad': 'companyName',
      'Yetkili': 'contactName',
      'Telefon': 'phone',
      'Telefon No': 'phone',
      'Tel': 'phone',
      'Numara': 'phone',
      'Email': 'email',
      'E-mail': 'email',
      'E-posta': 'email',
      'VKN': 'vkn',
      'TC No': 'tcNo',
      'Notlar': 'notes',
      'Not': 'notes',
      'Etiketler': 'tags'
    };

    const fieldName = fieldMapping[columnName];
    if (fieldName) {
      const value = record[fieldName];
      if (fieldName === 'tags' && Array.isArray(value)) {
        return value.join(', ');
      }
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }

    // Direct field match on record
    if (record[columnName] !== undefined && record[columnName] !== null) {
      return String(record[columnName]);
    }

    return '-';
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={goBackToFiles}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {locale === 'tr' ? 'Geri' : 'Back'}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {typeInfo && (
              <div className={`p-1.5 rounded-lg ${typeInfo.color}`}>
                <typeInfo.icon className="h-4 w-4" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {selectedFile?.fileName}
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {selectedFile?.recordCount} {locale === 'tr' ? 'kayıt' : 'records'} - {locale === 'tr' ? 'Yükleme' : 'Uploaded'}: {formatDateDisplay(selectedFile?.createdAt, locale)}
          </p>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={locale === 'tr' ? 'Kayıtlarda ara...' : 'Search records...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedRecords.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirmModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {locale === 'tr' ? `${selectedRecords.length} Sil` : `Delete ${selectedRecords.length}`}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setAddFormData({});
              setShowAddModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {locale === 'tr' ? 'Manuel Ekle' : 'Add Manually'}
          </Button>
        </div>
      </div>

      {/* Records Table */}
      {loadingRecords ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={Users}
          title={locale === 'tr' ? 'Kayıt bulunamadı' : 'No records found'}
          description={locale === 'tr'
            ? 'Bu dosyada arama kriterlerine uyan kayıt yok'
            : 'No records match your search criteria in this file'}
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {locale === 'tr' ? 'Manuel Kayıt Ekle' : 'Add Record Manually'}
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  {/* Checkbox column */}
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedRecords.length === records.length && records.length > 0}
                      onChange={toggleAllRecords}
                      className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  {/* Dynamic columns from file */}
                  {fileColumns.map((col, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider w-24">
                    {locale === 'tr' ? 'İşlemler' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={`hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${
                      selectedRecords.includes(record.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecords.includes(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    {/* Dynamic column values - editable on double click */}
                    {fileColumns.map((col, i) => {
                      const isEditing = editingCell?.recordId === record.id && editingCell?.columnName === col.name;
                      return (
                        <td key={i} className="px-2 py-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => saveInlineEdit(record, col.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineEdit(record, col.name);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                              className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                            />
                          ) : (
                            <div
                              onDoubleClick={() => startEditing(record, col.name)}
                              className="px-2 py-1 text-neutral-700 dark:text-neutral-300 max-w-[200px] truncate cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                              title={locale === 'tr' ? 'Düzenlemek için çift tıkla' : 'Double-click to edit'}
                            >
                              {getRecordValue(record, col.name)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Actions - only delete */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRecord(record.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={locale === 'tr' ? 'Sil' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {recordsPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                {selectedRecords.length > 0 ? (
                  <span className="font-medium text-primary-600">
                    {selectedRecords.length} {locale === 'tr' ? 'seçili' : 'selected'} -
                  </span>
                ) : null}
                {' '}{locale === 'tr'
                  ? `Toplam ${recordsPagination.total} kayıt`
                  : `Total ${recordsPagination.total} records`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recordsPagination.page <= 1}
                  onClick={() => goToPage(recordsPagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {recordsPagination.page} / {recordsPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recordsPagination.page >= recordsPagination.totalPages}
                  onClick={() => goToPage(recordsPagination.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Record Modal - Dynamic based on file columns */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {locale === 'tr' ? 'Manuel Kayıt Ekle' : 'Add Record Manually'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'tr' ? 'Yeni bir kayıt oluşturun' : 'Create a new record'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dynamic fields based on file columns */}
            <div className="grid grid-cols-2 gap-4">
              {fileColumns.map((col, index) => {
                // Determine if this is a required field (phone or name)
                const phoneColNames = ['telefon', 'telefon no', 'tel', 'phone', 'numara', 'gsm', 'cep'];
                const nameColNames = ['müşteri adı', 'işletme/müşteri adı', 'firma', 'isim', 'ad soyad', 'isim soyisim', 'şirket', 'company', 'name'];
                const colNameLower = col.name.toLowerCase();
                const isPhoneField = phoneColNames.some(p => colNameLower.includes(p));
                const isNameField = nameColNames.some(n => colNameLower.includes(n));
                const isRequired = isPhoneField || isNameField;

                return (
                  <div key={col.name || index}>
                    <Label>
                      {col.name}
                      {isRequired && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Input
                      value={addFormData[col.name] || ''}
                      onChange={(e) => setAddFormData({ ...addFormData, [col.name]: e.target.value })}
                      placeholder={col.name}
                    />
                  </div>
                );
              })}
            </div>

            {/* If no columns, show fallback fields */}
            {fileColumns.length === 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{locale === 'tr' ? 'Müşteri Adı' : 'Customer Name'} *</Label>
                  <Input
                    value={addFormData.companyName || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, companyName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{locale === 'tr' ? 'Telefon' : 'Phone'} *</Label>
                  <Input
                    value={addFormData.phone || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    placeholder="5XX XXX XX XX"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {locale === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button onClick={handleAddRecord} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {locale === 'tr' ? 'Ekle' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {locale === 'tr' ? 'Kayıtları Sil' : 'Delete Records'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'tr'
                ? `${selectedRecords.length} kayıt silinecek. Bu işlem geri alınamaz.`
                : `${selectedRecords.length} records will be deleted. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
              {locale === 'tr' ? 'İptal' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {locale === 'tr' ? 'Sil' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

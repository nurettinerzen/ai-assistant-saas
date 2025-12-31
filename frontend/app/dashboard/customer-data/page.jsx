'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [uploadStep, setUploadStep] = useState(1); // 1: Select file, 2: Preview, 3: Result

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
  const handleDownloadTemplate = async () => {
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
      setUploadStep(2);
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
      setUploadStep(3);
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

  if (loading && customerData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {locale === 'tr' ? 'Müşteri Verileri' : 'Customer Data'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {locale === 'tr'
              ? 'AI asistan tarafından kullanılan müşteri bilgilerini yönetin'
              : 'Manage customer information used by AI assistant'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            {locale === 'tr' ? 'Şablon İndir' : 'Download Template'}
          </Button>
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {locale === 'tr' ? 'Excel Yükle' : 'Upload Excel'}
          </Button>
          <Button onClick={() => openCreateModal()}>
            <Plus className="w-4 h-4 mr-2" />
            {locale === 'tr' ? 'Yeni Müşteri' : 'New Customer'}
          </Button>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={locale === 'tr' ? 'İsim, telefon, VKN ile ara...' : 'Search by name, phone, VKN...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
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
      {customerData.length === 0 ? (
        <EmptyState
          icon={Users}
          title={locale === 'tr' ? 'Henüz müşteri verisi yok' : 'No customer data yet'}
          description={locale === 'tr'
            ? 'Excel dosyası yükleyerek veya manuel olarak müşteri ekleyebilirsiniz'
            : 'Upload an Excel file or add customers manually'}
          action={{
            label: locale === 'tr' ? 'Excel Yükle' : 'Upload Excel',
            onClick: () => setShowUploadModal(true)
          }}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === customerData.length && customerData.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'İşletme / Müşteri' : 'Company / Customer'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'Telefon' : 'Phone'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'SGK Borcu' : 'SSI Debt'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'Vergi Borcu' : 'Tax Debt'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'Son Güncelleme' : 'Last Updated'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {locale === 'tr' ? 'İşlemler' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customerData.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {customer.companyName}
                        </p>
                        {customer.contactName && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {customer.contactName}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {formatMoney(customer.customFields?.sgkDebt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {formatMoney(customer.customFields?.taxDebt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
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

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(open) => !open && resetUploadModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {locale === 'tr' ? 'Excel / CSV Yükle' : 'Upload Excel / CSV'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'tr'
                ? 'Müşteri verilerini toplu olarak yükleyin'
                : 'Bulk upload customer data'}
            </DialogDescription>
          </DialogHeader>

          {uploadStep === 1 && (
            <div className="py-8">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400" />
                )}
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                  {locale === 'tr'
                    ? 'Dosya seçmek için tıklayın veya sürükleyip bırakın'
                    : 'Click to select or drag and drop'}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  .xlsx, .xls, .csv
                </p>
              </div>
            </div>
          )}

          {uploadStep === 2 && uploadPreview && (
            <div>
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-green-700 dark:text-green-300">
                  {locale === 'tr'
                    ? `${uploadPreview.totalRows} satır bulundu`
                    : `${uploadPreview.totalRows} rows found`}
                </span>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg" style={{ maxWidth: '100%' }}>
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {uploadPreview.columns.slice(0, 6).map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 truncate max-w-[120px]" title={col}>
                          {col}
                        </th>
                      ))}
                      {uploadPreview.columns.length > 6 && (
                        <th className="px-3 py-2 text-left font-medium text-gray-400">
                          +{uploadPreview.columns.length - 6}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {uploadPreview.preview.map((row, i) => (
                      <tr key={i}>
                        {uploadPreview.columns.slice(0, 6).map((col, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={String(row[col] || '')}>
                            {String(row[col] || '').substring(0, 20)}
                          </td>
                        ))}
                        {uploadPreview.columns.length > 6 && (
                          <td className="px-3 py-2 text-gray-400">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setUploadStep(1)}>
                  {locale === 'tr' ? 'Geri' : 'Back'}
                </Button>
                <Button onClick={handleImport} disabled={uploading}>
                  {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {locale === 'tr' ? 'İçe Aktar' : 'Import'}
                </Button>
              </div>
            </div>
          )}

          {uploadStep === 3 && importResult && (
            <div className="py-4">
              <div className="space-y-3">
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

              <div className="flex justify-end mt-4">
                <Button onClick={resetUploadModal}>
                  {locale === 'tr' ? 'Kapat' : 'Close'}
                </Button>
              </div>
            </div>
          )}
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
              />
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Telefon *' : 'Phone *'}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="5321234567"
              />
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Yetkili Kişi' : 'Contact Person'}</Label>
              <Input
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Ahmet Yılmaz"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@sirket.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>VKN</Label>
                <Input
                  value={formData.vkn}
                  onChange={(e) => setFormData({ ...formData, vkn: e.target.value })}
                  placeholder="1234567890"
                />
              </div>
              <div>
                <Label>TC No</Label>
                <Input
                  value={formData.tcNo}
                  onChange={(e) => setFormData({ ...formData, tcNo: e.target.value })}
                  placeholder="12345678901"
                />
              </div>
            </div>

            <div>
              <Label>{locale === 'tr' ? 'Notlar' : 'Notes'}</Label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                    <p className="text-gray-500 dark:text-gray-400">{locale === 'tr' ? 'Yetkili' : 'Contact'}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{currentCustomer.contactName}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{locale === 'tr' ? 'Telefon' : 'Phone'}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{currentCustomer.phone}</p>
                </div>
                {currentCustomer.email && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{currentCustomer.email}</p>
                  </div>
                )}
                {currentCustomer.vkn && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">VKN</p>
                    <p className="font-medium text-gray-900 dark:text-white">{currentCustomer.vkn}</p>
                  </div>
                )}
              </div>

              {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      {locale === 'tr' ? 'Mali Bilgiler' : 'Financial Information'}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {currentCustomer.customFields.sgkDebt !== undefined && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">{locale === 'tr' ? 'SGK Borcu' : 'SSI Debt'}</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatMoney(currentCustomer.customFields.sgkDebt)}
                          </p>
                          {currentCustomer.customFields.sgkDueDate && (
                            <p className="text-xs text-gray-400">
                              {locale === 'tr' ? 'Vade' : 'Due'}: {formatDateDisplay(currentCustomer.customFields.sgkDueDate, locale)}
                            </p>
                          )}
                        </div>
                      )}
                      {currentCustomer.customFields.taxDebt !== undefined && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">{locale === 'tr' ? 'Vergi Borcu' : 'Tax Debt'}</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatMoney(currentCustomer.customFields.taxDebt)}
                          </p>
                          {currentCustomer.customFields.taxDueDate && (
                            <p className="text-xs text-gray-400">
                              {locale === 'tr' ? 'Vade' : 'Due'}: {formatDateDisplay(currentCustomer.customFields.taxDueDate, locale)}
                            </p>
                          )}
                        </div>
                      )}
                      {currentCustomer.customFields.declarationType && (
                        <div className="col-span-2">
                          <p className="text-gray-500 dark:text-gray-400">{locale === 'tr' ? 'Beyanname' : 'Declaration'}</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {currentCustomer.customFields.declarationType}
                            {currentCustomer.customFields.declarationPeriod && ` - ${currentCustomer.customFields.declarationPeriod}`}
                          </p>
                          {currentCustomer.customFields.declarationDueDate && (
                            <p className="text-xs text-gray-400">
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
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{locale === 'tr' ? 'Notlar' : 'Notes'}</p>
                    <p className="text-gray-900 dark:text-white mt-1">{currentCustomer.notes}</p>
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

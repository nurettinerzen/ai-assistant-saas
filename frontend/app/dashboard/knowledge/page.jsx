/**
 * Knowledge Base Page - Retell.ai inspired
 * Manage documents, FAQs, and URLs for AI training
 * UPDATE FILE: frontend/app/dashboard/knowledge/page.jsx
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { Upload, FileText, MessageSquare, Link as LinkIcon, Plus, Trash2, Eye, Loader2, X, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import { formatDate, formatFileSize } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

function KnowledgeBaseContent() {
  const { t, locale } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get active tab from URL or default to 'documents'
  // CRITICAL: Initialize directly from URL param to prevent flash on refresh
  const urlTab = searchParams.get('tab');
  const validTabs = ['documents', 'faqs', 'urls'];
  const initialTab = validTabs.includes(urlTab) ? urlTab : 'documents';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync activeTab with URL when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const currentUrlTab = searchParams.get('tab');
    if (currentUrlTab && validTabs.includes(currentUrlTab) && currentUrlTab !== activeTab) {
      setActiveTab(currentUrlTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [documents, setDocuments] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  
  // Form states
  const [docName, setDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '' });
  const [urlForm, setUrlForm] = useState({ url: '', crawlDepth: 1, autoScan: true, scanInterval: 24 });

  // Content viewer modal states
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentModalData, setContentModalData] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsRes, faqsRes, urlsRes] = await Promise.all([
        apiClient.knowledge.getDocuments(),
        apiClient.knowledge.getFaqs(),
        apiClient.knowledge.getUrls(),
      ]);
      // Map backend fields to frontend expected fields
      const mappedDocs = (docsRes.data.documents || []).map(doc => ({
        ...doc,
        name: doc.title || doc.name || '',
        size: doc.fileSize || doc.size || 0,
        uploadedAt: doc.createdAt || doc.uploadedAt
      }));
      setDocuments(mappedDocs);
      setFaqs(faqsRes.data.faqs || []);
      setUrls(urlsRes.data.urls || []);
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSaveDocument = async () => {
    if (!docName) {
      toast.error(t('dashboard.knowledgeBasePage.enterKnowledgeBaseName'));
      return;
    }

    if (!selectedFile) {
      toast.error(t('dashboard.knowledgeBasePage.selectFileToUpload'));
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', docName);

    setUploadingFile(true);
    const uploadToast = toast.loading(t('dashboard.knowledgeBasePage.uploadingText'));

    try {
      const response = await apiClient.knowledge.uploadDocument(formData);

      const newDoc = {
        id: response.data.document?.id || Date.now(),
        name: docName,
        type: selectedFile.name.split('.').pop().toUpperCase(),
        size: selectedFile.size,
        status: 'ready',
        uploadedAt: new Date().toISOString()
      };

      setDocuments([newDoc, ...documents]);

      toast.success(t('dashboard.knowledgeBasePage.documentUploadedSuccess'), { id: uploadToast });
      setShowDocModal(false);
      setDocName('');
      setSelectedFile(null);
    } catch (error) {
      toast.error(error.response?.data?.error || t('dashboard.knowledgeBasePage.uploadFailed'), { id: uploadToast });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      const deleteToast = toast.loading(t('dashboard.knowledgeBasePage.deletingText'));
      await apiClient.knowledge.deleteDocument(id);
      setDocuments(documents.filter(doc => doc.id !== id));
      toast.success(t('dashboard.knowledgeBasePage.documentDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.failedToDeleteDocument'));
    }
  };

  const handleCreateFaq = async () => {
    if (!faqForm.question || !faqForm.answer) {
      toast.error(t('dashboard.knowledgeBasePage.fillQuestionAnswer'));
      return;
    }

    try {
      const createToast = toast.loading(t('dashboard.knowledgeBasePage.creatingFaq'));
      const response = await apiClient.knowledge.createFaq(faqForm);

      const newFaq = {
        id: response.data.faq?.id || Date.now(),
        ...faqForm,
        createdAt: new Date().toISOString()
      };

      setFaqs([newFaq, ...faqs]);
      toast.success(t('dashboard.knowledgeBasePage.faqCreated'), { id: createToast });
      setShowFaqModal(false);
      setFaqForm({ question: '', answer: '', category: '' });
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.failedToCreateFaq'));
    }
  };

  const handleDeleteFaq = async (id) => {
    try {
      const deleteToast = toast.loading(t('dashboard.knowledgeBasePage.deletingText'));
      await apiClient.knowledge.deleteFaq(id);
      setFaqs(faqs.filter(faq => faq.id !== id));
      toast.success(t('dashboard.knowledgeBasePage.faqDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.failedToDeleteFaq'));
    }
  };

  const handleAddUrl = async () => {
    if (!urlForm.url) {
      toast.error(t('dashboard.knowledgeBasePage.enterUrl'));
      return;
    }

    try {
      const addToast = toast.loading(t('dashboard.knowledgeBasePage.addingUrl'));
      const response = await apiClient.knowledge.addUrl(urlForm);

      const newUrl = {
        id: response.data.url?.id || Date.now(),
        url: urlForm.url,
        crawlDepth: urlForm.crawlDepth,
        status: 'crawling',
        pageCount: 0,
        lastCrawled: null,
        createdAt: new Date().toISOString()
      };

      setUrls([newUrl, ...urls]);
      toast.success(t('dashboard.knowledgeBasePage.urlAddedCrawling'), { id: addToast });
      setShowUrlModal(false);
      setUrlForm({ url: '', crawlDepth: 1 });
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.failedToAddUrl'));
    }
  };

  const handleDeleteUrl = async (id) => {
    try {
      const deleteToast = toast.loading(t('dashboard.knowledgeBasePage.deletingText'));
      await apiClient.knowledge.deleteUrl(id);
      setUrls(urls.filter(url => url.id !== id));
      toast.success(t('dashboard.knowledgeBasePage.urlDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('dashboard.knowledgeBasePage.failedToDeleteUrl'));
    }
  };

  // Rescan URL - yeniden tara
  const handleRescanUrl = async (id) => {
    try {
      const rescanToast = toast.loading(locale === 'tr' ? 'URL yeniden taranıyor...' : 'Rescanning URL...');

      // Update local state to show processing
      setUrls(urls.map(url => url.id === id ? { ...url, status: 'PROCESSING' } : url));

      await apiClient.post(`/api/knowledge/urls/${id}/rescan`);
      toast.success(locale === 'tr' ? 'Yeniden tarama başlatıldı' : 'Rescan started', { id: rescanToast });

      // Reload URLs after a delay to get updated content
      setTimeout(() => loadData(), 5000);
    } catch (error) {
      toast.error(locale === 'tr' ? 'Yeniden tarama başarısız' : 'Failed to rescan URL');
      // Reload to get correct status
      loadData();
    }
  };

  // Toggle autoScan for URL
  const handleToggleAutoScan = async (id, currentValue) => {
    try {
      const newValue = !currentValue;
      // Update local state optimistically
      setUrls(urls.map(url => url.id === id ? { ...url, autoScan: newValue } : url));

      await apiClient.put(`/api/knowledge/urls/${id}`, { autoScan: newValue });
      toast.success(
        newValue
          ? (locale === 'tr' ? 'Otomatik tarama aktif' : 'Auto-scan enabled')
          : (locale === 'tr' ? 'Otomatik tarama kapalı' : 'Auto-scan disabled')
      );
    } catch (error) {
      // Revert on error
      setUrls(urls.map(url => url.id === id ? { ...url, autoScan: currentValue } : url));
      toast.error(locale === 'tr' ? 'Güncelleme başarısız' : 'Failed to update');
    }
  };

  // View document content
  const handleViewDocument = async (doc) => {
    setLoadingContent(true);
    setShowContentModal(true);
    setContentModalData({ type: 'document', title: doc.name || doc.title, content: null });

    try {
      const response = await apiClient.knowledge.getDocument(doc.id);
      setContentModalData({
        type: 'document',
        title: response.data.document?.title || doc.name,
        content: response.data.document?.content || t('dashboard.knowledgeBasePage.noContent')
      });
    } catch (error) {
      setContentModalData({
        type: 'document',
        title: doc.name || doc.title,
        content: t('dashboard.knowledgeBasePage.failedToLoadContent')
      });
    } finally {
      setLoadingContent(false);
    }
  };

  // View URL content
  const handleViewUrl = async (urlItem) => {
    setLoadingContent(true);
    setShowContentModal(true);
    setContentModalData({ type: 'url', title: urlItem.url, content: null });

    try {
      const response = await apiClient.knowledge.getUrl(urlItem.id);
      setContentModalData({
        type: 'url',
        title: response.data.url?.title || urlItem.url,
        content: response.data.url?.content || t('dashboard.knowledgeBasePage.noContent')
      });
    } catch (error) {
      setContentModalData({
        type: 'url',
        title: urlItem.url,
        content: t('dashboard.knowledgeBasePage.failedToLoadContent')
      });
    } finally {
      setLoadingContent(false);
    }
  };

  // Skeleton loader for initial loading state
  const KnowledgeBaseSkeleton = () => (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-9 w-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        <div className="h-5 w-96 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mt-2" />
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-4 pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
              <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Show skeleton while loading initial data
  if (loading) {
    return <KnowledgeBaseSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.knowledgeBasePage.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.knowledgeBasePage.description')}</p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          router.replace(`/dashboard/knowledge?tab=${value}`, { scroll: false });
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="documents">{t('dashboard.knowledgeBasePage.documentsTab')} ({documents.length})</TabsTrigger>
          <TabsTrigger value="faqs">{t('dashboard.knowledgeBasePage.faqsTab')} ({faqs.length})</TabsTrigger>
          <TabsTrigger value="urls">{t('dashboard.knowledgeBasePage.urlsTab')} ({urls.length})</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {can('knowledge:edit') && (
          <div className="flex justify-end items-center">
            <Button onClick={() => setShowDocModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.knowledgeBasePage.addDocument')}
            </Button>
          </div>
          )}

          {documents.length > 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.nameTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.typeTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.sizeTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.statusTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.errorReasonHeader') || 'Hata Nedeni'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.uploadedTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.actionsTableHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className="flex items-center gap-2 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                          <span className="text-sm font-medium text-neutral-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">{doc.name}</span>
                          <Eye className="h-3 w-3 text-neutral-400 dark:text-neutral-500 opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{doc.type}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{formatFileSize(doc.size)}</td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            doc.status === 'ACTIVE' || doc.status === 'ready'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : doc.status === 'PROCESSING' || doc.status === 'processing'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }
                        >
                          {t((doc.status === 'ACTIVE' || doc.status === 'ready') ? 'dashboard.knowledgeBasePage.ready' : (doc.status === 'PROCESSING' || doc.status === 'processing') ? 'dashboard.knowledgeBasePage.processing' : 'dashboard.knowledgeBasePage.failed')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {doc.status === 'FAILED' && doc.content?.startsWith('Error:') ? (
                          <span className="text-red-600 dark:text-red-400 text-xs">{doc.content.replace('Error: ', '')}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(doc.uploadedAt, 'short')}
                      </td>
                      <td className="px-6 py-4">
                        {can('knowledge:delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12">
              <EmptyState
                icon={FileText}
                title={t('dashboard.knowledgeBasePage.noDocumentsTitle')}
                description={t('dashboard.knowledgeBasePage.uploadDocumentsDesc')}
              />
            </div>
          )}
        </TabsContent>

        {/* FAQs Tab */}
        <TabsContent value="faqs" className="space-y-4">
          {can('knowledge:edit') && (
          <div className="flex justify-end">
            <Button onClick={() => setShowFaqModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.knowledgeBasePage.addFaqBtn')}
            </Button>
          </div>
          )}

          {faqs.length > 0 ? (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{faq.question}</h3>
                    {can('knowledge:delete') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFaq(faq.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{faq.answer}</p>
                  {faq.category && (
                    <Badge variant="secondary" className="text-xs">{faq.category}</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12">
              <EmptyState
                icon={MessageSquare}
                title={t('dashboard.knowledgeBasePage.noFaqsTitle')}
                description={t('dashboard.knowledgeBasePage.addFaqsDesc')}
              />
            </div>
          )}
        </TabsContent>

        {/* URLs Tab */}
        <TabsContent value="urls" className="space-y-4">
          {can('knowledge:edit') && (
          <div className="flex justify-end">
            <Button onClick={() => setShowUrlModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.knowledgeBasePage.addUrlBtn')}
            </Button>
          </div>
          )}

          {urls.length > 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.urlTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.statusTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.errorReasonHeader') || 'Hata Nedeni'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.pagesTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.lastCrawledHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{locale === 'tr' ? 'Otomatik Tarama' : 'Auto Scan'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{t('dashboard.knowledgeBasePage.actionsTableHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {urls.map((url) => (
                    <tr key={url.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                          <button
                            onClick={() => handleViewUrl(url)}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:underline text-left"
                          >
                            {url.url}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            url.status === 'ACTIVE' || url.status === 'ready'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : url.status === 'PROCESSING' || url.status === 'crawling'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }
                        >
                        {t((url.status === 'ACTIVE' || url.status === 'ready') ? 'dashboard.knowledgeBasePage.ready' : (url.status === 'PROCESSING' || url.status === 'crawling') ? 'dashboard.knowledgeBasePage.crawling' : 'dashboard.knowledgeBasePage.failed')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {url.status === 'FAILED' && url.content?.startsWith('Error:') ? (
                          <span className="text-red-600 dark:text-red-400 text-xs">{url.content.replace('Error: ', '')}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{url.pageCount}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {url.lastCrawled ? formatDate(url.lastCrawled, 'short') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleAutoScan(url.id, url.autoScan)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            url.autoScan
                              ? 'bg-green-500'
                              : 'bg-neutral-300 dark:bg-neutral-600'
                          }`}
                          title={url.autoScan
                            ? (locale === 'tr' ? `Her ${url.scanInterval || 24} saatte bir taranır` : `Scans every ${url.scanInterval || 24} hours`)
                            : (locale === 'tr' ? 'Otomatik tarama kapalı' : 'Auto-scan disabled')
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              url.autoScan ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRescanUrl(url.id)}
                            disabled={url.status === 'PROCESSING'}
                            title={locale === 'tr' ? 'Yeniden tara' : 'Rescan'}
                          >
                            <RefreshCw className={`h-4 w-4 text-blue-600 ${url.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                          </Button>
                          {can('knowledge:delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUrl(url.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12">
              <EmptyState
                icon={LinkIcon}
                title={t('dashboard.knowledgeBasePage.noUrlsTitle')}
                description={t('dashboard.knowledgeBasePage.addUrlsDesc')}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Upload Modal */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.knowledgeBasePage.addKnowledgeBase')}</DialogTitle>
            <DialogDescription>{t('dashboard.knowledgeBasePage.uploadDocumentsLabel')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-name">{t('dashboard.knowledgeBasePage.knowledgeBaseName')}</Label>
              <Input
                id="doc-name"
                placeholder={t('dashboard.knowledgeBasePage.knowledgeBaseNamePlaceholder')}
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>

            <div>
              <Label>{t('dashboard.knowledgeBasePage.documentsLabel')}</Label>
              <div className="mt-2 border-2 border-dashed border-neutral-200 rounded-lg p-8 text-center hover:border-primary-300 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.csv"
                  className="hidden"
                  id="file-input"
                  onChange={handleFileSelect}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                  {selectedFile ? (
                    <>
                      <p className="text-sm text-neutral-900 font-medium mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatFileSize(selectedFile.size)} • {t('dashboard.knowledgeBasePage.clickToChange')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-600 mb-1">
                        {t('dashboard.knowledgeBasePage.clickToUpload')}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {t('dashboard.knowledgeBasePage.pdfDocxTxtCsv')}
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowDocModal(false);
                setDocName('');
                setSelectedFile(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveDocument}
              disabled={uploadingFile}
            >
              {uploadingFile ? t('dashboard.knowledgeBasePage.uploadingText') : t('dashboard.knowledgeBasePage.saveBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ Modal */}
      <Dialog open={showFaqModal} onOpenChange={setShowFaqModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.knowledgeBasePage.addFaqTitle')}</DialogTitle>
            <DialogDescription>{t('dashboard.knowledgeBasePage.createFaqDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="question">{t('dashboard.knowledgeBasePage.questionRequired')}</Label>
              <Input
                id="question"
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder={t('dashboard.knowledgeBasePage.questionPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="answer">{t('dashboard.knowledgeBasePage.answerRequired')}</Label>
              <Textarea
                id="answer"
                rows={4}
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder={t('dashboard.knowledgeBasePage.answerPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="category">{t('dashboard.knowledgeBasePage.categoryOptional')}</Label>
              <Input
                id="category"
                value={faqForm.category}
                onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                placeholder={t('dashboard.knowledgeBasePage.categoryPlaceholder')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowFaqModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateFaq}>{t('dashboard.knowledgeBasePage.createFaqBtn')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Modal */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.knowledgeBasePage.addUrlTitle')}</DialogTitle>
            <DialogDescription>{t('dashboard.knowledgeBasePage.crawlWebsiteDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">{t('dashboard.knowledgeBasePage.websiteUrlRequired')}</Label>
              <Input
                id="url"
                type="url"
                value={urlForm.url}
                onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
                placeholder={t('dashboard.knowledgeBasePage.websiteUrlPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="depth">{t('dashboard.knowledgeBasePage.crawlDepthLabel')}</Label>
              <Input
                id="depth"
                type="number"
                min="1"
                max="10"
                value={urlForm.crawlDepth}
                onChange={(e) => setUrlForm({ ...urlForm, crawlDepth: parseInt(e.target.value) })}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {t('dashboard.knowledgeBasePage.crawlDepthDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUrlForm({ ...urlForm, autoScan: !urlForm.autoScan })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  urlForm.autoScan
                    ? 'bg-green-500'
                    : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    urlForm.autoScan ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label className="cursor-pointer" onClick={() => setUrlForm({ ...urlForm, autoScan: !urlForm.autoScan })}>
                {locale === 'tr' ? 'Otomatik Tarama' : 'Auto Scan'}
              </Label>
              {urlForm.autoScan && (
                <div className="flex items-center gap-2 ml-4">
                  <Label htmlFor="scanInterval" className="text-xs whitespace-nowrap">
                    {locale === 'tr' ? 'Her' : 'Every'}
                  </Label>
                  <Input
                    id="scanInterval"
                    type="number"
                    min="1"
                    max="168"
                    className="w-16 h-8"
                    value={urlForm.scanInterval}
                    onChange={(e) => setUrlForm({ ...urlForm, scanInterval: parseInt(e.target.value) || 24 })}
                  />
                  <span className="text-xs text-neutral-500">
                    {locale === 'tr' ? 'saatte bir' : 'hours'}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              {locale === 'tr'
                ? 'Otomatik tarama açıkken, URL belirlenen aralıklarla otomatik olarak yeniden taranır ve içerik güncellenir.'
                : 'When auto-scan is enabled, the URL will be automatically re-scanned at the specified interval.'}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowUrlModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddUrl}>{t('dashboard.knowledgeBasePage.addUrlSubmit')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content Viewer Modal */}
      <Dialog open={showContentModal} onOpenChange={setShowContentModal}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {contentModalData?.type === 'document' ? (
                <FileText className="h-5 w-5 text-primary-600" />
              ) : (
                <LinkIcon className="h-5 w-5 text-primary-600" />
              )}
              {contentModalData?.title || t('dashboard.knowledgeBasePage.contentViewer')}
            </DialogTitle>
            <DialogDescription>
              {contentModalData?.type === 'document'
                ? t('dashboard.knowledgeBasePage.documentContentDesc')
                : t('dashboard.knowledgeBasePage.urlContentDesc')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] mt-4">
            {loadingContent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300 font-mono">
                  {(() => {
                    const content = contentModalData?.content || t('dashboard.knowledgeBasePage.noContent');
                    const lines = content.split('\n');
                    const MAX_LINES = 50;
                    if (lines.length > MAX_LINES) {
                      return lines.slice(0, MAX_LINES).join('\n') + '\n\n... ' + (lines.length - MAX_LINES) + ' satır daha (toplam ' + lines.length + ' satır)';
                    }
                    return content;
                  })()}
                </pre>
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowContentModal(false)}>
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className="h-64 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
      </div>
    }>
      <KnowledgeBaseContent />
    </Suspense>
  );
}

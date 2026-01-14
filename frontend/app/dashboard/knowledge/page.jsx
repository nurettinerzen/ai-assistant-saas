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
import { Upload, FileText, MessageSquare, Link as LinkIcon, Plus, Trash2, Eye, Loader2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import { formatDate, formatFileSize } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

function KnowledgeBaseContent() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get active tab from URL or default to 'documents'
  const activeTab = searchParams.get('tab') || 'documents';

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
  const [urlForm, setUrlForm] = useState({ url: '', crawlDepth: 1 });

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
          router.push(`/dashboard/knowledge?tab=${value}`, { scroll: false });
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
                        {can('knowledge:delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUrl(url.id)}
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
                  {contentModalData?.content || t('dashboard.knowledgeBasePage.noContent')}
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

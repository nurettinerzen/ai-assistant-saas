/**
 * Knowledge Base Page - Retell.ai inspired
 * Manage documents, FAQs, and URLs for AI training
 * UPDATE FILE: frontend/app/dashboard/knowledge/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
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
import { Upload, FileText, MessageSquare, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import { formatDate, formatFileSize } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function KnowledgeBasePage() {
  const { t } = useLanguage();
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
      setDocuments(docsRes.data.documents || []);
      setFaqs(faqsRes.data.faqs || []);
      setUrls(urlsRes.data.urls || []);
    } catch (error) {
      toast.error(t('saveError'));
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
      toast.error(t('enterKnowledgeBaseName'));
      return;
    }

    if (!selectedFile) {
      toast.error(t('selectFileToUpload'));
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', docName);

    setUploadingFile(true);
    const uploadToast = toast.loading(t('uploadingText'));
    
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
      
      toast.success(t('documentUploadedSuccess'), { id: uploadToast });
      setShowDocModal(false);
      setDocName('');
      setSelectedFile(null);
    } catch (error) {
      toast.error(error.response?.data?.error || t('uploadFailed'), { id: uploadToast });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      const deleteToast = toast.loading(t('deletingText'));
      await apiClient.knowledge.deleteDocument(id);
      setDocuments(documents.filter(doc => doc.id !== id));
      toast.success(t('documentDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('failedToDeleteDocument'));
    }
  };

  const handleCreateFaq = async () => {
    if (!faqForm.question || !faqForm.answer) {
      toast.error(t('fillQuestionAnswer'));
      return;
    }
    
    try {
      const createToast = toast.loading(t('creatingFaq'));
      const response = await apiClient.knowledge.createFaq(faqForm);
      
      const newFaq = {
        id: response.data.faq?.id || Date.now(),
        ...faqForm,
        createdAt: new Date().toISOString()
      };
      
      setFaqs([newFaq, ...faqs]);
      toast.success(t('faqCreated'), { id: createToast });
      setShowFaqModal(false);
      setFaqForm({ question: '', answer: '', category: '' });
    } catch (error) {
      toast.error(t('failedToCreateFaq'));
    }
  };

  const handleDeleteFaq = async (id) => {
    try {
      const deleteToast = toast.loading(t('deletingText'));
      await apiClient.knowledge.deleteFaq(id);
      setFaqs(faqs.filter(faq => faq.id !== id));
      toast.success(t('faqDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('failedToDeleteFaq'));
    }
  };

  const handleAddUrl = async () => {
    if (!urlForm.url) {
      toast.error(t('enterUrl'));
      return;
    }
    
    try {
      const addToast = toast.loading(t('addingUrl'));
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
      toast.success(t('urlAddedCrawling'), { id: addToast });
      setShowUrlModal(false);
      setUrlForm({ url: '', crawlDepth: 1 });
    } catch (error) {
      toast.error(t('failedToAddUrl'));
    }
  };

  const handleDeleteUrl = async (id) => {
    try {
      const deleteToast = toast.loading(t('deletingText'));
      await apiClient.knowledge.deleteUrl(id);
      setUrls(urls.filter(url => url.id !== id));
      toast.success(t('urlDeleted'), { id: deleteToast });
    } catch (error) {
      toast.error(t('failedToDeleteUrl'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('knowledgeBaseTitle')}</h1>
        <p className="text-neutral-600 mt-1">{t('trainWithDocuments')}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="documents">{t('documentsTab')} ({documents.length})</TabsTrigger>
          <TabsTrigger value="faqs">{t('faqsTab')} ({faqs.length})</TabsTrigger>
          <TabsTrigger value="urls">{t('urlsTab')} ({urls.length})</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end items-center">
            <Button onClick={() => setShowDocModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addDocument')}
            </Button>
          </div>

          {documents.length > 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('nameTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('typeTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('sizeTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('statusTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('uploadedTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('actionsTableHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-neutral-400" />
                          <span className="text-sm font-medium text-neutral-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{doc.type}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{formatFileSize(doc.size)}</td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            doc.status === 'ready'
                              ? 'bg-green-100 text-green-800'
                              : doc.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {t(doc.status === 'ready' ? 'ready' : doc.status === 'processing' ? 'processing2' : 'failed', locale)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {formatDate(doc.uploadedAt, 'short')}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-12">
              <EmptyState
                icon={FileText}
                title={t('noDocumentsTitle')}
                description={t('uploadDocumentsDesc')}
              />
            </div>
          )}
        </TabsContent>

        {/* FAQs Tab */}
        <TabsContent value="faqs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowFaqModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addFaqBtn')}
            </Button>
          </div>

          {faqs.length > 0 ? (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-neutral-900">{faq.question}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFaq(faq.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                  <p className="text-sm text-neutral-600 mb-2">{faq.answer}</p>
                  {faq.category && (
                    <Badge variant="secondary" className="text-xs">{faq.category}</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-12">
              <EmptyState
                icon={MessageSquare}
                title={t('noFaqsTitle')}
                description={t('addFaqsDesc')}
              />
            </div>
          )}
        </TabsContent>

        {/* URLs Tab */}
        <TabsContent value="urls" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowUrlModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addUrlBtn')}
            </Button>
          </div>

          {urls.length > 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('urlTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('statusTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('pagesTableHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('lastCrawledHeader')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{t('actionsTableHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {urls.map((url) => (
                    <tr key={url.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-neutral-400" />
                          <a
                            href={url.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            {url.url}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            url.status === 'ready'
                              ? 'bg-green-100 text-green-800'
                              : url.status === 'crawling'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {t(url.status === 'ready' ? 'ready' : url.status === 'crawling' ? 'crawling2' : 'failed', locale)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{url.pageCount}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {url.lastCrawled ? formatDate(url.lastCrawled, 'short') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUrl(url.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-12">
              <EmptyState
                icon={LinkIcon}
                title={t('noUrlsTitle')}
                description={t('addUrlsDesc')}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Upload Modal */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addKnowledgeBase')}</DialogTitle>
            <DialogDescription>{t('uploadDocumentsLabel')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-name">{t('knowledgeBaseName')}</Label>
              <Input
                id="doc-name"
                placeholder={t('knowledgeBaseNamePlaceholder')}
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>
            
            <div>
              <Label>{t('documentsLabel')}</Label>
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
                        {formatFileSize(selectedFile.size)} • {t('clickToChange')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-600 mb-1">
                        {t('clickToUpload')}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {t('pdfDocxTxtCsv')}
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
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleSaveDocument} 
              disabled={uploadingFile}
            >
              {uploadingFile ? t('uploadingText') : t('saveBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ Modal */}
      <Dialog open={showFaqModal} onOpenChange={setShowFaqModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addFaqTitle')}</DialogTitle>
            <DialogDescription>{t('createFaqDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="question">{t('questionRequired')}</Label>
              <Input
                id="question"
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder={t('questionPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="answer">{t('answerRequired')}</Label>
              <Textarea
                id="answer"
                rows={4}
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder={t('answerPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="category">{t('categoryOptional')}</Label>
              <Input
                id="category"
                value={faqForm.category}
                onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                placeholder={t('categoryPlaceholder')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowFaqModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateFaq}>{t('createFaqBtn')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Modal */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addUrlTitle')}</DialogTitle>
            <DialogDescription>{t('crawlWebsiteDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">{t('websiteUrlRequired')}</Label>
              <Input
                id="url"
                type="url"
                value={urlForm.url}
                onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
                placeholder={t('websiteUrlPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="depth">{t('crawlDepthLabel')}</Label>
              <Input
                id="depth"
                type="number"
                min="1"
                max="5"
                value={urlForm.crawlDepth}
                onChange={(e) => setUrlForm({ ...urlForm, crawlDepth: parseInt(e.target.value) })}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {t('crawlDepthDesc')}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowUrlModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAddUrl}>{t('addUrlSubmit')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}

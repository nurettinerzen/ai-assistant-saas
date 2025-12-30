/**
 * Email Inbox Dashboard
 * View threads, manage drafts, and send AI-assisted responses
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Inbox,
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  MessageSquare,
  Pencil,
  RotateCcw,
  X,
  ChevronRight,
  AlertCircle,
  Trash2,
  ExternalLink,
  Ban
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

// Status badge colors - labels will use translation
const STATUS_COLORS = {
  PENDING_REPLY: { bg: 'bg-yellow-100', text: 'text-yellow-800', key: 'awaitingReply' },
  DRAFT_READY: { bg: 'bg-blue-100', text: 'text-blue-800', key: 'draftReady' },
  REPLIED: { bg: 'bg-green-100', text: 'text-green-800', key: 'replied' },
  CLOSED: { bg: 'bg-neutral-100', text: 'text-neutral-800', key: 'closed' },
  NO_REPLY_NEEDED: { bg: 'bg-purple-100', text: 'text-purple-800', key: 'noReplyNeeded' }
};

export default function EmailDashboardPage() {
  const { t } = useLanguage();

  // State
  const [emailStatus, setEmailStatus] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null); // null = all, or specific status

  // Draft editor state
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Load email status
  const loadEmailStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/email/status');
      setEmailStatus(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to load email status:', error);
      return null;
    }
  }, []);

  // Load threads
  const loadThreads = useCallback(async (status = null) => {
    try {
      const params = status ? { status } : {};
      const response = await apiClient.get('/api/email/threads', { params });
      setThreads(response.data.threads || []);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/email/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Load thread details
  const loadThreadDetails = useCallback(async (threadId) => {
    try {
      const response = await apiClient.get(`/api/email/threads/${threadId}`);
      setSelectedThread(response.data);

      // Set draft content if available
      if (response.data.drafts && response.data.drafts.length > 0) {
        const activeDraft = response.data.drafts.find(d => d.status === 'PENDING_REVIEW');
        if (activeDraft) {
          setEditedContent(activeDraft.editedContent || activeDraft.generatedContent);
        }
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      toast.error(t('dashboard.emailPage.failedToLoadThread'));
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      const status = await loadEmailStatus();
      if (status?.connected) {
        await Promise.all([loadThreads(), loadStats()]);
      }
      setLoading(false);
    }
    init();
  }, [loadEmailStatus, loadThreads, loadStats]);

  // Sync emails
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await apiClient.post('/api/email/sync');
      toast.success(response.data.message || t('dashboard.emailPage.emailsSyncedSuccess'));
      await Promise.all([loadThreads(), loadStats()]);
      if (selectedThread) {
        await loadThreadDetails(selectedThread.id);
      }
    } catch (error) {
      toast.error(t('dashboard.emailPage.failedToSyncEmails'));
    } finally {
      setSyncing(false);
    }
  };

  // Send draft
  const handleSendDraft = async () => {
    if (!selectedThread || !selectedThread.drafts?.length) return;

    const activeDraft = selectedThread.drafts.find(d => d.status === 'PENDING_REVIEW');
    if (!activeDraft) return;

    // Update draft content if edited
    if (editedContent !== activeDraft.generatedContent) {
      await apiClient.put(`/api/email/drafts/${activeDraft.id}`, {
        content: editedContent
      });
    }

    setSending(true);
    try {
      await apiClient.post(`/api/email/drafts/${activeDraft.id}/send`);
      toast.success(t('dashboard.emailPage.emailSentSuccess'));
      await Promise.all([loadThreads(), loadStats()]);
      await loadThreadDetails(selectedThread.id);
      setIsEditing(false);
    } catch (error) {
      toast.error(t('dashboard.emailPage.failedToSendEmail'));
    } finally {
      setSending(false);
    }
  };

  // Regenerate draft
  const handleRegenerateDraft = async (feedback = null) => {
    if (!selectedThread || !selectedThread.drafts?.length) return;

    const activeDraft = selectedThread.drafts.find(d => d.status === 'PENDING_REVIEW');
    if (!activeDraft) return;

    setRegenerating(true);
    try {
      await apiClient.post(`/api/email/drafts/${activeDraft.id}/regenerate`, { feedback });
      toast.success(t('dashboard.emailPage.draftRegenerated'));
      await loadThreadDetails(selectedThread.id);
    } catch (error) {
      toast.error(t('dashboard.emailPage.failedToRegenerateDraft'));
    } finally {
      setRegenerating(false);
    }
  };

  // Close thread
  const handleCloseThread = async () => {
    if (!selectedThread) return;

    try {
      await apiClient.post(`/api/email/threads/${selectedThread.id}/close`);
      toast.success(t('dashboard.emailPage.threadClosed'));
      await loadThreads();
      setSelectedThread(null);
    } catch (error) {
      toast.error(t('dashboard.emailPage.failedToCloseThread'));
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  // Get active draft
  const getActiveDraft = () => {
    if (!selectedThread?.drafts) return null;
    return selectedThread.drafts.find(d => d.status === 'PENDING_REVIEW');
  };

  // Not connected state
  if (!loading && !emailStatus?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.emailPage.title')}</h1>
          <p className="text-neutral-600 mt-1">
            {t('dashboard.emailPage.description')}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            {t('dashboard.emailPage.connectYourEmail')}
          </h2>
          <p className="text-neutral-600 mb-6 max-w-md mx-auto">
            {t('dashboard.emailPage.connectEmailDesc')}
          </p>
          <Button onClick={() => window.location.href = '/dashboard/integrations'}>
            {t('dashboard.emailPage.goToIntegrations')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.emailPage.title')}</h1>
          <p className="text-neutral-600 mt-1">
            {emailStatus?.email && (
              <span className="text-sm">
                {t('dashboard.emailPage.connected')}: <span className="font-medium">{emailStatus.email}</span>
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? t('dashboard.emailPage.syncing') : t('dashboard.emailPage.syncEmails')}
        </Button>
      </div>

      {/* Stats - Clickable for filtering */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'PENDING_REPLY' ? null : 'PENDING_REPLY');
              loadThreads(statusFilter === 'PENDING_REPLY' ? null : 'PENDING_REPLY');
            }}
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === 'PENDING_REPLY' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.pendingCount}</p>
                <p className="text-sm text-neutral-600">{t('dashboard.emailPage.pendingReply')}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'DRAFT_READY' ? null : 'DRAFT_READY');
              loadThreads(statusFilter === 'DRAFT_READY' ? null : 'DRAFT_READY');
            }}
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === 'DRAFT_READY' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Pencil className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.draftReadyCount}</p>
                <p className="text-sm text-neutral-600">{t('dashboard.emailPage.draftsReady')}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'NO_REPLY_NEEDED' ? null : 'NO_REPLY_NEEDED');
              loadThreads(statusFilter === 'NO_REPLY_NEEDED' ? null : 'NO_REPLY_NEEDED');
            }}
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === 'NO_REPLY_NEEDED' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Ban className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.noReplyNeededCount || 0}</p>
                <p className="text-sm text-neutral-600">{t('dashboard.emailPage.noReplyNeeded')}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'REPLIED' ? null : 'REPLIED');
              loadThreads(statusFilter === 'REPLIED' ? null : 'REPLIED');
            }}
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === 'REPLIED' ? 'border-green-500 ring-2 ring-green-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.repliedTodayCount}</p>
                <p className="text-sm text-neutral-600">{t('dashboard.emailPage.repliedToday')}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setStatusFilter(null);
              loadThreads(null);
            }}
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === null ? 'border-neutral-500 ring-2 ring-neutral-200' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <Inbox className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.totalThreads}</p>
                <p className="text-sm text-neutral-600">{t('dashboard.emailPage.totalThreads')}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">{t('dashboard.emailPage.conversations')}</h2>
          </div>
          <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-6 w-6 mx-auto text-neutral-400 animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <Mail className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
                <p>{t('dashboard.emailPage.noConversations')}</p>
                <p className="text-sm mt-1">{t('dashboard.emailPage.syncToGetStarted')}</p>
              </div>
            ) : (
              threads.map((thread) => {
                const statusStyle = STATUS_COLORS[thread.status] || STATUS_COLORS.PENDING_REPLY;
                const isSelected = selectedThread?.id === thread.id;
                const hasDraft = thread.drafts?.some(d => d.status === 'PENDING_REVIEW');

                return (
                  <button
                    key={thread.id}
                    onClick={() => loadThreadDetails(thread.id)}
                    className={`w-full text-left p-4 hover:bg-neutral-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-900 truncate">
                          {thread.customerName || thread.customerEmail}
                        </p>
                        <p className="text-sm text-neutral-600 truncate mt-0.5">
                          {thread.subject}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`${statusStyle.bg} ${statusStyle.text} text-xs`}>
                            {t(`dashboard.emailPage.status.${statusStyle.key}`)}
                          </Badge>
                          {hasDraft && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              {t('dashboard.emailPage.aiDraft')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-neutral-500">
                          {formatDate(thread.lastMessageAt)}
                        </p>
                        <ChevronRight className="h-4 w-4 text-neutral-400 mt-2 ml-auto" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread Detail & Draft Editor */}
        <div className="lg:col-span-2 space-y-4">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">
                      {selectedThread.subject}
                    </h2>
                    <p className="text-sm text-neutral-600 mt-1">
                      {t('dashboard.emailPage.from')}: {selectedThread.customerName || selectedThread.customerEmail}
                      {selectedThread.customerName && (
                        <span className="text-neutral-400"> &lt;{selectedThread.customerEmail}&gt;</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseThread}
                    disabled={selectedThread.status === 'CLOSED'}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('common.close')}
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4 max-h-[300px] overflow-y-auto">
                <h3 className="font-medium text-neutral-900 mb-4">{t('dashboard.emailPage.conversation')}</h3>
                <div className="space-y-4">
                  {selectedThread.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.direction === 'INBOUND'
                          ? 'bg-neutral-100 mr-8'
                          : 'bg-blue-50 ml-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {message.direction === 'INBOUND' ? (
                            <span className="text-neutral-700">
                              {message.fromName || message.fromEmail}
                            </span>
                          ) : (
                            <span className="text-blue-700">{t('dashboard.emailPage.you')}</span>
                          )}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDate(message.receivedAt || message.sentAt || message.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                        {message.bodyText?.substring(0, 500)}
                        {message.bodyText?.length > 500 && '...'}
                      </p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((att, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {att.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Draft Editor */}
              {getActiveDraft() && selectedThread.status !== 'CLOSED' && (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-neutral-900 flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-blue-600" />
                      {t('dashboard.emailPage.aiDraftResponse')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateDraft()}
                        disabled={regenerating}
                      >
                        <RotateCcw className={`h-4 w-4 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
                        {t('dashboard.emailPage.regenerate')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {isEditing ? t('common.preview') : t('common.edit')}
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                      placeholder={t('dashboard.emailPage.editResponsePlaceholder')}
                    />
                  ) : (
                    <div className="bg-neutral-50 rounded-lg p-4 min-h-[200px] text-sm whitespace-pre-wrap">
                      {editedContent}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200">
                    <p className="text-xs text-neutral-500">
                      {t('dashboard.emailPage.reviewBeforeSending')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const draft = getActiveDraft();
                          if (draft) {
                            setEditedContent(draft.generatedContent);
                            setIsEditing(false);
                          }
                        }}
                      >
                        {t('common.reset')}
                      </Button>
                      <Button onClick={handleSendDraft} disabled={sending}>
                        <Send className={`h-4 w-4 mr-2 ${sending ? 'animate-pulse' : ''}`} />
                        {sending ? t('dashboard.emailPage.sending') : t('dashboard.emailPage.sendEmail')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* No draft available */}
              {!getActiveDraft() && selectedThread.status === 'PENDING_REPLY' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-900">{t('dashboard.emailPage.noDraftAvailable')}</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t('dashboard.emailPage.syncToGenerateDraft')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Thread closed */}
              {selectedThread.status === 'CLOSED' && (
                <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-neutral-600">{t('dashboard.emailPage.conversationClosed')}</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                {t('dashboard.emailPage.selectConversation')}
              </h3>
              <p className="text-neutral-600">
                {t('dashboard.emailPage.selectConversationDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

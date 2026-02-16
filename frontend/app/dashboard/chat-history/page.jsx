/**
 * Chat History Page
 * View chat and WhatsApp conversation history
 */

'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/EmptyState';
import { GradientLoaderInline } from '@/components/GradientLoader';
import {
  MessageSquare,
  Search,
  Download,
  Filter,
  MessageCircle,
  Eye,
  User,
  Bot,
  Hash
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// Simple cache for chats data
const chatsCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  isValid() {
    return this.data && this.timestamp && (Date.now() - this.timestamp < this.CACHE_DURATION);
  },

  set(data) {
    this.data = data;
    this.timestamp = Date.now();
  },

  get() {
    return this.data;
  },

  clear() {
    this.data = null;
    this.timestamp = null;
  }
};

// Generate page numbers with ellipsis for pagination
function generatePageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}

function ChatsPageContent() {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [selectedChat, setSelectedChat] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Initial load with cache
  useEffect(() => {
    const loadInitial = async () => {
      // Check cache first
      if (chatsCache.isValid()) {
        setChats(chatsCache.get());
        setLoading(false);
        setIsInitialLoad(false);
        // Background refresh
        refreshChats(true);
        return;
      }

      // No cache, load fresh
      await loadChats();
      setIsInitialLoad(false);
    };

    loadInitial();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      loadChats();
    }
  }, [pagination.page, channelFilter, statusFilter, dateRange]);

  // Debounced search
  useEffect(() => {
    if (isInitialLoad) return;

    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadChats();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Real-time polling for new chats (every 30 seconds)
  useEffect(() => {
    if (isInitialLoad) return;

    const pollInterval = setInterval(() => {
      // Only poll if page is visible and no filters active
      if (document.visibilityState === 'visible' && statusFilter === 'all' && channelFilter === 'all' && !searchQuery && !dateRange.from) {
        refreshChats(true); // Silent refresh
      }
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [isInitialLoad, statusFilter, channelFilter, searchQuery, dateRange]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      // All filters sent to backend (server-side filtering)
      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter !== 'all') params.channel = channelFilter;
      if (searchQuery) params.search = searchQuery;
      if (dateRange.from) params.startDate = dateRange.from.toISOString();
      if (dateRange.to) params.endDate = dateRange.to.toISOString();

      const response = await apiClient.get('/api/chat-logs', { params });
      const chatLogs = response.data.chatLogs || [];

      setChats(chatLogs);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0
      }));

      // Only cache if no filters active
      if (statusFilter === 'all' && channelFilter === 'all' && !searchQuery && !dateRange.from) {
        chatsCache.set(chatLogs);
      }
    } catch (error) {
      toast.error(t('dashboard.chatHistoryPage.failedToLoadChats'));
    } finally {
      setLoading(false);
    }
  };

  const refreshChats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.get('/api/chat-logs', { params: { page: 1, limit: 20 } });
      const chatLogs = response.data.chatLogs || [];
      setChats(chatLogs);
      chatsCache.set(chatLogs);
    } catch (error) {
      if (!silent) toast.error(t('dashboard.chatHistoryPage.failedToLoadChats'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleViewChat = useCallback(async (chatId) => {
    try {
      const response = await apiClient.get(`/api/chat-logs/${chatId}`);
      setSelectedChat(response.data);
      setShowChatModal(true);
    } catch (error) {
      toast.error(t('dashboard.chatHistoryPage.failedToLoadChat'));
    }
  }, [t]);

  // Auto-open chat detail when navigated with ?chatId=xxx (e.g. from callbacks page)
  useEffect(() => {
    const chatId = searchParams.get('chatId');
    if (chatId) {
      handleViewChat(chatId);
    }
  }, [searchParams, handleViewChat]);

  const handleExport = async () => {
    try {
      // Simple CSV export
      const csvContent = [
        [t('dashboard.chatHistoryPage.csvDate'), t('dashboard.chatHistoryPage.csvChannel'), t('dashboard.chatHistoryPage.csvMessageCount'), t('dashboard.chatHistoryPage.csvStatus')].join(','),
        ...chats.map(chat => [
          new Date(chat.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US'),
          chat.channel === 'CHAT' ? t('dashboard.chatHistoryPage.csvChat') : 'WhatsApp',
          chat.messageCount,
          chat.status === 'active' ? t('dashboard.chatHistoryPage.csvActive') : (chat.status === 'completed' || chat.status === 'ended') ? t('dashboard.chatHistoryPage.csvCompleted') : chat.status
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `chat-history-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('dashboard.chatHistoryPage.exportedSuccess'));
    } catch (error) {
      toast.error(t('dashboard.chatHistoryPage.exportFailed'));
    }
  };

  // Channel badge
  const getChannelBadge = (channel) => {
    if (channel === 'WHATSAPP') {
      return (
        <Badge variant="ghost" className="text-green-700 dark:text-green-400 text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          WhatsApp
        </Badge>
      );
    }
    return (
      <Badge variant="ghost" className="text-blue-700 dark:text-blue-400 text-xs">
        <MessageCircle className="h-3 w-3 mr-1" />
        {t('dashboard.chatHistoryPage.chat')}
      </Badge>
    );
  };

  // Status indicator
  const getStatusIndicator = (status) => {
    const statusConfig = {
      active: { color: 'bg-blue-500', label: t('dashboard.chatHistoryPage.active') },
      completed: { color: 'bg-green-500', label: t('dashboard.chatHistoryPage.completed') },
      ended: { color: 'bg-green-500', label: t('dashboard.chatHistoryPage.ended') },
    };

    const config = statusConfig[status] || { color: 'bg-gray-400', label: t('dashboard.chatHistoryPage.unknown') };

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
      </div>
    );
  };

  // Format date
  const formatChatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && isInitialLoad) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              {t('dashboard.chatHistoryPage.title')}
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {t('dashboard.chatHistoryPage.description')}
            </p>
          </div>
        </div>
        <GradientLoaderInline text={t('dashboard.chatHistoryPage.loadingChats')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('dashboard.chatHistoryPage.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('dashboard.chatHistoryPage.description')}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('dashboard.chatHistoryPage.exportCsv')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('dashboard.chatHistoryPage.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={(val) => { setChannelFilter(val); setPagination(prev => ({ ...prev, page: 1 })); }}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.chatHistoryPage.allChannels')}</SelectItem>
            <SelectItem value="CHAT">Chat</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPagination(prev => ({ ...prev, page: 1 })); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.chatHistoryPage.allStatus')}</SelectItem>
            <SelectItem value="active">{t('dashboard.chatHistoryPage.active')}</SelectItem>
            <SelectItem value="completed">{t('dashboard.chatHistoryPage.completed')}</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={(range) => {
            setDateRange(range || { from: undefined, to: undefined });
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          locale={locale}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : chats.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.chatHistoryPage.date')}</TableHead>
                <TableHead>{t('dashboard.chatHistoryPage.channel')}</TableHead>
                <TableHead>{t('dashboard.chatHistoryPage.messages')}</TableHead>
                <TableHead>{t('dashboard.chatHistoryPage.status')}</TableHead>
                <TableHead className="text-right">{t('dashboard.chatHistoryPage.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chats.map((chat) => (
                <TableRow key={chat.id}>
                  <TableCell>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatChatDate(chat.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getChannelBadge(chat.channel)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                      <Hash className="h-3 w-3 text-gray-400" />
                      {chat.messageCount || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusIndicator(chat.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewChat(chat.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              <span className="text-sm text-gray-500">
                {t('dashboard.chatHistoryPage.showingResults')
                  .replace('{start}', (pagination.page - 1) * pagination.limit + 1)
                  .replace('{end}', Math.min(pagination.page * pagination.limit, pagination.total))
                  .replace('{total}', pagination.total)
                }
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  {t('dashboard.chatHistoryPage.previous')}
                </Button>
                {generatePageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 text-sm text-gray-400">...</span>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                    >
                      {pageNum}
                    </Button>
                  )
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  {t('dashboard.chatHistoryPage.next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-8">
          <EmptyState
            icon={MessageCircle}
            title={searchQuery || channelFilter !== 'all' || statusFilter !== 'all' || dateRange.from
              ? t('dashboard.chatHistoryPage.noChatsFound')
              : t('dashboard.chatHistoryPage.noChatsYet')}
            description={searchQuery || channelFilter !== 'all' || statusFilter !== 'all' || dateRange.from
              ? t('dashboard.chatHistoryPage.tryAdjustingFilters')
              : t('dashboard.chatHistoryPage.chatsWillAppear')}
          />
        </div>
      )}

      {/* Chat Detail Modal */}
      <Dialog open={showChatModal} onOpenChange={setShowChatModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedChat?.channel === 'WHATSAPP' ? (
                <MessageSquare className="h-5 w-5 text-green-600" />
              ) : (
                <MessageCircle className="h-5 w-5 text-blue-600" />
              )}
              {t('dashboard.chatHistoryPage.chatDetails')}
            </DialogTitle>
          </DialogHeader>

          {selectedChat && (
            <div className="space-y-4">
              {/* Chat Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">{t('dashboard.chatHistoryPage.channel')}</span>
                  <p className="font-medium">{selectedChat.channel === 'CHAT' ? t('dashboard.chatHistoryPage.chat') : 'WhatsApp'}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('dashboard.chatHistoryPage.date')}</span>
                  <p className="font-medium">{formatChatDate(selectedChat.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('dashboard.chatHistoryPage.assistant')}</span>
                  <p className="font-medium">{selectedChat.assistant?.name || '-'}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {t('dashboard.chatHistoryPage.messages')} ({selectedChat.messageCount || 0})
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedChat.messages && Array.isArray(selectedChat.messages) ? (
                    selectedChat.messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'bg-gray-50 dark:bg-gray-800'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'
                        }`}>
                          {msg.role === 'user' ? (
                            <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Bot className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {msg.content}
                          </p>
                          {msg.timestamp && (
                            <span className="text-xs text-gray-400 mt-1 block">
                              {new Date(msg.timestamp).toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">
                      {t('dashboard.chatHistoryPage.noMessagesFound')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className="h-64 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
      </div>
    }>
      <ChatsPageContent />
    </Suspense>
  );
}

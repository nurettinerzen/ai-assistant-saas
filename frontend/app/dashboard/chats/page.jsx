/**
 * Chat History Page
 * View chat and WhatsApp conversation history with token usage
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  Coins,
  Eye,
  User,
  Bot,
  Calendar,
  Hash
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ChatsPage() {
  const { t, locale } = useLanguage();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedChat, setSelectedChat] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  useEffect(() => {
    loadChats();
  }, [pagination.page, channelFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadChats();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await apiClient.get('/api/chat-logs', { params });
      let chatLogs = response.data.chatLogs || [];

      // Apply channel filter (frontend for now)
      if (channelFilter !== 'all') {
        chatLogs = chatLogs.filter(chat => chat.channel === channelFilter);
      }

      // Apply search filter (frontend for now)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        chatLogs = chatLogs.filter(chat =>
          chat.sessionId?.toLowerCase().includes(query) ||
          chat.customerPhone?.toLowerCase().includes(query) ||
          chat.customerIp?.toLowerCase().includes(query)
        );
      }

      setChats(chatLogs);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0
      }));
    } catch (error) {
      toast.error(locale === 'tr' ? 'Sohbetler yüklenemedi' : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChat = async (chatId) => {
    try {
      const response = await apiClient.get(`/api/chat-logs/${chatId}`);
      setSelectedChat(response.data);
      setShowChatModal(true);
    } catch (error) {
      toast.error(locale === 'tr' ? 'Sohbet yüklenemedi' : 'Failed to load chat');
    }
  };

  const handleExport = async () => {
    try {
      // Simple CSV export
      const csvContent = [
        ['Tarih', 'Kanal', 'Mesaj Sayısı', 'Input Token', 'Output Token', 'Maliyet (TL)', 'Durum'].join(','),
        ...chats.map(chat => [
          new Date(chat.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US'),
          chat.channel,
          chat.messageCount,
          chat.inputTokens || 0,
          chat.outputTokens || 0,
          (chat.totalCost || 0).toFixed(4),
          chat.status
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
      toast.success(locale === 'tr' ? 'Sohbetler dışa aktarıldı' : 'Chats exported successfully');
    } catch (error) {
      toast.error(locale === 'tr' ? 'Dışa aktarma başarısız' : 'Failed to export chats');
    }
  };

  // Channel badge
  const getChannelBadge = (channel) => {
    if (channel === 'WHATSAPP') {
      return (
        <Badge className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          WhatsApp
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs">
        <MessageCircle className="h-3 w-3 mr-1" />
        Chat
      </Badge>
    );
  };

  // Status indicator
  const getStatusIndicator = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-500', label: locale === 'tr' ? 'Aktif' : 'Active' },
      completed: { color: 'bg-gray-400', label: locale === 'tr' ? 'Tamamlandı' : 'Completed' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-400', label: status };

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

  // Format token count
  const formatTokens = (tokens) => {
    if (!tokens) return '-';
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  if (loading && chats.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {locale === 'tr' ? 'Sohbet Geçmişi' : 'Chat History'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'tr' ? 'Chat ve WhatsApp konuşmalarınızı görüntüleyin' : 'View your Chat and WhatsApp conversations'}
            </p>
          </div>
        </div>
        <GradientLoaderInline text={locale === 'tr' ? 'Sohbetler yükleniyor...' : 'Loading chats...'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {locale === 'tr' ? 'Sohbet Geçmişi' : 'Chat History'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locale === 'tr' ? 'Chat ve WhatsApp konuşmalarınızı görüntüleyin' : 'View your Chat and WhatsApp conversations'}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {locale === 'tr' ? 'CSV İndir' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={locale === 'tr' ? 'Session ID veya telefon ile ara...' : 'Search by session ID or phone...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === 'tr' ? 'Tüm Kanallar' : 'All Channels'}</SelectItem>
            <SelectItem value="CHAT">Chat</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === 'tr' ? 'Tüm Durumlar' : 'All Status'}</SelectItem>
            <SelectItem value="active">{locale === 'tr' ? 'Aktif' : 'Active'}</SelectItem>
            <SelectItem value="completed">{locale === 'tr' ? 'Tamamlandı' : 'Completed'}</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead>{locale === 'tr' ? 'Tarih' : 'Date'}</TableHead>
                <TableHead>{locale === 'tr' ? 'Kanal' : 'Channel'}</TableHead>
                <TableHead>{locale === 'tr' ? 'Mesaj' : 'Messages'}</TableHead>
                <TableHead>Input Token</TableHead>
                <TableHead>Output Token</TableHead>
                <TableHead>{locale === 'tr' ? 'Maliyet' : 'Cost'}</TableHead>
                <TableHead>{locale === 'tr' ? 'Durum' : 'Status'}</TableHead>
                <TableHead className="text-right">{locale === 'tr' ? 'İşlem' : 'Actions'}</TableHead>
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTokens(chat.inputTokens)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTokens(chat.outputTokens)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {chat.totalCost > 0 ? (
                      <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <Coins className="h-3 w-3 text-warning-500" />
                        {chat.totalCost.toFixed(4)} ₺
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
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
                {locale === 'tr'
                  ? `${pagination.total} sonuçtan ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} gösteriliyor`
                  : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} results`
                }
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  {locale === 'tr' ? 'Önceki' : 'Previous'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  {locale === 'tr' ? 'Sonraki' : 'Next'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-8">
          <EmptyState
            icon={MessageCircle}
            title={searchQuery || channelFilter !== 'all' || statusFilter !== 'all'
              ? (locale === 'tr' ? 'Sohbet bulunamadı' : 'No chats found')
              : (locale === 'tr' ? 'Henüz sohbet yok' : 'No chats yet')}
            description={searchQuery || channelFilter !== 'all' || statusFilter !== 'all'
              ? (locale === 'tr' ? 'Filtreleri değiştirmeyi deneyin' : 'Try adjusting your filters')
              : (locale === 'tr' ? 'Müşterileriniz chat veya WhatsApp ile iletişime geçtiğinde burada görünecek' : 'Chats will appear here when customers contact you via Chat or WhatsApp')}
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
              {locale === 'tr' ? 'Sohbet Detayı' : 'Chat Details'}
            </DialogTitle>
          </DialogHeader>

          {selectedChat && (
            <div className="space-y-4">
              {/* Chat Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">{locale === 'tr' ? 'Kanal' : 'Channel'}</span>
                  <p className="font-medium">{selectedChat.channel}</p>
                </div>
                <div>
                  <span className="text-gray-500">{locale === 'tr' ? 'Tarih' : 'Date'}</span>
                  <p className="font-medium">{formatChatDate(selectedChat.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Input Token</span>
                  <p className="font-medium">{formatTokens(selectedChat.inputTokens)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Output Token</span>
                  <p className="font-medium">{formatTokens(selectedChat.outputTokens)}</p>
                </div>
                <div>
                  <span className="text-gray-500">{locale === 'tr' ? 'Maliyet' : 'Cost'}</span>
                  <p className="font-medium">{selectedChat.totalCost?.toFixed(4) || '0'} ₺</p>
                </div>
                <div>
                  <span className="text-gray-500">{locale === 'tr' ? 'Asistan' : 'Assistant'}</span>
                  <p className="font-medium">{selectedChat.assistant?.name || '-'}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {locale === 'tr' ? 'Mesajlar' : 'Messages'} ({selectedChat.messageCount || 0})
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
                      {locale === 'tr' ? 'Mesaj bulunamadı' : 'No messages found'}
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

/**
 * Calls Page
 * Call history with Retell-style table design
 * Clean, minimal layout with status indicators
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import TranscriptModal from '@/components/TranscriptModal';
import EmptyState from '@/components/EmptyState';
import { GradientLoaderInline } from '@/components/GradientLoader';
import { Phone, Search, Download, Filter, FileText, Volume2, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatDuration, formatPhone } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { NAVIGATION_ITEMS } from '@/lib/navigationConfig';

// Simple cache for calls data
const callsCache = {
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

export default function CallsPage() {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [endReasonFilter, setEndReasonFilter] = useState('all');
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Handle callId from URL query params
  useEffect(() => {
    const callIdFromUrl = searchParams.get('callId');
    if (callIdFromUrl) {
      setSelectedCallId(parseInt(callIdFromUrl, 10));
      setShowTranscriptModal(true);
    }
  }, [searchParams]);

  // Initial load with cache
  useEffect(() => {
    const loadInitial = async () => {
      // Check cache first
      if (callsCache.isValid()) {
        setCalls(callsCache.get());
        setLoading(false);
        setIsInitialLoad(false);
        // Background refresh
        refreshCalls(true);
        return;
      }

      // No cache, load fresh
      await loadCalls();
      setIsInitialLoad(false);
    };

    loadInitial();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      loadCalls();
    }
  }, [statusFilter, directionFilter, endReasonFilter]);

  // Debounced search
  useEffect(() => {
    if (isInitialLoad) return;

    const timer = setTimeout(() => {
      loadCalls();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Real-time polling for new calls (every 10 seconds)
  useEffect(() => {
    if (isInitialLoad) return;

    const pollInterval = setInterval(() => {
      // Only poll if page is visible and no filters active
      if (document.visibilityState === 'visible' && statusFilter === 'all' && !searchQuery) {
        refreshCalls(true); // Silent refresh
      }
    }, 10000); // 10 seconds - faster updates for new calls

    return () => clearInterval(pollInterval);
  }, [isInitialLoad, statusFilter, searchQuery]);

  const loadCalls = async () => {
    setLoading(true);
    try {
      // Sync conversations from 11Labs (runs in background, doesn't block)
      apiClient.elevenlabs.syncConversations().catch(err => {
        console.warn('Sync failed:', err.message);
      });

      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      if (directionFilter !== 'all') params.direction = directionFilter;
      if (endReasonFilter !== 'all') params.endReason = endReasonFilter;

      const response = await apiClient.calls.getAll(params);
      let callsData = response.data.calls || [];

      // Filter out chat and whatsapp - only show phone calls
      // Chat logs have IDs starting with "chat-" or have channel/type set to chat/whatsapp
      callsData = callsData.filter(call => {
        // Exclude chat logs (ID starts with "chat-")
        if (call.id && typeof call.id === 'string' && call.id.startsWith('chat-')) {
          return false;
        }

        // Exclude if channel or type is chat/whatsapp
        const channel = call.channel?.toLowerCase();
        const type = call.type?.toLowerCase();
        if (channel === 'chat' || channel === 'whatsapp' || type === 'chat' || type === 'whatsapp') {
          return false;
        }

        // Include everything else (phone calls)
        return true;
      });

      // Client-side filtering for direction (if backend doesn't filter)
      if (directionFilter !== 'all') {
        callsData = callsData.filter(call => {
          if (directionFilter === 'outbound') {
            return call.direction?.startsWith('outbound');
          }
          return call.direction === directionFilter || (!call.direction && directionFilter === 'inbound');
        });
      }

      // Client-side filtering for end reason (if backend doesn't filter)
      if (endReasonFilter !== 'all') {
        callsData = callsData.filter(call => call.endReason === endReasonFilter);
      }

      setCalls(callsData);

      // Only cache if no filters
      if (statusFilter === 'all' && !searchQuery && directionFilter === 'all' && endReasonFilter === 'all') {
        callsCache.set(callsData);
      }
    } catch (error) {
      toast.error(t('dashboard.callsPage.failedToLoadCalls'));
    } finally {
      setLoading(false);
    }
  };

  const refreshCalls = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.calls.getAll({});
      let callsData = response.data.calls || [];

      // Filter out chat and whatsapp - only show phone calls
      callsData = callsData.filter(call => {
        // Exclude chat logs (ID starts with "chat-")
        if (call.id && typeof call.id === 'string' && call.id.startsWith('chat-')) {
          return false;
        }

        // Exclude if channel or type is chat/whatsapp
        const channel = call.channel?.toLowerCase();
        const type = call.type?.toLowerCase();
        if (channel === 'chat' || channel === 'whatsapp' || type === 'chat' || type === 'whatsapp') {
          return false;
        }

        // Include everything else (phone calls)
        return true;
      });

      setCalls(callsData);
      callsCache.set(callsData);
    } catch (error) {
      if (!silent) toast.error(t('dashboard.callsPage.failedToLoadCalls'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.calls.export('csv');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `calls-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('dashboard.callsPage.callsExportedSuccess'));
    } catch (error) {
      toast.error(t('dashboard.callsPage.failedToExportCalls'));
    }
  };

  const handleViewTranscript = (callId) => {
    setSelectedCallId(callId);
    setShowTranscriptModal(true);
  };

  // Direction badge (inbound/outbound)
  const getDirectionBadge = (call) => {
    const isOutbound = call.direction === 'outbound';
    if (isOutbound) {
      return (
        <Badge variant="ghost" className="text-orange-700 dark:text-orange-400 text-xs">
          <PhoneOutgoing className="h-3 w-3 mr-1" />
          {locale === 'tr' ? 'Giden' : 'Outbound'}
        </Badge>
      );
    }
    return (
      <Badge variant="ghost" className="text-emerald-700 dark:text-emerald-400 text-xs">
        <PhoneIncoming className="h-3 w-3 mr-1" />
        {locale === 'tr' ? 'Gelen' : 'Inbound'}
      </Badge>
    );
  };

  // End reason badge
  const getEndReasonBadge = (endReason) => {
    if (!endReason) return <span className="text-sm text-gray-400">-</span>;

    const reasonConfig = {
      client_ended: { label: locale === 'tr' ? 'Müşteri kapattı' : 'Customer ended', color: 'text-blue-700 dark:text-blue-400' },
      agent_ended: { label: locale === 'tr' ? 'Asistan kapattı' : 'Agent ended', color: 'text-teal-700 dark:text-teal-400' },
      system_timeout: { label: locale === 'tr' ? 'Zaman aşımı' : 'Timeout', color: 'text-yellow-700 dark:text-yellow-400' },
      error: { label: locale === 'tr' ? 'Hata' : 'Error', color: 'text-red-700 dark:text-red-400' },
      completed: { label: locale === 'tr' ? 'Tamamlandı' : 'Completed', color: 'text-green-700 dark:text-green-400' },
    };

    const config = reasonConfig[endReason] || { label: endReason, color: 'text-gray-700 dark:text-gray-400' };

    return (
      <Badge variant="ghost" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  // Status indicator
  const getStatusIndicator = (status) => {
    const statusConfig = {
      completed: { color: 'bg-success-500', label: t('dashboard.callsPage.completed') || 'Tamamlandı' },
      answered: { color: 'bg-success-500', label: t('dashboard.callsPage.answered') || 'Yanıtlandı' },
      failed: { color: 'bg-error-500', label: t('dashboard.callsPage.failed') || 'Başarısız' },
      'in-progress': { color: 'bg-info-500', label: t('dashboard.callsPage.inProgress') || 'Devam Ediyor' },
      in_progress: { color: 'bg-info-500', label: t('dashboard.callsPage.inProgress') || 'Devam Ediyor' },
      queued: { color: 'bg-warning-500', label: t('dashboard.callsPage.queued') || 'Sırada' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-400', label: status };

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
      </div>
    );
  };

  // Format date in Turkish style
  const formatCallDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show gradient loader on initial load only
  if (loading && isInitialLoad) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              {locale === 'tr' ? NAVIGATION_ITEMS.callHistory.labelTr : NAVIGATION_ITEMS.callHistory.labelEn}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('dashboard.callsPage.description')}
            </p>
          </div>
        </div>
        <GradientLoaderInline text={t('dashboard.callsPage.loadingCalls') || 'Arama geçmişi yükleniyor...'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('dashboard.callsPage.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('dashboard.callsPage.description')}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('dashboard.callsPage.exportCSV')}
        </Button>
      </div>


      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('dashboard.callsPage.searchByPhone')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.callsPage.allStatus')}</SelectItem>
            <SelectItem value="answered">{t('dashboard.callsPage.answered')}</SelectItem>
            <SelectItem value="failed">{t('dashboard.callsPage.failed')}</SelectItem>
            <SelectItem value="in_progress">{t('dashboard.callsPage.inProgress')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.callsPage.allDirections')}</SelectItem>
            <SelectItem value="inbound">{t('dashboard.callsPage.inbound')}</SelectItem>
            <SelectItem value="outbound">{t('dashboard.callsPage.outbound')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={endReasonFilter} onValueChange={setEndReasonFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.callsPage.allEndReasons')}</SelectItem>
            <SelectItem value="client_ended">{t('dashboard.callsPage.clientEnded')}</SelectItem>
            <SelectItem value="agent_ended">{t('dashboard.callsPage.agentEnded')}</SelectItem>
            <SelectItem value="system_timeout">{t('dashboard.callsPage.systemTimeout')}</SelectItem>
            <SelectItem value="error">{t('dashboard.callsPage.error')}</SelectItem>
            <SelectItem value="completed">{t('dashboard.callsPage.completed')}</SelectItem>
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
      ) : calls.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.callsPage.dateTime')}</TableHead>
                <TableHead>{t('dashboard.callsPage.duration')}</TableHead>
                <TableHead>{t('dashboard.callsPage.direction')}</TableHead>
                <TableHead>{t('dashboard.callsPage.status')}</TableHead>
                <TableHead>{t('dashboard.callsPage.endReason')}</TableHead>
                <TableHead>{t('dashboard.callsPage.phoneNumber')}</TableHead>
                <TableHead className="text-right">{t('dashboard.callsPage.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatCallDate(call.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDuration(call.duration)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getDirectionBadge(call)}
                  </TableCell>
                  <TableCell>
                    {getStatusIndicator(call.status)}
                  </TableCell>
                  <TableCell>
                    {getEndReasonBadge(call.endReason)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatPhone(call.phoneNumber || call.callerId) || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {call.hasRecording && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTranscript(call.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      )}
                      {call.hasTranscript && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTranscript(call.id)}
                          className="h-8 w-8 p-0"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      {!call.hasRecording && !call.hasTranscript && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-8">
          <EmptyState
            icon={Phone}
            title={searchQuery || statusFilter !== 'all' || directionFilter !== 'all' || endReasonFilter !== 'all'
              ? t('dashboard.callsPage.noCallsFound')
              : t('dashboard.callsPage.noCalls')}
            description={searchQuery || statusFilter !== 'all' || directionFilter !== 'all' || endReasonFilter !== 'all'
              ? t('dashboard.callsPage.tryAdjustingFilters')
              : t('dashboard.callsPage.callsWillAppear')}
          />
        </div>
      )}

      {/* Transcript Modal */}
      <TranscriptModal
        callId={selectedCallId}
        isOpen={showTranscriptModal}
        onClose={() => {
          setShowTranscriptModal(false);
          setSelectedCallId(null);
          // Refresh table to show updated data (endReason, cost, etc.)
          refreshCalls(true);
        }}
      />
    </div>
  );
}

/**
 * Calls Page
 * View and manage call history with filtering
 * UPDATE EXISTING FILE: frontend/app/dashboard/calls/page.jsx
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
import TranscriptModal from '@/components/TranscriptModal';
import EmptyState from '@/components/EmptyState';
import { Phone, Search, Download, Filter, FileText, Play, Volume2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatDuration, formatCurrency, formatPhone } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CallsPage() {
  const { t, locale } = useLanguage();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  useEffect(() => {
    loadCalls();
  }, [statusFilter]);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await apiClient.calls.getAll(params);
      setCalls(response.data.calls || []);
    } catch (error) {
      toast.error(t('dashboard.callsPage.failedToLoadCalls'));
    } finally {
      setLoading(false);
    }
  };

  // Reload calls when search query changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        loadCalls();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const filteredCalls = calls;

  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    answered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    in_progress: 'bg-blue-100 text-blue-800',
    queued: 'bg-amber-100 text-amber-800',
  };

  const sentimentColors = {
    positive: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    negative: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.callsPage.title')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.callsPage.description')}</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {t('dashboard.callsPage.exportCSV')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('dashboard.callsPage.searchByPhone')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.callsPage.allStatus')}</SelectItem>
            <SelectItem value="answered">{t('dashboard.callsPage.answered')}</SelectItem>
            <SelectItem value="completed">{t('dashboard.callsPage.completed')}</SelectItem>
            <SelectItem value="failed">{t('dashboard.callsPage.failed')}</SelectItem>
            <SelectItem value="in_progress">{t('dashboard.callsPage.inProgress')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calls table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-neutral-100 rounded"></div>
            ))}
          </div>
        </div>
      ) : filteredCalls.length > 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.phoneNumber')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.dateTime')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.duration')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.sentiment')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.summary')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.callsPage.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900">
                        {formatPhone(call.phoneNumber)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">
                        {formatDate(call.createdAt, 'short', locale)}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {formatDate(call.createdAt, 'time', locale)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">
                        {formatDuration(call.duration)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={statusColors[call.status] || 'bg-neutral-100 text-neutral-800'}>
                        {call.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {call.sentiment ? (
                        <Badge className={sentimentColors[call.sentiment] || sentimentColors.neutral}>
                          {call.sentiment.charAt(0).toUpperCase() + call.sentiment.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm text-neutral-600 truncate" title={call.summary}>
                        {call.summary || <span className="text-neutral-400">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {call.hasRecording && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTranscript(call.id);
                            }}
                            title={t('dashboard.callsPage.playRecording')}
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        )}
                        {call.hasTranscript && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTranscript(call.id);
                            }}
                            title={t('dashboard.callsPage.viewTranscript')}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {!call.hasRecording && !call.hasTranscript && (
                          <span className="text-xs text-neutral-400">{t('dashboard.callsPage.noData')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <EmptyState
            icon={Phone}
            title={searchQuery || statusFilter !== 'all' ? t('dashboard.callsPage.noCallsFound') : t('dashboard.callsPage.noCalls')}
            description={
              searchQuery || statusFilter !== 'all'
                ? t('dashboard.callsPage.tryAdjustingFilters')
                : t('dashboard.callsPage.callsWillAppear')
            }
          />
        </div>
      )}

      {/* Transcript modal */}
      <TranscriptModal
        callId={selectedCallId}
        isOpen={showTranscriptModal}
        onClose={() => {
          setShowTranscriptModal(false);
          setSelectedCallId(null);
        }}
      />
    </div>
  );
}

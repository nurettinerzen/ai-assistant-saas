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
import CallDetailModal from '@/components/CallDetailModal';
import CallDetailsModal from '@/components/CallDetailsModal';
import EmptyState from '@/components/EmptyState';
import { Phone, Search, Download, Filter } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatDate, formatDuration, formatCurrency, formatPhone } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CallsPage() {
  const { t } = useLanguage();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
      const response = await apiClient.calls.getAll(params);
      setCalls(response.data.calls || []);
    } catch (error) {
      toast.error(t('dashboard.saveError'));
    } finally {
      setLoading(false);
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
      toast.success(t('dashboard.saveSuccess'));
    } catch (error) {
      toast.error(t('dashboard.saveError'));
    }
  };

  const handleCallClick = (call) => {
    setSelectedCall(call);
    setShowDetailModal(true);
  };

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.assistantName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    queued: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.callHistoryTitle')}</h1>
          <p className="text-neutral-600 mt-1">{t('dashboard.viewAndAnalyze')}</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {t('dashboard.exportCSV')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('dashboard.searchByPhone')}
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
            <SelectItem value="all">{t('dashboard.allStatus')}</SelectItem>
            <SelectItem value="completed">{t('dashboard.completed')}</SelectItem>
            <SelectItem value="failed">{t('dashboard.failed')}</SelectItem>
            <SelectItem value="in-progress">{t('dashboard.inProgress')}</SelectItem>
            <SelectItem value="queued">{t('dashboard.queued')}</SelectItem>
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
                    {t('dashboard.phoneNumberLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.assistantLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.durationLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.costLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.dateLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.statusLabel')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => handleCallClick(call)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900">
                        {formatPhone(call.phoneNumber)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">{call.assistantName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">
                        {formatDuration(call.duration)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">
                        {formatCurrency(call.cost)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600">
                        {formatDate(call.createdAt, 'short')}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {formatDate(call.createdAt, 'time')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={statusColors[call.status] || 'bg-neutral-100 text-neutral-800'}>
                        {t(call.status, locale)}
                      </Badge>
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
            title={searchQuery || statusFilter !== 'all' ? t('dashboard.noDataYet') : t('dashboard.noCallsYetTitle')}
            description={
              searchQuery || statusFilter !== 'all'
                ? t('dashboard.thisActionCannot')
                : t('dashboard.callHistoryAppear')
            }
          />
        </div>
      )}

      {/* Call detail modal */}
      <CallDetailModal
        call={selectedCall}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
    </div>
  );
}

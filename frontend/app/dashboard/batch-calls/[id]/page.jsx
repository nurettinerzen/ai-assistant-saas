'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Megaphone,
  ArrowLeft,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Pause,
  Users,
  PhoneCall,
  PhoneOff,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_CONFIG = {
  PENDING: {
    label: { tr: 'Bekliyor', en: 'Pending' },
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock
  },
  IN_PROGRESS: {
    label: { tr: 'Devam Ediyor', en: 'In Progress' },
    color: 'bg-blue-100 text-blue-800',
    icon: Loader2
  },
  COMPLETED: {
    label: { tr: 'Tamamlandı', en: 'Completed' },
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2
  },
  FAILED: {
    label: { tr: 'Başarısız', en: 'Failed' },
    color: 'bg-red-100 text-red-800',
    icon: XCircle
  },
  CANCELLED: {
    label: { tr: 'İptal Edildi', en: 'Cancelled' },
    color: 'bg-neutral-100 text-neutral-800',
    icon: Pause
  }
};

const CALL_STATUS_CONFIG = {
  pending: {
    label: { tr: 'Bekliyor', en: 'Pending' },
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock
  },
  in_progress: {
    label: { tr: 'Aranıyor', en: 'Calling' },
    color: 'bg-blue-100 text-blue-800',
    icon: PhoneCall
  },
  completed: {
    label: { tr: 'Tamamlandı', en: 'Completed' },
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2
  },
  failed: {
    label: { tr: 'Başarısız', en: 'Failed' },
    color: 'bg-red-100 text-red-800',
    icon: PhoneOff
  },
  no_answer: {
    label: { tr: 'Cevaplanmadı', en: 'No Answer' },
    color: 'bg-neutral-100 text-neutral-800',
    icon: PhoneOff
  }
};

export default function BatchCallDetailPage() {
  const { locale } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [batchCall, setBatchCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadBatchCall();
    }
  }, [id]);

  // Auto-refresh when campaign is in progress
  useEffect(() => {
    if (batchCall?.status === 'IN_PROGRESS' || batchCall?.status === 'PENDING') {
      const interval = setInterval(() => {
        loadBatchCall(true); // silent refresh
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [batchCall?.status]);

  const loadBatchCall = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.get(`/api/batch-calls/${id}`);
      setBatchCall(response.data.batchCall);
    } catch (error) {
      console.error('Error loading batch call:', error);
      if (!silent) {
        toast.error(locale === 'tr' ? 'Kampanya bulunamadı' : 'Campaign not found');
        router.push('/dashboard/batch-calls');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(locale === 'tr' ? 'Bu kampanyayı iptal etmek istediğinize emin misiniz?' : 'Are you sure you want to cancel this campaign?')) {
      return;
    }

    try {
      const response = await apiClient.post(`/api/batch-calls/${id}/cancel`);
      toast.success(response.data.message || (locale === 'tr' ? 'Kampanya iptal edildi' : 'Campaign cancelled'));

      // Show warning if there's one (e.g., active call will continue)
      if (response.data.warning) {
        toast.info(response.data.warning, { duration: 6000 });
      }

      loadBatchCall();
    } catch (error) {
      toast.error(error.response?.data?.error || (locale === 'tr' ? 'Bir hata oluştu' : 'An error occurred'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!batchCall) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[batchCall.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;
  const progress = batchCall.totalRecipients > 0
    ? Math.round((batchCall.completedCalls / batchCall.totalRecipients) * 100)
    : 0;

  const recipients = batchCall.recipients || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/batch-calls')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {locale === 'tr' ? 'Geri' : 'Back'}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Megaphone className="h-8 w-8 text-neutral-600 dark:text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{batchCall.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${statusConfig.color} flex items-center gap-1`}>
                <StatusIcon className={`h-3 w-3 ${batchCall.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
                {statusConfig.label[locale]}
              </Badge>
              <span className="text-sm text-neutral-500">
                {formatDate(batchCall.createdAt, 'long')}
              </span>
            </div>
          </div>
        </div>

        {(batchCall.status === 'PENDING' || batchCall.status === 'IN_PROGRESS') && (
          <Button variant="outline" onClick={handleCancel} className="text-red-600">
            <XCircle className="h-4 w-4 mr-2" />
            {locale === 'tr' ? 'Kampanyayı İptal Et' : 'Cancel Campaign'}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">{locale === 'tr' ? 'Toplam' : 'Total'}</p>
              <p className="text-2xl font-bold text-neutral-900">{batchCall.totalRecipients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">{locale === 'tr' ? 'Başarılı' : 'Successful'}</p>
              <p className="text-2xl font-bold text-green-600">{batchCall.successfulCalls || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">{locale === 'tr' ? 'Başarısız' : 'Failed'}</p>
              <p className="text-2xl font-bold text-red-600">{batchCall.failedCalls || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">{locale === 'tr' ? 'Bekleyen' : 'Pending'}</p>
              <p className="text-2xl font-bold text-yellow-600">
                {batchCall.totalRecipients - batchCall.completedCalls}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700">
            {locale === 'tr' ? 'İlerleme' : 'Progress'}
          </span>
          <span className="text-sm text-neutral-600">
            {batchCall.completedCalls} / {batchCall.totalRecipients} ({progress}%)
          </span>
        </div>
        <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            {locale === 'tr' ? 'Alıcı Listesi' : 'Recipients List'}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Telefon' : 'Phone'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Müşteri' : 'Customer'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Durum' : 'Status'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Süre' : 'Duration'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'Sonlanma' : 'Termination'}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {locale === 'tr' ? 'İşlem' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {recipients.length > 0 ? (
                recipients.map((recipient, index) => {
                  const callStatus = CALL_STATUS_CONFIG[recipient.status] || CALL_STATUS_CONFIG.pending;
                  const CallStatusIcon = callStatus.icon;

                  return (
                    <tr key={index} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-neutral-400 mr-2" />
                          <span className="text-sm text-neutral-900">{recipient.phone_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-neutral-900">
                          {recipient.customer_name || '-'}
                        </span>
                        {recipient.debt_amount && (
                          <span className="text-xs text-neutral-500 ml-2">
                            ({recipient.debt_amount} TL)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            recipient.status === 'completed' ? 'bg-green-500' :
                            recipient.status === 'failed' || recipient.status === 'no_answer' ? 'bg-red-500' :
                            recipient.status === 'in_progress' ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {callStatus.label[locale]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-neutral-600">
                          {recipient.duration ? `${Math.floor(recipient.duration / 60)}:${String(recipient.duration % 60).padStart(2, '0')}` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-neutral-600">
                          {recipient.terminationReason ? (
                            <Badge variant="outline" className={
                              recipient.terminationReason === 'agent_goodbye' ? 'bg-green-50 text-green-700 border-green-200' :
                              recipient.terminationReason === 'user_goodbye' ? 'bg-green-50 text-green-700 border-green-200' :
                              recipient.terminationReason === 'voicemail_detected' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              recipient.terminationReason === 'no_input' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-neutral-50 text-neutral-700 border-neutral-200'
                            }>
                              {recipient.terminationReason === 'agent_goodbye' ? (locale === 'tr' ? 'Asistan Kapattı' : 'Agent Ended') :
                               recipient.terminationReason === 'user_goodbye' ? (locale === 'tr' ? 'Müşteri Kapattı' : 'User Ended') :
                               recipient.terminationReason === 'voicemail_detected' ? (locale === 'tr' ? 'Sesli Yanıt' : 'Voicemail') :
                               recipient.terminationReason === 'no_input' ? (locale === 'tr' ? 'Yanıt Yok' : 'No Input') :
                               recipient.terminationReason}
                            </Badge>
                          ) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {recipient.callLogId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/calls?callId=${recipient.callLogId}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {locale === 'tr' ? 'Detay' : 'Details'}
                          </Button>
                        ) : (recipient.status === 'completed' || recipient.status === 'failed') ? (
                          <span className="text-xs text-neutral-400">
                            {locale === 'tr' ? 'Kayıt bekleniyor...' : 'Waiting for record...'}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    {locale === 'tr' ? 'Alıcı bulunamadı' : 'No recipients found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

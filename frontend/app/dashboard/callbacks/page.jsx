'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  PhoneMissed,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const STATUS_CONFIG = {
  PENDING: { label: { tr: 'Bekliyor', en: 'Pending' }, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  IN_PROGRESS: { label: { tr: 'Aranıyor', en: 'In Progress' }, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Phone },
  COMPLETED: { label: { tr: 'Tamamlandı', en: 'Completed' }, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  NO_ANSWER: { label: { tr: 'Cevap Yok', en: 'No Answer' }, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: PhoneMissed },
  CANCELLED: { label: { tr: 'İptal', en: 'Cancelled' }, color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400', icon: XCircle }
};

const PRIORITY_CONFIG = {
  URGENT: { label: { tr: 'Acil', en: 'Urgent' }, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  HIGH: { label: { tr: 'Yüksek', en: 'High' }, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  NORMAL: { label: { tr: 'Normal', en: 'Normal' }, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  LOW: { label: { tr: 'Düşük', en: 'Low' }, color: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' }
};

const TRANSLATIONS = {
  tr: {
    title: 'Geri Arama Talepleri',
    subtitle: 'Asistan tarafından oluşturulan geri arama kayıtları',
    pending: 'Bekleyen',
    inProgress: 'Devam Eden',
    completed: 'Tamamlanan',
    today: 'Bugün',
    urgent: 'Acil',
    all: 'Tümü',
    pendingFilter: 'Bekleyenler',
    completedFilter: 'Tamamlananlar',
    customer: 'Müşteri',
    topic: 'Konu',
    priority: 'Öncelik',
    date: 'Tarih',
    status: 'Durum',
    actions: 'İşlem',
    markCalled: 'Arandı',
    markNoAnswer: 'Cevap Yok',
    retry: 'Tekrar Dene',
    noCallbacks: 'Geri arama talebi bulunmuyor',
    loading: 'Yükleniyor...',
    search: 'Müşteri ara...',
    assistant: 'Asistan',
    notes: 'Notlar',
    addNotes: 'Not ekle...',
    callbackNotes: 'Geri Arama Notları',
    addCallbackNotes: 'Görüşme notları...',
    scheduledFor: 'Planlanan',
    notScheduled: 'Planlanmadı',
    save: 'Kaydet',
    cancel: 'İptal',
    details: 'Detaylar',
    refresh: 'Yenile'
  },
  en: {
    title: 'Callback Requests',
    subtitle: 'Callback records created by assistant',
    pending: 'Pending',
    inProgress: 'In Progress',
    completed: 'Completed',
    today: 'Today',
    urgent: 'Urgent',
    all: 'All',
    pendingFilter: 'Pending',
    completedFilter: 'Completed',
    customer: 'Customer',
    topic: 'Topic',
    priority: 'Priority',
    date: 'Date',
    status: 'Status',
    actions: 'Actions',
    markCalled: 'Called',
    markNoAnswer: 'No Answer',
    retry: 'Retry',
    noCallbacks: 'No callback requests found',
    loading: 'Loading...',
    search: 'Search customer...',
    assistant: 'Assistant',
    notes: 'Notes',
    addNotes: 'Add notes...',
    callbackNotes: 'Callback Notes',
    addCallbackNotes: 'Call notes...',
    scheduledFor: 'Scheduled',
    notScheduled: 'Not scheduled',
    save: 'Save',
    cancel: 'Cancel',
    details: 'Details',
    refresh: 'Refresh'
  }
};

export default function CallbacksPage() {
  // TODO: Get locale from business.language in the future
  const locale = 'tr';
  const t = TRANSLATIONS[locale] || TRANSLATIONS.tr;
  const router = useRouter();

  const [callbacks, setCallbacks] = useState([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, today: 0, urgent: 0 });
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCallback, setSelectedCallback] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [callbackNotes, setCallbackNotes] = useState('');

  useEffect(() => {
    fetchCallbacks();
    fetchStats();
  }, []);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const res = await apiClient.callbacks.getAll();
      setCallbacks(res.data);
    } catch (error) {
      console.error('Error fetching callbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.callbacks.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiClient.callbacks.update(id, { status });
      fetchCallbacks();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const retryCallback = async (id) => {
    try {
      await apiClient.callbacks.retry(id);
      fetchCallbacks();
      fetchStats();
    } catch (error) {
      console.error('Error retrying callback:', error);
    }
  };

  const saveNotes = async () => {
    if (!selectedCallback) return;

    try {
      await apiClient.callbacks.update(selectedCallback.id, { notes, callbackNotes });
      setIsDetailsOpen(false);
      fetchCallbacks();
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const openDetails = (callback) => {
    setSelectedCallback(callback);
    setNotes(callback.notes || '');
    setCallbackNotes(callback.callbackNotes || '');
    setIsDetailsOpen(true);
  };

  const filteredCallbacks = callbacks.filter(cb => {
    // Status filter
    if (filter === 'pending' && cb.status !== 'PENDING') return false;
    if (filter === 'completed' && cb.status !== 'COMPLETED') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cb.customerName?.toLowerCase().includes(query) ||
        cb.customerPhone?.includes(query) ||
        cb.topic?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t.title}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{t.subtitle}</p>
        </div>
        <Button onClick={() => { fetchCallbacks(); fetchStats(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t.refresh}
        </Button>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          {locale === 'tr'
            ? 'AI asistanınız görüşme sırasında müşterinin geri aranmak istediğini tespit ettiğinde burada bir kayıt oluşturur. Müşteriyi aradığınızda "Arandı" işaretleyebilir, ulaşamadıysanız "Cevap Yok" seçip daha sonra tekrar deneyebilirsiniz. Notlar ekleyerek görüşme detaylarını kaydedebilirsiniz.'
            : 'When your AI assistant detects that a customer wants to be called back during a conversation, it creates a record here. When you call the customer, you can mark "Called", or if you couldn\'t reach them, select "No Answer" and try again later. You can add notes to record conversation details.'
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.pending}</div>
          <div className="text-sm text-yellow-600 dark:text-yellow-500">{t.pending}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.inProgress}</div>
          <div className="text-sm text-blue-600 dark:text-blue-500">{t.inProgress}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.completed}</div>
          <div className="text-sm text-green-600 dark:text-green-500">{t.completed}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.today}</div>
          <div className="text-sm text-purple-600 dark:text-purple-500">{t.today}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.urgent}</div>
          <div className="text-sm text-red-600 dark:text-red-500">{t.urgent}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            {t.all}
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            size="sm"
          >
            {t.pendingFilter}
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilter('completed')}
            size="sm"
          >
            {t.completedFilter}
          </Button>
        </div>
      </div>

      {/* Callbacks List */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">{t.loading}</div>
        ) : filteredCallbacks.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">{t.noCallbacks}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.customer}</th>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.topic}</th>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.priority}</th>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.date}</th>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.status}</th>
                  <th className="text-left p-4 font-medium text-neutral-600 dark:text-neutral-300">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredCallbacks.map(callback => {
                  const statusConfig = STATUS_CONFIG[callback.status];
                  const priorityConfig = PRIORITY_CONFIG[callback.priority];
                  const StatusIcon = statusConfig?.icon || Clock;

                  return (
                    <tr
                      key={callback.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                      onClick={() => openDetails(callback)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <User className="h-5 w-5 text-neutral-500" />
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white">{callback.customerName}</div>
                            <div className="text-sm text-neutral-500">{callback.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="max-w-xs">
                          <div className="truncate text-neutral-900 dark:text-white">{callback.topic}</div>
                          {callback.assistant && (
                            <div className="text-xs text-neutral-400 mt-1">
                              {callback.assistant.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig?.color}`}>
                          {priorityConfig?.label[locale] || callback.priority}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
                        {new Date(callback.requestedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${statusConfig?.color} px-2 py-1 rounded`}>
                          <StatusIcon className="h-4 w-4" />
                          {statusConfig?.label[locale] || callback.status}
                        </span>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        {callback.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => updateStatus(callback.id, 'COMPLETED')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t.markCalled}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              onClick={() => updateStatus(callback.id, 'NO_ANSWER')}
                            >
                              <PhoneMissed className="h-4 w-4 mr-1" />
                              {t.markNoAnswer}
                            </Button>
                          </div>
                        )}
                        {callback.status === 'NO_ANSWER' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                            onClick={() => retryCallback(callback.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            {t.retry}
                          </Button>
                        )}
                        {callback.status === 'COMPLETED' && (
                          <span className="text-sm text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.details}</DialogTitle>
            <DialogDescription>
              {selectedCallback?.customerName} - {selectedCallback?.customerPhone}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Topic */}
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.topic}</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{selectedCallback?.topic}</p>
            </div>

            {/* Status & Priority */}
            <div className="flex gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.status}</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_CONFIG[selectedCallback?.status]?.color}`}>
                    {STATUS_CONFIG[selectedCallback?.status]?.label[locale]}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.priority}</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_CONFIG[selectedCallback?.priority]?.color}`}>
                    {PRIORITY_CONFIG[selectedCallback?.priority]?.label[locale]}
                  </span>
                </div>
              </div>
            </div>

            {/* Assistant */}
            {selectedCallback?.assistant && (
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.assistant}</label>
                <p className="mt-1 text-neutral-900 dark:text-white">{selectedCallback.assistant.name}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.notes}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.addNotes}
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Callback Notes */}
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.callbackNotes}</label>
              <Textarea
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                placeholder={t.addCallbackNotes}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={saveNotes}>
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

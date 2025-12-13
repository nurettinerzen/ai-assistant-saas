/**
 * Campaign Detail Page
 * View and manage a single batch call campaign
 */

'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Users,
  DollarSign,
  TrendingUp,
  FileText,
  Calendar,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Voicemail,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';

// Status configs
const CAMPAIGN_STATUS = {
  PENDING: { label: 'Bekliyor', color: 'bg-neutral-100 text-neutral-800', icon: Clock },
  RUNNING: { label: 'Çalışıyor', color: 'bg-blue-100 text-blue-800', icon: Play },
  PAUSED: { label: 'Duraklatıldı', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { label: 'İptal', color: 'bg-red-100 text-red-800', icon: StopCircle },
  FAILED: { label: 'Başarısız', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const CALL_STATUS = {
  PENDING: { label: 'Bekliyor', color: 'bg-neutral-100 text-neutral-800', icon: Clock },
  QUEUED: { label: 'Sırada', color: 'bg-blue-100 text-blue-800', icon: Clock },
  IN_PROGRESS: { label: 'Görüşmede', color: 'bg-blue-100 text-blue-800', icon: PhoneCall },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  FAILED: { label: 'Başarısız', color: 'bg-red-100 text-red-800', icon: XCircle },
  NO_ANSWER: { label: 'Yanıt Yok', color: 'bg-orange-100 text-orange-800', icon: PhoneMissed },
  BUSY: { label: 'Meşgul', color: 'bg-yellow-100 text-yellow-800', icon: PhoneOff },
  VOICEMAIL: { label: 'Sesli Mesaj', color: 'bg-purple-100 text-purple-800', icon: Voicemail },
  SKIPPED: { label: 'Atlandı', color: 'bg-neutral-100 text-neutral-800', icon: XCircle },
};

const OUTCOME_LABELS = {
  PAYMENT_PROMISED: { label: 'Ödeme Sözü', color: 'text-green-600' },
  PARTIAL_PAYMENT: { label: 'Kısmi Ödeme', color: 'text-blue-600' },
  PAYMENT_REFUSED: { label: 'Ödeme Reddedildi', color: 'text-red-600' },
  DISPUTE: { label: 'İtiraz', color: 'text-orange-600' },
  CALLBACK_REQUESTED: { label: 'Geri Aranacak', color: 'text-yellow-600' },
  WRONG_NUMBER: { label: 'Yanlış Numara', color: 'text-neutral-600' },
  NOT_AVAILABLE: { label: 'Ulaşılamadı', color: 'text-neutral-600' },
  NO_RESPONSE: { label: 'Yanıt Yok', color: 'text-neutral-600' },
  OTHER: { label: 'Diğer', color: 'text-neutral-600' },
};

export default function CampaignDetailPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const campaignId = unwrappedParams.id;

  // State
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [calls, setCalls] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  useEffect(() => {
    // Auto-refresh if campaign is running
    if (!campaign || campaign.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      loadCampaign(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaign?.status]);

  const loadCampaign = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [campaignRes, callsRes] = await Promise.all([
        apiClient.get(`/api/batch-call/campaigns/${campaignId}`),
        apiClient.get(`/api/batch-call/campaigns/${campaignId}/calls`),
      ]);

      setCampaign(campaignRes.data.campaign);
      setCalls(callsRes.data.calls || []);
    } catch (error) {
      console.error('Failed to load campaign:', error);
      toast.error('Kampanya yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/start`);
      toast.success('Kampanya başlatıldı');
      await loadCampaign(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kampanya başlatılamadı');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/pause`);
      toast.success('Kampanya duraklatıldı');
      await loadCampaign(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kampanya duraklatılamadı');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/resume`);
      toast.success('Kampanya devam ediyor');
      await loadCampaign(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kampanya devam ettirilemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Kampanyayı iptal etmek istediğinize emin misiniz?')) return;

    setActionLoading(true);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/cancel`);
      toast.success('Kampanya iptal edildi');
      await loadCampaign(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kampanya iptal edilemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Kampanya bulunamadı</h2>
        <Link href="/dashboard/campaigns">
          <Button className="mt-4">Kampanyalara Dön</Button>
        </Link>
      </div>
    );
  }

  const statusConfig = CAMPAIGN_STATUS[campaign.status] || CAMPAIGN_STATUS.PENDING;
  const StatusIcon = statusConfig.icon;
  const progress = campaign.stats?.total > 0
    ? Math.round((campaign.stats.completed / campaign.stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Kampanyalara Dön
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">
            {campaign.name || `Kampanya #${campaign.id}`}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={statusConfig.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <span className="text-neutral-500">
              {campaign.channel === 'PHONE' ? (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> Telefon
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadCampaign()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>

          {campaign.status === 'PENDING' && (
            <Button onClick={handleStart} disabled={actionLoading}>
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Başlat
            </Button>
          )}

          {campaign.status === 'RUNNING' && (
            <Button onClick={handlePause} disabled={actionLoading} variant="outline">
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Duraklat
            </Button>
          )}

          {campaign.status === 'PAUSED' && (
            <Button onClick={handleResume} disabled={actionLoading}>
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Devam Et
            </Button>
          )}

          {['PENDING', 'RUNNING', 'PAUSED'].includes(campaign.status) && (
            <Button onClick={handleCancel} disabled={actionLoading} variant="destructive">
              <StopCircle className="h-4 w-4 mr-2" />
              İptal Et
            </Button>
          )}
        </div>
      </div>

      {/* Live indicator */}
      {campaign.status === 'RUNNING' && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
          <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
          Kampanya aktif - sayfa otomatik güncelleniyor
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Toplam Arama</p>
                <p className="text-2xl font-bold">{campaign.stats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Tamamlanan</p>
                <p className="text-2xl font-bold">{campaign.stats?.completed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Başarılı (Ödeme Sözü)</p>
                <p className="text-2xl font-bold text-green-600">
                  {(campaign.outcomes?.paymentPromised || 0) + (campaign.outcomes?.partialPayment || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Vaat Edilen</p>
                <p className="text-2xl font-bold">{formatCurrency(campaign.amounts?.promised || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">İlerleme</span>
            <span className="text-sm text-neutral-600">{progress}%</span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-neutral-500">
            <span>{campaign.stats?.completed || 0} tamamlandı</span>
            <span>{campaign.stats?.inProgress || 0} devam ediyor</span>
            <span>{campaign.stats?.pending || 0} bekliyor</span>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tümü ({calls.length})</TabsTrigger>
          <TabsTrigger value="completed">
            Tamamlanan ({calls.filter(c => c.status === 'COMPLETED').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Bekleyen ({calls.filter(c => ['PENDING', 'QUEUED'].includes(c.status)).length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Başarısız ({calls.filter(c => ['FAILED', 'NO_ANSWER', 'BUSY'].includes(c.status)).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CallsTable
            calls={calls}
            onViewTranscript={(call) => {
              setSelectedCall(call);
              setShowTranscript(true);
            }}
          />
        </TabsContent>

        <TabsContent value="completed">
          <CallsTable
            calls={calls.filter(c => c.status === 'COMPLETED')}
            onViewTranscript={(call) => {
              setSelectedCall(call);
              setShowTranscript(true);
            }}
          />
        </TabsContent>

        <TabsContent value="pending">
          <CallsTable
            calls={calls.filter(c => ['PENDING', 'QUEUED', 'IN_PROGRESS'].includes(c.status))}
            onViewTranscript={(call) => {
              setSelectedCall(call);
              setShowTranscript(true);
            }}
          />
        </TabsContent>

        <TabsContent value="failed">
          <CallsTable
            calls={calls.filter(c => ['FAILED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL'].includes(c.status))}
            onViewTranscript={(call) => {
              setSelectedCall(call);
              setShowTranscript(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Transcript Modal */}
      <Dialog open={showTranscript} onOpenChange={setShowTranscript}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Görüşme Detayı - {selectedCall?.customerName}
            </DialogTitle>
            <DialogDescription>
              {selectedCall?.customerPhone} • {formatDuration(selectedCall?.duration)}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 rounded-lg">
                <div>
                  <p className="text-sm text-neutral-600">Fatura Tutarı</p>
                  <p className="font-semibold">{formatCurrency(selectedCall.invoiceAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Gecikme</p>
                  <p className="font-semibold">{selectedCall.daysOverdue} gün</p>
                </div>
                {selectedCall.outcome && (
                  <div>
                    <p className="text-sm text-neutral-600">Sonuç</p>
                    <p className={`font-semibold ${OUTCOME_LABELS[selectedCall.outcome]?.color || 'text-neutral-600'}`}>
                      {OUTCOME_LABELS[selectedCall.outcome]?.label || selectedCall.outcome}
                    </p>
                  </div>
                )}
                {selectedCall.paymentAmount && (
                  <div>
                    <p className="text-sm text-neutral-600">Vaat Edilen</p>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(selectedCall.paymentAmount)}
                    </p>
                  </div>
                )}
              </div>

              {/* Summary text */}
              {selectedCall.summary && (
                <div>
                  <h4 className="font-semibold mb-2">Özet</h4>
                  <p className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg">
                    {selectedCall.summary}
                  </p>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.transcriptText && (
                <div>
                  <h4 className="font-semibold mb-2">Görüşme Metni</h4>
                  <div className="bg-neutral-50 p-4 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedCall.transcriptText}
                  </div>
                </div>
              )}

              {!selectedCall.transcriptText && selectedCall.status !== 'COMPLETED' && (
                <div className="text-center py-8 text-neutral-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Görüşme henüz tamamlanmadı</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Calls Table Component
function CallsTable({ calls, onViewTranscript }) {
  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  };

  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Phone className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-500">Bu kategoride arama yok</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Müşteri</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead>Gecikme</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sonuç</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const statusConfig = CALL_STATUS[call.status] || CALL_STATUS.PENDING;
                const StatusIcon = statusConfig.icon;
                const outcomeConfig = OUTCOME_LABELS[call.outcome];

                return (
                  <TableRow key={call.id}>
                    <TableCell className="font-medium">{call.customerName}</TableCell>
                    <TableCell className="text-neutral-600">{call.customerPhone}</TableCell>
                    <TableCell>{formatCurrency(call.invoiceAmount)}</TableCell>
                    <TableCell>{call.daysOverdue} gün</TableCell>
                    <TableCell>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {outcomeConfig ? (
                        <span className={outcomeConfig.color}>{outcomeConfig.label}</span>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {call.status === 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewTranscript(call)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

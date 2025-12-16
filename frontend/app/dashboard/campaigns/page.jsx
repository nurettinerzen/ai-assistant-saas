/**
 * Campaigns Page
 * List and manage batch call campaigns
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Megaphone,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Eye,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  DollarSign,
  Plus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';

// Campaign status colors (labels will be translated)
const STATUS_CONFIG = {
  PENDING: { color: 'bg-neutral-100 text-neutral-800', icon: Clock },
  RUNNING: { color: 'bg-blue-100 text-blue-800', icon: Play },
  PAUSED: { color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  COMPLETED: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { color: 'bg-red-100 text-red-800', icon: StopCircle },
  FAILED: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

export default function CampaignsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);

  // Auto-refresh for running campaigns
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter]);

  useEffect(() => {
    // Auto-refresh every 10 seconds if there are running campaigns
    if (!autoRefresh) return;

    const hasRunning = campaigns.some(c => c.status === 'RUNNING');
    if (!hasRunning) return;

    const interval = setInterval(() => {
      loadCampaigns(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [campaigns, autoRefresh]);

  const loadCampaigns = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

      const response = await apiClient.get(`/api/batch-call/campaigns?${params.toString()}`);
      setCampaigns(response.data.campaigns || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast.error(t('dashboard.campaignsPage.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartCampaign = async (campaignId) => {
    setActionLoading(campaignId);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/start`);
      toast.success(t('dashboard.campaignsPage.campaignStarted'));
      await loadCampaigns(false);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('dashboard.campaignsPage.failedToStart');
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseCampaign = async (campaignId) => {
    setActionLoading(campaignId);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/pause`);
      toast.success(t('dashboard.campaignsPage.campaignPaused'));
      await loadCampaigns(false);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('dashboard.campaignsPage.failedToPause');
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeCampaign = async (campaignId) => {
    setActionLoading(campaignId);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/resume`);
      toast.success(t('dashboard.campaignsPage.campaignResumed'));
      await loadCampaigns(false);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('dashboard.campaignsPage.failedToResume');
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelCampaign = async (campaignId) => {
    if (!confirm(t('dashboard.campaignsPage.confirmCancel'))) return;

    setActionLoading(campaignId);
    try {
      await apiClient.post(`/api/batch-call/campaigns/${campaignId}/cancel`);
      toast.success(t('dashboard.campaignsPage.campaignCancelled'));
      await loadCampaigns(false);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('dashboard.campaignsPage.failedToCancel');
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amount);
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

  // Calculate summary stats
  const summaryStats = {
    total: campaigns.length,
    running: campaigns.filter(c => c.status === 'RUNNING').length,
    completed: campaigns.filter(c => c.status === 'COMPLETED').length,
    totalCalls: campaigns.reduce((sum, c) => sum + (c.totalCalls || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.campaignsPage.title')}</h1>
          <p className="text-neutral-600 mt-1">
            {t('dashboard.campaignsPage.description')}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadCampaigns()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>

          {can('campaigns:create') && (
          <Link href="/dashboard/collections">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.campaignsPage.newCampaign')}
            </Button>
          </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Megaphone className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">{t('dashboard.campaignsPage.totalCampaigns')}</p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Play className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">{t('dashboard.campaignsPage.active')}</p>
                <p className="text-2xl font-bold">{summaryStats.running}</p>
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
                <p className="text-sm text-neutral-600">{t('dashboard.campaignsPage.completed')}</p>
                <p className="text-2xl font-bold">{summaryStats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Phone className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">{t('dashboard.campaignsPage.totalCalls')}</p>
                <p className="text-2xl font-bold">{summaryStats.totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('dashboard.campaignsPage.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('dashboard.campaignsPage.allStatuses')}</SelectItem>
            <SelectItem value="PENDING">{t('dashboard.campaignsPage.status.pending')}</SelectItem>
            <SelectItem value="RUNNING">{t('dashboard.campaignsPage.status.running')}</SelectItem>
            <SelectItem value="PAUSED">{t('dashboard.campaignsPage.status.paused')}</SelectItem>
            <SelectItem value="COMPLETED">{t('dashboard.campaignsPage.status.completed')}</SelectItem>
            <SelectItem value="CANCELLED">{t('dashboard.campaignsPage.status.cancelled')}</SelectItem>
          </SelectContent>
        </Select>

        {summaryStats.running > 0 && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
            {t('dashboard.campaignsPage.liveUpdateActive')}
          </div>
        )}
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900">{t('dashboard.campaignsPage.noCampaigns')}</h3>
              <p className="text-neutral-600 mt-1 mb-4">
                {t('dashboard.campaignsPage.createCampaignFromOverdue')}
              </p>
              {can('campaigns:create') && (
              <Link href="/dashboard/collections">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('dashboard.campaignsPage.createCampaign')}
                </Button>
              </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.campaignsPage.campaign')}</TableHead>
                    <TableHead>{t('dashboard.campaignsPage.channel')}</TableHead>
                    <TableHead>{t('dashboard.campaignsPage.status')}</TableHead>
                    <TableHead>{t('dashboard.campaignsPage.progress')}</TableHead>
                    <TableHead>{t('dashboard.campaignsPage.success')}</TableHead>
                    <TableHead>{t('dashboard.campaignsPage.date')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.campaignsPage.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = statusConfig.icon;
                    const progress = campaign.totalCalls > 0
                      ? Math.round((campaign.completedCalls / campaign.totalCalls) * 100)
                      : 0;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="font-medium text-primary-600 hover:underline"
                          >
                            {campaign.name || `${t('dashboard.campaignsPage.campaignNumber')}${campaign.id}`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {campaign.channel === 'PHONE' ? (
                              <>
                                <Phone className="h-4 w-4 text-neutral-500" />
                                <span>{t('dashboard.campaignsPage.channels.phone')}</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 text-green-500" />
                                <span>{t('dashboard.campaignsPage.channels.whatsapp')}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(`dashboard.campaignsPage.status.${campaign.status.toLowerCase()}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden max-w-24">
                              <div
                                className="h-full bg-primary-600 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-neutral-600">
                              {campaign.completedCalls}/{campaign.totalCalls}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">
                            {campaign.successfulCalls || 0}
                          </span>
                          <span className="text-neutral-400"> / </span>
                          <span className="text-red-600">
                            {campaign.failedCalls || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-600">
                          {formatDate(campaign.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/dashboard/campaigns/${campaign.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>

                            {can('campaigns:control') && campaign.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartCampaign(campaign.id)}
                                disabled={actionLoading === campaign.id}
                              >
                                {actionLoading === campaign.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}

                            {can('campaigns:control') && campaign.status === 'RUNNING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePauseCampaign(campaign.id)}
                                disabled={actionLoading === campaign.id}
                              >
                                {actionLoading === campaign.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Pause className="h-4 w-4 text-yellow-600" />
                                )}
                              </Button>
                            )}

                            {can('campaigns:control') && campaign.status === 'PAUSED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResumeCampaign(campaign.id)}
                                disabled={actionLoading === campaign.id}
                              >
                                {actionLoading === campaign.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}

                            {can('campaigns:delete') && ['PENDING', 'RUNNING', 'PAUSED'].includes(campaign.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelCampaign(campaign.id)}
                                disabled={actionLoading === campaign.id}
                              >
                                <StopCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

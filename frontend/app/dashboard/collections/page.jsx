/**
 * Collections Page
 * View overdue invoices from Paraşüt and create batch call campaigns
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Receipt,
  Phone,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Filter,
  Play,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CollectionsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [parasutConnected, setParasutConnected] = useState(false);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    minDays: 1,
    maxDays: '',
    minAmount: '',
    maxAmount: '',
  });

  // Campaign creation modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    channel: 'PHONE',
  });
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  useEffect(() => {
    checkParasutConnection();
  }, []);

  const checkParasutConnection = async () => {
    try {
      const response = await apiClient.get('/api/parasut/status');
      setParasutConnected(response.data.connected);

      if (response.data.connected) {
        await loadOverdueData();
      }
    } catch (error) {
      console.error('Failed to check Paraşüt status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverdueData = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.minDays) params.append('minDays', filters.minDays);
      if (filters.maxDays) params.append('maxDays', filters.maxDays);
      if (filters.minAmount) params.append('minAmount', filters.minAmount);
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount);

      // Fetch overdue invoices and summary in parallel
      const [invoicesRes, summaryRes] = await Promise.all([
        apiClient.get(`/api/parasut/overdue?${params.toString()}`),
        apiClient.get('/api/parasut/overdue/summary'),
      ]);

      setOverdueInvoices(invoicesRes.data.invoices || []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to load overdue data:', error);
      toast.error(t('dashboard.collectionsPage.errors.loadInvoicesFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectParasut = async () => {
    try {
      const response = await apiClient.get('/api/parasut/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error(t('dashboard.collectionsPage.errors.parasutConnectionFailed'));
    }
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === overdueInvoices.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(overdueInvoices.map(inv => inv.id));
    }
  };

  const handleSelectCustomer = (id) => {
    setSelectedCustomers(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleCreateCampaign = async () => {
    if (selectedCustomers.length === 0) {
      toast.error(t('dashboard.collectionsPage.errors.selectAtLeastOneCustomer'));
      return;
    }

    setCreatingCampaign(true);
    try {
      // Prepare customer data for campaign
      const customers = overdueInvoices
        .filter(inv => selectedCustomers.includes(inv.id))
        .map(inv => ({
          name: inv.customerName,
          phone: inv.customerPhone,
          email: inv.customerEmail,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          daysOverdue: inv.daysOverdue,
        }));

      const response = await apiClient.post('/api/batch-call/campaigns', {
        name: campaignForm.name || `${t('dashboard.collectionsPage.defaultCampaignName')} - ${new Date().toLocaleDateString('tr-TR')}`,
        channel: campaignForm.channel,
        customers,
      });

      if (response.data.success) {
        toast.success(t('dashboard.collectionsPage.campaignCreated'));
        setShowCampaignModal(false);
        setSelectedCustomers([]);
        setCampaignForm({ name: '', channel: 'PHONE' });

        // Navigate to campaign detail
        router.push(`/dashboard/campaigns/${response.data.campaign.id}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('dashboard.collectionsPage.errors.campaignCreationFailed');
      toast.error(errorMsg);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getOverdueBadgeColor = (days) => {
    if (days <= 7) return 'bg-yellow-100 text-yellow-800';
    if (days <= 30) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // Not connected state
  if (!loading && !parasutConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.collectionsPage.title')}</h1>
          <p className="text-neutral-600 mt-1">
            {t('dashboard.collectionsPage.notConnected.description')}
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary-600" />
              {t('dashboard.collectionsPage.notConnected.cardTitle')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.collectionsPage.notConnected.cardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">{t('dashboard.collectionsPage.notConnected.featuresTitle')}</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>{t('dashboard.collectionsPage.notConnected.feature1')}</li>
                  <li>{t('dashboard.collectionsPage.notConnected.feature2')}</li>
                  <li>{t('dashboard.collectionsPage.notConnected.feature3')}</li>
                  <li>{t('dashboard.collectionsPage.notConnected.feature4')}</li>
                </ul>
              </div>

              <Button onClick={handleConnectParasut} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('dashboard.collectionsPage.notConnected.connectButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.collectionsPage.title')}</h1>
          <p className="text-neutral-600 mt-1">
            {t('dashboard.collectionsPage.description')}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadOverdueData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('dashboard.collectionsPage.refreshButton')}
          </Button>

          {selectedCustomers.length > 0 && (
            <Button onClick={() => setShowCampaignModal(true)}>
              <Play className="h-4 w-4 mr-2" />
              {t('dashboard.collectionsPage.startCampaignButton')} ({selectedCustomers.length})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Receipt className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-600">{t('dashboard.collectionsPage.summary.totalInvoices')}</p>
                  <p className="text-2xl font-bold">{summary.totalInvoices || 0}</p>
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
                  <p className="text-sm text-neutral-600">{t('dashboard.collectionsPage.summary.totalAmount')}</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalAmount || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-600">{t('dashboard.collectionsPage.summary.customerCount')}</p>
                  <p className="text-2xl font-bold">{summary.uniqueCustomers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-600">{t('dashboard.collectionsPage.summary.avgDelay')}</p>
                  <p className="text-2xl font-bold">{summary.avgDaysOverdue || 0} {t('dashboard.collectionsPage.summary.days')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('dashboard.collectionsPage.filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('dashboard.collectionsPage.filters.minDays')}</Label>
              <Input
                type="number"
                min="0"
                value={filters.minDays}
                onChange={(e) => setFilters({ ...filters, minDays: e.target.value })}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.collectionsPage.filters.maxDays')}</Label>
              <Input
                type="number"
                min="0"
                value={filters.maxDays}
                onChange={(e) => setFilters({ ...filters, maxDays: e.target.value })}
                placeholder={t('dashboard.collectionsPage.filters.all')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.collectionsPage.filters.minAmount')}</Label>
              <Input
                type="number"
                min="0"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.collectionsPage.filters.maxAmount')}</Label>
              <Input
                type="number"
                min="0"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                placeholder={t('dashboard.collectionsPage.filters.all')}
              />
            </div>
          </div>

          <Button onClick={loadOverdueData} className="mt-4" disabled={loading}>
            <Filter className="h-4 w-4 mr-2" />
            {t('dashboard.collectionsPage.filters.applyButton')}
          </Button>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('dashboard.collectionsPage.table.title')}</CardTitle>
            {overdueInvoices.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedCustomers.length === overdueInvoices.length ? t('dashboard.collectionsPage.table.unselectAll') : t('dashboard.collectionsPage.table.selectAll')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : overdueInvoices.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900">{t('dashboard.collectionsPage.table.noOverdueTitle')}</h3>
              <p className="text-neutral-600 mt-1">
                {t('dashboard.collectionsPage.table.noOverdueDesc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.length === overdueInvoices.length}
                        onChange={handleSelectAll}
                        className="rounded border-neutral-300"
                      />
                    </TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.customer')}</TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.invoiceNo')}</TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.amount')}</TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.delay')}</TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.phone')}</TableHead>
                    <TableHead>{t('dashboard.collectionsPage.table.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className={selectedCustomers.includes(invoice.id) ? 'bg-primary-50' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(invoice.id)}
                          onChange={() => handleSelectCustomer(invoice.id)}
                          className="rounded border-neutral-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{invoice.customerName}</TableCell>
                      <TableCell className="text-neutral-600">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getOverdueBadgeColor(invoice.daysOverdue)}>
                          {invoice.daysOverdue} {t('dashboard.collectionsPage.table.days')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {invoice.customerPhone || (
                          <span className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {t('dashboard.collectionsPage.table.noPhone')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.hasPhone ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {t('dashboard.collectionsPage.table.callable')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            {t('dashboard.collectionsPage.table.phoneRequired')}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dashboard.collectionsPage.modal.title')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.collectionsPage.modal.description')} {selectedCustomers.length} {t('dashboard.collectionsPage.modal.customersSelected')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">{t('dashboard.collectionsPage.modal.campaignName')}</Label>
              <Input
                id="campaignName"
                placeholder={t('dashboard.collectionsPage.modal.campaignNamePlaceholder')}
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.collectionsPage.modal.channel')}</Label>
              <Select
                value={campaignForm.channel}
                onValueChange={(value) => setCampaignForm({ ...campaignForm, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHONE">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {t('dashboard.collectionsPage.modal.phoneCall')}
                    </div>
                  </SelectItem>
                  <SelectItem value="WHATSAPP">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('dashboard.collectionsPage.modal.whatsapp')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm">{t('dashboard.collectionsPage.modal.summaryTitle')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-neutral-600">{t('dashboard.collectionsPage.modal.customer')}:</span>
                  <span className="ml-2 font-medium">{selectedCustomers.length}</span>
                </div>
                <div>
                  <span className="text-neutral-600">{t('dashboard.collectionsPage.modal.totalAmount')}:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      overdueInvoices
                        .filter(inv => selectedCustomers.includes(inv.id))
                        .reduce((sum, inv) => sum + inv.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">{t('dashboard.collectionsPage.modal.infoTitle')}</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{t('dashboard.collectionsPage.modal.info1')}</li>
                <li>{t('dashboard.collectionsPage.modal.info2')}</li>
                <li>{t('dashboard.collectionsPage.modal.info3')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCampaignModal(false)}
              disabled={creatingCampaign}
            >
              {t('dashboard.collectionsPage.modal.cancel')}
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={creatingCampaign}
            >
              {creatingCampaign ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('dashboard.collectionsPage.modal.creating')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t('dashboard.collectionsPage.modal.createButton')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

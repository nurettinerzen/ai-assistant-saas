/**
 * Google Sheets Integration Page
 * OAuth-based connection for full CRM sync (Products, Orders, Tickets)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  Check,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  ArrowLeft,
  Clock,
  AlertCircle,
  Loader2,
  Package,
  ShoppingCart,
  Wrench,
  XCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

export default function GoogleSheetsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [status, setStatus] = useState({
    connected: false,
    selectedSpreadsheet: null,
    selectedSheet: null,
    lastSync: null
  });

  const [spreadsheets, setSpreadsheets] = useState([]);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState(null);
  const [detectedSheets, setDetectedSheets] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);

  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      toast.success('Google Sheets bağlantısı başarılı!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      const errorMessages = {
        'no-code': 'Yetkilendirme kodu alınamadı',
        'invalid-state': 'Geçersiz oturum',
        'callback-failed': 'Bağlantı tamamlanamadı'
      };
      toast.error(errorMessages[error] || 'Bağlantı hatası');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  // Load spreadsheets when connected
  useEffect(() => {
    if (status.connected) {
      loadSpreadsheets();
    }
  }, [status.connected]);

  // Load spreadsheet info and detect sheets when selected
  useEffect(() => {
    if (status.selectedSpreadsheet) {
      loadSpreadsheetInfo(status.selectedSpreadsheet);
      detectSheets();
    }
  }, [status.selectedSpreadsheet]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/google-sheets/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpreadsheets = async () => {
    try {
      setLoadingSpreadsheets(true);
      const response = await apiClient.get('/api/google-sheets/spreadsheets');
      setSpreadsheets(response.data.spreadsheets || []);
    } catch (error) {
      console.error('Failed to load spreadsheets:', error);
      toast.error('Spreadsheet listesi yüklenemedi');
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  const loadSpreadsheetInfo = async (spreadsheetId) => {
    try {
      const response = await apiClient.get(`/api/google-sheets/spreadsheet/${spreadsheetId}`);
      setSpreadsheetInfo(response.data);
    } catch (error) {
      console.error('Failed to load spreadsheet info:', error);
    }
  };

  const detectSheets = async () => {
    try {
      setDetecting(true);
      const response = await apiClient.get('/api/google-sheets/detect-sheets');
      if (response.data.success) {
        setDetectedSheets(response.data);
      }
    } catch (error) {
      console.error('Failed to detect sheets:', error);
    } finally {
      setDetecting(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await apiClient.get('/api/google-sheets/auth-url');
      const data = res.data;

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('Bağlantı başlatılamadı');
      }
    } catch (error) {
      console.error('Connect error:', error);
      alert('Bağlantı hatası');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Google Sheets bağlantısını kesmek istediğinizden emin misiniz?')) return;

    try {
      await apiClient.post('/api/google-sheets/disconnect');
      toast.success('Google Sheets bağlantısı kesildi');
      setStatus({
        connected: false,
        selectedSpreadsheet: null,
        selectedSheet: null,
        lastSync: null
      });
      setSpreadsheets([]);
      setSpreadsheetInfo(null);
      setDetectedSheets(null);
      setSyncResults(null);
    } catch (error) {
      toast.error('Bağlantı kesilemedi');
    }
  };

  const handleSelectSpreadsheet = async (spreadsheetId) => {
    try {
      const response = await apiClient.post('/api/google-sheets/select', {
        spreadsheetId
      });

      if (response.data.success) {
        toast.success('Spreadsheet seçildi');
        setStatus(prev => ({
          ...prev,
          selectedSpreadsheet: spreadsheetId,
          selectedSheet: response.data.spreadsheet.sheet
        }));
        loadSpreadsheetInfo(spreadsheetId);
        // Detect sheets after selection
        setTimeout(detectSheets, 500);
      }
    } catch (error) {
      toast.error('Spreadsheet seçilemedi');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResults(null);
      const response = await apiClient.post('/api/google-sheets/sync');

      if (response.data.success) {
        const { results } = response.data;
        const totalImported = results.products.imported + results.orders.imported + results.tickets.imported;
        const totalUpdated = results.products.updated + results.orders.updated + results.tickets.updated;

        toast.success(
          `Senkronizasyon tamamlandı: ${results.products.total} ürün, ${results.orders.total} sipariş, ${results.tickets.total} servis kaydı`
        );

        setSyncResults(results);
        setStatus(prev => ({
          ...prev,
          lastSync: new Date().toISOString()
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Senkronizasyon başarısız');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      setCreatingTemplate(true);
      const response = await apiClient.post('/api/google-sheets/create-template');

      if (response.data.success) {
        toast.success('Template oluşturuldu! Google Drive\'ınızı kontrol edin.');
        window.open(response.data.spreadsheet.spreadsheetUrl, '_blank');
        await loadSpreadsheets();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Template oluşturulamadı');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/integrations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-green-600" />
            Google Sheets Entegrasyonu
          </h1>
          <p className="text-neutral-600 mt-1">
            Ürün, sipariş ve servis bilgilerinizi Google Sheets ile senkronize edin
          </p>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bağlantı Durumu</span>
            {status.connected ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Bağlı
              </Badge>
            ) : (
              <Badge variant="secondary">Bağlı Değil</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {status.connected
              ? 'Google hesabınız başarıyla bağlandı'
              : 'Google hesabınızı bağlayarak spreadsheet verilerinize erişin'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.connected ? (
            <div className="space-y-4">
              {status.lastSync && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Clock className="h-4 w-4" />
                  <span>Son senkronizasyon: {formatDate(status.lastSync)}</span>
                </div>
              )}
              <Button variant="outline" onClick={handleDisconnect}>
                Bağlantıyı Kes
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bağlanıyor...
                </>
              ) : (
                <>
                  <Sheet className="h-4 w-4 mr-2" />
                  Google ile Bağlan
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Connected Content */}
      {status.connected && (
        <>
          {/* Template Creation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Yeni Template Oluştur
              </CardTitle>
              <CardDescription>
                Hazır formatlı bir CRM şablonu oluşturun (Ürünler, Siparişler, Servis)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleCreateTemplate}
                  disabled={creatingTemplate}
                >
                  {creatingTemplate ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Template Oluştur
                    </>
                  )}
                </Button>
                <p className="text-sm text-neutral-500">
                  3 sheet&apos;li hazır template: Ürünler, Siparişler, Servis
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Spreadsheet Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Spreadsheet Seçimi</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadSpreadsheets}
                  disabled={loadingSpreadsheets}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingSpreadsheets ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <CardDescription>
                CRM verilerinizi okuyacağınız spreadsheet&apos;i seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Spreadsheet Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Spreadsheet</label>
                <Select
                  value={status.selectedSpreadsheet || ''}
                  onValueChange={handleSelectSpreadsheet}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Spreadsheet seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Spreadsheet Info */}
              {status.selectedSpreadsheet && spreadsheetInfo && (
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{spreadsheetInfo.title}</p>
                      <p className="text-sm text-neutral-500">
                        {spreadsheetInfo.sheets?.length || 0} sheet
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${status.selectedSpreadsheet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Detected Sheets */}
              {status.selectedSpreadsheet && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Tespit Edilen Sheet&apos;ler</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={detectSheets}
                      disabled={detecting}
                    >
                      {detecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {detectedSheets ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Products */}
                      <div className={`p-3 rounded-lg border ${detectedSheets.detected.products ? 'bg-green-50 border-green-200' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex items-center gap-2">
                          <Package className={`h-4 w-4 ${detectedSheets.detected.products ? 'text-green-600' : 'text-neutral-400'}`} />
                          <span className="text-sm font-medium">Ürünler</span>
                          {detectedSheets.detected.products ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-neutral-400 ml-auto" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          {detectedSheets.detected.products || 'Bulunamadı'}
                        </p>
                      </div>

                      {/* Orders */}
                      <div className={`p-3 rounded-lg border ${detectedSheets.detected.orders ? 'bg-blue-50 border-blue-200' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex items-center gap-2">
                          <ShoppingCart className={`h-4 w-4 ${detectedSheets.detected.orders ? 'text-blue-600' : 'text-neutral-400'}`} />
                          <span className="text-sm font-medium">Siparişler</span>
                          {detectedSheets.detected.orders ? (
                            <CheckCircle2 className="h-4 w-4 text-blue-600 ml-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-neutral-400 ml-auto" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          {detectedSheets.detected.orders || 'Bulunamadı'}
                        </p>
                      </div>

                      {/* Tickets */}
                      <div className={`p-3 rounded-lg border ${detectedSheets.detected.tickets ? 'bg-orange-50 border-orange-200' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex items-center gap-2">
                          <Wrench className={`h-4 w-4 ${detectedSheets.detected.tickets ? 'text-orange-600' : 'text-neutral-400'}`} />
                          <span className="text-sm font-medium">Servis</span>
                          {detectedSheets.detected.tickets ? (
                            <CheckCircle2 className="h-4 w-4 text-orange-600 ml-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-neutral-400 ml-auto" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          {detectedSheets.detected.tickets || 'Bulunamadı'}
                        </p>
                      </div>
                    </div>
                  ) : detecting ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">Sheet&apos;ler tespit edilmedi</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync Card */}
          {status.selectedSpreadsheet && (
            <Card>
              <CardHeader>
                <CardTitle>Senkronizasyon</CardTitle>
                <CardDescription>
                  Spreadsheet verilerini sisteminize aktarın
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Expected Format Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Beklenen Sheet İsimleri ve Kolonlar
                  </h4>

                  <div className="space-y-2 text-sm text-blue-800">
                    <div>
                      <span className="font-medium">Ürünler:</span>
                      <span className="font-mono text-xs ml-2">SKU, Name, Description, Price, Stock, MinStock, Category</span>
                    </div>
                    <div>
                      <span className="font-medium">Siparişler:</span>
                      <span className="font-mono text-xs ml-2">OrderNumber, CustomerPhone, CustomerName, Status, TrackingNumber, Carrier, TotalAmount, EstimatedDelivery</span>
                    </div>
                    <div>
                      <span className="font-medium">Servis:</span>
                      <span className="font-mono text-xs ml-2">TicketNumber, CustomerPhone, CustomerName, Product, Issue, Status, Notes, EstimatedCompletion, Cost</span>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSync} disabled={syncing} className="w-full">
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Senkronize Ediliyor...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tümünü Senkronize Et
                    </>
                  )}
                </Button>

                {/* Sync Results */}
                {syncResults && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                    <h4 className="text-sm font-medium text-green-900 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Senkronizasyon Sonuçları
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {/* Products Result */}
                      <div className="p-2 bg-white rounded border">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Ürünler</span>
                        </div>
                        <div className="text-xs text-neutral-600 space-y-0.5">
                          <div>{syncResults.products.imported} yeni</div>
                          <div>{syncResults.products.updated} güncellendi</div>
                          <div className="text-neutral-400">Toplam: {syncResults.products.total}</div>
                        </div>
                      </div>

                      {/* Orders Result */}
                      <div className="p-2 bg-white rounded border">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Siparişler</span>
                        </div>
                        <div className="text-xs text-neutral-600 space-y-0.5">
                          <div>{syncResults.orders.imported} yeni</div>
                          <div>{syncResults.orders.updated} güncellendi</div>
                          <div className="text-neutral-400">Toplam: {syncResults.orders.total}</div>
                        </div>
                      </div>

                      {/* Tickets Result */}
                      <div className="p-2 bg-white rounded border">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="h-4 w-4 text-orange-600" />
                          <span className="font-medium">Servis</span>
                        </div>
                        <div className="text-xs text-neutral-600 space-y-0.5">
                          <div>{syncResults.tickets.imported} yeni</div>
                          <div>{syncResults.tickets.updated} güncellendi</div>
                          <div className="text-neutral-400">Toplam: {syncResults.tickets.total}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {status.lastSync && (
                  <p className="text-sm text-neutral-500 text-center">
                    Son senkronizasyon: {formatDate(status.lastSync)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

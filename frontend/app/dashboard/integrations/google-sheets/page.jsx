/**
 * Google Sheets Integration Page
 * OAuth-based connection for inventory management via Google Sheets
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
  Loader2
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

  const [status, setStatus] = useState({
    connected: false,
    selectedSpreadsheet: null,
    selectedSheet: null,
    lastSync: null
  });

  const [spreadsheets, setSpreadsheets] = useState([]);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState(null);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);

  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      toast.success('Google Sheets bağlantısı başarılı!');
      // Clean URL
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

  // Load spreadsheet info when selected
  useEffect(() => {
    if (status.selectedSpreadsheet) {
      loadSpreadsheetInfo(status.selectedSpreadsheet);
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

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await apiClient.get('/api/google-sheets/auth-url');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to start OAuth:', error);
      toast.error(error.response?.data?.error || 'Bağlantı başlatılamadı');
      setConnecting(false);
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
      }
    } catch (error) {
      toast.error('Spreadsheet seçilemedi');
    }
  };

  const handleSelectSheet = async (sheetName) => {
    if (!status.selectedSpreadsheet) return;

    try {
      const response = await apiClient.post('/api/google-sheets/select', {
        spreadsheetId: status.selectedSpreadsheet,
        sheetName
      });

      if (response.data.success) {
        toast.success('Sheet seçildi');
        setStatus(prev => ({
          ...prev,
          selectedSheet: sheetName
        }));
      }
    } catch (error) {
      toast.error('Sheet seçilemedi');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await apiClient.post('/api/google-sheets/sync');

      if (response.data.success) {
        toast.success(
          `Senkronizasyon tamamlandı! ${response.data.imported} yeni, ${response.data.updated} güncellendi`
        );
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
        toast.success('Template oluşturuldu!');
        // Open the new spreadsheet in a new tab
        window.open(response.data.spreadsheet.spreadsheetUrl, '_blank');
        // Reload spreadsheets list
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
            Ürün ve stok bilgilerinizi Google Sheets ile senkronize edin
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
                Yeni Spreadsheet Oluştur
              </CardTitle>
              <CardDescription>
                Hazır formatlı bir envanter şablonu oluşturun
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
                  Otomatik olarak &quot;Telyx Inventory Template&quot; adında bir spreadsheet oluşturulur
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
                Envanter verilerinizi okuyacağınız spreadsheet&apos;i seçin
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

              {/* Sheet Select (if spreadsheet selected) */}
              {spreadsheetInfo && spreadsheetInfo.sheets && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sheet (Sayfa)</label>
                  <Select
                    value={status.selectedSheet || ''}
                    onValueChange={handleSelectSheet}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sheet seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {spreadsheetInfo.sheets.map((sheet) => (
                        <SelectItem key={sheet.sheetId} value={sheet.title}>
                          {sheet.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Selected Spreadsheet Info */}
              {status.selectedSpreadsheet && spreadsheetInfo && (
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{spreadsheetInfo.title}</p>
                      <p className="text-sm text-neutral-500">
                        Seçili sheet: {status.selectedSheet || 'Belirlenmedi'}
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
            </CardContent>
          </Card>

          {/* Sync Card */}
          {status.selectedSpreadsheet && (
            <Card>
              <CardHeader>
                <CardTitle>Senkronizasyon</CardTitle>
                <CardDescription>
                  Spreadsheet verilerini ürün envanterinize aktarın
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Beklenen Kolon Formatı
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-800">
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">SKU</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">Name</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">Description</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">Price</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">Stock</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">MinStock</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">Category</span>
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
                      Şimdi Senkronize Et
                    </>
                  )}
                </Button>

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

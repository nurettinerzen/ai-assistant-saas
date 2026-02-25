'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, AlertTriangle, AlertCircle, Activity,
  Clock, Server, Eye, ChevronLeft, ChevronRight,
  Bug, Wrench, MessageSquare, Globe, CheckCircle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';

const ADMIN_EMAILS = ['nurettin@telyx.ai', 'admin@telyx.ai'];

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const HEALTH_STATUS_COLORS = {
  healthy: 'text-green-600 dark:text-green-400',
  caution: 'text-yellow-600 dark:text-yellow-400',
  warning: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

const EVENT_TYPE_LABELS = {
  auth_failure: 'Auth Failure',
  cross_tenant_attempt: 'Cross-Tenant Attempt',
  firewall_block: 'Firewall Block',
  content_safety_block: 'Content Safety Block',
  ssrf_block: 'SSRF Block',
  rate_limit_hit: 'Rate Limit Hit',
  webhook_invalid_signature: 'Webhook Invalid Signature',
  pii_leak_block: 'PII Leak Block',
};

const ERROR_CATEGORY_LABELS = {
  tool_failure: 'Tool Failure',
  chat_error: 'Chat Error',
  assistant_error: 'Assistant Error',
  api_error: 'External API Error',
  system_error: 'System Error',
  webhook_error: 'Webhook Error',
};

const ERROR_CATEGORY_ICONS = {
  tool_failure: Wrench,
  chat_error: MessageSquare,
  assistant_error: Server,
  api_error: Globe,
  system_error: AlertCircle,
  webhook_error: Activity,
};


export default function RedAlertPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [topThreats, setTopThreats] = useState({ topIPs: [], topEndpoints: [] });
  const [health, setHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('errors');
  const [filters, setFilters] = useState({
    hours: 24,
    severity: '',
    type: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });

  // Error Tracking State
  const [errorSummary, setErrorSummary] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorFilters, setErrorFilters] = useState({
    category: '',
    severity: '',
    resolved: '',
  });
  const [errorPagination, setErrorPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });
  const [expandedErrors, setExpandedErrors] = useState(new Set());

  // Check admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await apiClient.get('/api/auth/me');
        const userEmail = response.data?.email;
        if (ADMIN_EMAILS.includes(userEmail)) {
          setIsAdmin(true);
          loadDashboardData();
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to check admin access:', error);
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, []);

  // Load all dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        loadEvents(),
        loadTimeline(),
        loadTopThreats(),
        loadHealth(),
        loadErrorSummary(),
        loadErrorLogs(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/summary', {
        params: { hours: filters.hours },
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/events', {
        params: {
          hours: filters.hours,
          severity: filters.severity || undefined,
          type: filters.type || undefined,
          limit: pagination.limit,
          offset: (pagination.page - 1) * pagination.limit,
        },
      });
      setEvents(response.data.events);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        hasMore: response.data.pagination.hasMore,
      }));
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadTimeline = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/timeline', {
        params: { hours: filters.hours },
      });
      setTimeline(response.data.timeline);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    }
  };

  const loadTopThreats = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/top-threats', {
        params: { hours: filters.hours },
      });
      setTopThreats(response.data);
    } catch (error) {
      console.error('Failed to load top threats:', error);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/health');
      setHealth(response.data);
    } catch (error) {
      console.error('Failed to load health:', error);
    }
  };

  // Error Tracking Data Loaders
  const loadErrorSummary = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/errors/summary', {
        params: { hours: filters.hours },
      });
      setErrorSummary(response.data);
    } catch (error) {
      console.error('Failed to load error summary:', error);
    }
  };

  const loadErrorLogs = async () => {
    try {
      const response = await apiClient.get('/api/red-alert/errors', {
        params: {
          hours: filters.hours,
          category: errorFilters.category || undefined,
          severity: errorFilters.severity || undefined,
          resolved: errorFilters.resolved !== '' ? errorFilters.resolved : undefined,
          limit: errorPagination.limit,
          offset: (errorPagination.page - 1) * errorPagination.limit,
        },
      });
      setErrorLogs(response.data.errors);
      setErrorPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        hasMore: response.data.pagination.hasMore,
      }));
    } catch (error) {
      console.error('Failed to load error logs:', error);
    }
  };

  const handleResolveError = async (errorId, resolved) => {
    try {
      await apiClient.patch(`/api/red-alert/errors/${errorId}/resolve`, { resolved });
      toast.success(resolved ? 'Hata çözüldü olarak işaretlendi' : 'Hata tekrar açıldı');
      loadErrorLogs();
      loadErrorSummary();
      loadHealth();
    } catch (error) {
      console.error('Failed to resolve error:', error);
      toast.error('Hata durumu güncellenemedi');
    }
  };

  const toggleErrorExpand = (errorId) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(errorId)) next.delete(errorId);
      else next.add(errorId);
      return next;
    });
  };

  // Reload data when filters change
  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [filters.hours, filters.severity, filters.type]);

  // Reload events when pagination changes
  useEffect(() => {
    if (isAdmin && pagination.page > 1) {
      loadEvents();
    }
  }, [pagination.page]);

  // Reload error logs when error filters or pagination change
  useEffect(() => {
    if (isAdmin) {
      loadErrorLogs();
    }
  }, [errorFilters.category, errorFilters.severity, errorFilters.resolved, errorPagination.page]);

  if (!isAdmin && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the Red Alert dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Red Alert - Güvenlik Paneli
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Güvenlik olayları ve uygulama hatalarını gerçek zamanlı izleme
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Time Range Filter */}
      <div className="mb-6">
        <Select
          value={filters.hours.toString()}
          onValueChange={(value) => setFilters(prev => ({ ...prev, hours: parseInt(value) }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Son 1 Saat</SelectItem>
            <SelectItem value="6">Son 6 Saat</SelectItem>
            <SelectItem value="24">Son 24 Saat</SelectItem>
            <SelectItem value="168">Son 7 Gün</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Health Score Card */}
      {health && (
        <Card className="mb-4 border-2 border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className={`h-4 w-4 ${HEALTH_STATUS_COLORS[health.status]}`} />
              Güvenlik Sağlık Skoru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${HEALTH_STATUS_COLORS[health.status]}`}>
                  {health.healthScore}
                </div>
                <div className="text-xs text-muted-foreground mt-1">/ 100</div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {health.events.critical}
                  </div>
                  <div className="text-xs text-muted-foreground">Kritik</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {health.events.high}
                  </div>
                  <div className="text-xs text-muted-foreground">Yüksek</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold">
                    {health.events.total}
                  </div>
                  <div className="text-xs text-muted-foreground">Toplam</div>
                </div>
              </div>
              <div className="text-center">
                <Badge className={SEVERITY_COLORS[health.status] + ' text-sm px-3 py-1'}>
                  {health.status.toUpperCase()}
                </Badge>
                {health.events.total === 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Tehdit tespit edilmedi</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats — Clickable cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {summary && (
          <>
            <Card
              className="cursor-pointer transition-colors hover:border-blue-400 dark:hover:border-blue-600"
              onClick={() => {
                setFilters(prev => ({ ...prev, severity: '' }));
                setActiveTab('events');
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Güvenlik Olayları</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.summary.total}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.summary.critical > 0
                    ? `${summary.summary.critical} kritik`
                    : 'Kritik olay yok'}
                </p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-colors hover:border-red-400 dark:hover:border-red-600 ${
                summary.summary.critical > 0 ? 'border-red-300 dark:border-red-800' : ''
              }`}
              onClick={() => {
                setFilters(prev => ({ ...prev, severity: 'critical' }));
                setActiveTab('events');
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Kritik Olaylar</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.summary.critical}
                </div>
                <p className="text-xs text-muted-foreground">
                  Acil müdahale gerekli
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {errorSummary && (
          <Card
            className={`cursor-pointer transition-colors hover:border-orange-400 dark:hover:border-orange-600 ${
              errorSummary.summary.unresolved > 0 ? 'border-orange-300 dark:border-orange-800' : ''
            }`}
            onClick={() => {
              setErrorFilters(prev => ({ ...prev, resolved: '' }));
              setActiveTab('errors');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Uygulama Hataları</CardTitle>
              <Bug className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {errorSummary.summary.total}
              </div>
              <p className="text-xs text-muted-foreground">
                {errorSummary.summary.unresolved > 0
                  ? <span className="text-red-500 font-medium">{errorSummary.summary.unresolved} çözülmemiş</span>
                  : 'Tümü çözüldü'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors">
            <Bug className="h-4 w-4 mr-2" />
            Hatalar
            {errorSummary?.summary?.unresolved > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                {errorSummary.summary.unresolved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            <Eye className="h-4 w-4 mr-2" />
            Güvenlik Olayları
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-4 w-4 mr-2" />
            Zaman Çizelgesi
          </TabsTrigger>
          <TabsTrigger value="threats">
            <AlertCircle className="h-4 w-4 mr-2" />
            Tehdit Kaynakları
          </TabsTrigger>
        </TabsList>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Uygulama Hataları
              </CardTitle>
              <CardDescription>
                Araç hataları, API hataları, sistem hataları ve diğerleri
              </CardDescription>
              <div className="flex gap-4 mt-4">
                <Select
                  value={errorFilters.category || 'all'}
                  onValueChange={(value) => {
                    setErrorFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }));
                    setErrorPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm Kategoriler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                    {Object.entries(ERROR_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={errorFilters.severity || 'all'}
                  onValueChange={(value) => {
                    setErrorFilters(prev => ({ ...prev, severity: value === 'all' ? '' : value }));
                    setErrorPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm Önem Dereceleri" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Önem Dereceleri</SelectItem>
                    <SelectItem value="medium">Orta</SelectItem>
                    <SelectItem value="high">Yüksek</SelectItem>
                    <SelectItem value="critical">Kritik</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={errorFilters.resolved !== '' ? errorFilters.resolved : 'all'}
                  onValueChange={(value) => {
                    setErrorFilters(prev => ({ ...prev, resolved: value === 'all' ? '' : value }));
                    setErrorPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm Durumlar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="false">Çözülmemiş</SelectItem>
                    <SelectItem value="true">Çözülmüş</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Son Görülme</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Önem</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Mesaj</TableHead>
                    <TableHead className="text-center">Tekrar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Hata bulunamadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    errorLogs.map((err) => {
                      const CategoryIcon = ERROR_CATEGORY_ICONS[err.category] || AlertCircle;
                      const isExpanded = expandedErrors.has(err.id);
                      return (
                        <React.Fragment key={err.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleErrorExpand(err.id)}
                          >
                            <TableCell>
                              {isExpanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              }
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {new Date(err.lastSeenAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">{ERROR_CATEGORY_LABELS[err.category] || err.category}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={SEVERITY_COLORS[err.severity]}>
                                {err.severity.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs">{err.source}</code>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs" title={err.message}>
                              {err.message}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono">
                                {err.occurrenceCount}x
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {err.resolved ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Çözüldü
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  Açık
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveError(err.id, !err.resolved);
                                }}
                              >
                                {err.resolved ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                                  {err.toolName && (
                                    <div>
                                      <span className="text-muted-foreground">Tool:</span>{' '}
                                      <code>{err.toolName}</code>
                                    </div>
                                  )}
                                  {err.externalService && (
                                    <div>
                                      <span className="text-muted-foreground">Service:</span>{' '}
                                      <code>{err.externalService}</code>
                                      {err.externalStatus && <span className="ml-1">({err.externalStatus})</span>}
                                    </div>
                                  )}
                                  {err.endpoint && (
                                    <div>
                                      <span className="text-muted-foreground">Endpoint:</span>{' '}
                                      <code>{err.method} {err.endpoint}</code>
                                    </div>
                                  )}
                                  {err.errorCode && (
                                    <div>
                                      <span className="text-muted-foreground">Code:</span>{' '}
                                      <code>{err.errorCode}</code>
                                    </div>
                                  )}
                                  {err.businessId && (
                                    <div>
                                      <span className="text-muted-foreground">Business:</span>{' '}
                                      {err.businessId}
                                    </div>
                                  )}
                                  {err.requestId && (
                                    <div>
                                      <span className="text-muted-foreground">Request:</span>{' '}
                                      <code className="text-xs">{err.requestId}</code>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">First Seen:</span>{' '}
                                    {new Date(err.firstSeenAt).toLocaleString()}
                                  </div>
                                  {err.responseTimeMs && (
                                    <div>
                                      <span className="text-muted-foreground">Response Time:</span>{' '}
                                      {err.responseTimeMs}ms
                                    </div>
                                  )}
                                </div>
                                {err.stackTrace && (
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">Stack Trace:</div>
                                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                                      {err.stackTrace}
                                    </pre>
                                  </div>
                                )}
                                {err.resolvedBy && (
                                  <div className="text-xs mt-2 text-muted-foreground">
                                    Resolved by {err.resolvedBy} at {new Date(err.resolvedAt).toLocaleString()}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Error Pagination */}
              {errorPagination.total > errorPagination.limit && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {((errorPagination.page - 1) * errorPagination.limit) + 1} -{' '}
                    {Math.min(errorPagination.page * errorPagination.limit, errorPagination.total)} / toplam{' '}
                    {errorPagination.total} hata
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setErrorPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={errorPagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Önceki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setErrorPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!errorPagination.hasMore}
                    >
                      Sonraki
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Güvenlik Olayları</CardTitle>
              <CardDescription>
                Filtreleme seçenekleri ile güvenlik olayları
              </CardDescription>
              <div className="flex gap-4 mt-4">
                <Select
                  value={filters.severity || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value === 'all' ? '' : value, page: 1 }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm Önem Dereceleri" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Önem Dereceleri</SelectItem>
                    <SelectItem value="low">Düşük</SelectItem>
                    <SelectItem value="medium">Orta</SelectItem>
                    <SelectItem value="high">Yüksek</SelectItem>
                    <SelectItem value="critical">Kritik</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.type || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, type: value === 'all' ? '' : value, page: 1 }))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Tüm Olay Türleri" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Olay Türleri</SelectItem>
                    {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Önem</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Metod</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>IP Adresi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Güvenlik olayı bulunamadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{EVENT_TYPE_LABELS[event.type] || event.type}</code>
                        </TableCell>
                        <TableCell>
                          <Badge className={SEVERITY_COLORS[event.severity]}>
                            {event.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{event.endpoint || '-'}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.method || '-'}</Badge>
                        </TableCell>
                        <TableCell>{event.statusCode || '-'}</TableCell>
                        <TableCell>
                          <code className="text-xs">{event.ipAddress || '-'}</code>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {((pagination.page - 1) * pagination.limit) + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} / toplam{' '}
                    {pagination.total} olay
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Önceki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.hasMore}
                    >
                      Sonraki
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Olay Zaman Çizelgesi</CardTitle>
              <CardDescription>
                Saatlik olay dağılımı
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  Zaman çizelgesi verisi yok
                </div>
              ) : (
                <LineChart
                  data={timeline.map(t => ({
                    time: new Date(t.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    }),
                    events: t.count,
                  }))}
                  dataKey="events"
                  xAxisKey="time"
                  color="#ef4444"
                  height={400}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Threats Tab */}
        <TabsContent value="threats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>En Çok Tehdit IP'leri</CardTitle>
                <CardDescription>
                  En fazla güvenlik olayı üreten IP adresleri
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topThreats.topIPs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Tehdit verisi yok
                  </div>
                ) : (
                  <BarChart
                    data={topThreats.topIPs.map(t => ({
                      ip: t.ip,
                      count: t.count,
                    }))}
                    dataKey="count"
                    xAxisKey="ip"
                    horizontal={true}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>En Çok Hedeflenen Endpoint'ler</CardTitle>
                <CardDescription>
                  En fazla saldırıya uğrayan API endpoint'leri
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topThreats.topEndpoints.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Tehdit verisi yok
                  </div>
                ) : (
                  <BarChart
                    data={topThreats.topEndpoints.map(t => ({
                      endpoint: t.endpoint.replace('/api/', ''),
                      count: t.count,
                    }))}
                    dataKey="count"
                    xAxisKey="endpoint"
                    horizontal={true}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

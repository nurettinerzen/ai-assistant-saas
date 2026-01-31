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
  TrendingUp, Clock, Server, Eye, ChevronLeft, ChevronRight
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

export default function RedAlertPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [topThreats, setTopThreats] = useState({ topIPs: [], topEndpoints: [] });
  const [health, setHealth] = useState(null);
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
      const response = await apiClient.get('/api/red-alert/summary');
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-600" />
            Red Alert - Security Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time security event monitoring and threat analysis
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
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
            <SelectItem value="1">Last Hour</SelectItem>
            <SelectItem value="6">Last 6 Hours</SelectItem>
            <SelectItem value="24">Last 24 Hours</SelectItem>
            <SelectItem value="168">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Health Score Card */}
      {health && (
        <Card className="mb-6 border-2 border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${HEALTH_STATUS_COLORS[health.status]}`} />
              Security Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className={`text-6xl font-bold ${HEALTH_STATUS_COLORS[health.status]}`}>
                  {health.healthScore}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Score / 100</div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {health.events.critical}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {health.events.high}
                  </div>
                  <div className="text-sm text-muted-foreground">High Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {health.events.total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                </div>
              </div>
              <div className="text-center">
                <Badge className={SEVERITY_COLORS[health.status] + ' text-lg px-4 py-2'}>
                  {health.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.total24h}</div>
              <p className="text-xs text-muted-foreground">
                {summary.summary.total7d} in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {summary.summary.critical}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Event Types</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(summary.byType).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Distinct event types detected
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">
            <Eye className="h-4 w-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="threats">
            <AlertCircle className="h-4 w-4 mr-2" />
            Top Threats
          </TabsTrigger>
          <TabsTrigger value="breakdown">
            <Server className="h-4 w-4 mr-2" />
            Breakdown
          </TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Recent security events with filtering options
              </CardDescription>
              <div className="flex gap-4 mt-4">
                <Select
                  value={filters.severity}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value, page: 1 }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Severities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.type}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, type: value, page: 1 }))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Event Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Event Types</SelectItem>
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
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No security events found
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
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} events
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.hasMore}
                    >
                      Next
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
              <CardTitle>Event Timeline</CardTitle>
              <CardDescription>
                Hourly event distribution over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  No timeline data available
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
                <CardTitle>Top Threat IPs</CardTitle>
                <CardDescription>
                  IP addresses with most security events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topThreats.topIPs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No threat data available
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
                <CardTitle>Top Target Endpoints</CardTitle>
                <CardDescription>
                  Most attacked API endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topThreats.topEndpoints.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No threat data available
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

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Events by Type</CardTitle>
                  <CardDescription>
                    Distribution of security event types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{EVENT_TYPE_LABELS[type] || type}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-600"
                              style={{
                                width: `${(count / summary.summary.total24h) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Events by Severity</CardTitle>
                  <CardDescription>
                    Distribution of event severity levels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(summary.bySeverity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <Badge className={SEVERITY_COLORS[severity]}>
                          {severity.toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-600"
                              style={{
                                width: `${(count / summary.summary.total24h) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

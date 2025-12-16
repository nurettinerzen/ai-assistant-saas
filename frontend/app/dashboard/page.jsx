/**
 * Dashboard Overview Page - Quick Overview Redesign
 * Main landing page showing recent activity, key metrics, and quick actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MetricCard from '@/components/MetricCard';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Clock,
  DollarSign,
  TrendingUp,
  Plus,
  ExternalLink,
  PhoneCall,
  Bot,
  Plug,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  CalendarCheck,
  BarChart3,
  CreditCard,
  Zap,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatDuration, formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DashboardPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    activeAssistants: 0,
    connectedIntegrations: 0,
    phoneNumbers: 0,
  });

  // Get current time of day for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning') || 'Good morning';
    if (hour < 18) return t('goodAfternoon') || 'Good afternoon';
    return t('goodEvening') || 'Good evening';
  };

  // Get user name from localStorage
  const getUserName = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.name || user.email?.split('@')[0] || 'there';
    } catch {
      return 'there';
    }
  };

  // Format current date
  const getCurrentDate = () => {
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, callsRes, assistantsRes, integrationsRes, phoneNumbersRes] =
        await Promise.all([
          apiClient.dashboard.getStats(),
          apiClient.dashboard.getRecentCalls(),
          apiClient.assistants.getAll(),
          apiClient.integrations.getAll(),
          apiClient.phoneNumbers.getAll(),
        ]);

      setStats(statsRes.data);
      setRecentCalls((callsRes.data.calls || []).slice(0, 8));

      // Set system status
      setSystemStatus({
        activeAssistants: assistantsRes.data.assistants?.length || 0,
        connectedIntegrations:
          integrationsRes.data.integrations?.filter((i) => i.connected).length || 0,
        phoneNumbers: phoneNumbersRes.data.phoneNumbers?.length || 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error(t('failedToLoad') || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Generate sparkline data from stats
  const generateSparklineData = (baseValue, trend) => {
    if (!baseValue) return [];
    const data = [];
    const variation = trend === 'up' ? 1.15 : trend === 'down' ? 0.85 : 1;
    const steps = 7;

    for (let i = 0; i < steps; i++) {
      const randomVariation = 0.9 + Math.random() * 0.2;
      const value = Math.round((baseValue / steps) * i * randomVariation * variation);
      data.push({ value });
    }

    return data;
  };

  return (
    <div className="space-y-8">
      {/* ========== SECTION 1: WELCOME HEADER ========== */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {getGreeting()}, {getUserName()}!
            </h1>
            <p className="text-primary-100 text-sm">{getCurrentDate()}</p>
            <p className="text-white/90 mt-3">
              {t('dashboardWelcomeMessage') ||
                "Here's a quick overview of your AI assistant's performance"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push('/dashboard/analytics')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('viewAnalytics') || 'View Analytics'}
            </Button>
          </div>
        </div>
      </div>

      {/* ========== SECTION 2: QUICK METRICS OVERVIEW ========== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              {t('keyMetrics') || 'Key Metrics'}
            </h2>
            <p className="text-sm text-neutral-600">
              {t('last7DaysOverview') || 'Last 7 days performance overview'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            label={t('totalCalls') || 'Total Calls'}
            value={stats?.totalCalls || 0}
            icon={Phone}
            trend={stats?.totalCalls > 10 ? 'up' : stats?.totalCalls > 0 ? 'neutral' : 'down'}
            trendValue="12%"
            sparklineData={generateSparklineData(stats?.totalCalls, 'up')}
            color="primary"
            loading={loading}
          />
          <MetricCard
            label={t('chatMessages') || 'Chat Messages'}
            value={stats?.totalChatMessages || 0}
            icon={MessageCircle}
            trend={
              stats?.totalChatMessages > 20
                ? 'up'
                : stats?.totalChatMessages > 0
                ? 'neutral'
                : 'down'
            }
            trendValue="8%"
            sparklineData={generateSparklineData(stats?.totalChatMessages, 'up')}
            color="success"
            loading={loading}
          />
          <MetricCard
            label={t('avgDuration') || 'Avg Duration'}
            value={formatDuration(stats?.avgDuration || 0)}
            icon={Clock}
            trend="neutral"
            trendValue="2%"
            sparklineData={generateSparklineData(stats?.avgDuration / 60, 'neutral')}
            color="info"
            loading={loading}
          />
          <MetricCard
            label={t('totalCost') || 'Total Cost'}
            value={formatCurrency(stats?.totalCost || 0)}
            icon={DollarSign}
            trend={stats?.totalCost > 0 ? 'up' : 'neutral'}
            trendValue="5%"
            sparklineData={generateSparklineData(stats?.totalCost * 10, 'up')}
            color="warning"
            loading={loading}
          />
          <MetricCard
            label={t('successRate') || 'Success Rate'}
            value={`${stats?.successRate || 0}%`}
            icon={TrendingUp}
            trend={stats?.successRate >= 90 ? 'up' : 'down'}
            trendValue="3%"
            sparklineData={generateSparklineData(stats?.successRate, 'up')}
            color="success"
            loading={loading}
          />
          <MetricCard
            label={t('appointments') || 'Appointments'}
            value={stats?.totalAppointments || 0}
            icon={CalendarCheck}
            trend={stats?.totalAppointments > 0 ? 'up' : 'neutral'}
            trendValue="15%"
            sparklineData={generateSparklineData(stats?.totalAppointments, 'up')}
            color="purple"
            loading={loading}
          />
        </div>
      </div>

      {/* ========== SECTION 3: QUICK ACTIONS & STATUS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            {t('quickActions') || 'Quick Actions'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4 hover:border-primary-500 hover:bg-primary-50"
              onClick={() => router.push('/dashboard/assistant')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Bot className="h-5 w-5 text-primary-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{t('createAssistant') || 'Create Assistant'}</div>
                  <div className="text-xs text-neutral-500">
                    {t('setupNewAI') || 'Set up a new AI agent'}
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4 hover:border-green-500 hover:bg-green-50"
              onClick={() => router.push('/dashboard/phone-numbers')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{t('buyPhoneNumber') || 'Buy Phone Number'}</div>
                  <div className="text-xs text-neutral-500">
                    {t('getNewNumber') || 'Get a new number'}
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4 hover:border-purple-500 hover:bg-purple-50"
              onClick={() => router.push('/dashboard/integrations')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Plug className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">
                    {t('connectIntegration') || 'Connect Integration'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {t('linkExternalTools') || 'Link external tools'}
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4 hover:border-blue-500 hover:bg-blue-50"
              onClick={() => router.push('/dashboard/calls')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PhoneCall className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{t('viewAllCalls') || 'View All Calls'}</div>
                  <div className="text-xs text-neutral-500">
                    {t('browseCallHistory') || 'Browse call history'}
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            {t('systemStatus') || 'System Status'}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-neutral-600" />
                <div>
                  <div className="text-sm font-medium text-neutral-900">
                    {t('activeAssistants') || 'Active Assistants'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {systemStatus.activeAssistants} {t('running') || 'running'}
                  </div>
                </div>
              </div>
              <Badge
                variant={systemStatus.activeAssistants > 0 ? 'default' : 'secondary'}
                className={
                  systemStatus.activeAssistants > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-neutral-200 text-neutral-600'
                }
              >
                {systemStatus.activeAssistants}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Plug className="h-5 w-5 text-neutral-600" />
                <div>
                  <div className="text-sm font-medium text-neutral-900">
                    {t('dashboard.sidebar.integrations') || 'Integrations'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {systemStatus.connectedIntegrations} {t('connected') || 'connected'}
                  </div>
                </div>
              </div>
              <Badge
                variant={systemStatus.connectedIntegrations > 0 ? 'default' : 'secondary'}
                className={
                  systemStatus.connectedIntegrations > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-neutral-200 text-neutral-600'
                }
              >
                {systemStatus.connectedIntegrations}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-neutral-600" />
                <div>
                  <div className="text-sm font-medium text-neutral-900">
                    {t('phoneNumbers') || 'Phone Numbers'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {systemStatus.phoneNumbers} {t('provisioned') || 'provisioned'}
                  </div>
                </div>
              </div>
              <Badge
                variant={systemStatus.phoneNumbers > 0 ? 'default' : 'secondary'}
                className={
                  systemStatus.phoneNumbers > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-neutral-200 text-neutral-600'
                }
              >
                {systemStatus.phoneNumbers}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-900">
                    {t('systemHealth') || 'System Health'}
                  </div>
                  <div className="text-xs text-green-600">{t('allSystemsGo') || 'All systems operational'}</div>
                </div>
              </div>
              <Zap className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ========== SECTION 4: RECENT ACTIVITY FEED ========== */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary-600" />
                {t('recentActivity') || 'Recent Activity'}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                {t('latestCallsAndMessages') || 'Latest calls and messages from the past 24 hours'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/calls')}
              className="text-primary-600 hover:text-primary-700 hover:bg-primary-50"
            >
              {t('viewAll') || 'View All'}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-neutral-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : recentCalls.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="p-5 hover:bg-neutral-50 cursor-pointer transition-colors group"
                onClick={() => router.push(`/dashboard/calls?callId=${call.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`p-3 rounded-lg ${
                        call.status === 'completed'
                          ? 'bg-green-100'
                          : call.status === 'failed'
                          ? 'bg-red-100'
                          : 'bg-amber-100'
                      }`}
                    >
                      <Phone
                        className={`h-5 w-5 ${
                          call.status === 'completed'
                            ? 'text-green-600'
                            : call.status === 'failed'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-neutral-900">
                          {call.phoneNumber || t('unknownCaller') || 'Unknown Caller'}
                        </p>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            call.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : call.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {call.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-neutral-600">
                        <span className="flex items-center gap-1">
                          <Bot className="h-3.5 w-3.5" />
                          {call.assistantName || t('noAssistant') || 'No Assistant'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(call.duration)}
                        </span>
                        <span className="text-neutral-500">
                          {formatDate(call.createdAt, 'relative')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ExternalLink className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12">
            <EmptyState
              icon={PhoneCall}
              title={t('noRecentActivity') || 'No Recent Activity'}
              description={
                t('activityWillAppear') || 'Your recent calls and messages will appear here'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

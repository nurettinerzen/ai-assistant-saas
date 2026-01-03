/**
 * Dashboard Overview Page
 * Clean, minimal design inspired by 11Labs and Retell AI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GradientLoaderInline } from '@/components/GradientLoader';
import EmptyState from '@/components/EmptyState';
import {
  Phone,
  Clock,
  TrendingUp,
  PhoneCall,
  Bot,
  Puzzle,
  CheckCircle2,
  MessageCircle,
  BarChart3,
  ArrowRight,
  Activity,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatDuration, getIntlLocale } from '@/lib/utils';
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.overviewPage.goodMorning');
    if (hour < 18) return t('dashboard.overviewPage.goodAfternoon');
    return t('dashboard.overviewPage.goodEvening');
  };

  const getUserName = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.name || user.email?.split('@')[0] || '';
    } catch {
      return '';
    }
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
      setRecentCalls((callsRes.data.calls || []).slice(0, 5));
      setSystemStatus({
        activeAssistants: assistantsRes.data.assistants?.length || 0,
        connectedIntegrations:
          integrationsRes.data.integrations?.filter((i) => i.connected).length || 0,
        phoneNumbers: phoneNumbersRes.data.phoneNumbers?.length || 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error(t('dashboard.overviewPage.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  // Stat Card Component - 11Labs style
  const StatCard = ({ label, value, icon: Icon, color = 'primary' }) => {
    const colorClasses = {
      primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20',
      success: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20',
      info: 'text-info-600 dark:text-info-400 bg-info-50 dark:bg-info-900/20',
      warning: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20',
    };

    return (
      <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {value}
            </p>
          </div>
          <div className={`p-2 rounded-md ${colorClasses[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <GradientLoaderInline text={t('dashboard.overviewPage.loadingDashboard') || 'Dashboard yükleniyor...'} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {getGreeting()}{getUserName() ? `, ${getUserName()}` : ''}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('dashboard.overviewPage.dashboardWelcomeMessage')}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/analytics')}>
          <BarChart3 className="h-4 w-4 mr-2" />
          {t('dashboard.overviewPage.viewAnalytics')}
        </Button>
      </div>

      {/* Stats Grid - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.overviewPage.totalCalls')}
          value={stats?.totalCalls || 0}
          icon={Phone}
          color="primary"
        />
        <StatCard
          label={t('dashboard.overviewPage.chatMessages')}
          value={stats?.totalChatMessages || 0}
          icon={MessageCircle}
          color="success"
        />
        <StatCard
          label={t('dashboard.overviewPage.avgDuration')}
          value={formatDuration(stats?.avgDuration || 0)}
          icon={Clock}
          color="info"
        />
        <StatCard
          label={t('dashboard.overviewPage.successRate')}
          value={`${stats?.successRate || 0}%`}
          icon={TrendingUp}
          color="success"
        />
      </div>

      {/* Quick Actions & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.overviewPage.quickActions')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard/assistant')}
              className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left"
            >
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-md">
                <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.overviewPage.createAssistant')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.overviewPage.setupNewAI')}
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/phone-numbers')}
              className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-800 hover:border-success-300 dark:hover:border-success-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left"
            >
              <div className="p-2 bg-success-50 dark:bg-success-900/20 rounded-md">
                <Phone className="h-4 w-4 text-success-600 dark:text-success-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.overviewPage.buyPhoneNumber')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.overviewPage.getNewNumber')}
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/integrations')}
              className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left"
            >
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                <Puzzle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.overviewPage.connectIntegration')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.overviewPage.linkExternalTools')}
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/calls')}
              className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-800 hover:border-info-300 dark:hover:border-info-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left"
            >
              <div className="p-2 bg-info-50 dark:bg-info-900/20 rounded-md">
                <PhoneCall className="h-4 w-4 text-info-600 dark:text-info-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.overviewPage.viewAllCalls')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.overviewPage.latestCallActivity')}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.overviewPage.systemStatus')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('dashboard.overviewPage.activeAssistantsLabel')}
                </span>
              </div>
              <Badge className={systemStatus.activeAssistants > 0 ? 'badge-success' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}>
                {systemStatus.activeAssistants}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-2">
                <Puzzle className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('dashboard.overviewPage.integrations')}
                </span>
              </div>
              <Badge className={systemStatus.connectedIntegrations > 0 ? 'badge-success' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}>
                {systemStatus.connectedIntegrations}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('dashboard.overviewPage.phoneNumbers')}
                </span>
              </div>
              <Badge className={systemStatus.phoneNumbers > 0 ? 'badge-success' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}>
                {systemStatus.phoneNumbers}
              </Badge>
            </div>

            <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-md border border-success-200 dark:border-success-800">
              <CheckCircle2 className="h-4 w-4 text-success-600 dark:text-success-400" />
              <span className="text-sm font-medium text-success-700 dark:text-success-400">
                {t('dashboard.overviewPage.allSystemsGo')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('dashboard.overviewPage.recentActivity')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/calls')}
          >
            {t('dashboard.overviewPage.viewAll')}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {recentCalls.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/calls?callId=${call.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'completed' ? 'bg-success-500' :
                      call.status === 'failed' ? 'bg-error-500' : 'bg-warning-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {call.phoneNumber || t('dashboard.overviewPage.unknownCaller')}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{call.assistantName || t('dashboard.overviewPage.noAssistant')}</span>
                        <span>{formatDuration(call.duration)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(call.createdAt, 'relative', locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={PhoneCall}
              title={t('dashboard.overviewPage.noRecentActivity')}
              description={t('dashboard.overviewPage.activityWillAppear')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dashboard Overview Page
 * Main dashboard with stats, charts, and recent activity
 * UPDATE EXISTING FILE: frontend/app/dashboard/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatsCard from '@/components/StatsCard';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import DemoCallWidget from '@/components/DemoCallWidget';
import {
  Phone,
  Clock,
  DollarSign,
  TrendingUp,
  Plus,
  ExternalLink,
  PhoneCall,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatDate, formatDuration, formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);

  useEffect(() => {
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
  setLoading(true);
  try {
    const [statsRes, chartRes, callsRes] = await Promise.all([
      apiClient.dashboard.getStats(),
      apiClient.dashboard.getChartData('7d'),
      apiClient.dashboard.getRecentCalls(),
    ]);

    setStats(statsRes.data);
    setChartData(chartRes.data.chartData || []);
    setRecentCalls(callsRes.data.calls || []);
  } catch (error) {
    toast.error('Failed to load dashboard data');
    console.error(error);
  } finally {
    setLoading(false);
  }
};

return (
  <div className="space-y-8">
    {/* Demo Call Widget - Prominent at top */}
    <DemoCallWidget locale={locale} />

    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.dashboardTitle')}</h1>
        <p className="text-neutral-600 mt-1">{t('dashboard.monitorPerformance')}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/dashboard/assistant')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.newAssistant')}
        </Button>
        <Button onClick={() => router.push('/dashboard/calls')}>
          {t('dashboard.viewAllCalls')}
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          label={t('dashboard.totalCallsLabel')}
          value={stats?.totalCalls || 0}
          icon={Phone}
          trend="up"
          trendValue="12%"
          color="primary"
          loading={loading}
        />
        <StatsCard
          label={t('dashboard.avgDurationLabel2')}
          value={formatDuration(stats?.avgDuration || 0)}
          icon={Clock}
          trend="down"
          trendValue="2%"
          color="info"
          loading={loading}
        />
        <StatsCard
          label={t('dashboard.totalCostLabel')}
          value={formatCurrency(stats?.totalCost || 0)}
          icon={DollarSign}
          trend="up"
          trendValue="8%"
          color="success"
          loading={loading}
        />
        <StatsCard
          label={t('dashboard.successRateLabel')}
          value={`${stats?.successRate || 0}%`}
          icon={TrendingUp}
          trend="up"
          trendValue="5%"
          color="success"
          loading={loading}
        />
      </div>

      {/* Calls chart */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('dashboard.callsOverTime')}</h2>
            <p className="text-sm text-neutral-500">{t('dashboard.last7Days')}</p>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-neutral-400">{t('dashboard.loadingChart')}</div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ fill: '#4f46e5', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={PhoneCall}
            title={t('dashboard.noCallDataYet')}
            description={t('dashboard.startMakingCalls')}
          />
        )}
      </div>

      {/* Recent calls */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{t('dashboard.recentCallsTitle')}</h2>
              <p className="text-sm text-neutral-500">{t('dashboard.latestCallActivity')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/calls')}
            >
              {t('dashboard.viewAll')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 rounded"></div>
              ))}
            </div>
          </div>
        ) : recentCalls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.phoneNumberLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.assistantLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.durationLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.dateLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {t('dashboard.statusLabel')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {recentCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/calls?callId=${call.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {call.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {call.assistantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {formatDate(call.createdAt, 'relative')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          call.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : call.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={Phone}
              title={t('dashboard.noCallsYetTitle')}
              description={t('dashboard.callHistoryAppear')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

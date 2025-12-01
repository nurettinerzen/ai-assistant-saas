/**
 * Analytics Page
 * Comprehensive analytics dashboard with multiple charts
 * UPDATE EXISTING FILE: frontend/app/dashboard/analytics/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StatsCard from '@/components/StatsCard';
import { Phone, Clock, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatCurrency, formatDuration } from '@/lib/utils';
import { t, getCurrentLanguage } from '@/lib/translations';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(getCurrentLanguage());
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await apiClient.analytics.getOverview(timeRange);
      setAnalytics(response.data);
    } catch (error) {
      toast.error(t('saveError', locale));
    } finally {
      setLoading(false);
    }
  };

  const TIME_RANGES = [
    { value: '7d', label: t('last7DaysLabel', locale) },
    { value: '30d', label: t('last30DaysLabel', locale) },
    { value: '90d', label: t('last90DaysLabel', locale) },
    { value: '1y', label: t('lastYearLabel', locale) },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{t('analyticsTitle2', locale)}</h1>
          <p className="text-neutral-600 mt-1">{t('detailedInsights2', locale)}</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          label={t('totalCallsLabel2', locale)}
          value={analytics?.totalCalls || 0}
          icon={Phone}
          trend="up"
          trendValue="12%"
          color="primary"
          loading={loading}
        />
        <StatsCard
          label={t('avgDurationLabel3', locale)}
          value={formatDuration(analytics?.avgDuration || 0)}
          icon={Clock}
          trend="up"
          trendValue="5%"
          color="info"
          loading={loading}
        />
        <StatsCard
          label={t('totalSpent', locale)}
          value={formatCurrency(analytics?.totalCost || 0)}
          icon={DollarSign}
          trend="up"
          trendValue="18%"
          color="success"
          loading={loading}
        />
        <StatsCard
          label={t('successRateLabel2', locale)}
          value={`${analytics?.successRate || 0}%`}
          icon={TrendingUp}
          trend="up"
          trendValue="3%"
          color="success"
          loading={loading}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls over time */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('callsOverTimeChart', locale)}</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">{t('loadingText', locale)}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={analytics?.callsOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
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
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Call status distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('callStatusDistribution', locale)}</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">{t('loadingText', locale)}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={analytics?.statusDistribution || []}
                  dataKey="value"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(analytics?.statusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Duration distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('callDurationDistribution', locale)}</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">{t('loadingText', locale)}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics?.durationDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Assistant performance */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('assistantPerformance', locale)}</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">{t('loadingText', locale)}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics?.assistantPerformance || []} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="calls" fill="#06b6d4" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('costOverTime', locale)}</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-neutral-400">{t('loadingText', locale)}</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={analytics?.costOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

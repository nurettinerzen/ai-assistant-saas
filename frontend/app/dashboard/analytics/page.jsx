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

const TIME_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await apiClient.analytics.getOverview(timeRange);
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-neutral-600 mt-1">Detailed insights into your call performance</p>
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
          label="Total Calls"
          value={analytics?.totalCalls || 0}
          icon={Phone}
          trend="up"
          trendValue="12%"
          color="primary"
          loading={loading}
        />
        <StatsCard
          label="Avg Duration"
          value={formatDuration(analytics?.avgDuration || 0)}
          icon={Clock}
          trend="up"
          trendValue="5%"
          color="info"
          loading={loading}
        />
        <StatsCard
          label="Total Spent"
          value={formatCurrency(analytics?.totalCost || 0)}
          icon={DollarSign}
          trend="up"
          trendValue="18%"
          color="success"
          loading={loading}
        />
        <StatsCard
          label="Success Rate"
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Calls Over Time</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">Loading...</div>
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Call Status Distribution</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">Loading...</div>
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Call Duration Distribution</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">Loading...</div>
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Assistant Performance</h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">Loading...</div>
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
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Cost Over Time</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-neutral-400">Loading...</div>
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

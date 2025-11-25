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
import { t, getCurrentLanguage } from '@/lib/translations';
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(getCurrentLanguage());
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load all dashboard data in parallel
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-600 mt-1">Monitor your AI assistant performance</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard/assistant')}>
            <Plus className="h-4 w-4 mr-2" />
            New Assistant
          </Button>
          <Button onClick={() => router.push('/dashboard/calls')}>
            View All Calls
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          label="Total Calls"
          value={stats?.totalCalls || 0}
          icon={Phone}
          trend="up"
          trendValue="12%"
          color="primary"
          loading={loading}
        />
        <StatsCard
          label="Avg Duration"
          value={formatDuration(stats?.avgDuration || 0)}
          icon={Clock}
          trend="down"
          trendValue="2%"
          color="info"
          loading={loading}
        />
        <StatsCard
          label="Total Cost"
          value={formatCurrency(stats?.totalCost || 0)}
          icon={DollarSign}
          trend="up"
          trendValue="8%"
          color="success"
          loading={loading}
        />
        <StatsCard
          label="Success Rate"
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
            <h2 className="text-lg font-semibold text-neutral-900">Calls Over Time</h2>
            <p className="text-sm text-neutral-500">Last 7 days</p>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-neutral-400">Loading chart...</div>
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
            title="No call data yet"
            description="Start making calls to see your analytics"
          />
        )}
      </div>

      {/* Recent calls */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Recent Calls</h2>
              <p className="text-sm text-neutral-500">Your latest call activity</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/calls')}
            >
              View All
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
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Assistant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
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
              title="No calls yet"
              description="Your call history will appear here"
            />
          </div>
        )}
      </div>
    </div>
  );
}

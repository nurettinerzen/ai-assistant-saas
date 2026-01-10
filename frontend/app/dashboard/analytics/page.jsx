/**
 * Analytics Dashboard - UPDATED WITH CHAT & APPOINTMENTS
 * Replace your existing analytics page.jsx with this
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  Clock,
  TrendingUp,
  Calendar,
  Download,
  MessageCircle,
  CalendarCheck,
  CheckCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDuration, formatDate } from '@/lib/utils';
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

const CHANNEL_COLORS = {
  phone: '#4f46e5',
  chat: '#10b981'
};

export default function AnalyticsPage() {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [peakHours, setPeakHours] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, callsRes, peakRes] = await Promise.all([
  apiClient.get(`/api/analytics/overview?range=${timeRange}`),
  apiClient.get('/api/analytics/calls?limit=10'),
  apiClient.get('/api/analytics/peak-hours')
]);

      setAnalytics(overviewRes.data);
      setRecentCalls(callsRes.data.calls || []);
      setPeakHours(peakRes.data.peakHours || []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error(t('dashboard.analyticsPage.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const TIME_RANGES = [
    { value: '7d', label: t('dashboard.analyticsPage.last7Days') },
    { value: '30d', label: t('dashboard.analyticsPage.last30Days') },
    { value: '90d', label: t('dashboard.analyticsPage.last90Days') },
  ];

  // Prepare channel data for pie chart
  const channelData = analytics?.channelStats ? [
    { name: t('dashboard.analyticsPage.phoneCalls'), value: analytics.channelStats.phone.count, percentage: analytics.channelStats.phone.percentage, color: CHANNEL_COLORS.phone },
    { name: t('dashboard.overviewPage.chatMessages'), value: analytics.channelStats.chat.count, percentage: analytics.channelStats.chat.percentage, color: CHANNEL_COLORS.chat }
  ].filter(item => item.value > 0) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.analyticsPage.title')}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('dashboard.analyticsPage.description')}
          </p>
        </div>
        <div className="flex gap-3">
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
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('dashboard.analyticsPage.export')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.totalCalls || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.totalCalls')}</p>
        </div>

        {/* Chat Messages Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.totalChatMessages || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.chatMessages')}</p>
        </div>

        {/* Appointments Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CalendarCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.totalAppointments || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.appointments')}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
            {analytics?.appointmentRate || 0}% {t('dashboard.analyticsPage.conversionRate')}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.totalMinutes || 0}m
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.totalMinutes')}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.successRate || 0}%
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.successRate')}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Channel Activity Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('dashboard.analyticsPage.activityOverTime')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analytics?.callsOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(date) => formatDate(date, 'chart', locale)} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="calls"
                stroke={CHANNEL_COLORS.phone}
                strokeWidth={2}
                name={t('dashboard.analyticsPage.phoneCalls')}
              />
              <Line
                type="monotone"
                dataKey="chats"
                stroke={CHANNEL_COLORS.chat}
                strokeWidth={2}
                name={t('dashboard.analyticsPage.chatMessages')}
              />
              <Line
                type="monotone"
                dataKey="appointments"
                stroke="#a855f7"
                strokeWidth={2}
                name={t('dashboard.analyticsPage.appointments')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('dashboard.analyticsPage.channelDistribution')}</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('dashboard.analyticsPage.peakActivityHours')}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={peakHours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="calls" fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('dashboard.analyticsPage.recentCalls')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('dashboard.analyticsPage.dateTime')}
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('dashboard.analyticsPage.caller')}
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('dashboard.analyticsPage.duration')}
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('dashboard.analyticsPage.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.length > 0 ? (
                recentCalls.map((call) => (
                  <tr key={call.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="p-3 text-sm text-neutral-900 dark:text-neutral-100">
                      {formatDate(call.createdAt, 'long', locale)}
                    </td>
                    <td className="p-3 text-sm text-neutral-900 dark:text-neutral-100">
                      {call.callerId || t('dashboard.overviewPage.unknownCaller')}
                    </td>
                    <td className="p-3 text-sm text-neutral-900 dark:text-neutral-100">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="secondary"
                        className={
                          call.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300'
                        }
                      >
                        {call.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-500 dark:text-neutral-400">
                    {t('dashboard.analyticsPage.noCallsYet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
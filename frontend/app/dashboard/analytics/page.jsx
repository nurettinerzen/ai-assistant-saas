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
  Smile,
  Meh,
  Frown,
  Download,
  MessageCircle,
  CalendarCheck
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/utils';
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

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444'
};

const CHANNEL_COLORS = {
  phone: '#4f46e5',
  chat: '#10b981'
};

export default function AnalyticsPage() {
  const { t } = useLanguage();
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
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const TIME_RANGES = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
  ];

  // Prepare sentiment data for pie chart
  const sentimentData = analytics?.sentimentBreakdown ? [
    { name: 'Positive', value: parseFloat(analytics.sentimentBreakdown.positive), color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: parseFloat(analytics.sentimentBreakdown.neutral), color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: parseFloat(analytics.sentimentBreakdown.negative), color: SENTIMENT_COLORS.negative }
  ] : [];

  // 🔥 NEW: Prepare channel data for pie chart
  const channelData = analytics?.channelStats ? [
    { name: 'Phone', value: analytics.channelStats.phone.count, percentage: analytics.channelStats.phone.percentage, color: CHANNEL_COLORS.phone },
    { name: 'Chat', value: analytics.channelStats.chat.count, percentage: analytics.channelStats.chat.percentage, color: CHANNEL_COLORS.chat }
  ].filter(item => item.value > 0) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-neutral-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-neutral-200 rounded-xl animate-pulse"></div>
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
          <h1 className="text-3xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-neutral-600 mt-1">
            Detailed insights into your performance across all channels
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
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Phone className="h-5 w-5 text-primary-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">
            {analytics?.totalCalls || 0}
          </h3>
          <p className="text-sm text-neutral-600">Total Calls</p>
        </div>

        {/* 🔥 NEW: Chat Messages Card */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">
            {analytics?.totalChatMessages || 0}
          </h3>
          <p className="text-sm text-neutral-600">Chat Messages</p>
        </div>

        {/* 🔥 NEW: Appointments Card */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarCheck className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">
            {analytics?.totalAppointments || 0}
          </h3>
          <p className="text-sm text-neutral-600">Appointments</p>
          <p className="text-xs text-neutral-500 mt-1">
            {analytics?.appointmentRate || 0}% conversion rate
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">
            {analytics?.totalMinutes || 0}m
          </h3>
          <p className="text-sm text-neutral-600">Total Minutes</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Smile className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">
            {analytics?.successRate || 0}%
          </h3>
          <p className="text-sm text-neutral-600">Success Rate</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Channel Activity Chart */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Activity Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analytics?.callsOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="calls" 
                stroke={CHANNEL_COLORS.phone}
                strokeWidth={2}
                name="Phone Calls"
              />
              <Line 
                type="monotone" 
                dataKey="chats" 
                stroke={CHANNEL_COLORS.chat}
                strokeWidth={2}
                name="Chat Messages"
              />
              <Line 
                type="monotone" 
                dataKey="appointments" 
                stroke="#a855f7"
                strokeWidth={2}
                name="Appointments"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 🔥 NEW: Channel Distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Channel Distribution</h3>
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

      {/* Sentiment & Peak Hours Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Sentiment Analysis</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Chart */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Peak Activity Hours</h3>
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
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Calls</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-neutral-700">
                  Date & Time
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700">
                  Caller
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700">
                  Duration
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700">
                  Sentiment
                </th>
                <th className="text-left p-3 text-sm font-medium text-neutral-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.length > 0 ? (
                recentCalls.map((call) => (
                  <tr key={call.id} className="border-t border-neutral-100">
                    <td className="p-3 text-sm text-neutral-900">
                      {new Date(call.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-sm text-neutral-900">
                      {call.callerId || 'Unknown'}
                    </td>
                    <td className="p-3 text-sm text-neutral-900">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {call.sentiment === 'positive' && (
                          <Smile className="h-4 w-4 text-green-600" />
                        )}
                        {call.sentiment === 'neutral' && (
                          <Meh className="h-4 w-4 text-neutral-600" />
                        )}
                        {call.sentiment === 'negative' && (
                          <Frown className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm capitalize">{call.sentiment || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge 
                        variant="secondary"
                        className={
                          call.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-neutral-100 text-neutral-800'
                        }
                      >
                        {call.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-500">
                    No calls yet
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
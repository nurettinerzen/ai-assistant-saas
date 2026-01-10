/**
 * Analytics Dashboard
 * Multi-channel analytics with phone, chat, and email metrics
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
  Calendar,
  Download,
  MessageCircle,
  Mail,
  HelpCircle,
  Filter,
  Tag
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

const CHANNEL_COLORS = {
  phone: '#4f46e5',
  chat: '#10b981',
  email: '#f59e0b'
};

export default function AnalyticsPage() {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [peakHours, setPeakHours] = useState([]);
  const [topTopics, setTopTopics] = useState([]);
  const [channelFilter, setChannelFilter] = useState('all');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, channelFilter]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const channelParam = channelFilter !== 'all' ? `&channel=${channelFilter}` : '';
      const [overviewRes, peakRes, questionsRes] = await Promise.all([
        apiClient.get(`/api/analytics/overview?range=${timeRange}`),
        apiClient.get('/api/analytics/peak-hours'),
        apiClient.get(`/api/analytics/top-questions?range=${timeRange}&limit=10${channelParam}`)
      ]);

      setAnalytics(overviewRes.data);
      setPeakHours(peakRes.data.peakHours || []);
      setTopTopics(questionsRes.data.topTopics || []);
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
    { name: t('dashboard.analyticsPage.chatSessions'), value: analytics.channelStats.chat.count, percentage: analytics.channelStats.chat.percentage, color: CHANNEL_COLORS.chat },
    { name: t('dashboard.analyticsPage.emailsAnswered'), value: analytics.channelStats.email.count, percentage: analytics.channelStats.email.percentage, color: CHANNEL_COLORS.email }
  ].filter(item => item.value > 0) : [];

  // Channel icon helper
  const getChannelIcon = (channel) => {
    switch(channel) {
      case 'phone': return <Phone className="h-3 w-3" />;
      case 'chat': return <MessageCircle className="h-3 w-3" />;
      case 'email': return <Mail className="h-3 w-3" />;
      default: return <HelpCircle className="h-3 w-3" />;
    }
  };

  const getChannelColor = (channel) => {
    switch(channel) {
      case 'phone': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'chat': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'email': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

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

      {/* Overview Cards - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Calls */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Phone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.totalCalls || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.totalCalls')}</p>
        </div>

        {/* Chat Sessions */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.chatSessions || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.chatSessions')}</p>
        </div>

        {/* Emails Answered */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {analytics?.emailsAnswered || 0}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.emailsAnswered')}</p>
        </div>

        {/* Average Call Duration */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {formatDuration(analytics?.avgDuration || 0)}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('dashboard.analyticsPage.avgCallDuration')}</p>
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
                name={t('dashboard.analyticsPage.chatSessions')}
              />
              <Line
                type="monotone"
                dataKey="emails"
                stroke={CHANNEL_COLORS.email}
                strokeWidth={2}
                name={t('dashboard.analyticsPage.emailsAnswered')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('dashboard.analyticsPage.channelDistribution')}</h3>
          {channelData.length > 0 ? (
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
          ) : (
            <div className="flex items-center justify-center h-[250px] text-neutral-500 dark:text-neutral-400">
              {t('dashboard.analyticsPage.noDataYet')}
            </div>
          )}
        </div>
      </div>

      {/* Top Topics Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('dashboard.analyticsPage.topQuestions')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-neutral-400" />
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.analyticsPage.allChannels')}</SelectItem>
                <SelectItem value="phone">{t('dashboard.analyticsPage.phoneCalls')}</SelectItem>
                <SelectItem value="chat">{t('dashboard.analyticsPage.chatSessions')}</SelectItem>
                <SelectItem value="email">{t('dashboard.analyticsPage.emailsAnswered')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          {t('dashboard.analyticsPage.topQuestionsDescription')}
        </p>
        {topTopics.length > 0 ? (
          <div className="space-y-3">
            {topTopics.map((topic, index) => (
              <div
                key={index}
                className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {topic.category}
                    </span>
                    <Badge variant="outline" className="font-semibold">
                      {topic.count}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {topic.channels.map((channel) => (
                      <Badge
                        key={channel}
                        variant="secondary"
                        className={`text-xs ${getChannelColor(channel)}`}
                      >
                        {getChannelIcon(channel)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {topic.examples && topic.examples.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {topic.examples.slice(0, 2).map((example, i) => (
                      <p key={i} className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                        "{example}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            {t('dashboard.analyticsPage.noQuestionsYet')}
          </div>
        )}
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

    </div>
  );
}

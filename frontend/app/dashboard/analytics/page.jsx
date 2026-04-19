/**
 * Analytics Dashboard — Modern dark SaaS redesign
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPageHelp } from '@/content/pageHelp';
import { useAnalyticsOverview, usePeakHours, useTopQuestions } from '@/hooks/useAnalytics';
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
  Tag,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/utils';
import {
  AreaChart,
  Area,
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

/* ─── Colour tokens ──────────────────────────────────────────────── */
const C = {
  phone:    { hex: '#00D4E8', glow: 'rgba(0,212,232,0.35)',    bg: 'from-cyan-500/20 to-cyan-600/5',    border: 'border-cyan-500/30',    text: 'text-cyan-400' },
  chat:     { hex: '#6C63FF', glow: 'rgba(108,99,255,0.35)',   bg: 'from-violet-500/20 to-violet-600/5', border: 'border-violet-500/30', text: 'text-violet-400' },
  whatsapp: { hex: '#22D3A5', glow: 'rgba(34,211,165,0.35)',   bg: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  email:    { hex: '#F59E0B', glow: 'rgba(245,158,11,0.35)',   bg: 'from-amber-500/20 to-amber-600/5',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  duration: { hex: '#A78BFA', glow: 'rgba(167,139,250,0.35)',  bg: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', text: 'text-purple-400' },
};

/* ─── WhatsApp SVG ───────────────────────────────────────────────── */
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ─── Gradient defs for area chart ──────────────────────────────── */
const ChartGradients = () => (
  <defs>
    {Object.entries(C).filter(([k]) => k !== 'duration').map(([key, val]) => (
      <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={val.hex} stopOpacity={0.45} />
        <stop offset="95%" stopColor={val.hex} stopOpacity={0.02} />
      </linearGradient>
    ))}
    <linearGradient id="grad-duration" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%"  stopColor={C.duration.hex} stopOpacity={0.45} />
      <stop offset="95%" stopColor={C.duration.hex} stopOpacity={0.02} />
    </linearGradient>
    {/* bar gradients */}
    {Object.entries(C).filter(([k]) => k !== 'duration').map(([key, val]) => (
      <linearGradient key={`bar-${key}`} id={`bar-${key}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor={val.hex} stopOpacity={1} />
        <stop offset="100%" stopColor={val.hex} stopOpacity={0.55} />
      </linearGradient>
    ))}
  </defs>
);

/* ─── Shared tooltip style ───────────────────────────────────────── */
const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#0f1629',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#e2e8f0',
    fontSize: 12,
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
  itemStyle: { color: '#e2e8f0' },
  cursor: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 },
};

/* ─── Shared axis props ──────────────────────────────────────────── */
const axisProps = {
  tick: { fill: '#64748b', fontSize: 11 },
  axisLine: { stroke: 'rgba(255,255,255,0.06)' },
  tickLine: false,
};

const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'rgba(255,255,255,0.05)',
  vertical: false,
};

/* ─── Stat card ──────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label, colorKey, trend }) {
  const col = C[colorKey] || C.phone;
  const isUp = trend > 0;
  const isNeutral = trend === undefined || trend === null;
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${col.border} bg-gradient-to-br ${col.bg} backdrop-blur-sm p-5`}
         style={{ background: 'rgba(15,22,41,0.7)' }}>
      {/* glow blob */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-30"
           style={{ background: col.hex }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-xl" style={{ background: `${col.hex}22` }}>
            <Icon className={`h-4 w-4 ${col.text}`} />
          </div>
          {!isNeutral && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ─── Section card shell ─────────────────────────────────────────── */
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] backdrop-blur-sm p-5 ${className}`}
         style={{ background: 'rgba(15,22,41,0.7)' }}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <h3 className="text-sm font-semibold text-slate-200 mb-4">{children}</h3>;
}

/* ─── Channel filter pill ────────────────────────────────────────── */
function Pill({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
        active
          ? 'text-white shadow-lg'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
      style={active ? { background: color } : {}}
    >
      {children}
    </button>
  );
}

/* ─── Custom donut label ─────────────────────────────────────────── */
const DonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
  if (percentage < 6) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontWeight={700}>{`${percentage}%`}</text>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Main page
═══════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const { t, locale } = useLanguage();
  const pageHelp = getPageHelp('analytics', locale);
  const [timeRange, setTimeRange] = useState('30d');
  const [channelFilter, setChannelFilter] = useState('all');

  const { data: analytics, isLoading: overviewLoading } = useAnalyticsOverview(timeRange);
  const { data: peakHoursData, isLoading: peakHoursLoading } = usePeakHours(timeRange);
  const { data: topQuestionsData, isLoading: topicsLoading } = useTopQuestions(
    timeRange,
    channelFilter === 'all' ? null : channelFilter,
    10,
  );

  const peakHours = peakHoursData?.peakHours || [];
  const topTopics = topQuestionsData?.topTopics || [];
  const loading = overviewLoading || peakHoursLoading;

  /* CSV export — unchanged logic */
  const handleExport = () => {
    if (!analytics) return;
    const csvRows = [];
    csvRows.push([t('dashboard.analyticsPage.csvReportTitle'), `${t('dashboard.analyticsPage.csvPeriod')}: ${timeRange}`]);
    csvRows.push([]);
    csvRows.push([t('dashboard.analyticsPage.csvOverviewStats')]);
    csvRows.push([t('dashboard.analyticsPage.totalCalls'), analytics.totalCalls || 0]);
    csvRows.push([t('dashboard.analyticsPage.csvTotalMinutes'), analytics.totalMinutes || 0]);
    csvRows.push([t('dashboard.analyticsPage.csvAvgDurationSec'), analytics.avgDuration || 0]);
    csvRows.push([t('dashboard.analyticsPage.chatSessions'), analytics.chatSessions || 0]);
    csvRows.push([t('dashboard.analyticsPage.csvWhatsappSessions'), analytics.whatsappSessions || 0]);
    csvRows.push([t('dashboard.analyticsPage.emailsAnswered'), analytics.emailsAnswered || 0]);
    csvRows.push([]);
    if (analytics.channelStats) {
      csvRows.push([t('dashboard.analyticsPage.channelDistribution')]);
      csvRows.push([t('dashboard.analyticsPage.csvChannel'), t('dashboard.analyticsPage.csvCount'), t('dashboard.analyticsPage.csvPercentage')]);
      csvRows.push([t('dashboard.analyticsPage.phoneCalls'), analytics.channelStats.phone.count, `${analytics.channelStats.phone.percentage}%`]);
      csvRows.push(['Chat', analytics.channelStats.chat.count, `${analytics.channelStats.chat.percentage}%`]);
      csvRows.push(['WhatsApp', analytics.channelStats.whatsapp?.count || 0, `${analytics.channelStats.whatsapp?.percentage || 0}%`]);
      csvRows.push([t('dashboard.analyticsPage.email'), analytics.channelStats.email.count, `${analytics.channelStats.email.percentage}%`]);
      csvRows.push([]);
    }
    if (analytics.callsOverTime?.length > 0) {
      csvRows.push([t('dashboard.analyticsPage.csvDailyInteractions')]);
      csvRows.push([t('dashboard.analyticsPage.csvDate'), t('dashboard.analyticsPage.phoneCalls'), 'Chat', 'WhatsApp', t('dashboard.analyticsPage.email')]);
      analytics.callsOverTime.forEach(day => csvRows.push([day.date, day.calls, day.chats, day.whatsapp, day.emails]));
      csvRows.push([]);
    }
    if (topTopics?.length > 0) {
      csvRows.push([t('dashboard.analyticsPage.topQuestions')]);
      csvRows.push([t('dashboard.analyticsPage.csvCategory'), t('dashboard.analyticsPage.csvCount'), t('dashboard.analyticsPage.csvSubtopics')]);
      topTopics.forEach(topic => {
        const subtopics = topic.subtopics?.map(s => `${s.text} (${s.count})`).join('; ') || '';
        csvRows.push([topic.category, topic.count, subtopics]);
      });
    }
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analitik-rapor-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t('dashboard.analyticsPage.reportDownloaded'));
  };

  const TIME_RANGES = [
    { value: '7d',  label: t('dashboard.analyticsPage.last7Days')  },
    { value: '30d', label: t('dashboard.analyticsPage.last30Days') },
    { value: '90d', label: t('dashboard.analyticsPage.last90Days') },
  ];

  /* Donut data */
  const channelData = analytics?.channelStats ? [
    { name: t('dashboard.analyticsPage.phoneCalls'),      value: analytics.channelStats.phone.count,            percentage: analytics.channelStats.phone.percentage,            color: C.phone.hex },
    { name: t('dashboard.analyticsPage.chatSessions'),    value: analytics.channelStats.chat.count,             percentage: analytics.channelStats.chat.percentage,             color: C.chat.hex },
    { name: t('dashboard.analyticsPage.whatsappMessages'),value: analytics.channelStats.whatsapp?.count || 0,   percentage: analytics.channelStats.whatsapp?.percentage || 0,   color: C.whatsapp.hex },
    { name: t('dashboard.analyticsPage.emailsAnswered'),  value: analytics.channelStats.email.count,            percentage: analytics.channelStats.email.percentage,            color: C.email.hex },
  ].filter(i => i.value > 0) : [];

  /* Chart data: format dates */
  const chartData = (analytics?.callsOverTime || []).map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' }),
  }));

  /* Channel helpers */
  const channelIcon = (ch) => {
    switch (ch) {
      case 'phone':    return <Phone className="h-3 w-3" />;
      case 'chat':     return <MessageCircle className="h-3 w-3" />;
      case 'whatsapp': return <WhatsAppIcon className="h-3 w-3" />;
      case 'email':    return <Mail className="h-3 w-3" />;
      default:         return <HelpCircle className="h-3 w-3" />;
    }
  };
  const channelColor = (ch) => C[ch]?.hex || '#94a3b8';

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-white/10 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="h-72 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  return (
    /* Page wrapper — subtle dark gradient that sits on top of the sidebar's light/dark bg */
    <div className="space-y-6 -m-6 p-6 min-h-screen"
         style={{ background: 'linear-gradient(135deg, #070d1f 0%, #0c1427 40%, #091225 100%)' }}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">{pageHelp.title}</h1>
          </div>
          <p className="text-sm text-slate-400">{pageHelp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-44 h-9 bg-white/5 border-white/10 text-slate-200 text-sm">
              <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0f1629] border-white/10 text-slate-200">
              {TIME_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value} className="focus:bg-white/10">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={handleExport}
            disabled={!analytics}
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            {t('dashboard.analyticsPage.export')}
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Phone}          value={analytics?.totalCalls || 0}             label={t('dashboard.analyticsPage.totalCalls')}      colorKey="phone" />
        <StatCard icon={MessageCircle}  value={analytics?.chatSessions || 0}           label={t('dashboard.analyticsPage.chatSessions')}    colorKey="chat" />
        <StatCard icon={WhatsAppIcon}   value={analytics?.whatsappSessions || 0}       label={t('dashboard.analyticsPage.whatsappMessages')} colorKey="whatsapp" />
        <StatCard icon={Mail}           value={analytics?.emailsAnswered || 0}          label={t('dashboard.analyticsPage.emailsAnswered')}  colorKey="email" />
        <StatCard icon={Clock}          value={formatDuration(analytics?.avgDuration || 0)} label={t('dashboard.analyticsPage.avgCallDuration')} colorKey="duration" />
      </div>

      {/* ── Area chart + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardTitle>{t('dashboard.analyticsPage.activityOverTime')}</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <ChartGradients />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={7}
                formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
              />
              {[
                { key: 'calls',   col: C.phone,    name: t('dashboard.analyticsPage.phoneCalls')    },
                { key: 'chats',   col: C.chat,     name: t('dashboard.analyticsPage.chatSessions')  },
                { key: 'whatsapp',col: C.whatsapp,  name: t('dashboard.analyticsPage.whatsappMessages') },
                { key: 'emails',  col: C.email,    name: t('dashboard.analyticsPage.emailsAnswered') },
              ].map(({ key, col, name }) => (
                <Area key={key} type="monotoneX" dataKey={key} name={name}
                      stroke={col.hex} strokeWidth={2}
                      fill={`url(#grad-${key === 'calls' ? 'phone' : key === 'chats' ? 'chat' : key === 'emails' ? 'email' : key})`}
                      dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: col.hex }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Donut — 1/3 width */}
        <Card>
          <CardTitle>{t('dashboard.analyticsPage.channelDistribution')}</CardTitle>
          {channelData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%"
                       innerRadius={55} outerRadius={78}
                       paddingAngle={3} dataKey="value"
                       labelLine={false} label={DonutLabel}
                       strokeWidth={0}>
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color}
                            style={{ filter: `drop-shadow(0 0 6px ${entry.color}88)` }} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name, props) => [`${value} (${props.payload.percentage}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend rows */}
              <div className="mt-2 space-y-2">
                {channelData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                      <span className="text-xs text-slate-400">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{d.value}</span>
                      <span className="text-xs text-slate-500">{d.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-500 text-sm">
              {t('dashboard.analyticsPage.noDataYet')}
            </div>
          )}
        </Card>
      </div>

      {/* ── Session duration cards ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          {t('dashboard.analyticsPage.channelSessionDurationTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { ch: 'chat',     icon: MessageCircle, label: t('dashboard.analyticsPage.chatSessions'),    data: analytics?.channelSessionDuration?.chat },
            { ch: 'whatsapp', icon: WhatsAppIcon,  label: 'WhatsApp',                                   data: analytics?.channelSessionDuration?.whatsapp },
            { ch: 'email',    icon: Mail,          label: t('dashboard.analyticsPage.email'),            data: analytics?.channelSessionDuration?.email },
          ].map(({ ch, icon: Icon, label, data }) => (
            <Card key={ch} className="flex items-start gap-3">
              <div className="p-2 rounded-xl mt-0.5 flex-shrink-0" style={{ background: `${C[ch].hex}22` }}>
                <Icon className={`h-4 w-4 ${C[ch].text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 mb-2">{label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{t('dashboard.analyticsPage.averageSessionDuration')}</span>
                    <span className="text-xs font-semibold text-slate-200">{formatDuration(data?.averageSeconds || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{t('dashboard.analyticsPage.totalSessionDuration')}</span>
                    <span className="text-xs font-semibold text-slate-200">{formatDuration(data?.totalSeconds || 0)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Peak hours bar chart ── */}
      <Card>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            {t('dashboard.analyticsPage.peakActivityHours')}
          </span>
        </CardTitle>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={peakHours} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
            <ChartGradients />
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="hour" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
            <Bar dataKey="phone"    stackId="a" fill={`url(#bar-phone)`}    name={t('dashboard.analyticsPage.phoneCalls')}     radius={[0,0,0,0]} />
            <Bar dataKey="chat"     stackId="a" fill={`url(#bar-chat)`}     name={t('dashboard.analyticsPage.chatSessions')}   />
            <Bar dataKey="whatsapp" stackId="a" fill={`url(#bar-whatsapp)`} name="WhatsApp" />
            <Bar dataKey="email"    stackId="a" fill={`url(#bar-email)`}    name={t('dashboard.analyticsPage.emailsAnswered')} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Top Topics ── */}
      <Card>
        {/* header row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">{t('dashboard.analyticsPage.topQuestions')}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Pill active={channelFilter === 'all'} onClick={() => setChannelFilter('all')} color="#334155">
              {t('dashboard.analyticsPage.allChannels')}
            </Pill>
            {[
              { key: 'phone',    label: t('dashboard.analyticsPage.phoneCalls'),    icon: <Phone className="h-3 w-3" /> },
              { key: 'chat',     label: 'Chat',                                      icon: <MessageCircle className="h-3 w-3" /> },
              { key: 'whatsapp', label: 'WhatsApp',                                  icon: <WhatsAppIcon className="h-3 w-3" /> },
              { key: 'email',    label: t('dashboard.analyticsPage.email'),           icon: <Mail className="h-3 w-3" /> },
            ].map(({ key, label, icon }) => (
              <Pill key={key} active={channelFilter === key} onClick={() => setChannelFilter(key)} color={C[key].hex}>
                {icon}{label}
              </Pill>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">{t('dashboard.analyticsPage.topQuestionsDescription')}</p>

        {topicsLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : topTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topTopics.map((topic, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-white/[0.06]"
                   style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{topic.category}</span>
                    <span className="px-1.5 py-0.5 text-xs font-bold rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                      {topic.count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {topic.channels?.map(ch => (
                      <span key={ch} style={{ color: channelColor(ch) }}>{channelIcon(ch)}</span>
                    ))}
                  </div>
                </div>
                {topic.subtopics?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topic.subtopics.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                        {s.text}
                        <span className="font-bold text-cyan-400">{s.count}</span>
                      </span>
                    ))}
                  </div>
                )}
                {!topic.subtopics && topic.examples?.slice(0, 2).map((ex, i) => (
                  <p key={i} className="text-xs text-slate-500 line-clamp-1 mt-1">"{ex}"</p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">
            {t('dashboard.analyticsPage.noQuestionsYet')}
          </div>
        )}
      </Card>
    </div>
  );
}

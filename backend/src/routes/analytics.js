import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/analytics/overview?range=30d
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    const { range = '30d' } = req.query;

    // Parse time range
    const days = parseInt(range.replace(/[^0-9]/g, ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all calls in range
    const calls = await prisma.callLog.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get chat logs (sessions) - separated by channel
    const chatLogs = await prisma.chatLog.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate },
        channel: 'CHAT'
      }
    });

    // Get WhatsApp logs (sessions)
    const whatsappLogs = await prisma.chatLog.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate },
        channel: 'WHATSAPP'
      }
    });

    // Get email threads with AI responses
    const emailThreads = await prisma.emailThread.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate }
      }
    });

    // Get AI-generated email drafts that were sent
    const sentEmailDrafts = await prisma.emailDraft.findMany({
      where: {
        businessId,
        status: 'SENT',
        createdAt: { gte: startDate }
      }
    });

    // Get assistants
    const assistants = await prisma.assistant.findMany({
      where: { businessId, isActive: true }
    });

    // Calculate PHONE stats
    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const totalCost = totalDuration * 0.01;

    // Calculate CHAT stats - count sessions (not individual messages)
    const chatSessions = chatLogs.length;

    // Calculate WHATSAPP stats
    const whatsappSessions = whatsappLogs.length;

    // Calculate EMAIL stats - count AI-answered emails
    const emailsAnswered = sentEmailDrafts.length;
    const totalEmailThreads = emailThreads.length;

    // Calls over time WITH chats, whatsapp, and emails
    const callsByDate = {};
    const chatsByDate = {};
    const whatsappByDate = {};
    const emailsByDate = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      callsByDate[dateStr] = 0;
      chatsByDate[dateStr] = 0;
      whatsappByDate[dateStr] = 0;
      emailsByDate[dateStr] = 0;
    }

    calls.forEach(call => {
      const dateStr = call.createdAt.toISOString().split('T')[0];
      if (callsByDate[dateStr] !== undefined) {
        callsByDate[dateStr]++;
      }
    });

    chatLogs.forEach(log => {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      if (chatsByDate[dateStr] !== undefined) {
        chatsByDate[dateStr]++;
      }
    });

    whatsappLogs.forEach(log => {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      if (whatsappByDate[dateStr] !== undefined) {
        whatsappByDate[dateStr]++;
      }
    });

    sentEmailDrafts.forEach(draft => {
      const dateStr = draft.createdAt.toISOString().split('T')[0];
      if (emailsByDate[dateStr] !== undefined) {
        emailsByDate[dateStr]++;
      }
    });

    const callsOverTime = Object.keys(callsByDate).map((date) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calls: callsByDate[date],
      chats: chatsByDate[date] || 0,
      whatsapp: whatsappByDate[date] || 0,
      emails: emailsByDate[date] || 0
    }));

    // Status distribution
    const statusCount = {};
    calls.forEach(call => {
      const status = call.status || 'unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCount).map(([status, value]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      value
    }));

    // Duration distribution
    const durationRanges = [
      { range: '0-30s', min: 0, max: 30, count: 0 },
      { range: '30s-1m', min: 30, max: 60, count: 0 },
      { range: '1-2m', min: 60, max: 120, count: 0 },
      { range: '2-5m', min: 120, max: 300, count: 0 },
      { range: '5m+', min: 300, max: Infinity, count: 0 }
    ];
    calls.forEach(call => {
      const duration = call.duration || 0;
      const range = durationRanges.find(r => duration >= r.min && duration < r.max);
      if (range) range.count++;
    });
    const durationDistribution = durationRanges.map(({ range, count }) => ({ range, count }));

    // Assistant performance
    const assistantCalls = {};
    calls.forEach(call => {
      const assistantId = call.assistantId || 'unknown';
      assistantCalls[assistantId] = (assistantCalls[assistantId] || 0) + 1;
    });
    const assistantPerformance = assistants.map(assistant => ({
      name: assistant.name,
      calls: assistantCalls[assistant.id] || 0
    }));

    // Channel distribution - now with 4 channels
    const totalInteractions = totalCalls + chatSessions + whatsappSessions + emailsAnswered;
    const channelStats = {
      phone: { count: totalCalls, percentage: 0 },
      chat: { count: chatSessions, percentage: 0 },
      whatsapp: { count: whatsappSessions, percentage: 0 },
      email: { count: emailsAnswered, percentage: 0 },
      total: totalInteractions
    };
    if (totalInteractions > 0) {
      channelStats.phone.percentage = parseFloat(((totalCalls / totalInteractions) * 100).toFixed(1));
      channelStats.chat.percentage = parseFloat(((chatSessions / totalInteractions) * 100).toFixed(1));
      channelStats.whatsapp.percentage = parseFloat(((whatsappSessions / totalInteractions) * 100).toFixed(1));
      channelStats.email.percentage = parseFloat(((emailsAnswered / totalInteractions) * 100).toFixed(1));
    }

    res.json({
      // Phone metrics
      totalCalls,
      totalMinutes: Math.round(totalDuration / 60),
      avgDuration,
      totalCost: parseFloat(totalCost.toFixed(2)),

      // Chat metrics (session-based)
      chatSessions,

      // WhatsApp metrics
      whatsappSessions,

      // Email metrics
      emailsAnswered,
      totalEmailThreads,

      // Charts data
      callsOverTime,
      statusDistribution,
      durationDistribution,
      assistantPerformance,

      // Channel stats
      channelStats
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/calls - Paginated call list with filters
router.get('/calls', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      sentiment,
      status 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = { businessId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (sentiment) where.sentiment = sentiment;
    if (status) where.status = status;

    // Get calls
    const [calls, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.callLog.count({ where })
    ]);

    res.json({
      calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

// GET /api/analytics/calls/:callId - Single call detail
router.get('/calls/:callId', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    const { callId } = req.params;

    const call = await prisma.callLog.findFirst({
      where: {
        callId,
        businessId
      }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({ call });
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

// GET /api/analytics/trends - Trend data for graphs
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    const { period = 'daily' } = req.query;

    const days = period === 'daily' ? 30 : period === 'weekly' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const calls = await prisma.callLog.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by period
    const trends = {};
    calls.forEach(call => {
      let key;
      if (period === 'daily') {
        key = call.createdAt.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(call.createdAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = call.createdAt.toISOString().substring(0, 7);
      }

      if (!trends[key]) {
        trends[key] = { calls: 0, duration: 0, positive: 0, negative: 0 };
      }
      trends[key].calls++;
      trends[key].duration += call.duration || 0;
      if (call.sentiment === 'positive') trends[key].positive++;
      if (call.sentiment === 'negative') trends[key].negative++;
    });

    const trendData = Object.entries(trends).map(([date, data]) => ({
      date,
      calls: data.calls,
      avgDuration: Math.round(data.duration / data.calls),
      positiveRate: data.calls > 0 ? ((data.positive / data.calls) * 100).toFixed(1) : 0
    }));

    res.json({ trends: trendData });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /api/analytics/peak-hours - Peak calling hours
router.get('/peak-hours', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    
    const calls = await prisma.callLog.findMany({
      where: { businessId },
      select: { createdAt: true }
    });

    // Group by hour
    const hourCounts = Array(24).fill(0);
    calls.forEach(call => {
      const hour = new Date(call.createdAt).getHours();
      hourCounts[hour]++;
    });

    const peakHours = hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      calls: count
    }));

    res.json({ peakHours });
  } catch (error) {
    console.error('Error fetching peak hours:', error);
    res.status(500).json({ error: 'Failed to fetch peak hours' });
  }
});

// GET /api/analytics/top-questions - Top topics/questions from INBOUND interactions only
router.get('/top-questions', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;
    const { range = '30d', limit = 10, channel } = req.query;

    // Parse time range
    const days = parseInt(range.replace(/[^0-9]/g, ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Collect topics from INBOUND channels only
    const topics = [];

    // 1. Get INBOUND call summaries only (direction = inbound)
    if (!channel || channel === 'phone') {
      const calls = await prisma.callLog.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate },
          summary: { not: null },
          direction: 'inbound' // Only inbound calls
        },
        select: {
          summary: true,
          createdAt: true
        }
      });

      calls.forEach(call => {
        if (call.summary) {
          topics.push({
            text: call.summary,
            channel: 'phone',
            date: call.createdAt
          });
        }
      });
    }

    // 2. Get web chat messages (first user message = their question/topic)
    if (!channel || channel === 'chat') {
      const chatLogs = await prisma.chatLog.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate },
          channel: 'CHAT'
        },
        select: {
          messages: true,
          createdAt: true
        }
      });

      chatLogs.forEach(log => {
        if (log.messages && Array.isArray(log.messages)) {
          // Find first user message as the main topic
          const userMessage = log.messages.find(m => m.role === 'user');
          if (userMessage && userMessage.content) {
            topics.push({
              text: userMessage.content.substring(0, 200),
              channel: 'chat',
              date: log.createdAt
            });
          }
        }
      });
    }

    // 3. Get WhatsApp messages (first user message = their question/topic)
    if (!channel || channel === 'whatsapp') {
      const whatsappLogs = await prisma.chatLog.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate },
          channel: 'WHATSAPP'
        },
        select: {
          messages: true,
          createdAt: true
        }
      });

      whatsappLogs.forEach(log => {
        if (log.messages && Array.isArray(log.messages)) {
          // Find first user message as the main topic
          const userMessage = log.messages.find(m => m.role === 'user');
          if (userMessage && userMessage.content) {
            topics.push({
              text: userMessage.content.substring(0, 200),
              channel: 'whatsapp',
              date: log.createdAt
            });
          }
        }
      });
    }

    // 4. Get INBOUND email subjects
    if (!channel || channel === 'email') {
      const emailMessages = await prisma.emailMessage.findMany({
        where: {
          thread: {
            businessId
          },
          direction: 'INBOUND',
          createdAt: { gte: startDate }
        },
        select: {
          subject: true,
          createdAt: true
        },
        take: 100
      });

      emailMessages.forEach(email => {
        if (email.subject) {
          topics.push({
            text: email.subject,
            channel: 'email',
            date: email.createdAt
          });
        }
      });
    }

    // Categorize topics into common themes
    // Keywords for categorization
    const categories = {
      'Kargo/Teslimat': ['kargo', 'teslimat', 'gönderim', 'teslim', 'shipping', 'delivery', 'nerede', 'ne zaman gelecek', 'takip'],
      'Sipariş Sorgulama': ['sipariş', 'order', 'durum', 'status', 'nerdeee', 'siparişim', 'sorgu'],
      'Fiyat/Ücret': ['fiyat', 'ücret', 'price', 'maliyet', 'cost', 'kaç para', 'ne kadar', 'indirim', 'kampanya'],
      'Ürün Bilgisi': ['ürün', 'product', 'stok', 'stock', 'mevcut', 'var mı', 'özellik', 'beden', 'renk'],
      'İade/Değişim': ['iade', 'değişim', 'return', 'refund', 'geri', 'iptal', 'cancel'],
      'Ödeme': ['ödeme', 'payment', 'kredi', 'kart', 'havale', 'eft', 'taksit'],
      'Randevu': ['randevu', 'appointment', 'rezervasyon', 'booking', 'saat', 'gün'],
      'Destek/Şikayet': ['şikayet', 'sorun', 'problem', 'yardım', 'help', 'destek', 'support', 'çalışmıyor'],
      'Genel Bilgi': ['bilgi', 'information', 'soru', 'question', 'nasıl', 'nedir', 'hakkında']
    };

    // Categorize each topic
    const categorizedTopics = topics.map(topic => {
      const lowerText = topic.text.toLowerCase();
      let category = 'Diğer';

      for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
          category = cat;
          break;
        }
      }

      return { ...topic, category };
    });

    // Group by category and count
    const categoryStats = {};
    categorizedTopics.forEach(t => {
      if (!categoryStats[t.category]) {
        categoryStats[t.category] = {
          category: t.category,
          count: 0,
          channels: new Set(),
          examples: []
        };
      }
      categoryStats[t.category].count++;
      categoryStats[t.category].channels.add(t.channel);
      if (categoryStats[t.category].examples.length < 3) {
        categoryStats[t.category].examples.push(t.text.substring(0, 100));
      }
    });

    // Sort by count and get top N
    const topTopics = Object.values(categoryStats)
      .map(c => ({
        category: c.category,
        count: c.count,
        channels: Array.from(c.channels),
        examples: c.examples
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({
      topTopics,
      totalInteractions: topics.length
    });
  } catch (error) {
    console.error('Error fetching top questions:', error);
    res.status(500).json({ error: 'Failed to fetch top questions' });
  }
});

export default router;
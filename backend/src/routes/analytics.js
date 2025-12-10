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

    // 🔥 NEW: Get appointments in range
    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate }
      }
    });

    // 🔥 NEW: Get chat messages (if you have a ChatMessage model)
    let chatMessages = [];
    try {
      chatMessages = await prisma.chatMessage.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate }
        }
      });
    } catch (error) {
      console.log('ChatMessage model not found, skipping chat metrics');
    }

    // Get assistants
    const assistants = await prisma.assistant.findMany({
      where: { businessId, isActive: true }
    });

    // Calculate PHONE stats
    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const successRate = totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : 0;
    const totalCost = totalDuration * 0.01;

    // 🔥 NEW: Calculate CHAT stats
    const totalChatMessages = chatMessages.length;
    const chatConversations = [...new Set(chatMessages.map(m => m.sessionId || m.userId))].length;

    // 🔥 NEW: Calculate APPOINTMENT stats
    const totalAppointments = appointments.length;
    const confirmedAppointments = appointments.filter(a => a.status === 'CONFIRMED').length;
    const appointmentRate = totalCalls > 0 ? ((totalAppointments / totalCalls) * 100).toFixed(1) : 0;

    // Calls over time WITH appointments and chats
    const callsByDate = {};
    const appointmentsByDate = {};
    const chatsByDate = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      callsByDate[dateStr] = 0;
      appointmentsByDate[dateStr] = 0;
      chatsByDate[dateStr] = 0;
    }
    
    calls.forEach(call => {
      const dateStr = call.createdAt.toISOString().split('T')[0];
      if (callsByDate[dateStr] !== undefined) {
        callsByDate[dateStr]++;
      }
    });

    appointments.forEach(apt => {
      const dateStr = apt.createdAt.toISOString().split('T')[0];
      if (appointmentsByDate[dateStr] !== undefined) {
        appointmentsByDate[dateStr]++;
      }
    });

    chatMessages.forEach(msg => {
      const dateStr = msg.createdAt.toISOString().split('T')[0];
      if (chatsByDate[dateStr] !== undefined) {
        chatsByDate[dateStr]++;
      }
    });

    const callsOverTime = Object.keys(callsByDate).map((date) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calls: callsByDate[date],
      appointments: appointmentsByDate[date] || 0,
      chats: chatsByDate[date] || 0
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

    // Cost over time
    const costByDate = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      costByDate[dateStr] = 0;
    }
    calls.forEach(call => {
      const dateStr = call.createdAt.toISOString().split('T')[0];
      const cost = (call.duration || 0) * 0.01;
      if (costByDate[dateStr] !== undefined) {
        costByDate[dateStr] += cost;
      }
    });
    const costOverTime = Object.entries(costByDate).map(([date, cost]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: parseFloat(cost.toFixed(2))
    }));

    // Sentiment breakdown
    const sentimentCount = { positive: 0, neutral: 0, negative: 0 };
    calls.forEach(call => {
      const sentiment = call.sentiment || 'neutral';
      if (sentimentCount[sentiment] !== undefined) {
        sentimentCount[sentiment]++;
      }
    });
    const totalSentiment = Object.values(sentimentCount).reduce((a, b) => a + b, 0);
    const sentimentBreakdown = {
      positive: totalSentiment > 0 ? ((sentimentCount.positive / totalSentiment) * 100).toFixed(1) : 0,
      neutral: totalSentiment > 0 ? ((sentimentCount.neutral / totalSentiment) * 100).toFixed(1) : 0,
      negative: totalSentiment > 0 ? ((sentimentCount.negative / totalSentiment) * 100).toFixed(1) : 0
    };

    // 🔥 NEW: Channel distribution
    const channelStats = {
      phone: { count: totalCalls, percentage: 100 },
      chat: { count: totalChatMessages, percentage: 0 },
      total: totalCalls + totalChatMessages
    };
    if (channelStats.total > 0) {
      channelStats.phone.percentage = parseFloat(((totalCalls / channelStats.total) * 100).toFixed(1));
      channelStats.chat.percentage = parseFloat(((totalChatMessages / channelStats.total) * 100).toFixed(1));
    }

    res.json({
      // Original metrics
      totalCalls,
      totalMinutes: Math.round(totalDuration / 60),
      avgDuration,
      totalCost: parseFloat(totalCost.toFixed(2)),
      successRate: parseFloat(successRate),
      sentimentBreakdown,
      callsOverTime,
      statusDistribution,
      durationDistribution,
      assistantPerformance,
      costOverTime,
      
      // 🔥 NEW: Chat metrics
      totalChatMessages,
      chatConversations,
      
      // 🔥 NEW: Appointment metrics
      totalAppointments,
      confirmedAppointments,
      appointmentRate: parseFloat(appointmentRate),
      
      // 🔥 NEW: Channel stats
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

export default router;
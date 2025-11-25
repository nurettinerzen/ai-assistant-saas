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

    // Get assistants
    const assistants = await prisma.assistant.findMany({
      where: { businessId, isActive: true }
    });

    // Calculate stats
    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const successRate = totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : 0;
    const totalCost = totalDuration * 0.01; // $0.01 per second example

    // Calls over time
    const callsByDate = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      callsByDate[dateStr] = 0;
    }
    calls.forEach(call => {
      const dateStr = call.createdAt.toISOString().split('T')[0];
      if (callsByDate[dateStr] !== undefined) {
        callsByDate[dateStr]++;
      }
    });
    const callsOverTime = Object.entries(callsByDate).map(([date, calls]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calls
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

    res.json({
      totalCalls,
      avgDuration,
      totalCost: parseFloat(totalCost.toFixed(2)),
      successRate: parseFloat(successRate),
      callsOverTime,
      statusDistribution,
      durationDistribution,
      assistantPerformance,
      costOverTime
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
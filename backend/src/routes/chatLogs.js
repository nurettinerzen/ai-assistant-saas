/**
 * Chat Logs API
 * Manages chat conversation logs for analytics
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/chat-logs - Get all chat logs for business
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, channel, search, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      businessId: req.businessId
    };

    // Status filter (server-side)
    // Note: Most chats in DB are 'active' but get auto-marked as 'ended' if idle >30min (see processedLogs below).
    // So 'completed' filter = DB completed/ended + stale active chats (handled post-query).
    // 'active' filter = only truly active chats (updated within last 30 min).
    if (status && status !== 'all') {
      if (status === 'completed') {
        // Include all — we'll filter out truly active ones post-query
        // (most 'active' in DB are actually ended/stale)
        where.status = { in: ['completed', 'ended', 'active'] };
      } else if (status === 'active') {
        where.status = 'active';
      } else {
        where.status = status;
      }
    }

    // Channel filter (server-side)
    if (channel && channel !== 'all') {
      where.channel = channel;
    }

    // Search filter (server-side)
    if (search) {
      where.OR = [
        { sessionId: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerIp: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Date range filter (server-side)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [chatLogs, total] = await Promise.all([
      prisma.chatLog.findMany({
        where,
        include: {
          assistant: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.chatLog.count({ where })
    ]);

    // Auto-mark old "active" chats as "ended" (older than 30 minutes - matches session timeout)
    // Also compute messageCount from messages array if it's 0
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let processedLogs = chatLogs.map(log => {
      const processed = { ...log };

      // Fix stale active → ended
      if (processed.status === 'active' && new Date(processed.updatedAt) < thirtyMinutesAgo) {
        processed.status = 'ended';
      }

      // Fix messageCount: derive from messages array if stored count is 0
      if ((!processed.messageCount || processed.messageCount === 0) && Array.isArray(processed.messages)) {
        processed.messageCount = processed.messages.length;
      }

      return processed;
    });

    // Post-filter for status='completed': exclude truly active chats
    if (status === 'completed') {
      processedLogs = processedLogs.filter(log => log.status !== 'active');
    }

    res.json({
      chatLogs: processedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: status === 'completed' ? processedLogs.length : total,
        totalPages: status === 'completed'
          ? Math.ceil(processedLogs.length / parseInt(limit))
          : Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get chat logs error:', error);
    res.status(500).json({ error: 'Failed to fetch chat logs' });
  }
});

// GET /api/chat-logs/stats - Get chat statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {
      businessId: req.businessId
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalChats, totalMessages, activeChats] = await Promise.all([
      prisma.chatLog.count({ where }),
      prisma.chatLog.aggregate({
        where,
        _sum: { messageCount: true }
      }),
      prisma.chatLog.count({
        where: { ...where, status: 'active' }
      })
    ]);

    // Get daily chat counts for chart
    const dailyChats = await prisma.chatLog.groupBy({
      by: ['createdAt'],
      where,
      _count: true,
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      totalChats,
      totalMessages: totalMessages._sum.messageCount || 0,
      activeChats,
      avgMessagesPerChat: totalChats > 0
        ? Math.round((totalMessages._sum.messageCount || 0) / totalChats * 10) / 10
        : 0
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({ error: 'Failed to fetch chat statistics' });
  }
});

// GET /api/chat-logs/:id - Get single chat log with full messages
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const chatLog = await prisma.chatLog.findFirst({
      where: {
        id,
        businessId: req.businessId
      },
      include: {
        assistant: {
          select: { name: true }
        }
      }
    });

    if (!chatLog) {
      return res.status(404).json({ error: 'Chat log not found' });
    }

    // If no assistant attached, get business's first assistant
    if (!chatLog.assistant) {
      const business = await prisma.business.findUnique({
        where: { id: req.businessId },
        include: {
          assistants: {
            select: { name: true },
            take: 1
          }
        }
      });

      if (business?.assistants && business.assistants.length > 0) {
        chatLog.assistant = business.assistants[0];
      }
    }

    res.json(chatLog);
  } catch (error) {
    console.error('Get chat log error:', error);
    res.status(500).json({ error: 'Failed to fetch chat log' });
  }
});

// DELETE /api/chat-logs/:id - Delete a chat log
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.chatLog.deleteMany({
      where: {
        id,
        businessId: req.businessId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat log error:', error);
    res.status(500).json({ error: 'Failed to delete chat log' });
  }
});

export default router;

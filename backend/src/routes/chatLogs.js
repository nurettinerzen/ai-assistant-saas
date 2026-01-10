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
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      businessId: req.businessId
    };

    if (status) {
      where.status = status;
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

    res.json({
      chatLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
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

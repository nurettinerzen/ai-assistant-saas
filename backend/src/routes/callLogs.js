import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Get all call logs for the user's business
router.get('/', async (req, res) => {
  try {
    const { businessId } = req;
    const { status, search, limit = 100 } = req.query;

    // Build where clause
    const where = { businessId };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      // Search in transcript text, caller ID, or call ID
      where.OR = [
        {
          transcriptText: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          callerId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          callId: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Return with formatted data for frontend
    const formattedCalls = callLogs.map(call => ({
      id: call.id,
      callId: call.callId,
      phoneNumber: call.callerId,
      duration: call.duration,
      status: call.status,
      direction: call.direction || 'inbound',
      createdAt: call.createdAt,
      sentiment: call.sentiment,
      summary: call.summary,
      hasRecording: !!call.recordingUrl,
      hasTranscript: !!call.transcript || !!call.transcriptText,
    }));

    res.json({ calls: formattedCalls });
  } catch (error) {
    console.error('Get call logs error:', error);
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Get a single call log by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req;

    const callLog = await prisma.callLog.findUnique({
      where: { id: parseInt(id) }
    });

    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    if (callLog.businessId !== businessId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return full call details including transcript, recording, and analysis
    const response = {
      id: callLog.id,
      callId: callLog.callId,
      phoneNumber: callLog.callerId,
      duration: callLog.duration,
      recordingDuration: callLog.recordingDuration,
      status: callLog.status,
      createdAt: callLog.createdAt,
      updatedAt: callLog.updatedAt,

      // Recording
      recordingUrl: callLog.recordingUrl,

      // Transcript
      transcript: callLog.transcript, // JSON array of messages
      transcriptText: callLog.transcriptText,

      // AI Analysis
      summary: callLog.summary,
      sentiment: callLog.sentiment,
      sentimentScore: callLog.sentimentScore,
      keyTopics: callLog.keyTopics,
      actionItems: callLog.actionItems,
      keyPoints: callLog.keyPoints,

      // Legacy fields
      intent: callLog.intent,
      taskCompleted: callLog.taskCompleted,
      followUpNeeded: callLog.followUpNeeded,
    };

    res.json(response);
  } catch (error) {
    console.error('Get call log error:', error);
    res.status(500).json({ error: 'Failed to fetch call log' });
  }
});

// Create a new call log
router.post('/', async (req, res) => {
  try {
    const { callId, businessId, duration, status, transcript, recordingUrl, metadata } = req.body;

    // Verify user has access to this business
    if (businessId !== req.businessId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const callLog = await prisma.callLog.create({
      data: {
        callId,
        businessId,
        duration,
        status,
        transcript,
        recordingUrl,
        metadata
      }
    });

    res.status(201).json(callLog);
  } catch (error) {
    console.error('Create call log error:', error);
    res.status(500).json({ error: 'Failed to create call log' });
  }
});

// Get call statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { businessId } = req;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCalls = await prisma.callLog.count({
      where: { businessId }
    });

    const monthCalls = await prisma.callLog.count({
      where: {
        businessId,
        createdAt: {
          gte: firstDayOfMonth
        }
      }
    });

    const completedCalls = await prisma.callLog.count({
      where: {
        businessId,
        status: 'COMPLETED'
      }
    });

    const totalDuration = await prisma.callLog.aggregate({
      where: { businessId },
      _sum: {
        duration: true
      }
    });

    res.json({
      totalCalls,
      monthCalls,
      completedCalls,
      totalDuration: totalDuration._sum.duration || 0,
      averageDuration: totalCalls > 0 ? Math.round((totalDuration._sum.duration || 0) / totalCalls) : 0
    });
  } catch (error) {
    console.error('Get call stats error:', error);
    res.status(500).json({ error: 'Failed to fetch call statistics' });
  }
});

// Export calls as CSV
router.get('/export', async (req, res) => {
  try {
    const { businessId } = req;

    const callLogs = await prisma.callLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });

    // Create CSV
    const headers = ['Date', 'Phone Number', 'Duration', 'Status', 'Cost'];
    const rows = callLogs.map(call => [
      new Date(call.createdAt).toISOString(),
      call.callerId || 'Unknown',
      call.duration || 0,
      call.status,
      (call.duration * 0.01).toFixed(2) // Example cost calculation
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=calls.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export calls error:', error);
    res.status(500).json({ error: 'Failed to export calls' });
  }
});

export default router;
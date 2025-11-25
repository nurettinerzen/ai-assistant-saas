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

    const callLogs = await prisma.callLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to last 100 calls
    });

    res.json(callLogs);
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

    res.json(callLog);
  } catch (error) {
    console.error('Get call log error:', error);
    res.status(500).json({ error: 'Failed to fetch call log' });
  }
});

// Create a new call log (from VAPI webhook)
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

// VAPI Webhook endpoint (public - no auth required for this one)
router.post('/webhook/vapi', async (req, res) => {
  try {
    const vapiEvent = req.body;

    console.log('📞 VAPI Webhook received:', vapiEvent);

    // Handle different VAPI event types
    if (vapiEvent.type === 'call.ended' || vapiEvent.type === 'call-ended') {
      const { call } = vapiEvent;
      
      // Find business by assistant ID
      const business = await prisma.business.findFirst({
        where: { vapiAssistantId: call.assistantId }
      });

      if (!business) {
        console.error('Business not found for assistant:', call.assistantId);
        return res.status(404).json({ error: 'Business not found' });
      }

      // Create call log
      await prisma.callLog.create({
        data: {
          callId: call.id,
          businessId: business.id,
          duration: call.duration || 0,
          status: call.status || 'COMPLETED',
          transcript: call.transcript || null,
          recordingUrl: call.recordingUrl || null,
          metadata: call
        }
      });

      console.log('✅ Call log created for business:', business.name);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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
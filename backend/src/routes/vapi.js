// ============================================================================
// VAPI WEBHOOK HANDLER (UPDATED)
// ============================================================================
// FILE: backend/src/routes/vapi.js
//
// UPDATE your existing vapi.js or create if it doesn't exist
// Handles VAPI webhooks for call events and tracks usage
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import usageTracking from '../services/usageTracking.js';
import aiAnalysis from '../services/aiAnalysis.js';

const router = express.Router();
const prisma = new PrismaClient();

// VAPI webhook endpoint - NO AUTH required (VAPI sends webhooks)
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('📞 VAPI Webhook received:', event.type || event.event);

    // Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // Handle different event types
    const eventType = event.type || event.event;

    switch (eventType) {
      case 'call.started':
      case 'call-start':
        await handleCallStarted(event);
        break;

      case 'call.ended':
      case 'call-end':
        await handleCallEnded(event);
        break;

      case 'call.forwarded':
        await handleCallForwarded(event);
        break;

      case 'call.voicemail':
        await handleCallVoicemail(event);
        break;

      default:
        console.log(`ℹ️ Unhandled VAPI event: ${eventType}`);
    }
  } catch (error) {
    console.error('❌ VAPI webhook error:', error);
    // Still return 200 to acknowledge receipt
  }
});

// Handle call started
async function handleCallStarted(event) {
  try {
    const { call } = event;
    const callId = call?.id || event.callId;
    const assistantId = call?.assistantId || event.assistantId;

    if (!callId) {
      console.warn('⚠️ No call ID in call.started event');
      return;
    }

    // Find business by assistant ID
    const business = await prisma.business.findFirst({
      where: { vapiAssistantId: assistantId }
    });

    if (!business) {
      console.warn(`⚠️ No business found for assistant ${assistantId}`);
      return;
    }

    // Create initial call log
    await prisma.callLog.create({
      data: {
        businessId: business.id,
        callId: callId,
        callerId: call?.customer?.number || 'Unknown',
        status: 'in_progress',
        createdAt: new Date()
      }
    });

    console.log(`✅ Call started logged: ${callId}`);
  } catch (error) {
    console.error('❌ Error handling call started:', error);
  }
}

// Handle call ended
async function handleCallEnded(event) {
  try {
    const { call } = event;
    const callId = call?.id || event.callId;
    const assistantId = call?.assistantId || event.assistantId;
    const duration = call?.duration || event.duration || 0; // in seconds
    const transcript = call?.transcript || event.transcript || '';
    const recordingUrl = call?.recordingUrl || event.recordingUrl;
    const status = call?.endedReason || event.endedReason || 'completed';

    if (!callId) {
      console.warn('⚠️ No call ID in call.ended event');
      return;
    }

    // Find business by assistant ID
    const business = await prisma.business.findFirst({
      where: { vapiAssistantId: assistantId },
      include: {
        subscription: {
          select: {
            plan: true
          }
        }
      }
    });

    if (!business) {
      console.warn(`⚠️ No business found for assistant ${assistantId}`);
      return;
    }

    // Update call log with final data
    const callLog = await prisma.callLog.upsert({
      where: { callId },
      update: {
        duration,
        transcript,
        recordingUrl,
        status: status === 'completed' ? 'answered' : status,
        updatedAt: new Date()
      },
      create: {
        businessId: business.id,
        callId,
        callerId: call?.customer?.number || 'Unknown',
        duration,
        transcript,
        recordingUrl,
        status: status === 'completed' ? 'answered' : status,
        createdAt: new Date()
      }
    });

    console.log(`✅ Call ended logged: ${callId} (${duration}s)`);

    // Track usage (minutes and call count)
    if (duration > 0) {
      await usageTracking.trackCallUsage(business.id, duration, {
        callId,
        transcript,
        status
      });
    }

    // Queue AI analysis for PRO+ plans
    const plan = business.subscription?.plan;
    if ((plan === 'PROFESSIONAL' || plan === 'ENTERPRISE') && transcript) {
      console.log('🤖 Queueing AI analysis for PRO plan...');
      // Run AI analysis in background (don't await)
      aiAnalysis.analyzeCall(callLog.id).catch(err => {
        console.error('AI analysis error:', err);
      });
    }
  } catch (error) {
    console.error('❌ Error handling call ended:', error);
  }
}

// Handle forwarded calls
async function handleCallForwarded(event) {
  try {
    const { call } = event;
    const callId = call?.id || event.callId;

    if (!callId) return;

    await prisma.callLog.update({
      where: { callId },
      data: {
        status: 'forwarded',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Call forwarded: ${callId}`);
  } catch (error) {
    console.error('❌ Error handling call forwarded:', error);
  }
}

// Handle voicemail
async function handleCallVoicemail(event) {
  try {
    const { call } = event;
    const callId = call?.id || event.callId;

    if (!callId) return;

    await prisma.callLog.update({
      where: { callId },
      data: {
        status: 'voicemail',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Voicemail recorded: ${callId}`);
  } catch (error) {
    console.error('❌ Error handling voicemail:', error);
  }
}

// Manual endpoint to track call usage (for testing or manual calls)
router.post('/track-call', async (req, res) => {
  try {
    const { businessId, duration, callerId, transcript, status } = req.body;

    if (!businessId || !duration) {
      return res.status(400).json({ 
        error: 'businessId and duration required' 
      });
    }

    // Track usage
    const result = await usageTracking.trackCallUsage(
      businessId, 
      duration,
      { callerId, transcript, status }
    );

    res.json({
      success: true,
      usage: result
    });
  } catch (error) {
    console.error('Track call error:', error);
    res.status(500).json({ 
      error: 'Failed to track call',
      message: error.message
    });
  }
});

export default router;

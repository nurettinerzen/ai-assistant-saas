// ============================================================================
// WEBHOOK ROUTES
// ============================================================================
// Handles webhooks from external services (VAPI, Stripe, etc.)
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// VAPI WEBHOOK
// ============================================================================
router.post('/vapi', async (req, res) => {
  try {
    const { type, call } = req.body;
    
    console.log('📞 VAPI Webhook received:', type);
    console.log('Call data:', JSON.stringify(call, null, 2));

    // Handle call-ended event
    if (type === 'call-ended' || type === 'end-of-call-report') {
      await handleCallEnded(call);
    }

    // Handle call-started event
    if (type === 'call-start') {
      console.log('✅ Call started:', call.id);
    }

    // Respond immediately to VAPI
    res.json({ success: true, received: true });

  } catch (error) {
    console.error('❌ VAPI webhook error:', error);
    // Still return 200 to avoid retries
    res.json({ success: false, error: error.message });
  }
});

// ============================================================================
// HANDLE CALL ENDED
// ============================================================================
async function handleCallEnded(call) {
  try {
    console.log('📊 Processing call-ended:', call.id);

    // Extract business ID from assistant ID or phone number
    // This needs to be implemented based on your assistant setup
    const businessId = await extractBusinessId(call);
    
    if (!businessId) {
      console.warn('⚠️ Could not extract businessId from call');
      return;
    }

    // Extract AI analysis from call
    const analysis = call.analysis || {};
    const transcript = call.transcript || call.messages?.map(m => m.message).join('\n') || '';

    // Create CallLog entry
    const callLog = await prisma.callLog.create({
      data: {
        businessId: businessId,
        callId: call.id,
        callerId: call.customer?.number || call.phoneNumber || 'unknown',
        duration: call.duration || call.endedAt && call.startedAt 
          ? Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) 
          : 0,
        status: call.status || 'completed',
        transcript: transcript,
        recordingUrl: call.recordingUrl || call.artifact?.recordingUrl,
        
        // AI Analysis
        intent: analysis.intent || analysis.structuredData?.intent,
        sentiment: analysis.sentiment || detectSentiment(transcript),
        summary: analysis.summary || generateSummary(transcript),
        keyPoints: analysis.keyPoints || [],
        taskCompleted: analysis.taskCompleted ?? null,
        followUpNeeded: analysis.followUpNeeded ?? null,
      }
    });

    console.log('✅ CallLog created:', callLog.id);

    // Trigger Zapier webhook if configured
    await triggerZapierWebhook(businessId, call, callLog);

  } catch (error) {
    console.error('❌ Error handling call-ended:', error);
    throw error;
  }
}

// ============================================================================
// EXTRACT BUSINESS ID
// ============================================================================
async function extractBusinessId(call) {
  try {
    // Method 1: From assistant ID
    if (call.assistantId) {
      const assistant = await prisma.assistant.findUnique({
        where: { vapiAssistantId: call.assistantId },
        select: { businessId: true }
      });
      if (assistant) return assistant.businessId;
    }

    // Method 2: From phone number
    if (call.phoneNumber || call.customer?.number) {
      const phoneNumber = call.phoneNumber || call.customer?.number;
      const business = await prisma.business.findFirst({
        where: {
          phoneNumbers: {
            has: phoneNumber
          }
        },
        select: { id: true }
      });
      if (business) return business.id;
    }

    return null;
  } catch (error) {
    console.error('Error extracting business ID:', error);
    return null;
  }
}

// ============================================================================
// DETECT SENTIMENT (Simple implementation)
// ============================================================================
function detectSentiment(transcript) {
  if (!transcript) return 'neutral';
  
  const text = transcript.toLowerCase();
  
  // Positive words
  const positiveWords = ['thank', 'great', 'excellent', 'perfect', 'happy', 'good', 'wonderful', 'amazing'];
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  
  // Negative words
  const negativeWords = ['bad', 'terrible', 'awful', 'angry', 'frustrated', 'disappointed', 'problem', 'issue'];
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

// ============================================================================
// GENERATE SUMMARY (Simple implementation)
// ============================================================================
function generateSummary(transcript) {
  if (!transcript) return 'No transcript available';
  
  // Take first 150 characters as summary
  const summary = transcript.substring(0, 150).trim();
  return summary.length < transcript.length ? summary + '...' : summary;
}

// ============================================================================
// TRIGGER ZAPIER WEBHOOK
// ============================================================================
async function triggerZapierWebhook(businessId, call, callLog) {
  try {
    // Get Zapier integration
    const integration = await prisma.integration.findFirst({
      where: {
        businessId: businessId,
        type: 'ZAPIER',
        connected: true
      }
    });

    if (!integration || !integration.credentials?.webhookUrl) {
      console.log('No Zapier webhook configured');
      return;
    }

    const webhookUrl = integration.credentials.webhookUrl;

    // Prepare payload
    const payload = {
      event: 'call_completed',
      call_id: call.id,
      duration: callLog.duration,
      transcript: callLog.transcript,
      summary: callLog.summary,
      sentiment: callLog.sentiment,
      customer_phone: callLog.callerId,
      timestamp: new Date().toISOString()
    };

    // Send to Zapier
    const axios = (await import('axios')).default;
    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    console.log('✅ Zapier webhook triggered');

  } catch (error) {
    console.error('❌ Zapier webhook error:', error.message);
    // Don't throw - webhook failures shouldn't break the main flow
  }
}

// ============================================================================
// STRIPE WEBHOOK (for future use)
// ============================================================================
router.post('/stripe', async (req, res) => {
  try {
    // Stripe webhook handling
    console.log('💳 Stripe webhook received');
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;

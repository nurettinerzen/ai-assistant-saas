// ============================================================================
// VAPI WEBHOOK HANDLER (REFACTORED)
// ============================================================================
// FILE: backend/src/routes/vapi.js
//
// Handles VAPI webhooks for call events and tracks usage
// Now uses central tool system for function calling
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import usageTracking from '../services/usageTracking.js';
import callAnalysis from '../services/callAnalysis.js';
import { getActiveToolsForVAPI, executeTool } from '../tools/index.js';
import batchCallService from '../services/batch-call.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Get formatted date/time string for a business timezone
 * @param {Object} business - Business object with timezone and language
 * @returns {string} Formatted date/time context string for prompt
 */
function getDynamicDateTimeContext(business) {
  const now = new Date();
  const timezone = business.timezone || 'Europe/Istanbul';
  const lang = business.language || 'TR';
  const locale = lang === 'TR' ? 'tr-TR' : 'en-US';

  const dateStr = now.toLocaleDateString(locale, {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });

  if (lang === 'TR') {
    return `\n\n## GÜNCEL BİLGİLER (ÇEVRİMİÇİ)\n- Bugün: ${dateStr}\n- Şu anki saat: ${timeStr}\n- Saat Dilimi: ${timezone}`;
  }
  return `\n\n## CURRENT INFORMATION (LIVE)\n- Today: ${dateStr}\n- Current time: ${timeStr}\n- Timezone: ${timezone}`;
}

// VAPI webhook endpoint - NO AUTH required (VAPI sends webhooks)
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('📞 VAPI Webhook received:', JSON.stringify(event, null, 2).substring(0, 500));

    // Handle different event types
    const eventType = event.message?.type || event.type || event.event;

    switch (eventType) {
      // ========== ASSISTANT REQUEST - Dynamic prompt injection ==========
      case 'assistant-request': {
        // This event is fired when a call starts - we can override assistant config
        const assistantId = event.message?.call?.assistantId || event.call?.assistantId;

        if (assistantId) {
          const business = await prisma.business.findFirst({
            where: { vapiAssistantId: assistantId }
          });

          if (business) {
            // Generate dynamic date/time context for this call
            const dynamicContext = getDynamicDateTimeContext(business);
            console.log('📅 Injecting dynamic date/time for business:', business.name);

            // Return assistant override with dynamic prompt addition
            return res.status(200).json({
              assistantOverrides: {
                model: {
                  messages: [
                    {
                      role: 'system',
                      content: dynamicContext
                    }
                  ]
                }
              }
            });
          }
        }

        // No override needed
        return res.status(200).json({});
      }

      case 'call.started':
      case 'call-start':
        res.status(200).json({ received: true });
        await handleCallStarted(event);
        break;

      case 'call.ended':
      case 'call-end':
      case 'status-update':
        res.status(200).json({ received: true });
        await handleCallEnded(event);
        break;

      case 'call.forwarded':
        res.status(200).json({ received: true });
        await handleCallForwarded(event);
        break;

      case 'call.voicemail':
        res.status(200).json({ received: true });
        await handleCallVoicemail(event);
        break;

      default:
        console.log(`ℹ️ Unhandled VAPI event: ${eventType}`);
        res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error('❌ VAPI webhook error:', error);
    // Still return 200 to acknowledge receipt
    res.status(200).json({ received: true });
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
    const recordingUrl = call?.recordingUrl || event.recordingUrl || call?.artifact?.recordingUrl;
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

    // Parse transcript messages from VAPI format
    let transcriptMessages = [];
    let transcriptText = '';

    if (call?.messages && Array.isArray(call.messages)) {
      // VAPI provides messages array with role, content, timestamp
      transcriptMessages = call.messages
        .filter(msg => msg.role === 'assistant' || msg.role === 'user')
        .map(msg => ({
          speaker: msg.role === 'assistant' ? 'assistant' : 'user',
          text: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString()
        }));

      transcriptText = callAnalysis.extractTranscriptText(transcriptMessages);
    } else if (call?.transcript) {
      // Fallback to plain text transcript
      transcriptText = call.transcript;
    } else if (event.transcript) {
      transcriptText = event.transcript;
    }

    // Perform AI analysis for calls with transcripts
    let analysis = {
      summary: null,
      keyTopics: [],
      actionItems: [],
      sentiment: 'neutral',
      sentimentScore: 0.5,
    };

    const plan = business.subscription?.plan;
    const shouldAnalyze = (plan === 'PROFESSIONAL' || plan === 'ENTERPRISE') &&
                          (transcriptMessages.length > 0 || transcriptText.length > 0);

    if (shouldAnalyze) {
      console.log('🤖 Running AI analysis for call:', callId);
      try {
        if (transcriptMessages.length > 0) {
          analysis = await callAnalysis.analyzeCall(transcriptMessages, duration);
        } else if (transcriptText.length > 0) {
          analysis.summary = await callAnalysis.generateQuickSummary(transcriptText);
        }
      } catch (analysisError) {
        console.error('⚠️ AI analysis failed (non-critical):', analysisError);
      }
    }

    // Update call log with final data
    const callLog = await prisma.callLog.upsert({
      where: { callId },
      update: {
        duration,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        recordingUrl: recordingUrl || null,
        recordingDuration: duration || null,
        status: status === 'completed' ? 'answered' : status,
        summary: analysis.summary,
        keyTopics: analysis.keyTopics,
        actionItems: analysis.actionItems,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        updatedAt: new Date()
      },
      create: {
        businessId: business.id,
        callId,
        callerId: call?.customer?.number || 'Unknown',
        duration,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        recordingUrl: recordingUrl || null,
        recordingDuration: duration || null,
        status: status === 'completed' ? 'answered' : status,
        summary: analysis.summary,
        keyTopics: analysis.keyTopics,
        actionItems: analysis.actionItems,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        createdAt: new Date()
      }
    });

    console.log(`✅ Call ended logged: ${callId} (${duration}s) with AI analysis`);

    // Track usage (minutes and call count)
    if (duration > 0) {
      await usageTracking.trackCallUsage(business.id, duration, {
        callId,
        transcript: transcriptText,
        status
      });
    }

    // Handle batch call / campaign call updates
    try {
      await batchCallService.handleCallWebhook({
        type: 'call.ended',
        call: {
          id: callId,
          duration,
          transcript: transcriptMessages,
          transcriptText,
          endedReason: status,
          summary: analysis.summary
        }
      });
    } catch (batchError) {
      // Non-critical - batch call update failed but regular call log is saved
      console.log('ℹ️ No batch call found for this call ID (normal for regular calls)');
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

// ============================================================================
// VAPI FUNCTION CALLING ENDPOINT
// ============================================================================
// This endpoint handles function calls from VAPI AI assistants during calls
// Uses central tool system for all function execution
// ============================================================================

router.post('/functions', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('📞 VAPI Function Call received:', JSON.stringify(req.body, null, 2));

    // Acknowledge receipt immediately
    if (!message || !message.toolCalls || message.toolCalls.length === 0) {
      return res.status(400).json({
        error: 'No function calls provided'
      });
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(message);

    if (!business) {
      return res.status(404).json({
        error: 'Business not found for this assistant'
      });
    }

    // Process all function calls
    const results = [];

    for (const toolCall of message.toolCalls) {
      const { id: toolCallId, function: func } = toolCall;
      const functionName = func?.name;
      const functionArgs = typeof func.arguments === 'string'
        ? JSON.parse(func.arguments)
        : func.arguments;

      console.log(`📞 Processing function: ${functionName}`, functionArgs);

      // Execute using central tool system
      const result = await executeTool(functionName, functionArgs, business, { channel: 'PHONE' });

      results.push({
        toolCallId,
        result
      });
    }

    // Return results in VAPI expected format
    res.json({ results });

  } catch (error) {
    console.error('❌ VAPI function call error:', error);
    res.status(500).json({
      error: 'Function call processing failed',
      message: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get business information from VAPI call data
 * Finds business by assistant ID from the call
 * @param {Object} vapiMessage - VAPI message object containing call info
 * @returns {Promise<Object>} Business object with integrations
 */
async function getBusinessFromVapiCall(vapiMessage) {
  try {
    // Extract assistant ID from message
    const assistantId = vapiMessage?.call?.assistantId ||
                       vapiMessage?.assistantId ||
                       vapiMessage?.assistant?.id;

    if (!assistantId) {
      throw new Error('No assistant ID found in VAPI call data');
    }

    console.log(`🔍 Looking up business for assistant: ${assistantId}`);

    // Find business by VAPI assistant ID
    const business = await prisma.business.findFirst({
      where: { vapiAssistantId: assistantId },
      include: {
        integrations: {
          where: { isActive: true }
        },
        users: {
          where: { role: 'OWNER' },
          take: 1,
          select: {
            email: true
          }
        }
      }
    });

    if (!business) {
      throw new Error(`No business found for assistant ID: ${assistantId}`);
    }

    console.log(`✅ Found business: ${business.name} (ID: ${business.id})`);
    return business;

  } catch (error) {
    console.error('❌ Error finding business from VAPI call:', error);
    throw error;
  }
}

/**
 * Get active tools for a business based on their integrations
 * @param {number} businessId - Business ID
 * @returns {Promise<Array>} Array of active tools
 */
export async function getActiveToolsForBusiness(businessId) {
  // Get business with integrations and CRM webhook
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      integrations: {
        where: { isActive: true }
      },
      crmWebhook: true
    }
  });

  if (!business) {
    return [];
  }

  // Get CRM data counts if webhook is active
  if (business.crmWebhook?.isActive) {
    const [ordersCount, stockCount, ticketsCount] = await Promise.all([
      prisma.crmOrder.count({ where: { businessId } }),
      prisma.crmStock.count({ where: { businessId } }),
      prisma.crmTicket.count({ where: { businessId } })
    ]);

    business.crmDataCounts = {
      orders: ordersCount,
      stock: stockCount,
      tickets: ticketsCount
    };
  }

  // Use central tool system
  return getActiveToolsForVAPI(business);
}

export default router;

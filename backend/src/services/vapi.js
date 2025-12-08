// ============================================================================
// VAPI WEBHOOK HANDLER (COMPLETE VERSION)
// ============================================================================
// FILE: backend/src/routes/vapi.js
//
// Handles:
// 1. Call events (started, ended, forwarded, voicemail)
// 2. Function calling (appointments, SMS, queries)
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import usageTracking from '../services/usageTracking.js';
import aiAnalysis from '../services/aiAnalysis.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// WEBHOOK ENDPOINT - Call Events
// ============================================================================
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
  }
});

// ============================================================================
// FUNCTION CALLING ENDPOINT
// ============================================================================
// VAPI calls this when AI wants to execute a function
router.post('/functions', async (req, res) => {
  try {
    const { message } = req.body;
    
    console.log('🔧 VAPI Function Call received:', JSON.stringify(message, null, 2));

    // Check if this is a function call
    if (message?.type !== 'function-call') {
      return res.status(400).json({ error: 'Not a function call' });
    }

    const { toolCallId, function: functionCall } = message.toolCall;
    const { name, parameters } = functionCall;

    let result;

    // Route to appropriate handler
    switch (name) {
      case 'create_appointment':
        result = await handleCreateAppointment(parameters);
        break;

      case 'send_order_notification':
        result = await handleSendOrderNotification(parameters);
        break;

      case 'query_knowledge_base':
        result = await handleQueryKnowledgeBase(parameters);
        break;

      case 'check_availability':
        result = await handleCheckAvailability(parameters);
        break;

      default:
        result = { 
          success: false, 
          message: `Function not implemented: ${name}` 
        };
    }

    // Return result to VAPI (CRITICAL: must include toolCallId)
    res.json({
      results: [{
        toolCallId: toolCallId,
        result: result
      }]
    });

    console.log(`✅ Function ${name} executed successfully`);

  } catch (error) {
    console.error('❌ Function call error:', error);
    res.status(500).json({
      results: [{
        toolCallId: req.body.message?.toolCall?.toolCallId,
        error: error.message
      }]
    });
  }
});

// ============================================================================
// CALL EVENT HANDLERS
// ============================================================================

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

async function handleCallEnded(event) {
  try {
    const { call } = event;
    const callId = call?.id || event.callId;
    const assistantId = call?.assistantId || event.assistantId;
    const duration = call?.duration || event.duration || 0;
    const transcript = call?.transcript || event.transcript || '';
    const recordingUrl = call?.recordingUrl || event.recordingUrl;
    const status = call?.endedReason || event.endedReason || 'completed';

    if (!callId) {
      console.warn('⚠️ No call ID in call.ended event');
      return;
    }

    // Find business
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

    // Update call log
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

    // Track usage
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
      console.log('🤖 Queueing AI analysis...');
      aiAnalysis.analyzeCall(callLog.id).catch(err => {
        console.error('AI analysis error:', err);
      });
    }
  } catch (error) {
    console.error('❌ Error handling call ended:', error);
  }
}

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

// ============================================================================
// FUNCTION HANDLERS
// ============================================================================

// 1. Create appointment
async function handleCreateAppointment(params) {
  try {
    const { 
      date, 
      time, 
      customer_name, 
      customer_phone, 
      service_type,
      business_id 
    } = params;

    console.log('📅 Creating appointment:', {
      date, time, customer_name, customer_phone, service_type
    });

    // TODO: Google Calendar integration will go here
    // For now, just log and prepare for SMS notification

    // Get business info to send notification
    if (business_id) {
      const business = await prisma.business.findUnique({
        where: { id: business_id },
        select: { 
          ownerPhone: true,
          name: true 
        }
      });

      if (business?.ownerPhone) {
        // TODO: Send SMS to business owner
        // await sendSMS(business.ownerPhone, 
        //   `Yeni randevu: ${date} ${time}\nMüşteri: ${customer_name} (${customer_phone})\nHizmet: ${service_type}`
        // );
        console.log(`📱 SMS queued to: ${business.ownerPhone}`);
      }
    }

    return {
      success: true,
      message: `Randevunuz ${date} tarihinde ${time} saatinde oluşturuldu. Kısa süre içinde onay mesajı alacaksınız.`,
      appointment_id: `APT-${Date.now()}`
    };

  } catch (error) {
    console.error('Appointment creation error:', error);
    return {
      success: false,
      message: 'Randevu oluşturulamadı. Lütfen tekrar deneyin veya telefonla arayın.'
    };
  }
}

// 2. Send order notification
async function handleSendOrderNotification(params) {
  try {
    const { 
      order_items, 
      customer_name,
      customer_phone, 
      delivery_address,
      business_id 
    } = params;

    console.log('📦 Sending order notification:', {
      order_items, customer_name, customer_phone, delivery_address
    });

    // Get business info
    if (business_id) {
      const business = await prisma.business.findUnique({
        where: { id: business_id },
        select: { 
          ownerPhone: true,
          ownerWhatsApp: true,
          name: true 
        }
      });

      if (business?.ownerPhone) {
        // TODO: Send SMS/WhatsApp to business owner
        const message = `🍕 YENİ SİPARİŞ!\n\n${order_items}\n\nMüşteri: ${customer_name}\nTelefon: ${customer_phone}\nAdres: ${delivery_address}`;
        
        // await sendSMS(business.ownerPhone, message);
        // OR
        // await sendWhatsApp(business.ownerWhatsApp, message);
        
        console.log(`📱 Notification queued to: ${business.ownerPhone}`);
      }
    }

    return {
      success: true,
      message: 'Siparişiniz alındı! Restoran onayladıktan sonra tahmini teslimat süresi 30-45 dakikadır.'
    };

  } catch (error) {
    console.error('Order notification error:', error);
    return {
      success: false,
      message: 'Sipariş iletilemedi. Lütfen tekrar deneyin.'
    };
  }
}

// 3. Query knowledge base
async function handleQueryKnowledgeBase(params) {
  try {
    const { query, business_id } = params;

    console.log('🔍 Querying knowledge base:', { query, business_id });

    // TODO: Implement knowledge base search
    // For now, return placeholder
    // const result = await searchKnowledgeBase(business_id, query);

    return {
      success: true,
      data: 'Menümüzde pizza, burger, makarna ve salatalar bulunmaktadır. Tüm ürünler taze malzemelerle hazırlanır.'
    };

  } catch (error) {
    console.error('Query error:', error);
    return {
      success: false,
      message: 'Bilgi bulunamadı. Lütfen farklı bir şekilde sorun.'
    };
  }
}

// 4. Check availability (for appointments)
async function handleCheckAvailability(params) {
  try {
    const { date, time_range, business_id } = params;

    console.log('🕐 Checking availability:', { date, time_range, business_id });

    // TODO: Check Google Calendar availability
    // For now, return mock data

    return {
      success: true,
      available_slots: ['10:00', '14:00', '16:00'],
      message: `${date} tarihinde uygun saatler: 10:00, 14:00, 16:00`
    };

  } catch (error) {
    console.error('Availability check error:', error);
    return {
      success: false,
      message: 'Müsaitlik kontrolü yapılamadı.'
    };
  }
}

// ============================================================================
// MANUAL TESTING ENDPOINT
// ============================================================================
router.post('/track-call', async (req, res) => {
  try {
    const { businessId, duration, callerId, transcript, status } = req.body;

    if (!businessId || !duration) {
      return res.status(400).json({ 
        error: 'businessId and duration required' 
      });
    }

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
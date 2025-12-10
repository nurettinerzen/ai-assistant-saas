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
import googleCalendarService from '../services/google-calendar.js';
import netgsmService from '../services/netgsm.js';
import whatsappService from '../services/whatsapp.js';

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

// ============================================================================
// VAPI FUNCTION CALLING ENDPOINT
// ============================================================================
// This endpoint handles function calls from VAPI AI assistants during calls
// Each business has their own integrations (Google Calendar, SMS, etc.)
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

    // Process all function calls
    const results = [];

    for (const toolCall of message.toolCalls) {
      const { id: toolCallId, function: func } = toolCall;
      const functionName = func?.name;
      const functionArgs = typeof func.arguments === 'string' 
  ? JSON.parse(func.arguments) 
  : func.arguments;

      console.log(`📞 Processing function: ${functionName}`, functionArgs);

      let result;

      try {
        switch (functionName) {
          case 'create_appointment':
            result = await handleCreateAppointment(functionArgs, message);
            break;

          case 'send_order_notification':
            result = await handleSendOrderNotification(functionArgs, message);
            break;

          default:
            result = {
              success: false,
              message: `Unknown function: ${functionName}`
            };
        }
      } catch (error) {
        console.error(`❌ Function ${functionName} error:`, error);
        result = {
          success: false,
          message: error.message || 'Function execution failed'
        };
      }

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
// HELPER FUNCTIONS FOR VAPI FUNCTION CALLING
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
    // VAPI provides this in the call object
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
 * Format appointment notification message for SMS/WhatsApp
 * @param {Object} appointmentData - Appointment details
 * @param {string} language - Language code (EN, TR, etc.)
 * @returns {string} Formatted message
 */
function formatAppointmentNotification(appointmentData, language = 'TR') {
  const { customerName, customerPhone, appointmentDate, serviceType } = appointmentData;

  // Format date and time
  const date = new Date(appointmentDate);
  const dateStr = date.toLocaleDateString('tr-TR');
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Format based on language
  if (language === 'TR') {
    return `🗓️ Yeni Randevu Bildirimi

📅 Tarih: ${dateStr}
⏰ Saat: ${timeStr}
👤 Müşteri: ${customerName}
📞 Telefon: ${customerPhone}
${serviceType ? `✨ Hizmet: ${serviceType}` : ''}

Randevu sisteminize kaydedildi.`;
  } else {
    // English
    return `🗓️ New Appointment Notification

📅 Date: ${date.toLocaleDateString('en-US')}
⏰ Time: ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
👤 Customer: ${customerName}
📞 Phone: ${customerPhone}
${serviceType ? `✨ Service: ${serviceType}` : ''}

Appointment saved to your system.`;
  }
}

/**
 * Format order notification message for SMS/WhatsApp
 * @param {Object} orderData - Order details
 * @param {string} language - Language code
 * @returns {string} Formatted message
 */
function formatOrderNotification(orderData, language = 'TR') {
  const { customerName, customerPhone, orderItems } = orderData;

  if (language === 'TR') {
    return `🛒 Yeni Sipariş Bildirimi

👤 Müşteri: ${customerName}
📞 Telefon: ${customerPhone}

📦 Sipariş Detayı:
${orderItems}

Sipariş alındı ve işleme alınıyor.`;
  } else {
    return `🛒 New Order Notification

👤 Customer: ${customerName}
📞 Phone: ${customerPhone}

📦 Order Details:
${orderItems}

Order received and processing.`;
  }
}

// ============================================================================
// FUNCTION HANDLERS
// ============================================================================

/**
 * Handle create_appointment function call
 * Creates appointment in business's Google Calendar
 * Also sends SMS notification to business owner
 */
async function handleCreateAppointment(args, vapiMessage) {
  try {
    const { date, time, customer_name, customer_phone, service_type } = args;

    console.log('📅 Creating appointment:', { date, time, customer_name, customer_phone, service_type });

    // Validate required parameters
    if (!date || !time || !customer_name || !customer_phone) {
      return {
        success: false,
        message: 'Missing required parameters: date, time, customer_name, and customer_phone are required'
      };
    }

    // Get business (uses MULTI-TENANT logic - each business has their own integrations)
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Parse appointment date/time
    // Combine date and time into a proper DateTime
    let appointmentDateTime;
    try {
      // Handle various date/time formats
      // Example: date="2024-12-15", time="14:00" or "2:00 PM"
      appointmentDateTime = new Date(`${date}T${time}`);

      // If invalid, try parsing differently
      if (isNaN(appointmentDateTime.getTime())) {
        appointmentDateTime = new Date(`${date} ${time}`);
      }

      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error('Invalid date/time format');
      }
    } catch (error) {
      return {
        success: false,
        message: `Invalid date or time format. Please provide date as YYYY-MM-DD and time as HH:MM`
      };
    }

    // Check if business has Google Calendar connected
    const googleCalendarIntegration = business.integrations.find(
      i => i.type === 'GOOGLE_CALENDAR' && i.isActive
    );

    let calendarEventId = null;

    if (googleCalendarIntegration) {
      // Business has Google Calendar - create event in THEIR calendar
      console.log('📅 Creating Google Calendar event for business:', business.name);

      try {
        const { access_token, refresh_token } = googleCalendarIntegration.credentials;

        // Calculate end time (default 30 minutes, or use business booking duration)
        const duration = business.bookingDuration || 30;
        const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

        // Create event in business's Google Calendar
        const event = await googleCalendarService.createEvent(
          access_token,
          refresh_token,
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          {
            summary: `${service_type || 'Appointment'} - ${customer_name}`,
            description: `Customer: ${customer_name}\nPhone: ${customer_phone}\nService: ${service_type || 'Not specified'}`,
            start: {
              dateTime: appointmentDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            },
            end: {
              dateTime: endDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            },
          
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 }
              ]
            }
          }
        );

        calendarEventId = event.id;
        console.log('✅ Google Calendar event created:', calendarEventId);

      } catch (calendarError) {
        console.error('❌ Google Calendar error:', calendarError);
        // Continue anyway - we'll still save to database
      }
    }

    if (business.ownerWhatsApp) {
  try {
    console.log('📱 Sending WhatsApp notification to:', business.ownerWhatsApp);
    
    const axios = (await import('axios')).default;
    
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: business.ownerWhatsApp,
        type: 'text',
        text: {
          body: `🎉 *New Appointment!*\n\nCustomer: ${customer_name}\nPhone: ${customer_phone}\nDate: ${date}\nTime: ${time}\nService: ${service_type || 'Not specified'}`
        }
      }
    });
    
    console.log('✅ WhatsApp notification sent successfully');
  } catch (whatsappError) {
    console.error('❌ WhatsApp notification failed:', whatsappError.response?.data || whatsappError.message);
  }
}

    // Save appointment to database (local copy)
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerName: customer_name,
        customerPhone: customer_phone,
        appointmentDate: appointmentDateTime,
        duration: business.bookingDuration || 30,
        serviceType: service_type || null,
        status: 'CONFIRMED',
        notes: `Created via AI assistant call${calendarEventId ? ` - Google Calendar Event ID: ${calendarEventId}` : ''}`
      }
    });

    console.log('✅ Appointment saved to database:', appointment.id);

    // Send SMS notification to business owner
    try {
      // Get business owner's phone number (from first phone number in array)
      const ownerPhone = business.phoneNumbers?.[0];

      if (ownerPhone) {
        const notificationMessage = formatAppointmentNotification(
          {
            customerName: customer_name,
            customerPhone: customer_phone,
            appointmentDate: appointmentDateTime,
            serviceType: service_type
          },
          business.language
        );

        await netgsmService.sendSMS(ownerPhone, notificationMessage);
        console.log('✅ SMS notification sent to business owner');
      }
    } catch (smsError) {
      console.error('⚠️ SMS notification failed (non-critical):', smsError);
      // Don't fail the whole operation if SMS fails
    }

    // Return success message to VAPI (AI will speak this to customer)
    const successMessage = business.language === 'TR'
      ? `Randevunuz ${date} tarihinde saat ${time} için başarıyla oluşturuldu. Randevu bilgileriniz ${customer_phone} numarasına SMS ile gönderilecek.`
      : `Your appointment has been successfully created for ${date} at ${time}. Appointment details will be sent to ${customer_phone} via SMS.`;

    return {
      success: true,
      message: successMessage,
      appointmentId: appointment.id,
      calendarEventId: calendarEventId
    };

  } catch (error) {
    console.error('❌ Create appointment error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create appointment. Please try again or speak with a representative.'
    };
  }
}

/**
 * Handle send_order_notification function call
 * Sends order notification to business owner via SMS or WhatsApp
 */
async function handleSendOrderNotification(args, vapiMessage) {
  try {
    const { customer_name, customer_phone, order_items } = args;

    console.log('📦 Sending order notification:', { customer_name, customer_phone, order_items });

    // Validate required parameters
    if (!customer_name || !customer_phone || !order_items) {
      return {
        success: false,
        message: 'Missing required parameters: customer_name, customer_phone, and order_items are required'
      };
    }

    // Get business (MULTI-TENANT - each business gets their own notifications)
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Get business owner's contact info
    const ownerPhone = business.phoneNumbers?.[0];

    if (!ownerPhone) {
      return {
        success: false,
        message: 'Business owner phone number not configured'
      };
    }

    // Format notification message
    const notificationMessage = formatOrderNotification(
      {
        customerName: customer_name,
        customerPhone: customer_phone,
        orderItems: order_items
      },
      business.language
    );

    // Check if business prefers WhatsApp or SMS
    const whatsappIntegration = business.integrations.find(
      i => i.type === 'WHATSAPP' && i.isActive
    );

    let notificationSent = false;

    if (whatsappIntegration) {
      // Send via WhatsApp
      try {
        const { accessToken, phoneNumberId } = whatsappIntegration.credentials;
        await whatsappService.sendMessage(
          accessToken,
          phoneNumberId,
          ownerPhone,
          notificationMessage
        );
        notificationSent = true;
        console.log('✅ WhatsApp notification sent');
      } catch (whatsappError) {
        console.error('⚠️ WhatsApp failed, falling back to SMS:', whatsappError);
      }
    }

    // If WhatsApp not available or failed, send SMS
    if (!notificationSent) {
      await netgsmService.sendSMS(ownerPhone, notificationMessage);
      console.log('✅ SMS notification sent');
    }

    // Return success message to VAPI
    const successMessage = business.language === 'TR'
      ? `Siparişiniz alındı. İşletme sahibine bildirim gönderildi. En kısa sürede sizinle iletişime geçilecek.`
      : `Your order has been received. Notification sent to business owner. They will contact you shortly.`;

    return {
      success: true,
      message: successMessage
    };

  } catch (error) {
    console.error('❌ Send order notification error:', error);
    return {
      success: false,
      message: error.message || 'Failed to send order notification. Please try again.'
    };
  }
}

export default router;

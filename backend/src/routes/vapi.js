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
import callAnalysis from '../services/callAnalysis.js';
import googleCalendarService from '../services/google-calendar.js';
import netgsmService from '../services/netgsm.js';
import whatsappService from '../services/whatsapp.js';
import trendyolService from '../services/trendyol.js';
import cargoAggregator from '../services/cargo-aggregator.js';
import parasutService from '../services/parasut.js';
import iyzicoService from '../services/iyzico.js';
// E-commerce integrations
import shopifyService from '../services/shopify.js';
import woocommerceService from '../services/woocommerce.js';
import webhookService from '../services/webhook.js';

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

          // E-commerce functions (Trendyol, Shopify, WooCommerce, Webhook)
          case 'check_order_status':
            result = await handleCheckOrderStatus(functionArgs, message);
            break;

          case 'get_product_stock':
            result = await handleGetProductStock(functionArgs, message);
            break;

          case 'get_cargo_tracking':
            result = await handleGetCargoTracking(functionArgs, message);
            break;

          case 'track_shipment':
            result = await handleTrackShipment(functionArgs, message);
            break;

          // Parasut (Accounting) Functions
          case 'check_invoice_status':
            result = await handleCheckInvoiceStatus(functionArgs, message);
            break;

          case 'check_account_balance':
            result = await handleCheckAccountBalance(functionArgs, message);
            break;

          // iyzico (Payment) Functions
          case 'check_refund_status':
            result = await handleCheckRefundStatus(functionArgs, message);
            break;

          case 'check_payment_status':
            result = await handleCheckPaymentStatus(functionArgs, message);
            break;

          case 'get_tracking_info':
            result = await handleGetTrackingInfo(functionArgs, message);
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

// ============================================================================
// E-COMMERCE FUNCTION HANDLERS (Trendyol, Shopify, WooCommerce, Webhook)
// ============================================================================

/**
 * Get list of active e-commerce integrations for a business
 */
async function getActiveEcommerceIntegrations(businessId) {
  const integrations = await prisma.integration.findMany({
    where: {
      businessId,
      isActive: true,
      connected: true,
      type: {
        in: ['TRENDYOL', 'SHOPIFY', 'WOOCOMMERCE', 'ZAPIER']
      }
    }
  });

  return integrations.map(i => i.type);
}

/**
 * Handle check_order_status function call
 * Searches across all connected e-commerce platforms (Trendyol, Shopify, WooCommerce, Webhook)
 */
async function handleCheckOrderStatus(args, vapiMessage) {
  try {
    const { order_number, customer_phone, customer_email } = args;

    console.log('🔍 Checking order status:', { order_number, customer_phone, customer_email });

    // Validate - at least one parameter required
    if (!order_number && !customer_phone && !customer_email) {
      return {
        success: false,
        message: 'Sipariş numarası, telefon numarası veya e-posta gerekli. Lütfen birini belirtin.'
      };
    }

    // Get business
    const business = await getBusinessFromVapiCall(vapiMessage);
    const businessId = business.id;

    // Get active e-commerce integrations
    const activeIntegrations = await getActiveEcommerceIntegrations(businessId);

    console.log(`📦 Active e-commerce integrations: ${activeIntegrations.join(', ')}`);

    let orderResult = null;
    let orderSource = null;

    // Search by order number
    if (order_number) {
      // Try Trendyol first (Turkish market priority)
      if (!orderResult && activeIntegrations.includes('TRENDYOL')) {
        try {
          const trendyolOrder = await trendyolService.getOrderByNumber(businessId, order_number);
          if (trendyolOrder) {
            // Format Trendyol order to common format
            const productList = trendyolOrder.lines.map(line => `${line.productName} (${line.quantity} adet)`).join(', ');
            let message = `Sipariş ${trendyolOrder.orderNumber}: ${trendyolOrder.statusText}. `;
            message += `Ürünler: ${productList}. `;

            if (trendyolOrder.status === 'Shipped' && trendyolOrder.cargoProviderName) {
              message += `Kargo: ${trendyolOrder.cargoProviderName}`;
              if (trendyolOrder.cargoTrackingNumber) {
                message += `, Takip No: ${trendyolOrder.cargoTrackingNumber}`;
              }
              message += '. ';
            }

            if (trendyolOrder.estimatedDelivery) {
              const deliveryDate = new Date(trendyolOrder.estimatedDelivery).toLocaleDateString('tr-TR');
              message += `Tahmini teslimat: ${deliveryDate}.`;
            }

            return {
              success: true,
              message,
              orderNumber: trendyolOrder.orderNumber,
              status: trendyolOrder.status,
              statusText: trendyolOrder.statusText,
              cargoCompany: trendyolOrder.cargoProviderName,
              trackingNumber: trendyolOrder.cargoTrackingNumber,
              source: 'Trendyol'
            };
          }
        } catch (e) {
          console.log('Trendyol search failed:', e.message);
        }
      }

      // Try Shopify
      if (!orderResult && activeIntegrations.includes('SHOPIFY')) {
        try {
          const shopifyResult = await shopifyService.getOrderByNumber(businessId, order_number);
          if (shopifyResult.success) {
            orderResult = shopifyResult.order;
            orderSource = 'Shopify';
          }
        } catch (e) {
          console.log('Shopify search failed:', e.message);
        }
      }

      // Try WooCommerce
      if (!orderResult && activeIntegrations.includes('WOOCOMMERCE')) {
        try {
          const wooResult = await woocommerceService.getOrderByNumber(businessId, order_number);
          if (wooResult.success) {
            orderResult = wooResult.order;
            orderSource = 'WooCommerce';
          }
        } catch (e) {
          console.log('WooCommerce search failed:', e.message);
        }
      }

      // Try Webhook (Zapier)
      if (!orderResult && activeIntegrations.includes('ZAPIER')) {
        try {
          const webhookResult = await webhookService.getOrderByExternalId(businessId, order_number);
          if (webhookResult.success) {
            orderResult = webhookResult.order;
            orderSource = webhookResult.order.source || 'Webhook';
          }
        } catch (e) {
          console.log('Webhook search failed:', e.message);
        }
      }
    }

    // If not found by order number, try phone
    if (!orderResult && customer_phone) {
      // Try Trendyol
      if (!orderResult && activeIntegrations.includes('TRENDYOL')) {
        try {
          const orders = await trendyolService.getOrdersByCustomerPhone(businessId, customer_phone);
          if (orders && orders.length > 0) {
            const order = orders[0];
            const productList = order.lines.map(line => line.productName).join(', ');
            let message;

            if (orders.length > 1) {
              message = `${orders.length} sipariş bulundu. En son siparişiniz: ${order.orderNumber} numaralı sipariş, durumu: ${order.statusText}. Ürünler: ${productList}. ${orders.length - 1} tane daha eski siparişiniz var.`;
            } else {
              message = `Sipariş ${order.orderNumber}: ${order.statusText}. Ürünler: ${productList}.`;
            }

            return {
              success: true,
              message,
              orderNumber: order.orderNumber,
              status: order.status,
              statusText: order.statusText,
              totalOrders: orders.length,
              source: 'Trendyol'
            };
          }
        } catch (e) {
          console.log('Trendyol phone search failed:', e.message);
        }
      }

      if (!orderResult && activeIntegrations.includes('SHOPIFY')) {
        try {
          const result = await shopifyService.getOrderByPhone(businessId, customer_phone);
          if (result.success) {
            orderResult = result.order;
            orderSource = 'Shopify';
          }
        } catch (e) {}
      }

      if (!orderResult && activeIntegrations.includes('WOOCOMMERCE')) {
        try {
          const result = await woocommerceService.getOrderByPhone(businessId, customer_phone);
          if (result.success) {
            orderResult = result.order;
            orderSource = 'WooCommerce';
          }
        } catch (e) {}
      }

      if (!orderResult && activeIntegrations.includes('ZAPIER')) {
        try {
          const result = await webhookService.getOrderByPhone(businessId, customer_phone);
          if (result.success) {
            orderResult = result.order;
            orderSource = result.order.source || 'Webhook';
          }
        } catch (e) {}
      }
    }

    // If not found by phone, try email
    if (!orderResult && customer_email) {
      if (!orderResult && activeIntegrations.includes('SHOPIFY')) {
        try {
          const result = await shopifyService.getOrderByEmail(businessId, customer_email);
          if (result.success) {
            orderResult = result.order;
            orderSource = 'Shopify';
          }
        } catch (e) {}
      }

      if (!orderResult && activeIntegrations.includes('WOOCOMMERCE')) {
        try {
          const result = await woocommerceService.getOrderByEmail(businessId, customer_email);
          if (result.success) {
            orderResult = result.order;
            orderSource = 'WooCommerce';
          }
        } catch (e) {}
      }

      if (!orderResult && activeIntegrations.includes('ZAPIER')) {
        try {
          const result = await webhookService.getOrderByEmail(businessId, customer_email);
          if (result.success) {
            orderResult = result.order;
            orderSource = result.order.source || 'Webhook';
          }
        } catch (e) {}
      }
    }

    // Format response
    if (!orderResult) {
      const notFoundMessage = business.language === 'TR'
        ? 'Sipariş bulunamadı. Lütfen sipariş numaranızı veya telefon numaranızı kontrol edin.'
        : 'Order not found. Please check your order number or phone number.';

      return {
        success: false,
        result: 'not_found',
        message: notFoundMessage
      };
    }

    console.log(`✅ Order found from ${orderSource}: ${orderResult.orderNumber}`);

    // Build response message
    const isTurkish = business.language === 'TR';
    let responseMessage;

    if (isTurkish) {
      responseMessage = `Sipariş ${orderResult.orderNumber} bulundu. `;
      responseMessage += `Sipariş durumu: ${orderResult.statusText}. `;
      if (orderResult.tracking?.number) {
        responseMessage += `Kargo takip numarası: ${orderResult.tracking.number}. `;
        responseMessage += `Kargo firması: ${orderResult.tracking.company}. `;
      } else if (orderResult.fulfillmentStatus === 'unfulfilled') {
        responseMessage += `Siparişiniz hazırlanıyor. `;
      }
      responseMessage += `Toplam tutar: ${orderResult.totalPrice} ${orderResult.currency}.`;
    } else {
      responseMessage = `Order ${orderResult.orderNumber} found. `;
      responseMessage += `Status: ${orderResult.statusText}. `;
      if (orderResult.tracking?.number) {
        responseMessage += `Tracking number: ${orderResult.tracking.number}. `;
        responseMessage += `Carrier: ${orderResult.tracking.company}. `;
      } else if (orderResult.fulfillmentStatus === 'unfulfilled') {
        responseMessage += `Your order is being prepared. `;
      }
      responseMessage += `Total: ${orderResult.totalPrice} ${orderResult.currency}.`;
    }

    return {
      success: true,
      result: 'found',
      message: responseMessage,
      order: {
        orderNumber: orderResult.orderNumber,
        status: orderResult.status,
        statusText: orderResult.statusText,
        totalPrice: orderResult.totalPrice,
        currency: orderResult.currency,
        tracking: orderResult.tracking,
        items: orderResult.items?.map(i => i.title).join(', ')
      },
      source: orderSource
    };

  } catch (error) {
    console.error('❌ Check order status error:', error);

    // User-friendly error message
    if (error.message?.includes('not found') || error.message?.includes('inactive')) {
      return {
        success: false,
        message: 'Şu an sipariş bilgisine ulaşamıyorum. Lütfen daha sonra tekrar deneyin veya müşteri hizmetleriyle iletişime geçin.'
      };
    }

    return {
      success: false,
      message: error.message || 'Sipariş sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

/**
 * Handle get_product_stock function call
 * Checks product availability across all connected platforms (Trendyol, Shopify, WooCommerce, Webhook)
 */
async function handleGetProductStock(args, vapiMessage) {
  try {
    const { product_name, barcode, product_sku } = args;

    console.log('🔍 Checking product stock:', { product_name, barcode, product_sku });

    // Validate input
    if (!product_name && !barcode && !product_sku) {
      return {
        success: false,
        message: 'Ürün adı, barkod veya SKU gerekli.'
      };
    }

    // Get business
    const business = await getBusinessFromVapiCall(vapiMessage);
    const businessId = business.id;

    // Get active e-commerce integrations
    const activeIntegrations = await getActiveEcommerceIntegrations(businessId);

    let productResult = null;
    let productSource = null;

    const searchTerm = product_name || product_sku;

    // Try Trendyol first (Turkish market priority)
    if (activeIntegrations.includes('TRENDYOL')) {
      try {
        let stockResult;

        // Search by barcode (more precise)
        if (barcode) {
          stockResult = await trendyolService.getProductStock(businessId, barcode);

          if (!stockResult.success && product_name) {
            stockResult = await trendyolService.searchProducts(businessId, product_name);
          }
        } else if (searchTerm) {
          stockResult = await trendyolService.searchProducts(businessId, searchTerm);
        }

        // Handle barcode search result
        if (stockResult?.barcode) {
          const message = stockResult.stockQuantity > 0
            ? `${stockResult.productName} ürünü stokta mevcut. ${stockResult.stockQuantity} adet var. Fiyatı: ${stockResult.price} TL.`
            : `${stockResult.productName} ürünü şu an stokta yok.`;

          return {
            success: true,
            message,
            productName: stockResult.productName,
            barcode: stockResult.barcode,
            stockQuantity: stockResult.stockQuantity,
            price: stockResult.price,
            inStock: stockResult.stockQuantity > 0,
            source: 'Trendyol'
          };
        }

        // Handle name search result (multiple products)
        if (stockResult?.products && stockResult.products.length > 0) {
          const products = stockResult.products;

          if (products.length === 1) {
            const product = products[0];
            const message = product.stockQuantity > 0
              ? `${product.productName} ürünü stokta mevcut. ${product.stockQuantity} adet var. Fiyatı: ${product.price} TL.`
              : `${product.productName} ürünü şu an stokta yok.`;

            return {
              success: true,
              message,
              productName: product.productName,
              stockQuantity: product.stockQuantity,
              price: product.price,
              inStock: product.stockQuantity > 0,
              source: 'Trendyol'
            };
          }

          const inStockProducts = products.filter(p => p.stockQuantity > 0);
          let message;

          if (inStockProducts.length > 0) {
            const productList = inStockProducts.slice(0, 3).map(p =>
              `${p.productName} (${p.stockQuantity} adet, ${p.price} TL)`
            ).join(', ');
            message = `"${searchTerm}" için ${inStockProducts.length} ürün stokta bulundu: ${productList}.`;
          } else {
            message = `"${searchTerm}" ile eşleşen ürünler şu an stokta yok.`;
          }

          return {
            success: true,
            message,
            matchCount: products.length,
            inStockCount: inStockProducts.length,
            source: 'Trendyol'
          };
        }
      } catch (e) {
        console.log('Trendyol product search failed:', e.message);
      }
    }

    // Try Shopify
    if (!productResult && activeIntegrations.includes('SHOPIFY')) {
      try {
        const result = await shopifyService.getProductByTitle(businessId, searchTerm);
        if (result.success) {
          productResult = result.product;
          productSource = 'Shopify';
        }
      } catch (e) {
        console.log('Shopify product search failed:', e.message);
      }
    }

    // Try WooCommerce
    if (!productResult && activeIntegrations.includes('WOOCOMMERCE')) {
      try {
        const result = await woocommerceService.getProductByName(businessId, searchTerm);
        if (result.success) {
          productResult = result.product;
          productSource = 'WooCommerce';
        }
      } catch (e) {
        console.log('WooCommerce product search failed:', e.message);
      }
    }

    // Try Webhook inventory
    if (!productResult && activeIntegrations.includes('ZAPIER')) {
      try {
        const result = await webhookService.getProductStock(businessId, searchTerm);
        if (result.success) {
          productResult = result.product;
          productSource = 'Inventory';
        }
      } catch (e) {
        console.log('Webhook product search failed:', e.message);
      }
    }

    // Format response
    if (!productResult) {
      const notFoundMessage = business.language === 'TR'
        ? `"${searchTerm}" adlı ürün bulunamadı.`
        : `Product "${searchTerm}" not found.`;

      return {
        success: false,
        result: 'not_found',
        message: notFoundMessage
      };
    }

    console.log(`✅ Product found from ${productSource}: ${productResult.title}`);

    // Build response message
    const isTurkish = business.language === 'TR';
    let responseMessage;

    if (productResult.available) {
      if (isTurkish) {
        responseMessage = `${productResult.title} stokta mevcut. `;
        if (productResult.totalStock) {
          responseMessage += `Mevcut stok: ${productResult.totalStock} adet. `;
        }
        if (productResult.variants?.length > 1) {
          const availableVariants = productResult.variants.filter(v => v.available);
          responseMessage += `Mevcut seçenekler: ${availableVariants.map(v => v.title).join(', ')}.`;
        }
      } else {
        responseMessage = `${productResult.title} is in stock. `;
        if (productResult.totalStock) {
          responseMessage += `Available quantity: ${productResult.totalStock}. `;
        }
        if (productResult.variants?.length > 1) {
          const availableVariants = productResult.variants.filter(v => v.available);
          responseMessage += `Available options: ${availableVariants.map(v => v.title).join(', ')}.`;
        }
      }
    } else {
      if (isTurkish) {
        responseMessage = `Üzgünüm, ${productResult.title} şu anda stokta yok.`;
      } else {
        responseMessage = `Sorry, ${productResult.title} is currently out of stock.`;
      }
    }

    return {
      success: true,
      result: productResult.available ? 'in_stock' : 'out_of_stock',
      message: responseMessage,
      product: {
        title: productResult.title,
        available: productResult.available,
        stock: productResult.totalStock,
        variants: productResult.variants?.map(v => ({
          title: v.title,
          available: v.available,
          stock: v.stock
        }))
      },
      source: productSource
    };

  } catch (error) {
    console.error('❌ Get product stock error:', error);

    if (error.message?.includes('not found') || error.message?.includes('inactive')) {
      return {
        success: false,
        message: 'Şu an stok bilgisine ulaşamıyorum. Lütfen daha sonra tekrar deneyin.'
      };
    }

    return {
      success: false,
      message: error.message || 'Stok sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

/**
 * Handle get_cargo_tracking function call
 * Gets cargo/shipment tracking information for an order (Trendyol)
 */
async function handleGetCargoTracking(args, vapiMessage) {
  try {
    const { order_number } = args;

    console.log('📦 Getting cargo tracking:', { order_number });

    // Validate
    if (!order_number) {
      return {
        success: false,
        message: 'Sipariş numarası gerekli.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Get cargo tracking info
    const cargoInfo = await trendyolService.getCargoTracking(business.id, order_number);

    if (!cargoInfo.success) {
      return {
        success: false,
        message: cargoInfo.message || 'Kargo bilgisi alınamadı.'
      };
    }

    // Build response message based on status
    let message = `Sipariş ${cargoInfo.orderNumber}: ${cargoInfo.statusText}. `;

    if (cargoInfo.status === 'Shipped' || cargoInfo.status === 'Delivered') {
      message += `Kargo firması: ${cargoInfo.cargoCompany || 'Belirtilmemiş'}. `;

      if (cargoInfo.trackingNumber) {
        message += `Takip numarası: ${cargoInfo.trackingNumber}. `;
      }

      if (cargoInfo.trackingUrl) {
        message += `Kargo takibi için kargoyu ${cargoInfo.cargoCompany} sitesinden takip edebilirsiniz. `;
      }
    } else if (cargoInfo.status === 'Created' || cargoInfo.status === 'Picking') {
      message += 'Siparişiniz henüz kargoya verilmedi. Hazırlanıyor. ';
    } else if (cargoInfo.status === 'Delivered') {
      message += 'Siparişiniz teslim edildi. ';
    } else if (cargoInfo.status === 'Cancelled') {
      message += 'Siparişiniz iptal edilmiş. ';
    }

    // Add product info
    if (cargoInfo.lines && cargoInfo.lines.length > 0) {
      const productList = cargoInfo.lines.map(line => line.productName).join(', ');
      message += `Ürünler: ${productList}.`;
    }

    console.log(`✅ Cargo tracking retrieved: ${order_number}`);

    return {
      success: true,
      message,
      orderNumber: cargoInfo.orderNumber,
      status: cargoInfo.status,
      statusText: cargoInfo.statusText,
      cargoCompany: cargoInfo.cargoCompany,
      trackingNumber: cargoInfo.trackingNumber,
      trackingUrl: cargoInfo.trackingUrl
    };

  } catch (error) {
    console.error('❌ Get cargo tracking error:', error);

    if (error.message?.includes('not found') || error.message?.includes('inactive')) {
      return {
        success: false,
        message: 'Şu an kargo bilgisine ulaşamıyorum. Lütfen daha sonra tekrar deneyin.'
      };
    }

    return {
      success: false,
      message: 'Kargo sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

// ============================================================================
// CARGO TRACKING FUNCTION HANDLER
// ============================================================================

/**
 * Handle track_shipment function call
 * Tracks shipment status using connected cargo carriers
 * @param {Object} args - Function arguments from VAPI
 * @param {Object} vapiMessage - VAPI message object
 */
async function handleTrackShipment(args, vapiMessage) {
  try {
    const { tracking_number, carrier } = args;

    console.log('📦 Tracking shipment:', { tracking_number, carrier });

    // Validate required parameters
    if (!tracking_number) {
      return {
        result: 'error',
        message: 'Takip numarası gerekli. Lütfen kargo takip numaranızı söyleyin.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Track shipment using cargo aggregator
    const trackingResult = await cargoAggregator.trackShipment(
      business.id,
      tracking_number,
      carrier || null
    );

    // Log tracking request
    console.log(`📦 Tracking result for ${tracking_number}:`, {
      success: trackingResult.success,
      carrier: trackingResult.carrier,
      status: trackingResult.status
    });

    // Format response for AI
    if (!trackingResult.success) {
      // Handle different error codes
      if (trackingResult.code === 'NO_INTEGRATION') {
        return {
          result: 'no_integration',
          message: 'Şu an kargo takip sistemine bağlantımız bulunmuyor. Lütfen doğrudan kargo firmasının web sitesinden takip edin.'
        };
      }

      if (trackingResult.code === 'NOT_FOUND') {
        return {
          result: 'not_found',
          message: 'Bu takip numarasıyla kargo bulunamadı. Lütfen takip numarasını kontrol edip tekrar söyleyin.'
        };
      }

      return {
        result: 'error',
        message: trackingResult.error || 'Kargo takip sorgusu başarısız oldu. Lütfen daha sonra tekrar deneyin.'
      };
    }

    // Format success message
    const formattedMessage = cargoAggregator.formatTrackingForAI(trackingResult);

    return {
      result: 'success',
      message: formattedMessage,
      data: {
        carrier: trackingResult.carrier,
        carrierName: trackingResult.carrierName,
        trackingNumber: trackingResult.trackingNumber,
        status: trackingResult.status,
        statusText: trackingResult.statusText,
        lastLocation: trackingResult.lastLocation,
        estimatedDelivery: trackingResult.estimatedDelivery
      }
    };

  } catch (error) {
    console.error('❌ Track shipment error:', error);
    return {
      result: 'error',
      message: 'Kargo takip sorgusu sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

/**
 * Handle get_tracking_info function call
 * Gets shipping/tracking information for an order (Shopify, WooCommerce, Webhook)
 */
async function handleGetTrackingInfo(args, vapiMessage) {
  try {
    const { order_number, tracking_number } = args;

    console.log('🔍 Getting tracking info:', { order_number, tracking_number });

    // Get business
    const business = await getBusinessFromVapiCall(vapiMessage);

    // First try to find the order
    if (order_number) {
      const orderResult = await handleCheckOrderStatus({ order_number }, vapiMessage);

      if (orderResult.success && orderResult.order?.tracking) {
        const tracking = orderResult.order.tracking;
        const isTurkish = business.language === 'TR';

        let responseMessage;
        if (isTurkish) {
          responseMessage = `Sipariş ${orderResult.order.orderNumber} için kargo bilgisi: `;
          responseMessage += `Kargo firması: ${tracking.company}. `;
          responseMessage += `Takip numarası: ${tracking.number}. `;
          if (tracking.url) {
            responseMessage += `Kargonuzu takip etmek için kargo firmasının web sitesini ziyaret edebilirsiniz.`;
          }
        } else {
          responseMessage = `Tracking info for order ${orderResult.order.orderNumber}: `;
          responseMessage += `Carrier: ${tracking.company}. `;
          responseMessage += `Tracking number: ${tracking.number}. `;
          if (tracking.url) {
            responseMessage += `You can track your package on the carrier's website.`;
          }
        }

        return {
          success: true,
          message: responseMessage,
          tracking
        };
      }

      if (orderResult.success && !orderResult.order?.tracking) {
        const isTurkish = business.language === 'TR';
        return {
          success: true,
          result: 'not_shipped',
          message: isTurkish
            ? `Sipariş ${orderResult.order.orderNumber} henüz kargoya verilmedi. Siparişiniz hazırlanıyor.`
            : `Order ${orderResult.order.orderNumber} has not been shipped yet. Your order is being prepared.`
        };
      }
    }

    // Order not found
    const isTurkish = business.language === 'TR';
    return {
      success: false,
      message: isTurkish
        ? 'Sipariş bulunamadı. Lütfen sipariş numarasını kontrol edin.'
        : 'Order not found. Please check the order number.'
    };

  } catch (error) {
    console.error('❌ Get tracking info error:', error);
    return {
      success: false,
      message: error.message || 'Kargo bilgisi alınamadı. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

// ============================================================================
// PARASUT (ACCOUNTING) FUNCTION HANDLERS
// ============================================================================

/**
 * Handle check_invoice_status function call
 * Queries invoice status from Parasut
 */
async function handleCheckInvoiceStatus(args, vapiMessage) {
  try {
    const { invoice_number, customer_name } = args;

    console.log('📄 Checking invoice status:', { invoice_number, customer_name });

    // Validate - at least one parameter required
    if (!invoice_number && !customer_name) {
      return {
        result: 'error',
        message: 'Fatura numarasi veya musteri adi gerekli.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Check if Parasut is connected
    const parasutIntegration = business.integrations.find(
      i => i.type === 'PARASUT' && i.isActive
    );

    if (!parasutIntegration) {
      return {
        result: 'not_connected',
        message: 'Parasut entegrasyonu bagli degil. Lutfen yoneticinize basvurun.'
      };
    }

    let result;

    if (invoice_number) {
      // Search by invoice number
      result = await parasutService.getInvoiceByNumber(business.id, invoice_number);

      if (result.success && result.invoice) {
        const inv = result.invoice;
        const formattedAmount = parasutService.formatMoney(inv.totalAmount);

        return {
          result: 'success',
          message: `${inv.number} numarali faturaniz ${inv.date} tarihli, toplam ${formattedAmount} TL. Durum: ${inv.statusText}.${inv.dueDate ? ` Vade: ${inv.dueDate}` : ''}`
        };
      } else {
        return {
          result: 'not_found',
          message: 'Bu numarali fatura bulunamadi.'
        };
      }
    } else if (customer_name) {
      // Search by customer name
      result = await parasutService.getInvoicesByCustomer(business.id, customer_name);

      if (result.success && result.invoices && result.invoices.length > 0) {
        const invoices = result.invoices;

        if (invoices.length === 1) {
          const inv = invoices[0];
          const formattedAmount = parasutService.formatMoney(inv.totalAmount);

          return {
            result: 'success',
            message: `${result.customerName} adina ${inv.number} numarali fatura bulundu. Tarih: ${inv.date}, Tutar: ${formattedAmount} TL. Durum: ${inv.statusText}.`
          };
        } else {
          // Multiple invoices found
          const latestInvoice = invoices[0]; // Most recent
          const formattedAmount = parasutService.formatMoney(latestInvoice.totalAmount);
          const unpaidCount = invoices.filter(i => i.status !== 'paid').length;

          let message = `${result.customerName} adina ${invoices.length} fatura bulundu.`;
          message += ` En son fatura ${latestInvoice.number}, ${formattedAmount} TL, ${latestInvoice.statusText}.`;

          if (unpaidCount > 0) {
            message += ` ${unpaidCount} adet odenmemis fatura var.`;
          }

          return {
            result: 'success',
            message: message
          };
        }
      } else {
        return {
          result: 'not_found',
          message: `${customer_name} adina fatura bulunamadi.`
        };
      }
    }

    return {
      result: 'error',
      message: 'Fatura bilgisi alinamadi.'
    };

  } catch (error) {
    console.error('❌ Check invoice status error:', error);
    return {
      result: 'error',
      message: 'Fatura sorgulama sirasinda bir hata olustu. Lutfen tekrar deneyin.'
    };
  }
}
/**
 * Handle check_account_balance function call
 * Queries contact (cari) balance from Parasut
 */
async function handleCheckAccountBalance(args, vapiMessage) {
  try {
    const { contact_name } = args;

    console.log('💰 Checking account balance:', { contact_name });

    if (!contact_name) {
      return {
        result: 'error',
        message: 'Cari hesap adi gerekli.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Check if Parasut is connected
    const parasutIntegration = business.integrations.find(
      i => i.type === 'PARASUT' && i.isActive
    );

    if (!parasutIntegration) {
      return {
        result: 'not_connected',
        message: 'Parasut entegrasyonu bagli degil. Lutfen yoneticinize basvurun.'
      };
    }

    // First find contact by name
    const contactResult = await parasutService.getContactByName(business.id, contact_name);

    if (!contactResult.success || !contactResult.contact) {
      return {
        result: 'not_found',
        message: `${contact_name} adinda cari hesap bulunamadi.`
      };
    }

    // Get balance for this contact
    const balanceResult = await parasutService.getContactBalance(business.id, contactResult.contact.id);

    if (balanceResult.success && balanceResult.contact) {
      const contact = balanceResult.contact;

      let message = `${contact.name} cari bakiyesi: ${contact.balanceText}.`;

      if (contact.lastTransaction) {
        const lastDate = new Date(contact.lastTransaction).toLocaleDateString('tr-TR');
        message += ` Son islem: ${lastDate}.`;
      }

      return {
        result: 'success',
        message: message
      };
    }

    return {
      result: 'error',
      message: 'Bakiye bilgisi alinamadi.'
    };

  } catch (error) {
    console.error('❌ Check account balance error:', error);
    return {
      result: 'error',
      message: 'Bakiye sorgulama sirasinda bir hata olustu. Lutfen tekrar deneyin.'
    };
  }
}

// ============================================================================
// IYZICO (PAYMENT) FUNCTION HANDLERS
// ============================================================================

/**
 * Handle check_refund_status function call
 * Queries refund status from iyzico
 */
async function handleCheckRefundStatus(args, vapiMessage) {
  try {
    const { order_number, payment_id } = args;

    console.log('💳 Checking refund status:', { order_number, payment_id });

    // Validate - at least one parameter required
    if (!order_number && !payment_id) {
      return {
        result: 'error',
        message: 'Siparis numarasi veya odeme ID gerekli.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Check if iyzico is connected
    const iyzicoIntegration = business.integrations.find(
      i => i.type === 'IYZICO' && i.isActive
    );

    if (!iyzicoIntegration) {
      return {
        result: 'not_connected',
        message: 'iyzico odeme entegrasyonu bagli degil. Lutfen yoneticinize basvurun.'
      };
    }

    // First get payment to find paymentId
    let targetPaymentId = payment_id;

    if (!targetPaymentId && order_number) {
      const paymentResult = await iyzicoService.getPaymentByConversationId(business.id, order_number);

      if (!paymentResult.success) {
        return {
          result: 'not_found',
          message: `${order_number} numarali siparis icin odeme bulunamadi.`
        };
      }

      targetPaymentId = paymentResult.payment.paymentId;
    }

    // Get refund status
    const result = await iyzicoService.getRefundStatus(business.id, targetPaymentId);

    if (result.success) {
      if (result.hasRefund && result.refund) {
        const refund = result.refund;
        const formattedAmount = iyzicoService.formatMoney(refund.refundAmount);

        let message = '';
        if (refund.refundStatus === 'REFUNDED') {
          message = `Iadeniz tamamlandi. ${formattedAmount} TL tutari`;
          if (refund.refundDate) {
            const refundDate = new Date(refund.refundDate).toLocaleDateString('tr-TR');
            message += ` ${refundDate} tarihinde`;
          }
          message += ` kartiniza iade edildi.`;
        } else {
          message = `Iade talebiniz isleme alindi. ${formattedAmount} TL tutarindaki iade 3-5 is gunu icinde kartiniza yansiyacak.`;
        }

        return {
          result: 'success',
          message: message
        };
      } else {
        return {
          result: 'no_refund',
          message: 'Bu siparis icin iade talebi bulunmuyor. Iade talebinde bulunmak ister misiniz?'
        };
      }
    }

    return {
      result: 'error',
      message: result.error || 'Iade durumu alinamadi.'
    };

  } catch (error) {
    console.error('❌ Check refund status error:', error);
    return {
      result: 'error',
      message: 'Iade durumu sorgulama sirasinda bir hata olustu. Lutfen tekrar deneyin.'
    };
  }
}

/**
 * Handle check_payment_status function call
 * Queries payment status from iyzico
 */
async function handleCheckPaymentStatus(args, vapiMessage) {
  try {
    const { order_number, payment_id } = args;

    console.log('💳 Checking payment status:', { order_number, payment_id });

    // Validate - at least one parameter required
    if (!order_number && !payment_id) {
      return {
        result: 'error',
        message: 'Siparis numarasi veya odeme ID gerekli.'
      };
    }

    // Get business from VAPI call
    const business = await getBusinessFromVapiCall(vapiMessage);

    // Check if iyzico is connected
    const iyzicoIntegration = business.integrations.find(
      i => i.type === 'IYZICO' && i.isActive
    );

    if (!iyzicoIntegration) {
      return {
        result: 'not_connected',
        message: 'iyzico odeme entegrasyonu bagli degil. Lutfen yoneticinize basvurun.'
      };
    }

    let result;

    if (payment_id) {
      result = await iyzicoService.getPaymentDetail(business.id, payment_id);
    } else if (order_number) {
      result = await iyzicoService.getPaymentByConversationId(business.id, order_number);
    }

    if (result.success && result.payment) {
      const payment = result.payment;
      const formattedAmount = iyzicoService.formatMoney(payment.paidPrice);

      let message = '';

      if (payment.status === 'SUCCESS') {
        const paymentDate = payment.paymentDate
          ? new Date(payment.paymentDate).toLocaleDateString('tr-TR')
          : 'bilinmiyor';

        message = `${order_number || payment.conversationId} siparisinin odemesi ${paymentDate} tarihinde basariyla alindi.`;
        message += ` ${formattedAmount} TL, **** ${payment.cardLastFour} numarali kartinizdan cekildi.`;
      } else if (payment.status === 'FAILURE') {
        message = `${order_number || payment.conversationId} siparisi icin odeme basarisiz oldu.`;
      } else {
        message = `${order_number || payment.conversationId} siparisi odeme durumu: ${payment.statusText}.`;
      }

      return {
        result: 'success',
        message: message
      };
    }

    return {
      result: 'not_found',
      message: 'Bu bilgilerle eslesen odeme bulunamadi.'
    };

  } catch (error) {
    console.error('❌ Check payment status error:', error);
    return {
      result: 'error',
      message: 'Odeme durumu sorgulama sirasinda bir hata olustu. Lutfen tekrar deneyin.'
=======
    // If we have a tracking number but no order
    if (tracking_number) {
      const isTurkish = business.language === 'TR';
      return {
        success: true,
        result: 'tracking_only',
        message: isTurkish
          ? `Takip numaranız: ${tracking_number}. Bu numarayla kargo firmasının web sitesinden kargonuzu takip edebilirsiniz.`
          : `Your tracking number is: ${tracking_number}. You can track your package using this number on the carrier's website.`,
        tracking: {
          number: tracking_number
        }
      };
    }

    const notFoundMessage = business.language === 'TR'
      ? 'Kargo bilgisi bulunamadı. Lütfen sipariş numaranızı kontrol edin.'
      : 'Tracking information not found. Please check your order number.';

    return {
      success: false,
      result: 'not_found',
      message: notFoundMessage
    };

  } catch (error) {
    console.error('❌ Get tracking info error:', error);
    return {
      success: false,
      message: error.message || 'Kargo bilgisi alınamadı.'
    };
  }
}

// ============================================================================
// VAPI TOOL DEFINITIONS
// ============================================================================
// These are the tool definitions that should be added to VAPI assistants
// when the respective integrations are active

export const PARASUT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_invoice_status',
      description: 'Musterinin fatura durumunu sorgular. Fatura numarasi veya musteri adiyla arama yapar.',
      parameters: {
        type: 'object',
        properties: {
          invoice_number: {
            type: 'string',
            description: 'Fatura numarasi (orn: FTR-2025-001)'
          },
          customer_name: {
            type: 'string',
            description: 'Musteri veya sirket adi'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_account_balance',
      description: 'Cari hesap bakiyesini sorgular. Musteri veya tedarikçinin bakiye durumunu ogrenmek icin kullanilir.',
      parameters: {
        type: 'object',
        properties: {
          contact_name: {
            type: 'string',
            description: 'Cari adi (musteri veya tedarikci)'
          }
        },
        required: ['contact_name']
      }
    }
  }
];

export const IYZICO_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_refund_status',
      description: 'Musterinin iade talebinin durumunu sorgular. Siparis numarasi veya odeme ID ile arama yapar.',
      parameters: {
        type: 'object',
        properties: {
          order_number: {
            type: 'string',
            description: 'Siparis numarasi'
          },
          payment_id: {
            type: 'string',
            description: 'iyzico odeme ID'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_payment_status',
      description: 'Musterinin odeme durumunu sorgular.',
      parameters: {
        type: 'object',
        properties: {
          order_number: {
            type: 'string',
            description: 'Siparis numarasi'
          },
          payment_id: {
            type: 'string',
            description: 'Odeme ID'
          }
        },
        required: []
      }
    }
  }
];

/**
 * Get active tools for a business based on their integrations
 * @param {number} businessId - Business ID
 * @returns {Promise<Array>} Array of active tools
 */
export async function getActiveToolsForBusiness(businessId) {
  const tools = [];

  // Get business with integrations
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      integrations: {
        where: { isActive: true }
      }
    }
  });

  if (!business) {
    return tools;
  }

  // Check for Parasut integration
  const hasParasut = business.integrations.some(
    i => i.type === 'PARASUT' && i.connected
  );

  if (hasParasut) {
    tools.push(...PARASUT_TOOLS);
    console.log('✅ Parasut tools added for business:', businessId);
  }

  // Check for iyzico integration
  const hasIyzico = business.integrations.some(
    i => i.type === 'IYZICO' && i.connected
  );

  if (hasIyzico) {
    tools.push(...IYZICO_TOOLS);
    console.log('✅ iyzico tools added for business:', businessId);
  }

  return tools;
}

export default router;

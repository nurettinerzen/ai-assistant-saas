/**
 * Chat Widget API
 * Handles text-based chat for embedded widget
 * WITH FUNCTION CALLING SUPPORT - Same logic as WhatsApp
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import googleCalendarService from '../services/google-calendar.js';
import { decrypt } from '../utils/encryption.js';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

// Lazy initialization
let openai = null;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

// ============================================================
// TOOL DEFINITIONS (Same as WhatsApp)
// ============================================================

const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Creates an appointment/reservation when customer requests booking.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Appointment date in YYYY-MM-DD format" },
          time: { type: "string", description: "Appointment time in HH:MM 24-hour format" },
          customer_name: { type: "string", description: "Customer's full name" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          party_size: { type: "number", description: "Number of people (for restaurant reservations)" },
          notes: { type: "string", description: "Special requests or notes" }
        },
        required: ["date", "time", "customer_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Check the status of a customer's order.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Order number or ID" },
          customer_phone: { type: "string", description: "Customer's phone number" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "track_shipment",
      description: "Track a shipment/cargo by tracking number.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string", description: "Cargo tracking number" },
          carrier: { type: "string", description: "Cargo carrier name", enum: ["yurtici", "aras", "mng"] }
        },
        required: ["tracking_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_stock",
      description: "Check product stock/availability.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Product name or description" },
          barcode: { type: "string", description: "Product barcode if known" }
        },
        required: ["product_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_order",
      description: "Updates an existing order. Use when customer wants to change pickup time, items, or cancel.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Order ID or last 8 characters" },
          pickup_time: { type: "string", description: "New pickup time (e.g., '3 saat sonra', '18:00')" },
          new_items: { type: "string", description: "Updated order items" },
          cancel: { type: "boolean", description: "Set to true to cancel" },
          notes: { type: "string", description: "Additional notes" }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Creates a new order. ONLY use when customer specifies WHAT they want to order.",
      parameters: {
        type: "object",
        properties: {
          items: { type: "string", description: "Order items with quantities" },
          customer_name: { type: "string", description: "Customer's name" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          order_type: { type: "string", description: "PICKUP or DELIVERY", enum: ["PICKUP", "DELIVERY"] },
          pickup_time: { type: "string", description: "When to pick up" },
          delivery_address: { type: "string", description: "Delivery address" },
          notes: { type: "string", description: "Special requests" }
        },
        required: ["items", "customer_name"]
      }
    }
  }
];

// Get active tools based on business type
function getActiveTools(business) {
  const tools = [];
  const businessType = business.businessType || 'OTHER';
  const integrations = business.integrations || [];

  // APPOINTMENT - Salon, Clinic, Service, Other + Restaurant
  if (['SALON', 'CLINIC', 'SERVICE', 'OTHER', 'RESTAURANT'].includes(businessType)) {
    tools.push(CHAT_TOOLS[0]); // create_appointment
  }

  // ORDER - Only Restaurant
  if (businessType === 'RESTAURANT') {
    tools.push(CHAT_TOOLS[4]); // update_order
    tools.push(CHAT_TOOLS[5]); // create_order
  }

  // ECOMMERCE tools
  if (businessType === 'ECOMMERCE') {
    const hasTrendyol = integrations.some(i => i.type === 'TRENDYOL' && i.isActive && i.connected);
    if (hasTrendyol) {
      tools.push(CHAT_TOOLS[1]); // check_order_status
      tools.push(CHAT_TOOLS[3]); // get_product_stock
    }
  }

  // CARGO tracking
  const hasCargo = integrations.some(i => 
    ['YURTICI_KARGO', 'ARAS_KARGO', 'MNG_KARGO'].includes(i.type) && i.isActive && i.connected
  );
  if (hasCargo) {
    tools.push(CHAT_TOOLS[2]); // track_shipment
  }

  // Fallback
  if (tools.length === 0) {
    tools.push(CHAT_TOOLS[0]);
  }

  return tools;
}

// Build system prompt
function buildChatSystemPrompt(business, assistant) {
  const tz = business.timezone || 'UTC';
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = formatter.format(now);
  const tomorrow = formatter.format(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const readableDateTime = now.toLocaleString(business.language === 'TR' ? 'tr-TR' : 'en-US', { 
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const languageInstruction = business.language === 'TR'
    ? 'MUTLAKA Türkçe cevap ver.'
    : 'Always respond in English.';

  const toolInstructions = `
ORDER RULES:
- NEVER create order without specific product/item names
- "Sipariş vermek istiyorum" → Ask what they want
- "pickup/delivery" is order TYPE, not a product
`;

  return `You are ${assistant.name} for ${business.name}.

DATE/TIME (${tz}):
- Now: ${readableDateTime}
- Today: ${today}
- Tomorrow: ${tomorrow}

RULES:
- ${languageInstruction}
- Never say you are AI/bot
- Be concise and helpful
${business.businessType === 'RESTAURANT' ? toolInstructions : ''}

${assistant.systemPrompt || ''}
${business.customInstructions || ''}`;
}

// POST /api/chat/widget - Public endpoint for widget
router.post('/widget', async (req, res) => {
  try {
    const { assistantId, message, conversationHistory = [], customerInfo = {} } = req.body;

    if (!assistantId || !message) {
      return res.status(400).json({ error: 'assistantId and message are required' });
    }

    const assistant = await prisma.assistant.findFirst({
      where: { vapiAssistantId: assistantId },
      include: { 
        business: {
          include: {
            integrations: { where: { isActive: true } }
          }
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const business = assistant.business;

    // Get knowledge base
    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: { businessId: business.id, status: 'ACTIVE' }
    });

    // Build knowledge context
    let knowledgeContext = '';
    if (knowledgeItems.length > 0) {
      const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };
      for (const item of knowledgeItems) {
        if (item.type === 'FAQ' && item.question && item.answer) {
          kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
        } else if (item.content) {
          kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 500)}`);
        }
      }
      if (kbByType.FAQ.length > 0) knowledgeContext += '\n\nFAQ:\n' + kbByType.FAQ.join('\n\n');
      if (kbByType.URL.length > 0) knowledgeContext += '\n\nWEBSITE:\n' + kbByType.URL.join('\n\n');
      if (kbByType.DOCUMENT.length > 0) knowledgeContext += '\n\nDOCS:\n' + kbByType.DOCUMENT.join('\n\n');
    }

    const systemPrompt = buildChatSystemPrompt(business, assistant) + knowledgeContext;
    const activeTools = getActiveTools(business);

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // Call OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: activeTools,
      tool_choice: "auto",
      max_tokens: 500,
      temperature: 0.7
    });

    const responseMessage = completion.choices[0]?.message;

    /// Handle tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log('🔧 Chat tool call:', functionName, functionArgs);

      const result = await executeToolCall(business, functionName, functionArgs, customerInfo);

      // Build assistant message with tool_calls
      const assistantMessage = {
        role: 'assistant',
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls
      };

      // Get final response
      const secondCompletion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          ...messages,
          assistantMessage,
          { role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return res.json({
        success: true,
        reply: secondCompletion.choices[0]?.message?.content,
        assistantName: assistant.name,
        functionCalled: functionName,
        functionResult: result
      });
    }

    res.json({
      success: true,
      reply: responseMessage?.content || 'Sorry, I could not generate a response.',
      assistantName: assistant.name
    });

  } catch (error) {
    console.error('Chat widget error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Execute tool call
async function executeToolCall(business, functionName, args, customerInfo) {
  const customerPhone = customerInfo.phone || 'chat-widget';
  const customerName = customerInfo.name || null;

  switch (functionName) {
    case 'create_appointment':
      return await handleCreateAppointment(args, business);
    case 'create_order':
      return await handleCreateOrder(args, business, customerPhone, customerName);
    case 'update_order':
      return await handleUpdateOrder(args, business, customerPhone);
    default:
      return { success: false, message: `Unknown function: ${functionName}` };
  }
}

// Handler: Create Appointment
async function handleCreateAppointment(args, business) {
  try {
    const { date, time, customer_name, customer_phone, party_size, notes } = args;

    let appointmentDateTime;
    try {
      appointmentDateTime = new Date(`${date}T${time}`);
      if (isNaN(appointmentDateTime.getTime())) throw new Error('Invalid');
    } catch {
      return { success: false, message: 'Invalid date/time format' };
    }

    const googleCalendarIntegration = business.integrations?.find(
      i => i.type === 'GOOGLE_CALENDAR' && i.isActive
    );

    let calendarEventId = null;

    if (googleCalendarIntegration?.credentials) {
      try {
        const { access_token, refresh_token } = googleCalendarIntegration.credentials;
        const duration = business.bookingDuration || 30;
        const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

        const event = await googleCalendarService.createEvent(
          access_token, refresh_token,
          process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
          {
            summary: `${party_size ? party_size + ' kişi - ' : ''}${customer_name}`,
            description: `Tel: ${customer_phone || 'N/A'}\n${notes || ''}`,
            start: { dateTime: appointmentDateTime.toISOString(), timeZone: business.timezone || 'Europe/Istanbul' },
            end: { dateTime: endDateTime.toISOString(), timeZone: business.timezone || 'Europe/Istanbul' }
          }
        );
        calendarEventId = event.id;
      } catch (e) {
        console.error('Calendar error:', e);
      }
    }

    await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerName: customer_name,
        customerPhone: customer_phone || 'chat-widget',
        appointmentDate: appointmentDateTime,
        duration: business.bookingDuration || 30,
        notes: `${party_size || 1} kişi. Chat Widget${notes ? '. ' + notes : ''}`,
        status: 'CONFIRMED'
      }
    });

    return { success: true, message: `Appointment created for ${date} at ${time}` };
  } catch (error) {
    console.error('Create appointment error:', error);
    return { success: false, message: 'Failed to create appointment' };
  }
}

// Handler: Create Order
async function handleCreateOrder(args, business, customerPhone, customerName) {
  try {
    const { items, customer_name, order_type = 'PICKUP', delivery_address, pickup_time, notes } = args;
    const finalCustomerName = customer_name || customerName || 'Web Müşteri';

    let pickupDateTime = null;
    if (pickup_time) {
      const now = new Date();
      // Support both Turkish and English
      const hoursMatch = pickup_time.match(/(\d+)\s*(saat|hour)/i);
      const minutesMatch = pickup_time.match(/(\d+)\s*(dakika|minute)/i);
      
      if (hoursMatch || minutesMatch) {
        pickupDateTime = new Date(now);
        if (hoursMatch) pickupDateTime.setHours(pickupDateTime.getHours() + parseInt(hoursMatch[1]));
        if (minutesMatch) pickupDateTime.setMinutes(pickupDateTime.getMinutes() + parseInt(minutesMatch[1]));
      } else if (pickup_time.match(/^\d{1,2}:\d{2}$/)) {
        // HH:MM format
        const [hours, minutes] = pickup_time.split(':').map(Number);
        pickupDateTime = new Date(now);
        pickupDateTime.setHours(hours, minutes, 0, 0);
        if (pickupDateTime < now) pickupDateTime.setDate(pickupDateTime.getDate() + 1);
      }
    }

    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        customerName: finalCustomerName,
        customerPhone: customerPhone,
        items: items,
        pickupTime: pickupDateTime,
        orderType: order_type,
        notes: delivery_address ? `Adres: ${delivery_address}. ${notes || ''}` : notes,
        status: 'PENDING',
        source: 'CHAT'
      }
    });

    // Notify owner
    await notifyOwner(business, order, finalCustomerName, items, order_type, pickupDateTime);

    return {
      success: true,
      orderId: order.id.slice(-8).toUpperCase(),
      message: `Order received. Order number: ${order.id.slice(-8).toUpperCase()}`
    };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, message: 'Failed to create order' };
  }
}

// Handler: Update Order
async function handleUpdateOrder(args, business, customerPhone) {
  try {
    const { order_id, pickup_time, new_items, cancel, notes } = args;
    const isTR = business.language === 'TR';

    let order = await prisma.order.findFirst({
      where: {
        businessId: business.id,
        OR: [
          { id: order_id },
          { id: { endsWith: order_id?.toUpperCase() || '' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!order) {
      return { success: false, message: isTR ? 'Sipariş bulunamadı.' : 'Order not found.' };
    }

    if (cancel) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      return { success: true, message: isTR ? 'Sipariş iptal edildi.' : 'Order cancelled.' };
    }

    const updateData = {};
    if (pickup_time) {
      const now = new Date();
      const hoursMatch = pickup_time.match(/(\d+)\s*saat/i);
      if (hoursMatch) {
        const pickupDateTime = new Date(now);
        pickupDateTime.setHours(pickupDateTime.getHours() + parseInt(hoursMatch[1]));
        updateData.pickupTime = pickupDateTime;
      }
    }
    if (new_items) updateData.items = new_items;
    if (notes) updateData.notes = notes;

    await prisma.order.update({ where: { id: order.id }, data: updateData });

    return { success: true, message: isTR ? 'Sipariş güncellendi.' : 'Order updated.' };
  } catch (error) {
    console.error('Update order error:', error);
    return { success: false, message: 'Failed to update order' };
  }
}

// Notify owner via WhatsApp
async function notifyOwner(business, order, customerName, items, orderType, pickupDateTime) {
  const ownerPhone = business.ownerWhatsApp || business.ownerPhone;
  if (!ownerPhone || !business.whatsappAccessToken) {
    console.log('⚠️ Owner notification skipped - no phone or token');
    return;
  }

  try {
    const accessToken = decrypt(business.whatsappAccessToken);
    console.log('🔔 Sending owner notification to:', ownerPhone);
    console.log('📱 Phone Number ID:', business.whatsappPhoneNumberId);
    console.log('🔑 Token decrypted, length:', accessToken?.length || 0);
    
    if (!accessToken) {
      console.error('❌ Token decrypt failed');
      return;
    }


    const isTR = business.language === 'TR';
    const tz = business.timezone || 'Europe/Istanbul';
    const pickupTimeStr = pickupDateTime?.toLocaleTimeString('tr-TR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

    const msg = isTR
      ? `🔔 YENİ SİPARİŞ (Chat)!\n\n📦 No: ${order.id.slice(-8).toUpperCase()}\n👤 ${customerName}\n🍽️ ${items}\n📍 ${orderType === 'DELIVERY' ? 'Paket' : 'Gel Al'}${pickupTimeStr ? `\n⏰ ${pickupTimeStr}` : ''}\n🕐 ${new Date().toLocaleString('tr-TR', { timeZone: tz })}`
      : `🔔 NEW ORDER (Chat)!\n\n📦 #: ${order.id.slice(-8).toUpperCase()}\n👤 ${customerName}\n🍽️ ${items}\n📍 ${orderType === 'DELIVERY' ? 'Delivery' : 'Pickup'}${pickupTimeStr ? `\n⏰ ${pickupTimeStr}` : ''}\n🕐 ${new Date().toLocaleString('en-US', { timeZone: tz })}`;

    await axios.post(
      `https://graph.facebook.com/v18.0/${business.whatsappPhoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: ownerPhone.replace(/\D/g, ''), type: 'text', text: { body: msg } },
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Owner notification failed:', e.response?.data || e.message);
  }
}

// GET /api/chat/assistant/:assistantId
router.get('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const assistant = await prisma.assistant.findFirst({
      where: { vapiAssistantId: assistantId },
      select: { name: true, business: { select: { name: true } } }
    });

    if (!assistant) return res.status(404).json({ error: 'Assistant not found' });

    res.json({ name: assistant.name, businessName: assistant.business?.name || '' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get assistant info' });
  }
});

export default router;
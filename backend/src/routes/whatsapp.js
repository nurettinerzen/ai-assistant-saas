import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/encryption.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import googleCalendarService from '../services/google-calendar.js';
import trendyolService from '../services/trendyol.js';
import cargoAggregator from '../services/cargo-aggregator.js';

const router = express.Router();
const prisma = new PrismaClient();

// OpenAI client
let openai;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// In-memory conversation history
const conversations = new Map();

// ============================================================
// TOOL DEFINITIONS (OpenAI Function Calling format)
// ============================================================

const WHATSAPP_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Creates an appointment/reservation when customer requests booking. Use this when customer wants to schedule an appointment, reservation, or booking.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Appointment date in YYYY-MM-DD format"
          },
          time: {
            type: "string",
            description: "Appointment time in HH:MM 24-hour format (e.g., 14:00)"
          },
          customer_name: {
            type: "string",
            description: "Customer's full name"
          },
          customer_phone: {
            type: "string",
            description: "Customer's phone number"
          },
          party_size: {
            type: "number",
            description: "Number of people (for restaurant reservations)"
          },
          notes: {
            type: "string",
            description: "Special requests or notes"
          }
        },
        required: ["date", "time", "customer_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Check the status of a customer's order. Use when customer asks about their order, delivery, or shipment status.",
      parameters: {
        type: "object",
        properties: {
          order_number: {
            type: "string",
            description: "Order number or ID"
          },
          customer_phone: {
            type: "string",
            description: "Customer's phone number to look up orders"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "track_shipment",
      description: "Track a shipment/cargo by tracking number. Use when customer asks about cargo tracking or delivery status.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: {
            type: "string",
            description: "Cargo tracking number"
          },
          carrier: {
            type: "string",
            description: "Cargo carrier name (yurtici, aras, mng)",
            enum: ["yurtici", "aras", "mng"]
          }
        },
        required: ["tracking_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_stock",
      description: "Check product stock/availability. Use when customer asks if a product is available or in stock.",
      parameters: {
        type: "object",
        properties: {
          product_name: {
            type: "string",
            description: "Product name or description"
          },
          barcode: {
            type: "string",
            description: "Product barcode if known"
          }
        },
        required: ["product_name"]
      }
    }
  },

  {
    type: "function",
    function: {
      name: "update_order",
      description: "Updates an existing order. Use when customer wants to change pickup time, items, or cancel order.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "Order ID or last 8 characters of order number"
          },
          pickup_time: {
            type: "string",
            description: "New pickup time in HH:MM format or relative like '3 saat sonra'"
          },
          new_items: {
            type: "string",
            description: "Updated order items (replaces existing)"
          },
          cancel: {
            type: "boolean",
            description: "Set to true to cancel the order"
          },
          notes: {
            type: "string",
            description: "Additional notes"
          }
        },
        required: ["order_id"]
      }
    }
  },

  {
    type: "function",
    function: {
      name: "create_order",
      description: "Creates a new order. ONLY use when customer specifies WHAT they want to order (specific products/items). If customer just says 'I want to order' without specifying items, ASK what they want first.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "string",
            description: "Order items with quantities (e.g., '2x Doner Plate, 1x Ayran')"
          },
          customer_name: {
            type: "string",
            description: "Customer's name"
          },
          customer_phone: {
            type: "string",
            description: "Customer's phone number"
          },
          pickup_time: {
            type: "string",
            description: "When customer wants to pick up (e.g., '3 saat sonra', '18:00', 'hemen')"
          },
          order_type: {
            type: "string",
            description: "PICKUP or DELIVERY",
            enum: ["PICKUP", "DELIVERY"]
          },
          delivery_address: {
            type: "string",
            description: "Delivery address (required for delivery orders)"
          },
          notes: {
            type: "string",
            description: "Special requests or notes"
          }
        },
        required: ["items", "customer_name"]
      }
    }
  }
];

// ============================================================
// WEBHOOK ROUTES
// ============================================================

// Webhook verification (Meta's initial setup verification)
router.get('/webhook', webhookRateLimiter.middleware(), async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe') {
      const business = await prisma.business.findFirst({
        where: { whatsappVerifyToken: token }
      });

      if (business) {
        console.log(`✅ Webhook verified for business: ${business.name} (ID: ${business.id})`);
        res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed: Invalid verify token');
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Webhook - Incoming messages (Multi-tenant)
router.post('/webhook', webhookRateLimiter.middleware(), async (req, res) => {
  console.log('🔔 WEBHOOK RECEIVED:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        console.error('❌ No phone number ID in webhook payload');
        return res.sendStatus(400);
      }

      // Find the business by phone number ID with integrations
      const business = await prisma.business.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        include: {
          assistants: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          integrations: {
            where: { isActive: true, connected: true }
          }
        }
      });

      if (!business) {
        console.error(`❌ No business found for phone number ID: ${phoneNumberId}`);
        return res.sendStatus(404);
      }

      console.log(`✅ Message for business: ${business.name} (ID: ${business.id})`);

      // Process incoming messages
      if (value?.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from;
        const messageBody = message.text?.body;
        const messageId = message.id;

        const profileName = value.contacts?.[0]?.profile?.name || null;

        console.log('📩 WhatsApp message received:', {
          businessId: business.id,
          businessName: business.name,
          from,
          message: messageBody,
          id: messageId
        });

        // Generate AI response with function calling
        const aiResponse = await generateAIResponse(business, from, messageBody);

        // Send response
        await sendWhatsAppMessage(business, from, aiResponse);
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// ============================================================
// MESSAGE SENDING
// ============================================================

async function sendWhatsAppMessage(business, to, text) {
  try {
    const accessToken = decrypt(business.whatsappAccessToken);
    const phoneNumberId = business.whatsappPhoneNumberId;

    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      }
    });

    console.log(`✅ WhatsApp message sent for business ${business.name}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// ============================================================
// AI RESPONSE GENERATION WITH FUNCTION CALLING
// ============================================================

async function generateAIResponse(business, phoneNumber, userMessage, profileName = null) {
  try {
    const client = getOpenAI();
    const assistant = business.assistants?.[0];

    // Get AI Training data
    const aiTrainings = await prisma.aiTraining.findMany({
      where: { businessId: business.id, isActive: true }
    });

    // Knowledge Base'den de bilgi al
const knowledgeItems = await prisma.knowledgeBase.findMany({
  where: { 
    businessId: business.id,
    status: 'ACTIVE'
  }
});

    // Build system prompt
    const systemPrompt = buildWhatsAppSystemPrompt({
  businessName: business.name,
  businessType: business.businessType,
  assistantName: assistant?.name,
  assistantPrompt: assistant?.systemPrompt,
  language: business.language,
  timezone: business.timezone,
  customInstructions: business.customInstructions,
  aiTrainings,
  knowledgeItems,
  customerName: profileName
});

    // Get active tools based on integrations
    const activeTools = getActiveTools(business);

    console.log(`🤖 Using assistant: ${assistant?.name || 'Default'} for business: ${business.name}`);
    console.log(`🔧 Active tools: ${activeTools.map(t => t.function.name).join(', ')}`);

    // Conversation history
    const conversationKey = `${business.id}:${phoneNumber}`;
    if (!conversations.has(conversationKey)) {
      conversations.set(conversationKey, []);
    }
    const history = conversations.get(conversationKey);

    // Add user message
    history.push({ role: 'user', content: userMessage });

    // First API call with tools
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10)
    ];

    const completionOptions = {
      model: assistant?.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    };

    // Add tools if available
    if (activeTools.length > 0) {
      completionOptions.tools = activeTools;
      completionOptions.tool_choice = 'auto';
    }

    let completion = await client.chat.completions.create(completionOptions);
    let responseMessage = completion.choices[0].message;

    // Handle tool calls if any
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`🔧 Tool calls detected: ${responseMessage.tool_calls.map(tc => tc.function.name).join(', ')}`);

      // Add assistant message with tool calls to history
      history.push(responseMessage);

      // Process each tool call
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🔧 Executing tool: ${functionName}`, functionArgs);

        // Execute the tool
        const toolResult = await executeToolCall(business, functionName, functionArgs, phoneNumber, profileName);

        console.log(`🔧 Tool result:`, toolResult);

        // Add tool result to history
        history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Get final response after tool execution
      completion = await client.chat.completions.create({
        model: assistant?.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-15)
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      responseMessage = completion.choices[0].message;
    }

    const aiResponse = responseMessage.content;

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse });

    // Limit history
    if (history.length > 20) {
      conversations.set(conversationKey, history.slice(-20));
    }

    console.log(`🤖 AI Response:`, aiResponse);
    return aiResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    const language = business.language || 'EN';
    return language === 'TR'
      ? 'Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
      : 'Sorry, I\'m experiencing an issue right now. Please try again later.';
  }
}

// ============================================================
// TOOL EXECUTION
// ============================================================

async function executeToolCall(business, functionName, args, customerPhone, profileName = null) {
  try {
    switch (functionName) {
      case 'create_appointment':
        return await handleCreateAppointment(business, args, customerPhone);

      case 'check_order_status':
        return await handleCheckOrderStatus(business, args, customerPhone);

      case 'track_shipment':
        return await handleTrackShipment(business, args);

      case 'get_product_stock':
        return await handleGetProductStock(business, args);

      case 'create_order':
  return await handleCreateOrder(args, business, customerPhone, profileName);

  case 'update_order':
        return await handleUpdateOrder(args, business, customerPhone);

      default:
        return { success: false, message: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`❌ Tool execution error (${functionName}):`, error);
    return { success: false, message: error.message };
  }
}

// ============================================================
// TOOL HANDLERS
// ============================================================

async function handleCreateAppointment(business, args, customerPhone) {
  try {
    const { date, time, customer_name, party_size, notes } = args;

    // Parse date/time
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (business.bookingDuration || 60) * 60000);

    // Check for Google Calendar integration
    const calendarIntegration = business.integrations?.find(i => i.type === 'GOOGLE_CALENDAR');

    let googleEventId = null;

    if (calendarIntegration && calendarIntegration.credentials) {
      // Create event in Google Calendar - VAPI formatı kullan
      const { access_token, refresh_token } = calendarIntegration.credentials;

      try {
        const event = await googleCalendarService.createEvent(
          access_token,
          refresh_token,
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          {
            summary: `Rezervasyon: ${customer_name}`,
            description: `Kişi sayısı: ${party_size || 1}\nTelefon: ${customerPhone}\nNotlar: ${notes || 'Yok'}\nKaynak: WhatsApp`,
            start: {
              dateTime: startDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            },
            end: {
              dateTime: endDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            }
          }
        );
        googleEventId = event?.id;
        console.log('✅ Google Calendar event created:', googleEventId);
      } catch (calError) {
        console.error('⚠️ Google Calendar error (continuing without):', calError.message);
      }
    }

    // Save to database
    await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerName: customer_name,
        customerPhone: customerPhone,
        appointmentDate: startDateTime,
        duration: business.bookingDuration || 60,
        notes: `${party_size || 1} kişi. WhatsApp${notes ? '. ' + notes : ''}`,
        status: 'CONFIRMED',
      }
    });

    return {
      success: true,
      message: `Rezervasyon oluşturuldu: ${customer_name}, ${date} ${time}, ${party_size || 1} kişi`,
      saved_to_calendar: !!googleEventId,
      event_id: googleEventId
    };

  } catch (error) {
    console.error('❌ Create appointment error:', error);
    return { success: false, message: 'Rezervasyon oluşturulurken bir hata oluştu.' };
  }
}

async function handleCheckOrderStatus(business, args, customerPhone) {
  try {
    const { order_number, customer_phone } = args;
    const phone = customer_phone || customerPhone;

    // Check for Trendyol integration
    const trendyolIntegration = business.integrations?.find(i => i.type === 'TRENDYOL');

    if (!trendyolIntegration) {
      return { success: false, message: 'Sipariş sorgulama sistemi aktif değil.' };
    }

    let orders;

    if (order_number) {
      // Search by order number
      const order = await trendyolService.getOrderByNumber(business.id, order_number);
      orders = order ? [order] : [];
    } else if (phone) {
      // Search by phone
      orders = await trendyolService.getOrdersByCustomerPhone(business.id, phone);
    }

    if (!orders || orders.length === 0) {
      return { success: false, message: 'Sipariş bulunamadı.' };
    }

    const order = orders[0];
    return {
      success: true,
      order_number: order.orderNumber,
      status: order.status,
      status_text: order.statusText || order.status,
      cargo_tracking: order.cargoTrackingNumber || null,
      cargo_company: order.cargoProviderName || null,
      total_price: order.totalPrice,
      order_date: order.orderDate
    };

  } catch (error) {
    console.error('❌ Check order status error:', error);
    return { success: false, message: 'Sipariş sorgulanırken bir hata oluştu.' };
  }
}

async function handleTrackShipment(business, args) {
  try {
    const { tracking_number, carrier } = args;

    const result = await cargoAggregator.trackShipment(business.id, tracking_number, carrier);

    if (!result.success) {
      return { success: false, message: result.error || 'Kargo bulunamadı.' };
    }

    return {
      success: true,
      tracking_number: tracking_number,
      carrier: result.carrier,
      status: result.status,
      status_text: result.statusText,
      last_update: result.lastUpdate,
      delivery_date: result.estimatedDelivery,
      tracking_url: result.trackingUrl
    };

  } catch (error) {
    console.error('❌ Track shipment error:', error);
    return { success: false, message: 'Kargo sorgulanırken bir hata oluştu.' };
  }
}

async function handleGetProductStock(business, args) {
  try {
    const { product_name, barcode } = args;

    // Check for Trendyol integration
    const trendyolIntegration = business.integrations?.find(i => i.type === 'TRENDYOL');

    if (!trendyolIntegration) {
      return { success: false, message: 'Stok sorgulama sistemi aktif değil.' };
    }

    let result;

    if (barcode) {
      result = await trendyolService.getProductStock(business.id, barcode);
    } else {
      result = await trendyolService.searchProducts(business.id, product_name);
    }

    if (!result || (!result.quantity && !result.products)) {
      return { success: false, message: 'Ürün bulunamadı.' };
    }

    if (result.products) {
      // Search result
      const product = result.products[0];
      return {
        success: true,
        product_name: product.title,
        in_stock: product.quantity > 0,
        quantity: product.quantity,
        price: product.salePrice
      };
    }

    return {
      success: true,
      product_name: result.title || product_name,
      in_stock: result.quantity > 0,
      quantity: result.quantity,
      price: result.salePrice
    };

  } catch (error) {
    console.error('❌ Get product stock error:', error);
    return { success: false, message: 'Stok sorgulanırken bir hata oluştu.' };
  }
}

async function handleCreateOrder(args, business, customerPhone, profileName = null) {
  try {
    const { items, customer_name, order_type = 'PICKUP', delivery_address, pickup_time, notes } = args;

    // Calculate pickup time if provided
    let pickupDateTime = null;
    if (pickup_time) {
      const now = new Date();
      const hoursMatch = pickup_time.match(/(\d+)\s*saat/i);
      const minutesMatch = pickup_time.match(/(\d+)\s*dakika/i);
      
      if (hoursMatch || minutesMatch) {
        pickupDateTime = new Date(now);
        if (hoursMatch) pickupDateTime.setHours(pickupDateTime.getHours() + parseInt(hoursMatch[1]));
        if (minutesMatch) pickupDateTime.setMinutes(pickupDateTime.getMinutes() + parseInt(minutesMatch[1]));
      } else if (pickup_time.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = pickup_time.split(':').map(Number);
        pickupDateTime = new Date(now);
        pickupDateTime.setHours(hours, minutes, 0, 0);
        if (pickupDateTime < now) pickupDateTime.setDate(pickupDateTime.getDate() + 1);
      }
    }

    // Use profile name as fallback
    const finalCustomerName = customer_name || profileName || 'Müşteri';

    // Create order in database
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
        source: 'WHATSAPP'
      }
    });

    console.log('✅ Order created:', order.id);

    // Format pickup time for notification
    const pickupTimeStr = pickupDateTime 
      ? pickupDateTime.toLocaleTimeString('tr-TR', { 
          timeZone: business.timezone || 'Europe/Istanbul',
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : null;

    // Send notification to business owner
    const ownerPhone = business.ownerWhatsApp || business.ownerPhone;
    if (ownerPhone) {
      const isTR = business.language === 'TR';
      const tz = business.timezone || 'Europe/Istanbul';
      
      const notificationMessage = isTR
        ? `🔔 YENİ SİPARİŞ!\n\n` +
          `📦 Sipariş No: ${order.id.slice(-8).toUpperCase()}\n` +
          `👤 Müşteri: ${finalCustomerName}\n` +
          `📱 Tel: ${customerPhone}\n` +
          `🍽️ Sipariş: ${items}\n` +
          `📍 Tür: ${order_type === 'DELIVERY' ? 'Paket Servis' : 'Gel Al'}\n` +
          `${pickupTimeStr ? `⏰ Alım Saati: ${pickupTimeStr}\n` : ''}` +
          `${delivery_address ? `🏠 Adres: ${delivery_address}\n` : ''}` +
          `${notes ? `📝 Not: ${notes}\n` : ''}` +
          `\n🕐 Sipariş Zamanı: ${new Date().toLocaleString('tr-TR', { timeZone: tz })}`
        : `🔔 NEW ORDER!\n\n` +
          `📦 Order #: ${order.id.slice(-8).toUpperCase()}\n` +
          `👤 Customer: ${finalCustomerName}\n` +
          `📱 Phone: ${customerPhone}\n` +
          `🍽️ Items: ${items}\n` +
          `📍 Type: ${order_type === 'DELIVERY' ? 'Delivery' : 'Pickup'}\n` +
          `${pickupTimeStr ? `⏰ Pickup Time: ${pickupTimeStr}\n` : ''}` +
          `${delivery_address ? `🏠 Address: ${delivery_address}\n` : ''}` +
          `${notes ? `📝 Notes: ${notes}\n` : ''}` +
          `\n🕐 Order Time: ${new Date().toLocaleString('en-US', { timeZone: tz })}`;

      try {
        await sendWhatsAppMessage(business, ownerPhone, notificationMessage);
        console.log('✅ Order notification sent to owner:', ownerPhone);
      } catch (notifError) {
        console.error('❌ Failed to send owner notification:', notifError.message);
      }
    }

    return {
      success: true,
      orderId: order.id.slice(-8).toUpperCase(),
      message: `Sipariş alındı. Sipariş numaranız: ${order.id.slice(-8).toUpperCase()}`
    };
  } catch (error) {
    console.error('❌ Create order error:', error);
    return {
      success: false,
      message: 'Sipariş oluşturulurken bir hata oluştu.'
    };
  }
}

async function handleUpdateOrder(args, business, customerPhone) {
  try {
    const { order_id, pickup_time, new_items, cancel, notes } = args;

    // Find order by ID (full or last 8 chars)
    let order = null;
    
    if (order_id) {
      const orders = await prisma.order.findMany({
        where: {
          businessId: business.id,
          OR: [
            { id: order_id },
            { id: { endsWith: order_id.toUpperCase() } },
            { id: { endsWith: order_id.toLowerCase() } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      if (orders.length > 0) order = orders[0];
    }

    // If not found by ID, try finding by customer phone
    if (!order) {
      order = await prisma.order.findFirst({
        where: {
          businessId: business.id,
          customerPhone: customerPhone,
          status: { not: 'CANCELLED' }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!order) {
      return { success: false, message: 'Sipariş bulunamadı.' };
    }

    // Handle cancellation
    if (cancel) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' }
      });

      const ownerPhone = business.ownerWhatsApp || business.ownerPhone;
      if (ownerPhone) {
        const isTR = business.language === 'TR';
        const cancelMsg = isTR
          ? `❌ SİPARİŞ İPTAL\n\n📦 Sipariş No: ${order.id.slice(-8).toUpperCase()}\n👤 Müşteri: ${order.customerName}\n🍽️ İptal Edilen: ${order.items}`
          : `❌ ORDER CANCELLED\n\n📦 Order #: ${order.id.slice(-8).toUpperCase()}\n👤 Customer: ${order.customerName}\n🍽️ Cancelled: ${order.items}`;
        await sendWhatsAppMessage(business, ownerPhone, cancelMsg);
      }

      const isTR = business.language === 'TR';
      return { success: true, message: isTR ? 'Sipariş iptal edildi.' : 'Order cancelled.' };
    }

    // Calculate pickup time
    let pickupDateTime = null;
    if (pickup_time) {
      const now = new Date();
      const hoursMatch = pickup_time.match(/(\d+)\s*saat/i);
      const minutesMatch = pickup_time.match(/(\d+)\s*dakika/i);
      
      if (hoursMatch || minutesMatch) {
        pickupDateTime = new Date(now);
        if (hoursMatch) pickupDateTime.setHours(pickupDateTime.getHours() + parseInt(hoursMatch[1]));
        if (minutesMatch) pickupDateTime.setMinutes(pickupDateTime.getMinutes() + parseInt(minutesMatch[1]));
      } else if (pickup_time.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = pickup_time.split(':').map(Number);
        pickupDateTime = new Date(now);
        pickupDateTime.setHours(hours, minutes, 0, 0);
        if (pickupDateTime < now) pickupDateTime.setDate(pickupDateTime.getDate() + 1);
      }
    }

    // Build update data
    const updateData = {};
    if (pickupDateTime) updateData.pickupTime = pickupDateTime;
    if (new_items) updateData.items = new_items;
    if (notes) updateData.notes = order.notes ? `${order.notes}. ${notes}` : notes;

    // Update order
    await prisma.order.update({
      where: { id: order.id },
      data: updateData
    });

    // Format pickup time for response
    const pickupTimeStr = pickupDateTime 
      ? pickupDateTime.toLocaleTimeString('tr-TR', { 
          timeZone: business.timezone || 'Europe/Istanbul',
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : null;

   // Notify owner of update
    const ownerPhone = business.ownerWhatsApp || business.ownerPhone;
    if (ownerPhone) {
      const isTR = business.language === 'TR';
      let updateMsg = isTR
        ? `🔄 SİPARİŞ GÜNCELLENDİ\n\n📦 Sipariş No: ${order.id.slice(-8).toUpperCase()}\n👤 Müşteri: ${order.customerName}`
        : `🔄 ORDER UPDATED\n\n📦 Order #: ${order.id.slice(-8).toUpperCase()}\n👤 Customer: ${order.customerName}`;
      
      if (pickupTimeStr) updateMsg += isTR ? `\n⏰ Yeni Alım Saati: ${pickupTimeStr}` : `\n⏰ New Pickup Time: ${pickupTimeStr}`;
      if (new_items) updateMsg += isTR ? `\n🍽️ Yeni Sipariş: ${new_items}` : `\n🍽️ New Items: ${new_items}`;
      if (notes) updateMsg += isTR ? `\n📝 Not: ${notes}` : `\n📝 Notes: ${notes}`;

      await sendWhatsAppMessage(business, ownerPhone, updateMsg);
    }

    return {
      success: true,
      message: pickupTimeStr 
        ? `Siparişiniz güncellendi. Alım saati: ${pickupTimeStr}`
        : 'Siparişiniz güncellendi.'
    };

  } catch (error) {
    console.error('❌ Update order error:', error);
    return { success: false, message: 'Sipariş güncellenirken bir hata oluştu.' };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getActiveTools(business) {
  const tools = [];
  const businessType = business.businessType || 'OTHER';
  const integrations = business.integrations || [];

  // Tool indexes: 0=create_appointment, 1=check_order_status, 2=track_shipment, 
  //               3=get_product_stock, 4=update_order, 5=create_order

  // APPOINTMENT - Salon, Clinic, Service, Other + Restaurant (masa rezervasyonu)
  if (['SALON', 'CLINIC', 'SERVICE', 'OTHER', 'RESTAURANT'].includes(businessType)) {
    tools.push(WHATSAPP_TOOLS[0]); // create_appointment
  }

  // ORDER (create/update) - Only Restaurant
  if (businessType === 'RESTAURANT') {
    tools.push(WHATSAPP_TOOLS[4]); // update_order
    tools.push(WHATSAPP_TOOLS[5]); // create_order
  }

  // ECOMMERCE tools - check status, stock, tracking (NO order creation)
  if (businessType === 'ECOMMERCE') {
    const hasTrendyol = integrations.some(i => i.type === 'TRENDYOL' && i.isActive && i.connected);
    if (hasTrendyol) {
      tools.push(WHATSAPP_TOOLS[1]); // check_order_status
      tools.push(WHATSAPP_TOOLS[3]); // get_product_stock
    }
  }

  // CARGO tracking - Any business with cargo integration
  const hasCargo = integrations.some(i => 
    ['YURTICI_KARGO', 'ARAS_KARGO', 'MNG_KARGO'].includes(i.type) && i.isActive && i.connected
  );
  if (hasCargo) {
    tools.push(WHATSAPP_TOOLS[2]); // track_shipment
  }

  // Fallback: if no tools, at least appointment
  if (tools.length === 0) {
    tools.push(WHATSAPP_TOOLS[0]); // create_appointment
  }

  return tools;
}

function buildWhatsAppSystemPrompt({ businessName, businessType, assistantName, assistantPrompt, language, timezone, customInstructions, aiTrainings, knowledgeItems, customerName }) {
  
  // Business'ın timezone'una göre güncel tarih/saat
  const tz = timezone || 'UTC';
  const now = new Date();
  
  // Timezone'a göre tarih hesapla
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: tz, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  const today = formatter.format(now); // YYYY-MM-DD
  
  // Yarın
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrow = formatter.format(tomorrowDate);

  // Okunabilir tarih/saat
  const readableDateTime = now.toLocaleString(language === 'TR' ? 'tr-TR' : 'en-US', { 
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Dil talimatı
  let languageInstruction = '';
  if (language === 'TR') {
    languageInstruction = 'MUTLAKA Türkçe cevap ver. Asla İngilizce konuşma.';
  } else if (language === 'EN') {
    languageInstruction = 'Always respond in English. Never use other languages.';
  } else if (language) {
    languageInstruction = `Respond in ${language}.`;
  }

  // Müşteri bilgisi
  const customerInfo = customerName 
    ? `\nCUSTOMER: ${customerName} (from WhatsApp profile - use for reservations)`
    : '';

  // AI Training context
  let trainingContext = '';
  if (aiTrainings && aiTrainings.length > 0) {
    const trainingsByType = {};
    for (const training of aiTrainings) {
      const type = training.type || 'GENERAL';
      if (!trainingsByType[type]) trainingsByType[type] = [];
      trainingsByType[type].push(training.content);
    }

    if (trainingsByType.FAQ) trainingContext += '\n\nFAQ:\n' + trainingsByType.FAQ.join('\n');
    if (trainingsByType.PRODUCT) trainingContext += '\n\nPRODUCTS:\n' + trainingsByType.PRODUCT.join('\n');
    if (trainingsByType.POLICY) trainingContext += '\n\nPOLICIES:\n' + trainingsByType.POLICY.join('\n');
    if (trainingsByType.GENERAL) trainingContext += '\n\nINFO:\n' + trainingsByType.GENERAL.join('\n');
  }

  // Knowledge Base context
  let knowledgeContext = '';
  if (knowledgeItems && knowledgeItems.length > 0) {
    const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };
    
    for (const item of knowledgeItems) {
      if (item.type === 'FAQ' && item.question && item.answer) {
        kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
      } else if (item.content) {
        kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
      }
    }
    
    if (kbByType.FAQ.length > 0) knowledgeContext += '\n\nFREQUENTLY ASKED QUESTIONS:\n' + kbByType.FAQ.join('\n\n');
    if (kbByType.URL.length > 0) knowledgeContext += '\n\nWEBSITE CONTENT:\n' + kbByType.URL.join('\n\n');
    if (kbByType.DOCUMENT.length > 0) knowledgeContext += '\n\nDOCUMENTS:\n' + kbByType.DOCUMENT.join('\n\n');
  }

  const toolInstructions = `
ACTIONS AVAILABLE:
- CREATE APPOINTMENTS/RESERVATIONS
- CREATE/UPDATE ORDERS  
- CHECK ORDER STATUS
- TRACK SHIPMENTS
- CHECK PRODUCT STOCK

ORDER RULES:
- Ask WHAT and WHEN before creating order
- Required: product/items + pickup time (or "hemen/now")
- If customer changes order after creation, use update_order tool
- "3 saat sonra alıcam" after order = call update_order with pickup_time
`;

  return `You are ${assistantName || 'Customer Support'} for ${businessName || 'this business'}.

DATE/TIME (${tz}):
- Now: ${readableDateTime}
- Today: ${today}
- Tomorrow: ${tomorrow}
${customerInfo}

DATE RULES:
- "bugün"/"today" = ${today}
- "yarın"/"tomorrow" = ${tomorrow}
- Use YYYY-MM-DD format for dates
- Current year: ${now.getFullYear()}

RULES:
- You are ${assistantName || 'a representative'}
- Never say you are AI/bot/assistant
- ${languageInstruction}
- Be concise (2-3 sentences max)
${toolInstructions}
${businessType ? `\nBusiness Type: ${businessType}` : ''}
${customInstructions ? `\nInstructions: ${customInstructions}` : ''}
${assistantPrompt ? `\nGuidelines: ${assistantPrompt}` : ''}
${trainingContext}${knowledgeContext}`;
} 

// ============================================================
// API ENDPOINTS
// ============================================================

// Manuel mesaj gönderme endpoint (test için)
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'to and message required' });
    }

    const result = await sendWhatsAppMessage(to, message);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

// Conversation history temizleme endpoint
router.delete('/conversations/:phoneNumber', (req, res) => {
  const { phoneNumber } = req.params;
  conversations.delete(phoneNumber);
  res.json({ success: true, message: 'Conversation history cleared' });
});

// Aktif konuşmaları listele
router.get('/conversations', (req, res) => {
  const activeConversations = Array.from(conversations.keys()).map(phone => ({
    phoneNumber: phone,
    messageCount: conversations.get(phone).length
  }));
  res.json({ conversations: activeConversations });
});

export default router;
/**
 * Email AI Service
 * Generates AI draft responses using OpenAI with Function Calling
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import googleCalendarService from './google-calendar.js';
import trendyolService from './trendyol.js';
import cargoAggregator from './cargo-aggregator.js';

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============================================================
// TOOL DEFINITIONS (Same as WhatsApp/Chat)
// ============================================================

const EMAIL_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Creates an appointment/reservation when customer requests booking via email.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Appointment date in YYYY-MM-DD format" },
          time: { type: "string", description: "Appointment time in HH:MM 24-hour format" },
          customer_name: { type: "string", description: "Customer's full name" },
          customer_email: { type: "string", description: "Customer's email address" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          service_type: { type: "string", description: "Type of service requested" },
          notes: { type: "string", description: "Special requests or notes" }
        },
        required: ["date", "time", "customer_name", "customer_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Check the status of a customer's e-commerce order.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Order number or ID" },
          customer_email: { type: "string", description: "Customer's email address" }
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
  }
];

// Get active tools based on business type
function getActiveTools(business) {
  const tools = [];
  const businessType = business.businessType || 'OTHER';
  const integrations = business.integrations || [];

  // APPOINTMENT - Salon, Clinic, Service, Other
  if (['SALON', 'CLINIC', 'SERVICE', 'OTHER'].includes(businessType)) {
    tools.push(EMAIL_TOOLS[0]); // create_appointment
  }

  // ECOMMERCE tools - check status, stock, tracking
  if (businessType === 'ECOMMERCE') {
    const hasTrendyol = integrations.some(i => i.type === 'TRENDYOL' && i.isActive && i.connected);
    if (hasTrendyol) {
      tools.push(EMAIL_TOOLS[1]); // check_order_status
      tools.push(EMAIL_TOOLS[3]); // get_product_stock
    }
    
    // Cargo tracking
    const hasCargo = integrations.some(i => 
      ['YURTICI_KARGO', 'ARAS_KARGO', 'MNG_KARGO'].includes(i.type) && i.isActive && i.connected
    );
    if (hasCargo) {
      tools.push(EMAIL_TOOLS[2]); // track_shipment
    }
  }

  return tools;
}

class EmailAIService {
  /**
   * Generate a draft reply for an incoming email
   */
  async generateDraft(businessId, thread, incomingMessage) {
    try {
      // Get business info with integrations
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          assistants: {
            where: { isActive: true },
            take: 1
          },
          integrations: {
            where: { isActive: true }
          }
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Get Knowledge Base content
      const knowledgeItems = await prisma.knowledgeBase.findMany({
        where: { businessId, status: 'ACTIVE' }
      });

      // Get thread history (last 5 messages for context)
      const threadHistory = await prisma.emailMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      // Build context
      const businessName = business.name;
      const businessType = business.businessType;
      const assistantPrompt = business.assistants[0]?.systemPrompt || '';
      const language = business.language || this.detectLanguage(incomingMessage.bodyText || incomingMessage.subject);
      const timezone = business.timezone || 'UTC';

      // Build Knowledge Base context
      const knowledgeContext = this.buildKnowledgeContext(knowledgeItems);

      // Build the prompt
      const systemPrompt = this.buildSystemPrompt({
        businessName,
        businessType,
        assistantPrompt,
        language,
        timezone,
        knowledgeContext
      });

      const userPrompt = this.buildUserPrompt({
        subject: incomingMessage.subject,
        from: incomingMessage.fromEmail,
        fromName: incomingMessage.fromName,
        body: incomingMessage.bodyText,
        threadHistory
      });

      // Get active tools for this business
      const activeTools = getActiveTools(business);
      console.log('📧 Email AI - Active tools:', activeTools.map(t => t.function.name));

      // Call OpenAI with tools
      const completionParams = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };

      // Add tools if available
      if (activeTools.length > 0) {
        completionParams.tools = activeTools;
        completionParams.tool_choice = 'auto';
      }

      let response = await openai.chat.completions.create(completionParams);
      let responseMessage = response.choices[0]?.message;

      // Handle tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        console.log('🔧 Email tool calls detected:', responseMessage.tool_calls.length);

        const toolResponses = [];
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log('🔧 Executing tool:', functionName, functionArgs);
          
          const result = await this.executeToolCall(business, functionName, functionArgs, thread.customerEmail);
          
          toolResponses.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Get final response with tool results
        const secondResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            {
              role: 'assistant',
              content: responseMessage.content || null,
              tool_calls: responseMessage.tool_calls
            },
            ...toolResponses
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        responseMessage = secondResponse.choices[0]?.message;
      }

      const draftContent = responseMessage?.content || '';

      // Save draft to database
      const draft = await prisma.emailDraft.create({
        data: {
          messageId: incomingMessage.id,
          threadId: thread.id,
          businessId,
          generatedContent: draftContent,
          status: 'PENDING_REVIEW'
        }
      });

      // Update thread status
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { status: 'DRAFT_READY' }
      });

      console.log('✅ Email draft generated:', draft.id);
      return draft;
    } catch (error) {
      console.error('Generate draft error:', error);
      throw error;
    }
  }

  /**
   * Execute tool call
   */
  async executeToolCall(business, functionName, args, customerEmail) {
    switch (functionName) {
      case 'create_appointment':
        return await this.handleCreateAppointment(args, business, customerEmail);
      case 'check_order_status':
        return await this.handleCheckOrderStatus(args, business, customerEmail);
      case 'track_shipment':
        return await this.handleTrackShipment(args, business);
      case 'get_product_stock':
        return await this.handleGetProductStock(args, business);
      default:
        return { success: false, message: `Unknown function: ${functionName}` };
    }
  }

  /**
   * Handle create appointment
   */
  async handleCreateAppointment(args, business, customerEmail) {
    try {
      const { date, time, customer_name, customer_phone, service_type, notes } = args;

      let appointmentDateTime;
      try {
        appointmentDateTime = new Date(`${date}T${time}`);
        if (isNaN(appointmentDateTime.getTime())) throw new Error('Invalid');
      } catch {
        return { success: false, message: 'Invalid date/time format' };
      }

      // Check for Google Calendar integration
      const calendarIntegration = business.integrations?.find(
        i => i.type === 'GOOGLE_CALENDAR' && i.isActive
      );

      let calendarEventId = null;
      if (calendarIntegration?.credentials) {
        try {
          const { access_token, refresh_token } = calendarIntegration.credentials;
          const duration = business.bookingDuration || 30;
          const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

          const event = await googleCalendarService.createEvent(
            access_token, refresh_token,
            process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
            {
              summary: `${service_type || 'Appointment'} - ${customer_name}`,
              description: `Email: ${customerEmail}\nPhone: ${customer_phone || 'N/A'}\n${notes || ''}`,
              start: { dateTime: appointmentDateTime.toISOString(), timeZone: business.timezone || 'UTC' },
              end: { dateTime: endDateTime.toISOString(), timeZone: business.timezone || 'UTC' }
            }
          );
          calendarEventId = event.id;
        } catch (e) {
          console.error('Calendar error:', e);
        }
      }

      // Save to database
      await prisma.appointment.create({
        data: {
          businessId: business.id,
          customerName: customer_name,
          customerPhone: customer_phone || customerEmail,
          appointmentDate: appointmentDateTime,
          duration: business.bookingDuration || 30,
          serviceType: service_type,
          notes: `Via Email. ${notes || ''}`,
          status: 'CONFIRMED'
        }
      });

      const isTR = business.language === 'TR';
      return {
        success: true,
        message: isTR
          ? `Randevu oluşturuldu: ${date} saat ${time}`
          : `Appointment created for ${date} at ${time}`
      };
    } catch (error) {
      console.error('Create appointment error:', error);
      return { success: false, message: 'Failed to create appointment' };
    }
  }

  /**
   * Handle check order status (E-commerce)
   */
  async handleCheckOrderStatus(args, business, customerEmail) {
    try {
      const { order_number } = args;
      
      const trendyolIntegration = business.integrations?.find(
        i => i.type === 'TRENDYOL' && i.isActive && i.connected
      );

      if (!trendyolIntegration) {
        return { success: false, message: 'E-commerce integration not configured' };
      }

      // Query Trendyol API
      const result = await trendyolService.getOrderStatus(business.id, order_number || customerEmail);

      if (result.success) {
        return {
          success: true,
          order_number: result.orderNumber,
          status: result.status,
          items: result.items,
          shipping_status: result.shippingStatus,
          tracking_number: result.trackingNumber
        };
      }

      return { success: false, message: 'Order not found' };
    } catch (error) {
      console.error('Check order status error:', error);
      return { success: false, message: 'Failed to check order status' };
    }
  }

  /**
   * Handle track shipment
   */
  async handleTrackShipment(args, business) {
    try {
      const { tracking_number, carrier } = args;

      const result = await cargoAggregator.trackShipment(business.id, tracking_number, carrier);

      if (result.success) {
        return {
          success: true,
          carrier: result.carrier,
          status: result.status,
          location: result.location,
          estimated_delivery: result.estimatedDelivery,
          history: result.history?.slice(0, 3) // Last 3 updates
        };
      }

      return { success: false, message: 'Shipment not found' };
    } catch (error) {
      console.error('Track shipment error:', error);
      return { success: false, message: 'Failed to track shipment' };
    }
  }

  /**
   * Handle get product stock
   */
  async handleGetProductStock(args, business) {
    try {
      const { product_name, barcode } = args;

      const trendyolIntegration = business.integrations?.find(
        i => i.type === 'TRENDYOL' && i.isActive && i.connected
      );

      if (!trendyolIntegration) {
        return { success: false, message: 'E-commerce integration not configured' };
      }

      const result = await trendyolService.searchProduct(business.id, product_name, barcode);

      if (result.success && result.products?.length > 0) {
        const product = result.products[0];
        return {
          success: true,
          product_name: product.title,
          in_stock: product.quantity > 0,
          quantity: product.quantity,
          price: product.salePrice
        };
      }

      return { success: false, message: 'Product not found' };
    } catch (error) {
      console.error('Get product stock error:', error);
      return { success: false, message: 'Failed to check stock' };
    }
  }

  /**
   * Build Knowledge Base context
   */
  buildKnowledgeContext(knowledgeItems) {
    if (!knowledgeItems || knowledgeItems.length === 0) return '';

    const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

    for (const item of knowledgeItems) {
      if (item.type === 'FAQ' && item.question && item.answer) {
        kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
      } else if (item.content) {
        kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
      }
    }

    let context = '';
    if (kbByType.FAQ.length > 0) {
      context += '\n\n=== FREQUENTLY ASKED QUESTIONS ===\n' + kbByType.FAQ.join('\n\n');
    }
    if (kbByType.URL.length > 0) {
      context += '\n\n=== WEBSITE CONTENT ===\n' + kbByType.URL.join('\n\n');
    }
    if (kbByType.DOCUMENT.length > 0) {
      context += '\n\n=== DOCUMENTS ===\n' + kbByType.DOCUMENT.join('\n\n');
    }

    return context;
  }

  /**
   * Build system prompt for draft generation
   */
  buildSystemPrompt({ businessName, businessType, assistantPrompt, language, timezone, knowledgeContext }) {
    const languageInstruction = language === 'TR'
      ? 'Her zaman Türkçe yanıt ver.'
      : 'Always respond in English.';

    const now = new Date();
    const dateStr = now.toLocaleDateString(language === 'TR' ? 'tr-TR' : 'en-US', { 
      timeZone: timezone,
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `You are an AI email assistant for ${businessName}, a ${businessType.toLowerCase()} business.

DATE/TIME: ${dateStr} (${timezone})

${assistantPrompt ? `Business Instructions:\n${assistantPrompt}\n` : ''}

${knowledgeContext ? `\n=== KNOWLEDGE BASE ===${knowledgeContext}\n` : ''}

Guidelines:
1. ${languageInstruction}
2. Be professional but friendly
3. Address the customer's questions/concerns directly
4. Keep responses concise but helpful
5. Use appropriate greetings and sign-offs
6. Do NOT include a signature (it will be added automatically)
7. If you need more information, ask politely
8. Never make promises you can't keep
9. Use the available tools to check order status, appointments, etc.

Format:
- Start with a greeting using the customer's name if available
- Address their main points
- End with a helpful closing (without signature)`;
  }

  /**
   * Build user prompt with context
   */
  buildUserPrompt({ subject, from, fromName, body, threadHistory }) {
    let prompt = `Please draft a reply to this email:\n\n`;
    prompt += `From: ${fromName ? `${fromName} <${from}>` : from}\n`;
    prompt += `Subject: ${subject}\n\n`;
    prompt += `Email Content:\n${body}\n`;

    if (threadHistory && threadHistory.length > 1) {
      prompt += `\n\n--- PREVIOUS CONVERSATION ---\n`;
      for (const msg of threadHistory.slice(0, -1)) {
        const direction = msg.direction === 'INBOUND' ? 'Customer' : 'Us';
        prompt += `\n[${direction}]: ${msg.bodyText?.substring(0, 500)}...\n`;
      }
    }

    return prompt;
  }

  /**
   * Regenerate a draft with optional feedback
   */
  async regenerateDraft(draftId, feedback = null) {
    try {
      const existingDraft = await prisma.emailDraft.findUnique({
        where: { id: draftId },
        include: {
          thread: true,
          message: true,
          business: {
            include: {
              assistants: { where: { isActive: true }, take: 1 },
              integrations: { where: { isActive: true } }
            }
          }
        }
      });

      if (!existingDraft) {
        throw new Error('Draft not found');
      }

      const business = existingDraft.business;
      const thread = existingDraft.thread;
      const incomingMessage = existingDraft.message;

      // Get Knowledge Base
      const knowledgeItems = await prisma.knowledgeBase.findMany({
        where: { businessId: business.id, status: 'ACTIVE' }
      });

      // Get thread history
      const threadHistory = await prisma.emailMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      const language = business.language || this.detectLanguage(incomingMessage?.bodyText || thread.subject);
      const knowledgeContext = this.buildKnowledgeContext(knowledgeItems);

      const systemPrompt = this.buildSystemPrompt({
        businessName: business.name,
        businessType: business.businessType,
        assistantPrompt: business.assistants[0]?.systemPrompt || '',
        language,
        timezone: business.timezone || 'UTC',
        knowledgeContext
      });

      let userPrompt = this.buildUserPrompt({
        subject: thread.subject,
        from: thread.customerEmail,
        fromName: thread.customerName,
        body: incomingMessage?.bodyText || '',
        threadHistory
      });

      if (feedback) {
        userPrompt += `\n\n--- FEEDBACK ---\nPlease regenerate with these considerations:\n${feedback}`;
      }

      userPrompt += `\n\n--- PREVIOUS DRAFT ---\n${existingDraft.generatedContent}`;

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const newContent = response.choices[0]?.message?.content || '';

      const updatedDraft = await prisma.emailDraft.update({
        where: { id: draftId },
        data: {
          generatedContent: newContent,
          editedContent: null,
          status: 'PENDING_REVIEW'
        }
      });

      return updatedDraft;
    } catch (error) {
      console.error('Regenerate draft error:', error);
      throw error;
    }
  }

  /**
   * Simple language detection
   */
  detectLanguage(text) {
    if (!text) return 'EN';

    const turkishIndicators = [
      'merhaba', 'tesekkur', 'lutfen', 'nasil', 'iyi gunler',
      'sayin', 'rica', 'bilgi', 'hakkinda', 'musteri',
      'sikayet', 'randevu', 'fiyat', 'urun', 'hizmet'
    ];

    const lowerText = text.toLowerCase();

    if (/[ığüşöçİĞÜŞÖÇ]/.test(text)) return 'TR';

    for (const word of turkishIndicators) {
      if (lowerText.includes(word)) return 'TR';
    }

    return 'EN';
  }

  // ==================== EXISTING METHODS ====================

  async getDraft(draftId) {
    return await prisma.emailDraft.findUnique({
      where: { id: draftId },
      include: { thread: true, message: true }
    });
  }

  async updateDraft(draftId, content) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: { editedContent: content }
    });
  }

  async approveDraft(draftId, userId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    });
  }

  async markDraftSent(draftId, sentMessageId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentMessageId
      }
    });
  }

  async rejectDraft(draftId, userId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    });
  }

  async getPendingDrafts(businessId) {
    return await prisma.emailDraft.findMany({
      where: { businessId, status: 'PENDING_REVIEW' },
      include: { thread: true, message: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new EmailAIService();
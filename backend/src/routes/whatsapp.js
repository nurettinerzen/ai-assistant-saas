/**
 * WhatsApp Webhook Handler
 * Multi-tenant WhatsApp Business API integration
 * WITH FUNCTION CALLING SUPPORT - Using Central Tool System
 */

import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/encryption.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import { getActiveTools, executeTool } from '../tools/index.js';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';

const router = express.Router();
const prisma = new PrismaClient();

// OpenAI client (lazy initialization)
let openai;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// In-memory conversation history (includes tool calls)
// Format: Map<conversationKey, Array<message>>
const conversations = new Map();

// Max iterations for recursive tool calling
const MAX_TOOL_ITERATIONS = 5;

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

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
  console.log('🔔 WhatsApp WEBHOOK RECEIVED:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    // Validate webhook payload from Meta
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Get the phone number ID to identify which business this message is for
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        console.error('❌ No phone number ID in webhook payload');
        return res.sendStatus(400);
      }

      // Find the business by phone number ID (include integrations for tools)
      const business = await prisma.business.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        include: {
          assistants: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          integrations: {
            where: { isActive: true }
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
        const from = message.from; // Sender's phone number
        const messageBody = message.text?.body; // Message content
        const messageId = message.id;

        // Skip if not a text message
        if (!messageBody) {
          console.log('⚠️ Non-text message received, skipping');
          return res.sendStatus(200);
        }

        console.log('📩 WhatsApp message received:', {
          businessId: business.id,
          businessName: business.name,
          from,
          message: messageBody,
          id: messageId
        });

        // Generate AI response with tool support
        const aiResponse = await generateAIResponseWithTools(
          business,
          from,
          messageBody,
          { messageId }
        );

        // Send response using business's credentials
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

// ============================================================================
// AI RESPONSE WITH TOOL SUPPORT
// ============================================================================

/**
 * Generate AI response with function calling support
 * Uses recursive loop to handle multiple tool calls
 */
async function generateAIResponseWithTools(business, phoneNumber, userMessage, context = {}) {
  try {
    const client = getOpenAI();
    const assistant = business.assistants?.[0];

    // Build system prompt (now async due to Knowledge Base query)
    const systemPrompt = await buildSystemPrompt(business, assistant);

    // Get conversation history
    const conversationKey = `${business.id}:${phoneNumber}`;
    if (!conversations.has(conversationKey)) {
      conversations.set(conversationKey, []);
    }
    const history = conversations.get(conversationKey);

    // Add user message to history
    history.push({
      role: 'user',
      content: userMessage
    });

    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-20) // Last 20 messages for context
    ];

    // Get active tools for this business
    const tools = getActiveTools(business);
    console.log(`🔧 [WhatsApp] Active tools for ${business.name}: ${tools.map(t => t.function.name).join(', ') || 'none'}`);

    // Process with tool loop
    const finalResponse = await processWithToolLoop(
      client,
      messages,
      tools,
      business,
      {
        ...context,
        channel: 'WHATSAPP',
        customerPhone: phoneNumber
      },
      assistant?.model || 'gpt-4o-mini'
    );

    // Add final AI response to history
    history.push({
      role: 'assistant',
      content: finalResponse
    });

    // Limit history size
    if (history.length > 40) {
      conversations.set(conversationKey, history.slice(-40));
    }

    console.log(`🤖 AI Response for ${business.name}:`, finalResponse);
    return finalResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    return getErrorMessage(business.language);
  }
}

/**
 * Process messages with recursive tool calling loop
 */
async function processWithToolLoop(client, messages, tools, business, context, model) {
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    // Call OpenAI
    const completionParams = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    };

    // Add tools if available
    if (tools && tools.length > 0) {
      completionParams.tools = tools;
      completionParams.tool_choice = 'auto';
    }

    const completion = await client.chat.completions.create(completionParams);
    const responseMessage = completion.choices[0].message;

    // Check if AI wants to call tools
    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
      // No tool calls - return the text response
      return responseMessage.content || getErrorMessage(business.language);
    }

    console.log(`🔧 Tool calls detected (iteration ${iteration + 1}):`,
      responseMessage.tool_calls.map(tc => tc.function.name));

    // Add assistant's response with tool_calls to messages
    // NOTE: Do NOT use responseMessage.content here - it may contain debug text
    // that we don't want to show to the user (e.g., "Checking order status...")
    messages.push({
      role: 'assistant',
      content: null, // Explicitly null - we only want the final response after tools complete
      tool_calls: responseMessage.tool_calls
    });

    // Execute each tool call
    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let functionArgs;

      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error(`❌ Failed to parse tool arguments for ${functionName}:`, e);
        functionArgs = {};
      }

      console.log(`🔧 [WhatsApp] Executing tool: ${functionName}`, JSON.stringify(functionArgs));

      // Execute tool using central tool system
      const result = await executeTool(functionName, functionArgs, business, context);

      console.log(`🔧 [WhatsApp] Tool result for ${functionName}:`, result.success ? 'SUCCESS' : 'FAILED', result);

      // Add tool result to messages
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    iteration++;
  }

  // Max iterations reached
  console.warn(`⚠️ Max tool iterations (${MAX_TOOL_ITERATIONS}) reached`);
  return business.language === 'TR'
    ? 'İşleminiz tamamlanamadı. Lütfen tekrar deneyin.'
    : 'Could not complete your request. Please try again.';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build system prompt for the assistant
 * Now uses the central promptBuilder service
 */
async function buildSystemPrompt(business, assistant) {
  const language = business?.language || 'TR';

  // Get active tools list for prompt
  const activeToolsList = getPromptBuilderTools(business, business.integrations || []);

  // Use the central prompt builder
  const basePrompt = buildAssistantPrompt(assistant || {}, business, activeToolsList);

  // Get Knowledge Base content for this business
  const knowledgeItems = await prisma.knowledgeBase.findMany({
    where: { businessId: business.id, status: 'ACTIVE' }
  });

  // Build Knowledge Base context
  let knowledgeContext = '';
  if (knowledgeItems && knowledgeItems.length > 0) {
    const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

    for (const item of knowledgeItems) {
      if (item.type === 'FAQ' && item.question && item.answer) {
        kbByType.FAQ.push(`S: ${item.question}\nC: ${item.answer}`);
      } else if (item.content) {
        kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
      }
    }

    if (kbByType.FAQ.length > 0) {
      knowledgeContext += '\n\n## SIK SORULAN SORULAR\n' + kbByType.FAQ.join('\n\n');
    }
    if (kbByType.URL.length > 0) {
      knowledgeContext += '\n\n## WEB SAYFASI İÇERİĞİ\n' + kbByType.URL.join('\n\n');
    }
    if (kbByType.DOCUMENT.length > 0) {
      knowledgeContext += '\n\n## DÖKÜMANLAR\n' + kbByType.DOCUMENT.join('\n\n');
    }

    console.log(`📚 [WhatsApp] Knowledge Base items added: ${knowledgeItems.length}`);
  }

  // Tool calling instructions - CRITICAL: No debug info to user
  const toolInstructions = language === 'TR'
    ? `
ARAÇ KULLANIMI KURALLARI:
- Araç (function) çağırırken kullanıcıya HİÇBİR ŞEY söyleme
- "Kontrol ediyorum", "Bir saniye", "Bakıyorum" gibi mesajlar GÖNDERME
- Araç sonucu döndükten sonra SADECE sonucu kullanıcıya açıkla
- Araç adı, function name veya teknik bilgi ASLA gösterme
- Doğrudan sonucu paylaş, ara mesaj gönderme

Müşteri istekleri:
- Randevu almak isterse: İsim, telefon, tarih/saat ve hizmet türünü sor, sonra create_appointment kullan
- Sipariş durumu sormak isterse: Sipariş numarası veya telefon numarasını sor, sonra check_order_status kullan
- Ürün stok sormak isterse: Ürün adını sor, sonra get_product_stock kullan

Sonucu müşteriye samimi bir şekilde ilet.`
    : `
TOOL USAGE RULES:
- When calling a tool (function), DO NOT send ANY message to the user
- DO NOT send messages like "Checking", "One moment", "Let me look"
- After the tool returns, ONLY explain the result to the user
- NEVER show tool names, function names or technical information
- Share the result directly, do not send intermediate messages

Customer requests:
- To book an appointment: Ask for name, phone, date/time, service type, then use create_appointment
- To check order status: Ask for order number or phone, then use check_order_status
- To check product stock: Ask for product name, then use get_product_stock

Confirm the result with the customer in a friendly manner.`;

  return `${basePrompt}
${knowledgeContext}
${toolInstructions}`;
}

/**
 * Get error message in business language
 */
function getErrorMessage(language) {
  const errorMessages = {
    'EN': 'Sorry, I\'m experiencing an issue right now. Please try again later.',
    'TR': 'Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.',
    'ES': 'Lo siento, estoy experimentando un problema en este momento. Por favor, inténtelo de nuevo más tarde.',
    'FR': 'Désolé, je rencontre un problème en ce moment. Veuillez réessayer plus tard.',
    'DE': 'Entschuldigung, ich habe gerade ein Problem. Bitte versuchen Sie es später erneut.'
  };
  return errorMessages[language] || errorMessages['EN'];
}

/**
 * Send WhatsApp message using business credentials
 */
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
        text: {
          body: text
        }
      }
    });

    console.log(`✅ WhatsApp message sent for business ${business.name}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// ============================================================================
// ADMIN/TEST ENDPOINTS
// ============================================================================

// Manual message sending endpoint (for testing)
router.post('/send', async (req, res) => {
  try {
    const { businessId, to, message } = req.body;

    if (!businessId || !to || !message) {
      return res.status(400).json({ error: 'businessId, to and message required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await sendWhatsAppMessage(business, to, message);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send message',
      details: error.message
    });
  }
});

// Clear conversation history (admin)
router.delete('/conversations/:businessId/:phoneNumber', (req, res) => {
  const { businessId, phoneNumber } = req.params;
  const conversationKey = `${businessId}:${phoneNumber}`;
  conversations.delete(conversationKey);
  res.json({ success: true, message: 'Conversation history cleared' });
});

// List active conversations (admin)
router.get('/conversations', (req, res) => {
  const activeConversations = Array.from(conversations.keys()).map(key => {
    const [businessId, phoneNumber] = key.split(':');
    return {
      businessId,
      phoneNumber,
      messageCount: conversations.get(key).length
    };
  });
  res.json({ conversations: activeConversations });
});

export default router;

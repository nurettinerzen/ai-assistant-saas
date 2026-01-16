/**
 * WhatsApp Webhook Handler
 * Multi-tenant WhatsApp Business API integration
 * Using Google Gemini API
 */

import express from 'express';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/encryption.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';
import { isFreePlanExpired } from '../middleware/checkPlanExpiry.js';
import { calculateTokenCost, hasFreeChat } from '../config/plans.js';
import { getActiveTools, executeTool } from '../tools/index.js';
import callAnalysis from '../services/callAnalysis.js';

/**
 * Convert tool definitions to Gemini function declarations format
 * Same as chat.js - ensures consistent function calling across channels
 */
function convertToolsToGeminiFunctions(tools) {
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(tool.function.parameters.properties || {}).map(([key, value]) => [
          key,
          {
            type: value.type?.toUpperCase() || 'STRING',
            description: value.description || '',
            ...(value.enum ? { enum: value.enum } : {})
          }
        ])
      ),
      required: tool.function.parameters.required || []
    }
  }));
}

const router = express.Router();
const prisma = new PrismaClient();

// Gemini client (lazy initialization)
let genAI = null;
const getGemini = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

// In-memory conversation history
// Format: Map<conversationKey, Array<message>>
const conversations = new Map();

// In-memory set to track processed message IDs (prevents duplicates from Meta retries)
// Messages are kept for 5 minutes then cleaned up
const processedMessages = new Map();
const MESSAGE_DEDUP_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup old processed messages every minute
setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of processedMessages) {
    if (now - timestamp > MESSAGE_DEDUP_TTL) {
      processedMessages.delete(messageId);
    }
  }
}, 60 * 1000);

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
      let business = await prisma.business.findFirst({
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

      // Fallback: If no business found but phoneNumberId matches env, use env credentials
      // This is for testing/development with the default test account
      if (!business && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
        console.log('⚠️ Using env fallback for WhatsApp - phone number ID matched env');

        // First try to find the dev account (business ID 21)
        business = await prisma.business.findUnique({
          where: { id: 21 },
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

        // If dev account not found, fall back to first business with active assistant
        if (!business) {
          business = await prisma.business.findFirst({
            where: {
              assistants: { some: { isActive: true } }
            },
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
        }

        if (business) {
          // Inject env credentials for this request
          business._useEnvCredentials = true;
        }
      }

      if (!business) {
        console.error(`❌ No business found for phone number ID: ${phoneNumberId}`);
        return res.sendStatus(404);
      }

      console.log(`✅ Message for business: ${business.name} (ID: ${business.id})`);

      // Check subscription and plan expiry
      const subscription = await prisma.subscription.findUnique({
        where: { businessId: business.id },
        include: { business: true }
      });

      if (subscription && isFreePlanExpired(subscription)) {
        console.log(`🚫 WhatsApp blocked - FREE plan expired for business ${business.id}`);
        // Silently ignore the message - don't respond
        return res.sendStatus(200);
      }

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

        // IMPORTANT: Check for duplicate messages (Meta may retry)
        if (processedMessages.has(messageId)) {
          console.log(`⚠️ Duplicate message detected, skipping: ${messageId}`);
          return res.sendStatus(200);
        }

        // Mark message as being processed IMMEDIATELY
        processedMessages.set(messageId, Date.now());

        console.log('📩 WhatsApp message received:', {
          businessId: business.id,
          businessName: business.name,
          from,
          message: messageBody,
          id: messageId
        });

        // IMPORTANT: Respond to Meta immediately to prevent retries
        // Then process the message asynchronously
        res.sendStatus(200);

        // Process message asynchronously (don't await)
        processWhatsAppMessage(business, from, messageBody, messageId).catch(err => {
          console.error('❌ Async message processing error:', err);
        });

        return; // Already sent response
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
// ASYNC MESSAGE PROCESSING
// ============================================================================

/**
 * Process WhatsApp message asynchronously
 * Called after webhook returns 200 to Meta
 */
async function processWhatsAppMessage(business, from, messageBody, messageId) {
  try {
    // Get subscription for cost calculation
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id }
    });

    // Generate AI response with Gemini
    const aiResponse = await generateAIResponse(
      business,
      from,
      messageBody,
      { messageId, subscription }
    );

    // Send response using business's credentials
    await sendWhatsAppMessage(business, from, aiResponse);
  } catch (error) {
    console.error('❌ Error processing WhatsApp message:', error);
    // Try to send error message to user
    try {
      await sendWhatsAppMessage(
        business,
        from,
        'Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
      );
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }
  }
}

// ============================================================================
// AI RESPONSE WITH GEMINI
// ============================================================================

/**
 * Generate AI response using Gemini with proper function calling
 * Same architecture as chat.js - model calls tools when needed
 */
async function generateAIResponse(business, phoneNumber, userMessage, context = {}) {
  try {
    const genAI = getGemini();
    const assistant = business.assistants?.[0];
    const conversationKey = `${business.id}:${phoneNumber}`;
    const language = business?.language || 'TR';
    const subscription = context.subscription;

    // Build system prompt
    const systemPrompt = await buildSystemPrompt(business, assistant);

    // Session timeout: 30 minutes of inactivity = new session
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    // Get conversation history (from memory cache or database)
    let history;
    let existingLog;
    let sessionId = `whatsapp-${business.id}-${phoneNumber}`;

    // Check if existing session has timed out
    existingLog = await prisma.chatLog.findUnique({
      where: { sessionId },
      select: { id: true, inputTokens: true, outputTokens: true, totalCost: true, updatedAt: true, status: true, messages: true }
    });

    if (existingLog) {
      const lastActivity = new Date(existingLog.updatedAt);
      const timeSinceActivity = Date.now() - lastActivity.getTime();

      if (timeSinceActivity > SESSION_TIMEOUT_MS || existingLog.status === 'ended') {
        // Session timed out - mark as ended and start fresh
        console.log(`⏰ [WhatsApp] Session for ${phoneNumber} timed out (${Math.round(timeSinceActivity / 60000)} min) - starting new session`);

        // Determine normalized topic for timed out session
        let normalizedCategory = null;
        let normalizedTopic = null;
        if (existingLog.messages && Array.isArray(existingLog.messages) && existingLog.messages.length > 0) {
          try {
            const transcriptText = callAnalysis.formatChatMessagesAsTranscript(existingLog.messages);
            if (transcriptText && transcriptText.length > 20) {
              const topicResult = await callAnalysis.determineNormalizedTopic(transcriptText);
              normalizedCategory = topicResult.normalizedCategory;
              normalizedTopic = topicResult.normalizedTopic;
              console.log(`📊 [WhatsApp] Timed out session topic: ${normalizedCategory} > ${normalizedTopic}`);
            }
          } catch (topicError) {
            console.error('⚠️ [WhatsApp] Topic determination failed:', topicError.message);
          }
        }

        await prisma.chatLog.update({
          where: { sessionId },
          data: {
            status: 'ended',
            normalizedCategory: normalizedCategory,
            normalizedTopic: normalizedTopic,
            updatedAt: new Date()
          }
        });

        // Generate new session ID with timestamp
        sessionId = `whatsapp-${business.id}-${phoneNumber}-${Date.now()}`;
        history = [];
        existingLog = null;
        conversations.delete(conversationKey);
      } else if (conversations.has(conversationKey)) {
        // Use cached history (session still active)
        history = conversations.get(conversationKey);
        console.log(`✅ [WhatsApp] Session active (${Math.round(timeSinceActivity / 60000)} min since last activity)`);
      } else if (existingLog.messages && Array.isArray(existingLog.messages)) {
        // Load history from database (last 40 messages)
        history = existingLog.messages.slice(-40);
        conversations.set(conversationKey, history);
        console.log(`📚 [WhatsApp] Loaded ${history.length} messages from database for ${phoneNumber}`);
      } else {
        history = [];
        conversations.set(conversationKey, history);
      }
    } else {
      history = [];
      conversations.set(conversationKey, history);
    }

    // Get available tools for this business
    const tools = getActiveTools(business);
    const geminiFunctions = convertToolsToGeminiFunctions(tools);

    console.log('🔧 [WhatsApp] Tools available:', geminiFunctions.map(f => f.name));

    // Configure model with function calling (same as chat.js)
    // toolConfig with mode: 'AUTO' ensures Gemini uses tools when appropriate
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
      tools: geminiFunctions.length > 0 ? [{
        functionDeclarations: geminiFunctions
      }] : undefined,
      toolConfig: geminiFunctions.length > 0 ? {
        functionCallingConfig: {
          mode: 'AUTO' // Ensures Gemini will use tools when needed
        }
      } : undefined
    });

    // Build chat history for Gemini
    const chatHistory = [];

    // Add system prompt as first user message (Gemini doesn't have system role in chat)
    chatHistory.push({
      role: 'user',
      parts: [{ text: `SİSTEM TALİMATLARI (bunları kullanıcıya gösterme):\n${systemPrompt}` }]
    });
    chatHistory.push({
      role: 'model',
      parts: [{ text: 'Anladım, bu talimatlara göre davranacağım.' }]
    });

    // Add conversation history (last 10 messages, excluding the one we'll send)
    const recentHistory = history.slice(-10);

    for (const msg of recentHistory) {
      chatHistory.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Start chat with history
    const chat = model.startChat({ history: chatHistory });

    // Token tracking
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // PRE-EMPTIVE TOOL CALL: If user message contains order number or phone number,
    // call the tool BEFORE sending to Gemini to prevent hallucination
    let preemptiveToolResult = null;
    // Order number regex - no trailing \b to allow Turkish suffixes like 'ü, 'yi, 'nu etc.
    // Examples matched: SIP-001, sip001, SIP_002, sip-003'ü, sip003u, SIPARIS-004
    const orderNumberRegex = /\b(SIP|ORD|ORDER|SIPARIS|SPR)[-_]?(\d+)/gi;
    const phoneRegexPattern = /(?:\+?90|0)?[5][0-9]{9}|[5][0-9]{9}/g;

    const orderMatch = orderNumberRegex.exec(userMessage);
    const phoneMatch = userMessage.match(phoneRegexPattern);

    if (orderMatch) {
      // orderMatch[1] = prefix (SIP, ORD, etc), orderMatch[2] = number
      // Normalize to SIP-XXX format for database lookup
      const normalizedOrderNumber = `SIP-${orderMatch[2].padStart(3, '0')}`;
      console.log('🔧 [WhatsApp] PRE-EMPTIVE: Order number detected:', orderMatch[0], '-> normalized:', normalizedOrderNumber);
      preemptiveToolResult = await executeTool('customer_data_lookup', {
        order_number: normalizedOrderNumber,
        query_type: 'siparis'
      }, business, { channel: 'WHATSAPP', sessionId: sessionId, conversationId: sessionId });
      console.log('🔧 [WhatsApp] Pre-emptive result:', preemptiveToolResult.success ? 'SUCCESS' : 'NOT FOUND');
    } else if (phoneMatch) {
      console.log('🔧 [WhatsApp] PRE-EMPTIVE: Phone number detected:', phoneMatch[0]);
      preemptiveToolResult = await executeTool('customer_data_lookup', {
        phone: phoneMatch[0],
        query_type: 'genel'
      }, business, { channel: 'WHATSAPP', sessionId: sessionId, conversationId: sessionId });
      console.log('🔧 [WhatsApp] Pre-emptive result:', preemptiveToolResult.success ? 'SUCCESS' : 'NOT FOUND');
    }

    // Build message with pre-emptive result if available
    let messageToSend = userMessage;
    if (preemptiveToolResult) {
      if (preemptiveToolResult.success) {
        // Kayıt bulundu - doğrulama iste
        messageToSend = `${userMessage}

═══════════════════════════════════════
📊 VERİTABANI SORGU SONUCU (GERÇEK VERİ):
${preemptiveToolResult.message}
═══════════════════════════════════════

⚠️ KRİTİK TALİMATLAR:
1. Yukarıdaki VERİTABANI SONUCU %100 GERÇEK ve DOĞRU veridir
2. Bu veriyi DEĞİŞTİRME, EKLEME yapma, olduğu gibi kullan
3. Müşteriden telefon veya isim ile DOĞRULAMA iste
4. Doğrulama yapılmadan sipariş detayını VERME
5. Asla veri UYDURMA - sadece veritabanındaki bilgiyi kullan`;
      } else {
        // Kayıt bulunamadı - kesinlikle uydurma
        messageToSend = `${userMessage}

═══════════════════════════════════════
❌ VERİTABANI SORGU SONUCU: KAYIT BULUNAMADI
═══════════════════════════════════════

⚠️ KRİTİK TALİMATLAR:
1. Bu sipariş numarası veritabanında MEVCUT DEĞİL
2. Kesinlikle sipariş bilgisi UYDURMA
3. Müşteriye "Bu sipariş numarası sistemimizde bulunamadı" de
4. Sipariş numarasını tekrar kontrol etmesini iste
5. ASLA sahte/hayali sipariş detayı verme`;
      }
    }

    // Add user message to history (before sending to Gemini)
    history.push({
      role: 'user',
      content: userMessage
    });

    // Send user message
    let result = await chat.sendMessage(messageToSend);
    let response = result.response;

    // Track tokens from first response
    if (response.usageMetadata) {
      totalInputTokens += response.usageMetadata.promptTokenCount || 0;
      totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
    }

    // Handle function calls (up to 3 iterations) - same as chat.js
    let iterations = 0;
    const maxIterations = 3;
    let hadFunctionCall = false;

    while (iterations < maxIterations) {
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        break; // No more function calls
      }

      hadFunctionCall = true;

      console.log('🔧 [WhatsApp] Gemini function call:', functionCalls[0].name, functionCalls[0].args);

      // Execute the function
      const functionCall = functionCalls[0];
      const toolResult = await executeTool(functionCall.name, functionCall.args, business, {
        channel: 'WHATSAPP',
        sessionId: sessionId,
        conversationId: sessionId
      });

      console.log('🔧 [WhatsApp] Tool result:', toolResult.success ? 'SUCCESS' : 'FAILED', toolResult.message?.substring(0, 100));

      // Send function response back to Gemini
      result = await chat.sendMessage([
        {
          functionResponse: {
            name: functionCall.name,
            response: {
              success: toolResult.success,
              data: toolResult.data || null,
              message: toolResult.message || toolResult.error || 'Tool executed'
            }
          }
        }
      ]);
      response = result.response;

      // Track tokens from function call response
      if (response.usageMetadata) {
        totalInputTokens += response.usageMetadata.promptTokenCount || 0;
        totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
      }

      iterations++;
    }

    let text = '';
    try {
      text = response.text() || '';
    } catch (e) {
      console.log('⚠️ [WhatsApp] Could not get text from response');
    }

    console.log('📝 [WhatsApp] Final response text:', text?.substring(0, 100));

    // BUGFIX: If Gemini said something like "kontrol ediyorum" but didn't call a tool
    const waitingPhrases = ['kontrol', 'bakıyorum', 'sorguluyorum', 'checking', 'looking', 'bir saniye', 'bir dakika', 'bekleyin', 'lütfen bekle'];
    const isWaitingResponse = waitingPhrases.some(phrase => text.toLowerCase().includes(phrase));

    if (isWaitingResponse && !hadFunctionCall) {
      console.log('⚠️ [WhatsApp] BUGFIX: Gemini said waiting phrase but did NOT call a tool! Calling tool directly...');

      // Extract phone from message or conversation
      let extractedPhone = phoneMatch?.[0];
      if (!extractedPhone && history.length > 0) {
        for (const msg of history.slice().reverse()) {
          const historyMatches = msg.content?.match(phoneRegexPattern);
          if (historyMatches) {
            extractedPhone = historyMatches[0];
            break;
          }
        }
      }

      if (extractedPhone) {
        console.log('🔧 [WhatsApp] DIRECT TOOL CALL with phone:', extractedPhone);

        const toolResult = await executeTool('customer_data_lookup', {
          phone: extractedPhone,
          query_type: 'tum_bilgiler'
        }, business, {
          channel: 'WHATSAPP',
          sessionId: sessionId,
          conversationId: sessionId
        });

        console.log('🔧 [WhatsApp] Direct tool result:', toolResult.success ? 'SUCCESS' : 'FAILED');

        // Send tool result to Gemini to format
        const toolResultPrompt = language === 'TR'
          ? `Müşteri veri sorgulama sonucu:\n${toolResult.message || toolResult.error}\n\nBu bilgiyi müşteriye doğal bir şekilde aktar. "Kontrol ediyorum" DEME.`
          : `Customer data lookup result:\n${toolResult.message || toolResult.error}\n\nShare this information naturally with the customer. Do NOT say "checking".`;

        try {
          result = await chat.sendMessage(toolResultPrompt);
          response = result.response;

          if (response.usageMetadata) {
            totalInputTokens += response.usageMetadata.promptTokenCount || 0;
            totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
          }

          text = response.text() || '';
          console.log('📝 [WhatsApp] Fixed response:', text?.substring(0, 100));
        } catch (formatError) {
          console.error('⚠️ [WhatsApp] Format failed, using raw tool result:', formatError.message);
          text = toolResult.message || toolResult.error || text;
        }
      }
    }

    console.log(`📊 [WhatsApp] Token usage - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

    const finalResponse = text || (language === 'TR'
      ? 'Üzgünüm, bir yanıt oluşturamadım.'
      : 'Sorry, I could not generate a response.');

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: finalResponse
    });

    // Limit history size
    if (history.length > 40) {
      conversations.set(conversationKey, history.slice(-40));
    }

    // Calculate token cost based on plan
    const planName = subscription?.plan || 'FREE';
    const countryCode = business?.country || 'TR';
    const isFree = hasFreeChat(planName);

    let tokenCost = { inputCost: 0, outputCost: 0, totalCost: 0 };
    if (!isFree) {
      tokenCost = calculateTokenCost(totalInputTokens, totalOutputTokens, planName, countryCode);
    }

    console.log(`💰 [WhatsApp] Chat cost: ${tokenCost.totalCost.toFixed(6)} TL (Plan: ${planName}, Free: ${isFree})`);

    // Accumulate tokens
    const accumulatedInputTokens = (existingLog?.inputTokens || 0) + totalInputTokens;
    const accumulatedOutputTokens = (existingLog?.outputTokens || 0) + totalOutputTokens;
    const accumulatedCost = (existingLog?.totalCost || 0) + tokenCost.totalCost;

    // Save/Update ChatLog for analytics with token info
    try {
      await prisma.chatLog.upsert({
        where: { sessionId },
        update: {
          messages: history,
          messageCount: history.length,
          inputTokens: accumulatedInputTokens,
          outputTokens: accumulatedOutputTokens,
          totalCost: accumulatedCost,
          updatedAt: new Date()
        },
        create: {
          sessionId,
          businessId: business.id,
          assistantId: assistant?.id || null,
          channel: 'WHATSAPP',
          customerPhone: phoneNumber,
          messages: history,
          messageCount: history.length,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalCost: tokenCost.totalCost,
          status: 'active'
        }
      });

      // If not free plan, track usage
      if (!isFree && tokenCost.totalCost > 0 && subscription) {
        // For PAYG: deduct from balance
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            balance: {
              decrement: planName === 'PAYG' ? tokenCost.totalCost : 0
            }
          }
        });

        // Create usage record for tracking
        await prisma.usageRecord.create({
          data: {
            subscriptionId: subscription.id,
            channel: 'WHATSAPP',
            conversationId: sessionId,
            durationSeconds: 0,
            durationMinutes: 0,
            chargeType: planName === 'PAYG' ? 'BALANCE' : 'INCLUDED',
            totalCharge: tokenCost.totalCost,
            assistantId: assistant?.id || null,
            metadata: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              inputCost: tokenCost.inputCost,
              outputCost: tokenCost.outputCost
            }
          }
        });
      }
    } catch (logError) {
      console.error('⚠️ Failed to save WhatsApp chat log:', logError.message);
    }

    console.log(`🤖 [WhatsApp] Gemini Response for ${business.name}:`, finalResponse);
    return finalResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    return getErrorMessage(business.language);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build system prompt for the assistant
 * Uses the central promptBuilder service
 */
async function buildSystemPrompt(business, assistant) {
  const language = business?.language || 'TR';
  const timezone = business?.timezone || 'Europe/Istanbul';

  // Get current date/time for this business's timezone
  const dateTimeContext = getDateTimeContext(timezone, language);

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

  // Add KB usage instruction if knowledge base exists
  const kbInstruction = knowledgeContext ? (language === 'TR'
    ? `\n\n## BİLGİ BANKASI KULLANIM KURALLARI
Aşağıdaki bilgi bankası içeriğini AKTİF OLARAK KULLAN:
- Fiyat sorulduğunda: KB'de varsa HEMEN SÖYLE
- Özellik sorulduğunda: KB'de varsa SÖYLE
- KB'de bilgi VARSA doğrudan paylaş`
    : `\n\n## KNOWLEDGE BASE USAGE
ACTIVELY USE the knowledge base content below when answering questions.`)
    : '';

  return `${dateTimeContext}

${basePrompt}${kbInstruction}
${knowledgeContext}`;
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
 * Falls back to env credentials if business._useEnvCredentials is set
 */
async function sendWhatsAppMessage(business, to, text) {
  try {
    let accessToken, phoneNumberId;

    // Check if we should use env credentials (fallback for testing)
    if (business._useEnvCredentials) {
      console.log('📱 Using env credentials for WhatsApp message');
      accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    } else {
      accessToken = decrypt(business.whatsappAccessToken);
      phoneNumberId = business.whatsappPhoneNumberId;
    }

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

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

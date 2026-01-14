/**
 * Chat Widget API
 * Handles text-based chat for embedded widget
 * Using Google Gemini API with function calling
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';
import { isFreePlanExpired } from '../middleware/checkPlanExpiry.js';
import { getActiveTools, executeTool } from '../tools/index.js';
import { calculateTokenCost, hasFreeChat } from '../config/plans.js';

const router = express.Router();
const prisma = new PrismaClient();

// Lazy initialization for Gemini
let genAI = null;
const getGemini = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

/**
 * Convert tool definitions to Gemini function declarations format
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

/**
 * Process chat with Gemini - with function calling support
 * Returns: { reply: string, inputTokens: number, outputTokens: number }
 */
async function processWithGemini(systemPrompt, conversationHistory, userMessage, language, business) {
  const genAI = getGemini();

  // Get available tools for this business
  const tools = getActiveTools(business);
  const geminiFunctions = convertToolsToGeminiFunctions(tools);

  console.log('🔧 Chat tools available:', geminiFunctions.map(f => f.name));

  // Configure model with function calling
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1500,
    },
    tools: geminiFunctions.length > 0 ? [{
      functionDeclarations: geminiFunctions
    }] : undefined
  });

  // Build conversation history for Gemini
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

  // Add conversation history
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    chatHistory.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  // Start chat
  const chat = model.startChat({ history: chatHistory });

  // Token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Send user message
  let result = await chat.sendMessage(userMessage);
  let response = result.response;

  // Track tokens from first response
  if (response.usageMetadata) {
    totalInputTokens += response.usageMetadata.promptTokenCount || 0;
    totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
  }

  // Handle function calls (up to 3 iterations)
  let iterations = 0;
  const maxIterations = 3;

  while (iterations < maxIterations) {
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      break; // No more function calls
    }

    console.log('🔧 Gemini function call:', functionCalls[0].name, functionCalls[0].args);

    // Execute the function
    const functionCall = functionCalls[0];
    const toolResult = await executeTool(functionCall.name, functionCall.args, business, {
      channel: 'CHAT',
      conversationId: null
    });

    console.log('🔧 Tool result:', toolResult.success ? 'SUCCESS' : 'FAILED', toolResult.message?.substring(0, 100));

    // Send function response back to Gemini
    result = await chat.sendMessage([{
      functionResponse: {
        name: functionCall.name,
        response: {
          success: toolResult.success,
          data: toolResult.data || null,
          message: toolResult.message || toolResult.error || 'Tool executed'
        }
      }
    }]);
    response = result.response;

    // Track tokens from function call response
    if (response.usageMetadata) {
      totalInputTokens += response.usageMetadata.promptTokenCount || 0;
      totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
    }

    iterations++;
  }

  const text = response.text();

  console.log(`📊 Token usage - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

  return {
    reply: text || (language === 'TR'
      ? 'Üzgünüm, bir yanıt oluşturamadım.'
      : 'Sorry, I could not generate a response.'),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens
  };
}

// POST /api/chat/widget - Public endpoint for widget
router.post('/widget', async (req, res) => {
  console.log('📨 Chat request received:', {
    body: req.body,
    businessId: req.businessId,
    headers: req.headers.authorization ? 'Auth present' : 'No auth'
  });
  try {
    const { embedKey, assistantId, sessionId, message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!embedKey && !assistantId) {
      return res.status(400).json({ error: 'embedKey or assistantId is required' });
    }

    // Generate session ID if not provided
    const chatSessionId = sessionId || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let assistant;

    // New way: Use embedKey to find business and its inbound assistant
    if (embedKey) {
      const business = await prisma.business.findUnique({
        where: { chatEmbedKey: embedKey },
        include: {
          assistants: {
            where: {
              isActive: true,
              callDirection: 'inbound'
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          integrations: {
            where: { isActive: true }
          }
        }
      });

      if (!business) {
        return res.status(404).json({ error: 'Invalid embed key' });
      }

      // Check if widget is enabled by business owner
      if (!business.chatWidgetEnabled) {
        return res.status(403).json({ error: 'Chat widget is disabled for this business' });
      }

      if (!business.assistants || business.assistants.length === 0) {
        return res.status(404).json({ error: 'No active assistant found for this business' });
      }

      assistant = {
        ...business.assistants[0],
        business: business
      };
    } else {
      // Legacy way: Use assistantId directly (backward compatibility)
      assistant = await prisma.assistant.findFirst({
        where: {
          OR: [
            { id: assistantId },
            { vapiAssistantId: assistantId }
          ]
        },
        include: {
          business: {
            include: {
              integrations: {
                where: { isActive: true }
              }
            },
          }
        }
      });
    }

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const business = assistant.business;
    const language = business?.language || 'TR';
    const timezone = business?.timezone || 'Europe/Istanbul';

    // Get current date/time for this business's timezone
    const dateTimeContext = getDateTimeContext(timezone, language);

    // Check subscription and plan expiry
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id },
      include: { business: true }
    });

    if (subscription && isFreePlanExpired(subscription)) {
      console.log(`🚫 Chat blocked - FREE plan expired for business ${business.id}`);
      return res.status(403).json({
        error: language === 'TR'
          ? 'Deneme süreniz doldu. Hizmete devam etmek için lütfen bir plan seçin.'
          : 'Your trial has expired. Please choose a plan to continue.',
        expired: true
      });
    }

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
          kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 100000)}`);
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

      console.log(`📚 [Chat] Knowledge Base items added: ${knowledgeItems.length}`);
    }

    // Get active tools list for prompt builder
    const activeToolsList = getPromptBuilderTools(business, business.integrations || []);

    // Build system prompt using central prompt builder
    const systemPromptBase = buildAssistantPrompt(assistant, business, activeToolsList);

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

    // Build full system prompt
    const fullSystemPrompt = `${dateTimeContext}

${systemPromptBase}${kbInstruction}
${knowledgeContext}`;

    console.log('📝 [Chat] Full system prompt length:', fullSystemPrompt.length, 'chars');
    console.log('🤖 [Chat] Using Gemini model');

    // Process with Gemini (with function calling support)
    const result = await processWithGemini(fullSystemPrompt, conversationHistory, message, language, business);

    // Human-like delay: reading + typing time
    // 1. Reading delay: 1-2 seconds (before typing starts)
    // 2. Typing delay: based on response length
    const replyLength = result.reply?.length || 0;
    const readingDelay = 1000 + Math.random() * 1000; // 1-2 seconds
    const typingDelay = Math.min(Math.max(replyLength * 20, 500), 6000); // 500ms-6s based on length
    const totalDelay = readingDelay + typingDelay;
    console.log(`⏱️ Total delay: ${Math.round(totalDelay)}ms (read: ${Math.round(readingDelay)}ms + type: ${Math.round(typingDelay)}ms for ${replyLength} chars)`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));

    // Calculate token cost based on plan
    const planName = subscription?.plan || 'FREE';
    const countryCode = business?.country || 'TR';
    const isFree = hasFreeChat(planName);

    let tokenCost = { inputCost: 0, outputCost: 0, totalCost: 0 };
    if (!isFree) {
      tokenCost = calculateTokenCost(
        result.inputTokens,
        result.outputTokens,
        planName,
        countryCode
      );
    }

    console.log(`💰 Chat cost: ${tokenCost.totalCost.toFixed(6)} TL (Plan: ${planName}, Free: ${isFree})`);

    // Save chat log (upsert - create or update with token info)
    try {
      const updatedMessages = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }
      ];

      // Get existing chat log to accumulate tokens
      const existingLog = await prisma.chatLog.findUnique({
        where: { sessionId: chatSessionId },
        select: { inputTokens: true, outputTokens: true, totalCost: true }
      });

      const accumulatedInputTokens = (existingLog?.inputTokens || 0) + result.inputTokens;
      const accumulatedOutputTokens = (existingLog?.outputTokens || 0) + result.outputTokens;
      const accumulatedCost = (existingLog?.totalCost || 0) + tokenCost.totalCost;

      await prisma.chatLog.upsert({
        where: { sessionId: chatSessionId },
        create: {
          sessionId: chatSessionId,
          businessId: business.id,
          assistantId: assistant.id,
          messageCount: updatedMessages.length,
          messages: updatedMessages,
          status: 'active',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalCost: tokenCost.totalCost
        },
        update: {
          messageCount: updatedMessages.length,
          messages: updatedMessages,
          inputTokens: accumulatedInputTokens,
          outputTokens: accumulatedOutputTokens,
          totalCost: accumulatedCost,
          updatedAt: new Date()
        }
      });

      // If not free plan, deduct from balance (PAYG) or track for billing
      if (!isFree && tokenCost.totalCost > 0 && subscription) {
        // For PAYG: deduct from balance
        // For STARTER/PRO: track as usage (will be billed if over included amount)
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
            channel: 'CHAT',
            conversationId: chatSessionId,
            durationSeconds: 0,
            durationMinutes: 0,
            chargeType: planName === 'PAYG' ? 'BALANCE' : 'INCLUDED',
            totalCharge: tokenCost.totalCost,
            assistantId: assistant.id,
            metadata: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              inputCost: tokenCost.inputCost,
              outputCost: tokenCost.outputCost
            }
          }
        });
      }
    } catch (logError) {
      console.error('Failed to save chat log:', logError);
    }

    res.json({
      success: true,
      reply: result.reply,
      sessionId: chatSessionId,
      assistantName: assistant.name
    });

  } catch (error) {
    console.error('Chat widget error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// GET /api/chat/assistant/:assistantId
router.get('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    const assistant = await prisma.assistant.findFirst({
      where: {
        OR: [
          { id: assistantId },
          { vapiAssistantId: assistantId }
        ]
      },
      select: {
        name: true,
        business: {
          select: { name: true }
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json({
      name: assistant.name,
      businessName: assistant.business?.name || ''
    });

  } catch (error) {
    console.error('Get assistant error:', error);
    res.status(500).json({ error: 'Failed to get assistant info' });
  }
});

// GET /api/chat/embed/:embedKey - Get business info by embed key
router.get('/embed/:embedKey', async (req, res) => {
  try {
    const { embedKey } = req.params;

    const business = await prisma.business.findUnique({
      where: { chatEmbedKey: embedKey },
      include: {
        assistants: {
          where: {
            isActive: true,
            callDirection: 'inbound'
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { name: true }
        }
      }
    });

    if (!business) {
      return res.status(404).json({ error: 'Invalid embed key' });
    }

    if (!business.assistants || business.assistants.length === 0) {
      return res.status(404).json({ error: 'No active assistant found' });
    }

    res.json({
      name: business.assistants[0].name,
      businessName: business.name
    });

  } catch (error) {
    console.error('Get embed info error:', error);
    res.status(500).json({ error: 'Failed to get embed info' });
  }
});

// GET /api/chat/widget/status/:assistantId - Check if widget should be active
router.get('/widget/status/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    const assistant = await prisma.assistant.findFirst({
      where: {
        OR: [
          { id: assistantId },
          { vapiAssistantId: assistantId }
        ]
      },
      include: {
        business: true
      }
    });

    if (!assistant) {
      return res.json({ active: false, reason: 'not_found' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: assistant.business.id },
      include: { business: true }
    });

    if (!subscription) {
      return res.json({ active: false, reason: 'no_subscription' });
    }

    if (isFreePlanExpired(subscription)) {
      return res.json({ active: false, reason: 'trial_expired' });
    }

    res.json({
      active: true,
      assistantName: assistant.name,
      businessName: assistant.business?.name
    });

  } catch (error) {
    console.error('Widget status error:', error);
    res.json({ active: false, reason: 'error' });
  }
});

// GET /api/chat/widget/status/embed/:embedKey - Check if widget should be active by embed key
router.get('/widget/status/embed/:embedKey', async (req, res) => {
  try {
    const { embedKey } = req.params;

    const business = await prisma.business.findUnique({
      where: { chatEmbedKey: embedKey },
      include: {
        assistants: {
          where: {
            isActive: true,
            callDirection: 'inbound'
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!business) {
      return res.json({ active: false, reason: 'invalid_embed_key' });
    }

    if (!business.chatWidgetEnabled) {
      return res.json({ active: false, reason: 'widget_disabled' });
    }

    if (!business.assistants || business.assistants.length === 0) {
      return res.json({ active: false, reason: 'no_assistant' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id }
    });

    if (!subscription) {
      return res.json({ active: false, reason: 'no_subscription' });
    }

    if (isFreePlanExpired(subscription)) {
      return res.json({ active: false, reason: 'trial_expired' });
    }

    res.json({
      active: true,
      assistantName: business.assistants[0].name,
      businessName: business.name
    });

  } catch (error) {
    console.error('Widget status by embed key error:', error);
    res.json({ active: false, reason: 'error' });
  }
});

// POST /api/chat/widget/end-session - End a chat session
router.post('/widget/end-session', async (req, res) => {
  try {
    const { sessionId, embedKey } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Find the chat log
    const chatLog = await prisma.chatLog.findFirst({
      where: { sessionId }
    });

    if (!chatLog) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update status to ended
    await prisma.chatLog.update({
      where: { id: chatLog.id },
      data: {
        status: 'ended',
        updatedAt: new Date()
      }
    });

    console.log(`📝 Chat session ended: ${sessionId}`);
    res.json({ success: true, message: 'Session ended' });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

export default router;

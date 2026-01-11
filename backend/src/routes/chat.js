/**
 * Chat Widget API
 * Handles text-based chat for embedded widget
 * Using Google Gemini API
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';
import { isFreePlanExpired } from '../middleware/checkPlanExpiry.js';

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
 * Process chat with Gemini
 */
async function processWithGemini(systemPrompt, conversationHistory, userMessage, language) {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 500,
    }
  });

  // Build conversation context as a single prompt
  // Gemini works better with context in the message itself for long system prompts
  let contextMessages = '';
  const recentHistory = conversationHistory.slice(-10);

  if (recentHistory.length > 0) {
    contextMessages = '\n\nÖNCEKİ KONUŞMA:\n' + recentHistory.map(msg =>
      `${msg.role === 'user' ? 'Müşteri' : 'Asistan'}: ${msg.content}`
    ).join('\n');
  }

  // Combine system prompt + history + user message
  const fullPrompt = `${systemPrompt}${contextMessages}

Müşteri: ${userMessage}

Asistan:`;

  // Use generateContent for better handling of long prompts
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  return {
    reply: text || (language === 'TR'
      ? 'Üzgünüm, bir yanıt oluşturamadım.'
      : 'Sorry, I could not generate a response.')
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

    // Process with Gemini
    const result = await processWithGemini(fullSystemPrompt, conversationHistory, message, language);

    // Human-like delay: reading + typing time
    // 1. Reading delay: 1-2 seconds (before typing starts)
    // 2. Typing delay: based on response length
    const replyLength = result.reply?.length || 0;
    const readingDelay = 1000 + Math.random() * 1000; // 1-2 seconds
    const typingDelay = Math.min(Math.max(replyLength * 20, 500), 6000); // 500ms-6s based on length
    const totalDelay = readingDelay + typingDelay;
    console.log(`⏱️ Total delay: ${Math.round(totalDelay)}ms (read: ${Math.round(readingDelay)}ms + type: ${Math.round(typingDelay)}ms for ${replyLength} chars)`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));

    // Save chat log (upsert - create or update)
    try {
      const updatedMessages = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }
      ];

      await prisma.chatLog.upsert({
        where: { sessionId: chatSessionId },
        create: {
          sessionId: chatSessionId,
          businessId: business.id,
          assistantId: assistant.id,
          messageCount: updatedMessages.length,
          messages: updatedMessages,
          status: 'active'
        },
        update: {
          messageCount: updatedMessages.length,
          messages: updatedMessages,
          updatedAt: new Date()
        }
      });
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

export default router;

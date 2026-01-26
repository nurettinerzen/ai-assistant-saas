/**
 * create_callback Tool Handler
 * Geri arama kaydı oluşturur.
 */

import { PrismaClient } from '@prisma/client';
import { ok, validationError, systemError } from '../toolResult.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Normalize topic for duplicate detection
 * Removes common punctuation, lowercases, trims
 */
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[.,!?;:\-]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Generate hash from normalized topic
 */
function generateTopicHash(topic) {
  const normalized = normalizeTopic(topic);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Generate topic from conversation context (deterministic)
 * Extracts key information from state and recent messages
 */
function generateTopicFromContext(context, language) {
  const state = context.state || {};
  const extractedSlots = state.extractedSlots || {};

  // Build topic from available context
  const topicParts = [];

  // 1. Check for order-related context
  if (extractedSlots.order_number) {
    topicParts.push(
      language === 'TR'
        ? `Sipariş ${extractedSlots.order_number}`
        : `Order ${extractedSlots.order_number}`
    );
  }

  // 2. Check for complaint/issue indicators
  const complaintIndicators = [
    'teslim almadım', 'gelmedi', 'ulaşmadı', 'problem', 'sorun',
    'şikayet', 'itiraz', 'yanlış', 'hatalı', 'eksik'
  ];

  const recentMessages = context.conversationHistory?.slice(-6) || [];
  const hasComplaint = recentMessages.some(msg =>
    msg.role === 'user' && complaintIndicators.some(indicator =>
      msg.content?.toLowerCase().includes(indicator)
    )
  );

  if (hasComplaint) {
    topicParts.push(
      language === 'TR' ? 'hakkında sorun' : 'issue'
    );
  }

  // 3. Check for callback/manager request
  const callbackIndicators = ['yönetici', 'yetkili', 'geri ara', 'ara beni', 'callback'];
  const hasCallbackRequest = recentMessages.some(msg =>
    msg.role === 'user' && callbackIndicators.some(indicator =>
      msg.content?.toLowerCase().includes(indicator)
    )
  );

  if (hasCallbackRequest && topicParts.length === 0) {
    topicParts.push(
      language === 'TR' ? 'Genel görüşme talebi' : 'General inquiry'
    );
  }

  // 4. Fallback: Use last user message snippet
  if (topicParts.length === 0) {
    const lastUserMessage = recentMessages
      .filter(msg => msg.role === 'user')
      .pop();

    if (lastUserMessage?.content) {
      const snippet = lastUserMessage.content.substring(0, 50);
      topicParts.push(snippet);
    } else {
      topicParts.push(
        language === 'TR' ? 'Müşteri talebi' : 'Customer request'
      );
    }
  }

  return topicParts.join(' - ');
}

export default {
  name: 'create_callback',

  async execute(args, business, context = {}) {
    try {
      let { customerName, customerPhone, topic, priority = 'NORMAL' } = args;
      const language = business.language || 'TR';

      // Validate required fields (topic is optional, will auto-generate)
      if (!customerName || !customerPhone) {
        const missing = [
          !customerName && 'customerName',
          !customerPhone && 'customerPhone'
        ].filter(Boolean);

        return validationError(
          language === 'TR'
            ? `Eksik bilgi: ${missing.join(', ')}`
            : `Missing information: ${missing.join(', ')}`,
          missing.join(', ')
        );
      }

      // AUTO-GENERATE TOPIC: If not provided, infer from conversation context
      if (!topic || topic.trim().length === 0) {
        topic = generateTopicFromContext(context, language);
        console.log(`🔧 [create_callback] Auto-generated topic: "${topic}"`);
      }

      // Ensure topic is not too long (max 160 chars for readability)
      if (topic.length > 160) {
        topic = topic.substring(0, 157) + '...';
      }

      // Generate topic hash for duplicate detection
      const topicHash = generateTopicHash(topic);

      // DUPLICATE GUARD: Check for recent callback with same phone + topic hash
      // Time window: 15 minutes
      // Uses composite index: [customerPhone, topicHash, requestedAt]
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const recentCallback = await prisma.callbackRequest.findFirst({
        where: {
          businessId: business.id,
          customerPhone,
          topicHash, // Use hash in query for index performance
          status: 'PENDING',
          requestedAt: {
            gte: fifteenMinutesAgo
          }
        },
        orderBy: {
          requestedAt: 'desc'
        }
      });

      if (recentCallback) {
        console.log(`🔒 [create_callback] Duplicate detected: ${recentCallback.id} (same phone + topic within 15min)`);

        return ok(
          { callbackId: recentCallback.id, status: 'PENDING', isDuplicate: true },
          language === 'TR'
            ? `Talebiniz zaten kaydedildi. Yeni bir kayıt açmadım. ${customerName} en kısa sürede aranacak.`
            : `Your request is already registered. I did not create a new record. ${customerName} will be called back shortly.`
        );
      }

      // Priority validasyonu
      const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
      const finalPriority = validPriorities.includes(priority) ? priority : 'NORMAL';

      // Callback oluştur
      const callback = await prisma.callbackRequest.create({
        data: {
          businessId: business.id,
          assistantId: context.assistantId || null,
          callId: context.conversationId || null,
          customerName,
          customerPhone,
          topic,
          topicHash, // Store hash for future duplicate detection
          priority: finalPriority
        }
      });

      console.log(`✅ Callback created via tool: ${callback.id} for business ${business.id}`);

      return ok(
        { callbackId: callback.id, status: 'PENDING' },
        language === 'TR'
          ? `Geri arama kaydı oluşturuldu. ${customerName} en kısa sürede aranacak.`
          : `Callback request created. ${customerName} will be called back shortly.`
      );

    } catch (error) {
      console.error('❌ create_callback error:', error);
      return systemError(
        business.language === 'TR'
          ? 'Geri arama kaydı oluşturulamadı. Lütfen tekrar deneyin.'
          : 'Could not create callback request. Please try again.',
        error
      );
    }
  }
};

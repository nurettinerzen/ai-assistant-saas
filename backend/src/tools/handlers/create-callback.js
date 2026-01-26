/**
 * create_callback Tool Handler
 * Geri arama kaydı oluşturur.
 */

import { PrismaClient } from '@prisma/client';
import { ok, validationError, systemError } from '../toolResult.js';

const prisma = new PrismaClient();

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

  const recentMessages = context.conversationHistory?.slice(-5) || [];
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

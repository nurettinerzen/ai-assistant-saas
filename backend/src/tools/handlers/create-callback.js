/**
 * create_callback Tool Handler
 * Geri arama kaydı oluşturur.
 */

import { PrismaClient } from '@prisma/client';
import { ok, validationError, systemError } from '../toolResult.js';

const prisma = new PrismaClient();

export default {
  name: 'create_callback',

  async execute(args, business, context = {}) {
    try {
      const { customerName, customerPhone, topic, priority = 'NORMAL' } = args;
      const language = business.language || 'TR';

      // Validasyon
      if (!customerName || !customerPhone || !topic) {
        const missing = [
          !customerName && 'customerName',
          !customerPhone && 'customerPhone',
          !topic && 'topic'
        ].filter(Boolean);

        return validationError(
          language === 'TR'
            ? `Eksik bilgi: ${missing.join(', ')}`
            : `Missing information: ${missing.join(', ')}`,
          missing.join(', ')
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

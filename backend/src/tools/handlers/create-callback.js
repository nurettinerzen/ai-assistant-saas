/**
 * create_callback Tool Handler
 *
 * Geri arama kaydı oluşturur.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default {
  name: 'create_callback',

  /**
   * Execute callback creation
   * @param {Object} args - Tool arguments
   * @param {string} args.customerName - Müşteri adı
   * @param {string} args.customerPhone - Müşteri telefon numarası
   * @param {string} args.topic - Görüşme konusu
   * @param {string} args.priority - Öncelik (LOW, NORMAL, HIGH, URGENT)
   * @param {Object} business - Business object
   * @param {Object} context - Execution context
   * @returns {Object} - Result with success, message
   */
  async execute(args, business, context = {}) {
    try {
      const { customerName, customerPhone, topic, priority = 'NORMAL' } = args;

      // Validasyon
      if (!customerName || !customerPhone || !topic) {
        return {
          success: false,
          error: business.language === 'TR'
            ? 'Müşteri adı, telefon numarası ve konu zorunludur.'
            : 'Customer name, phone number and topic are required.'
        };
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

      // TODO: İşletmeye bildirim gönder (email/push notification)

      return {
        success: true,
        data: {
          callbackId: callback.id,
          status: 'PENDING'
        },
        message: business.language === 'TR'
          ? `Geri arama kaydı oluşturuldu. ${customerName} en kısa sürede aranacak.`
          : `Callback request created. ${customerName} will be called back shortly.`
      };
    } catch (error) {
      console.error('❌ create_callback error:', error);
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Geri arama kaydı oluşturulurken bir hata oluştu.'
          : 'An error occurred while creating the callback request.'
      };
    }
  }
};

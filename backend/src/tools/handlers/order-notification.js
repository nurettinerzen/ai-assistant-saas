/**
 * Order Notification Handler
 * Sends order notification to business owner via SMS/WhatsApp
 */

import { PrismaClient } from '@prisma/client';
import netgsmService from '../../services/netgsm.js';
import whatsappService from '../../services/whatsapp.js';

const prisma = new PrismaClient();

/**
 * Format order notification message
 */
function formatOrderNotification(orderData, language = 'TR') {
  const { customerName, customerPhone, orderItems } = orderData;

  if (language === 'TR') {
    return `🛒 Yeni Sipariş Bildirimi

👤 Müşteri: ${customerName}
📞 Telefon: ${customerPhone}

📦 Sipariş Detayı:
${orderItems}

Sipariş alındı ve işleme alınıyor.`;
  } else {
    return `🛒 New Order Notification

👤 Customer: ${customerName}
📞 Phone: ${customerPhone}

📦 Order Details:
${orderItems}

Order received and processing.`;
  }
}

/**
 * Execute order notification
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { customer_name, customer_phone, order_items } = args;

    console.log('📦 Sending order notification:', { customer_name, customer_phone, order_items });

    // Validate required parameters
    if (!customer_name || !customer_phone || !order_items) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Eksik parametreler: müşteri adı, telefon ve sipariş detayları gerekli.'
          : 'Missing required parameters: customer_name, customer_phone, and order_items are required'
      };
    }

    // Get business owner's contact info
    const ownerPhone = business.phoneNumbers?.[0];

    if (!ownerPhone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'İşletme sahibinin telefon numarası tanımlanmamış.'
          : 'Business owner phone number not configured'
      };
    }

    // Format notification message
    const notificationMessage = formatOrderNotification(
      {
        customerName: customer_name,
        customerPhone: customer_phone,
        orderItems: order_items
      },
      business.language
    );

    // Check if business prefers WhatsApp or SMS
    const whatsappIntegration = business.integrations?.find(
      i => i.type === 'WHATSAPP' && i.isActive
    );

    let notificationSent = false;

    if (whatsappIntegration) {
      // Send via WhatsApp
      try {
        const { accessToken, phoneNumberId } = whatsappIntegration.credentials;
        await whatsappService.sendMessage(
          accessToken,
          phoneNumberId,
          ownerPhone,
          notificationMessage
        );
        notificationSent = true;
        console.log('✅ WhatsApp notification sent');
      } catch (whatsappError) {
        console.error('⚠️ WhatsApp failed, falling back to SMS:', whatsappError);
      }
    }

    // If WhatsApp not available or failed, send SMS
    if (!notificationSent) {
      try {
        await netgsmService.sendSMS(ownerPhone, notificationMessage);
        console.log('✅ SMS notification sent');
        notificationSent = true;
      } catch (smsError) {
        console.error('❌ SMS notification also failed:', smsError);
      }
    }

    // Return result
    const successMessage = business.language === 'TR'
      ? `Siparişiniz alındı. İşletme sahibine bildirim gönderildi. En kısa sürede sizinle iletişime geçilecek.`
      : `Your order has been received. Notification sent to business owner. They will contact you shortly.`;

    return {
      success: true,
      data: {
        notificationSent
      },
      message: successMessage
    };

  } catch (error) {
    console.error('❌ Send order notification error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Sipariş bildirimi gönderilirken bir hata oluştu. Lütfen tekrar deneyin.'
        : 'Failed to send order notification. Please try again.'
    };
  }
}

export default { execute };

/**
 * CRM Order Status Handler
 * Checks order status from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';

/**
 * Execute CRM order status check
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { order_number, phone } = args;

    console.log('🔍 CRM: Checking order status:', { order_number, phone });

    // Validate - at least one parameter required
    if (!order_number && !phone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Sipariş numarası veya telefon numarası gerekli.'
          : 'Order number or phone number required.'
      };
    }

    // Normalize phone if provided
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Build query
    const whereClause = {
      businessId: business.id
    };

    if (order_number && normalizedPhone) {
      whereClause.OR = [
        { orderNumber: order_number },
        { customerPhone: normalizedPhone }
      ];
    } else if (order_number) {
      whereClause.orderNumber = order_number;
    } else if (normalizedPhone) {
      whereClause.customerPhone = normalizedPhone;
    }

    // Search for order
    const order = await prisma.crmOrder.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    if (!order) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Sipariş bulunamadı. Lütfen sipariş numaranızı kontrol edin.'
          : 'Order not found. Please check your order number.'
      };
    }

    console.log(`✅ CRM Order found: ${order.orderNumber}`);

    // Format response
    const statusText = translateOrderStatus(order.status, business.language);
    const responseMessage = formatOrderMessage(order, statusText, business.language);

    return {
      success: true,
      data: {
        order_number: order.orderNumber,
        status: statusText,
        status_raw: order.status,
        tracking_number: order.trackingNumber,
        carrier: order.carrier,
        items: order.items,
        total_amount: order.totalAmount,
        estimated_delivery: order.estimatedDelivery,
        last_update: order.externalUpdatedAt
      },
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ CRM order lookup error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Sipariş sorgulanırken bir hata oluştu.'
        : 'An error occurred while checking order.'
    };
  }
}

// Normalize phone number
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.startsWith('90') && digits.length > 10) digits = digits.substring(2);
  return digits;
}

// Translate order status
function translateOrderStatus(status, language) {
  if (language !== 'TR') return status;

  const statusMap = {
    'pending': 'Beklemede',
    'processing': 'Hazırlanıyor',
    'shipped': 'Kargoya Verildi',
    'in_transit': 'Yolda',
    'out_for_delivery': 'Dağıtımda',
    'delivered': 'Teslim Edildi',
    'cancelled': 'İptal Edildi',
    'returned': 'İade Edildi',
    'refunded': 'İade Yapıldı',
    // Turkish status values
    'hazirlanıyor': 'Hazırlanıyor',
    'hazirlaniyor': 'Hazırlanıyor',
    'kargoda': 'Kargoya Verildi',
    'kargoya_verildi': 'Kargoya Verildi',
    'teslim_edildi': 'Teslim Edildi',
    'iptal': 'İptal Edildi',
    'iade': 'İade Edildi'
  };

  return statusMap[status?.toLowerCase()] || status;
}

// Format order message
function formatOrderMessage(order, statusText, language) {
  if (language === 'TR') {
    let message = `${order.orderNumber} numaralı siparişinizin durumu: ${statusText}.`;

    if (order.trackingNumber) {
      message += ` Kargo takip numaranız: ${order.trackingNumber}`;
      if (order.carrier) {
        message += ` (${order.carrier})`;
      }
      message += '.';
    }

    if (order.estimatedDelivery) {
      const date = new Date(order.estimatedDelivery);
      message += ` Tahmini teslimat: ${date.toLocaleDateString('tr-TR')}.`;
    }

    return message;
  }

  let message = `Order ${order.orderNumber} status: ${statusText}.`;

  if (order.trackingNumber) {
    message += ` Tracking number: ${order.trackingNumber}`;
    if (order.carrier) {
      message += ` (${order.carrier})`;
    }
    message += '.';
  }

  if (order.estimatedDelivery) {
    const date = new Date(order.estimatedDelivery);
    message += ` Estimated delivery: ${date.toLocaleDateString('en-US')}.`;
  }

  return message;
}

export default { execute };

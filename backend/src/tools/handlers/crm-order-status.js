/**
 * CRM Order Status Handler
 * Checks order status from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError } from '../toolResult.js';
import { normalizePhone as normalizePhoneUtil } from '../../utils/text.js';

/**
 * Execute CRM order status check
 */
export async function execute(args, business, context = {}) {
  try {
    const { order_number, phone } = args;
    const language = business.language || 'TR';

    console.log('🔍 CRM: Checking order status:', { order_number, phone });

    // Validate - at least one parameter required
    if (!order_number && !phone) {
      return validationError(
        language === 'TR'
          ? 'Sipariş numarası veya telefon numarası gerekli.'
          : 'Order number or phone number is required.',
        'order_number | phone'
      );
    }

    // Normalize phone if provided
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Build query
    const whereClause = { businessId: business.id };

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
      return notFound(
        language === 'TR'
          ? `${order_number || normalizedPhone} için sipariş bulunamadı.`
          : `Order not found for ${order_number || normalizedPhone}.`
      );
    }

    console.log(`✅ CRM Order found: ${order.orderNumber}`);

    // Format response
    const statusText = translateOrderStatus(order.status, language);
    const responseMessage = formatOrderMessage(order, statusText, language);

    return ok({
      order_number: order.orderNumber,
      status: statusText,
      status_raw: order.status,
      tracking_number: order.trackingNumber,
      carrier: order.carrier,
      items: order.items,
      total_amount: order.totalAmount,
      estimated_delivery: order.estimatedDelivery,
      last_update: order.externalUpdatedAt
    }, responseMessage);

  } catch (error) {
    console.error('❌ CRM order lookup error:', error);
    return systemError(
      business.language === 'TR'
        ? 'Sipariş sorgusunda sistem hatası oluştu.'
        : 'System error during order query.',
      error
    );
  }
}

// P1 Fix: Use centralized phone normalization for consistency
// This ensures CRM search uses same format as stored data
function normalizePhone(phone) {
  if (!phone) return '';
  // Use central utility that normalizes to E.164 format
  return normalizePhoneUtil(phone);
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

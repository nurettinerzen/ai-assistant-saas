/**
 * Order Status Handler
 * Checks order status via E-commerce Aggregator (Shopify, WooCommerce)
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';

/**
 * Execute order status check
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { order_number, customer_phone, customer_email } = args;

    console.log('🔍 Checking order status:', { order_number, customer_phone, customer_email });

    // Validate - at least one parameter required
    if (!order_number && !customer_phone && !customer_email) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Sipariş numarası, telefon numarası veya e-posta gerekli. Lütfen birini belirtin.'
          : 'Order number, phone number, or email required. Please provide at least one.'
      };
    }

    // Use aggregator to search across platforms
    const result = await ecommerceAggregator.searchOrder(business.id, {
      orderNumber: order_number,
      phone: customer_phone,
      email: customer_email
    });

    // Handle not found / no platform
    if (!result.success) {
      if (result.code === 'NO_PLATFORM') {
        return {
          success: false,
          error: business.language === 'TR'
            ? 'E-ticaret platformu bağlı değil.'
            : 'No e-commerce platform connected.'
        };
      }

      return {
        success: false,
        error: result.error || (business.language === 'TR'
          ? 'Sipariş bulunamadı. Lütfen sipariş numaranızı veya telefon numaranızı kontrol edin.'
          : 'Order not found. Please check your order number or phone number.')
      };
    }

    const order = result.order;
    console.log(`✅ Order found from ${order.platform}: ${order.orderNumber}`);

    // Format response message using aggregator helper
    const responseMessage = ecommerceAggregator.formatOrderStatus(order, business.language);

    return {
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        statusText: order.statusText,
        totalPrice: order.totalPrice,
        currency: order.currency,
        tracking: order.tracking,
        items: order.items?.map(i => i.title).join(', '),
        platform: order.platform
      },
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ Check order status error:', error);

    return {
      success: false,
      error: business.language === 'TR'
        ? 'Sipariş sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        : 'An error occurred while checking order. Please try again later.'
    };
  }
}

export default { execute };

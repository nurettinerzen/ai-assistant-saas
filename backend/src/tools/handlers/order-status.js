/**
 * Order Status Handler
 * Checks order status with PRIORITY SYSTEM
 *
 * DATA SOURCE PRIORITY:
 * 1. App Integrations (Shopify, WooCommerce, etc.) - via ecommerce-aggregator
 * 2. CustomerData (Excel/CSV) - If app integration doesn't find it, falls back to customer_data_lookup
 * 3. Google Sheets - Future
 *
 * IMPORTANT: This tool checks ONLY App Integrations.
 * If not found, AI should use customer_data_lookup tool to check Excel/CSV data.
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
    const { order_number, customer_phone, customer_email, customer_name } = args;

    console.log('🔍 Checking order status in App Integrations:', { order_number, customer_phone, customer_email, customer_name });

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
        // No app integration - tell AI to use customer_data_lookup instead
        const instruction = business.language === 'TR'
          ? '\n\n[TALİMAT: E-ticaret platformu bağlı değil. customer_data_lookup aracını kullan.]'
          : '\n\n[INSTRUCTION: No e-commerce platform connected. Use customer_data_lookup tool instead.]';

        return {
          success: false,
          error: (business.language === 'TR'
            ? 'E-ticaret platformu bağlı değil.'
            : 'No e-commerce platform connected.') + instruction,
          code: 'NO_PLATFORM'
        };
      }

      // Not found in app integration - tell AI to try customer_data_lookup
      const instruction = business.language === 'TR'
        ? '\n\n[TALİMAT: App entegrasyonunda bulunamadı. customer_data_lookup aracı ile Excel/CSV verilerinde ara.]'
        : '\n\n[INSTRUCTION: Not found in app integration. Try customer_data_lookup tool to search Excel/CSV data.]';

      return {
        success: false,
        error: (result.error || (business.language === 'TR'
          ? 'Sipariş app entegrasyonunda bulunamadı.'
          : 'Order not found in app integration.')) + instruction,
        code: 'NOT_FOUND'
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

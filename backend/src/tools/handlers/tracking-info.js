/**
 * Tracking Info Handler
 * Gets shipping/tracking information via E-commerce Aggregator (Shopify, WooCommerce)
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';

/**
 * Execute tracking info retrieval
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { order_number, tracking_number } = args;

    console.log('🔍 Getting tracking info:', { order_number, tracking_number });

    // If we have an order number, get tracking from the order
    if (order_number) {
      const result = await ecommerceAggregator.getOrderTracking(business.id, order_number);

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
            ? 'Sipariş bulunamadı. Lütfen sipariş numarasını kontrol edin.'
            : 'Order not found. Please check the order number.')
        };
      }

      const isTurkish = business.language === 'TR';

      // Order found with tracking info
      if (result.hasTracking && result.tracking) {
        let responseMessage;
        if (isTurkish) {
          responseMessage = `Sipariş ${result.orderNumber} için kargo bilgisi: `;
          responseMessage += `Kargo firması: ${result.tracking.company}. `;
          responseMessage += `Takip numarası: ${result.tracking.number}. `;
          if (result.tracking.url) {
            responseMessage += `Kargonuzu takip etmek için kargo firmasının web sitesini ziyaret edebilirsiniz.`;
          }
        } else {
          responseMessage = `Tracking info for order ${result.orderNumber}: `;
          responseMessage += `Carrier: ${result.tracking.company}. `;
          responseMessage += `Tracking number: ${result.tracking.number}. `;
          if (result.tracking.url) {
            responseMessage += `You can track your package on the carrier's website.`;
          }
        }

        return {
          success: true,
          data: {
            orderNumber: result.orderNumber,
            tracking: result.tracking,
            platform: result.platform
          },
          message: responseMessage
        };
      }

      // Order found but not shipped yet
      return {
        success: true,
        data: {
          orderNumber: result.orderNumber,
          shipped: false,
          status: result.status,
          platform: result.platform
        },
        message: result.message || (isTurkish
          ? `Sipariş ${result.orderNumber} henüz kargoya verilmedi. Siparişiniz hazırlanıyor.`
          : `Order ${result.orderNumber} has not been shipped yet. Your order is being prepared.`)
      };
    }

    // If we only have a tracking number (no order lookup)
    if (tracking_number) {
      const isTurkish = business.language === 'TR';
      return {
        success: true,
        data: {
          trackingNumber: tracking_number
        },
        message: isTurkish
          ? `Takip numaranız: ${tracking_number}. Bu numarayla kargo firmasının web sitesinden kargonuzu takip edebilirsiniz.`
          : `Your tracking number is: ${tracking_number}. You can track your package using this number on the carrier's website.`
      };
    }

    // No order number or tracking number provided
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Sipariş numarası veya takip numarası gerekli.'
        : 'Order number or tracking number required.'
    };

  } catch (error) {
    console.error('❌ Get tracking info error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Kargo bilgisi alınamadı. Lütfen daha sonra tekrar deneyin.'
        : 'Could not get tracking info. Please try again later.'
    };
  }
}

export default { execute };

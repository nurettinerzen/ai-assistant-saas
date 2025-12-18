/**
 * Tracking Info Tool Definition
 * Gets shipping/tracking information for orders (Shopify, WooCommerce, etc.)
 */

export default {
  name: 'get_tracking_info',
  description: 'Gets shipping/tracking information for an order. Returns carrier and tracking number if order has been shipped.',
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Order number'
      },
      tracking_number: {
        type: 'string',
        description: 'Tracking number (if known)'
      }
    },
    required: [] // At least one should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER'] // At least one required
};

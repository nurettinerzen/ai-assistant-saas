/**
 * Order Status Tool Definition
 * Checks order status across e-commerce platforms (Trendyol, Shopify, WooCommerce, Webhook)
 */

export default {
  name: 'check_order_status',
  description: 'Checks order status for a customer. Searches by order number, phone, or email across connected e-commerce platforms.',
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Order number/ID'
      },
      customer_phone: {
        type: 'string',
        description: 'Customer phone number to search orders'
      },
      customer_email: {
        type: 'string',
        description: 'Customer email to search orders'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER'] // At least one required
};

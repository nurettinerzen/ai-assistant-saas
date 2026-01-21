/**
 * Order Status Tool Definition
 * Checks order status across e-commerce platforms (Trendyol, Shopify, WooCommerce, Webhook)
 */

export default {
  name: 'check_order_status',
  description: `Checks order status for a customer.

REQUIRED FLOW (follow strictly):
1. FIRST: Ask for order number
2. IF customer doesn't have order number: Ask for phone number
3. VERIFICATION: After finding order, ask for customer name for security verification

DO NOT ask for multiple options at once. Follow the priority: order number > phone number.`,
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Order number/ID - PRIMARY identifier, ask for this FIRST'
      },
      customer_phone: {
        type: 'string',
        description: 'Customer phone number - SECONDARY identifier, only ask if order number is not available'
      },
      customer_name: {
        type: 'string',
        description: 'Customer name for verification AFTER order is found'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER'] // At least one required
};

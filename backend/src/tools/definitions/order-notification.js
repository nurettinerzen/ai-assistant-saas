/**
 * Order Notification Tool Definition
 * Sends order notification to business owner via SMS/WhatsApp
 */

export default {
  name: 'send_order_notification',
  description: 'Sends order notification to business owner when customer places an order. Use this for food orders, product orders, etc.',
  parameters: {
    type: 'object',
    properties: {
      customer_name: {
        type: 'string',
        description: 'Customer\'s full name'
      },
      customer_phone: {
        type: 'string',
        description: 'Customer\'s phone number'
      },
      order_items: {
        type: 'string',
        description: 'Order items/details as text (e.g., "2x Margherita Pizza, 1x Coca Cola")'
      }
    },
    required: ['customer_name', 'customer_phone', 'order_items']
  },
  allowedBusinessTypes: ['RESTAURANT', 'ECOMMERCE', 'OTHER'],
  requiredIntegrations: [] // SMS/WhatsApp optional - logs to DB at minimum
};

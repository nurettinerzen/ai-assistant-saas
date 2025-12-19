/**
 * CRM Order Status Tool Definition
 * Checks order status from custom CRM webhook data
 */

export default {
  name: 'check_order_status_crm',
  description: 'Müşterinin sipariş durumunu özel CRM sisteminden sorgular. Sipariş numarası veya telefon numarası ile arama yapılabilir.',
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Sipariş numarası'
      },
      phone: {
        type: 'string',
        description: 'Müşteri telefon numarası'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'SERVICE', 'OTHER'],
  requiredIntegrations: ['CRM_WEBHOOK'] // Custom CRM integration
};

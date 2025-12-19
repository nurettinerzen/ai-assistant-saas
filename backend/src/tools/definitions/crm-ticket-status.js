/**
 * CRM Ticket Status Tool Definition
 * Checks service/repair ticket status from custom CRM webhook data
 */

export default {
  name: 'check_ticket_status_crm',
  description: 'Servis veya arıza kaydı durumunu özel CRM sisteminden sorgular. Servis numarası veya telefon numarası ile arama yapılabilir.',
  parameters: {
    type: 'object',
    properties: {
      ticket_number: {
        type: 'string',
        description: 'Servis/arıza numarası'
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

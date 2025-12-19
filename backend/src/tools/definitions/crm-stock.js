/**
 * CRM Stock Tool Definition
 * Checks stock from custom CRM webhook data
 */

export default {
  name: 'check_stock_crm',
  description: 'Ürün stok durumunu özel CRM sisteminden sorgular. Ürün adı veya SKU ile arama yapılabilir.',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: 'Ürün adı'
      },
      sku: {
        type: 'string',
        description: 'Ürün SKU kodu'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'SERVICE', 'OTHER'],
  requiredIntegrations: ['CRM_WEBHOOK'] // Custom CRM integration
};

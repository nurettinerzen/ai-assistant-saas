/**
 * Order Status by Email Tool Definition
 * Checks order status using customer email
 */

export default {
  name: 'check_order_by_email',
  description: `E-posta adresi ile sipariş durumu sorgular.

Müşteri e-posta adresi verdiyse BU TOOL'U KULLAN.
E-posta @ işareti içerir (örn: ali@gmail.com).

GÜVENLİK: Sipariş bulunursa doğrulama için müşterinin adını iste.`,
  parameters: {
    type: 'object',
    properties: {
      customer_email: {
        type: 'string',
        description: 'Müşteri e-posta adresi (@ içerir)'
      },
      customer_name: {
        type: 'string',
        description: 'Doğrulama için müşteri adı (opsiyonel)'
      }
    },
    required: ['customer_email']
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER']
};

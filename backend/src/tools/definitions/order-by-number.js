/**
 * Order Status by Order Number Tool Definition
 * Checks order status using order number
 */

export default {
  name: 'check_order_by_number',
  description: `Sipariş numarası ile sipariş durumu sorgular.

Müşteri sipariş numarası verdiyse BU TOOL'U KULLAN.
Sipariş numarası genellikle 4-6 haneli bir sayıdır (örn: 1001, 1234, 56789).

GÜVENLİK: Sipariş bulunursa doğrulama için müşterinin adını veya telefonunu iste.`,
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Sipariş numarası (4-6 haneli sayı)'
      },
      customer_name: {
        type: 'string',
        description: 'Doğrulama için müşteri adı (opsiyonel)'
      }
    },
    required: ['order_number']
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER']
};

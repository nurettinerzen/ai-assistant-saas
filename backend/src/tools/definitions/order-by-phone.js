/**
 * Order Status by Phone Tool Definition
 * Checks order status using customer phone number
 */

export default {
  name: 'check_order_by_phone',
  description: `Telefon numarası ile sipariş durumu sorgular.

Müşteri telefon numarası verdiyse BU TOOL'U KULLAN.
Telefon numarası 10-11 haneli, 05 ile başlar (örn: 05321234567).

GÜVENLİK: Sipariş bulunursa doğrulama için müşterinin adını veya sipariş numarasını iste.`,
  parameters: {
    type: 'object',
    properties: {
      customer_phone: {
        type: 'string',
        description: 'Müşteri telefon numarası (10-11 hane, 05 ile başlar)'
      },
      customer_name: {
        type: 'string',
        description: 'Doğrulama için müşteri adı (opsiyonel)'
      }
    },
    required: ['customer_phone']
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER']
};

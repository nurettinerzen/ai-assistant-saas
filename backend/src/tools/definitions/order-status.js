/**
 * Order Status Tool Definition
 * Checks order status across e-commerce platforms (Shopify, WooCommerce, ikas, etc.)
 *
 * SECURITY: 2-way verification required
 * - Single identifier → asks for verification (phone, name, or email)
 * - Two matching identifiers → returns order data
 */

export default {
  name: 'check_order_status',
  description: `Sipariş durumu sorgular. Sipariş numarası, telefon veya e-posta ile arama yapar.

GÜVENLİK DOĞRULAMASI:
- Tek bilgi ile sorgu yapıldığında sistem doğrulama isteyecek (requiresVerification: true)
- Doğrulama için müşteriden İKİNCİ BİR BİLGİ iste (sipariş no verdiyse telefon veya isim, telefon verdiyse sipariş no veya isim)
- Doğrulama BAŞARILI olana kadar sipariş detaylarını SÖYLEME
- Doğrulama sonrası İKİ BİLGİYİ BİRDEN gönder`,
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Sipariş numarası'
      },
      customer_phone: {
        type: 'string',
        description: 'Müşteri telefon numarası'
      },
      customer_email: {
        type: 'string',
        description: 'Müşteri e-posta adresi'
      },
      customer_name: {
        type: 'string',
        description: 'Müşteri adı soyadı. Doğrulama için kullanılır.'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'RESTAURANT'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER'] // At least one required
};

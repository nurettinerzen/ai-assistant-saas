/**
 * CRM Stock Tool Definition
 * Checks stock from custom CRM webhook data
 *
 * DISAMBIGUATION: Returns candidates when multiple products match.
 * DISCLOSURE POLICY: Never returns raw stock quantities.
 *   - Returns availability band: IN_STOCK / LOW_STOCK / OUT_OF_STOCK
 *   - For quantity requests: threshold check (YES/NO/PARTIAL)
 */

export default {
  name: 'check_stock_crm',
  description: 'Ürün stok durumunu özel CRM sisteminden sorgular. Birden fazla ürün eşleşirse netleştirme için aday listesi döner. Stok adedi değil, uygunluk durumu döner (stokta var/yok/sınırlı). UYARI: requested_qty sadece müşteri açıkça bir sayı verdiğinde kullanılır (ör: "50 adet istiyorum"). Müşteri "kaç tane var?" diye sorarsa requested_qty KULLANILMAZ.',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: 'Ürün adı (ör: "iPhone 17 Pro")'
      },
      sku: {
        type: 'string',
        description: 'Ürün SKU kodu veya barkod numarası (tam eşleşme)'
      },
      requested_qty: {
        type: 'string',
        description: 'Sadece müşteri açıkça bir sayı belirttiğinde kullanılır (ör: müşteri "50 adet var mı?" veya "100 tane istiyorum" derse "50" veya "100" yazılır). Müşteri "kaç tane var?" veya "stokta ne kadar var?" gibi genel sorular sorarsa bu parametre BOŞ BIRAKILIR, asla tahminle doldurulmaz.'
      }
    },
    required: [] // At least one of product_name or sku should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE', 'SERVICE', 'OTHER'],
  requiredIntegrations: ['CRM_WEBHOOK']
};

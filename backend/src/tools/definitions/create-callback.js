/**
 * create_callback Tool Definition
 *
 * Müşteriye geri arama kaydı oluşturur.
 * Asistan yardımcı olamadığında, müşteri gerçek biriyle görüşmek
 * istediğinde veya mesai dışında kullanılır.
 */

export default {
  name: 'create_callback',
  description: 'Müşteriye geri arama kaydı oluşturur. Asistan yardımcı olamadığında, müşteri gerçek biriyle görüşmek istediğinde veya mesai dışında kullanılır.',
  parameters: {
    type: 'object',
    properties: {
      customerName: {
        type: 'string',
        description: 'Müşterinin adı soyadı (extractedSlots.customer_name kullanılabilir)'
      },
      customerPhone: {
        type: 'string',
        description: 'Müşterinin telefon numarası (extractedSlots.phone kullanılabilir)'
      },
      topic: {
        type: 'string',
        description: 'Görüşme konusu özeti. OPSIYONEL - boş bırakılırsa sistem otomatik üretir.'
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        description: 'Öncelik seviyesi. Şikayet için HIGH, normal talepler için NORMAL'
      }
    },
    required: ['customerName', 'customerPhone']
  },
  // Meta information
  metadata: {
    category: 'communication',
    businessTypes: ['ALL'], // Tüm iş tiplerinde kullanılabilir
    requiresIntegration: false
  }
};

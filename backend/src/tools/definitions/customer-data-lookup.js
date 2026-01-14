/**
 * Customer Data Lookup Tool Definition
 * Retrieves customer information based on phone number OR order number
 * Supports all data types: orders, accounting, support tickets, appointments, etc.
 * Used by AI assistant to access customer-specific data during calls/chats
 */

export default {
  name: 'customer_data_lookup',
  description: `Müşteri verilerini sorgular. SİPARİŞ, MUHASEBE, ARIZA TAKİP, RANDEVU gibi TÜM VERİ TİPLERİNİ destekler.

KULLANIM:
- Sipariş sorgusu: order_number VEYA phone ile ara
- Muhasebe (SGK/vergi borcu): phone ile ara
- Arıza/servis durumu: phone ile ara
- Randevu bilgisi: phone ile ara

ÖNEMLİ:
- Müşteri sipariş numarası verirse -> order_number parametresini kullan (müşterinin verdiği numarayı AYNEN kullan)
- Müşteri telefon numarası verirse -> phone parametresini kullan
- İKİSİNDEN BİRİ ZORUNLU!
- SADECE veritabanında bulunan kayıtları döndür. Kayıt bulunamazsa "bulunamadı" de, ASLA veri uydurma!`,
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Sipariş numarası. Müşterinin verdiği numarayı AYNEN kullan, değiştirme veya tahmin etme.'
      },
      phone: {
        type: 'string',
        description: 'Telefon numarası. Boşlukları ve tireleri kaldır. Örnek: "0533 123 45 68" -> "05331234568"'
      },
      query_type: {
        type: 'string',
        enum: ['siparis', 'order', 'muhasebe', 'sgk_borcu', 'vergi_borcu', 'ariza', 'randevu', 'genel'],
        description: 'Sorgu türü. Sipariş için "siparis" veya "order", muhasebe için "muhasebe", arıza için "ariza", randevu için "randevu" kullan. Emin değilsen "genel" kullan.'
      }
    },
    required: []  // At least one of order_number or phone should be provided
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

/**
 * Customer Data Lookup Tool Definition
 * Retrieves customer information based on phone number OR order number
 * Supports all data types: orders, accounting, support tickets, appointments, etc.
 * Used by AI assistant to access customer-specific data during calls/chats
 *
 * SECURITY: 2-way verification for sensitive data
 * - First query returns verification request
 * - Second query with both identifiers returns full data
 */

export default {
  name: 'customer_data_lookup',
  description: `Müşteri verilerini sorgular. SİPARİŞ, MUHASEBE, ARIZA TAKİP, RANDEVU gibi TÜM VERİ TİPLERİNİ destekler.

KULLANIM:
- Sipariş sorgusu: order_number VEYA phone ile ara
- Muhasebe (SGK/vergi borcu): phone ile ara
- Arıza/servis durumu: phone ile ara
- Randevu bilgisi: phone ile ara

GÜVENLİK DOĞRULAMASI:
- Hassas veriler için 2 YÖNLÜ DOĞRULAMA gerekir
- İlk sorguda sistem doğrulama isteyecek (requiresVerification: true)
- Doğrulama için müşteriden İKİNCİ BİR BİLGİ iste (sipariş no verdiyse telefon, telefon verdiyse sipariş no)
- İkinci bilgiyi aldığında TEKRAR bu aracı çağır ve HER İKİ BİLGİYİ DE gönder

ÖNEMLİ:
- Müşteri sipariş numarası verirse -> order_number parametresini kullan
- Müşteri telefon numarası verirse -> phone parametresini kullan
- Doğrulama sonrası HER İKİ BİLGİYİ BİRDEN gönder`,
  parameters: {
    type: 'object',
    properties: {
      order_number: {
        type: 'string',
        description: 'Sipariş numarası'
      },
      phone: {
        type: 'string',
        description: 'Telefon numarası. Boşlukları ve tireleri kaldır. Örnek: "0533 123 45 68" -> "05331234568"'
      },
      customer_name: {
        type: 'string',
        description: 'Müşteri adı soyadı. Doğrulama için kullanılır.'
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

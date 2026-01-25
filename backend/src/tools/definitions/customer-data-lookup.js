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

ÖNCELİKLİ SORGULAMA AKIŞI (query_type'a göre):

📦 SİPARİŞ SORGUSU (query_type: "siparis"):
1. SADECE sipariş numarası sor
2. EĞER kullanıcı bilmiyorsa telefon numarası sor
3. Doğrulama: İsim/soyisim sor

💰 MUHASEBE SORGUSU (query_type: "muhasebe", "sgk_borcu", "vergi_borcu"):
1. ÖNCE VKN veya TC Kimlik No sor
2. VKN/TC yoksa telefon numarası sor
3. Doğrulama: Firma ismi veya isim/soyisim sor

🔧 ARIZA/SERVİS TAKİP (query_type: "ariza"):
1. ÖNCE servis/arıza numarası sor
2. Yoksa telefon numarası sor
3. Doğrulama: İsim/soyisim sor

📅 RANDEVU SORGUSU (query_type: "randevu"):
1. Telefon numarası sor
2. Doğrulama: İsim/soyisim sor

GÜVENLİK:
- Sistem doğrulama isterse müşteriden isim/soyisim veya firma ismi iste
- TEKRAR bu aracı çağır ve doğrulama bilgisini ekle

ÖNEMLİ:
- Her sorgu için SADECE primary bilgiyi sor (önce sipariş no, sonra telefon)
- Birden fazla seçenek sunma, tek tek sor`,
  parameters: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['siparis', 'order', 'muhasebe', 'sgk_borcu', 'vergi_borcu', 'ariza', 'randevu', 'genel'],
        description: 'ZORUNLU: Sorgu türü. Sipariş için "siparis", muhasebe için "muhasebe", arıza için "ariza", randevu için "randevu"'
      },
      order_number: {
        type: 'string',
        description: 'Sipariş numarası - SADECE sipariş sorgusunda PRIMARY bilgi'
      },
      phone: {
        type: 'string',
        description: 'Telefon numarası - SECONDARY bilgi veya muhasebe/randevu için PRIMARY'
      },
      vkn: {
        type: 'string',
        description: 'Vergi Kimlik No (10 haneli) - Muhasebe sorgusunda PRIMARY bilgi (firma için)'
      },
      tc: {
        type: 'string',
        description: 'TC Kimlik No (11 haneli) - Muhasebe sorgusunda PRIMARY bilgi (şahıs için)'
      },
      ticket_number: {
        type: 'string',
        description: 'Servis/Arıza numarası - Arıza takipte PRIMARY bilgi'
      },
      customer_name: {
        type: 'string',
        description: 'Müşteri isim/soyisim veya firma ismi - DOĞRULAMA için kullanılır'
      }
    },
    required: ['query_type']
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

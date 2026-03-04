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
  description: `Müşteri verilerini sorgular. SİPARİŞ, MUHASEBE, RANDEVU, SERVİS/ARIZA TAKİP gibi VERİ TİPLERİNİ destekler.

ÖNCELİKLİ SORGULAMA AKIŞI (query_type'a göre):

📦 SİPARİŞ SORGUSU (query_type: "siparis"):
1. SADECE sipariş numarası sor
2. EĞER kullanıcı bilmiyorsa telefon numarası sor
3. Doğrulama: İsim/soyisim sor

🔧 SERVİS/ARIZA SORGUSU (query_type: "servis"):
1. Ticket/servis numarası sor (örn: TKT-2024-0009)
2. Ticket numarası yoksa telefon numarası sor
3. Doğrulama: İsim/soyisim sor
⚠️ Kullanıcı servis kaydı, arıza takibi, destek talebi soruyorsa MUTLAKA bu aracı çağır.

💰 MUHASEBE SORGUSU (query_type: "muhasebe", "sgk_borcu", "vergi_borcu"):
1. ÖNCE VKN veya TC Kimlik No sor
2. VKN/TC yoksa telefon numarası sor
3. Doğrulama: Firma ismi veya isim/soyisim sor

📅 RANDEVU SORGUSU (query_type: "randevu"):
1. Telefon numarası sor
2. Doğrulama: İsim/soyisim sor

GÜVENLİK:
- Sistem doğrulama isterse müşteriden telefon son 4 hanesi VEYA isim iste
- TEKRAR bu aracı çağır ve verification_input parametresine ekle

DOĞRULAMA AKIŞI:
1. İlk sorguda sistem "doğrulama gerekli" derse
2. Müşteriden telefon son 4 hanesi iste (4 haneli sayı)
3. Tool'u tekrar çağır: verification_input parametresine "8595" gibi 4 haneyi yaz
4. Eğer telefon yoksa isim/soyisim iste ve verification_input'a yaz

ÖNEMLİ:
- Her sorgu için SADECE primary bilgiyi sor (önce sipariş/ticket no, sonra telefon)
- Birden fazla seçenek sunma, tek tek sor
- 4 haneli sayı = telefon son 4 hanesi (verification_input'a yaz)`,
  parameters: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['siparis', 'order', 'muhasebe', 'sgk_borcu', 'vergi_borcu', 'randevu', 'servis', 'ticket', 'service', 'genel'],
        description: 'ZORUNLU: Sorgu türü. Sipariş için "siparis", muhasebe için "muhasebe", randevu için "randevu", servis/arıza takibi için "servis".'
      },
      ticket_number: {
        type: 'string',
        description: 'Servis/arıza ticket numarası (örn: TKT-2024-0009) - SERVİS sorgusunda PRIMARY bilgi'
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
      customer_name: {
        type: 'string',
        description: 'Müşteri isim/soyisim veya firma ismi - SADECE isim ile doğrulama gerektiğinde'
      },
      verification_input: {
        type: 'string',
        description: 'DOĞRULAMA BİLGİSİ: Telefon son 4 hanesi (örn: "8595") VEYA tam isim. 4 haneli sayı = telefon son 4 hane'
      }
    },
    required: ['query_type']
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

/**
 * Customer Data Lookup Tool Definition
 * Retrieves customer information based on phone number
 * Used by AI assistant to access customer-specific data during calls
 */

export default {
  name: 'customer_data_lookup',
  description: 'Müşterinin kayıtlı bilgilerini getirir (SGK borcu, vergi borcu, beyanname durumu). Müşteri numara söylediyse o numarayı phone parametresine yaz. Numara söylemediyse phone boş bırak.',
  parameters: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['sgk_borcu', 'vergi_borcu', 'beyanname', 'tum_bilgiler', 'genel'],
        description: 'Sorgulanacak bilgi türü. Müşteri spesifik bir konu sormadıysa "tum_bilgiler" veya "genel" kullan.'
      },
      phone: {
        type: 'string',
        description: 'Müşterinin söylediği telefon numarası. Müşteri numara söylediyse BU ALANI DOLDUR. Örnek: "0532 123 45 67" -> "05321234567"'
      }
    },
    required: ['query_type']
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

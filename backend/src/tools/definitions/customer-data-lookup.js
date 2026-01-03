/**
 * Customer Data Lookup Tool Definition
 * Retrieves customer information based on phone number
 * Used by AI assistant to access customer-specific data during calls
 */

export default {
  name: 'customer_data_lookup',
  description: 'Müşterinin kayıtlı bilgilerini getirir (SGK borcu, vergi borcu, beyanname durumu). ÖNEMLİ: Müşteri telefon numarası söylediğinde, bu numarayı MUTLAKA phone parametresine yaz! Örnek: Müşteri "0532 123 45 67" derse phone alanına "05321234567" yaz.',
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
        description: 'ZORUNLU: Müşterinin söylediği telefon numarası. Müşteri hangi numarayı söylediyse onu buraya yaz. Boşlukları ve tireleri kaldır. Örnek: "0532 123 45 67" -> "05321234567", "532 123 4567" -> "5321234567"'
      }
    },
    required: ['query_type']
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

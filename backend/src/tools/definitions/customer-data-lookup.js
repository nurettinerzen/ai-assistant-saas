/**
 * Customer Data Lookup Tool Definition
 * Retrieves customer information based on phone number
 * Used by AI assistant to access customer-specific data during calls
 */

export default {
  name: 'customer_data_lookup',
  description: 'Arayan müşterinin kayıtlı bilgilerini getirir. SGK borcu, vergi borcu, beyanname durumu gibi müşteriye özel verileri sorgular. Müşteri bilgi sorduğunda veya arama başladığında bu tool\'u kullan.',
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
        description: 'Müşteri telefon numarası. Otomatik olarak arayan numaradan alınabilir.'
      }
    },
    required: ['query_type']
  },
  // Available for all business types - can store custom data
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'ECOMMERCE', 'CLINIC', 'SERVICE', 'OTHER'],
  requiredIntegrations: [] // No external integration needed, uses internal DB
};

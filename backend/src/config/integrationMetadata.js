/**
 * Integration Metadata Configuration
 * Defines which integrations are relevant for each business type
 * and their priority level (ESSENTIAL, RECOMMENDED, OPTIONAL)
 * 
 * Updated: Türk pazarı entegrasyonları ve kargo şirketleri eklendi
 */

export const INTEGRATION_METADATA = {
  // ============================================================================
  // SCHEDULING & CALENDAR
  // ============================================================================
  
  GOOGLE_CALENDAR: {
    relevantFor: ['RESTAURANT', 'CLINIC', 'SALON', 'SERVICE'],
    priority: {
      RESTAURANT: 'ESSENTIAL',
      CLINIC: 'ESSENTIAL',
      SALON: 'ESSENTIAL',
      SERVICE: 'RECOMMENDED',
      ECOMMERCE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Google Calendar',
    description: 'Randevu ve takvim yönetimi',
    category: 'scheduling',
    authType: 'oauth'
  },

  CALENDLY: {
    relevantFor: ['RESTAURANT', 'CLINIC', 'SALON', 'SERVICE'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      ECOMMERCE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Calendly',
    description: 'Online randevu planlama',
    category: 'scheduling',
    authType: 'oauth'
  },

  // ============================================================================
  // COMMUNICATION
  // ============================================================================

  WHATSAPP: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'ESSENTIAL',
      ECOMMERCE: 'ESSENTIAL',
      CLINIC: 'ESSENTIAL',
      SALON: 'ESSENTIAL',
      SERVICE: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'WhatsApp Business',
    description: 'WhatsApp üzerinden müşteri iletişimi',
    category: 'communication',
    authType: 'api_key'
  },

  GMAIL: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'Gmail',
    description: 'Email okuma ve gönderme',
    category: 'communication',
    authType: 'oauth'
  },

  OUTLOOK: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'RECOMMENDED',
      SALON: 'OPTIONAL',
      SERVICE: 'RECOMMENDED',
      OTHER: 'OPTIONAL'
    },
    name: 'Outlook / Microsoft 365',
    description: 'Microsoft email ve takvim',
    category: 'communication',
    authType: 'oauth'
  },

  NETGSM_SMS: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      CLINIC: 'ESSENTIAL',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      OTHER: 'OPTIONAL'
    },
    name: 'NetGSM SMS',
    description: 'Türkiye SMS bildirimleri',
    category: 'communication',
    authType: 'api_key',
    region: 'TR'
  },

  TWILIO_SMS: {
    relevantFor: ['RESTAURANT', 'CLINIC', 'SALON', 'SERVICE'],
    priority: {
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Twilio SMS',
    description: 'Uluslararası SMS bildirimleri',
    category: 'communication',
    authType: 'api_key',
    region: 'US'
  },

  SLACK: {
    relevantFor: ['SERVICE', 'ECOMMERCE', 'OTHER'],
    priority: {
      SERVICE: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      OTHER: 'OPTIONAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL'
    },
    name: 'Slack',
    description: 'Ekip iletişimi ve bildirimler',
    category: 'communication',
    authType: 'oauth'
  },

  SENDGRID_EMAIL: {
    relevantFor: ['ECOMMERCE', 'SERVICE', 'CLINIC'],
    priority: {
      ECOMMERCE: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      RESTAURANT: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'SendGrid',
    description: 'Toplu email gönderimi',
    category: 'communication',
    authType: 'api_key'
  },

  // ============================================================================
  // E-COMMERCE & MARKETPLACE
  // ============================================================================

  TRENDYOL: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Trendyol',
    description: 'Trendyol mağaza entegrasyonu',
    category: 'ecommerce',
    authType: 'api_key',
    region: 'TR'
  },

  HEPSIBURADA: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Hepsiburada',
    description: 'Hepsiburada mağaza entegrasyonu',
    category: 'ecommerce',
    authType: 'api_key',
    region: 'TR'
  },

  SHOPIFY: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Shopify',
    description: 'Shopify mağaza entegrasyonu',
    category: 'ecommerce',
    authType: 'oauth'
  },

  WOOCOMMERCE: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'WooCommerce',
    description: 'WooCommerce mağaza entegrasyonu',
    category: 'ecommerce',
    authType: 'api_key'
  },

  IKAS: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'ikas',
    description: 'ikas e-ticaret platformu entegrasyonu',
    category: 'ecommerce',
    authType: 'oauth',
    region: 'TR'
  },

  IDEASOFT: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Ideasoft',
    description: 'Ideasoft e-ticaret platformu entegrasyonu',
    category: 'ecommerce',
    authType: 'oauth',
    region: 'TR'
  },

  TICIMAX: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Ticimax',
    description: 'Ticimax e-ticaret platformu entegrasyonu',
    category: 'ecommerce',
    authType: 'api_key',
    region: 'TR'
  },

  // ============================================================================
  // CARGO / SHIPPING - TURKEY
  // ============================================================================

  YURTICI_KARGO: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Yurtiçi Kargo',
    description: 'Yurtiçi Kargo gönderi takibi',
    category: 'shipping',
    authType: 'api_key',
    region: 'TR'
  },

  ARAS_KARGO: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Aras Kargo',
    description: 'Aras Kargo gönderi takibi',
    category: 'shipping',
    authType: 'api_key',
    region: 'TR'
  },

  MNG_KARGO: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'MNG Kargo',
    description: 'MNG Kargo gönderi takibi',
    category: 'shipping',
    authType: 'api_key',
    region: 'TR'
  },

  SHIPSTATION: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'ShipStation',
    description: 'Uluslararası kargo yönetimi',
    category: 'shipping',
    authType: 'api_key',
    region: 'US'
  },

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  IYZICO: {
    relevantFor: ['ECOMMERCE', 'SERVICE', 'RESTAURANT', 'SALON', 'CLINIC', 'OTHER'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      OTHER: 'OPTIONAL'
    },
    name: 'iyzico',
    description: 'Türkiye ödeme altyapısı',
    category: 'payments',
    authType: 'api_key',
    region: 'TR'
  },

  STRIPE_PAYMENTS: {
    relevantFor: ['ECOMMERCE', 'SALON', 'SERVICE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Stripe',
    description: 'Uluslararası ödeme altyapısı',
    category: 'payments',
    authType: 'api_key',
    region: 'US'
  },

  SQUARE: {
    relevantFor: ['RESTAURANT', 'SALON', 'ECOMMERCE'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Square',
    description: 'POS ve ödeme sistemi',
    category: 'payments',
    authType: 'oauth',
    region: 'US'
  },

  // ============================================================================
  // ACCOUNTING
  // ============================================================================

  PARASUT: {
    relevantFor: ['ECOMMERCE', 'SERVICE', 'RESTAURANT', 'SALON', 'CLINIC', 'OTHER'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'Paraşüt',
    description: 'Türkiye muhasebe ve fatura',
    category: 'accounting',
    authType: 'oauth',
    region: 'TR'
  },

  // ============================================================================
  // CRM
  // ============================================================================

  HUBSPOT: {
    relevantFor: ['ECOMMERCE', 'SERVICE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'RECOMMENDED'
    },
    name: 'HubSpot',
    description: 'CRM ve pazarlama otomasyonu',
    category: 'crm',
    authType: 'oauth'
  },

  SALESFORCE: {
    relevantFor: ['SERVICE', 'ECOMMERCE'],
    priority: {
      SERVICE: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Salesforce',
    description: 'Kurumsal CRM',
    category: 'crm',
    authType: 'oauth'
  },

  GOOGLE_SHEETS: {
    relevantFor: ['RESTAURANT', 'SALON', 'SERVICE', 'CLINIC', 'ECOMMERCE', 'OTHER'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'Google Sheets',
    description: 'Basit veri yönetimi ve CRM',
    category: 'data',
    authType: 'oauth'
  },

  // ============================================================================
  // BOOKING & RESERVATIONS
  // ============================================================================

  OPENTABLE: {
    relevantFor: ['RESTAURANT'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'OpenTable',
    description: 'Restoran rezervasyonu',
    category: 'reservations',
    authType: 'api_key'
  },

  TOAST_POS: {
    relevantFor: ['RESTAURANT'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Toast POS',
    description: 'Restoran POS sistemi',
    category: 'pos',
    authType: 'api_key',
    region: 'US'
  },

  BOOKSY: {
    relevantFor: ['SALON'],
    priority: {
      SALON: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Booksy',
    description: 'Kuaför/salon randevu sistemi',
    category: 'booking',
    authType: 'api_key'
  },

  FRESHA: {
    relevantFor: ['SALON'],
    priority: {
      SALON: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Fresha',
    description: 'Güzellik ve wellness randevu',
    category: 'booking',
    authType: 'api_key'
  },

  // ============================================================================
  // HEALTHCARE
  // ============================================================================

  SIMPLEPRACTICE: {
    relevantFor: ['CLINIC'],
    priority: {
      CLINIC: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'SimplePractice',
    description: 'Sağlık pratik yönetimi',
    category: 'healthcare',
    authType: 'oauth',
    region: 'US'
  },

  ZOCDOC: {
    relevantFor: ['CLINIC'],
    priority: {
      CLINIC: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Zocdoc',
    description: 'Hasta randevu platformu',
    category: 'healthcare',
    authType: 'api_key',
    region: 'US'
  },

  // ============================================================================
  // MARKETING
  // ============================================================================

  KLAVIYO: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Klaviyo',
    description: 'E-ticaret email pazarlama',
    category: 'marketing',
    authType: 'api_key'
  },

  MAILCHIMP: {
    relevantFor: ['ECOMMERCE', 'SERVICE'],
    priority: {
      ECOMMERCE: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Mailchimp',
    description: 'Email pazarlama',
    category: 'marketing',
    authType: 'oauth'
  },

  // ============================================================================
  // AUTOMATION
  // ============================================================================

  ZAPIER: {
    relevantFor: ['RESTAURANT', 'SALON', 'SERVICE', 'CLINIC', 'ECOMMERCE', 'OTHER'],
    priority: {
      RESTAURANT: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      ECOMMERCE: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'Zapier',
    description: 'Otomasyon ve entegrasyon',
    category: 'automation',
    authType: 'webhook'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get integrations filtered by business type
 * @param {string} businessType - Business type (RESTAURANT, ECOMMERCE, etc.)
 * @param {string} region - Optional region filter ('TR', 'US', or null for all)
 * @returns {Array} Filtered and sorted integrations
 */
export function getFilteredIntegrations(businessType = 'OTHER', region = null) {
  const integrations = [];

  for (const [integrationType, metadata] of Object.entries(INTEGRATION_METADATA)) {
    // For OTHER type, show all integrations
    const isRelevant = businessType === 'OTHER' || metadata.relevantFor.includes(businessType);
    
    // Region filter (if specified)
    const matchesRegion = !region || !metadata.region || metadata.region === region;
    
    if (isRelevant && matchesRegion) {
      integrations.push({
        type: integrationType,
        ...metadata,
        priority: metadata.priority[businessType] || 'OPTIONAL'
      });
    }
  }

  // Sort by priority: ESSENTIAL > RECOMMENDED > OPTIONAL
  const priorityOrder = { ESSENTIAL: 0, RECOMMENDED: 1, OPTIONAL: 2 };
  integrations.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 2;
    const bPriority = priorityOrder[b.priority] || 2;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    // Secondary sort by name
    return a.name.localeCompare(b.name);
  });

  return integrations;
}

/**
 * Get integrations by category
 * @param {string} businessType - Business type
 * @param {string} category - Category (scheduling, communication, ecommerce, etc.)
 * @returns {Array} Filtered integrations
 */
export function getIntegrationsByCategory(businessType, category) {
  return getFilteredIntegrations(businessType).filter(i => i.category === category);
}

/**
 * Get priority for a specific integration and business type
 * @param {string} integrationType - Integration type
 * @param {string} businessType - Business type
 * @returns {string} Priority level
 */
export function getIntegrationPriority(integrationType, businessType) {
  const metadata = INTEGRATION_METADATA[integrationType];
  if (!metadata) return 'OPTIONAL';
  return metadata.priority[businessType] || 'OPTIONAL';
}

/**
 * Check if integration is relevant for business type
 * @param {string} integrationType - Integration type
 * @param {string} businessType - Business type
 * @returns {boolean} Is relevant
 */
export function isIntegrationRelevant(integrationType, businessType) {
  if (businessType === 'OTHER') return true;
  const metadata = INTEGRATION_METADATA[integrationType];
  if (!metadata) return false;
  return metadata.relevantFor.includes(businessType);
}

/**
 * Get essential integrations for a business type
 * @param {string} businessType - Business type
 * @returns {Array} Essential integrations
 */
export function getEssentialIntegrations(businessType) {
  return getFilteredIntegrations(businessType).filter(i => i.priority === 'ESSENTIAL');
}

/**
 * Get integration categories with counts
 * @param {string} businessType - Business type
 * @returns {Object} Categories with integration counts
 */
export function getIntegrationCategories(businessType) {
  const integrations = getFilteredIntegrations(businessType);
  const categories = {};
  
  for (const integration of integrations) {
    if (!categories[integration.category]) {
      categories[integration.category] = {
        name: integration.category,
        count: 0,
        essential: 0,
        recommended: 0
      };
    }
    categories[integration.category].count++;
    if (integration.priority === 'ESSENTIAL') categories[integration.category].essential++;
    if (integration.priority === 'RECOMMENDED') categories[integration.category].recommended++;
  }
  
  return categories;
}
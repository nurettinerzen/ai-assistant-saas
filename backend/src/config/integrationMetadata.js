/**
 * Integration Metadata Configuration
 * Defines which integrations are relevant for each business type
 * and their priority level (ESSENTIAL, RECOMMENDED, OPTIONAL)
 *
 * Updated: Multi-region support with Brazil (BR) and Turkey (TR) specific integrations
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

  // Note: Gmail and Outlook are handled in a separate "Email Channel" section in frontend
  // They are not included here to avoid duplicate cards

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

  // ============================================================================
  // E-COMMERCE
  // ============================================================================

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
  // DATA
  // ============================================================================

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
  // BRAZIL SPECIFIC - E-COMMERCE
  // ============================================================================

  NUVEMSHOP: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Nuvemshop',
    namePR: 'Nuvemshop',
    description: 'Latin Amerika\'nın lider e-ticaret platformu',
    descriptionPR: 'A principal plataforma de e-commerce da América Latina',
    category: 'ecommerce',
    authType: 'oauth',
    region: 'BR',
    priority_order: 1 // Show first for Brazil
  },

  TRAY: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Tray',
    namePR: 'Tray',
    description: 'Brezilya e-ticaret platformu',
    descriptionPR: 'Plataforma de e-commerce brasileira',
    category: 'ecommerce',
    authType: 'api_key',
    region: 'BR'
  },

  LOJA_INTEGRADA: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Loja Integrada',
    namePR: 'Loja Integrada',
    description: 'Brezilya ücretsiz e-ticaret platformu',
    descriptionPR: 'Plataforma de e-commerce grátis do Brasil',
    category: 'ecommerce',
    authType: 'api_key',
    region: 'BR'
  },

  MERCADO_LIVRE: {
    relevantFor: ['ECOMMERCE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Mercado Livre',
    namePR: 'Mercado Livre',
    description: 'Latin Amerika pazaryeri',
    descriptionPR: 'Marketplace da América Latina',
    category: 'ecommerce',
    authType: 'oauth',
    region: 'BR'
  },

  // ============================================================================
  // BRAZIL SPECIFIC - COMMUNICATION
  // ============================================================================

  ZENVIA_SMS: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      CLINIC: 'ESSENTIAL',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      OTHER: 'OPTIONAL'
    },
    name: 'Zenvia SMS',
    namePR: 'Zenvia SMS',
    description: 'Brezilya SMS bildirimleri',
    descriptionPR: 'Notificações SMS do Brasil',
    category: 'communication',
    authType: 'api_key',
    region: 'BR'
  },

};

// ============================================================================
// REGION CONFIGURATION
// ============================================================================

/**
 * Region-specific integration availability
 * Defines which integrations are available or priority in each region
 */
export const REGION_INTEGRATIONS = {
  TR: {
    // Turkey-specific platforms
    exclusive: ['IKAS', 'IDEASOFT', 'TICIMAX', 'NETGSM_SMS'],
    // Global platforms also available
    available: ['SHOPIFY', 'WOOCOMMERCE', 'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'WHATSAPP']
  },
  BR: {
    // Brazil-specific platforms
    exclusive: ['NUVEMSHOP', 'TRAY', 'LOJA_INTEGRADA', 'MERCADO_LIVRE', 'ZENVIA_SMS'],
    // Global platforms also available
    available: ['SHOPIFY', 'WOOCOMMERCE', 'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'WHATSAPP']
  },
  US: {
    // US uses global platforms
    exclusive: [],
    available: ['SHOPIFY', 'WOOCOMMERCE', 'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'WHATSAPP']
  },
  GLOBAL: {
    // Available everywhere
    platforms: ['SHOPIFY', 'WOOCOMMERCE', 'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'WHATSAPP', 'ZAPIER']
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
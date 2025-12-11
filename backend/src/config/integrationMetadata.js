/**
 * Integration Metadata Configuration
 * Defines which integrations are relevant for each business type
 * and their priority level (ESSENTIAL, RECOMMENDED, OPTIONAL)
 */

export const INTEGRATION_METADATA = {
  // Google Calendar - Essential for appointment-based businesses
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
    category: 'scheduling'
  },

  // WhatsApp - Critical for Turkish market, all business types
  WHATSAPP: {
    relevantFor: ['RESTAURANT', 'ECOMMERCE', 'CLINIC', 'SALON', 'SERVICE', 'OTHER'],
    priority: {
      RESTAURANT: 'ESSENTIAL',
      ECOMMERCE: 'RECOMMENDED',
      CLINIC: 'ESSENTIAL',
      SALON: 'ESSENTIAL',
      SERVICE: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'WhatsApp Business',
    category: 'communication'
  },

  // Calendly - Appointment scheduling
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
    category: 'scheduling'
  },

  // Shopify - E-commerce only
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
    category: 'ecommerce'
  },

  // WooCommerce - E-commerce only
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
    category: 'ecommerce'
  },

  // Stripe - Payments
  STRIPE_PAYMENTS: {
    relevantFor: ['ECOMMERCE', 'SALON', 'SERVICE'],
    priority: {
      ECOMMERCE: 'ESSENTIAL',
      SALON: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Stripe',
    category: 'payments'
  },

  // Square - Payments & POS
  SQUARE: {
    relevantFor: ['RESTAURANT', 'SALON', 'ECOMMERCE'],
    priority: {
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      CLINIC: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Square',
    category: 'payments'
  },

  // OpenTable - Restaurant reservations
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
    category: 'reservations'
  },

  // Toast POS - Restaurant POS
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
    category: 'pos'
  },

  // SimplePractice - Healthcare practice management
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
    category: 'healthcare'
  },

  // Zocdoc - Patient booking
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
    category: 'healthcare'
  },

  // Booksy - Salon booking platform
  BOOKSY: {
    relevantFor: ['SALON'],
    priority: {
      SALON: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      ECOMMERCE: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SERVICE: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Booksy',
    category: 'booking'
  },

  // Fresha - Salon booking platform
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
    category: 'booking'
  },

  // ShipStation - Shipping for e-commerce
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
    category: 'shipping'
  },

  // Klaviyo - Email marketing for e-commerce
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
    category: 'marketing'
  },

  // Mailchimp - Email marketing
  MAILCHIMP: {
    relevantFor: ['ECOMMERCE', 'SERVICE'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'OPTIONAL'
    },
    name: 'Mailchimp',
    category: 'marketing'
  },

  // HubSpot - CRM
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
    category: 'crm'
  },

  // Salesforce - CRM
  SALESFORCE: {
    relevantFor: ['SERVICE', 'ECOMMERCE'],
    priority: {
      SERVICE: 'RECOMMENDED',
      ECOMMERCE: 'RECOMMENDED',
      RESTAURANT: 'OPTIONAL',
      CLINIC: 'OPTIONAL',
      SALON: 'OPTIONAL',
      OTHER: 'RECOMMENDED'
    },
    name: 'Salesforce',
    category: 'crm'
  },

  // Google Sheets - Simple CRM
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
    category: 'data'
  },

  // Zapier - Automation for all
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
    category: 'automation'
  },

  // Slack - Communication
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
    category: 'communication'
  },

  // Twilio SMS - SMS notifications
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
    category: 'communication'
  },

  // SendGrid - Email
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
    category: 'communication'
  },

  // Parasut - Accounting (Turkish market)
  PARASUT: {
    relevantFor: ['ECOMMERCE', 'SERVICE', 'RESTAURANT', 'SALON', 'CLINIC', 'OTHER'],
    priority: {
      ECOMMERCE: 'RECOMMENDED',
      SERVICE: 'RECOMMENDED',
      RESTAURANT: 'RECOMMENDED',
      SALON: 'RECOMMENDED',
      CLINIC: 'RECOMMENDED',
      OTHER: 'RECOMMENDED'
    },
    name: 'Parasut Muhasebe',
    category: 'accounting'
  },

  // iyzico - Payment (Turkish market)
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
    name: 'iyzico Odeme',
    category: 'payments'
  }
};

/**
 * Get integrations filtered by business type
 * @param {string} businessType - Business type (RESTAURANT, ECOMMERCE, etc.)
 * @returns {Array} Filtered and sorted integrations
 */
export function getFilteredIntegrations(businessType = 'OTHER') {
  const integrations = [];

  for (const [integrationType, metadata] of Object.entries(INTEGRATION_METADATA)) {
    // For OTHER type, show all integrations
    if (businessType === 'OTHER' || metadata.relevantFor.includes(businessType)) {
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

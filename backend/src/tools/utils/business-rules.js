/**
 * Business Rules for Tool Access
 * Defines which business types can access which tools
 *
 * ACTIVE TOOLS (tested, production-ready):
 * - create_appointment: Creates appointments, saves to DB + Google Calendar
 * - send_order_notification: Sends order notification to business owner
 * - check_order_status: E-commerce order lookup (Shopify/WooCommerce via aggregator)
 * - get_product_stock: E-commerce product stock check (Shopify/WooCommerce via aggregator)
 * - get_tracking_info: E-commerce shipping tracking (Shopify/WooCommerce via aggregator)
 *
 * NOTE: Paraşüt is NOT an AI tool - it's a dashboard feature for business owners.
 * Payment tools (iyzico) are disabled until explicitly needed.
 */

// Business type -> allowed tools mapping
export const BUSINESS_TYPE_TOOLS = {
  RESTAURANT: [
    'create_appointment',      // Table reservation - ✅ WORKING
    'send_order_notification'  // Food orders - ✅ WORKING
  ],
  SALON: [
    'create_appointment'       // Hair/beauty appointments - ✅ WORKING
  ],
  CLINIC: [
    'create_appointment'       // Medical appointments - ✅ WORKING
  ],
  SERVICE: [
    'create_appointment'       // Service appointments - ✅ WORKING
  ],
  ECOMMERCE: [
    'check_order_status',      // ✅ Shopify/WooCommerce via aggregator
    'get_product_stock',       // ✅ Shopify/WooCommerce via aggregator
    'get_tracking_info'        // ✅ Shopify/WooCommerce via aggregator
  ],
  OTHER: [
    'create_appointment'       // Generic appointments - ✅ WORKING
  ]
};

// Integration type -> tools that require it
// Tools are only enabled if the business has the corresponding integration active
export const INTEGRATION_REQUIRED_TOOLS = {
  'GOOGLE_CALENDAR': [],  // create_appointment works without it (saves to DB)
  'SHOPIFY': ['check_order_status', 'get_product_stock', 'get_tracking_info'],
  'WOOCOMMERCE': ['check_order_status', 'get_product_stock', 'get_tracking_info']
};

// Tools that work without any specific integration
export const STANDALONE_TOOLS = [
  'create_appointment',
  'send_order_notification'
];

/**
 * Get active tool names for a business type
 * @param {string} businessType - Business type (RESTAURANT, SALON, etc.)
 * @returns {string[]} - Array of tool names allowed for this business type
 */
export function getToolsForBusinessType(businessType) {
  return BUSINESS_TYPE_TOOLS[businessType] || BUSINESS_TYPE_TOOLS['OTHER'];
}

/**
 * Filter tools based on active integrations
 * @param {string[]} toolNames - Array of tool names to filter
 * @param {Object[]} integrations - Array of active integrations
 * @returns {string[]} - Filtered array of tool names that have required integrations
 */
export function filterToolsByIntegrations(toolNames, integrations = []) {
  const activeIntegrationTypes = integrations
    .filter(i => i.isActive && i.connected)
    .map(i => i.type);

  return toolNames.filter(toolName => {
    // Standalone tools always available
    if (STANDALONE_TOOLS.includes(toolName)) {
      return true;
    }

    // Check if any required integration is active
    for (const [integrationType, requiredTools] of Object.entries(INTEGRATION_REQUIRED_TOOLS)) {
      if (requiredTools.includes(toolName) && activeIntegrationTypes.includes(integrationType)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Get active tool names for a business (combining business type and integrations)
 * @param {Object} business - Business object with businessType and integrations
 * @returns {string[]} - Array of active tool names
 */
export function getActiveToolNames(business) {
  const businessType = business.businessType || 'OTHER';
  const integrations = business.integrations || [];

  // Get tools allowed for business type
  const allowedTools = getToolsForBusinessType(businessType);

  // Filter by active integrations
  return filterToolsByIntegrations(allowedTools, integrations);
}

export default {
  BUSINESS_TYPE_TOOLS,
  INTEGRATION_REQUIRED_TOOLS,
  STANDALONE_TOOLS,
  getToolsForBusinessType,
  filterToolsByIntegrations,
  getActiveToolNames
};

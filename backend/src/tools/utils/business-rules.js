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
 * - check_stock_crm: CRM stock lookup (standalone - handler returns notFound if no data)
 * - customer_data_lookup: Customer data lookup (from Excel/CSV import) + CRM order/ticket lookup
 * - create_callback: Create callback request (geri arama talebi)
 */

// Business type -> allowed tools mapping
export const BUSINESS_TYPE_TOOLS = {
  RESTAURANT: [
    'create_appointment',
    'send_order_notification',
    'customer_data_lookup',
    'create_callback'
  ],
  SALON: [
    'create_appointment',
    'customer_data_lookup',
    'create_callback'
  ],
  CLINIC: [
    'create_appointment',
    'customer_data_lookup',
    'create_callback'
  ],
  SERVICE: [
    'create_appointment',
    'check_stock_crm',
    'customer_data_lookup',
    'create_callback'
  ],
  ECOMMERCE: [
    'check_order_status',
    'get_product_stock',
    'get_tracking_info',
    'check_stock_crm',
    'customer_data_lookup',
    'create_callback'
  ],
  OTHER: [
    'create_appointment',
    'check_stock_crm',
    'customer_data_lookup',
    'create_callback'
  ]
};

// Integration type -> tools that require it
// Tools are only enabled if the business has the corresponding integration active
export const INTEGRATION_REQUIRED_TOOLS = {
  'GOOGLE_CALENDAR': [],
  'SHOPIFY': ['check_order_status', 'get_product_stock', 'get_tracking_info'],
  'WOOCOMMERCE': ['check_order_status', 'get_product_stock', 'get_tracking_info'],
  'IKAS': ['check_order_status', 'get_product_stock', 'get_tracking_info'],
  'IDEASOFT': ['check_order_status', 'get_product_stock', 'get_tracking_info'],
  'TICIMAX': ['check_order_status', 'get_product_stock', 'get_tracking_info']
};

// Tools that work without any specific integration
// Handlers check for data at runtime and return notFound if no data exists
export const STANDALONE_TOOLS = [
  'create_appointment',
  'send_order_notification',
  'check_stock_crm',
  'customer_data_lookup',
  'create_callback'
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

  const allowedTools = getToolsForBusinessType(businessType);
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

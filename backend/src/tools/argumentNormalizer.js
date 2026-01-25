/**
 * Tool Argument Normalization Layer
 *
 * Automatically fills missing required arguments from context.extractedSlots
 * using a global alias mapping system.
 *
 * Problem: LLM extracts customer info to extractedSlots but doesn't map it to tool args
 * Solution: System-level normalization before tool execution
 *
 * Example:
 *   Tool requires: { customerName, customerPhone }
 *   LLM provides: { topic: "callback" }
 *   extractedSlots has: { customer_name: "Ahmet", phone: "555..." }
 *   → Normalizer fills: { customerName: "Ahmet", customerPhone: "555...", topic: "callback" }
 */

/**
 * Global Argument Alias Map
 * Maps canonical tool parameter names to possible extractedSlots field names
 *
 * Format: { toolParamName: [extractedSlotAlias1, alias2, ...] }
 */
const ARGUMENT_ALIAS_MAP = {
  // Customer identity
  customerName: ['customer_name', 'name', 'fullName', 'full_name'],
  customerPhone: ['phone', 'phoneNumber', 'phone_number', 'telephone', 'mobile'],
  customerEmail: ['email', 'customer_email', 'mail'],
  customerCompany: ['company', 'customer_company', 'company_name'],

  // Order/transaction
  orderNumber: ['order_number', 'orderId', 'order_id', 'orderNo'],
  trackingNumber: ['tracking_number', 'trackingId', 'tracking_id'],
  invoiceNumber: ['invoice_number', 'invoiceId', 'invoice_id'],

  // Appointment/scheduling
  appointmentDate: ['date', 'appointment_date', 'scheduled_date'],
  appointmentTime: ['time', 'appointment_time', 'scheduled_time'],

  // Address
  address: ['customer_address', 'delivery_address', 'shipping_address'],
  city: ['customer_city', 'delivery_city'],
  postalCode: ['postal_code', 'zip_code', 'zipCode'],

  // Product
  productId: ['product_id', 'sku', 'productSku'],
  productName: ['product_name', 'product'],

  // Generic
  topic: ['subject', 'reason', 'message_topic'],
  notes: ['note', 'comment', 'message', 'description']
};

/**
 * Normalize tool arguments using extractedSlots
 *
 * @param {string} toolName - Tool name (for logging)
 * @param {Object} args - Original arguments from LLM
 * @param {Object} toolDefinition - Tool definition with required params
 * @param {Object} context - Execution context
 * @param {Object} context.extractedSlots - Extracted customer/context data
 * @returns {Object} - { normalizedArgs, filledCount, filledFields }
 */
export function normalizeToolArguments(toolName, args, toolDefinition, context = {}) {
  const extractedSlots = context.extractedSlots || {};
  const requiredParams = toolDefinition?.function?.parameters?.required || [];

  // Start with original args
  const normalizedArgs = { ...args };
  const filledFields = [];

  // For each required parameter that's missing
  for (const paramName of requiredParams) {
    // Skip if already provided by LLM
    if (normalizedArgs[paramName] !== undefined && normalizedArgs[paramName] !== null && normalizedArgs[paramName] !== '') {
      continue;
    }

    // Try to fill from extractedSlots using alias map
    const aliases = ARGUMENT_ALIAS_MAP[paramName] || [];

    for (const alias of aliases) {
      const value = extractedSlots[alias];

      if (value !== undefined && value !== null && value !== '') {
        normalizedArgs[paramName] = value;
        filledFields.push({ param: paramName, alias, value });
        break; // Found a match, stop searching aliases
      }
    }
  }

  // Log normalization if any fields were filled
  if (filledFields.length > 0) {
    console.log(`🔧 [ArgNormalizer] Tool: ${toolName} - Filled ${filledFields.length} missing args from extractedSlots`);
    filledFields.forEach(({ param, alias, value }) => {
      const displayValue = typeof value === 'string' && value.length > 50
        ? value.substring(0, 50) + '...'
        : value;
      console.log(`   ✓ ${param} ← extractedSlots.${alias} = "${displayValue}"`);
    });
  }

  return {
    normalizedArgs,
    filledCount: filledFields.length,
    filledFields: filledFields.map(f => f.param)
  };
}

/**
 * Add a custom alias mapping at runtime
 * Useful for business-specific parameter names
 *
 * @param {string} paramName - Tool parameter name
 * @param {string[]} aliases - Array of extractedSlots field names
 */
export function addArgumentAlias(paramName, aliases) {
  if (!ARGUMENT_ALIAS_MAP[paramName]) {
    ARGUMENT_ALIAS_MAP[paramName] = [];
  }
  ARGUMENT_ALIAS_MAP[paramName].push(...aliases);
  console.log(`🔧 [ArgNormalizer] Added aliases for ${paramName}:`, aliases);
}

/**
 * Get current alias map (for debugging/inspection)
 *
 * @returns {Object} - Current alias mapping
 */
export function getAliasMap() {
  return { ...ARGUMENT_ALIAS_MAP };
}

export default {
  normalizeToolArguments,
  addArgumentAlias,
  getAliasMap
};

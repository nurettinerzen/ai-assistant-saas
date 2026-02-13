/**
 * Tool-Based Field Whitelist
 *
 * Defines which fields MUST be preserved for each tool, regardless of size limits.
 * Prevents critical field loss during sanitization/truncation.
 *
 * CRITICAL PRINCIPLE:
 * Fact grounding requires tool data accuracy.
 * Better to truncate knowledge base than lose critical order/billing fields.
 */

/**
 * Tool-specific field whitelists
 *
 * Format:
 * - required: MUST include (will error if missing from tool response)
 * - priority: Include if available, preserve during truncation
 * - optional: Include only if space permits
 */
export const TOOL_FIELD_WHITELIST = {
  // Order/E-commerce tools
  order_status: {
    required: ['orderNumber', 'status'],
    priority: ['trackingNumber', 'estimatedDelivery', 'carrier', 'totalAmount'],
    optional: ['items', 'shippingAddress', 'paymentMethod']
  },

  customer_data_lookup: {
    required: ['customerName'],
    priority: ['phone', 'email', 'order', 'verified'],
    optional: ['address', 'preferences', 'notes', 'debt', 'appointment']
  },

  shipping_tracking: {
    required: ['trackingNumber', 'status'],
    priority: ['carrier', 'currentLocation', 'estimatedDelivery'],
    optional: ['trackingHistory', 'delayReason']
  },

  product_lookup: {
    required: ['productId', 'name'],
    priority: ['price', 'inStock', 'availability'],
    optional: ['description', 'specifications', 'reviews']
  },

  inventory_check: {
    required: ['sku', 'inStock'],
    priority: ['quantity', 'availableDate'],
    optional: ['warehouseLocation', 'reorderLevel']
  },

  price_check: {
    required: ['productId', 'price'],
    priority: ['currency', 'discount', 'validUntil'],
    optional: ['priceHistory', 'competitorPrices']
  },

  // Billing/Financial tools
  payment_status: {
    required: ['paymentId', 'status'],
    priority: ['amount', 'currency', 'date'],
    optional: ['method', 'transactionId', 'receiptUrl']
  },

  invoice_lookup: {
    required: ['invoiceNumber', 'amount'],
    priority: ['status', 'dueDate', 'currency'],
    optional: ['lineItems', 'taxBreakdown', 'paymentTerms']
  },

  refund_status: {
    required: ['refundId', 'status'],
    priority: ['amount', 'currency', 'expectedDate'],
    optional: ['reason', 'method', 'transactionId']
  },

  // Return tools
  return_status: {
    required: ['returnNumber', 'status'],
    priority: ['returnDate', 'refundAmount', 'approvalStatus'],
    optional: ['returnReason', 'refundMethod', 'notes']
  },

  // Appointment tools
  appointment_lookup: {
    required: ['appointmentId', 'date', 'time'],
    priority: ['status', 'duration', 'type'],
    optional: ['location', 'notes', 'practitioner']
  },

  // Account tools
  account_status: {
    required: ['accountId', 'status'],
    priority: ['email', 'phone', 'memberSince'],
    optional: ['loyaltyPoints', 'preferences', 'subscriptions']
  }
};

/**
 * Get whitelist for a tool
 * @param {string} toolName - Tool name
 * @returns {Object|null} Whitelist config or null if no whitelist
 */
export function getToolWhitelist(toolName) {
  return TOOL_FIELD_WHITELIST[toolName] || null;
}

/**
 * Apply whitelist to tool data
 * Ensures critical fields are preserved
 *
 * @param {string} toolName - Tool name
 * @param {Object} data - Tool result data
 * @param {number} maxTokens - Max tokens allowed
 * @returns {Object} Whitelisted data
 */
export function applyWhitelist(toolName, data, maxTokens = 3000) {
  const whitelist = getToolWhitelist(toolName);

  if (!whitelist) {
    // No whitelist - use generic truncation
    return data;
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  // Build result with priority order
  const result = {};
  const CHARS_PER_TOKEN = 4;
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  let charCount = 0;

  // Helper to add field
  const addField = (field) => {
    if (data[field] !== undefined) {
      const fieldStr = JSON.stringify({ [field]: data[field] });
      if (charCount + fieldStr.length <= maxChars) {
        result[field] = data[field];
        charCount += fieldStr.length;
        return true;
      }
    }
    return false;
  };

  // 1. Add REQUIRED fields (error if missing)
  for (const field of whitelist.required || []) {
    if (data[field] === undefined) {
      console.error(`🚨 [ToolWhitelist] CRITICAL: Required field missing from ${toolName}: ${field}`);
    } else if (!addField(field)) {
      console.error(`🚨 [ToolWhitelist] CRITICAL: Required field too large for ${toolName}: ${field}`);
    }
  }

  // 2. Add PRIORITY fields
  for (const field of whitelist.priority || []) {
    addField(field);
  }

  // 3. Add OPTIONAL fields if space permits
  for (const field of whitelist.optional || []) {
    if (charCount >= maxChars) break;
    addField(field);
  }

  // 4. Add any remaining fields not in whitelist (if space)
  for (const [field, value] of Object.entries(data)) {
    if (result[field] !== undefined) continue; // Already added

    if (charCount >= maxChars) break;

    const fieldStr = JSON.stringify({ [field]: value });
    if (charCount + fieldStr.length <= maxChars) {
      result[field] = value;
      charCount += fieldStr.length;
    }
  }

  return result;
}

/**
 * Validate tool result has required fields
 * @param {string} toolName - Tool name
 * @param {Object} data - Tool result data
 * @returns {Object} { valid: boolean, missingFields: string[] }
 */
export function validateToolResult(toolName, data) {
  const whitelist = getToolWhitelist(toolName);

  if (!whitelist || !whitelist.required) {
    return { valid: true, missingFields: [] };
  }

  const missingFields = [];

  for (const field of whitelist.required) {
    if (!data || data[field] === undefined) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

export default {
  TOOL_FIELD_WHITELIST,
  getToolWhitelist,
  applyWhitelist,
  validateToolResult
};

/**
 * Field Name Normalizer (SSOT)
 *
 * Canonical mapping between policy field names, tool argument names,
 * and extraction output names. This prevents "drift" where different
 * parts of the system use different names for the same concept.
 *
 * Example drift this fixes:
 *   - toolRequiredPolicy says "order_id" but tool schema says "order_number"
 *   - policy says "phone_number" but tool schema says "phone"
 */

/**
 * Canonical alias map: legacy/policy name → tool schema name
 * Tool schema names are the source of truth.
 */
const FIELD_ALIAS_MAP = Object.freeze({
  // Order identifiers
  'order_id':         'order_number',
  'orderId':          'order_number',
  'siparis_no':       'order_number',

  // Phone identifiers
  'phone_number':     'phone',
  'phoneNumber':      'phone',
  'telefon':          'phone',

  // Customer identifiers
  'customer_name':    'customer_name',
  'name':             'customer_name',

  // Tax identifiers
  'tax_id':           'vkn',
  'national_id':      'tc',

  // Ticket identifiers
  'ticket_id':        'ticket_number',
  'ticketId':         'ticket_number',
  'service_number':   'ticket_number',

  // These are already canonical (identity mapping)
  'order_number':     'order_number',
  'phone':            'phone',
  'vkn':              'vkn',
  'tc':               'tc',
  'ticket_number':    'ticket_number',
  'invoice_number':   'invoice_number',
  'tracking_number':  'tracking_number',
  'product_id':       'product_id',
  'product_name':     'product_name',
  'sku':              'sku',
  'return_number':    'return_number',
  'email':            'email',
  'query_type':       'query_type',
  'verification_input': 'verification_input',
});

/**
 * Normalize a field name from any source to canonical tool schema name
 * @param {string} fieldName - Field name from policy, extraction, or other source
 * @returns {string} Canonical tool schema field name
 */
export function canonicalFieldName(fieldName) {
  if (!fieldName) return fieldName;
  return FIELD_ALIAS_MAP[fieldName] || fieldName;
}

/**
 * Normalize all keys in a tool args object to canonical names
 * @param {Object} args - Tool arguments with potentially non-canonical keys
 * @returns {Object} Same args with canonical key names
 */
export function canonicalizeToolArgs(args) {
  if (!args || typeof args !== 'object') return args;

  const normalized = {};
  for (const [key, value] of Object.entries(args)) {
    const canonicalKey = canonicalFieldName(key);
    // If two source keys map to the same canonical key, prefer non-null
    if (normalized[canonicalKey] === undefined || normalized[canonicalKey] === null) {
      normalized[canonicalKey] = value;
    }
  }
  return normalized;
}

/**
 * Normalize an array of required field names to canonical names
 * @param {string[]} fields - Array of field names
 * @returns {string[]} Array of canonical field names (deduplicated)
 */
export function canonicalizeFieldList(fields) {
  if (!Array.isArray(fields)) return fields;
  const canonical = fields.map(canonicalFieldName);
  return [...new Set(canonical)]; // Deduplicate
}

export default {
  FIELD_ALIAS_MAP,
  canonicalFieldName,
  canonicalizeToolArgs,
  canonicalizeFieldList
};

/**
 * PII Redaction for Error Logging
 *
 * Sanitizes error messages and stack traces before writing to ErrorLog table.
 * Ensures no PII (phone, email, TC kimlik, API keys, tokens) leaks into logs.
 *
 * NOTE: This is different from pii-redaction.js which does field-level masking
 * for structured data (e.g., maskPhone(phone)). This module does freetext
 * redaction — finding and replacing PII patterns within arbitrary strings.
 */

// ============================================================================
// PII PATTERNS (for freetext redaction)
// ============================================================================

const PII_PATTERNS = [
  // Turkish phone numbers: 05xx, +905xx, 5xx formats
  { pattern: /\+?90?\s?0?5[0-9]{2}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}/g, replacement: '[PHONE]' },
  { pattern: /\b0?5[0-9]{2}[0-9]{3}[0-9]{4}\b/g, replacement: '[PHONE]' },

  // Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },

  // TC Kimlik (11-digit Turkish ID starting with non-zero)
  { pattern: /\b[1-9]\d{10}\b/g, replacement: '[TC_KIMLIK]' },

  // API keys / tokens (common patterns)
  { pattern: /\b(sk|pk|api|key|token|secret|bearer|auth)[_\-]?[a-zA-Z0-9_\-]{20,}\b/gi, replacement: '[REDACTED_KEY]' },

  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, replacement: '[JWT]' },

  // URL query parameters (may contain tokens/PII)
  { pattern: /\?[^\s"']+/g, replacement: '?[QUERY_REDACTED]' },

  // Credit card patterns (basic)
  { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replacement: '[CARD]' },
];

// ============================================================================
// FINGERPRINT NORMALIZATION PATTERNS
// ============================================================================

const NORMALIZE_PATTERNS = [
  // UUIDs
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[UUID]' },

  // Numeric IDs (8+ digits)
  { pattern: /\b\d{8,}\b/g, replacement: '[ID]' },

  // ISO timestamps
  { pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\dZ+:\-]*/g, replacement: '[TIMESTAMP]' },

  // Unix timestamps (13-digit ms or 10-digit s)
  { pattern: /\b1[6-9]\d{11}\b/g, replacement: '[TIMESTAMP_MS]' },
  { pattern: /\b1[6-9]\d{8}\b/g, replacement: '[TIMESTAMP_S]' },

  // Request IDs (our format: req_timestamp_random)
  { pattern: /req_\d+_[a-z0-9]+/g, replacement: '[REQ_ID]' },

  // Session IDs
  { pattern: /ses_[a-zA-Z0-9_\-]+/g, replacement: '[SESSION_ID]' },

  // IP addresses
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },

  // Port numbers in URLs
  { pattern: /:\d{4,5}(?=\/)/g, replacement: ':[PORT]' },

  // Hex hashes (32+ chars)
  { pattern: /\b[0-9a-f]{32,}\b/gi, replacement: '[HASH]' },
];

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Redact PII from an error message.
 * Use before writing message to ErrorLog.
 *
 * @param {string} message - Raw error message
 * @returns {string} - PII-redacted message
 */
export function redactMessage(message) {
  if (!message || typeof message !== 'string') return message || '';

  let result = message;

  for (const { pattern, replacement } of PII_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Redact PII from a stack trace and truncate to max length.
 * Use before writing stackTrace to ErrorLog.
 *
 * @param {string} stack - Raw stack trace
 * @param {number} maxLength - Max chars (default 2000)
 * @returns {string} - PII-redacted, truncated stack trace
 */
export function redactStackTrace(stack, maxLength = 2000) {
  if (!stack || typeof stack !== 'string') return null;

  let result = redactMessage(stack); // First pass: PII redaction

  // Truncate
  if (result.length > maxLength) {
    result = result.substring(0, maxLength) + '\n... [truncated]';
  }

  return result;
}

/**
 * Normalize a message for fingerprint generation.
 * Removes all dynamic parts (IDs, timestamps, UUIDs, etc.) so that
 * the same error class produces the same fingerprint regardless of
 * the specific request that triggered it.
 *
 * @param {string} message - Error message
 * @returns {string} - Normalized message (for fingerprint hashing)
 */
export function normalizeForFingerprint(message) {
  if (!message || typeof message !== 'string') return '';

  let result = message;

  // First: apply PII patterns
  for (const { pattern, replacement } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  // Then: normalize dynamic parts
  for (const { pattern, replacement } of NORMALIZE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  // Lowercase for consistency
  result = result.toLowerCase().trim();

  // Take only first 200 chars for fingerprint (keep it short)
  return result.substring(0, 200);
}

export default {
  redactMessage,
  redactStackTrace,
  normalizeForFingerprint
};

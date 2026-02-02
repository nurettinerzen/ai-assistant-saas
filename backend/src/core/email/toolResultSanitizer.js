/**
 * Tool Result Sanitizer
 *
 * Protects against PII leakage and prompt bloat in tool results.
 *
 * CRITICAL RULES:
 * 1. Field Slimming: Remove verbose/duplicate fields
 * 2. PII Redaction: Scrub sensitive data before LLM
 * 3. Token Budget: Limit total size per tool result
 *
 * Priority: Business data accuracy > prompt size > PII risk
 */

import { preventPIILeak } from './policies/piiPreventionPolicy.js';
import { applyWhitelist, validateToolResult } from './toolWhitelist.js';

// Max tokens per tool result (prevents single tool from dominating prompt)
const MAX_TOKENS_PER_TOOL = 3000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS_PER_TOOL = MAX_TOKENS_PER_TOOL * CHARS_PER_TOKEN;

// Fields to ALWAYS remove (verbose/redundant/internal)
const EXCLUDED_FIELDS = [
  'createdAt',
  'updatedAt',
  'deletedAt',
  '__v',
  '_id',
  'password',
  'passwordHash',
  'salt',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'sessionId',
  'internalNotes',
  'metadata', // Too verbose, prefer specific fields
  'rawResponse'
];

// Fields that MAY contain PII (redact if strict mode)
const PII_SENSITIVE_FIELDS = [
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'taxId',
  'passportNumber',
  'driverLicense',
  'bankAccount',
  'iban',
  'routingNumber'
];

// P0-C CRITICAL: Fields that may contain HTML (must be stripped)
// Product descriptions, email bodies etc often contain HTML that can be exfiltrated
const HTML_PRONE_FIELDS = [
  'description',
  'shortDescription',
  'longDescription',
  'productDescription',
  'content',
  'html',
  'htmlContent',
  'body',
  'emailBody',
  'text',
  'summary',
  'note',
  'notes',
  'comment',
  'details'
];

/**
 * P0-C FIX: Strip HTML tags from string
 * Prevents HTML/iframe/script exfiltration through tool results
 * @param {string} str - String potentially containing HTML
 * @returns {string} Clean text without HTML tags
 */
function stripHTML(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Remove script and style tags with content
  let clean = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove dangerous tags completely (iframe, object, embed, form)
  clean = clean.replace(/<(iframe|object|embed|form|input|button)\b[^>]*>.*?<\/\1>/gis, '');
  clean = clean.replace(/<(iframe|object|embed|form|input|button|img|link)\b[^>]*\/?>/gi, '');

  // Remove all remaining HTML tags but keep content
  clean = clean.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  clean = clean.replace(/&nbsp;/g, ' ');
  clean = clean.replace(/&amp;/g, '&');
  clean = clean.replace(/&lt;/g, '<');
  clean = clean.replace(/&gt;/g, '>');
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&#39;/g, "'");

  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // Truncate if too long (descriptions shouldn't be novels)
  const MAX_DESCRIPTION_LENGTH = 500;
  if (clean.length > MAX_DESCRIPTION_LENGTH) {
    clean = clean.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
  }

  return clean;
}

/**
 * Sanitize tool results for LLM context
 *
 * @param {Array} toolResults - Raw tool results
 * @param {Object} options
 * @param {boolean} options.strict - Strict PII redaction (default: false)
 * @param {number} options.maxTokensPerTool - Max tokens per result
 * @returns {Array} Sanitized tool results
 */
export function sanitizeToolResults(toolResults, options = {}) {
  if (!toolResults || toolResults.length === 0) {
    return [];
  }

  const strict = options.strict !== undefined ? options.strict : false;
  const maxTokens = options.maxTokensPerTool || MAX_TOKENS_PER_TOOL;

  const sanitized = [];

  for (const result of toolResults) {
    try {
      const sanitizedResult = {
        toolName: result.toolName,
        outcome: result.outcome,
        message: result.message // ALWAYS include message (critical for LLM)
      };

      // Handle data field
      if (result.data && result.outcome === 'OK') {
        // CRITICAL: Apply tool-specific whitelist FIRST
        // This ensures required fields are preserved before generic slimming
        const whitelistedData = applyWhitelist(result.toolName, result.data, maxTokens);

        // Validate required fields are present
        const validation = validateToolResult(result.toolName, whitelistedData);
        if (!validation.valid) {
          console.error(`🚨 [ToolSanitizer] ${result.toolName} missing required fields: ${validation.missingFields.join(', ')}`);
          sanitizedResult.validation = {
            valid: false,
            missingFields: validation.missingFields
          };
        }

        // Slim and redact data (after whitelist)
        const slimmedData = slimFields(whitelistedData);
        const redactedData = redactPII(slimmedData, { strict });

        // Check if truncation occurred
        const originalSize = JSON.stringify(result.data).length;
        const finalSize = JSON.stringify(redactedData).length;

        if (finalSize < originalSize) {
          console.log(`📊 [ToolSanitizer] ${result.toolName} reduced: ${originalSize} → ${finalSize} chars (${Math.round((1 - finalSize/originalSize) * 100)}% reduction)`);
          sanitizedResult.truncated = true;
        }

        sanitizedResult.data = redactedData;
      }

      // Preserve verification/validation flags
      if (result.verificationRequired) {
        sanitizedResult.verificationRequired = true;
      }

      if (result.validation) {
        sanitizedResult.validation = result.validation;
      }

      if (result.notFound) {
        sanitizedResult.notFound = true;
      }

      sanitized.push(sanitizedResult);

    } catch (error) {
      console.error(`❌ [ToolSanitizer] Failed to sanitize ${result.toolName}:`, error);
      // Fallback: include minimal safe data
      sanitized.push({
        toolName: result.toolName,
        outcome: result.outcome,
        message: result.message || 'Error sanitizing tool result',
        sanitizationError: true
      });
    }
  }

  return sanitized;
}

/**
 * Remove excluded/verbose fields and strip HTML from prone fields
 */
function slimFields(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => slimFields(item));
  }

  const slimmed = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip excluded fields
    if (EXCLUDED_FIELDS.includes(key)) {
      continue;
    }

    // Recursively slim nested objects
    if (value && typeof value === 'object') {
      slimmed[key] = slimFields(value);
    } else if (typeof value === 'string') {
      // P0-C FIX: Strip HTML from fields that commonly contain it
      if (HTML_PRONE_FIELDS.includes(key) || HTML_PRONE_FIELDS.includes(key.toLowerCase())) {
        const stripped = stripHTML(value);
        if (stripped !== value) {
          console.log(`🧹 [ToolSanitizer] HTML stripped from field: ${key}`);
        }
        slimmed[key] = stripped;
      } else {
        slimmed[key] = value;
      }
    } else {
      slimmed[key] = value;
    }
  }

  return slimmed;
}

/**
 * Redact PII from data
 */
function redactPII(data, options = {}) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const strict = options.strict || false;

  if (Array.isArray(data)) {
    return data.map(item => redactPII(item, options));
  }

  const redacted = {};

  for (const [key, value] of Object.entries(data)) {
    // HARD BLOCK: Never include these fields
    if (PII_SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
      console.warn(`⚠️ [ToolSanitizer] PII field redacted: ${key}`);
      continue;
    }

    // Recursively redact nested objects
    if (value && typeof value === 'object') {
      redacted[key] = redactPII(value, options);
    } else if (typeof value === 'string') {
      // Apply PII scrubbing to string values
      const scrubbed = preventPIILeak(value, { strict });
      if (scrubbed.modified) {
        console.warn(`⚠️ [ToolSanitizer] PII detected in field: ${key}`);
      }
      redacted[key] = scrubbed.content;
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Truncate data to token limit
 * Preserves most important fields first
 */
function truncateData(data, maxTokens) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // Priority fields (always include if possible)
  const priorityFields = [
    'id',
    'status',
    'orderNumber',
    'trackingNumber',
    'amount',
    'total',
    'date',
    'name',
    'email',
    'phone'
  ];

  const truncated = {};
  let charCount = 0;

  // First pass: Add priority fields
  for (const field of priorityFields) {
    if (data[field] !== undefined) {
      const fieldStr = JSON.stringify({ [field]: data[field] });
      if (charCount + fieldStr.length <= maxChars) {
        truncated[field] = data[field];
        charCount += fieldStr.length;
      }
    }
  }

  // Second pass: Add remaining fields until budget exhausted
  for (const [key, value] of Object.entries(data)) {
    if (truncated[key] !== undefined) continue; // Already added

    const fieldStr = JSON.stringify({ [key]: value });
    if (charCount + fieldStr.length <= maxChars) {
      truncated[key] = value;
      charCount += fieldStr.length;
    } else {
      // Budget exhausted
      break;
    }
  }

  return truncated;
}

/**
 * Get sanitization stats
 */
export function getSanitizationStats(originalResults, sanitizedResults) {
  const originalSize = JSON.stringify(originalResults).length;
  const sanitizedSize = JSON.stringify(sanitizedResults).length;

  return {
    originalSize,
    sanitizedSize,
    reduction: originalSize - sanitizedSize,
    reductionPercent: Math.round(((originalSize - sanitizedSize) / originalSize) * 100),
    truncatedCount: sanitizedResults.filter(r => r.truncated).length,
    redactedCount: sanitizedResults.filter(r =>
      JSON.stringify(r).includes('[REDACTED]')
    ).length
  };
}

export default {
  sanitizeToolResults,
  getSanitizationStats
};

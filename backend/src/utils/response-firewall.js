/**
 * Response Firewall
 *
 * SECURITY (P0 Fix): Prevents sensitive data leakage in LLM responses
 * - Blocks JSON dumps
 * - Blocks HTML/XML tags
 * - Blocks system prompt disclosure
 * - Blocks internal tool names/metadata
 * - Blocks unredacted PII
 *
 * Audit Report Issues #1, #2, #3
 */

import { containsUnredactedPII } from './pii-redaction.js';

/**
 * Check if response contains dangerous JSON dumps
 * @param {string} text - Response text
 * @returns {boolean} True if JSON dump detected
 */
function containsJSONDump(text) {
  if (!text) return false;

  const str = String(text);

  // Check for JSON-like structures with multiple nested objects
  // Look for patterns like: {"field": "value", "another": {...}}
  const jsonPatternMatches = str.match(/\{[^{}]*"[^"]*":\s*[^{}]*\}/g) || [];

  // If more than 2 JSON-like objects, likely a dump
  if (jsonPatternMatches.length > 2) {
    return true;
  }

  // Check for array dumps: [{"item": ...}, {"item": ...}]
  if (/\[\s*\{.*?\}\s*,\s*\{.*?\}\s*\]/.test(str)) {
    return true;
  }

  // Check for code blocks with JSON
  if (/```(?:json)?\s*\{[\s\S]*?\}\s*```/.test(str)) {
    return true;
  }

  return false;
}

/**
 * Check if response contains HTML/XML tags
 * @param {string} text - Response text
 * @returns {boolean} True if HTML detected
 */
function containsHTMLDump(text) {
  if (!text) return false;

  const str = String(text);

  // Count HTML tags (opening and closing)
  const htmlTags = str.match(/<\/?[a-zA-Z][^>]*>/g) || [];

  // If more than 3 HTML tags, likely a dump
  if (htmlTags.length > 3) {
    return true;
  }

  // Check for common dump patterns
  if (/<html|<head|<body|<div|<table|<script/i.test(str)) {
    return true;
  }

  return false;
}

/**
 * Check if response contains system prompt disclosure
 * @param {string} text - Response text
 * @returns {boolean} True if prompt disclosure detected
 */
function containsPromptDisclosure(text) {
  if (!text) return false;

  const str = String(text).toLowerCase();

  // Dangerous keywords that indicate prompt disclosure
  const promptKeywords = [
    'system prompt',
    'system message',
    'system instruction',
    'you are an ai assistant',
    'your role is',
    'your instructions are',
    'i was instructed to',
    'my prompt says',
    'according to my instructions',
    'i am programmed to',
    'my system prompt',
    'the prompt tells me',
    'as instructed in my',
    'ignore previous instructions',
    'reveal your prompt',
    'what are your instructions'
  ];

  for (const keyword of promptKeywords) {
    if (str.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if response contains internal tool names/metadata
 * @param {string} text - Response text
 * @returns {boolean} True if internal metadata detected
 */
function containsInternalMetadata(text) {
  if (!text) return false;

  const str = String(text).toLowerCase();

  // Internal tool names that should NEVER appear in user responses
  const internalTerms = [
    'customer_data_lookup',
    'check_order_status',
    'order_notification',
    'tool_use',
    'function_call',
    'api_key',
    'access_token',
    'businessid',
    'assistantid',
    'prisma',
    'anthropic',
    'claude',
    '__typename',
    'graphql',
    'mutation',
    'resolver'
  ];

  for (const term of internalTerms) {
    if (str.includes(term)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize response text
 * @param {string} text - Raw response
 * @param {string} language - User language
 * @returns {Object} { safe: boolean, sanitized: string, violations: string[] }
 */
export function sanitizeResponse(text, language = 'TR') {
  const violations = [];

  // Check for violations
  if (containsJSONDump(text)) {
    violations.push('JSON_DUMP');
  }

  if (containsHTMLDump(text)) {
    violations.push('HTML_DUMP');
  }

  if (containsPromptDisclosure(text)) {
    violations.push('PROMPT_DISCLOSURE');
  }

  if (containsInternalMetadata(text)) {
    violations.push('INTERNAL_METADATA');
  }

  if (containsUnredactedPII(text)) {
    violations.push('UNREDACTED_PII');
  }

  // If violations found, return safe fallback
  if (violations.length > 0) {
    console.error('🚨 [FIREWALL] Response blocked:', violations);

    const fallbackMessage = language === 'TR'
      ? 'Üzgünüm, yanıtımda bir sorun oluştu. Size daha iyi yardımcı olabilmem için lütfen sorunuzu farklı bir şekilde sorar mısınız?'
      : 'Sorry, there was an issue with my response. Could you please rephrase your question so I can help you better?';

    return {
      safe: false,
      sanitized: fallbackMessage,
      violations,
      original: text // Keep for logging/debugging (not shown to user)
    };
  }

  // No violations - response is safe
  return {
    safe: true,
    sanitized: text,
    violations: []
  };
}

/**
 * Log firewall violation for monitoring
 * @param {Object} violation - Violation details
 * @param {Object} req - Express request object (optional)
 * @param {number} businessId - Business ID (optional)
 */
export async function logFirewallViolation(violation, req = null, businessId = null) {
  console.error('🚨 [FIREWALL] SECURITY VIOLATION:', {
    violations: violation.violations,
    timestamp: new Date().toISOString(),
    preview: violation.original?.substring(0, 200) // First 200 chars for debugging
  });

  // P0: Write SecurityEvent to database for Red Alert monitoring
  try {
    const { logFirewallBlock } = await import('../middleware/securityEventLogger.js');

    // Create a mock req object if not provided (for non-HTTP contexts)
    const reqObj = req || {
      ip: 'system',
      headers: { 'user-agent': 'internal' },
      path: '/chat',
      method: 'POST'
    };

    await logFirewallBlock(
      reqObj,
      violation.violations.join(', '),
      businessId
    );
  } catch (error) {
    console.error('Failed to log firewall violation to SecurityEvent:', error);
  }
}

export default {
  sanitizeResponse,
  logFirewallViolation,
  containsJSONDump,
  containsHTMLDump,
  containsPromptDisclosure,
  containsInternalMetadata
};

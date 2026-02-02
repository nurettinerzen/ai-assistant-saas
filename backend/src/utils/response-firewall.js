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

  const str = String(text);
  const strLower = str.toLowerCase();
  const strLowerTR = str.toLocaleLowerCase('tr-TR');

  // English prompt disclosure keywords
  const promptKeywordsEN = [
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
    'what are your instructions',
    'my rules are',
    'here are my rules',
    'my guidelines say'
  ];

  // Turkish prompt disclosure keywords (P0-A fix)
  const promptKeywordsTR = [
    'yönergeler',
    'yönergeleri',
    'talimatlar',
    'talimatlarım',
    'kurallarım',
    'kuralları aşağıda',
    'kuralları şöyle',
    'kendime hatırlatmam gereken',
    'bana verilen kurallar',
    'bana verilen yönergeler',
    'sistem promptu',
    'off-topic kuralı',
    'mutlaka uygula',
    'kritik kural',
    'yasak konular',
    'persona kilidi',
    'bilgi kaynağı',
    'konuşma tarzı',
    'tool kullanımı'
  ];

  // Check English keywords
  for (const keyword of promptKeywordsEN) {
    if (strLower.includes(keyword)) {
      return true;
    }
  }

  // Check Turkish keywords with proper locale
  for (const keyword of promptKeywordsTR) {
    if (strLowerTR.includes(keyword.toLocaleLowerCase('tr-TR'))) {
      return true;
    }
  }

  // Check for markdown headers that look like prompt sections
  // e.g., "## SEN KİMSİN", "## SINIRLAR", "## YASAK KONULAR"
  const promptSectionPatterns = [
    /##\s*(sen\s*kimsin|who\s*you\s*are)/i,
    /##\s*(sınırlar|limits|boundaries)/i,
    /##\s*(yasak\s*konular|forbidden\s*topics)/i,
    /##\s*(kişiliğin|personality)/i,
    /##\s*(bilgi\s*kaynağı|knowledge\s*source)/i,
    /##\s*(tool\s*kullanımı|tool\s*usage)/i,
    /##\s*(geri\s*arama|callback)/i,
    /##\s*(hafıza|memory)/i,
    /##\s*(dil|language)/i,
    /##\s*(persona\s*kilidi|persona\s*lock)/i
  ];

  for (const pattern of promptSectionPatterns) {
    if (pattern.test(str)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if response contains internal tool names/metadata
 * P1 Fix: Prevents tool name disclosure to end users
 * @param {string} text - Response text
 * @returns {boolean} True if internal metadata detected
 */
function containsInternalMetadata(text) {
  if (!text) return false;

  const str = String(text).toLowerCase();

  // Internal tool names that should NEVER appear in user responses
  // P1 Fix: Comprehensive list of all internal tool names
  const internalTerms = [
    // Tool names (snake_case)
    'customer_data_lookup',
    'check_order_status',
    'order_notification',
    'update_customer',
    'create_ticket',
    'search_products',
    'get_product_details',
    'check_stock',
    'calculate_shipping',
    'send_email',
    'send_sms',
    'log_callback_request',
    'get_faq',
    'search_knowledge_base',
    'crm_search',
    'order_search',
    'product_search',

    // Tool names (camelCase variants)
    'customerDataLookup',
    'checkOrderStatus',
    'orderNotification',
    'updateCustomer',
    'createTicket',
    'searchProducts',
    'getProductDetails',
    'checkStock',
    'calculateShipping',
    'sendEmail',
    'sendSms',
    'logCallbackRequest',
    'getFaq',
    'searchKnowledgeBase',
    'crmSearch',
    'orderSearch',
    'productSearch',

    // System internals
    'tool_use',
    'tool_result',
    'function_call',
    'function_result',
    'api_key',
    'access_token',
    'bearer token',
    'jwt token',
    'businessid',
    'assistantid',
    'conversationid',
    'sessionid',
    'requestid',

    // Technical internals
    'prisma',
    'anthropic',
    'claude-3',
    'claude-2',
    'gpt-4',
    'openai',
    '__typename',
    'graphql',
    'mutation',
    'resolver',
    'middleware',
    'endpoint',
    'webhook',

    // Database/schema terms
    'mongodb',
    'postgresql',
    'collection:',
    'table:',
    'foreign key',
    'primary key'
  ];

  for (const term of internalTerms) {
    if (str.includes(term)) {
      console.warn(`🚨 [Firewall] Internal term detected: ${term}`);
      return true;
    }
  }

  // P1 Fix: Check for tool invocation patterns
  // e.g., "I used customer_data_lookup tool" or "calling check_order_status"
  const toolInvocationPatterns = [
    /\b(used|using|called|calling|invoke|invoking|ran|running)\s+\w+_\w+\s*(tool|function)?/i,
    /\btool:\s*\w+/i,
    /\bfunction:\s*\w+/i,
    /\btoolName:\s*["']?\w+/i
  ];

  for (const pattern of toolInvocationPatterns) {
    if (pattern.test(str)) {
      console.warn(`🚨 [Firewall] Tool invocation pattern detected`);
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

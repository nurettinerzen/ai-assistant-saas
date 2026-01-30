/**
 * Log Redaction Utilities
 * Prevents sensitive data from appearing in logs
 *
 * SECURITY:
 * - Redacts Authorization headers
 * - Redacts webhook signatures
 * - Redacts API keys and secrets
 * - Redacts PII (email, phone, payment info)
 */

/**
 * Sensitive header patterns to redact
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'x-cron-secret',
  'x-hub-signature',
  'x-hub-signature-256',
  'x-crm-signature',
  'elevenlabs-signature',
  'stripe-signature',
  'x-webhook-secret'
];

/**
 * Sensitive field patterns in request bodies
 */
const SENSITIVE_BODY_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'webhookSecret',
  'webhook_secret',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ssn',
  'social_security',
  'embedKey',
  'embed_key'
];

/**
 * PII patterns (partial redaction)
 */
const PII_PATTERNS = {
  email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g
};

/**
 * Redact sensitive value
 * @param {string} value - Value to redact
 * @param {boolean} partial - Show partial value (e.g., last 4 digits)
 * @returns {string} Redacted value
 */
function redactValue(value, partial = false) {
  if (!value || typeof value !== 'string') {
    return '[REDACTED]';
  }

  if (partial && value.length > 8) {
    // Show last 4 characters
    return `***${value.slice(-4)}`;
  }

  return '[REDACTED]';
}

/**
 * Redact sensitive headers
 * @param {object} headers - Request headers object
 * @returns {object} Redacted headers
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const redacted = { ...headers };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      redacted[key] = redactValue(redacted[key], true);
    }
  }

  return redacted;
}

/**
 * Redact sensitive fields in object (recursive)
 * @param {any} obj - Object to redact
 * @param {number} depth - Current recursion depth
 * @returns {any} Redacted object
 */
export function redactObject(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const redacted = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if field is sensitive
      if (SENSITIVE_BODY_FIELDS.some(pattern => lowerKey.includes(pattern))) {
        redacted[key] = redactValue(String(value), true);
      } else if (typeof value === 'object') {
        redacted[key] = redactObject(value, depth + 1);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  // Primitive values
  return obj;
}

/**
 * Redact PII in string (partial masking)
 * @param {string} str - String to redact
 * @returns {string} String with PII redacted
 */
export function redactPII(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let redacted = str;

  // Redact emails: user@domain.com → u***@domain.com
  redacted = redacted.replace(PII_PATTERNS.email, (match, user, domain) => {
    return `${user[0]}***@${domain}`;
  });

  // Redact phones: +1-555-123-4567 → +1-555-***-4567
  redacted = redacted.replace(PII_PATTERNS.phone, (match) => {
    const last4 = match.slice(-4);
    return `***-${last4}`;
  });

  // Redact credit cards: 4111-1111-1111-1111 → ****-****-****-1111
  redacted = redacted.replace(PII_PATTERNS.creditCard, (match) => {
    const last4 = match.replace(/[\s-]/g, '').slice(-4);
    return `****-****-****-${last4}`;
  });

  // Redact SSNs: 123-45-6789 → ***-**-6789
  redacted = redacted.replace(PII_PATTERNS.ssn, (match) => {
    const last4 = match.slice(-4);
    return `***-**-${last4}`;
  });

  return redacted;
}

/**
 * Safe console.log wrapper with automatic redaction
 * @param {string} message - Log message
 * @param {any} data - Data to log (will be redacted)
 */
export function safeLog(message, data = null) {
  if (data) {
    const redacted = redactObject(data);
    console.log(message, redacted);
  } else {
    console.log(redactPII(message));
  }
}

/**
 * Middleware: Redact sensitive data in request logs
 *
 * Usage:
 *   app.use(logRedactionMiddleware);
 *
 * Automatically redacts:
 * - Authorization headers
 * - Webhook signatures
 * - Request body secrets
 */
export function logRedactionMiddleware(req, res, next) {
  // Store original values
  const originalHeaders = req.headers;
  const originalBody = req.body;

  // Override req.log if using a logger (winston, pino, etc.)
  if (req.log) {
    const originalLog = req.log;
    req.log = {
      ...originalLog,
      info: (...args) => originalLog.info(...args.map(redactObject)),
      warn: (...args) => originalLog.warn(...args.map(redactObject)),
      error: (...args) => originalLog.error(...args.map(redactObject)),
      debug: (...args) => originalLog.debug(...args.map(redactObject))
    };
  }

  // Add safe logging helper to request
  req.safeLog = (message, data) => safeLog(message, data);

  next();
}

/**
 * Create safe request summary for logging
 * @param {object} req - Express request object
 * @returns {object} Safe request summary
 */
export function getSafeRequestSummary(req) {
  return {
    method: req.method,
    path: req.path,
    query: redactObject(req.query),
    headers: redactHeaders(req.headers),
    body: redactObject(req.body),
    ip: req.ip,
    timestamp: new Date().toISOString()
  };
}

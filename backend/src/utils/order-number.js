/**
 * Order number helpers.
 *
 * Product principle:
 * - DB is the source of truth for order-number validity.
 * - Pre-checks should be minimal (empty / too short only).
 *
 * NOTE:
 * `normalizeOrderNumber` still strips well-known prefixes to improve DB matching
 * across heterogeneous data sources (e.g. "ORD-12345" vs "12345").
 */

export const SUPPORTED_ORDER_PREFIXES = Object.freeze([
  'SIPARIS',
  'ORDER',
  'ORD',
  'SIP'
]);

function normalizeInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase().replace(/\s+/g, ' ');
}

function splitSupportedPrefix(rawOrderNumber) {
  for (const prefix of SUPPORTED_ORDER_PREFIXES) {
    if (rawOrderNumber.startsWith(prefix)) {
      const remainder = rawOrderNumber
        .substring(prefix.length)
        .replace(/^[\s\-_]+/, '');
      return { prefix, remainder };
    }
  }

  return { prefix: null, remainder: rawOrderNumber };
}

/**
 * Normalize order number for DB lookup (prefix stripped, separators removed).
 */
export function normalizeOrderNumber(orderNumber) {
  const raw = normalizeInput(orderNumber);
  if (!raw) return raw;

  const { remainder } = splitSupportedPrefix(raw);
  return remainder.replace(/[\s\-_]/g, '');
}

/**
 * Normalize user-provided order number for direct DB query attempts.
 * Keeps semantic characters, just trims/cases/collapses extra spaces.
 */
export function normalizeOrderLookupInput(orderNumber) {
  return normalizeInput(orderNumber);
}

/**
 * Minimal sanity check only.
 *
 * Intentionally does NOT enforce regex/prefix rules so valid-but-unusual
 * order numbers can still be checked against DB.
 */
export function isLikelyValidOrderNumber(orderNumber) {
  const raw = normalizeOrderLookupInput(orderNumber);
  if (!raw) return false;

  const compact = raw.replace(/[\s\-_]/g, '');
  if (compact.length < 3) return false;

  // Must contain at least one alphanumeric character.
  return /[A-Z0-9]/.test(compact);
}

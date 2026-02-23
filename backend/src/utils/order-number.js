/**
 * Order Number Normalization + Validation Contract
 *
 * Production-supported prefixes are intentionally strict:
 * - ORD
 * - ORDER
 * - SIP
 * - SIPARIS
 *
 * Accepted examples:
 * - ORD-123456
 * - ORDER_2024_001
 * - SIP 987654
 * - 123456
 *
 * Rejected examples:
 * - ORD-TEST-7890  (alpha segment in numeric body)
 * - XYZ9999        (unsupported prefix)
 */

export const SUPPORTED_ORDER_PREFIXES = Object.freeze([
  'SIPARIS',
  'ORDER',
  'ORD',
  'SIP'
]);

export const ORDER_NUMBER_EXAMPLE = 'ORD-123456';

function normalizeInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
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
 *
 * Examples:
 * - "ORD-12345" => "12345"
 * - "SIP 12345" => "12345"
 * - "12345" => "12345"
 */
export function normalizeOrderNumber(orderNumber) {
  const raw = normalizeInput(orderNumber);
  if (!raw) return raw;

  const { remainder } = splitSupportedPrefix(raw);
  return remainder.replace(/[\s\-_]/g, '');
}

/**
 * Determine whether order number matches production validation contract.
 *
 * Rules:
 * - Prefixed forms are valid only when prefix is supported and body is numeric.
 * - Plain numeric identifiers are valid.
 * - Unknown alpha prefixes / alpha body segments are invalid.
 */
export function isLikelyValidOrderNumber(orderNumber) {
  const raw = normalizeInput(orderNumber);
  if (!raw) return false;

  const { prefix, remainder } = splitSupportedPrefix(raw);

  if (prefix) {
    if (!remainder) return false;
    if (!/^[\d\s\-_]+$/.test(remainder)) return false;
    return remainder.replace(/\D/g, '').length >= 3;
  }

  if (/[A-Z]/.test(raw)) return false;
  if (!/^[\d\s\-_]+$/.test(raw)) return false;

  return raw.replace(/\D/g, '').length >= 3;
}

export function getOrderNumberValidationMessage(language = 'TR') {
  if (String(language || '').toUpperCase() === 'EN') {
    return `Order numbers are usually in this format: ${ORDER_NUMBER_EXAMPLE}. Could you share your order number?`;
  }

  return `Sipariş numaran genelde şu formatta olur: ${ORDER_NUMBER_EXAMPLE}. Elindeki sipariş numarasını paylaşır mısın?`;
}


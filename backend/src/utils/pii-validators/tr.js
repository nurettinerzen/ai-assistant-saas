/**
 * TR PII Validators — deterministic checksum-based validation
 *
 * Provides TCKN (TC Kimlik), VKN (Vergi Kimlik), and TR phone validators.
 * Used by:
 *   - customer-data-lookup handler (tool input validation)
 *   - pii-redaction (output PII detection in response firewall)
 *
 * TCKN algorithm reused from email/policies/piiValidation.js:isValidTCKimlik()
 * VKN algorithm: standard Turkish tax ID checksum (10-digit, modular arithmetic)
 */

/**
 * Validate Turkish TC Kimlik number (11 digits, checksum-based)
 *
 * Algorithm:
 * - 11 digits, first digit != 0
 * - 10th digit = (sum(odd positions 1,3,5,7,9) * 7 - sum(even positions 2,4,6,8)) % 10
 * - 11th digit = sum(first 10 digits) % 10
 *
 * @param {string|number} value — raw input (digits extracted automatically)
 * @returns {boolean}
 */
export function isValidTckn(value) {
  const cleaned = String(value || '').replace(/\D/g, '');
  if (cleaned.length !== 11 || cleaned[0] === '0') return false;

  const d = cleaned.split('').map(Number);

  // 10th digit validation
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  const d10 = (oddSum * 7 - evenSum) % 10;
  if (d10 < 0 || d[9] !== d10) return false;

  // 11th digit validation
  const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return d[10] === sum10 % 10;
}

/**
 * Validate Turkish VKN (Vergi Kimlik Numarasi) — 10 digits, checksum-based
 *
 * Algorithm:
 * For each of the first 9 digits (position i, 0-indexed):
 *   1. tmp = (digit[i] + (9 - i)) % 10
 *   2. If tmp == 0: contribute 0
 *   3. Else: v = (tmp * 2^(9-i)) % 9; if v == 0 then v = 9
 *   4. sum += v
 * checkDigit = (10 - (sum % 10)) % 10
 * Valid if digit[9] == checkDigit
 *
 * @param {string|number} value — raw input (digits extracted automatically)
 * @returns {boolean}
 */
export function isValidVkn(value) {
  const cleaned = String(value || '').replace(/\D/g, '');
  if (cleaned.length !== 10) return false;

  const d = cleaned.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    if (tmp === 0) continue; // contribute 0
    let v = (tmp * Math.pow(2, 9 - i)) % 9;
    if (v === 0) v = 9;
    sum += v;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return d[9] === checkDigit;
}

/**
 * Heuristic check for Turkish mobile phone number
 *
 * Patterns:
 * - 05XXXXXXXXX (11 digits, starts with 05)
 * - 5XXXXXXXXX  (10 digits, starts with 5)
 * - 905XXXXXXXXX (12 digits, starts with 905 — country code without +)
 *
 * @param {string|number} value — raw input (digits extracted automatically)
 * @returns {boolean}
 */
export function isLikelyTrPhone(value) {
  const cleaned = String(value || '').replace(/\D/g, '');

  // 05XXXXXXXXX — standard TR mobile format
  if (cleaned.length === 11 && cleaned.startsWith('05')) return true;
  // 5XXXXXXXXX — without leading 0
  if (cleaned.length === 10 && cleaned.startsWith('5')) return true;
  // 905XXXXXXXXX — international without +
  if (cleaned.length === 12 && cleaned.startsWith('905')) return true;

  return false;
}

export default { isValidTckn, isValidVkn, isLikelyTrPhone };

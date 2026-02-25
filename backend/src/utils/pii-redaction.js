/**
 * PII Redaction Utility
 *
 * SECURITY: Masks personally identifiable information before returning to LLM.
 * Critical for preventing PII leakage in chat responses.
 *
 * P0 Security Fix: Audit Report Issue #2 - PII Leakage
 */

import { isValidTckn, isValidVkn } from './pii-validators/tr.js';

/**
 * Mask phone number
 * @param {string} phone - Full phone number
 * @returns {string} Masked phone number (e.g., "+90******1234")
 */
export function maskPhone(phone) {
  if (!phone) return null;

  const cleaned = String(phone).replace(/[^\d+]/g, '');

  if (cleaned.length < 4) {
    return '****'; // Too short to mask safely
  }

  // Show first 3 chars (country code) and last 4 digits
  // Examples:
  // +905551234567 (13 chars) → +90******4567 (3 + 6 + 4)
  // 05551234567 (11 chars) → 055******4567 (3 + 6 + 4)
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-4);
  const maskLength = cleaned.length - 7; // total - prefix(3) - suffix(4)

  // Minimum 6 stars for consistency
  return `${prefix}${'*'.repeat(Math.max(maskLength, 6))}${suffix}`;
}

/**
 * Mask email address
 * @param {string} email - Full email address
 * @returns {string} Masked email (e.g., "a***@example.com")
 */
export function maskEmail(email) {
  if (!email) return null;

  const [local, domain] = String(email).split('@');

  if (!domain) {
    return '****'; // Invalid email
  }

  if (local.length <= 2) {
    return `**@${domain}`;
  }

  // Show first char, mask rest of local part
  return `${local[0]}***@${domain}`;
}

/**
 * Mask TC (Turkish ID number)
 * @param {string} tc - Turkish ID number
 * @returns {string} Masked TC (e.g., "***********")
 */
export function maskTC(tc) {
  if (!tc) return null;

  // TC is 11 digits - mask completely for maximum security
  const cleaned = String(tc).replace(/\D/g, '');

  if (cleaned.length === 11) {
    return '***********'; // All masked
  }

  return '****'; // Invalid TC
}

/**
 * Mask VKN (Turkish Tax ID)
 * @param {string} vkn - Turkish Tax ID
 * @returns {string} Masked VKN (e.g., "**********")
 */
export function maskVKN(vkn) {
  if (!vkn) return null;

  // VKN is 10 digits - mask completely
  const cleaned = String(vkn).replace(/\D/g, '');

  if (cleaned.length === 10) {
    return '**********';
  }

  return '****'; // Invalid VKN
}

/**
 * Mask full address
 * @param {string} address - Full address
 * @returns {string} Partial address (city/district only)
 */
export function maskAddress(address) {
  if (!address) return null;

  // Extract only city/district level information
  // Example: "Atatürk Mah. 123 Sok No:5 Kadıköy/İstanbul" → "Kadıköy/İstanbul"

  const addressStr = String(address);

  // Try to find city/district pattern (word/word at end)
  const districtCityMatch = addressStr.match(/([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)\/([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)$/);
  if (districtCityMatch) {
    return districtCityMatch[0].trim();
  }

  // Otherwise just return city if recognizable
  const turkishCities = [
    'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya',
    'Gaziantep', 'Mersin', 'Kayseri', 'Eskişehir', 'Diyarbakır', 'Samsun',
    'Denizli', 'Şanlıurfa', 'Adapazarı', 'Malatya', 'Kahramanmaraş', 'Erzurum',
    'Van', 'Batman', 'Elazığ', 'İzmit', 'Manisa', 'Sivas', 'Gebze', 'Balıkesir',
    'Tarsus', 'Kütahya', 'Trabzon', 'Çorum', 'Çorlu', 'Adıyaman', 'Osmaniye',
    'Kırıkkale', 'Antakya', 'Aydın', 'İskenderun', 'Uşak', 'Aksaray'
  ];

  for (const city of turkishCities) {
    if (addressStr.includes(city)) {
      return city;
    }
  }

  // If no pattern found, return generic
  return 'Adres kayıtlı';
}

/**
 * Redact all PII from an object
 * @param {Object} data - Data object potentially containing PII
 * @returns {Object} Redacted copy of data
 */
export function redactPII(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const redacted = { ...data };

  // Redact common PII fields
  if (redacted.phone) redacted.phone = maskPhone(redacted.phone);
  if (redacted.customerPhone) redacted.customerPhone = maskPhone(redacted.customerPhone);
  if (redacted.email) redacted.email = maskEmail(redacted.email);
  if (redacted.customerEmail) redacted.customerEmail = maskEmail(redacted.customerEmail);
  if (redacted.tcNo) redacted.tcNo = maskTC(redacted.tcNo);
  if (redacted.vkn) redacted.vkn = maskVKN(redacted.vkn);
  if (redacted.address) redacted.address = maskAddress(redacted.address);
  if (redacted.fullAddress) redacted.fullAddress = maskAddress(redacted.fullAddress);

  return redacted;
}

/**
 * Check if a string contains unredacted PII
 * P0-B CRITICAL: This is the last line of defense for PII leakage
 *
 * Uses checksum-validated detection for TC/VKN instead of blind digit-count regex.
 * This prevents false positives on order numbers, tracking numbers, and invalid IDs.
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if potential PII found
 */
export function containsUnredactedPII(text) {
  if (!text) return false;

  const str = String(text);

  // 1. Turkish phone number patterns (specific prefix-based, low false-positive)
  const turkishPhonePatterns = [
    /\b0?5[0-9]{2}[0-9]{3}[0-9]{4}\b/,           // 05xx or 5xx format
    /\+90\s?5[0-9]{2}\s?[0-9]{3}\s?[0-9]{4}/,    // +90 format with spaces
    /0[0-9]{3}[0-9]{3}[0-9]{4}/                   // Other Turkish landline
  ];

  for (const pattern of turkishPhonePatterns) {
    if (pattern.test(str)) {
      console.warn('🚨 [PII-Redaction] Unmasked phone number detected!');
      return true;
    }
  }

  // 2. Email patterns
  if (/[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(str)) {
    console.warn('🚨 [PII-Redaction] Email address detected');
    return true;
  }

  // 3. Digit sequences — checksum-validated detection (NOT blind catch-all)
  // Extract 10+ consecutive digit sequences from space-stripped text,
  // then validate each as TCKN (11-digit checksum) or VKN (10-digit checksum).
  // Invalid checksums = not PII (order numbers, tracking numbers, etc.)
  const strNoSpace = str.replace(/\s/g, '');
  const digitSequences = strNoSpace.match(/\d{10,}/g);

  if (digitSequences) {
    for (const seq of digitSequences) {
      // Check TCKN: 11-digit windows within any 10+ digit sequence
      if (seq.length >= 11) {
        for (let i = 0; i <= seq.length - 11; i++) {
          if (isValidTckn(seq.substring(i, i + 11))) {
            console.warn('🚨 [PII-Redaction] Valid TC Kimlik detected (checksum passed)');
            return true;
          }
        }
      }
      // Check VKN: ONLY on exactly 10-digit sequences.
      // Don't check 10-digit substrings within 11+ digit numbers — an 11-digit
      // TCKN/random number's substring can coincidentally pass VKN checksum.
      if (seq.length === 10 && isValidVkn(seq)) {
        console.warn('🚨 [PII-Redaction] Valid VKN detected (checksum passed)');
        return true;
      }
    }
  }

  return false;
}

export default {
  maskPhone,
  maskEmail,
  maskTC,
  maskVKN,
  maskAddress,
  redactPII,
  containsUnredactedPII
};

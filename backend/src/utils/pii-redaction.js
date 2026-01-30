/**
 * PII Redaction Utility
 *
 * SECURITY: Masks personally identifiable information before returning to LLM.
 * Critical for preventing PII leakage in chat responses.
 *
 * P0 Security Fix: Audit Report Issue #2 - PII Leakage
 */

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
 * @param {string} text - Text to check
 * @returns {boolean} True if potential PII found
 */
export function containsUnredactedPII(text) {
  if (!text) return false;

  const str = String(text);

  // Check for phone patterns (10+ digits)
  if (/\d{10,}/.test(str.replace(/\s/g, ''))) {
    return true;
  }

  // Check for email patterns
  if (/[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(str)) {
    return true;
  }

  // Check for Turkish ID pattern (11 consecutive digits)
  if (/\b\d{11}\b/.test(str)) {
    return true;
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

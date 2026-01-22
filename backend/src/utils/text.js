/**
 * Text Utility Functions
 * Normalization and comparison helpers for Turkish text and phone numbers
 */

/**
 * Normalize Turkish text for case-insensitive comparison
 * Handles Turkish-specific characters: İ, I, Ş, Ğ, Ü, Ö, Ç
 *
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text (lowercase, trimmed, Turkish chars converted)
 *
 * @example
 * normalizeTurkish("İbrahim YILDIZ") → "ibrahim yildiz"
 * normalizeTurkish("ŞIRKET A.Ş.") → "sirket a.s."
 */
export function normalizeTurkish(text) {
  if (!text) return '';

  // CRITICAL: Replace uppercase Turkish İ BEFORE toLowerCase()
  // Otherwise İ → i̇ (i with dot above) instead of i
  return String(text)
    .replace(/İ/g, 'i')     // Turkish İ → i (BEFORE toLowerCase!)
    .replace(/I/g, 'ı')     // Turkish I → ı (BEFORE toLowerCase!)
    .toLowerCase()
    .replace(/ı/g, 'i')     // Turkish ı → i
    .replace(/ğ/g, 'g')     // Turkish ğ → g
    .replace(/ü/g, 'u')     // Turkish ü → u
    .replace(/ş/g, 's')     // Turkish ş → s
    .replace(/ö/g, 'o')     // Turkish ö → o
    .replace(/ç/g, 'c')     // Turkish ç → c
    .trim();
}

/**
 * Normalize phone number to E.164 format (+90XXXXXXXXXX)
 * Handles various Turkish phone formats
 *
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone in E.164 format
 *
 * @example
 * normalizePhone("0532 123 45 67") → "+905321234567"
 * normalizePhone("532 123 45 67") → "+905321234567"
 * normalizePhone("+90 532 123 45 67") → "+905321234567"
 * normalizePhone("90 532 123 45 67") → "+905321234567"
 */
export function normalizePhone(phone) {
  if (!phone) return '';

  // Remove all non-digit characters
  let cleaned = String(phone).replace(/\D/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Add Turkey country code if missing
  if (!cleaned.startsWith('90')) {
    cleaned = '90' + cleaned;
  }

  // Add + prefix
  return '+' + cleaned;
}

/**
 * Compare two phone numbers for equality
 * Normalizes both before comparison
 *
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} True if phones match
 *
 * @example
 * comparePhones("0532 123 45 67", "+905321234567") → true
 * comparePhones("532-123-45-67", "90 532 123 45 67") → true
 */
export function comparePhones(phone1, phone2) {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Fuzzy compare two Turkish names
 * Requires at least 2 words for person names, 1 word for company names
 *
 * @param {string} provided - User-provided name
 * @param {string} stored - Stored name in database
 * @returns {boolean} True if names match
 *
 * @example
 * compareTurkishNames("ibrahim yildiz", "İbrahim Yıldız") → true
 * compareTurkishNames("ibrahim", "İbrahim Yıldız") → false (only 1 word for 2-word name)
 * compareTurkishNames("selenly", "Selenly") → true (company name, 1 word OK)
 * compareTurkishNames("yildiz ibrahim", "İbrahim Yıldız") → true (order doesn't matter)
 */
export function compareTurkishNames(provided, stored) {
  if (!provided || !stored) return false;

  const normalizedProvided = normalizeTurkish(provided);
  const normalizedStored = normalizeTurkish(stored);

  const providedWords = normalizedProvided.split(/\s+/).filter(w => w.length > 0);
  const storedWords = normalizedStored.split(/\s+/).filter(w => w.length > 0);

  // Security: If stored name has 2+ words (person name), require at least 2 words from user
  // If stored name has 1 word (company name), 1 word is OK
  const minimumWordsRequired = storedWords.length >= 2 ? 2 : 1;

  if (providedWords.length < minimumWordsRequired) {
    console.log(`❌ Name verification failed: Only ${providedWords.length} word(s) provided (minimum ${minimumWordsRequired} required for "${normalizedStored}")`);
    return false;
  }

  // Exact match
  if (normalizedProvided === normalizedStored) return true;

  // Partial match: Check if all provided words exist in stored name
  // This allows "yildiz ibrahim" to match "İbrahim Yıldız" (order doesn't matter)
  const allWordsMatch = providedWords.every(providedWord =>
    storedWords.some(storedWord =>
      storedWord.includes(providedWord) || providedWord.includes(storedWord)
    )
  );

  return allWordsMatch;
}

/**
 * Detect if a number is VKN, TC, or phone
 * @param {string} input - Number input from user
 * @returns {string} 'vkn' | 'tc' | 'phone' | 'unknown'
 *
 * @example
 * detectNumberType("9876543210") → "vkn" (10 digits, not starting with 0/5)
 * detectNumberType("05321234567") → "phone" (11 digits starting with 0)
 * detectNumberType("12345678901") → "tc" (11 digits not phone format)
 */
export function detectNumberType(input) {
  if (!input) return 'unknown';

  const digits = String(input).replace(/\D/g, '');

  if (digits.length === 11) {
    // Could be TC or phone (with leading 0)
    // Turkish phones: 05XX XXX XX XX
    if (digits[0] === '0' && digits[1] === '5') return 'phone';
    // Otherwise TC
    return 'tc';
  }

  if (digits.length === 10) {
    // Could be VKN or phone (without leading 0)
    // Turkish phones without 0: 5XX XXX XX XX
    if (digits[0] === '5') return 'phone';
    // Otherwise VKN
    return 'vkn';
  }

  return 'unknown';
}

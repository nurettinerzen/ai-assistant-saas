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

  const raw = String(phone).trim();

  // Remove all non-digit characters (but remember if + was present)
  const hadPlus = raw.startsWith('+');
  let cleaned = raw.replace(/\D/g, '');

  // Remove leading zeros (Turkish convention: 05XX → 5XX)
  cleaned = cleaned.replace(/^0+/, '');

  // If caller explicitly provided + prefix or a known country code,
  // respect it instead of forcing +90 (Turkey).
  // Known country codes: 1 (US/CA), 44 (UK), 49 (DE), 33 (FR), 90 (TR), etc.
  // Heuristic: if number has 11+ digits and starts with a non-90 code,
  // or had a + prefix, it's likely international.
  if (hadPlus) {
    // User explicitly typed +1... or +44... — trust the country code
    return '+' + cleaned;
  }

  // Turkish mobile/landline: 10 digits starting with [2-5]
  // e.g. 5321234567, 2121234567
  if (cleaned.length === 10 && /^[2-5]/.test(cleaned)) {
    return '+90' + cleaned;
  }

  // Already has Turkish country code: 90 + 10 digits
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // International: 11+ digits not starting with 90 (e.g. 14245275089 = US)
  if (cleaned.length >= 11 && !cleaned.startsWith('90')) {
    return '+' + cleaned;
  }

  // Fallback: assume Turkish (backward compatible)
  if (!cleaned.startsWith('90')) {
    cleaned = '90' + cleaned;
  }
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
  // Quick check: identical after normalization
  if (normalizePhone(phone1) === normalizePhone(phone2)) return true;

  // Flexible check: any variant overlap means same number
  // Handles ambiguous cases like 4245275089 (could be TR or US)
  const v1 = phoneSearchVariants(phone1);
  const v2Set = new Set(phoneSearchVariants(phone2));
  return v1.some(v => v2Set.has(v));
}

/**
 * Generate phone search variants for flexible DB matching.
 *
 * DB stores phones in various formats (with/without country code,
 * with/without +, etc.). This returns all plausible variants to
 * search against, ensuring we find a match regardless of how
 * the number was stored.
 *
 * @param {string} phone - Raw phone input
 * @returns {string[]} Unique search variants
 *
 * @example
 * phoneSearchVariants('+905321234567')
 * → ['+905321234567', '905321234567', '5321234567']
 *
 * phoneSearchVariants('14245275089')
 * → ['+14245275089', '14245275089', '4245275089']
 *
 * phoneSearchVariants('4245275089')
 * → ['+904245275089', '904245275089', '4245275089', '14245275089']
 */
export function phoneSearchVariants(phone) {
  if (!phone) return [];

  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizePhone(raw);
  const normalizedDigits = normalized.replace(/^\+/, '');

  const variants = new Set();

  // 1. Normalized form (what normalizePhone returns)
  variants.add(normalized);           // e.g. +905321234567 or +14245275089
  variants.add(normalizedDigits);     // e.g. 905321234567 or 14245275089

  // 2. Without any country code prefix (strip +90, +1, etc.)
  //    TR: 905321234567 → 5321234567
  //    US: 14245275089 → 4245275089
  if (normalizedDigits.startsWith('90') && normalizedDigits.length > 10) {
    const withoutTR = normalizedDigits.slice(2);
    variants.add(withoutTR); // Strip +90 → local TR number

    // If the local part is 10 digits starting with [2-9], it could also be a US number
    // that was wrongly assumed as TR by normalizePhone.
    // e.g. 4245275089 → normalizePhone → +904245275089 → but actually US +14245275089
    if (withoutTR.length === 10 && /^[2-9]/.test(withoutTR)) {
      variants.add('1' + withoutTR);       // US interpretation: 14245275089
      variants.add('+1' + withoutTR);      // US interpretation: +14245275089
    }
  }
  if (normalizedDigits.startsWith('1') && normalizedDigits.length === 11) {
    variants.add(normalizedDigits.slice(1)); // Strip +1 → local US number
  }

  // 3. Raw input as-is (in case DB stores in the same format user typed)
  variants.add(raw);
  if (digits && digits !== raw) variants.add(digits);

  // 4. Ambiguous 10-digit numbers: could be TR local or US without country code
  //    Try adding +1 prefix as an alternative (US interpretation)
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    variants.add('1' + digits);       // US: 4245275089 → 14245275089
    variants.add('+1' + digits);      // US: 4245275089 → +14245275089
  }

  return [...variants].filter(Boolean);
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

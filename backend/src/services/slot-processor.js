/**
 * Slot Processor — FORMAT VALIDATOR ONLY
 *
 * ARCHITECTURE CHANGE (LLM Authority Refactor):
 * - This module is now a PURE FORMAT VALIDATOR
 * - It does NOT decide "what is the user's input" (that's LLM's job)
 * - It only validates format when explicitly asked
 * - Normalizers are kept as pure utility functions
 *
 * What this does:
 * ✅ Normalize phone numbers (0555... → 90555...)
 * ✅ Normalize names (Turkish char handling)
 * ✅ Validate email format
 * ✅ Normalize order numbers
 *
 * What this does NOT do:
 * ❌ Decide if input is "name" vs "phone" vs "order number"
 * ❌ Return user-facing hint messages
 * ❌ Track slot attempts or lock sessions
 * ❌ Classify input type (looksLikeSlotInput removed)
 */

/**
 * Field-specific normalizers — PURE UTILITY
 * These just normalize format, they don't classify.
 */
const normalizers = {
  name: (value) => {
    return value
      .trim()
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
  },

  phone: (value) => {
    // Extract only digits
    let digits = value.replace(/\D/g, '');

    // Standardize to Turkish format: 90555xxxxxxx
    if (digits.startsWith('90') && digits.length === 12) {
      return digits; // Already correct: 905551234567
    }
    if (digits.startsWith('0') && digits.length === 11) {
      return '9' + digits; // 05551234567 → 905551234567
    }
    if (digits.length === 10) {
      return '90' + digits; // 5551234567 → 905551234567
    }

    return digits; // Return as-is
  },

  email: (value) => {
    return value.trim().toLowerCase();
  },

  order_number: (value) => {
    return value.trim().toUpperCase().replace(/\s/g, '');
  },

  ticket_number: (value) => {
    return value.trim().toUpperCase().replace(/\s/g, '');
  },
};

/**
 * Normalize value for a specific field type
 * Pure utility — call this when you know what the field is.
 */
export function normalize(field, value) {
  if (!value) return value;
  const normalizer = normalizers[field];
  return normalizer ? normalizer(String(value)) : String(value).trim();
}

/**
 * Validate format of a known field value
 *
 * ARCHITECTURE CHANGE: This is called AFTER LLM has already identified
 * what the value is (e.g., LLM extracted order_number from user message).
 * Backend only validates the format is correct before using it.
 *
 * @param {string} fieldType - The field type to validate against
 * @param {string} value - The value to validate
 * @returns {Object} { valid: boolean, normalized: string|null, reason: string|null }
 */
export function validateFormat(fieldType, value) {
  if (!value || !value.trim()) {
    return { valid: false, normalized: null, reason: 'empty' };
  }

  const trimmed = String(value).trim();

  switch (fieldType) {
    case 'order_number': {
      // Accept any alphanumeric combo with 3+ digits
      const hasDigits = /\d{3,}/.test(trimmed);
      if (hasDigits) {
        return { valid: true, normalized: normalize('order_number', trimmed) };
      }
      return { valid: false, normalized: null, reason: 'no_digits' };
    }

    case 'phone': {
      const normalized = normalize('phone', trimmed);
      // Turkish phone: 10-12 digits
      if (normalized.length >= 10 && normalized.length <= 12) {
        return { valid: true, normalized };
      }
      return { valid: false, normalized: null, reason: 'invalid_length' };
    }

    case 'name': {
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2) {
        const allAlphabetic = words.every(word =>
          /^[a-zA-ZğüşıöçĞÜŞİÖÇ]+$/.test(word)
        );
        if (allAlphabetic) {
          return { valid: true, normalized: trimmed };
        }
        return { valid: false, normalized: null, reason: 'invalid_characters' };
      }
      return { valid: false, normalized: null, reason: 'need_full_name' };
    }

    case 'email': {
      const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        return { valid: true, normalized: normalize('email', emailMatch[0]) };
      }
      return { valid: false, normalized: null, reason: 'invalid_format' };
    }

    case 'phone_last4': {
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length === 4) {
        return { valid: true, normalized: digitsOnly };
      }
      return { valid: false, normalized: null, reason: 'need_4_digits' };
    }

    default: {
      // Accept any non-empty input for unknown field types
      return { valid: trimmed.length > 0, normalized: trimmed };
    }
  }
}

/**
 * @deprecated REMOVED — Backend no longer classifies user input.
 * LLM determines what the user's message represents.
 *
 * Kept as stub for backward compatibility during migration.
 */
export function looksLikeSlotInput(message, expectedSlot) {
  console.warn('⚠️ [DEPRECATED] looksLikeSlotInput called — LLM handles input classification now');
  return true; // Always return true to not block anything
}

/**
 * @deprecated REMOVED — Slot processing is now done by LLM.
 * Use validateFormat() for format validation after LLM extraction.
 *
 * Kept as stub for backward compatibility during migration.
 */
export async function processSlotInput(expectedSlot, message, state = null) {
  console.warn('⚠️ [DEPRECATED] processSlotInput called — use validateFormat() instead');
  // Return as filled to not block the pipeline
  return {
    filled: true,
    slot: expectedSlot,
    value: message.trim(),
  };
}

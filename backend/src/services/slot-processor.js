/**
 * Slot Processor
 *
 * Processes user input to fill conversation slots.
 * Each slot type has specific validation and normalization rules.
 *
 * Returns:
 * - filled: boolean - Whether the slot was successfully filled
 * - slot: string - Slot key to store (camelCase)
 * - value: any - Processed and normalized value
 * - error: string - Error type if not filled
 * - hint: string - User-friendly hint message
 */

/**
 * Field-specific normalizers
 * CRITICAL: Different fields need different normalization!
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

    return digits; // Return as-is, will fail validation
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
 * Normalize value for a specific field
 */
function normalize(field, value) {
  const normalizer = normalizers[field];
  return normalizer ? normalizer(value) : value.trim();
}

/**
 * Process slot input based on expected slot type
 *
 * @param {string} expectedSlot - The slot type being filled
 * @param {string} message - User's input message
 * @returns {Object} Processing result
 */
/**
 * Process slot input with loop guard
 *
 * @param {string} expectedSlot - Slot to fill
 * @param {string} message - User message
 * @param {Object} state - Current conversation state (for loop guard)
 * @returns {Object} Result
 */
export function processSlotInput(expectedSlot, message, state = null) {
  const trimmed = message.trim();

  // ============================================
  // LOOP GUARD: Check failed attempts
  // ============================================
  if (state && state.slotAttempts) {
    const attempts = state.slotAttempts[expectedSlot] || 0;

    // After 2 failed attempts: more explicit example
    if (attempts === 2) {
      console.warn(`⚠️ [Loop Guard] Slot "${expectedSlot}" failed 2 times - giving explicit example`);
      // Return will include more explicit hint below
    }

    // After 3 failed attempts: escalate
    if (attempts >= 3) {
      console.error(`🚫 [Loop Guard] Slot "${expectedSlot}" failed 3 times - escalating`);
      return {
        filled: false,
        error: 'loop_detected',
        escalate: true, // Signal to escalate to human/callback
        hint: 'Anlaşılmadı gibi görünüyor. Farklı bir yöntemle doğrulayalım - size geri dönüş yapabilir miyiz?'
      };
    }
  }

  switch (expectedSlot) {
    case 'order_number': {
      // Pattern: SP001, ORD-12345, 123456, etc.
      const orderMatch = trimmed.match(/[A-Z]{0,5}[-]?\d{3,}/i);

      if (orderMatch) {
        const normalized = normalize('order_number', orderMatch[0]);
        return {
          filled: true,
          slot: 'orderNumber',
          value: normalized,
        };
      }

      return {
        filled: false,
        error: 'invalid_format',
        hint: 'Sipariş numarası genellikle SP001 veya ORD-12345 gibi görünür. Lütfen tekrar kontrol edin.',
      };
    }

    case 'ticket_number': {
      // Pattern: TK001, TICKET-12345, etc.
      const ticketMatch = trimmed.match(/[A-Z]{0,6}[-]?\d{3,}/i);

      if (ticketMatch) {
        const normalized = normalize('ticket_number', ticketMatch[0]);
        return {
          filled: true,
          slot: 'ticketNumber',
          value: normalized,
        };
      }

      return {
        filled: false,
        error: 'invalid_format',
        hint: 'Arıza/servis numaranızı kontrol edip tekrar yazabilir misiniz?',
      };
    }

    case 'name': {
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);

      // Require at least 2 words (first name + last name)
      if (words.length >= 2) {
        // Check if words are alphabetic (not numbers)
        const allAlphabetic = words.every(word =>
          /^[a-zA-ZğüşıöçĞÜŞİÖÇ]+$/.test(word)
        );

        if (allAlphabetic) {
          return {
            filled: true,
            slot: 'customerName',
            value: trimmed, // Keep original casing for display
          };
        }

        return {
          filled: false,
          error: 'invalid_characters',
          hint: 'İsminiz sadece harflerden oluşmalıdır.',
        };
      }

      return {
        filled: false,
        error: 'incomplete',
        hint: 'İsim ve soyisminizi birlikte yazmanız gerekiyor. Örneğin: Ahmet Yılmaz',
      };
    }

    case 'phone': {
      const phoneMatch = trimmed.match(/[\d\s\-\(\)]{10,}/);

      if (phoneMatch) {
        const normalized = normalize('phone', phoneMatch[0]);

        // Validate length (should be 12 digits for Turkey: 905xxxxxxxxx)
        if (normalized.length >= 10 && normalized.length <= 12) {
          return {
            filled: true,
            slot: 'phone',
            value: normalized,
          };
        }

        return {
          filled: false,
          error: 'invalid_length',
          hint: 'Telefon numarası 10-11 haneli olmalıdır. Örneğin: 0555 123 4567',
        };
      }

      return {
        filled: false,
        error: 'invalid_format',
        hint: 'Geçerli bir telefon numarası giriniz. Örneğin: 0555 123 4567',
      };
    }

    case 'email': {
      const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      if (emailMatch) {
        const normalized = normalize('email', emailMatch[0]);
        return {
          filled: true,
          slot: 'email',
          value: normalized,
        };
      }

      return {
        filled: false,
        error: 'invalid_format',
        hint: 'Geçerli bir e-posta adresi giriniz. Örneğin: ornek@sirket.com',
      };
    }

    case 'complaint_details': {
      // Require at least 10 characters for complaint
      if (trimmed.length >= 10) {
        return {
          filled: true,
          slot: 'complaintDetails',
          value: trimmed,
        };
      }

      return {
        filled: false,
        error: 'too_short',
        hint: 'Şikayetinizi biraz daha detaylı anlatır mısınız? Bu şekilde size daha iyi yardımcı olabilirim.',
      };
    }

    case 'preferred_date': {
      // TODO: Implement date parsing
      // For now, accept any input
      return {
        filled: true,
        slot: 'preferredDate',
        value: trimmed,
      };
    }

    case 'service_type': {
      // Accept any input
      return {
        filled: true,
        slot: 'serviceType',
        value: trimmed,
      };
    }

    case 'product_name': {
      if (trimmed.length >= 2) {
        return {
          filled: true,
          slot: 'productName',
          value: trimmed,
        };
      }

      return {
        filled: false,
        error: 'too_short',
        hint: 'Ürün adını biraz daha detaylı yazabilir misiniz?',
      };
    }

    case 'sku': {
      // Product SKU - accept alphanumeric
      if (trimmed.length >= 2) {
        return {
          filled: true,
          slot: 'sku',
          value: trimmed.toUpperCase(),
        };
      }

      return {
        filled: false,
        error: 'too_short',
        hint: 'Ürün kodunu kontrol edip tekrar yazabilir misiniz?',
      };
    }

    default: {
      // Generic slot - accept any non-empty input
      if (trimmed.length > 0) {
        return {
          filled: true,
          slot: expectedSlot,
          value: trimmed,
        };
      }

      return {
        filled: false,
        error: 'empty',
        hint: 'Lütfen bir değer girin.',
      };
    }
  }
}

/**
 * Check if a message looks like slot input (not a new topic)
 * Used by topic switch detector to avoid false positives
 *
 * @param {string} message - User message
 * @param {string} expectedSlot - Current expected slot
 * @returns {boolean} True if message looks like slot input
 */
export function looksLikeSlotInput(message, expectedSlot) {
  const trimmed = message.trim();

  // Short messages are likely slot inputs
  if (trimmed.length < 20) {
    return true;
  }

  // Check for slot-specific patterns
  switch (expectedSlot) {
    case 'order_number':
    case 'ticket_number':
      // Matches order/ticket number pattern
      return /[A-Z]{0,6}[-]?\d{3,}/i.test(trimmed);

    case 'name':
      // 2-4 words, all alphabetic
      const words = trimmed.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        return words.every(w => /^[a-zA-ZğüşıöçĞÜŞİÖÇ]+$/.test(w));
      }
      return false;

    case 'phone':
      // Looks like phone number
      return /[\d\s\-\(\)]{10,}/.test(trimmed);

    case 'email':
      // Looks like email
      return /@/.test(trimmed);

    default:
      // For other slots, short message is likely slot input
      return trimmed.length < 30;
  }
}

/**
 * Export normalizers for use in verification
 */
export { normalize };

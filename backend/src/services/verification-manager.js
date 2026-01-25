/**
 * Verification Manager
 * Centralized 2-step verification for all sensitive data queries
 *
 * ⚠️ DEPRECATED - This file is being phased out
 *
 * New architecture uses:
 * - verification-handler.js for verification flow
 * - customer-identity-resolver.js for database verification
 * - State-based verification (stored in ConversationState)
 *
 * This file remains for backward compatibility (read-only fallback).
 * Will be removed after 1-2 weeks.
 *
 * FLOW:
 * 1. Check if intent is sensitive
 * 2. Request primary field (VKN/order_number/phone) based on intent
 * 3. Find data with primary field
 * 4. Request secondary field (name/company) for verification
 * 5. Verify secondary field matches
 * 6. Return data if verified
 */

import { compareTurkishNames } from '../utils/text.js';

// In-memory verification state cache
// Key: sessionId, Value: { requestedField, foundCustomerId, foundCustomerName, queryType, ... }
export const verificationCache = new Map();
const VERIFICATION_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup old verification states every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, state] of verificationCache.entries()) {
    if (now - state.timestamp > VERIFICATION_TTL) {
      console.log(`🗑️ Verification cache expired for session: ${sessionId}`);
      verificationCache.delete(sessionId);
    }
  }
}, 2 * 60 * 1000);

/**
 * Intent configuration
 * Defines which intents require verification and what fields to request
 */
const INTENT_CONFIG = {
  debt_inquiry: {
    sensitive: true,
    primaryFields: ['vkn', 'tc'],  // Try VKN first, fallback to TC
    secondaryField: 'customer_name',
    queryType: 'muhasebe'
  },
  order_status: {
    sensitive: true,
    primaryFields: ['order_number'],
    secondaryField: 'customer_name',
    queryType: 'siparis'
  },
  tracking_info: {
    sensitive: true,
    primaryFields: ['order_number', 'tracking_number'],
    secondaryField: 'customer_name',
    queryType: 'kargo'
  },
  appointment: {
    sensitive: true,
    primaryFields: ['phone'],
    secondaryField: 'customer_name',
    queryType: 'randevu'
  },
  stock_check: {
    sensitive: false,
    // No verification needed
  },
  company_info: {
    sensitive: false,
    // No verification needed
  }
};

/**
 * Check if verification is needed for this request
 * @param {string} intent - Intent type (debt_inquiry, order_status, etc.)
 * @param {Object} providedData - Data provided by user (vkn, order_number, customer_name, etc.)
 * @param {string} sessionId - Session ID
 * @returns {Object} { needsVerification, step, requestedField, message }
 */
export function checkVerificationStatus(intent, providedData, sessionId) {
  const config = INTENT_CONFIG[intent];

  // If intent is not sensitive, no verification needed
  if (!config || !config.sensitive) {
    return {
      needsVerification: false,
      step: 'none',
      message: null
    };
  }

  // Check cache for pending verification
  const pendingVerification = verificationCache.get(sessionId);

  // STEP 1: Check if we have primary field
  const hasPrimaryField = config.primaryFields.some(field => providedData[field]);

  if (!hasPrimaryField) {
    // Need to request primary field
    const requestedField = config.primaryFields[0]; // Use first as default

    // Set cache if not already set
    if (!pendingVerification || !pendingVerification.requestedField) {
      verificationCache.set(sessionId, {
        requestedField,
        queryType: config.queryType,
        timestamp: Date.now()
      });
      console.log(`📝 [VerificationManager] Requesting primary field: ${requestedField}`);
    }

    return {
      needsVerification: true,
      step: 'request_primary',
      requestedField,
      message: getRequestMessage(requestedField, 'TR')
    };
  }

  // STEP 2: We have primary field, check if we have secondary (for verification)
  const hasSecondaryField = providedData[config.secondaryField];

  if (!hasSecondaryField) {
    // Need to request secondary field for verification
    // Cache should already have foundCustomerId and foundCustomerName set by the tool
    return {
      needsVerification: true,
      step: 'request_secondary',
      requestedField: config.secondaryField,
      message: getRequestMessage(config.secondaryField, 'TR')
    };
  }

  // STEP 3: We have both primary and secondary, verify them
  if (pendingVerification && pendingVerification.foundCustomerName) {
    const providedName = providedData[config.secondaryField];
    const matches = compareTurkishNames(providedName, pendingVerification.foundCustomerName);

    if (!matches) {
      return {
        needsVerification: true,
        step: 'verification_failed',
        message: 'Verdiğiniz bilgi kayıtlarımızla eşleşmiyor.'
      };
    }

    // Verification successful!
    verificationCache.delete(sessionId);
    return {
      needsVerification: false,
      step: 'verified',
      message: null
    };
  }

  // No pending verification but have both fields - this shouldn't happen
  // Treat as verified (might be first query with both fields)
  return {
    needsVerification: false,
    step: 'verified',
    message: null
  };
}

/**
 * Update verification cache when customer is found
 * @param {string} sessionId - Session ID
 * @param {Object} customer - Customer object from database
 * @param {string} queryType - Query type (muhasebe, siparis, etc.)
 */
export function setFoundCustomer(sessionId, customer, queryType) {
  const existing = verificationCache.get(sessionId) || {};

  verificationCache.set(sessionId, {
    ...existing,
    foundCustomerId: customer.id,
    foundCustomerName: customer.companyName || customer.contactName,
    expectedFieldType: customer.companyName ? 'company_name' : 'person_name',
    queryType,
    timestamp: Date.now()
  });

  console.log(`📝 [VerificationManager] Customer found, cache updated:`, {
    sessionId,
    customerId: customer.id,
    customerName: customer.companyName || customer.contactName
  });
}

/**
 * Get request message for a field
 * @param {string} field - Field name
 * @param {string} language - Language (TR/EN)
 * @returns {string} Request message
 */
function getRequestMessage(field, language = 'TR') {
  const messages = {
    TR: {
      vkn: 'Vergi kimlik numaranızı (VKN) rica edebilir miyim?',
      tc: 'TC kimlik numaranızı rica edebilir miyim?',
      order_number: 'Sipariş numaranızı rica edebilir miyim?',
      phone: 'Telefon numaranızı rica edebilir miyim?',
      customer_name: 'Güvenlik doğrulaması için isminizi ve soyisminizi ya da firma isminizi söyler misiniz?',
      tracking_number: 'Kargo takip numaranızı rica edebilir miyim?'
    },
    EN: {
      vkn: 'Could you please provide your tax ID number (VKN)?',
      tc: 'Could you please provide your national ID number?',
      order_number: 'Could you please provide your order number?',
      phone: 'Could you please provide your phone number?',
      customer_name: 'For security verification, could you please provide your full name or company name?',
      tracking_number: 'Could you please provide your tracking number?'
    }
  };

  return messages[language][field] || 'Bilgi gerekli.';
}

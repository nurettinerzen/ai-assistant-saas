/**
 * Identity Proof Module (SSOT)
 *
 * Derives channel-based identity proof strength and determines
 * whether additional verification (second factor) is required.
 *
 * TERMINOLOGY:
 *   "Channel possession signal" — NOT "verified identity".
 *   WhatsApp `from` means the sender possesses that phone number right now.
 *   It does NOT prove they are the account holder (SIM swap, family phone, etc.).
 *   This is why we only skip second factor for non-financial data with single match.
 *
 * Proof Strength Levels:
 *   STRONG  - Channel signal matches exactly ONE customer record in DB
 *   WEAK    - Channel signal exists but match is ambiguous (0 or 2+ records)
 *   NONE    - Channel provides no usable identity signal (e.g., anonymous chat)
 *
 * Data Classification:
 *   FINANCIAL  - Debt, billing, payment, accounting (always requires second factor)
 *   STANDARD   - Order status, tracking, repair status, appointments
 *
 * Decision Matrix:
 *   STRONG + STANDARD  -> skip second factor (autoverify)
 *   STRONG + FINANCIAL -> require second factor
 *   WEAK   + any       -> require second factor
 *   NONE   + any       -> require second factor
 *
 * SECURITY INVARIANTS:
 *   1. This module NEVER mutates state. Returns a decision only.
 *   2. FAIL-CLOSED: Any error -> strength=NONE, required=true.
 *   3. Financial data ALWAYS requires second factor, even with STRONG proof.
 *   4. Email order-level autoverify disabled in MVP (CrmOrder has no customerEmail).
 */

import prisma from '../../config/database.js';
import { normalizePhone } from '../../utils/text.js';

// ─── Constants ───────────────────────────────────────────────────────

export const ProofStrength = Object.freeze({
  STRONG: 'STRONG',
  WEAK: 'WEAK',
  NONE: 'NONE'
});

export const DataClass = Object.freeze({
  FINANCIAL: 'FINANCIAL',
  STANDARD: 'STANDARD'
});

/**
 * Query types classified as FINANCIAL (always require second factor)
 */
const FINANCIAL_QUERY_TYPES = new Set([
  'borc', 'debt', 'muhasebe', 'sgk_borcu', 'vergi_borcu',
  'odeme', 'payment', 'fatura', 'invoice', 'accounting'
]);

/**
 * Intent types classified as FINANCIAL
 */
const FINANCIAL_INTENTS = new Set([
  'BILLING', 'DEBT_INQUIRY', 'PAYMENT', 'REFUND', 'INVOICE'
]);

/**
 * Email query types where order-level autoverify is blocked (MVP).
 * CrmOrder has no customerEmail field, so we can't verify order ownership via email.
 */
const ORDER_LEVEL_QUERY_TYPES = new Set([
  'siparis', 'order', 'ariza', 'ticket'
]);

// ─── Core Functions ──────────────────────────────────────────────────

/**
 * Classify a query type or intent into a data class
 *
 * @param {string} queryType - Tool query_type parameter
 * @param {string} intent - Router intent (optional)
 * @returns {string} DataClass.FINANCIAL or DataClass.STANDARD
 */
export function classifyDataClass(queryType, intent) {
  if (queryType && FINANCIAL_QUERY_TYPES.has(queryType.toLowerCase())) {
    return DataClass.FINANCIAL;
  }
  if (intent && FINANCIAL_INTENTS.has(intent.toUpperCase())) {
    return DataClass.FINANCIAL;
  }
  return DataClass.STANDARD;
}

/**
 * Derive identity proof from channel context
 *
 * @param {Object} channelContext
 * @param {string} channelContext.channel - 'WHATSAPP' | 'EMAIL' | 'CHAT' | 'PHONE'
 * @param {string} channelContext.channelUserId - Phone number (WhatsApp)
 * @param {string} channelContext.fromEmail - Email address (Email channel)
 * @param {number} channelContext.businessId - Business ID
 * @param {Object} toolRequest - { queryType, intent } (optional)
 * @param {Object} state - Current orchestrator state (optional)
 * @returns {Promise<Object>} IdentityProof
 */
export async function deriveIdentityProof(channelContext, toolRequest = {}, state = {}) {
  const startTime = Date.now();
  const { channel, channelUserId, fromEmail, businessId } = channelContext;

  const noProof = {
    strength: ProofStrength.NONE,
    matchedCustomerId: null,
    matchedOrderId: null,
    reasons: ['no_channel_identity'],
    evidence: {},
    durationMs: 0
  };

  try {
    // Chat/Phone: no usable identity signal
    if (channel === 'CHAT' || channel === 'PHONE' || (!channelUserId && !fromEmail)) {
      return { ...noProof, durationMs: Date.now() - startTime };
    }

    if (channel === 'WHATSAPP' && channelUserId) {
      return await deriveWhatsAppProof(channelUserId, businessId, startTime);
    }

    if (channel === 'EMAIL' && fromEmail) {
      return await deriveEmailProof(fromEmail, businessId, toolRequest, startTime);
    }

    return { ...noProof, reasons: ['unknown_channel'], durationMs: Date.now() - startTime };

  } catch (error) {
    // FAIL-CLOSED: error -> no proof
    console.error('❌ [IdentityProof] Error deriving proof:', error.message);
    return {
      strength: ProofStrength.NONE,
      matchedCustomerId: null,
      matchedOrderId: null,
      reasons: ['derivation_error', error.message],
      evidence: {},
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Derive proof for WhatsApp channel.
 * WhatsApp `from` is a channel possession signal — the sender controls this number now.
 *
 * @param {string} waPhone - Raw phone number from WhatsApp webhook
 * @param {number} businessId
 * @param {number} startTime - For duration tracking
 * @returns {Promise<Object>} IdentityProof
 */
async function deriveWhatsAppProof(waPhone, businessId, startTime) {
  const normalizedPhone = normalizePhone(waPhone);
  // Strip country code for flexible matching (DB may store with or without +90)
  const phoneDigits = normalizedPhone.replace(/^\+/, '');
  const withoutCountry = phoneDigits.replace(/^90/, '');

  // Search CustomerData by phone (uses [businessId, phone] index)
  const customerMatches = await prisma.customerData.findMany({
    where: {
      businessId,
      OR: [
        { phone: normalizedPhone },
        { phone: phoneDigits },
        { phone: withoutCountry },
        { phone: waPhone }
      ]
    },
    select: { id: true, phone: true, companyName: true },
    take: 3 // We only need to know if it's 0, 1, or 2+
  });

  // Also check CrmOrder by customerPhone
  const orderMatches = await prisma.crmOrder.findMany({
    where: {
      businessId,
      OR: [
        { customerPhone: normalizedPhone },
        { customerPhone: phoneDigits },
        { customerPhone: withoutCountry },
        { customerPhone: waPhone }
      ]
    },
    select: { id: true, customerPhone: true, orderNumber: true },
    take: 3
  });

  // Deduplicate customer IDs (same customer can have multiple records)
  const uniqueCustomerIds = [...new Set(customerMatches.map(c => c.id))];

  // STRONG: exactly one unique customer
  if (uniqueCustomerIds.length === 1) {
    return {
      strength: ProofStrength.STRONG,
      matchedCustomerId: uniqueCustomerIds[0],
      matchedOrderId: orderMatches.length === 1 ? orderMatches[0].id : null,
      reasons: ['whatsapp_phone_single_customer_match'],
      evidence: {
        channel: 'WHATSAPP',
        matchType: 'phone',
        customerMatchCount: uniqueCustomerIds.length,
        orderMatchCount: orderMatches.length
      },
      durationMs: Date.now() - startTime
    };
  }

  // No CustomerData match — check if exactly one CrmOrder customer
  if (uniqueCustomerIds.length === 0 && orderMatches.length > 0) {
    const uniqueOrderCustomers = [...new Set(orderMatches.map(o => o.customerPhone))];
    if (uniqueOrderCustomers.length === 1) {
      return {
        strength: ProofStrength.STRONG,
        matchedCustomerId: null,
        matchedOrderId: orderMatches[0].id,
        reasons: ['whatsapp_phone_single_order_match'],
        evidence: {
          channel: 'WHATSAPP',
          matchType: 'phone_order',
          customerMatchCount: 0,
          orderMatchCount: orderMatches.length
        },
        durationMs: Date.now() - startTime
      };
    }
  }

  // WEAK: 0 or 2+ matches
  const totalMatches = uniqueCustomerIds.length + (uniqueCustomerIds.length === 0 ? orderMatches.length : 0);
  return {
    strength: ProofStrength.WEAK,
    matchedCustomerId: null,
    matchedOrderId: null,
    reasons: [totalMatches === 0 ? 'whatsapp_phone_no_match' : 'whatsapp_phone_multiple_matches'],
    evidence: {
      channel: 'WHATSAPP',
      matchType: 'phone',
      customerMatchCount: uniqueCustomerIds.length,
      orderMatchCount: orderMatches.length
    },
    durationMs: Date.now() - startTime
  };
}

/**
 * Derive proof for Email channel.
 * Email `from` is DKIM/SPF verified by the email provider, but
 * forwards, aliases, and shared mailboxes are risks.
 *
 * MVP LIMITATION: CrmOrder has no customerEmail field, so email proof
 * cannot verify order ownership. Email autoverify is limited to
 * CustomerData-level (profile/account) queries.
 *
 * @param {string} emailAddress - From email
 * @param {number} businessId
 * @param {Object} toolRequest - { queryType } to check order-level restriction
 * @param {number} startTime
 * @returns {Promise<Object>} IdentityProof
 */
async function deriveEmailProof(emailAddress, businessId, toolRequest, startTime) {
  const normalizedEmail = emailAddress.toLowerCase().trim();

  // MVP restriction: block order/ticket-level autoverify for email
  // CrmOrder doesn't have customerEmail, so we can't verify order ownership
  if (toolRequest.queryType && ORDER_LEVEL_QUERY_TYPES.has(toolRequest.queryType.toLowerCase())) {
    return {
      strength: ProofStrength.WEAK,
      matchedCustomerId: null,
      matchedOrderId: null,
      reasons: ['email_order_level_not_supported'],
      evidence: {
        channel: 'EMAIL',
        matchType: 'email',
        queryType: toolRequest.queryType,
        restriction: 'order_level_blocked_mvp'
      },
      durationMs: Date.now() - startTime
    };
  }

  // Search CustomerData by email
  const customerMatches = await prisma.customerData.findMany({
    where: {
      businessId,
      email: { equals: normalizedEmail, mode: 'insensitive' }
    },
    select: { id: true, email: true, companyName: true },
    take: 3
  });

  const uniqueCustomerIds = [...new Set(customerMatches.map(c => c.id))];

  if (uniqueCustomerIds.length === 1) {
    return {
      strength: ProofStrength.STRONG,
      matchedCustomerId: uniqueCustomerIds[0],
      matchedOrderId: null,
      reasons: ['email_single_customer_match'],
      evidence: {
        channel: 'EMAIL',
        matchType: 'email',
        customerMatchCount: 1
      },
      durationMs: Date.now() - startTime
    };
  }

  return {
    strength: ProofStrength.WEAK,
    matchedCustomerId: null,
    matchedOrderId: null,
    reasons: [uniqueCustomerIds.length === 0 ? 'email_no_match' : 'email_multiple_matches'],
    evidence: {
      channel: 'EMAIL',
      matchType: 'email',
      customerMatchCount: uniqueCustomerIds.length
    },
    durationMs: Date.now() - startTime
  };
}

// ─── Verification Decision ──────────────────────────────────────────

/**
 * Determine if additional verification (second factor) is required.
 *
 * @param {Object} proof - Result of deriveIdentityProof()
 * @param {string} intent - Router intent (ORDER, BILLING, etc.)
 * @param {string} dataClass - DataClass.FINANCIAL or DataClass.STANDARD
 * @returns {Object} { required: boolean, reason: string, requiredSlots: string[] }
 */
export function shouldRequireAdditionalVerification(proof, intent, dataClass) {
  // FAIL-CLOSED: no proof -> always require
  if (!proof || !proof.strength) {
    return {
      required: true,
      reason: 'no_proof_available',
      requiredSlots: ['phone_last4']
    };
  }

  // FINANCIAL data class: ALWAYS require second factor regardless of proof strength
  if (dataClass === DataClass.FINANCIAL) {
    return {
      required: true,
      reason: 'financial_data_always_requires_second_factor',
      requiredSlots: ['phone_last4']
    };
  }

  // STRONG proof + STANDARD data: skip second factor (autoverify)
  if (proof.strength === ProofStrength.STRONG && dataClass === DataClass.STANDARD) {
    return {
      required: false,
      reason: 'channel_proof_sufficient',
      requiredSlots: []
    };
  }

  // WEAK: require second factor
  if (proof.strength === ProofStrength.WEAK) {
    return {
      required: true,
      reason: 'weak_proof_' + (proof.reasons?.[0] || 'unknown'),
      requiredSlots: ['phone_last4']
    };
  }

  // NONE or unknown: require second factor
  return {
    required: true,
    reason: 'no_channel_identity',
    requiredSlots: ['phone_last4']
  };
}

export default {
  ProofStrength,
  DataClass,
  classifyDataClass,
  deriveIdentityProof,
  shouldRequireAdditionalVerification
};

/**
 * Customer Data Lookup Handler V2
 * Uses centralized VerificationService and Tool Result Contract
 *
 * Flow:
 * 1. Find record (anchor)
 * 2. Check verification status
 * 3. Return minimal or full data based on verification
 *
 * SECURITY (P0 Fix): Order number normalization to prevent lookup failures
 */

import prisma from '../../prismaClient.js';
import { normalizePhone, comparePhones } from '../../utils/text.js';

/**
 * Normalize order number for consistent lookups
 * Fixes P0 issue: "var ama yok" (exists but returns not found)
 *
 * Normalization rules:
 * - Remove common prefixes: ORD-, ORDER-, SIP-, SIPARIS-
 * - Remove all spaces and dashes
 * - Uppercase
 * - Trim
 *
 * Examples:
 * "ORD-12345" → "12345"
 * "SIP 12345" → "12345"
 * "order-12345" → "12345"
 */
function normalizeOrderNumber(orderNumber) {
  if (!orderNumber) return orderNumber;

  let normalized = String(orderNumber).trim().toUpperCase();

  // Remove common order number prefixes
  // IMPORTANT: Check longer prefixes FIRST to avoid partial matches
  // (e.g., "SIPARIS-" before "SIP", "ORDER-" before "ORD")
  const prefixes = [
    'SIPARIS-', 'SIPARIS_', 'SIPARIS',
    'ORDER-', 'ORDER_', 'ORDER',
    'ORD-', 'ORD_', 'ORD',
    'SIP-', 'SIP_', 'SIP'
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
      break; // Only remove one prefix
    }
  }

  // Remove all spaces, dashes, underscores
  normalized = normalized.replace(/[\s\-_]/g, '');

  return normalized;
}
import {
  requiresVerification,
  createAnchor,
  checkVerification,
  getMinimalResult,
  getFullResult,
  verifyAgainstAnchor
} from '../../services/verification-service.js';
import {
  ok,
  notFound,
  verificationRequired,
  systemError,
  ToolOutcome,
  GENERIC_ERROR_MESSAGES
} from '../toolResult.js';

/**
 * Execute customer data lookup
 */
export async function execute(args, business, context = {}) {
  try {
    const { query_type, phone, order_number, customer_name, vkn, tc, verification_input } = args;
    const sessionId = context.sessionId || context.conversationId;
    const language = business.language || 'TR';
    const state = context.state || {};

    // P0-UX FIX: Combine verification inputs - verification_input takes priority
    // This allows LLM to pass phone last 4 digits OR name for verification
    const effectiveVerificationInput = verification_input || customer_name;

    // SECURITY: Don't log PII (phone, vkn, tc, names)
    console.log('🔍 [CustomerDataLookup-V2] Query:', {
      query_type,
      has_phone: !!phone,
      has_order: !!order_number,
      has_name: !!customer_name,
      has_vkn: !!vkn,
      has_tc: !!tc,
      businessId: business.id,
      sessionId,
      verificationStatus: state.verification?.status || 'none'
    });

    // ============================================================================
    // P0: VERIFICATION HANDLER - Process pending verification
    // ============================================================================

    console.log('🔐 [Debug] Verification check:', {
      hasState: !!state,
      hasVerification: !!state.verification,
      status: state.verification?.status,
      hasAnchor: !!state.verification?.anchor,
      hasVerificationInput: !!effectiveVerificationInput,
      verificationInput: effectiveVerificationInput
    });

    // P0-UX FIX: Process pending verification with ANY verification input (name OR phone_last4)
    if (state.verification?.status === 'pending' && state.verification?.anchor && effectiveVerificationInput) {
      console.log('🔐 [Verification] Processing pending verification');
      console.log('🔐 [Verification] Input:', effectiveVerificationInput, '| Anchor phone:', state.verification.anchor.phone);

      const anchor = state.verification.anchor;
      const verifyResult = checkVerification(anchor, effectiveVerificationInput, query_type, language);

      if (verifyResult.action === 'PROCEED') {
        // Verification successful - mark as verified and return full data
        console.log('✅ [Verification] Name verified successfully');
        state.verification.status = 'verified';

        // Fetch the full record using anchor ID
        const verifiedRecord = await prisma.customerData.findUnique({
          where: { id: anchor.id }
        });

        if (verifiedRecord) {
          return getFullResult(verifiedRecord, language);
        } else {
          return systemError(
            language === 'TR'
              ? 'Kayıt bulunamadı.'
              : 'Record not found.'
          );
        }
      } else {
        // P0-UX FIX: Track attempts and break loop after 2 failures
        state.verification.attempts = (state.verification.attempts || 0) + 1;
        console.log(`❌ [Verification] Failed - attempt ${state.verification.attempts}`);

        // Loop breaker: After 2 failed attempts, offer alternative
        if (state.verification.attempts >= 2) {
          console.log('🔄 [Verification] Max attempts reached - offering alternative');
          state.verification.status = 'failed';

          // P0-UX: Clear, helpful message after multiple failures
          return {
            outcome: ToolOutcome.VALIDATION_ERROR,
            success: true,
            message: language === 'TR'
              ? 'Bilgiler doğrulanamadı. Sipariş numaranızı kontrol edebilir misiniz? Farklı bir sipariş sorgulamak isterseniz sipariş numarasını söyleyin.'
              : 'Could not verify the information. Can you check your order number? If you want to query a different order, please provide the order number.'
          };
        }

        // First failure: Generic message (security) but keep pending
        // P0-1 FIX: Generic message to prevent enumeration
        return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
      }
    }

    // ============================================================================
    // STEP 1: FIND RECORD (ANCHOR)
    // ============================================================================

    let record = null;
    let anchorType = null;
    let anchorValue = null;

    // Strategy 1: Order number
    if (order_number) {
      // Normalize for flexible matching but also keep original
      const normalizedOrderNumber = normalizeOrderNumber(order_number);
      const originalUpperCase = String(order_number).trim().toUpperCase();

      console.log('🔍 [Lookup] Searching by order_number:', {
        original: order_number,
        originalUpperCase,
        normalized: normalizedOrderNumber
      });

      // Try CrmOrder first - search with BOTH original and normalized values
      // DB may store "ORD-12345" or just "12345" depending on source
      let crmOrder = await prisma.crmOrder.findFirst({
        where: {
          businessId: business.id,
          orderNumber: originalUpperCase  // Try exact match first
        }
      });

      // If not found, try with normalized (no prefix)
      if (!crmOrder) {
        crmOrder = await prisma.crmOrder.findFirst({
          where: {
            businessId: business.id,
            orderNumber: normalizedOrderNumber
          }
        });
      }

      // If still not found, try contains search for partial match
      if (!crmOrder) {
        crmOrder = await prisma.crmOrder.findFirst({
          where: {
            businessId: business.id,
            orderNumber: { contains: normalizedOrderNumber, mode: 'insensitive' }
          }
        });
      }

      if (crmOrder) {
        console.log('✅ [Lookup] Found CRM order:', crmOrder.orderNumber);
        record = crmOrder;
        anchorType = 'order';
        anchorValue = crmOrder.orderNumber;
      } else {
        // Try CustomerData (first check orderNo field, then customFields)
        console.log('🔍 [Lookup] Not in CrmOrder, searching CustomerData...');

        // FIRST: Check top-level orderNo field
        const allCustomers = await prisma.customerData.findMany({
          where: { businessId: business.id }
        });

        for (const customer of allCustomers) {
          // Check top-level orderNo field first
          if (customer.orderNo) {
            const normalizedDbOrderNo = normalizeOrderNumber(customer.orderNo);
            if (normalizedDbOrderNo === normalizedOrderNumber) {
              console.log('✅ [Lookup] Found in CustomerData.orderNo');
              record = customer;
              anchorType = 'order';
              anchorValue = normalizedOrderNumber;
              break;
            }
          }
        }

        // SECOND: If not found, search in customFields for order number
        if (!record) {
          const orderFieldNames = [
            'Sipariş No', 'Siparis No', 'SİPARİŞ NO', 'Sipariş Numarası',
            'order_number', 'orderNumber', 'Order Number', 'Order No'
          ];

          for (const customer of allCustomers) {
            if (customer.customFields) {
              for (const fieldName of orderFieldNames) {
                const fieldValue = customer.customFields[fieldName];
                if (fieldValue) {
                  // SECURITY FIX: Normalize both sides for comparison
                  const normalizedFieldValue = normalizeOrderNumber(String(fieldValue));
                  if (normalizedFieldValue === normalizedOrderNumber) {
                    console.log('✅ [Lookup] Found in CustomerData.customFields');
                    record = customer;
                    anchorType = 'order';
                    anchorValue = normalizedOrderNumber;
                    break;
                  }
                }
              }
              if (record) break;
            }
          }
        }

        if (!record) {
          // P0-1 FIX: Use generic message to prevent enumeration attacks
          // SECURITY: Do NOT reveal that this specific order number doesn't exist
          console.log('📭 [Lookup] Order not found in both CrmOrder and CustomerData');
          return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
        }
      }
    }

    // Strategy 2: VKN/TC
    else if (vkn || tc) {
      console.log('🔍 [Lookup] Searching by VKN/TC');

      const whereClause = { businessId: business.id };
      if (vkn) whereClause.vkn = vkn;
      else if (tc) whereClause.tcNo = tc;

      record = await prisma.customerData.findFirst({ where: whereClause });

      if (record) {
        anchorType = vkn ? 'vkn' : 'tc';
        anchorValue = vkn || tc;
      } else {
        // P0-1 FIX: Use generic message to prevent enumeration attacks
        return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
      }
    }

    // Strategy 3: Phone
    // SECURITY NOTE: Phone lookup is allowed, but will ALWAYS require name verification
    // before returning any PII (enforced by checkVerification below)
    else if (phone) {
      // Normalize phone for consistent matching
      // DB stores as "5328274926" (10 digits), user may say "05328274926" or "+905328274926"
      const normalizedPhone = normalizePhone(phone);
      // Also try without country code (just 10 digits) for DB compatibility
      const phoneWithoutCountry = normalizedPhone.replace(/^\+90/, '');

      console.log('🔍 [Lookup] Searching by phone:', {
        original: phone,
        normalized: normalizedPhone,
        withoutCountry: phoneWithoutCountry
      });

      // First try CustomerData table
      record = await prisma.customerData.findFirst({
        where: {
          businessId: business.id,
          OR: [
            { phone: normalizedPhone },
            { phone: phoneWithoutCountry },
            { phone: phone } // Original as fallback
          ]
        }
      });

      // If not found in CustomerData, try CrmOrder table
      if (!record) {
        console.log('🔍 [Lookup] Not in CustomerData, searching CrmOrder by phone...');
        const crmOrder = await prisma.crmOrder.findFirst({
          where: {
            businessId: business.id,
            OR: [
              { customerPhone: normalizedPhone },
              { customerPhone: phoneWithoutCountry },
              { customerPhone: phone }
            ]
          }
        });

        if (crmOrder) {
          console.log('✅ [Lookup] Found CRM order by phone:', crmOrder.orderNumber);
          record = crmOrder;
        }
      }

      if (record) {
        anchorType = 'phone';
        anchorValue = phoneWithoutCountry;
      }
    }

    // No record found
    if (!record) {
      // P0-1 FIX: Use generic message to prevent enumeration attacks
      console.log('📭 [Lookup] No record found');
      return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
    }

    // ============================================================================
    // STEP 2: CHECK VERIFICATION
    // ============================================================================

    const anchor = createAnchor(record, anchorType, anchorValue);
    console.log('🔐 [Anchor] Created:', { type: anchor.anchorType, value: anchor.anchorValue, name: anchor.name });

    // P0 SECURITY: Detect identity switch (anchor change within session)
    // If user switches to a different customer mid-conversation, require new verification
    console.log('🔐 [Debug] Identity switch check:', {
      hasStateAnchor: !!state.verification?.anchor,
      stateAnchorId: state.verification?.anchor?.id,
      newAnchorId: anchor.id,
      isDifferent: state.verification?.anchor?.id !== anchor.id
    });
    const identitySwitch = state.verification?.anchor?.id && state.verification.anchor.id !== anchor.id;

    if (identitySwitch) {
      console.log('🚨 [SECURITY] Identity switch detected!', {
        previousAnchor: state.verification.anchor.id,
        newAnchor: anchor.id
      });

      // Force new verification by treating as if no verification data provided
      // ToolLoop will handle state reset when VERIFICATION_REQUIRED is returned
      console.log('🔐 [SECURITY] Forcing new verification for identity switch');

      // Return VERIFICATION_REQUIRED immediately - ignore any provided customer_name
      return verificationRequired(
        language === 'TR'
          ? 'Farklı bir müşteri kaydı tespit edildi. Güvenlik doğrulaması için isminizi ve soyadınızı söyler misiniz?'
          : 'Different customer record detected. For security verification, could you please provide your full name?',
        {
          askFor: 'name',
          anchor: {
            id: anchor.id,
            type: anchor.anchorType,
            value: anchor.anchorValue,
            name: anchor.name,
            phone: anchor.phone,
            email: anchor.email
          }
        }
      );
    }

    // P0 SECURITY: Enforce two-step verification AND detect mismatches
    // Strategy:
    // 1. If customer_name provided AND not in pending state → check for mismatch
    // 2. If mismatch detected → return explicit error
    // 3. If match detected → still require verification (prevent single-shot bypass)
    let verificationInput = customer_name;
    if (customer_name && state.verification?.status !== 'pending') {
      console.log('🔐 [SECURITY] customer_name provided but not in pending verification flow');
      console.log('🔐 [SECURITY] Checking for mismatch...');

      // Check if provided name matches anchor
      const matchResult = verifyAgainstAnchor(anchor, customer_name);

      if (!matchResult.matches) {
        // P0-1 FIX: Use SAME generic message as NOT_FOUND to prevent enumeration
        // SECURITY: "İsim eşleşmiyor" reveals that record EXISTS - information leak!
        console.log('🔐 [SECURITY] Mismatch detected - returning generic error (same as NOT_FOUND)');
        return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
      }

      // Name matches BUT still require two-step verification (prevent single-shot bypass)
      console.log('🔐 [SECURITY] Name matches but enforcing two-step verification');
      verificationInput = null; // Force verification request
    }

    const verificationCheck = checkVerification(anchor, verificationInput, query_type, language);
    console.log('🔐 [Verification] Check result:', verificationCheck.action);

    // Handle verification result
    if (verificationCheck.action === 'REQUEST_VERIFICATION') {
      return verificationRequired(verificationCheck.message, {
        askFor: verificationCheck.askFor,
        anchor: verificationCheck.anchor
      });
    }

    if (verificationCheck.action === 'VERIFICATION_FAILED') {
      // P0-1 FIX: Use SAME generic message as NOT_FOUND to prevent enumeration
      // SECURITY: Specific verification failure messages reveal record existence
      console.log('🔐 [Verification] Check failed - returning generic error');
      return notFound(GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR);
    }

    // ============================================================================
    // STEP 3: RETURN DATA (minimal or full)
    // ============================================================================

    if (verificationCheck.verified) {
      console.log('✅ [Result] Returning full data');

      // P0 SECURITY: Save anchor to state for identity switch detection
      // This must happen regardless of verification path (pending→verified or single-shot)
      state.verification = state.verification || { status: 'none', attempts: 0 };
      state.verification.status = 'verified';
      state.verification.anchor = {
        id: anchor.id,
        type: anchor.anchorType,
        value: anchor.anchorValue,
        name: anchor.name,
        phone: anchor.phone,
        email: anchor.email
      };
      console.log('🔐 [Security] Anchor saved to state:', { id: anchor.id, name: anchor.name });

      const result = getFullResult(record, query_type, language);
      return ok(result.data, result.message);
    } else {
      console.log('⚠️ [Result] Returning minimal data (unverified)');
      const result = getMinimalResult(record, query_type, language);
      return ok(result.data, result.message);
    }

  } catch (error) {
    console.error('❌ [CustomerDataLookup-V2] Error:', error);
    return systemError(
      business.language === 'TR'
        ? 'Sistem hatası oluştu. Lütfen daha sonra tekrar deneyin.'
        : 'A system error occurred. Please try again later.',
      error
    );
  }
}

export default { execute };

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
  getFullResult
} from '../../services/verification-service.js';
import {
  ok,
  notFound,
  verificationRequired,
  systemError,
  ToolOutcome
} from '../toolResult.js';

/**
 * Execute customer data lookup
 */
export async function execute(args, business, context = {}) {
  try {
    const { query_type, phone, order_number, customer_name, vkn, tc } = args;
    const sessionId = context.sessionId || context.conversationId;
    const language = business.language || 'TR';
    const state = context.state || {};

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
      hasCustomerName: !!customer_name
    });

    if (state.verification?.status === 'pending' && state.verification?.anchor && customer_name) {
      console.log('🔐 [Verification] Processing pending verification with provided name');
      console.log('🔐 [Verification] Anchor:', {
        id: state.verification.anchor.id,
        name: state.verification.anchor.name,
        providedName: customer_name
      });

      const anchor = state.verification.anchor;
      const verifyResult = checkVerification(anchor, customer_name, query_type, language);

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
        // Verification failed - mark as failed and withhold data
        console.log('❌ [Verification] Name verification failed');
        state.verification.status = 'failed';
        state.verification.attempts = (state.verification.attempts || 0) + 1;

        return {
          outcome: ToolOutcome.VALIDATION_ERROR,
          success: true,
          validationError: true,
          message: verifyResult.message
        };
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
      // SECURITY FIX (P0): Normalize order number to prevent "var ama yok" issues
      // Remove common prefixes, spaces, dashes that cause mismatches
      const normalizedOrderNumber = normalizeOrderNumber(order_number);

      console.log('🔍 [Lookup] Searching by order_number:', {
        original: order_number,
        normalized: normalizedOrderNumber
      });

      // Try CrmOrder first
      const crmOrder = await prisma.crmOrder.findFirst({
        where: {
          businessId: business.id,
          orderNumber: normalizedOrderNumber
        }
      });

      if (crmOrder) {
        console.log('✅ [Lookup] Found CRM order');
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
          console.log('📭 [Lookup] Order not found in both CrmOrder and CustomerData');
          return notFound(
            language === 'TR'
              ? `${order_number} numaralı sipariş bulunamadı. Lütfen sipariş numarasını kontrol edin.`
              : `Order ${order_number} not found. Please check the order number.`
          );
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
        return notFound(
          language === 'TR' ? 'Kayıt bulunamadı.' : 'Record not found.'
        );
      }
    }

    // Strategy 3: Phone
    // SECURITY NOTE: Phone lookup is allowed, but will ALWAYS require name verification
    // before returning any PII (enforced by checkVerification below)
    else if (phone) {
      console.log('🔍 [Lookup] Searching by phone (will require name verification)');

      record = await prisma.customerData.findFirst({
        where: {
          businessId: business.id,
          phone: phone
        }
      });

      if (record) {
        anchorType = 'phone';
        anchorValue = phone;
      }
    }

    // No record found
    if (!record) {
      console.log('📭 [Lookup] No record found');
      return notFound(
        language === 'TR' ? 'Bilgi bulunamadı.' : 'Information not found.'
      );
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
      const {verifyAgainstAnchor} = await import('../../services/verification-service.js');
      const matchResult = verifyAgainstAnchor(anchor, customer_name);

      if (!matchResult.matches) {
        // MISMATCH DETECTED: Wrong name for this record
        console.log('🔐 [SECURITY] Mismatch detected - provided name does not match record');
        return {
          outcome: ToolOutcome.VALIDATION_ERROR,
          success: true,
          validationError: true,
          message: language === 'TR'
            ? 'Verdiğiniz isim bu sipariş kaydıyla eşleşmiyor. Lütfen bilgilerinizi kontrol edin.'
            : 'The name you provided does not match this order record. Please check your information.'
        };
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
      return {
        outcome: ToolOutcome.VALIDATION_ERROR,
        success: true, // AI should explain - not a system failure
        validationError: true,
        message: verificationCheck.message
      };
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

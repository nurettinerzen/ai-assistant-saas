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

    // SECURITY: Don't log PII (phone, vkn, tc, names)
    console.log('🔍 [CustomerDataLookup-V2] Query:', {
      query_type,
      has_phone: !!phone,
      has_order: !!order_number,
      has_name: !!customer_name,
      has_vkn: !!vkn,
      has_tc: !!tc,
      businessId: business.id,
      sessionId
    });

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
        // Try CustomerData (search in customFields)
        console.log('🔍 [Lookup] Not in CrmOrder, searching CustomerData...');
        const allCustomers = await prisma.customerData.findMany({
          where: { businessId: business.id }
        });

        // Search in customFields for order number
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
                  console.log('✅ [Lookup] Found in CustomerData');
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

    const verificationCheck = checkVerification(anchor, customer_name, query_type, language);
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

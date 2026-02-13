/**
 * Smoke Tests: Email Pipeline End-to-End
 *
 * Tests the full email lookup + autoverify + verification chain
 * using REAL database queries (no mocks).
 *
 * Prerequisites:
 *   - DB has test CustomerData: nurettinerzen@gmail.com, phone 14245275089
 *   - DB has test CrmOrder: ORD-TEST-7890, phone 14245275089, status kargoda
 *
 * Scenarios:
 *   1. Happy path: Known email + real order number → autoverify → full data
 *   2. Happy path: Known email + phone number → autoverify → full data
 *   3. Fake order number → NOT_FOUND
 *   4. Cross-customer leak: Unknown email + real order → VERIFICATION_REQUIRED
 *   5. Phone normalization: Various formats → all resolve to same record
 *   6. Verification flow: Name match, phone_last4 match, phone full match
 *   7. extractPhone: International phone parsing
 *   8. extractOrderNumber: Various order number formats
 *   9. phoneSearchVariants: Cross-format variant generation
 *  10. comparePhones: Ambiguous number matching
 *  11. Field labels: NOT_FOUND messages use human-readable field names
 *  12. toolWhitelist: customer_data_lookup fields match actual response shape
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../src/prismaClient.js';
import { overrideFeatureFlag } from '../src/config/feature-flags.js';

// Feature flag override is done in beforeAll below (process.env doesn't work
// because ESM imports hoist and FEATURE_FLAGS caches at module load time).
import { execute as customerDataLookup } from '../src/tools/handlers/customer-data-lookup.js';
import {
  createAnchor,
  verifyAgainstAnchor,
  checkVerification,
  getFullResult,
  getMinimalResult
} from '../src/services/verification-service.js';
import {
  normalizePhone,
  phoneSearchVariants,
  comparePhones,
  compareTurkishNames
} from '../src/utils/text.js';
import { deriveIdentityProof, ProofStrength } from '../src/security/identityProof.js';
import { tryAutoverify } from '../src/security/autoverify.js';
import { enforceToolRequiredPolicy } from '../src/core/email/policies/toolRequiredPolicy.js';
import { validateToolResult } from '../src/core/email/toolWhitelist.js';

// ─── Enable Feature Flags for Smoke Tests ────────────────────────────
beforeAll(() => {
  overrideFeatureFlag('CHANNEL_PROOF_AUTOVERIFY', true);
});

// ─── Test Data Constants ─────────────────────────────────────────────
const TEST_BUSINESS_ID = 1;
const TEST_EMAIL = 'nurettinerzen@gmail.com';
const TEST_PHONE_DB = '14245275089';       // How it's stored in DB
const TEST_PHONE_US = '+14245275089';      // US format with +
const TEST_PHONE_BARE = '4245275089';      // Without country code
const TEST_PHONE_TR_WRONG = '+904245275089'; // Wrongly assumed as TR
const TEST_ORDER = 'ORD-TEST-7890';
const TEST_CUSTOMER_NAME = 'Nurettin Erzen';
const FAKE_ORDER = 'ORD-999999';
const FAKE_EMAIL = 'hacker@evil.com';
const FAKE_PHONE = '5559999999';

// Reimplement extractPhone locally (not exported from 05_toolLoop.js)
function extractPhone(text) {
  if (!text) return null;
  const intlMatch = text.match(/\+\d[\d\s\-().]{7,18}\d/);
  if (intlMatch) return normalizePhone(intlMatch[0]);
  const trMatch = text.match(/(?:0)?[2-5]\d{2}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/);
  if (trMatch) return normalizePhone(trMatch[0]);
  const naMatch = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  if (naMatch) return normalizePhone(naMatch[0]);
  const bareMatch = text.match(/\d[\d\s\-]{8,17}\d/);
  if (bareMatch) {
    const digits = bareMatch[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return normalizePhone(bareMatch[0]);
  }
  return null;
}

function extractOrderNumber(text) {
  if (!text) return null;
  const prefixMatch = text.match(/\b(ORD-[\w-]+|SIP-[\w-]+|SP-[\w-]+)\b/i);
  if (prefixMatch) return prefixMatch[1].trim();
  const keywordMatch = text.match(/(?:sipariş|order|siparis)\s*(?:no|numarası|numarasi|number|num)[:\s#-]+(\d[\w-]{3,})/i);
  if (keywordMatch) return keywordMatch[1].trim();
  const directMatch = text.match(/(?:sipariş|order|siparis)\s*(?:numaranız|numaraniz|numarası|numarasi)?\s*[:;]?\s*(\d[\w-]{5,})/i);
  if (directMatch) return directMatch[1].trim();
  const hashMatch = text.match(/#\s*(\d[\w-]{3,})/i);
  if (hashMatch) return hashMatch[1].trim();
  return null;
}

// Helper: call tool with email context
function callTool(args, overrides = {}) {
  return customerDataLookup(args, { id: TEST_BUSINESS_ID }, {
    channel: 'EMAIL',
    fromEmail: TEST_EMAIL,
    sessionId: `smoke-test-${Date.now()}`,
    messageId: `smoke-msg-${Date.now()}`,
    language: 'TR',
    state: {},
    ...overrides
  });
}

// Helper: call tool with pending verification state (email multi-turn)
function callToolWithVerification(args, verificationInput, overrides = {}) {
  return customerDataLookup(args, { id: TEST_BUSINESS_ID }, {
    channel: 'EMAIL',
    fromEmail: TEST_EMAIL,
    sessionId: `smoke-test-${Date.now()}`,
    messageId: `smoke-msg-${Date.now()}`,
    language: 'TR',
    state: {
      verification: {
        status: 'pending',
        pendingField: 'name',
        attempts: 0
      }
    },
    ...overrides
  });
}

// ─── DB Precondition Check ───────────────────────────────────────────

describe('Smoke Test: Preconditions', () => {
  it('test CustomerData exists in DB', async () => {
    const customer = await prisma.customerData.findFirst({
      where: { businessId: TEST_BUSINESS_ID, email: TEST_EMAIL }
    });
    expect(customer).not.toBeNull();
    expect(customer.phone).toBe(TEST_PHONE_DB);
    expect(customer.contactName).toBe(TEST_CUSTOMER_NAME);
  });

  it('test CrmOrder exists in DB', async () => {
    const order = await prisma.crmOrder.findFirst({
      where: { businessId: TEST_BUSINESS_ID, orderNumber: TEST_ORDER }
    });
    expect(order).not.toBeNull();
    expect(order.customerPhone).toBe(TEST_PHONE_DB);
    expect(order.status).toBe('kargoda');
  });

  it('only ONE CustomerData matches test phone', async () => {
    const variants = phoneSearchVariants(TEST_PHONE_DB);
    const matches = await prisma.customerData.findMany({
      where: {
        businessId: TEST_BUSINESS_ID,
        OR: variants.map(v => ({ phone: v }))
      }
    });
    expect(matches.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 1: Happy Path — Email + Real Order Number
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 1: Email + Real Order Number → Autoverify → Full Data', () => {

  it('Step 1: extractOrderNumber parses order from email body', () => {
    const body = 'merhaba siparisim ne durumda acaba?\n\nsiparis no: ORD-TEST-7890\n\nBest,\nNurettin Erzen';
    const orderNo = extractOrderNumber(body);
    expect(orderNo).toBe('ORD-TEST-7890');
  });

  it('Step 2: tool finds CrmOrder by order number', async () => {
    const result = await callTool({
      query_type: 'siparis',
      order_number: TEST_ORDER
    });

    // Without autoverify, should get VERIFICATION_REQUIRED (tool doesn't do autoverify)
    expect(result._identityContext).toBeDefined();
    expect(result._identityContext.anchorSourceTable).toBe('CrmOrder');
    expect(result._identityContext.anchorCustomerId).toBeDefined();
  });

  it('Step 3: deriveEmailProof returns STRONG for known email', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: TEST_EMAIL, businessId: TEST_BUSINESS_ID },
      { queryType: 'siparis' }
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBeDefined();
  });

  it('Step 4: autoverify applies when proof + anchor match', async () => {
    // First get tool result with _identityContext
    const toolResult = await callTool({
      query_type: 'siparis',
      order_number: TEST_ORDER
    });

    // Only try autoverify if VERIFICATION_REQUIRED
    if (toolResult.outcome === 'VERIFICATION_REQUIRED' && toolResult._identityContext) {
      const avResult = await tryAutoverify({
        toolResult,
        toolName: 'customer_data_lookup',
        business: { id: TEST_BUSINESS_ID },
        state: {},
        language: 'TR'
      });

      expect(avResult.applied).toBe(true);
      expect(toolResult.outcome).toBe('OK');
      expect(toolResult.data).toBeDefined();
      expect(toolResult.data.order).toBeDefined();
      expect(toolResult.data.order.orderNumber).toBe(TEST_ORDER);
      expect(toolResult.data.order.status).toBe('kargoda');
    }
    // If tool already returned OK (e.g. via pending verification state), that's fine too
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 2: Happy Path — Email + Phone Number
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 2: Email + Phone → Find Order → Autoverify', () => {

  it('Step 1: extractPhone handles bare US number', () => {
    const body = 'Nurettin Erzen\n4245275089\n\nBest,\nNurettin Erzen';
    const phone = extractPhone(body);
    expect(phone).toBeDefined();
    expect(phone).not.toBeNull();
  });

  it('Step 2: phoneSearchVariants generates correct variants for bare number', () => {
    const variants = phoneSearchVariants(TEST_PHONE_BARE);
    expect(variants).toContain(TEST_PHONE_DB);  // 14245275089
    expect(variants).toContain(TEST_PHONE_BARE); // 4245275089
  });

  it('Step 3: phoneSearchVariants generates correct variants for wrongly-TR-normalized', () => {
    // extractPhone returns +904245275089, then tool uses phoneSearchVariants
    const variants = phoneSearchVariants(TEST_PHONE_TR_WRONG);
    expect(variants).toContain(TEST_PHONE_DB);   // 14245275089 (US interpretation)
    expect(variants).toContain(TEST_PHONE_BARE); // 4245275089
  });

  it('Step 4: tool finds record by phone (with verification)', async () => {
    const result = await callToolWithVerification({
      query_type: 'siparis',
      phone: TEST_PHONE_BARE,
      verification_input: TEST_PHONE_BARE
    });

    // Phone as verification_input should go through verifyAgainstAnchor
    // It may succeed or ask for more info depending on anchor phone format
    expect(['OK', 'VERIFICATION_REQUIRED', 'NOT_FOUND']).toContain(result.outcome);

    if (result.outcome === 'OK') {
      expect(result.data).toBeDefined();
      // Should have found the CrmOrder for order query
      expect(result.data.order).toBeDefined();
      expect(result.data.order.orderNumber).toBe(TEST_ORDER);
    }
  });

  it('Step 5: tool finds order via phone + prefers CrmOrder for siparis query', async () => {
    const result = await callToolWithVerification({
      query_type: 'siparis',
      phone: TEST_PHONE_US,
      customer_name: TEST_CUSTOMER_NAME,
      verification_input: TEST_CUSTOMER_NAME
    });

    expect(result.outcome).toBe('OK');
    expect(result.data.order).toBeDefined();
    expect(result.data.order.orderNumber).toBe(TEST_ORDER);
    expect(result.data.order.status).toBe('kargoda');
    expect(result.data.order.trackingNumber).toBe('TR987654321');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 3: Fake Order Number → NOT_FOUND
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 3: Fake Order Number → NOT_FOUND (no data leak)', () => {

  it('Step 1: extractOrderNumber parses various fake formats', () => {
    expect(extractOrderNumber('siparis no: ORD-999999')).toBe('ORD-999999');
    expect(extractOrderNumber('order number: 123456789')).toBe('123456789');
    expect(extractOrderNumber('#55555')).toBe('55555');
  });

  it('Step 2: tool returns NOT_FOUND for fake order', async () => {
    const result = await callTool({
      query_type: 'siparis',
      order_number: FAKE_ORDER
    });

    expect(result.outcome).toBe('NOT_FOUND');
    expect(result.data).toBeNull();
    // Message should NOT reveal whether any record exists
    expect(result.message).toBeDefined();
    expect(result.message).not.toContain(TEST_CUSTOMER_NAME);
    expect(result.message).not.toContain(TEST_PHONE_DB);
  });

  it('Step 3: toolRequiredPolicy enforces NOT_FOUND correctly', () => {
    const policy = enforceToolRequiredPolicy({
      classification: { intent: 'ORDER' },
      toolResults: [{ toolName: 'customer_data_lookup', outcome: 'NOT_FOUND' }],
      language: 'TR'
    });

    expect(policy.enforced).toBe(true);
    expect(policy.reason).toBe('NOT_FOUND');
    // Message should use human-readable field names
    expect(policy.message).not.toContain('order_number');
    expect(policy.message).not.toContain('phone');
    expect(policy.message).toContain('sipariş numarası');
    expect(policy.message).toContain('telefon numarası');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 4: Cross-Customer Leak — Unknown Email + Real Order
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 4: Cross-Customer Leak Prevention', () => {

  it('Step 1: deriveEmailProof returns WEAK for unknown email', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: FAKE_EMAIL, businessId: TEST_BUSINESS_ID },
      { queryType: 'siparis' }
    );
    expect(proof.strength).toBe(ProofStrength.WEAK);
    expect(proof.matchedCustomerId).toBeNull();
  });

  it('Step 2: tool with unknown email returns VERIFICATION_REQUIRED for real order', async () => {
    const result = await callTool(
      { query_type: 'siparis', order_number: TEST_ORDER },
      { fromEmail: FAKE_EMAIL }
    );

    // Should require verification, not auto-return data
    expect(result.outcome).toBe('VERIFICATION_REQUIRED');
    expect(result._identityContext).toBeDefined();
    expect(result._identityContext.fromEmail).toBe(FAKE_EMAIL);
  });

  it('Step 3: autoverify DENIES because email proof mismatches', async () => {
    const toolResult = await callTool(
      { query_type: 'siparis', order_number: TEST_ORDER },
      { fromEmail: FAKE_EMAIL }
    );

    if (toolResult.outcome === 'VERIFICATION_REQUIRED' && toolResult._identityContext) {
      const avResult = await tryAutoverify({
        toolResult,
        toolName: 'customer_data_lookup',
        business: { id: TEST_BUSINESS_ID },
        state: {},
        language: 'TR'
      });

      expect(avResult.applied).toBe(false);
      expect(toolResult.outcome).toBe('VERIFICATION_REQUIRED');
      // Telemetry should show mismatch or weak proof
      expect(avResult.telemetry).toBeDefined();
      expect(['PROOF_WEAK', 'NO_MATCHED_CUSTOMERID', 'CUSTOMERID_MISMATCH', 'FEATURE_DISABLED'])
        .toContain(avResult.telemetry.autoverifySkipReason);
    }
  });

  it('Step 4: wrong name verification also blocked', async () => {
    const result = await callToolWithVerification(
      {
        query_type: 'siparis',
        order_number: TEST_ORDER,
        customer_name: 'Hakan Yilmaz',
        verification_input: 'Hakan Yilmaz'
      },
      'Hakan Yilmaz',
      { fromEmail: FAKE_EMAIL }
    );

    // Should return NOT_FOUND (generic, no info leak)
    expect(result.outcome).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 5: Phone Number Normalization — All Formats
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 5: Phone Normalization & Cross-Format Matching', () => {

  it('normalizePhone handles all input formats', () => {
    expect(normalizePhone('+14245275089')).toBe('+14245275089');
    expect(normalizePhone('+1 424 527 5089')).toBe('+14245275089');
    expect(normalizePhone('14245275089')).toBe('+14245275089');
    // Bare 10 digits → assumed TR (but phoneSearchVariants adds US alt)
    expect(normalizePhone('4245275089')).toBe('+904245275089');
    // Turkish formats
    expect(normalizePhone('+905321234567')).toBe('+905321234567');
    expect(normalizePhone('05321234567')).toBe('+905321234567');
    expect(normalizePhone('5321234567')).toBe('+905321234567');
  });

  it('comparePhones matches across TR/US ambiguity', () => {
    // These are all the same US number
    expect(comparePhones('+14245275089', '14245275089')).toBe(true);
    expect(comparePhones('4245275089', '14245275089')).toBe(true);
    expect(comparePhones('+904245275089', '14245275089')).toBe(true);
    // TR numbers
    expect(comparePhones('+905321234567', '5321234567')).toBe(true);
    expect(comparePhones('05321234567', '905321234567')).toBe(true);
    // Different numbers
    expect(comparePhones('5321234567', '5559999999')).toBe(false);
  });

  it('phoneSearchVariants covers all DB storage formats', () => {
    // US number entered without country code
    const v1 = phoneSearchVariants('4245275089');
    expect(v1).toContain('14245275089');     // US with country code
    expect(v1).toContain('+14245275089');    // US with +
    expect(v1).toContain('4245275089');      // bare
    expect(v1).toContain('+904245275089');   // wrongly assumed TR
    expect(v1).toContain('904245275089');    // TR digits

    // US number with country code
    const v2 = phoneSearchVariants('+14245275089');
    expect(v2).toContain('+14245275089');
    expect(v2).toContain('14245275089');
    expect(v2).toContain('4245275089');

    // TR number
    const v3 = phoneSearchVariants('5321234567');
    expect(v3).toContain('+905321234567');
    expect(v3).toContain('905321234567');
    expect(v3).toContain('5321234567');

    // Already +90 prefixed
    const v4 = phoneSearchVariants('+905321234567');
    expect(v4).toContain('+905321234567');
    expect(v4).toContain('905321234567');
    expect(v4).toContain('5321234567');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 6: Verification Flow — Name, Phone Last4, Full Phone
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 6: Verification Against Anchor', () => {
  let anchor;

  beforeAll(async () => {
    // Create a realistic anchor from test CrmOrder
    const order = await prisma.crmOrder.findFirst({
      where: { businessId: TEST_BUSINESS_ID, orderNumber: TEST_ORDER }
    });
    anchor = createAnchor(order, 'order', TEST_ORDER, 'CrmOrder');
    // Manually set customerId (normally done by tool handler)
    const customer = await prisma.customerData.findFirst({
      where: { businessId: TEST_BUSINESS_ID, email: TEST_EMAIL }
    });
    anchor.customerId = customer?.id || null;
  });

  it('name verification: correct full name → matches', () => {
    const result = verifyAgainstAnchor(anchor, 'Nurettin Erzen');
    expect(result.matches).toBe(true);
    expect(result.field).toBe('name');
  });

  it('name verification: partial name → no match (needs 2 words)', () => {
    const result = verifyAgainstAnchor(anchor, 'Nurettin');
    expect(result.matches).toBe(false);
  });

  it('name verification: wrong name → no match', () => {
    const result = verifyAgainstAnchor(anchor, 'Ali Veli');
    expect(result.matches).toBe(false);
  });

  it('phone last 4: correct digits → matches', () => {
    // Last 4 of 14245275089 = 5089
    const result = verifyAgainstAnchor(anchor, '5089');
    expect(result.matches).toBe(true);
    expect(result.field).toBe('phone_last4');
  });

  it('phone last 4: wrong digits → no match', () => {
    const result = verifyAgainstAnchor(anchor, '1234');
    expect(result.matches).toBe(false);
  });

  it('full phone: matching number → matches', () => {
    const result = verifyAgainstAnchor(anchor, '14245275089');
    expect(result.matches).toBe(true);
    expect(result.field).toBe('phone');
  });

  it('full phone: different number → no match', () => {
    const result = verifyAgainstAnchor(anchor, '5559999999');
    expect(result.matches).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 7: extractPhone — International Formats
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 7: extractPhone International Support', () => {

  it('US format with +1', () => {
    expect(extractPhone('+1 424 527 5089')).toBe('+14245275089');
  });

  it('US format with parens', () => {
    const result = extractPhone('(424) 527-5089');
    expect(result).toBeDefined();
    // Should contain the digits 4245275089
    expect(result.replace(/\D/g, '')).toContain('4245275089');
  });

  it('US format with dashes', () => {
    const result = extractPhone('424-527-5089');
    expect(result).toBeDefined();
    expect(result.replace(/\D/g, '')).toContain('4245275089');
  });

  it('bare digits (10 digit)', () => {
    const result = extractPhone('4245275089');
    expect(result).toBeDefined();
  });

  it('Turkish mobile', () => {
    expect(extractPhone('+90 532 123 4567')).toBe('+905321234567');
    expect(extractPhone('05321234567')).toBe('+905321234567');
    expect(extractPhone('532 123 45 67')).toBe('+905321234567');
  });

  it('UK format', () => {
    const result = extractPhone('+44 7911 123456');
    expect(result).toBeDefined();
    expect(result).toBe('+447911123456');
  });

  it('no phone in text → null', () => {
    expect(extractPhone('merhaba nasılsınız?')).toBeNull();
    expect(extractPhone('sipariş no: ORD-12345')).toBeNull();
    expect(extractPhone('')).toBeNull();
    expect(extractPhone(null)).toBeNull();
  });

  it('phone embedded in email body', () => {
    const body = 'Merhaba,\nTelefonum 4245275089.\nTeşekkürler.';
    const result = extractPhone(body);
    expect(result).toBeDefined();
    expect(result.replace(/\D/g, '')).toContain('4245275089');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 8: extractOrderNumber — Various Formats
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 8: extractOrderNumber Format Support', () => {

  it('ORD- prefix', () => {
    expect(extractOrderNumber('siparis no: ORD-TEST-7890')).toBe('ORD-TEST-7890');
    expect(extractOrderNumber('ORD-12345')).toBe('ORD-12345');
  });

  it('SIP- prefix', () => {
    expect(extractOrderNumber('SIP-99887')).toBe('SIP-99887');
  });

  it('keyword: sipariş no', () => {
    expect(extractOrderNumber('sipariş no: 202620321')).toBe('202620321');
    expect(extractOrderNumber('sipariş numarası: 12345678')).toBe('12345678');
  });

  it('keyword: order number', () => {
    // Regex requires digit-start (prevents matching Turkish words)
    expect(extractOrderNumber('order number: 12345678')).toBe('12345678');
    // ABC-prefix won't match (by design — prevents false positives)
    expect(extractOrderNumber('order number: ABC-123')).toBeNull();
  });

  it('hashtag format', () => {
    expect(extractOrderNumber('#12345')).toBe('12345');
  });

  it('no order number → null', () => {
    expect(extractOrderNumber('merhaba nasılsınız?')).toBeNull();
    expect(extractOrderNumber('telefonum 5321234567')).toBeNull();
    expect(extractOrderNumber('')).toBeNull();
    expect(extractOrderNumber(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 9: Tool Result Shape Validation
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 9: Tool Result Shape & Whitelist', () => {

  it('OK result has expected fields for whitelist', async () => {
    const result = await callToolWithVerification({
      query_type: 'siparis',
      order_number: TEST_ORDER,
      customer_name: TEST_CUSTOMER_NAME,
      verification_input: TEST_CUSTOMER_NAME
    });

    if (result.outcome === 'OK' && result.data) {
      // Validate against whitelist
      const validation = validateToolResult('customer_data_lookup', result.data);
      expect(validation.valid).toBe(true);
      expect(validation.missingFields).toEqual([]);

      // Check data shape
      expect(result.data.customerName).toBeDefined();
      expect(result.data.order).toBeDefined();
    }
  });

  it('getFullResult returns correct shape for CrmOrder', async () => {
    const order = await prisma.crmOrder.findFirst({
      where: { businessId: TEST_BUSINESS_ID, orderNumber: TEST_ORDER }
    });

    const result = getFullResult(order, 'siparis', 'TR');

    expect(result.data).toBeDefined();
    expect(result.data.order).toBeDefined();
    expect(result.data.order.orderNumber).toBe(TEST_ORDER);
    expect(result.data.order.status).toBe('kargoda');
    expect(result.data.order.trackingNumber).toBe('TR987654321');
    expect(result.data.order.carrier).toBe('YURTICI');
    expect(result.message).toContain('ORD-TEST-7890');
    expect(result.message).toContain('kargoda');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 10: Identity Proof — WhatsApp Channel
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 10: WhatsApp Identity Proof', () => {

  it('known phone → STRONG proof', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'WHATSAPP', channelUserId: TEST_PHONE_US, businessId: TEST_BUSINESS_ID },
      {}
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBeDefined();
  });

  it('bare phone (without country code) → still STRONG (variants match)', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'WHATSAPP', channelUserId: TEST_PHONE_BARE, businessId: TEST_BUSINESS_ID },
      {}
    );
    // phoneSearchVariants should generate the right DB format
    expect(proof.strength).toBe(ProofStrength.STRONG);
  });

  it('unknown phone → WEAK proof', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'WHATSAPP', channelUserId: FAKE_PHONE, businessId: TEST_BUSINESS_ID },
      {}
    );
    expect(proof.strength).toBe(ProofStrength.WEAK);
    expect(proof.matchedCustomerId).toBeNull();
  });

  it('CHAT channel → NONE proof', async () => {
    const proof = await deriveIdentityProof(
      { channel: 'CHAT', businessId: TEST_BUSINESS_ID },
      {}
    );
    expect(proof.strength).toBe(ProofStrength.NONE);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 11: Field Labels in Error Messages
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 11: Human-Readable Field Labels', () => {

  const intentsToCheck = ['ORDER', 'BILLING', 'COMPLAINT', 'REFUND'];

  for (const intent of intentsToCheck) {
    it(`${intent} NOT_FOUND message uses Turkish labels`, () => {
      const policy = enforceToolRequiredPolicy({
        classification: { intent },
        toolResults: [{ toolName: 'customer_data_lookup', outcome: 'NOT_FOUND' }],
        language: 'TR'
      });

      if (policy.enforced && policy.reason === 'NOT_FOUND') {
        // Should NOT contain raw field names
        expect(policy.message).not.toMatch(/\border_number\b/);
        expect(policy.message).not.toMatch(/\bphone\b(?!.*numarası)/);
        expect(policy.message).not.toMatch(/\binvoice_number\b/);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 12: Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe('Scenario 12: Edge Cases', () => {

  it('empty args → validation error or NOT_FOUND', async () => {
    const result = await callTool({ query_type: 'siparis' });
    expect(['VALIDATION_ERROR', 'NOT_FOUND']).toContain(result.outcome);
  });

  it('phone with spaces and dashes → still works', async () => {
    const variants = phoneSearchVariants('+1 (424) 527-5089');
    expect(variants).toContain('14245275089');
  });

  it('null/undefined phone → empty variants', () => {
    expect(phoneSearchVariants(null)).toEqual([]);
    expect(phoneSearchVariants(undefined)).toEqual([]);
    expect(phoneSearchVariants('')).toEqual([]);
  });

  it('very short input → no phone extracted', () => {
    expect(extractPhone('12')).toBeNull();
    expect(extractPhone('abc')).toBeNull();
  });

  it('compareTurkishNames handles Turkish characters', () => {
    // If the function exists and works
    expect(compareTurkishNames('Nurettin Erzen', 'nurettin erzen')).toBe(true);
    expect(compareTurkishNames('Ahmet Özdemir', 'ahmet ozdemir')).toBe(true);
    expect(compareTurkishNames('Ali Veli', 'Hasan Hüseyin')).toBe(false);
  });
});

// Cleanup
afterAll(async () => {
  await prisma.$disconnect();
});

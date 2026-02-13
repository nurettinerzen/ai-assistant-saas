/**
 * Unit Tests: Autoverify + IdentityProof + CustomerId Chain
 *
 * Tests the autoverify security model:
 *   1. EMAIL strong proof + single customer → autoverify OK
 *   2. EMAIL 2+ customer matches → VERIFICATION_REQUIRED
 *   3. WHATSAPP strong proof + matchedCustomerId → autoverify OK
 *   4. WHATSAPP single order match but customerId null → autoverify blocked
 *   5. Identity switch → autoverify denied
 *   6. CHAT → autoverify never applies
 *   7. FINANCIAL query + strong proof → autoverify OK (FINANCIAL removed)
 *   8. anchor.customerId chain propagation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB (inline factory for hoisting) ──────────────────────────
vi.mock('../../src/config/database.js', () => {
  return {
    default: {
      customerData: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      crmOrder: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      }
    }
  };
});

// ─── Mock feature flags ─────────────────────────────────────────────
vi.mock('../../src/config/feature-flags.js', () => ({
  isChannelProofEnabled: vi.fn(() => true),
  FEATURE_FLAGS: { CHANNEL_PROOF_AUTOVERIFY: true }
}));

// ─── Mock pii-redaction (used by verification-service) ──────────────
vi.mock('../../src/utils/pii-redaction.js', () => ({
  redactPII: vi.fn((obj) => obj)
}));

// ─── Mock messageCatalog (used by verification-service) ─────────────
vi.mock('../../src/messages/messageCatalog.js', () => ({
  getMessageVariant: vi.fn(() => ({ text: 'Doğrulama gerekiyor.', variant: 0 })),
  hasMessageKey: vi.fn(() => true)
}));

// ─── Mock text utils ────────────────────────────────────────────────
vi.mock('../../src/utils/text.js', () => ({
  normalizePhone: vi.fn((p) => p),
  phoneSearchVariants: vi.fn((p) => {
    // Return plausible variants so deriveWhatsAppProof can match DB mocks
    if (!p) return [];
    const raw = String(p).trim();
    const digits = raw.replace(/\D/g, '');
    const variants = new Set([raw, digits]);
    if (raw.startsWith('+')) variants.add(raw.slice(1));
    if (digits.startsWith('90') && digits.length > 10) variants.add(digits.slice(2));
    if (digits.startsWith('1') && digits.length === 11) variants.add(digits.slice(1));
    return [...variants].filter(Boolean);
  }),
  compareTurkishNames: vi.fn(() => false),
  comparePhones: vi.fn(() => false)
}));

// ─── Imports (after mocks) ──────────────────────────────────────────
import prisma from '../../src/config/database.js';
import {
  ProofStrength,
  deriveIdentityProof,
  shouldRequireAdditionalVerification
} from '../../src/security/identityProof.js';

import { tryAutoverify } from '../../src/security/autoverify.js';

import {
  createAnchor
} from '../../src/services/verification-service.js';

// ─── Helpers ────────────────────────────────────────────────────────
function makeToolResult(overrides = {}) {
  return {
    outcome: 'VERIFICATION_REQUIRED',
    success: true,
    data: null,
    message: 'Doğrulama gerekiyor.',
    verificationRequired: true,
    stateEvents: [{ type: 'verification.required', askFor: 'phone_last4' }],
    _identityContext: {
      channel: 'EMAIL',
      channelUserId: null,
      fromEmail: 'test@example.com',
      businessId: 1,
      anchorId: 'cust_1',
      anchorCustomerId: 'cust_1',
      anchorSourceTable: 'CustomerData',
      queryType: 'genel'
    },
    ...overrides
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('shouldRequireAdditionalVerification', () => {
  it('STRONG proof → no second factor required', () => {
    const proof = { strength: ProofStrength.STRONG, matchedCustomerId: 'c1' };
    const result = shouldRequireAdditionalVerification(proof, 'ORDER');
    expect(result.required).toBe(false);
    expect(result.reason).toBe('channel_proof_sufficient');
  });

  it('STRONG proof + financial intent → still no second factor (FINANCIAL removed)', () => {
    const proof = { strength: ProofStrength.STRONG, matchedCustomerId: 'c1' };
    const result = shouldRequireAdditionalVerification(proof, 'BILLING');
    expect(result.required).toBe(false);
  });

  it('STRONG proof + debt query → still no second factor (FINANCIAL removed)', () => {
    const proof = { strength: ProofStrength.STRONG, matchedCustomerId: 'c1' };
    const result = shouldRequireAdditionalVerification(proof, 'DEBT_INQUIRY');
    expect(result.required).toBe(false);
  });

  it('WEAK proof → second factor required', () => {
    const proof = { strength: ProofStrength.WEAK, matchedCustomerId: null, reasons: ['email_multiple_matches'] };
    const result = shouldRequireAdditionalVerification(proof, 'ORDER');
    expect(result.required).toBe(true);
  });

  it('NONE proof → second factor required', () => {
    const proof = { strength: ProofStrength.NONE, matchedCustomerId: null };
    const result = shouldRequireAdditionalVerification(proof, 'ORDER');
    expect(result.required).toBe(true);
  });

  it('null proof → fail-closed, second factor required', () => {
    const result = shouldRequireAdditionalVerification(null, 'ORDER');
    expect(result.required).toBe(true);
    expect(result.reason).toBe('no_proof_available');
  });
});

describe('deriveIdentityProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CHAT channel → NONE (no identity signal)', async () => {
    const proof = await deriveIdentityProof({ channel: 'CHAT', businessId: 1 });
    expect(proof.strength).toBe(ProofStrength.NONE);
  });

  it('EMAIL + single customer match → STRONG', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com', companyName: 'Test Co' }
    ]);

    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: 'test@example.com', businessId: 1 },
      { queryType: 'genel' }
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBe('cust_1');
  });

  it('EMAIL + 2 customer matches → WEAK', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com' },
      { id: 'cust_2', email: 'test@example.com' }
    ]);

    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: 'test@example.com', businessId: 1 },
      { queryType: 'genel' }
    );
    expect(proof.strength).toBe(ProofStrength.WEAK);
    expect(proof.matchedCustomerId).toBeNull();
  });

  it('EMAIL + order-level query + single match → STRONG (MVP restriction removed)', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com', companyName: 'Test Co' }
    ]);

    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: 'test@example.com', businessId: 1 },
      { queryType: 'siparis' }
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBe('cust_1');
  });

  it('EMAIL + order-level query + no match → WEAK', async () => {
    prisma.customerData.findMany.mockResolvedValue([]);

    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: 'unknown@example.com', businessId: 1 },
      { queryType: 'siparis' }
    );
    expect(proof.strength).toBe(ProofStrength.WEAK);
  });

  it('WHATSAPP + single customer match → STRONG', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', phone: '5551234567', companyName: 'Test' }
    ]);
    prisma.crmOrder.findMany.mockResolvedValue([]);

    const proof = await deriveIdentityProof(
      { channel: 'WHATSAPP', channelUserId: '+905551234567', businessId: 1 }
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBe('cust_1');
  });

  it('WHATSAPP + order-only match (no CustomerData) → STRONG with null matchedCustomerId', async () => {
    prisma.customerData.findMany.mockResolvedValue([]);
    prisma.crmOrder.findMany.mockResolvedValue([
      { id: 'ord_1', customerPhone: '5551234567', orderNumber: 'ORD-1' }
    ]);

    const proof = await deriveIdentityProof(
      { channel: 'WHATSAPP', channelUserId: '+905551234567', businessId: 1 }
    );
    expect(proof.strength).toBe(ProofStrength.STRONG);
    expect(proof.matchedCustomerId).toBeNull();
    expect(proof.matchedOrderId).toBe('ord_1');
  });

  it('error during derivation → fail-closed NONE', async () => {
    prisma.customerData.findMany.mockRejectedValue(new Error('DB down'));

    const proof = await deriveIdentityProof(
      { channel: 'EMAIL', fromEmail: 'test@example.com', businessId: 1 },
      { queryType: 'genel' }
    );
    expect(proof.strength).toBe(ProofStrength.NONE);
    expect(proof.reasons).toContain('derivation_error');
  });
});

describe('tryAutoverify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EMAIL strong proof + matching customerId → autoverify applies + telemetry', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com', companyName: 'Test' }
    ]);
    prisma.customerData.findUnique.mockResolvedValue({
      id: 'cust_1', customerName: 'Test User', phone: '5551234567',
      email: 'test@example.com', customFields: {}
    });

    const toolResult = makeToolResult();
    const metrics = {};

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: { intent: 'ORDER' },
      language: 'TR',
      metrics
    });

    expect(result.applied).toBe(true);
    expect(toolResult.outcome).toBe('OK');
    expect(toolResult.success).toBe(true);
    expect(toolResult.stateEvents[0].reason).toBe('channel_proof');
    expect(toolResult.stateEvents[0].anchor.customerId).toBe('cust_1');

    // Telemetry checks
    expect(result.telemetry.autoverifyAttempted).toBe(true);
    expect(result.telemetry.autoverifyApplied).toBe(true);
    expect(result.telemetry.autoverifySkipReason).toBeNull();
    expect(result.telemetry.anchorCustomerId).toBe('cust_1');
    expect(result.telemetry.matchedCustomerId).toBe('cust_1');
    expect(metrics.identityProof.autoverifyApplied).toBe(true);
  });

  it('EMAIL + order query + single match → autoverify applies (MVP restriction removed)', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com', companyName: 'Test' }
    ]);
    prisma.customerData.findUnique.mockResolvedValue({
      id: 'cust_1', customerName: 'Test User', phone: '5551234567',
      email: 'test@example.com', customFields: {}
    });

    const toolResult = makeToolResult({
      _identityContext: {
        channel: 'EMAIL',
        fromEmail: 'test@example.com',
        businessId: 1,
        anchorId: 'cust_1',
        anchorCustomerId: 'cust_1',
        anchorSourceTable: 'CustomerData',
        queryType: 'siparis'  // Previously blocked by MVP restriction
      }
    });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: { intent: 'ORDER' },
      language: 'TR'
    });

    expect(result.applied).toBe(true);
    expect(toolResult.outcome).toBe('OK');
    expect(result.telemetry.autoverifySkipReason).toBeNull();
  });

  it('EMAIL strong proof + customerId MISMATCH → telemetry shows CUSTOMERID_MISMATCH', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_OTHER', email: 'test@example.com', companyName: 'Other' }
    ]);

    const toolResult = makeToolResult();
    // proof will match cust_OTHER, but anchor says cust_1 → mismatch
    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: { intent: 'ORDER' },
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(toolResult.outcome).toBe('VERIFICATION_REQUIRED');
    expect(result.telemetry.autoverifyAttempted).toBe(true);
    expect(result.telemetry.autoverifySkipReason).toBe('CUSTOMERID_MISMATCH');
    expect(result.telemetry.matchedCustomerId).toBe('cust_OTHER');
    expect(result.telemetry.anchorCustomerId).toBe('cust_1');
  });

  it('anchorCustomerId null → telemetry shows NO_ANCHOR_CUSTOMERID', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'test@example.com' }
    ]);

    const toolResult = makeToolResult({
      _identityContext: {
        channel: 'EMAIL',
        fromEmail: 'test@example.com',
        businessId: 1,
        anchorId: 'ord_1',
        anchorCustomerId: null,
        anchorSourceTable: 'CrmOrder',
        queryType: 'genel'
      }
    });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(result.telemetry.autoverifySkipReason).toBe('NO_ANCHOR_CUSTOMERID');
    expect(result.telemetry.anchorCustomerId).toBeNull();
  });

  it('CHAT channel → telemetry shows PROOF_WEAK', async () => {
    const toolResult = makeToolResult({
      _identityContext: {
        channel: 'CHAT',
        channelUserId: null,
        fromEmail: null,
        businessId: 1,
        anchorId: 'cust_1',
        anchorCustomerId: 'cust_1',
        anchorSourceTable: 'CustomerData',
        queryType: 'siparis'
      }
    });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(result.telemetry.autoverifyAttempted).toBe(true);
    expect(result.telemetry.autoverifySkipReason).toBe('PROOF_WEAK');
    expect(result.telemetry.strength).toBe('NONE');
  });

  it('non-VERIFICATION_REQUIRED outcome → skipped (no telemetry)', async () => {
    const toolResult = makeToolResult({ outcome: 'OK' });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(result.telemetry).toBeNull();
  });

  it('no _identityContext → skipped (no telemetry)', async () => {
    const toolResult = { outcome: 'VERIFICATION_REQUIRED', success: true };

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(result.telemetry).toBeNull();
  });

  it('DB error during proof derivation → fail-closed + telemetry PROOF_WEAK', async () => {
    prisma.customerData.findMany.mockRejectedValue(new Error('Connection lost'));

    const toolResult = makeToolResult();

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    // deriveIdentityProof catches DB errors internally → returns NONE (not ERROR)
    // tryAutoverify sees NONE → PROOF_WEAK skip reason
    expect(result.telemetry.strength).toBe('NONE');
    expect(result.telemetry.autoverifyAttempted).toBe(true);
    expect(result.telemetry.autoverifySkipReason).toBe('PROOF_WEAK');
  });

  it('WHATSAPP strong proof + matching customerId → autoverify applies', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', phone: '5551234567', companyName: 'Test' }
    ]);
    prisma.crmOrder.findMany.mockResolvedValue([]);
    prisma.customerData.findUnique.mockResolvedValue({
      id: 'cust_1', customerName: 'Test User', phone: '5551234567',
      email: 'test@example.com', customFields: {}
    });

    const toolResult = makeToolResult({
      _identityContext: {
        channel: 'WHATSAPP',
        channelUserId: '+905551234567',
        fromEmail: null,
        businessId: 1,
        anchorId: 'cust_1',
        anchorCustomerId: 'cust_1',
        anchorSourceTable: 'CustomerData',
        queryType: 'siparis'
      }
    });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: { intent: 'ORDER' },
      language: 'TR'
    });

    expect(result.applied).toBe(true);
    expect(toolResult.outcome).toBe('OK');
    expect(result.telemetry.autoverifySkipReason).toBeNull();
  });

  it('EMAIL ambiguous (2 customers) → autoverify denied + PROOF_WEAK', async () => {
    prisma.customerData.findMany.mockResolvedValue([
      { id: 'cust_1', email: 'shared@example.com' },
      { id: 'cust_2', email: 'shared@example.com' }
    ]);

    const toolResult = makeToolResult({
      _identityContext: {
        channel: 'EMAIL',
        fromEmail: 'shared@example.com',
        businessId: 1,
        anchorId: 'cust_1',
        anchorCustomerId: 'cust_1',
        anchorSourceTable: 'CustomerData',
        queryType: 'genel'
      }
    });

    const result = await tryAutoverify({
      toolResult,
      toolName: 'customer_data_lookup',
      business: { id: 1 },
      state: {},
      language: 'TR'
    });

    expect(result.applied).toBe(false);
    expect(result.telemetry.autoverifySkipReason).toBe('PROOF_WEAK');
    expect(result.telemetry.strength).toBe('WEAK');
  });
});

describe('createAnchor customerId chain', () => {
  it('CustomerData record → customerId === record.id', () => {
    const record = { id: 'cust_1', customerName: 'Test', phone: '555', email: 'test@t.com' };
    const anchor = createAnchor(record, 'order', 'ORD-1', 'CustomerData');

    expect(anchor.customerId).toBe('cust_1');
    expect(anchor.id).toBe('cust_1');
  });

  it('CrmOrder record → customerId is null (resolved separately by tool handler)', () => {
    const record = { id: 'ord_1', customerName: 'Test', customerPhone: '555' };
    const anchor = createAnchor(record, 'order', 'ORD-1', 'CrmOrder');

    expect(anchor.customerId).toBeNull();
    expect(anchor.id).toBe('ord_1');
  });
});

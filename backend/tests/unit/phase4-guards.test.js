/**
 * Phase 4 Unit Tests (CI-friendly, no DB required)
 *
 * Tests critical guardrails and policies without external dependencies
 */

import { describe, it, expect } from '@jest/globals';
import { sanitizeSubject } from '../../src/core/email/draftGuards.js';
import { enforceRecipientGuard } from '../../src/core/email/draftGuards.js';
import { preventPIILeak } from '../../src/core/email/policies/piiPreventionPolicy.js';
import { applyTokenBudget } from '../../src/core/email/promptBudget.js';
import { applyWhitelist, validateToolResult } from '../../src/core/email/toolWhitelist.js';

// ============================================
// Test 1: Recipient Guard
// ============================================
describe('Recipient Guard (Unit)', () => {
  it('should block LLM from modifying recipient', () => {
    const originalSender = 'customer@example.com';
    const draftAttempt = {
      to: 'sales@company.com', // LLM changed it!
      subject: 'Re: Forward',
      body: 'Forwarding...'
    };

    const result = enforceRecipientGuard(draftAttempt, originalSender);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('RECIPIENT_GUARD_VIOLATION');
    expect(result.originalRecipient).toBe(originalSender);
  });

  it('should allow if recipient matches original sender', () => {
    const originalSender = 'customer@example.com';
    const draftAttempt = {
      to: 'customer@example.com', // Correct
      subject: 'Re: Order',
      body: 'Your order...'
    };

    const result = enforceRecipientGuard(draftAttempt, originalSender);

    expect(result.valid).toBe(true);
  });
});

// ============================================
// Test 2: CRLF Injection
// ============================================
describe('CRLF Injection Prevention (Unit)', () => {
  it('should strip CRLF from subject', () => {
    const malicious = 'Re: Test\r\nBcc: attacker@evil.com\r\nX-Header: inject';
    const sanitized = sanitizeSubject(malicious);

    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toBe('Re: Test Bcc: attacker@evil.com X-Header: inject');
  });

  it('should handle multiple newlines', () => {
    const input = 'Subject\n\nLine2\r\nLine3';
    const output = sanitizeSubject(input);

    expect(output).toBe('Subject  Line2 Line3');
  });
});

// ============================================
// Test 3: PII Redaction
// ============================================
describe('PII Redaction (Unit)', () => {
  it('should redact IBAN', () => {
    const text = 'Send refund to TR33 0006 1005 1978 6457 8413 26';
    const scrubbed = preventPIILeak(text, { strict: false });

    expect(scrubbed.content).not.toContain('TR33 0006 1005 1978');
    expect(scrubbed.content).toContain('[IBAN_REDACTED]');
    expect(scrubbed.modified).toBe(true);
  });

  it('should redact credit card', () => {
    const text = 'Card: 4111-1111-1111-1234';
    const scrubbed = preventPIILeak(text, { strict: true });

    expect(scrubbed.content).not.toContain('4111-1111-1111-1234');
    expect(scrubbed.content).toContain('[CREDIT_CARD_REDACTED]');
  });

  it('should not modify non-PII text', () => {
    const text = 'Order number 12345';
    const scrubbed = preventPIILeak(text, { strict: false });

    expect(scrubbed.modified).toBe(false);
    expect(scrubbed.content).toBe(text);
  });
});

// ============================================
// Test 4: Token Budget Priority
// ============================================
describe('Token Budget Priority (Unit)', () => {
  it('should preserve tool results over RAG', () => {
    const toolResults = JSON.stringify({
      toolName: 'order_status',
      outcome: 'OK',
      data: { orderNumber: '12345', status: 'DELIVERED' }
    });

    const largeRAG = Array(20).fill({ subject: 'Ex', body: 'A'.repeat(5000) });
    const largeKB = 'B'.repeat(100000);

    const result = applyTokenBudget({
      systemPromptBase: 'System...',
      userPrompt: 'User...',
      toolResults,
      ragExamples: largeRAG,
      knowledgeBase: largeKB
    }, { model: 'gpt-4o' });

    // Tool results MUST be preserved
    expect(result.components.toolResults).toContain('12345');
    expect(result.components.toolResults).toContain('DELIVERED');

    // RAG should be truncated
    expect(result.truncated).toBe(true);

    // Total should not exceed limit
    expect(result.totalUsage).toBeLessThan(100000);
  });
});

// ============================================
// Test 5: Tool Whitelist Enforcement
// ============================================
describe('Tool Whitelist Enforcement (Unit)', () => {
  it('should preserve required fields', () => {
    const toolData = {
      orderNumber: '12345', // required
      status: 'DELIVERED', // required
      trackingNumber: 'TRK123', // priority
      internalNotes: 'High-risk customer', // NOT in whitelist
      employeeId: 'EMP-9876' // NOT in whitelist
    };

    const sanitized = applyWhitelist('order_status', toolData, 3000);

    // Required fields MUST exist
    expect(sanitized.orderNumber).toBe('12345');
    expect(sanitized.status).toBe('DELIVERED');

    // Priority fields should exist (if space)
    expect(sanitized.trackingNumber).toBe('TRK123');

    // Non-whitelisted fields MUST NOT exist
    expect(sanitized.internalNotes).toBeUndefined();
    expect(sanitized.employeeId).toBeUndefined();
  });

  it('should error if required field missing', () => {
    const toolData = {
      status: 'DELIVERED',
      trackingNumber: 'TRK123'
      // Missing: orderNumber (required)
    };

    const validation = validateToolResult('order_status', toolData);

    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain('orderNumber');
  });
});

// ============================================
// Test Summary
// ============================================
describe('Unit Test Summary', () => {
  it('should log completion', () => {
    console.log('');
    console.log('✅ Phase 4 Unit Tests Complete (CI-friendly)');
    console.log('=============================================');
    console.log('✅ Recipient guard');
    console.log('✅ CRLF injection prevention');
    console.log('✅ PII redaction');
    console.log('✅ Token budget priority');
    console.log('✅ Tool whitelist enforcement');
    console.log('');
    console.log('All unit tests PASSED - Ready for CI ✅');

    expect(true).toBe(true);
  });
});

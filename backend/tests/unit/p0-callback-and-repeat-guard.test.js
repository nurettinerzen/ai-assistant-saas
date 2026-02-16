import { describe, it, expect } from '@jest/globals';
import { makeRoutingDecision } from '../../src/core/orchestrator/steps/04_routerDecision.js';
import createCallbackHandler from '../../src/tools/handlers/create-callback.js';
import { shouldBlockRepeatedToolCall } from '../../src/core/orchestrator/steps/06_toolLoop.js';
import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';
import { ToolOutcome } from '../../src/tools/toolResult.js';
import crypto from 'crypto';

function hashArgs(args) {
  const sorted = Object.keys(args).sort().reduce((acc, key) => {
    const value = args[key];
    acc[key] = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return acc;
  }, {});
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').substring(0, 16);
}

describe('P0 Callback deterministic flow', () => {
  it('A1: callback intent should return direct callback-info prompt (no order verification language)', async () => {
    const state = {};

    const result = await makeRoutingDecision({
      classification: { type: 'NEW_INTENT', confidence: 0.9, triggerRule: null },
      state,
      userMessage: 'yetkili biriyle görüşmek istiyorum',
      conversationHistory: [],
      language: 'TR',
      business: { id: 1, language: 'TR' },
      sessionId: 'test-a1',
      channel: 'CHAT',
      channelMode: 'FULL',
      hasKBMatch: false
    });

    expect(result.directResponse).toBe(true);
    expect(result.reply.toLowerCase()).toContain('ad-soyad');
    expect(result.reply.toLowerCase()).toContain('telefon');
    expect(result.reply.toLowerCase()).not.toContain('sipariş');
    expect(result.reply.toLowerCase()).not.toContain('son 4');
    expect(state.callbackFlow?.pending).toBe(true);
  });

  it('A2: create_callback should reject missing/placeholder identity data deterministically', async () => {
    const business = { id: 1, language: 'TR' };

    const nameOnly = await createCallbackHandler.execute(
      { customerName: 'Ahmet Yılmaz' },
      business,
      {}
    );
    expect(nameOnly.outcome).toBe(ToolOutcome.VALIDATION_ERROR);
    expect(nameOnly.askFor).toContain('phone');

    const phoneOnly = await createCallbackHandler.execute(
      { customerPhone: '905551112233' },
      business,
      {}
    );
    expect(phoneOnly.outcome).toBe(ToolOutcome.VALIDATION_ERROR);
    expect(phoneOnly.askFor).toContain('customer_name');

    const placeholderName = await createCallbackHandler.execute(
      { customerName: 'customer', customerPhone: '905551112233' },
      business,
      {}
    );
    expect(placeholderName.outcome).toBe(ToolOutcome.VALIDATION_ERROR);
    expect(placeholderName.askFor).toContain('customer_name');
  });

  it('A2: callback pending flow should ask only the missing slot (name vs phone)', async () => {
    const stateNeedsPhone = {
      callbackFlow: { pending: true }
    };

    const phonePrompt = await makeRoutingDecision({
      classification: { type: 'NEW_INTENT', confidence: 0.9, triggerRule: null },
      state: stateNeedsPhone,
      userMessage: 'Ahmet Yılmaz',
      conversationHistory: [],
      language: 'TR',
      business: { id: 1, language: 'TR' },
      sessionId: 'test-a2-phone',
      channel: 'CHAT',
      channelMode: 'FULL',
      hasKBMatch: false
    });
    expect(phonePrompt.directResponse).toBe(true);
    expect(phonePrompt.reply.toLowerCase()).toContain('telefon');
    expect(phonePrompt.reply.toLowerCase()).not.toContain('sipariş');

    const stateNeedsName = {
      callbackFlow: { pending: true }
    };

    const namePrompt = await makeRoutingDecision({
      classification: { type: 'NEW_INTENT', confidence: 0.9, triggerRule: null },
      state: stateNeedsName,
      userMessage: '0555 111 22 33',
      conversationHistory: [],
      language: 'TR',
      business: { id: 1, language: 'TR' },
      sessionId: 'test-a2-name',
      channel: 'CHAT',
      channelMode: 'FULL',
      hasKBMatch: false
    });
    expect(namePrompt.directResponse).toBe(true);
    expect(namePrompt.reply.toLowerCase()).toContain('ad-soyad');
    expect(namePrompt.reply.toLowerCase()).not.toContain('son 4');
  });

  it('2.3: callback context should never produce VERIFICATION_REQUIRED from leak filter', () => {
    const leakResult = applyLeakFilter(
      'Takip numaranız TR123456789TR olarak görünüyor.',
      'none',
      'TR',
      {},
      { callbackPending: true, activeFlow: 'CALLBACK_REQUEST' }
    );

    expect(leakResult.safe).toBe(false);
    expect(leakResult.needsCallbackInfo).toBe(true);
    expect(leakResult.needsVerification).not.toBe(true);
    expect(leakResult.missingFields).toEqual(['customer_name', 'phone']);
  });
});

describe('P0 Loop breaker helper', () => {
  it('B2: same tool + same args after NEED_MORE_INFO should be blocked and ask only missing field', () => {
    const argsHash = hashArgs({ query_type: 'siparis', order_number: 'ORD-9837459' });

    const state = {
      extractedSlots: { order_number: 'ORD-9837459' },
      _previousExtractedSlots: { order_number: 'ORD-9837459' },
      lastToolAttempt: {
        tool: 'customer_data_lookup',
        argsHash,
        outcome: ToolOutcome.NEED_MORE_INFO,
        askFor: ['phone_last4'],
        count: 1,
        at: new Date().toISOString()
      }
    };

    const guard = shouldBlockRepeatedToolCall({
      state,
      toolName: 'customer_data_lookup',
      argsHash,
      language: 'TR'
    });

    expect(guard.blocked).toBe(true);
    expect(guard.outcome).toBe(ToolOutcome.NEED_MORE_INFO);
    expect(guard.message.toLowerCase()).toContain('son 4');
  });
});

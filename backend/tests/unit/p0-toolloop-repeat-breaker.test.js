import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import crypto from 'crypto';
import { ToolOutcome } from '../../src/tools/toolResult.js';

const executeToolWithRetryMock = jest.fn();

jest.unstable_mockModule('../../src/policies/toolFailPolicy.js', () => ({
  applyToolFailPolicy: jest.fn(() => null)
}));

jest.unstable_mockModule('../../src/services/tool-fail-handler.js', () => ({
  executeToolWithRetry: executeToolWithRetryMock
}));

jest.unstable_mockModule('../../src/tools/index.js', () => ({
  executeTool: jest.fn()
}));

jest.unstable_mockModule('../../src/tools/registry.js', () => ({
  default: {
    getRawDefinition: jest.fn(() => null)
  }
}));

jest.unstable_mockModule('../../src/services/tool-idempotency-db.js', () => ({
  getToolExecutionResult: jest.fn(async () => null),
  setToolExecutionResult: jest.fn(async () => undefined)
}));

jest.unstable_mockModule('../../src/services/session-lock.js', () => ({
  isSessionLocked: jest.fn(async () => ({ locked: false, reason: null })),
  getLockMessage: jest.fn(() => ''),
  checkEnumerationAttempt: jest.fn(async () => ({ shouldBlock: false, attempts: 0, counted: false }))
}));

jest.unstable_mockModule('../../src/security/autoverify.js', () => ({
  tryAutoverify: jest.fn(async () => ({ applied: false }))
}));

let executeToolLoop;

beforeAll(async () => {
  const module = await import('../../src/core/orchestrator/steps/06_toolLoop.js');
  executeToolLoop = module.executeToolLoop;
});

beforeEach(() => {
  jest.clearAllMocks();
});

function buildArgsHash(args) {
  const sorted = Object.keys(args).sort().reduce((acc, key) => {
    const value = args[key];
    acc[key] = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return acc;
  }, {});
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').substring(0, 16);
}

function buildLLMResponse(functionCalls = [], text = '') {
  return {
    response: {
      text: () => text,
      functionCalls: () => functionCalls,
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5
      },
      candidates: [{ finishReason: 'STOP' }]
    }
  };
}

describe('P0 toolLoop repeat breaker', () => {
  it('B2: repeated same customer_data_lookup args should block tool execution and keep toolsCalled trace', async () => {
    const toolArgs = { query_type: 'siparis', order_number: 'ORD-9837459' };
    const argsHash = buildArgsHash(toolArgs);

    const chat = {
      sendMessage: jest.fn(async () => buildLLMResponse([
        { name: 'customer_data_lookup', args: toolArgs }
      ]))
    };

    const result = await executeToolLoop({
      chat,
      userMessage: 'tekrar kontrol et',
      conversationHistory: [],
      gatedTools: ['customer_data_lookup'],
      hasTools: true,
      state: {
        extractedSlots: { order_number: 'ORD-9837459' },
        _previousExtractedSlots: { order_number: 'ORD-9837459' },
        verification: { status: 'none' },
        lastToolAttempt: {
          tool: 'customer_data_lookup',
          argsHash,
          outcome: ToolOutcome.NEED_MORE_INFO,
          askFor: ['phone_last4'],
          count: 1,
          at: new Date().toISOString()
        }
      },
      business: { id: 1, language: 'TR' },
      language: 'TR',
      channel: 'CHAT',
      channelUserId: 'user-1',
      sessionId: 'session-b2',
      messageId: 'msg-b2',
      metrics: {},
      effectsEnabled: true
    });

    expect(result._repeatNotFoundBlocked).toBe(true);
    expect(result._terminalState).toBe(ToolOutcome.NEED_MORE_INFO);
    expect(result.reply.toLowerCase()).toContain('son 4');
    expect(result.toolsCalled).toEqual(['customer_data_lookup']);
    expect(result.toolResults).toHaveLength(0);
    expect(executeToolWithRetryMock).not.toHaveBeenCalled();
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
  });
});

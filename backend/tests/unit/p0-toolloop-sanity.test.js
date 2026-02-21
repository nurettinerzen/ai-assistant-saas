import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';

const applyToolFailPolicyMock = jest.fn(() => null);
const executeToolWithRetryMock = jest.fn();
const getRawDefinitionMock = jest.fn(() => null);
const getToolExecutionResultMock = jest.fn(async () => null);
const setToolExecutionResultMock = jest.fn(async () => undefined);
const isSessionLockedMock = jest.fn(async () => ({ locked: false, reason: null }));
const checkEnumerationAttemptMock = jest.fn(async () => ({ shouldBlock: false, attempts: 0, counted: false }));
const tryAutoverifyMock = jest.fn(async () => ({ applied: false }));

jest.unstable_mockModule('../../src/policies/toolFailPolicy.js', () => ({
  applyToolFailPolicy: applyToolFailPolicyMock
}));

jest.unstable_mockModule('../../src/services/tool-fail-handler.js', () => ({
  executeToolWithRetry: executeToolWithRetryMock
}));

jest.unstable_mockModule('../../src/tools/index.js', () => ({
  executeTool: jest.fn()
}));

jest.unstable_mockModule('../../src/tools/registry.js', () => ({
  default: {
    getRawDefinition: getRawDefinitionMock
  }
}));

jest.unstable_mockModule('../../src/services/tool-idempotency-db.js', () => ({
  getToolExecutionResult: getToolExecutionResultMock,
  setToolExecutionResult: setToolExecutionResultMock
}));

jest.unstable_mockModule('../../src/services/session-lock.js', () => ({
  isSessionLocked: isSessionLockedMock,
  getLockMessage: jest.fn(() => ''),
  checkEnumerationAttempt: checkEnumerationAttemptMock
}));

jest.unstable_mockModule('../../src/security/autoverify.js', () => ({
  tryAutoverify: tryAutoverifyMock
}));

let executeToolLoop;

beforeAll(async () => {
  ({ executeToolLoop } = await import('../../src/core/orchestrator/steps/06_toolLoop.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  applyToolFailPolicyMock.mockReturnValue(null);
  getRawDefinitionMock.mockReturnValue(null);
  getToolExecutionResultMock.mockResolvedValue(null);
  setToolExecutionResultMock.mockResolvedValue(undefined);
  isSessionLockedMock.mockResolvedValue({ locked: false, reason: null });
  checkEnumerationAttemptMock.mockResolvedValue({ shouldBlock: false, attempts: 0, counted: false });
  tryAutoverifyMock.mockResolvedValue({ applied: false });
});

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

function buildParams(chat, overrides = {}) {
  return {
    chat,
    userMessage: 'test',
    conversationHistory: [],
    gatedTools: ['create_callback', 'check_ticket_status_crm', 'customer_data_lookup'],
    hasTools: true,
    state: {
      extractedSlots: {},
      verification: { status: 'none' }
    },
    business: { id: 1, language: 'TR' },
    language: 'TR',
    channel: 'CHAT',
    channelUserId: 'user-1',
    sessionId: 'session-tool-sanity',
    messageId: 'msg-tool-sanity',
    metrics: {},
    effectsEnabled: true,
    ...overrides
  };
}

describe('P0 toolLoop sanity checks', () => {
  it('1) callback request triggers create_callback function call and returns tool-backed response', async () => {
    executeToolWithRetryMock.mockResolvedValueOnce({
      success: true,
      outcome: ToolOutcome.OK,
      data: { callbackId: 'cb_001' },
      message: 'Callback created',
      stateEvents: []
    });

    const chat = {
      sendMessage: jest.fn()
        .mockResolvedValueOnce(buildLLMResponse([
          {
            name: 'create_callback',
            args: { customer_name: 'Ada Lovelace', phone: '05551234567' }
          }
        ]))
        .mockResolvedValueOnce(buildLLMResponse([], 'Geri arama kaydınızı oluşturdum.'))
    };

    const result = await executeToolLoop(buildParams(chat, {
      userMessage: 'Callback istiyorum, numaram 05551234567'
    }));

    expect(executeToolWithRetryMock).toHaveBeenCalledTimes(1);
    expect(executeToolWithRetryMock.mock.calls[0][1]).toBe('create_callback');
    expect(result.toolsCalled).toEqual(['create_callback']);
    expect(result.toolResults[0]?.name).toBe('create_callback');
    expect(result.reply).toContain('Geri arama kaydınızı oluşturdum');
    expect(result.hadToolFailure).toBe(false);
  });

  it('2) ticket status request triggers check_ticket_status_crm and returns tool-backed response', async () => {
    executeToolWithRetryMock.mockResolvedValueOnce({
      success: true,
      outcome: ToolOutcome.OK,
      data: { ticketNumber: 'TCK-1001', status: 'OPEN' },
      message: 'Ticket found',
      stateEvents: []
    });

    const chat = {
      sendMessage: jest.fn()
        .mockResolvedValueOnce(buildLLMResponse([
          {
            name: 'check_ticket_status_crm',
            args: { ticket_number: 'TCK-1001' }
          }
        ]))
        .mockResolvedValueOnce(buildLLMResponse([], 'Ticket durumunuz açık ve incelemede.'))
    };

    const result = await executeToolLoop(buildParams(chat, {
      userMessage: 'Ticket durumum ne?'
    }));

    expect(executeToolWithRetryMock).toHaveBeenCalledTimes(1);
    expect(executeToolWithRetryMock.mock.calls[0][1]).toBe('check_ticket_status_crm');
    expect(result.toolsCalled).toEqual(['check_ticket_status_crm']);
    expect(result.toolResults[0]?.name).toBe('check_ticket_status_crm');
    expect(result.reply.toLowerCase()).toContain('ticket');
  });

  it('3) tool 500 path returns deterministic safe error (no fabricated LLM answer)', async () => {
    executeToolWithRetryMock.mockResolvedValueOnce({
      success: false,
      error: 'HTTP_500',
      message: 'Upstream 500',
      outcome: ToolOutcome.INFRA_ERROR
    });
    applyToolFailPolicyMock.mockReturnValueOnce({
      reply: 'Şu an sistem cevap vermiyor. Lütfen birazdan tekrar deneyin.',
      metadata: { policy: 'TOOL_FAIL_TEMPLATE' }
    });

    const chat = {
      sendMessage: jest.fn()
        .mockResolvedValueOnce(buildLLMResponse([
          {
            name: 'customer_data_lookup',
            args: { query_type: 'order_status', order_number: 'ORD-1' }
          }
        ]))
    };

    const result = await executeToolLoop(buildParams(chat, {
      userMessage: 'Siparişimi kontrol eder misin?'
    }));

    expect(result.hadToolFailure).toBe(true);
    expect(result.failedTool).toBe('customer_data_lookup');
    expect(result.reply).toMatch(/sistem cevap vermiyor/i);
    expect(result.metadata?.policy).toBe('TOOL_FAIL_TEMPLATE');
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('4) informational query without tool call keeps toolsCalled empty', async () => {
    const chat = {
      sendMessage: jest.fn()
        .mockResolvedValueOnce(buildLLMResponse([], 'Telyx, işletmeler için yapay zeka destekli bir asistandır.'))
    };

    const result = await executeToolLoop(buildParams(chat, {
      userMessage: 'Telyx nedir?'
    }));

    expect(executeToolWithRetryMock).not.toHaveBeenCalled();
    expect(result.toolsCalled).toEqual([]);
    expect(result.toolResults).toEqual([]);
    expect(result.reply).toContain('Telyx');
  });
});

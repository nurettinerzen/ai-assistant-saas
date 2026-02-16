import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock = {
  callLog: {
    updateMany: jest.fn(),
    create: jest.fn()
  },
  callbackRequest: {
    create: jest.fn()
  },
  doNotCall: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  }
};

jest.unstable_mockModule('../../src/prismaClient.js', () => ({
  default: prismaMock
}));

let runFlowStep;
let applyOutboundV1Actions;

beforeAll(async () => {
  ({ runFlowStep } = await import('../../src/phone-outbound-v1/flowRunner.js'));
  ({ applyOutboundV1Actions } = await import('../../src/phone-outbound-v1/outcomeWriter.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.callLog.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.callLog.create.mockResolvedValue({ id: 1 });
  prismaMock.callbackRequest.create.mockResolvedValue({ id: 'cb_1' });
  prismaMock.doNotCall.findUnique.mockResolvedValue(null);
  prismaMock.doNotCall.upsert.mockResolvedValue({ id: 'dnc_1' });
});

async function runWebhookTurn({ flowState, userUtterance, callType = 'BILLING_REMINDER' }) {
  const business = { id: 99, name: 'Webhook Test', language: 'TR' };
  const callSession = {
    callId: 'conv_webhook_1',
    sessionId: 'conv_webhook_1',
    phoneE164: '+905550001122',
    customerName: 'Müşteri',
    callType
  };

  const flowResult = await runFlowStep({
    business,
    callSession,
    userUtterance,
    flowState,
    classifierMode: 'KEYWORD_ONLY'
  });

  await applyOutboundV1Actions(flowResult.actions, {
    businessId: business.id,
    assistantId: 'assistant_1',
    callId: callSession.callId,
    sessionId: callSession.sessionId,
    customerName: callSession.customerName,
    phoneE164: callSession.phoneE164
  });

  return flowResult;
}

describe('PHONE outbound V1 webhook integration (mock)', () => {
  it('outbound start -> opening', async () => {
    const first = await runWebhookTurn({ flowState: null, userUtterance: '' });

    expect(first.isTerminal).toBe(false);
    expect(first.nextScriptText.toLowerCase()).toContain('merhaba');
    expect(first.nextState.started).toBe(true);
  });

  it('user evet -> YES closing + outcome write', async () => {
    const opened = await runWebhookTurn({ flowState: null, userUtterance: '' });
    const yesTurn = await runWebhookTurn({
      flowState: opened.nextState,
      userUtterance: 'evet'
    });

    expect(yesTurn.label).toBe('YES');
    expect(yesTurn.isTerminal).toBe(true);
    expect(prismaMock.callLog.updateMany).toHaveBeenCalled();
  });

  it('user beni aramayın -> DONT_CALL persist + close', async () => {
    const opened = await runWebhookTurn({ flowState: null, userUtterance: '' });
    const dncTurn = await runWebhookTurn({
      flowState: opened.nextState,
      userUtterance: 'beni aramayın'
    });

    expect(dncTurn.label).toBe('DONT_CALL');
    expect(dncTurn.isTerminal).toBe(true);
    expect(prismaMock.doNotCall.upsert).toHaveBeenCalled();
  });

  it('off-topic siparişim nerede -> offTopicRedirect + no claim/action', async () => {
    const opened = await runWebhookTurn({ flowState: null, userUtterance: '' });
    const offTopicTurn = await runWebhookTurn({
      flowState: opened.nextState,
      userUtterance: 'siparişim nerede'
    });

    expect(offTopicTurn.label).toBe('UNKNOWN');
    expect(offTopicTurn.isTerminal).toBe(false);
    expect(offTopicTurn.nextScriptText.toLowerCase()).toContain('yalnızca');
    expect(offTopicTurn.actions).toHaveLength(0);
  });
});

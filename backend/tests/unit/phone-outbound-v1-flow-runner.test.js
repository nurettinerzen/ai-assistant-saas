import { describe, expect, it } from '@jest/globals';
import { runFlowStep } from '../../src/phone-outbound-v1/flowRunner.js';

const business = { id: 42, name: 'Test Business', language: 'TR' };
const callSession = {
  callId: 'conv_flow_1',
  sessionId: 'conv_flow_1',
  phoneE164: '+905551112233',
  customerName: 'Ali',
  callType: 'BILLING_REMINDER'
};

async function startFlow() {
  return runFlowStep({
    business,
    callSession,
    userUtterance: '',
    flowState: null,
    classifierMode: 'KEYWORD_ONLY'
  });
}

describe('PHONE outbound V1 flow runner', () => {
  it('handles YES/NO/LATER/ASK_AGENT/DONT_CALL transitions with terminal close', async () => {
    const labels = [
      { utterance: 'evet', expected: 'YES', action: 'log_call_outcome' },
      { utterance: 'hayır', expected: 'NO', action: 'log_call_outcome' },
      { utterance: 'sonra ara', expected: 'LATER', action: 'schedule_followup' },
      { utterance: 'temsilci istiyorum', expected: 'ASK_AGENT', action: 'create_callback' },
      { utterance: 'beni aramayın', expected: 'DONT_CALL', action: 'set_do_not_call' }
    ];

    for (const testCase of labels) {
      const opened = await startFlow();
      const result = await runFlowStep({
        business,
        callSession,
        userUtterance: testCase.utterance,
        flowState: opened.nextState,
        classifierMode: 'KEYWORD_ONLY'
      });

      expect(result.label).toBe(testCase.expected);
      expect(result.isTerminal).toBe(true);
      expect(result.nextState.closed).toBe(true);
      expect(result.actions.some(a => a.name === 'log_call_outcome')).toBe(true);
      expect(result.actions.some(a => a.name === testCase.action)).toBe(true);
    }
  });

  it('retries UNKNOWN twice then closes on third UNKNOWN', async () => {
    const opened = await startFlow();

    const retry1 = await runFlowStep({
      business,
      callSession,
      userUtterance: 'mmm',
      flowState: opened.nextState,
      classifierMode: 'KEYWORD_ONLY'
    });

    const retry2 = await runFlowStep({
      business,
      callSession,
      userUtterance: 'anlamadım',
      flowState: retry1.nextState,
      classifierMode: 'KEYWORD_ONLY'
    });

    const close = await runFlowStep({
      business,
      callSession,
      userUtterance: 'hala net değil',
      flowState: retry2.nextState,
      classifierMode: 'KEYWORD_ONLY'
    });

    expect(retry1.label).toBe('UNKNOWN');
    expect(retry1.isTerminal).toBe(false);
    expect(retry1.nextState.retryCount).toBe(1);

    expect(retry2.label).toBe('UNKNOWN');
    expect(retry2.isTerminal).toBe(false);
    expect(retry2.nextState.retryCount).toBe(2);

    expect(close.label).toBe('UNKNOWN');
    expect(close.isTerminal).toBe(true);
    expect(close.nextState.closed).toBe(true);
    expect(close.actions.some(a => a.name === 'log_call_outcome')).toBe(true);
  });
});

import { describe, expect, it } from '@jest/globals';
import { classifyLabel } from '../../src/phone-outbound-v1/labelClassifier.js';

describe('PHONE outbound V1 label classifier', () => {
  it('classifies Turkish keywords', async () => {
    await expect(classifyLabel({ utterance: 'evet uygunum' })).resolves.toBe('YES');
    await expect(classifyLabel({ utterance: 'hayır istemiyorum' })).resolves.toBe('NO');
    await expect(classifyLabel({ utterance: 'beni aramayın' })).resolves.toBe('DONT_CALL');
    await expect(classifyLabel({ utterance: 'bir temsilciye bağla' })).resolves.toBe('ASK_AGENT');
    await expect(classifyLabel({ utterance: 'daha sonra ara' })).resolves.toBe('LATER');
  });

  it('classifies English keywords', async () => {
    await expect(classifyLabel({ utterance: 'yes please' })).resolves.toBe('YES');
    await expect(classifyLabel({ utterance: 'no thanks' })).resolves.toBe('NO');
    await expect(classifyLabel({ utterance: 'do not call me again' })).resolves.toBe('DONT_CALL');
    await expect(classifyLabel({ utterance: 'connect me to an agent' })).resolves.toBe('ASK_AGENT');
    await expect(classifyLabel({ utterance: 'call me later' })).resolves.toBe('LATER');
  });

  it('supports DTMF map first', async () => {
    const label = await classifyLabel({
      utterance: 'something else',
      dtmfDigits: '9',
      dtmfMap: { '9': 'DONT_CALL' }
    });

    expect(label).toBe('DONT_CALL');
  });
});

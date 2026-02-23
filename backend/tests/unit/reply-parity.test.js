import { describe, expect, it } from '@jest/globals';
import { updateAssistantReplyInMessages } from '../../src/services/reply-parity.js';

describe('reply parity helper', () => {
  it('updates the assistant message that matches persisted reply content', () => {
    const messages = [
      { role: 'user', content: 'Merhaba' },
      { role: 'assistant', content: 'Eski cevap' },
      { role: 'user', content: 'Durum?' },
      { role: 'assistant', content: 'Persisted reply' }
    ];

    const result = updateAssistantReplyInMessages({
      messages,
      persistedReply: 'Persisted reply',
      finalReply: 'PII uyarisi\n\nPersisted reply'
    });

    expect(result.updated).toBe(true);
    expect(result.targetIndex).toBe(3);
    expect(result.messages[3].content).toBe('PII uyarisi\n\nPersisted reply');
    expect(messages[3].content).toBe('Persisted reply');
  });

  it('falls back to latest assistant message when persisted reply cannot be matched', () => {
    const messages = [
      { role: 'assistant', content: 'Ilk cevap' },
      { role: 'assistant', content: 'Son cevap' }
    ];

    const result = updateAssistantReplyInMessages({
      messages,
      persistedReply: 'Bulunamayan cevap',
      finalReply: 'Temizlenmis son cevap'
    });

    expect(result.updated).toBe(true);
    expect(result.targetIndex).toBe(1);
    expect(result.messages[1].content).toBe('Temizlenmis son cevap');
  });

  it('returns no-op when replies are already synchronized', () => {
    const messages = [
      { role: 'assistant', content: 'Ayni cevap' }
    ];

    const result = updateAssistantReplyInMessages({
      messages,
      persistedReply: 'Ayni cevap',
      finalReply: 'Ayni cevap'
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('ALREADY_IN_SYNC');
  });
});

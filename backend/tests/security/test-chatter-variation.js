import assert from 'assert';
import { buildChatterResponse } from '../../src/services/chatter-response.js';

function run() {
  const sessionId = 'proof-session-1';
  const state = { flowStatus: 'idle' };

  const turns = ['selam', 'merhaba', 'selamlar'];
  const replies = [];

  for (const message of turns) {
    const variant = buildChatterResponse({
      userMessage: message,
      state,
      language: 'TR',
      sessionId
    });

    replies.push(variant.text);
    state.chatter = {
      lastMessageKey: variant.messageKey,
      lastVariantIndex: variant.variantIndex,
      recent: [
        ...(Array.isArray(state?.chatter?.recent) ? state.chatter.recent : []),
        { messageKey: variant.messageKey, variantIndex: variant.variantIndex }
      ].slice(-2)
    };
  }

  assert(replies[0] !== replies[1], 'First and second greeting should not be identical');
  assert(replies[1] !== replies[2], 'Second and third greeting should not be identical');
  assert(replies[0] !== replies[2], 'First and third greeting should not be identical in short window');

  console.log('✅ Chatter variation proof');
  console.log('Turn1:', replies[0]);
  console.log('Turn2:', replies[1]);
  console.log('Turn3:', replies[2]);
}

run();

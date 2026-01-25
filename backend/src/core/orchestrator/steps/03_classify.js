/**
 * Step 3: Classify Message
 *
 * - LLM classifier with fail-closed policy
 * - Timeout (3s) → safe mode
 * - Error → safe mode
 */

import { applyClassifierPolicy } from '../../../policies/classifierPolicy.js';

export async function classifyMessage(params) {
  const { state, conversationHistory, userMessage, language } = params;

  // Get last assistant message
  const lastAssistantMessage = conversationHistory
    .slice().reverse()
    .find(msg => msg.role === 'assistant')?.content || '';

  // Apply classifier policy (handles timeout, fail-closed)
  const classification = await applyClassifierPolicy({
    state,
    lastAssistantMessage,
    userMessage,
    language,
    metrics: {} // Will be populated
  });

  console.log('📨 [Classify]:', {
    type: classification.type,
    confidence: classification.confidence,
    hadFailure: classification.hadClassifierFailure || false
  });

  return classification;
}

export default { classifyMessage };

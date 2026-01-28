/**
 * Step 3: Classify Message
 *
 * - LLM classifier with fail-closed policy
 * - Timeout (3s) → safe mode
 * - Error → safe mode
 */

import { applyClassifierPolicy } from '../../../policies/classifierPolicy.js';
import { normalizeIntent } from '../../../policies/intentNormalizer.js';

export async function classifyMessage(params) {
  const { state, conversationHistory, userMessage, language, channel } = params;

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
    channel: channel || state.channel,
    metrics: {} // Will be populated
  });

  // INTENT NORMALIZATION: Convert generic NEW_INTENT to specific types
  const normalizedClassification = normalizeIntent(classification, userMessage);

  console.log('📨 [Classify]:', {
    type: normalizedClassification.type,
    confidence: normalizedClassification.confidence,
    hadFailure: normalizedClassification.hadClassifierFailure || false,
    normalized: normalizedClassification.normalizedBy || false
  });

  return normalizedClassification;
}

export default { classifyMessage };

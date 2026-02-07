/**
 * Fallback & Hallucination Detection
 * Prefers outcome-contract assertions, keeps text fallback for backward compatibility.
 */

import {
  HALLUCINATION_INDICATORS,
  NOT_FOUND_RESPONSE_PATTERNS
} from '../../src/security/patterns/index.js';
import { ToolOutcome, normalizeOutcome } from '../../src/tools/toolResult.js';

function resolveOutcome(response = {}) {
  return normalizeOutcome(
    response.outcome ||
    response.metadata?.outcome ||
    response.rawResponse?.outcome ||
    response.rawResponse?.metadata?.outcome ||
    null
  );
}

function toResponsePayload(responseOrReply) {
  if (responseOrReply && typeof responseOrReply === 'object') {
    return responseOrReply;
  }

  return {
    reply: String(responseOrReply || '')
  };
}

export function assertFallback(responseOrReply, language = 'tr') {
  const response = toResponsePayload(responseOrReply);
  const outcome = resolveOutcome(response);

  const contractFallbackOutcomes = [
    ToolOutcome.NOT_FOUND,
    ToolOutcome.VALIDATION_ERROR,
    ToolOutcome.VERIFICATION_REQUIRED,
    ToolOutcome.DENIED
  ];

  if (outcome && contractFallbackOutcomes.includes(outcome)) {
    return { passed: true };
  }

  const reply = String(response.reply || '');
  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = NOT_FOUND_RESPONSE_PATTERNS[lang] || NOT_FOUND_RESPONSE_PATTERNS.TR;
  const hasFallback = patterns.some(pattern => pattern.test(reply));

  if (!hasFallback) {
    return {
      passed: false,
      reason: 'Expected fallback outcome (contract) or explicit not-found style response'
    };
  }

  return { passed: true };
}

export function assertNoHallucination(reply, category) {
  const indicators = HALLUCINATION_INDICATORS[category] || [];
  const detected = indicators.filter(pattern => pattern.test(reply || ''));

  if (detected.length > 0) {
    return {
      passed: false,
      reason: `Hallucinated ${category}: ${detected.map(p => p.source).join(', ')}`
    };
  }

  return { passed: true };
}

export default {
  assertFallback,
  assertNoHallucination
};

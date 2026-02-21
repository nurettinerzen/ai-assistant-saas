import { getEntityHint, getEntityMatchType, getEntityClarificationHint } from './entityTopicResolver.js';

function safeString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function buildResolverPayload({
  channel = 'UNKNOWN',
  entityResolution = null,
  kbConfidence = 'UNKNOWN'
} = {}) {
  return {
    channel: safeString(channel) || 'UNKNOWN',
    matchType: getEntityMatchType(entityResolution),
    entityHint: safeString(getEntityHint(entityResolution)),
    needsClarification: !!entityResolution?.needsClarification,
    clarificationQuestionHint: safeString(getEntityClarificationHint(entityResolution)),
    kbConfidence: safeString(kbConfidence) || 'UNKNOWN'
  };
}

export function logEntityResolver({
  channel = 'UNKNOWN',
  entityResolution = null,
  kbConfidence = 'UNKNOWN'
} = {}) {
  const payload = buildResolverPayload({ channel, entityResolution, kbConfidence });
  console.log(`ENTITY_RESOLVER ${JSON.stringify(payload)}`);
  return payload;
}

export function logShortCircuit({
  reason = 'clarification',
  channel = 'UNKNOWN',
  entityResolution = null,
  kbConfidence = 'UNKNOWN'
} = {}) {
  const normalizedReason = String(reason || 'clarification').toLowerCase();
  const payload = buildResolverPayload({ channel, entityResolution, kbConfidence });
  console.log(`SHORT_CIRCUIT: ${normalizedReason} ${JSON.stringify(payload)}`);
  return payload;
}

export default {
  logEntityResolver,
  logShortCircuit
};

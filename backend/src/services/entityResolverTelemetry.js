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
    matchType: entityResolution?.entityMatchType || 'NONE',
    bestGuess: safeString(entityResolution?.bestGuess),
    needsClarification: !!entityResolution?.needsClarification,
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

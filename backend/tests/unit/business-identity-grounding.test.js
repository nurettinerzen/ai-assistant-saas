import { describe, expect, it } from '@jest/globals';
import { buildBusinessIdentity } from '../../src/services/businessIdentity.js';
import {
  resolveMentionedEntity,
  ENTITY_MATCH_TYPES,
  ENTITY_CLARIFICATION_HINTS
} from '../../src/services/entityTopicResolver.js';
import { determineResponseGrounding, RESPONSE_GROUNDING } from '../../src/services/responseGrounding.js';
import { overrideFeatureFlag } from '../../src/config/feature-flags.js';

const BUSINESS_IDENTITY = {
  businessName: 'Telyx',
  businessAliases: [],
  productNames: [],
  keyEntities: [],
  allowedDomains: ['AI calling assistant', 'CRM workflows']
};

describe('Business identity grounding acceptance', () => {
  it('IDENTITY_SOURCE: uses tenant aliases and identity summary from business data', async () => {
    const identity = await buildBusinessIdentity({
      business: {
        id: 999999,
        name: 'Telyx',
        aliases: ['Telix', 'TELYKS'],
        identitySummary: 'Telyx işletmeler için outbound calling assistant platformudur.'
      },
      providedKnowledgeItems: []
    });

    expect(identity.businessName).toBe('Telyx');
    expect(identity.businessAliases).toContain('Telix');
    expect(identity.businessAliases).toContain('TELYKS');
    expect(identity.identitySummary).toContain('outbound calling assistant');
  });

  it('FUZZY_MATCH: "telix nedir" should return structured clarification hint with entityHint=Telyx', () => {
    const result = resolveMentionedEntity('telix nedir', BUSINESS_IDENTITY, { language: 'TR' });

    expect(result.matchType).toBe(ENTITY_MATCH_TYPES.FUZZY_MATCH);
    expect(result.entityHint).toBe('Telyx');
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationQuestionHint).toBe(ENTITY_CLARIFICATION_HINTS.CONFIRM_ENTITY);
  });

  it('OUT_OF_SCOPE: "Netflix nedir" should return scope clarification hint', () => {
    const result = resolveMentionedEntity('Netflix nedir', BUSINESS_IDENTITY, { language: 'TR' });

    expect(result.matchType).toBe(ENTITY_MATCH_TYPES.OUT_OF_SCOPE);
    expect(result.needsClarification).toBe(true);
    expect(result.entityHint.toLowerCase()).toBe('netflix');
    expect(result.clarificationQuestionHint).toBe(ENTITY_CLARIFICATION_HINTS.LIMIT_TO_BUSINESS_SCOPE);
  });

  it('KB_EMPTY/LOW: ungrounded claim attempt should be converted to clarification', () => {
    const result = determineResponseGrounding({
      finalResponse: 'Telyx 4K yayın sunuyor.',
      kbConfidence: 'LOW',
      hadToolSuccess: false,
      entityResolution: { matchType: ENTITY_MATCH_TYPES.NONE, entityHint: 'Telyx' },
      language: 'TR',
      businessIdentity: BUSINESS_IDENTITY
    });

    expect(result.responseGrounding).toBe(RESPONSE_GROUNDING.UNGROUNDED);
    expect(result.ungroundedDetected).toBe(true);
    expect(result.finalResponse.toLowerCase()).toContain('doğrulanmış bilgi yok');
    expect(result.finalResponse).toContain('?');
  });

  it('KB_GROUNDED: grounded KB-backed sentence should stay GROUNDED', () => {
    const result = determineResponseGrounding({
      finalResponse: 'Telyx outbound calling assistant hizmeti sunar.',
      kbConfidence: 'HIGH',
      hadToolSuccess: false,
      entityResolution: { matchType: ENTITY_MATCH_TYPES.EXACT_MATCH, entityHint: 'Telyx' },
      language: 'TR',
      businessIdentity: BUSINESS_IDENTITY
    });

    expect(result.responseGrounding).toBe(RESPONSE_GROUNDING.GROUNDED);
    expect(result.ungroundedDetected).toBe(false);
    expect(result.finalResponse).toContain('outbound calling assistant');
  });

  it('STRICT_RULE: business claim with missing KB match should be blocked even when kbConfidence is MEDIUM', () => {
    overrideFeatureFlag('TEXT_STRICT_GROUNDING', true);

    const result = determineResponseGrounding({
      userMessage: 'Telyx hangi sektorde ve ne hizmet sunuyor?',
      finalResponse: 'Telyx telekom sektorunde 4K hizmet sunar.',
      kbConfidence: 'MEDIUM',
      hasKBMatch: false,
      hadToolSuccess: false,
      entityResolution: { matchType: ENTITY_MATCH_TYPES.EXACT_MATCH, entityHint: 'Telyx' },
      language: 'TR',
      businessIdentity: BUSINESS_IDENTITY
    });

    expect(result.responseGrounding).toBe(RESPONSE_GROUNDING.UNGROUNDED);
    expect(result.ungroundedDetected).toBe(true);
    expect(result.policyReason).toBe('BUSINESS_CLAIM_LOW_KB_BLOCK');
  });

  it('ROLLBACK_FLAG: disabling strict grounding should restore previous MEDIUM behavior', () => {
    overrideFeatureFlag('TEXT_STRICT_GROUNDING', false);

    const result = determineResponseGrounding({
      userMessage: 'Telyx hangi sektorde ve ne hizmet sunuyor?',
      finalResponse: 'Telyx telekom sektorunde 4K hizmet sunar.',
      kbConfidence: 'MEDIUM',
      hasKBMatch: false,
      hadToolSuccess: false,
      entityResolution: { matchType: ENTITY_MATCH_TYPES.EXACT_MATCH, entityHint: 'Telyx' },
      language: 'TR',
      businessIdentity: BUSINESS_IDENTITY
    });

    expect(result.responseGrounding).toBe(RESPONSE_GROUNDING.GROUNDED);
    expect(result.ungroundedDetected).toBe(false);

    // Reset for subsequent tests/process state
    overrideFeatureFlag('TEXT_STRICT_GROUNDING', true);
  });
});

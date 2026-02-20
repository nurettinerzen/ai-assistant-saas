import { describe, expect, it } from '@jest/globals';
import { buildPhoneEntitlements } from '../../src/services/phonePlanEntitlements.js';
import {
  PHONE_OUTBOUND_ENTRYPOINTS,
  evaluateOutboundEntrypoints,
  resolvePhoneOutboundAccessFromSubscription
} from '../../src/services/phoneOutboundAccess.js';

const PLANS = ['FREE', 'TRIAL', 'PAYG', 'STARTER', 'BASIC', 'PRO', 'ENT'];

describe('PHONE outbound entitlement alignment', () => {
  for (const inboundDirectionAllowed of [false, true]) {
    it(`keeps outbound aligned to plan matrix when inboundDirectionAllowed=${inboundDirectionAllowed}`, () => {
      for (const plan of PLANS) {
        const entitlements = buildPhoneEntitlements({
          plan,
          inboundDirectionAllowed,
          outboundDirectionAllowed: true
        });

        expect(entitlements.inboundEnabledEffective)
          .toBe(entitlements.planPhoneEnabled && inboundDirectionAllowed);
        expect(entitlements.outboundEnabledEffective).toBe(entitlements.planPhoneEnabled);
        expect(entitlements.phoneOutboundEnabled).toBe(entitlements.planPhoneEnabled);
        expect(entitlements.outbound.enabled).toBe(entitlements.planPhoneEnabled);
        expect(entitlements.outbound.testCall.enabled).toBe(entitlements.planPhoneEnabled);
        expect(entitlements.outbound.campaigns.enabled).toBe(entitlements.planPhoneEnabled);
      }
    });
  }
});

describe('PHONE outbound entrypoint gate consistency', () => {
  it('produces identical decisions for assistants/test-call, batch-calls parse/create, and phone-number test-call', () => {
    for (const inboundEnabledOverride of [false, true]) {
      for (const plan of PLANS) {
        const access = resolvePhoneOutboundAccessFromSubscription(
          {
            plan,
            status: 'ACTIVE',
            business: { phoneInboundEnabled: inboundEnabledOverride }
          },
          { inboundEnabledOverride }
        );

        expect(access.hasAccess).toBe(access.entitlements.planPhoneEnabled);

        const decisions = evaluateOutboundEntrypoints(access);
        const expectedEntrypoints = Object.values(PHONE_OUTBOUND_ENTRYPOINTS);
        const decisionByEntrypoint = new Map(decisions.map((item) => [item.entrypoint, item]));

        for (const entrypoint of expectedEntrypoints) {
          const decision = decisionByEntrypoint.get(entrypoint);
          expect(decision).toBeDefined();
          expect(decision.allowed).toBe(access.hasAccess);
          expect(decision.reasonCode).toBe(access.reasonCode);
          expect(decision.requiredPlan).toBe(access.requiredPlan);
        }
      }
    }
  });

  it('returns inactive and missing-subscription reasons consistently', () => {
    const inactiveAccess = resolvePhoneOutboundAccessFromSubscription(
      {
        plan: 'PRO',
        status: 'CANCELLED',
        business: { phoneInboundEnabled: true }
      },
      { inboundEnabledOverride: true }
    );
    expect(inactiveAccess.hasAccess).toBe(false);
    expect(inactiveAccess.reasonCode).toBe('SUBSCRIPTION_INACTIVE');

    const noSubscriptionAccess = resolvePhoneOutboundAccessFromSubscription(null, {
      inboundEnabledOverride: true
    });
    expect(noSubscriptionAccess.hasAccess).toBe(false);
    expect(noSubscriptionAccess.reasonCode).toBe('NO_SUBSCRIPTION');
  });
});

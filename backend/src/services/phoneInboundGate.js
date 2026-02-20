import prisma from '../prismaClient.js';

export const ONBOARDING_MODES = Object.freeze({
  V1_OUTBOUND_ONLY: 'V1_OUTBOUND_ONLY',
  FULL_V2: 'FULL_V2'
});

/**
 * V1 default: inbound is globally disabled unless explicitly turned off.
 * Roll-forward to V2 by setting PHONE_V1_OUTBOUND_ONLY=false.
 */
const PHONE_V1_OUTBOUND_ONLY = process.env.PHONE_V1_OUTBOUND_ONLY !== 'false';

function getEffectiveInboundFlag(rawBusinessFlag) {
  if (PHONE_V1_OUTBOUND_ONLY) return false;
  return Boolean(rawBusinessFlag);
}

export function isPhoneInboundForceDisabled() {
  return PHONE_V1_OUTBOUND_ONLY;
}

/**
 * Derive onboarding mode from business-level inbound toggle.
 */
export function getOnboardingModeForBusiness(business) {
  return getEffectiveInboundFlag(business?.phoneInboundEnabled)
    ? ONBOARDING_MODES.FULL_V2
    : ONBOARDING_MODES.V1_OUTBOUND_ONLY;
}

/**
 * Fast path when business record is already loaded.
 */
export function isPhoneInboundEnabledForBusinessRecord(business) {
  return getEffectiveInboundFlag(business?.phoneInboundEnabled);
}

/**
 * Fallback path when only businessId is known.
 * Fail-closed: unknown business => inbound disabled.
 */
export async function isPhoneInboundEnabledForBusinessId(businessId) {
  if (!businessId) return false;

  const business = await prisma.business.findUnique({
    where: { id: parseInt(businessId, 10) },
    select: { phoneInboundEnabled: true }
  });

  return getEffectiveInboundFlag(business?.phoneInboundEnabled);
}

/**
 * Unified helper for mixed contexts (record vs id).
 */
export async function isPhoneInboundEnabledForBusiness({ business, businessId }) {
  if (business && typeof business.phoneInboundEnabled === 'boolean') {
    return getEffectiveInboundFlag(business.phoneInboundEnabled);
  }

  return isPhoneInboundEnabledForBusinessId(businessId);
}

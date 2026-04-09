import prisma from '../prismaClient.js';
import { isPhoneInboundEnabledForBusiness as isPhoneInboundCanaryEnabled } from '../config/feature-flags.js';

export const ONBOARDING_MODES = Object.freeze({
  V1_OUTBOUND_ONLY: 'V1_OUTBOUND_ONLY',
  FULL_V2: 'FULL_V2'
});

function getBusinessContextBusinessId(business) {
  if (!business) return null;
  return business.id ?? business.businessId ?? null;
}

function getEffectiveInboundFlag(rawBusinessFlag, businessId = null) {
  if (!isPhoneInboundCanaryEnabled({ businessId })) return false;
  return Boolean(rawBusinessFlag);
}

export function isPhoneInboundForceDisabled(context = {}) {
  return !isPhoneInboundCanaryEnabled(context);
}

/**
 * Derive onboarding mode from business-level inbound toggle.
 */
export function getOnboardingModeForBusiness(business) {
  return getEffectiveInboundFlag(business?.phoneInboundEnabled, getBusinessContextBusinessId(business))
    ? ONBOARDING_MODES.FULL_V2
    : ONBOARDING_MODES.V1_OUTBOUND_ONLY;
}

/**
 * Fast path when business record is already loaded.
 */
export function isPhoneInboundEnabledForBusinessRecord(business) {
  return getEffectiveInboundFlag(business?.phoneInboundEnabled, getBusinessContextBusinessId(business));
}

/**
 * Fallback path when only businessId is known.
 * Fail-closed: unknown business => inbound disabled.
 */
export async function isPhoneInboundEnabledForBusinessId(businessId) {
  if (!businessId) return false;

  const business = await prisma.business.findUnique({
    where: { id: parseInt(businessId, 10) },
    select: { id: true, phoneInboundEnabled: true }
  });

  return getEffectiveInboundFlag(business?.phoneInboundEnabled, business?.id || businessId);
}

/**
 * Unified helper for mixed contexts (record vs id).
 */
export async function isPhoneInboundEnabledForBusiness({ business, businessId }) {
  if (business && typeof business.phoneInboundEnabled === 'boolean') {
    return getEffectiveInboundFlag(business.phoneInboundEnabled, getBusinessContextBusinessId(business) || businessId);
  }

  return isPhoneInboundEnabledForBusinessId(businessId);
}

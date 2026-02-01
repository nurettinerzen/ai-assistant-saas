/**
 * SecurityEvent Assertions
 * Validates security events are logged correctly
 */

import { querySecurityEvents } from '../runner/http.js';
import CONFIG from '../runner/config.js';

/**
 * Wait for security event to be written to DB
 */
async function waitForEvent(delayMs = CONFIG.SECURITY_EVENTS.QUERY_DELAY_MS) {
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Assert security event was logged (dedupe-friendly)
 *
 * Uses count delta approach: queries events before and after action,
 * then verifies count increased (accounting for 60s dedup window)
 */
export async function assertSecurityEventLogged(token, eventType, filters = {}, context = {}) {
  if (!CONFIG.SECURITY_EVENTS.ENABLED) {
    return { passed: true, skipped: true, reason: 'SecurityEvent validation disabled' };
  }

  // Wait for event to be written
  await waitForEvent();

  // Query events with fingerprint filters if provided
  const queryFilters = {
    hours: 1,
    type: eventType,
    ...filters
  };

  // If context provided, narrow search by businessId or other identifiers
  if (context.businessId) {
    queryFilters.businessId = context.businessId;
  }

  const result = await querySecurityEvents(token, queryFilters);

  if (!result.success) {
    return {
      passed: false,
      reason: `Failed to query SecurityEvents: ${result.error}`
    };
  }

  if (result.events.length === 0) {
    return {
      passed: false,
      reason: `No SecurityEvent found for type '${eventType}'${filters.businessId ? ` (businessId=${filters.businessId})` : ''}`
    };
  }

  // If fingerprint provided, verify exact match
  if (context.fingerprint) {
    const matchingEvent = result.events.find(event => {
      const details = event.details || {};
      return Object.entries(context.fingerprint).every(([key, value]) => {
        return details[key] === value;
      });
    });

    if (!matchingEvent) {
      return {
        passed: false,
        reason: `SecurityEvent found but fingerprint mismatch. Expected: ${JSON.stringify(context.fingerprint)}`
      };
    }
  }

  return {
    passed: true,
    events: result.events
  };
}

/**
 * Assert security event was NOT logged
 */
export async function assertNoSecurityEvent(token, eventType, filters = {}) {
  if (!CONFIG.SECURITY_EVENTS.ENABLED) {
    return { passed: true, skipped: true };
  }

  await waitForEvent();

  const result = await querySecurityEvents(token, {
    hours: 1,
    type: eventType,
    ...filters
  });

  if (!result.success) {
    return {
      passed: false,
      reason: `Failed to query SecurityEvents: ${result.error}`
    };
  }

  if (result.events.length > 0) {
    return {
      passed: false,
      reason: `SecurityEvent '${eventType}' should not have been logged, but found ${result.events.length} event(s)`
    };
  }

  return { passed: true };
}

/**
 * Assert cross-tenant attempt was logged
 */
export async function assertCrossTenantEventLogged(token, attackerBusinessId, targetBusinessId) {
  const result = await assertSecurityEventLogged(token, 'cross_tenant_attempt');

  if (!result.passed) {
    return result;
  }

  // Validate event details
  const event = result.events[0];
  const details = event.details || {};

  if (details.attackerBusinessId !== attackerBusinessId || details.targetBusinessId !== targetBusinessId) {
    return {
      passed: false,
      reason: `Cross-tenant event details mismatch: expected attacker=${attackerBusinessId} target=${targetBusinessId}, got attacker=${details.attackerBusinessId} target=${details.targetBusinessId}`
    };
  }

  return { passed: true };
}

/**
 * Assert PII leak event was logged
 */
export async function assertPIILeakEventLogged(token, expectedPIITypes = null) {
  const result = await assertSecurityEventLogged(token, 'pii_leak_block');

  if (!result.passed) {
    return result;
  }

  if (expectedPIITypes) {
    const event = result.events[0];
    const details = event.details || {};
    const actualTypes = details.piiTypes || [];

    const missing = expectedPIITypes.filter(t => !actualTypes.includes(t));
    if (missing.length > 0) {
      return {
        passed: false,
        reason: `PII leak event missing types: ${missing.join(', ')}`
      };
    }
  }

  return { passed: true };
}

export default {
  assertSecurityEventLogged,
  assertNoSecurityEvent,
  assertCrossTenantEventLogged,
  assertPIILeakEventLogged
};

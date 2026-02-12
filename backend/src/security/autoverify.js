/**
 * Channel Identity Proof Autoverify (Shared Helper)
 *
 * Extracted from core/orchestrator/steps/06_toolLoop.js so both
 * chat/WA and email pipelines can use the same logic.
 *
 * SECURITY INVARIANTS:
 *   1. Autoverify ONLY when proof.matchedCustomerId === anchor.customerId (fail-closed).
 *   2. FINANCIAL distinction removed — STRONG proof is sufficient for all query types.
 *   3. If anchorCustomerId is null → autoverify denied.
 *   4. Any error → autoverify denied (fail-closed).
 *
 * @module security/autoverify
 */

import { isChannelProofEnabled } from '../config/feature-flags.js';
import {
  deriveIdentityProof,
  shouldRequireAdditionalVerification
} from './identityProof.js';
import { getFullResult } from '../services/verification-service.js';
import { ToolOutcome, normalizeOutcome } from '../tools/toolResult.js';
import { OutcomeEventType } from './outcomePolicy.js';
import prisma from '../config/database.js';

/**
 * Attempt channel-proof autoverify on a VERIFICATION_REQUIRED tool result.
 *
 * @param {Object} params
 * @param {Object} params.toolResult          - The tool result (must have outcome VERIFICATION_REQUIRED)
 * @param {string} params.toolName            - Tool name (e.g. 'customer_data_lookup')
 * @param {Object} params.business            - Business object (needs .id)
 * @param {Object} params.state               - Orchestrator state
 * @param {string} params.language            - 'TR' | 'EN'
 * @param {Object} [params.metrics]           - Optional metrics object to write telemetry into
 * @returns {Promise<Object>} { applied, toolResult, telemetry }
 *   - applied: boolean — true if autoverify succeeded and toolResult was overridden
 *   - toolResult: the (possibly overridden) tool result
 *   - telemetry: proof/decision info for logging
 */
export async function tryAutoverify({ toolResult, toolName, business, state, language, metrics }) {
  const normalizedOutcome = normalizeOutcome(toolResult.outcome);

  // Pre-conditions: only act on VERIFICATION_REQUIRED with identity context
  if (normalizedOutcome !== ToolOutcome.VERIFICATION_REQUIRED) {
    return { applied: false, toolResult, telemetry: null };
  }

  const idCtx = toolResult._identityContext;
  if (!idCtx) {
    return { applied: false, toolResult, telemetry: null };
  }

  if (!isChannelProofEnabled({ businessId: business.id })) {
    return { applied: false, toolResult, telemetry: null };
  }

  const proofStartTime = Date.now();

  try {
    // 1. Derive channel identity proof (DB lookup: phone/email → customer match)
    const proof = await deriveIdentityProof(
      {
        channel: idCtx.channel,
        channelUserId: idCtx.channelUserId,
        fromEmail: idCtx.fromEmail,
        businessId: idCtx.businessId
      },
      { queryType: idCtx.queryType },
      state
    );

    // 2. Central verification decision (FINANCIAL branch removed — see identityProof.js)
    const verificationDecision = shouldRequireAdditionalVerification(proof, state.intent);

    const proofDurationMs = Date.now() - proofStartTime;

    const telemetry = {
      strength: proof.strength,
      channel: idCtx.channel,
      matchedCustomerId: proof.matchedCustomerId,
      autoverifyApplied: false,
      secondFactorRequired: verificationDecision.required,
      reason: verificationDecision.reason,
      durationMs: proofDurationMs
    };

    console.log('🔑 [Autoverify] Channel proof result:', telemetry);

    // 3. If proof NOT sufficient → bail out
    if (verificationDecision.required) {
      if (metrics) metrics.identityProof = { ...telemetry };
      return { applied: false, toolResult, telemetry };
    }

    // 4. Anchor-proof match: anchor.customerId must match proof.matchedCustomerId
    const anchorId = idCtx.anchorId;
    const anchorCustomerId = idCtx.anchorCustomerId;
    const anchorMatchesProof =
      anchorCustomerId != null &&
      proof.matchedCustomerId != null &&
      proof.matchedCustomerId === anchorCustomerId;

    if (!anchorMatchesProof) {
      console.warn('⚠️ [Autoverify] Proof mismatch: proof.matchedCustomerId ≠ anchor.customerId', {
        proofCustomerId: proof.matchedCustomerId,
        anchorCustomerId,
        anchorId
      });
      if (metrics) metrics.identityProof = { ...telemetry };
      return { applied: false, toolResult, telemetry };
    }

    // 5. Re-fetch full record from DB
    console.log('✅ [Autoverify] Channel proof AUTOVERIFY — skipping second factor');

    const sourceTable = idCtx.anchorSourceTable || 'CustomerData';
    let fullRecord;
    if (sourceTable === 'CrmOrder') {
      fullRecord = await prisma.crmOrder.findUnique({ where: { id: anchorId } });
    } else {
      fullRecord = await prisma.customerData.findUnique({ where: { id: anchorId } });
    }

    if (!fullRecord) {
      console.error('❌ [Autoverify] Record not found for anchor', anchorId);
      if (metrics) metrics.identityProof = { ...telemetry };
      return { applied: false, toolResult, telemetry };
    }

    // 6. Build full result and override toolResult
    const fullResultData = getFullResult(fullRecord, idCtx.queryType, language);

    toolResult.outcome = ToolOutcome.OK;
    toolResult.success = true;
    toolResult.data = fullResultData.data;
    toolResult.message = fullResultData.message;
    toolResult.verificationRequired = false;

    // Replace stateEvents with VERIFICATION_PASSED (channel_proof method)
    toolResult.stateEvents = [
      {
        type: OutcomeEventType.VERIFICATION_PASSED,
        anchor: anchorId ? {
          id: anchorId,
          customerId: anchorCustomerId,
          sourceTable,
          type: 'channel_proof'
        } : null,
        reason: 'channel_proof',
        proofStrength: proof.strength,
        attempts: 0
      }
    ];

    telemetry.autoverifyApplied = true;
    if (metrics) metrics.identityProof = { ...telemetry };

    console.log('🔓 [Autoverify] Override complete — outcome now OK');

    return { applied: true, toolResult, telemetry };

  } catch (proofError) {
    // FAIL-CLOSED: error → normal verification flow continues
    console.error('❌ [Autoverify] Error (fail-closed):', proofError.message);

    const errorTelemetry = {
      strength: 'ERROR',
      channel: idCtx.channel,
      autoverifyApplied: false,
      secondFactorRequired: true,
      reason: 'proof_derivation_error',
      durationMs: Date.now() - proofStartTime
    };

    if (metrics) metrics.identityProof = errorTelemetry;

    return { applied: false, toolResult, telemetry: errorTelemetry };
  }
}

export default { tryAutoverify };

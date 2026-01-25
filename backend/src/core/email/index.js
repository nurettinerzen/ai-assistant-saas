/**
 * Email Orchestrator Module
 *
 * Exports the email draft generation pipeline.
 *
 * Usage:
 *   import { handleEmailTurn } from '../core/email/index.js';
 *
 *   const result = await handleEmailTurn({
 *     businessId: 123,
 *     threadId: 'thread-id',
 *     messageId: 'message-id'  // optional, uses latest inbound if not provided
 *   });
 */

export { handleEmailTurn } from './handleEmailTurn.js';

// Export individual steps for testing/debugging
export { loadEmailContext } from './steps/01_loadEmailContext.js';
export { fetchThreadMessages } from './steps/02_fetchThread.js';
export { classifyEmail } from './steps/03_classifyEmail.js';
export { gateEmailTools, isToolAllowedForEmail } from './steps/04_toolGating.js';
export { executeEmailToolLoop } from './steps/05_toolLoop.js';
export { generateEmailDraft } from './steps/06_generateDraft.js';
export { applyEmailGuardrails } from './steps/07_guardrails.js';
export { createProviderDraft } from './steps/08_createDraft.js';
export { persistEmailMetrics, emitEmailMetric } from './steps/09_persistAndMetrics.js';

// Export policies for testing/advanced usage
export {
  acquireDraftLock,
  completeDraftLock,
  failDraftLock,
  checkDraftIdempotency,
  markDraftGenerated,
  cleanupExpiredLocks
} from './policies/idempotencyPolicy.js';

export {
  validateRecipientOwnership,
  stripRecipientMentions,
  buildSafeRecipients,
  validateDraftContent
} from './policies/recipientOwnershipPolicy.js';

export {
  enforceToolRequiredPolicy,
  getToolRequirement,
  intentRequiresTool
} from './policies/toolRequiredPolicy.js';

export {
  preventPIILeak,
  scanForPII,
  isContentSafe,
  PIIPatterns
} from './policies/piiPreventionPolicy.js';

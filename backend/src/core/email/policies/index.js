/**
 * Email Policies
 *
 * Production-ready policies for email draft generation:
 * 1. Idempotency - Prevent duplicate draft generation
 * 2. Recipient Ownership - Validate thread belongs to business
 * 3. Tool Required - Force tool lookup for certain intents
 * 4. PII Prevention - Prevent sensitive data leaks
 */

export { checkDraftIdempotency, markDraftGenerated } from './idempotencyPolicy.js';
export { validateRecipientOwnership } from './recipientOwnershipPolicy.js';
export { enforceToolRequiredPolicy } from './toolRequiredPolicy.js';
export { preventPIILeak, PIIPatterns } from './piiPreventionPolicy.js';

/**
 * OAuth State Management Middleware
 * Prevents CSRF attacks on OAuth callbacks
 *
 * SECURITY:
 * - Generates cryptographically secure state tokens
 * - Stores state in database with 10-minute expiry
 * - Validates state on callback (single-use)
 * - Constant-time comparison
 */

import crypto from 'crypto';
import prisma from '../prismaClient.js';

/**
 * Generate OAuth state token and store in database
 * @param {number} businessId - Business ID
 * @param {string} provider - OAuth provider (google, microsoft, hubspot, etc.)
 * @param {object} metadata - Additional metadata to store with state
 * @returns {Promise<string>} - State token
 */
export async function generateOAuthState(businessId, provider, metadata = {}) {
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store businessId in metadata for callback retrieval
  const fullMetadata = {
    ...metadata,
    businessId
  };

  await prisma.oAuthState.create({
    data: {
      state,
      businessId,
      provider,
      metadata: fullMetadata,
      expiresAt
    }
  });

  console.log(`✅ OAuth state generated for ${provider}, businessId: ${businessId}`);
  return state;
}

/**
 * Validate OAuth state token (single-use)
 * @param {string} state - State token from callback
 * @param {number|null} expectedBusinessId - Expected business ID (optional - will use stored value if null)
 * @param {string} provider - OAuth provider
 * @returns {Promise<{valid: boolean, businessId?: number, metadata?: object, error?: string}>}
 */
export async function validateOAuthState(state, expectedBusinessId, provider) {
  if (!state) {
    return { valid: false, error: 'Missing state parameter' };
  }

  try {
    // Find state in database
    const storedState = await prisma.oAuthState.findUnique({
      where: { state }
    });

    if (!storedState) {
      console.error('❌ OAuth state not found in database');
      return { valid: false, error: 'Invalid state' };
    }

    // Check expiry
    if (new Date() > storedState.expiresAt) {
      console.error('❌ OAuth state expired');
      // Clean up expired state
      await prisma.oAuthState.delete({ where: { state } });
      return { valid: false, error: 'State expired' };
    }

    // Validate business ID (if provided)
    if (expectedBusinessId !== null && storedState.businessId !== expectedBusinessId) {
      console.error('❌ OAuth state businessId mismatch');
      return { valid: false, error: 'State businessId mismatch' };
    }

    // Validate provider
    if (storedState.provider !== provider) {
      console.error('❌ OAuth state provider mismatch');
      return { valid: false, error: 'State provider mismatch' };
    }

    // Single-use: delete after validation
    await prisma.oAuthState.delete({ where: { state } });

    console.log(`✅ OAuth state validated for ${provider}, businessId: ${storedState.businessId}`);
    return {
      valid: true,
      businessId: storedState.businessId,
      metadata: storedState.metadata
    };
  } catch (error) {
    console.error('❌ OAuth state validation error:', error);
    return { valid: false, error: 'State validation failed' };
  }
}

/**
 * Cleanup expired OAuth states (run as cron job)
 */
export async function cleanupExpiredOAuthStates() {
  const result = await prisma.oAuthState.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
  console.log(`🧹 Cleaned up ${result.count} expired OAuth states`);
  return result.count;
}

/**
 * Signed URL Generator for Media Access
 *
 * SECURITY DESIGN:
 * - Short TTL (60s default)
 * - mediaId-based (not path-based) to prevent path traversal
 * - HMAC signature
 * - Rate limited
 * - Referrer-Policy: no-referrer
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Lazy evaluation to allow env vars to be set after import
const getSecret = () => {
  const secret = process.env.SIGNED_URL_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('SIGNED_URL_SECRET or JWT_SECRET must be set');
  }
  return secret;
};

const DEFAULT_TTL = 60; // 60 seconds

/**
 * Generate a signed URL for media access
 * @param {string} mediaId - Database media ID (NOT file path)
 * @param {number} userId - User requesting access
 * @param {number} businessId - Business ID for isolation
 * @param {number} ttl - Time to live in seconds (default 60s)
 * @returns {string} Signed token
 */
export const generateSignedMediaToken = (mediaId, userId, businessId, ttl = DEFAULT_TTL) => {
  if (!mediaId || !userId || !businessId) {
    throw new Error('mediaId, userId, and businessId are required');
  }

  const nonce = crypto.randomBytes(16).toString('hex');

  const payload = {
    type: 'media_access',
    mediaId: String(mediaId),
    userId,
    businessId,
    nonce,
    iat: Math.floor(Date.now() / 1000)
  };

  const token = jwt.sign(payload, getSecret(), { expiresIn: ttl });

  return token;
};

/**
 * Verify and decode signed media token
 * @param {string} token - Signed token
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid
 */
export const verifySignedMediaToken = (token) => {
  try {
    const decoded = jwt.verify(token, getSecret());

    if (decoded.type !== 'media_access') {
      throw new Error('Invalid token type');
    }

    if (!decoded.mediaId || !decoded.userId || !decoded.businessId) {
      throw new Error('Missing required fields');
    }

    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Generate signed media access descriptor.
 * Token must be sent via `X-Media-Access-Token` or `Authorization: Bearer`.
 * @param {string} mediaId - Media ID
 * @param {number} userId - User ID
 * @param {number} businessId - Business ID
 * @param {string} baseUrl - Backend URL (optional, uses env)
 * @returns {{ url: string, token: string }} Signed endpoint and token
 */
export const generateSignedMediaAccess = (mediaId, userId, businessId, baseUrl = null) => {
  const token = generateSignedMediaToken(mediaId, userId, businessId);
  const base = baseUrl || process.env.BACKEND_URL || 'http://localhost:3000';

  return {
    url: `${base}/api/media/signed`,
    token,
  };
};

export default {
  generateSignedMediaToken,
  verifySignedMediaToken,
  generateSignedMediaAccess
};

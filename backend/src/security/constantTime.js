import crypto from 'crypto';

/**
 * Constant-time string comparison using fixed-length hashes.
 * This avoids leaking information through early-return semantics.
 */
export function safeCompareStrings(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  const leftHash = crypto.createHash('sha256').update(left, 'utf8').digest();
  const rightHash = crypto.createHash('sha256').update(right, 'utf8').digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

/**
 * Constant-time comparison for hex-encoded digests.
 */
export function safeCompareHex(leftHex, rightHex) {
  if (typeof leftHex !== 'string' || typeof rightHex !== 'string') {
    return false;
  }

  try {
    const leftBuffer = Buffer.from(leftHex, 'hex');
    const rightBuffer = Buffer.from(rightHex, 'hex');

    if (leftBuffer.length === 0 || rightBuffer.length === 0) {
      return false;
    }

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export default {
  safeCompareStrings,
  safeCompareHex,
};

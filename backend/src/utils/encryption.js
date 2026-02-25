import crypto from 'crypto';

/**
 * Encryption utility for securely storing sensitive data
 * Uses AES-256-GCM encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
let warnedWeakFallback = false;

/**
 * Derives encryption key from secret using PBKDF2
 * @param {string} secret - The encryption secret from environment
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived encryption key
 */
function deriveKey(secret, salt) {
  return crypto.pbkdf2Sync(
    secret,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

function getEncryptionSecret() {
  const configuredSecret = process.env.ENCRYPTION_SECRET;
  if (typeof configuredSecret === 'string' && configuredSecret.trim().length >= 16) {
    return configuredSecret;
  }

  // Non-production fallback for local/dev convenience.
  if (process.env.NODE_ENV !== 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (typeof jwtSecret === 'string' && jwtSecret.trim().length >= 16) {
      if (!warnedWeakFallback) {
        warnedWeakFallback = true;
        console.warn('⚠️ ENCRYPTION_SECRET is not set. Falling back to JWT_SECRET in non-production.');
      }
      return jwtSecret;
    }
  }

  throw new Error('ENCRYPTION_SECRET must be configured with at least 16 characters');
}

/**
 * Encrypts sensitive data
 * @param {string} text - The text to encrypt
 * @returns {string} Encrypted text in format: salt:iv:encrypted:tag (all base64)
 */
export function encrypt(text) {
  if (!text) return null;

  const secret = getEncryptionSecret();

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from secret
  const key = deriveKey(secret, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const tag = cipher.getAuthTag();

  // Return salt:iv:encrypted:tag (all base64 encoded)
  return `${salt.toString('base64')}:${iv.toString('base64')}:${encrypted}:${tag.toString('base64')}`;
}

/**
 * Decrypts encrypted data
 * @param {string} encryptedText - The encrypted text in format: salt:iv:encrypted:tag
 * @returns {string} Decrypted text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  const secret = getEncryptionSecret();

  try {
    // Split the encrypted text
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'base64');
    const iv = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    const tag = Buffer.from(parts[3], 'base64');

    // Derive key from secret
    const key = deriveKey(secret, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Validates that encryption is properly configured
 * @returns {boolean} True if encryption is working
 */
export function validateEncryption() {
  try {
    const testData = 'test-encryption-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return testData === decrypted;
  } catch (error) {
    console.error('Encryption validation failed:', error);
    return false;
  }
}

/**
 * Generates a secure random token
 * @param {number} length - Length of the token in bytes (default: 32)
 * @returns {string} Random token in hex format
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

export default {
  encrypt,
  decrypt,
  validateEncryption,
  generateSecureToken
};

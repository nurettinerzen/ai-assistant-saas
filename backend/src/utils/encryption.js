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
const TOKEN_ENCRYPTION_PREFIX = 'enc:v1:';
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

function normalizeSecret(secret) {
  if (typeof secret !== 'string') return null;
  const normalized = secret.trim();
  if (normalized.length < 16) return null;
  return normalized;
}

function getNonProdJwtFallbackSecret() {
  // Non-production fallback for local/dev convenience.
  if (process.env.NODE_ENV !== 'production') {
    const jwtSecret = normalizeSecret(process.env.JWT_SECRET);
    if (jwtSecret) {
      if (!warnedWeakFallback) {
        warnedWeakFallback = true;
        console.warn('⚠️ ENCRYPTION_MASTER_KEY/ENCRYPTION_SECRET is not set. Falling back to JWT_SECRET in non-production.');
      }
      return jwtSecret;
    }
  }
  return null;
}

function getPrimaryEncryptionSecret() {
  const masterSecret = normalizeSecret(process.env.ENCRYPTION_MASTER_KEY);
  if (masterSecret) {
    return masterSecret;
  }

  const legacySecret = normalizeSecret(process.env.ENCRYPTION_SECRET);
  if (legacySecret) {
    return legacySecret;
  }

  const nonProdFallback = getNonProdJwtFallbackSecret();
  if (nonProdFallback) {
    return nonProdFallback;
  }

  throw new Error('ENCRYPTION_MASTER_KEY (or ENCRYPTION_SECRET) must be configured with at least 16 characters');
}

function getFallbackEncryptionSecrets() {
  const rawFallbacks = process.env.ENCRYPTION_FALLBACK_KEYS || '';
  if (typeof rawFallbacks !== 'string' || rawFallbacks.trim().length === 0) {
    return [];
  }

  return rawFallbacks
    .split(',')
    .map((candidate) => normalizeSecret(candidate))
    .filter(Boolean);
}

function getEncryptionSecretsForDecryption() {
  const secrets = [];
  const add = (secret) => {
    if (!secret) return;
    if (!secrets.includes(secret)) secrets.push(secret);
  };

  add(normalizeSecret(process.env.ENCRYPTION_MASTER_KEY));
  add(normalizeSecret(process.env.ENCRYPTION_SECRET));
  for (const fallbackSecret of getFallbackEncryptionSecrets()) {
    add(fallbackSecret);
  }

  if (secrets.length === 0) {
    add(getNonProdJwtFallbackSecret());
  }

  if (secrets.length === 0) {
    throw new Error('ENCRYPTION_MASTER_KEY (or ENCRYPTION_SECRET) must be configured with at least 16 characters');
  }

  return secrets;
}

/**
 * Encrypts sensitive data
 * @param {string} text - The text to encrypt
 * @returns {string} Encrypted text in format: salt:iv:encrypted:tag (all base64)
 */
export function encrypt(text) {
  if (!text) return null;

  const secret = getPrimaryEncryptionSecret();

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

    const secrets = getEncryptionSecretsForDecryption();
    let lastError = null;

    for (const secret of secrets) {
      try {
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
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to decrypt payload with configured secrets');
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Returns true when token value uses the versioned field-level format.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(TOKEN_ENCRYPTION_PREFIX);
}

/**
 * Encrypt token value using versioned format for future key rotation/migrations.
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
export function encryptTokenValue(value) {
  if (value == null) return value;
  if (typeof value !== 'string' || value.length === 0) return value;
  if (isEncryptedValue(value)) return value;

  return `${TOKEN_ENCRYPTION_PREFIX}${encrypt(value)}`;
}

/**
 * Decrypt token value when encrypted, or pass plaintext through for lazy migration.
 * @param {string|null|undefined} value
 * @param {Object} [options]
 * @param {boolean} [options.allowPlaintext=true]
 * @returns {string|null|undefined}
 */
export function decryptTokenValue(value, { allowPlaintext = true } = {}) {
  if (value == null) return value;
  if (typeof value !== 'string' || value.length === 0) return value;

  if (isEncryptedValue(value)) {
    return decrypt(value.slice(TOKEN_ENCRYPTION_PREFIX.length));
  }

  if (allowPlaintext) {
    return value;
  }

  throw new Error('Token value is not encrypted');
}

function looksLikeLegacyEncryptedPayload(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 4) return false;
  return parts.every((part) => part.length > 0 && /^[A-Za-z0-9+/=]+$/.test(part));
}

/**
 * Decrypts versioned tokens, legacy encrypted payloads, or passes plaintext through.
 * @param {string|null|undefined} value
 * @param {Object} [options]
 * @param {boolean} [options.allowPlaintext=true]
 * @returns {string|null|undefined}
 */
export function decryptPossiblyEncryptedValue(value, { allowPlaintext = true } = {}) {
  if (value == null) return value;
  if (typeof value !== 'string' || value.length === 0) return value;

  if (isEncryptedValue(value)) {
    return decrypt(value.slice(TOKEN_ENCRYPTION_PREFIX.length));
  }

  if (looksLikeLegacyEncryptedPayload(value)) {
    return decrypt(value);
  }

  if (allowPlaintext) {
    return value;
  }

  throw new Error('Value is not encrypted');
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
  isEncryptedValue,
  encryptTokenValue,
  decryptTokenValue,
  decryptPossiblyEncryptedValue,
  validateEncryption,
  generateSecureToken
};

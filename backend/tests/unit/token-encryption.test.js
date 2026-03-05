import assert from 'assert';
import {
  encrypt,
  decrypt,
  isEncryptedValue,
  encryptTokenValue,
  decryptTokenValue,
  decryptPossiblyEncryptedValue
} from '../../src/utils/encryption.js';

function expectThrows(fn, label) {
  let failed = false;
  try {
    fn();
  } catch (error) {
    failed = true;
  }
  assert.ok(failed, label);
}

function run() {
  const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;
  const originalLegacyKey = process.env.ENCRYPTION_SECRET;

  try {
    process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-for-aes-gcm-32-chars!!';
    delete process.env.ENCRYPTION_SECRET;

    const plaintext = 'google-refresh-token-123';
    const encrypted = encryptTokenValue(plaintext);

    assert.ok(isEncryptedValue(encrypted), 'encrypted value must have enc:v1 prefix');
    assert.strictEqual(
      decryptTokenValue(encrypted, { allowPlaintext: false }),
      plaintext,
      'encrypted token should decrypt back to original value'
    );
    assert.strictEqual(
      decryptTokenValue(plaintext),
      plaintext,
      'plaintext token should be accepted for lazy migration'
    );
    assert.strictEqual(
      decryptPossiblyEncryptedValue(plaintext, { allowPlaintext: true }),
      plaintext,
      'plaintext should pass through in mixed-mode decrypt helper'
    );

    process.env.ENCRYPTION_MASTER_KEY = 'different-master-key-for-failure-check';
    expectThrows(
      () => decryptTokenValue(encrypted, { allowPlaintext: false }),
      'decrypt must fail with wrong key'
    );

    process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-for-aes-gcm-32-chars!!';
    const encoded = encrypted.replace(/^enc:v1:/, '');
    const parts = encoded.split(':');
    const encryptedBody = parts[2] || '';
    const mutateAt = Math.min(2, Math.max(0, encryptedBody.length - 1));
    parts[2] = `${encryptedBody.slice(0, mutateAt)}${encryptedBody.charAt(mutateAt) === 'A' ? 'B' : 'A'}${encryptedBody.slice(mutateAt + 1)}`;
    const tampered = `enc:v1:${parts.join(':')}`;
    expectThrows(
      () => decryptTokenValue(tampered, { allowPlaintext: false }),
      'decrypt must fail when ciphertext is tampered'
    );

    // Legacy (non-prefixed) encrypted value should still decrypt.
    process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-for-aes-gcm-32-chars!!';
    const legacyEncrypted = encrypt(plaintext);
    assert.strictEqual(
      decryptPossiblyEncryptedValue(legacyEncrypted, { allowPlaintext: false }),
      plaintext,
      'legacy encrypted values should decrypt via mixed-mode helper'
    );

    // Key-rotation compatibility:
    // Data encrypted with legacy key must decrypt even after master key is introduced.
    delete process.env.ENCRYPTION_MASTER_KEY;
    process.env.ENCRYPTION_SECRET = 'legacy-key-for-rotation-compat-check-1234';
    const encryptedWithLegacyKey = encrypt('legacy-token-value');
    process.env.ENCRYPTION_MASTER_KEY = 'new-master-key-for-rotation-compat-5678';
    process.env.ENCRYPTION_SECRET = 'legacy-key-for-rotation-compat-check-1234';
    assert.strictEqual(
      decrypt(encryptedWithLegacyKey),
      'legacy-token-value',
      'decrypt should try legacy key when master key does not match old data'
    );

    console.log('✅ token-encryption.test.js passed');
  } finally {
    if (originalMasterKey === undefined) {
      delete process.env.ENCRYPTION_MASTER_KEY;
    } else {
      process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
    }

    if (originalLegacyKey === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = originalLegacyKey;
    }
  }
}

try {
  run();
} catch (error) {
  console.error('❌ token-encryption.test.js failed:', error.message);
  process.exit(1);
}

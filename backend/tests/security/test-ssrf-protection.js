/**
 * SSRF Protection - Test Suite (P0-7)
 *
 * CRITICAL: Must block access to private IPs and metadata endpoints
 *
 * Run: node backend/tests/security/test-ssrf-protection.js
 */

import { validateUrlForSSRF } from '../../src/utils/ssrf-protection.js';

console.log('🧪 SSRF Protection - Test Suite\n');
console.log('='.repeat(60));

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`✅ ${name}`);
    passCount++;
  }).catch((error) => {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failCount++;
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============================================================================
// TEST GROUP 1: MUST BLOCK - Dangerous URLs
// ============================================================================
console.log('\n📋 Test Group 1: URLs That MUST Be Blocked\n');

const dangerousTests = [
  test('Block localhost (http://localhost)', async () => {
    const result = await validateUrlForSSRF('http://localhost:8000/admin');
    assert(result.safe === false, 'Should block localhost');
  }),

  test('Block 127.0.0.1', async () => {
    const result = await validateUrlForSSRF('http://127.0.0.1/admin');
    assert(result.safe === false, 'Should block 127.0.0.1');
  }),

  test('Block 10.0.0.0/8 (private)', async () => {
    const result = await validateUrlForSSRF('http://10.0.0.1/');
    assert(result.safe === false, 'Should block 10.x private IP');
  }),

  test('Block 172.16.0.0/12 (private)', async () => {
    const result = await validateUrlForSSRF('http://172.16.0.1/');
    assert(result.safe === false, 'Should block 172.16.x private IP');
  }),

  test('Block 192.168.0.0/16 (private)', async () => {
    const result = await validateUrlForSSRF('http://192.168.1.1/');
    assert(result.safe === false, 'Should block 192.168.x private IP');
  }),

  test('Block AWS metadata endpoint (169.254.169.254)', async () => {
    const result = await validateUrlForSSRF('http://169.254.169.254/latest/meta-data');
    assert(result.safe === false, 'Should block AWS metadata endpoint');
  }),

  test('Block link-local (169.254.0.0/16)', async () => {
    const result = await validateUrlForSSRF('http://169.254.1.1/');
    assert(result.safe === false, 'Should block link-local IP');
  }),

  test('Block FTP protocol', async () => {
    const result = await validateUrlForSSRF('ftp://example.com/file.txt');
    assert(result.safe === false, 'Should block FTP protocol');
  }),

  test('Block file:// protocol', async () => {
    const result = await validateUrlForSSRF('file:///etc/passwd');
    assert(result.safe === false, 'Should block file:// protocol');
  }),

  test('Block IPv6 localhost (::1)', async () => {
    const result = await validateUrlForSSRF('http://[::1]/admin');
    assert(result.safe === false, 'Should block IPv6 localhost');
  }),
];

// ============================================================================
// TEST GROUP 2: MUST ALLOW - Safe URLs
// ============================================================================
console.log('\n📋 Test Group 2: Safe URLs That MUST Be Allowed\n');

const safeTests = [
  test('Allow public HTTPS URL (google.com)', async () => {
    const result = await validateUrlForSSRF('https://www.google.com');
    assert(result.safe === true, 'Should allow google.com');
  }),

  test('Allow public HTTP URL (example.com)', async () => {
    const result = await validateUrlForSSRF('http://example.com');
    assert(result.safe === true, 'Should allow example.com');
  }),

  test('Allow GitHub URL', async () => {
    const result = await validateUrlForSSRF('https://github.com/');
    assert(result.safe === true, 'Should allow GitHub');
  }),

  test('Allow documentation site', async () => {
    const result = await validateUrlForSSRF('https://docs.anthropic.com/');
    assert(result.safe === true, 'Should allow docs.anthropic.com');
  }),

  test('Allow public API endpoint', async () => {
    const result = await validateUrlForSSRF('https://api.stripe.com/v1/charges');
    assert(result.safe === true, 'Should allow stripe API');
  }),
];

// Run all tests
(async () => {
  await Promise.all(dangerousTests);
  await Promise.all(safeTests);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total:  ${passCount + failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All SSRF protection tests passed!\n');
    console.log('✅ P0-7 REQUIREMENT MET: SSRF protection is working\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the protection.\n');
    process.exit(1);
  }
})();

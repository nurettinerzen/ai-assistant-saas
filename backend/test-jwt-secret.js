/**
 * V1 MVP: JWT Secret Security Check
 * Ensures JWT_SECRET is not the default weak value
 */

import dotenv from 'dotenv';
dotenv.config();

const WEAK_SECRETS = [
  'super-secret-change-this-12345',
  'your-secret-key',
  'secret',
  'jwt-secret',
  'change-me'
];

const secret = process.env.JWT_SECRET;

console.log('🔐 JWT Secret Security Check\n');

if (!secret) {
  console.log('❌ CRITICAL: JWT_SECRET is not set!');
  process.exit(1);
}

console.log(`Secret length: ${secret.length} characters`);

// Check if weak
const isWeak = WEAK_SECRETS.some(weak => secret.includes(weak));

if (isWeak) {
  console.log('❌ CRITICAL: JWT_SECRET contains a known weak value!');
  console.log('   This is a SECURITY VULNERABILITY!');
  console.log('   Current secret:', secret.substring(0, 20) + '...');
  process.exit(1);
}

// Check length
if (secret.length < 32) {
  console.log('⚠️  WARNING: JWT_SECRET is too short (< 32 chars)');
  console.log('   Recommended: at least 64 characters');
  process.exit(1);
}

console.log('✅ JWT_SECRET is strong');
console.log(`   Preview: ${secret.substring(0, 20)}...${secret.substring(secret.length - 10)}`);

// Production environment check
if (process.env.NODE_ENV === 'production') {
  console.log('\n🚀 Production Environment Detected');
  console.log('   Ensure this secret is different from dev/staging!');
}

console.log('\n✅ All JWT secret checks passed!');

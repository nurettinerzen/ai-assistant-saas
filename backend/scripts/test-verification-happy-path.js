/**
 * VERIFICATION HAPPY PATH PROOF
 *
 * Tests the complete verification flow from none → pending → verified
 *
 * Expected flow:
 * 1. User provides order number → status: pending
 * 2. User provides correct full name → status: verified, data returned
 * 3. User provides wrong name → status: none/failed, data withheld
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testHappyPath() {
  try {
    const business = await prisma.business.findUnique({
      where: { id: 1 },
      include: { assistants: { where: { isActive: true }, take: 1 } }
    });

    if (!business || !business.assistants || business.assistants.length === 0) {
      console.log('✗ No assistant found');
      return;
    }

    const assistantId = business.assistants[0].id;
    console.log('✓ Using assistant:', assistantId);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST 1: HAPPY PATH - Correct Name');
    console.log('═══════════════════════════════════════════════════════\n');

    const sessionId1 = 'test-happy-path-' + Date.now();

    // Request 1: Provide order number
    console.log('→ REQUEST 1: User provides order number only');
    console.log('  Message: "ORD-2024-001 siparişimi sorgula"');
    const res1 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'ORD-2024-001 siparişimi sorgula',
      sessionId: sessionId1
    });

    console.log('\n← RESPONSE 1:');
    console.log('  verificationStatus:', res1.data.verificationStatus);
    console.log('  conversationId:', res1.data.conversationId?.substring(0, 20) + '...');
    console.log('  Reply:', res1.data.reply.substring(0, 100) + '...');

    const test1Pass = res1.data.verificationStatus === 'pending';
    console.log('\n  ' + (test1Pass ? '✓ PASS' : '✗ FAIL') + ': verificationStatus = "pending"');

    if (!test1Pass) {
      console.log('\n⚠️  Test 1 failed, skipping remaining tests');
      return;
    }

    // Request 2: Provide correct full name
    console.log('\n\n→ REQUEST 2: User provides correct FULL name');
    console.log('  Message: "Ahmet Yılmaz"');
    const res2 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Ahmet Yılmaz',
      sessionId: sessionId1
    });

    console.log('\n← RESPONSE 2:');
    console.log('  verificationStatus:', res2.data.verificationStatus);
    console.log('  Reply:', res2.data.reply.substring(0, 150));

    // Check if data was provided (order found)
    const lowerReply2 = res2.data.reply.toLowerCase();
    const dataProvided = !lowerReply2.includes('bulunamadı') && !lowerReply2.includes('eşleşmiyor');
    const test2aPass = res2.data.verificationStatus === 'verified';
    const test2bPass = dataProvided;

    console.log('\n  ' + (test2aPass ? '✓ PASS' : '✗ FAIL') + ': verificationStatus = "verified"');
    console.log('  ' + (test2bPass ? '✓ PASS' : '✗ FAIL') + ': Data provided (order found)');

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('TEST 2: UNHAPPY PATH - Wrong Name');
    console.log('═══════════════════════════════════════════════════════\n');

    const sessionId2 = 'test-unhappy-path-' + Date.now();

    // Request 1: Provide order number
    console.log('→ REQUEST 1: User provides order number');
    console.log('  Message: "ORD-2024-001 siparişimi sorgula"');
    const res3 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'ORD-2024-001 siparişimi sorgula',
      sessionId: sessionId2
    });

    console.log('\n← RESPONSE 1:');
    console.log('  verificationStatus:', res3.data.verificationStatus);

    const test3Pass = res3.data.verificationStatus === 'pending';
    console.log('  ' + (test3Pass ? '✓ PASS' : '✗ FAIL') + ': verificationStatus = "pending"');

    // Request 2: Provide WRONG name
    console.log('\n\n→ REQUEST 2: User provides WRONG name');
    console.log('  Message: "Mehmet Kaya" (wrong name for ORD-2024-001)');
    const res4 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Mehmet Kaya',
      sessionId: sessionId2
    });

    console.log('\n← RESPONSE 2:');
    console.log('  verificationStatus:', res4.data.verificationStatus);
    console.log('  Reply:', res4.data.reply.substring(0, 150));

    // Check if data was withheld
    const lowerReply4 = res4.data.reply.toLowerCase();
    const dataWithheld = lowerReply4.includes('eşleşmiyor') || lowerReply4.includes('eslesmiyor');
    const test4aPass = res4.data.verificationStatus === 'failed' || res4.data.verificationStatus === 'none';
    const test4bPass = dataWithheld;

    console.log('\n  ' + (test4aPass ? '✓ PASS' : '✗ FAIL') + ': verificationStatus = "failed" or "none"');
    console.log('  ' + (test4bPass ? '✓ PASS' : '✗ FAIL') + ': Data withheld (name mismatch)');

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('TEST 3: PARTIAL NAME (Edge Case)');
    console.log('═══════════════════════════════════════════════════════\n');

    const sessionId3 = 'test-partial-name-' + Date.now();

    // Request 1: Provide order number
    console.log('→ REQUEST 1: User provides order number');
    const res5 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'ORD-2024-001 siparişimi sorgula',
      sessionId: sessionId3
    });

    console.log('\n← RESPONSE 1:');
    console.log('  verificationStatus:', res5.data.verificationStatus);

    // Request 2: Provide partial name
    console.log('\n\n→ REQUEST 2: User provides PARTIAL name');
    console.log('  Message: "Ahmet" (missing surname)');
    const res6 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Ahmet',
      sessionId: sessionId3
    });

    console.log('\n← RESPONSE 2:');
    console.log('  verificationStatus:', res6.data.verificationStatus);
    console.log('  Reply:', res6.data.reply.substring(0, 150));

    const lowerReply6 = res6.data.reply.toLowerCase();
    const asksForFullName = (lowerReply6.includes('ad') && lowerReply6.includes('soyad')) ||
                           lowerReply6.includes('tam') ||
                           lowerReply6.includes('full name');
    const test6Pass = asksForFullName;

    console.log('\n  ' + (test6Pass ? '✓ PASS' : '⚠️  EXPECTED') + ': Assistant asks for full name');
    if (!test6Pass) {
      console.log('  Note: Currently treats partial name as mismatch. Should ask for full name instead.');
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════');

    const allCriticalPass = test1Pass && test2aPass && test2bPass && test3Pass && test4aPass && test4bPass;

    if (allCriticalPass) {
      console.log('\n✓✓✓ ALL CRITICAL TESTS PASSED');
      console.log('\nVerification flow is working:');
      console.log('  • none → pending (when order found but not verified)');
      console.log('  • pending → verified (when correct name provided)');
      console.log('  • pending → failed (when wrong name provided)');
      console.log('  • Data is protected until verification succeeds');
    } else {
      console.log('\n✗✗✗ SOME TESTS FAILED');
      console.log('\nFailed tests:');
      if (!test1Pass) console.log('  • Initial verification request (pending status)');
      if (!test2aPass) console.log('  • Verification success (verified status)');
      if (!test2bPass) console.log('  • Data disclosure after verification');
      if (!test3Pass) console.log('  • Second verification request (pending status)');
      if (!test4aPass) console.log('  • Verification failure (failed status)');
      if (!test4bPass) console.log('  • Data protection on failed verification');
    }

    if (!test6Pass) {
      console.log('\n⚠️  PARTIAL NAME HANDLING:');
      console.log('  Currently treats partial name as mismatch.');
      console.log('  Recommendation: Ask user for full name instead of rejecting.');
    }

    console.log('');

  } catch (error) {
    console.error('\n✗ ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testHappyPath();

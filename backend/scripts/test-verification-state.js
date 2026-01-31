import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testVerificationState() {
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
    const sessionId = 'test-verification-' + Date.now();

    console.log('--- REQUEST 1: Provide order number ---');
    const res1 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Sipariş numaram ORD-2024-001',
      sessionId
    });

    console.log('verificationStatus:', res1.data.verificationStatus || '✗ MISSING');
    console.log('Reply snippet:', res1.data.reply.substring(0, 100));

    console.log('\n--- REQUEST 2: Provide name ---');
    const res2 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Adım Ahmet Yılmaz',
      sessionId
    });

    console.log('verificationStatus:', res2.data.verificationStatus || '✗ MISSING');
    console.log('Reply snippet:', res2.data.reply.substring(0, 100));

    if (res2.data.verificationStatus === 'verified' || res2.data.verificationStatus === 'pending') {
      console.log('\n✓ PASS: Verification status tracked');
    } else if (res2.data.verificationStatus === 'none') {
      console.log('\n✗ FAIL: Verification status not changing from "none"');
    } else {
      console.log('\n? Status:', res2.data.verificationStatus);
    }

  } catch (error) {
    console.error('ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testVerificationState();

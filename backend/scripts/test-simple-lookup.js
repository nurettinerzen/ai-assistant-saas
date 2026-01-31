import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testSimpleLookup() {
  try {
    const business = await prisma.business.findUnique({
      where: { id: 1 },
      include: { assistants: { where: { isActive: true }, take: 1 } }
    });

    const assistantId = business.assistants[0].id;
    const sessionId = 'test-simple-lookup-' + Date.now();

    console.log('--- TEST: Just order number, NO name ---');
    const res = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'ORD-2024-001 siparişimi sorgula',
      sessionId
    });

    console.log('\nReply:', res.data.reply);
    console.log('\nverificationStatus:', res.data.verificationStatus || 'MISSING');
    console.log('conversationId:', res.data.conversationId || 'MISSING');

    // Check what the assistant is asking for
    const lowerReply = res.data.reply.toLowerCase();
    if (lowerReply.includes('ad') && lowerReply.includes('soyad')) {
      console.log('\n✓ Assistant asking for name (expected for verification)');
      if (res.data.verificationStatus === 'pending') {
        console.log('✓✓ PASS: verificationStatus is "pending"');
      } else {
        console.log('✗ FAIL: verificationStatus should be "pending" but got:', res.data.verificationStatus);
      }
    } else {
      console.log('\n? Response unexpected');
    }

  } catch (error) {
    console.error('ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSimpleLookup();

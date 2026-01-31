import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testTwoStep() {
  try {
    const business = await prisma.business.findUnique({
      where: { id: 1 },
      include: { assistants: { where: { isActive: true }, take: 1 } }
    });

    const assistantId = business.assistants[0].id;
    const sessionId = 'test-two-step-' + Date.now();

    console.log('STEP 1: Provide order number\n');
    const res1 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'ORD-2024-001 siparişimi sorgula',
      sessionId
    });

    console.log('Response 1:');
    console.log('  verificationStatus:', res1.data.verificationStatus);
    console.log('  Reply:', res1.data.reply.substring(0, 100));
    console.log('');

    console.log('STEP 2: Provide correct name\n');
    const res2 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Ahmet Yılmaz',
      sessionId
    });

    console.log('Response 2:');
    console.log('  verificationStatus:', res2.data.verificationStatus);
    console.log('  Reply:', res2.data.reply.substring(0, 200));
    console.log('');

    if (res2.data.verificationStatus === 'verified') {
      console.log('✓✓ SUCCESS: Verification completed!');
    } else {
      console.log('✗ FAIL: Expected verified, got:', res2.data.verificationStatus);
    }

  } catch (error) {
    console.error('ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTwoStep();

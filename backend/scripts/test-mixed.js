import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testMixed() {
  try {
    const business = await prisma.business.findUnique({
      where: { id: 1 },
      include: { assistants: { where: { isActive: true }, take: 1 } }
    });

    const assistantId = business.assistants[0].id;
    const sessionId = 'test-mixed-' + Date.now();

    console.log('Testing mixed credentials: Order1 + Name2\n');

    const res = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId,
      message: 'Sipariş numaram ORD-2024-001, adım Ayşe Demir',
      sessionId
    });

    console.log('Response:', res.data.reply);
    console.log('\nContains mismatch keyword:', res.data.reply.toLowerCase().includes('eşleşm'));

  } catch (error) {
    console.error('ERROR:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testMixed();

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testChatLookup() {
  try {
    // Get assistant ID
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

    // Test chat lookup for ORD-2024-001
    console.log('\n--- CHAT WIDGET LOOKUP TEST ---');
    const testMessage = 'Sipariş numaram ORD-2024-001';

    const chatRes = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId: assistantId,
      message: testMessage,
      sessionId: 'test-seed-verification-' + Date.now()
    });

    console.log('User:', testMessage);
    console.log('Assistant:', chatRes.data.reply.substring(0, 200) + '...');
    console.log('conversationId:', chatRes.data.conversationId || '✗ MISSING');

    // Check if response mentions order not found
    const lowerReply = chatRes.data.reply.toLowerCase();
    if (lowerReply.includes('bulunamadı') || lowerReply.includes('bulunamadi')) {
      console.log('\n✗ FAIL: Order not found in chat response');
    } else if (lowerReply.includes('ad') && lowerReply.includes('soyad')) {
      console.log('\n✓ PASS: Assistant asking for verification (expected behavior)');
    } else {
      console.log('\n? UNKNOWN: Response does not clearly indicate found/not-found');
    }

  } catch (error) {
    console.error('ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testChatLookup();

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testConversationId() {
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

    const sessionId = 'test-conversation-id-' + Date.now();

    // Request 1
    console.log('\n--- REQUEST 1 ---');
    const res1 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId: assistantId,
      message: 'Merhaba',
      sessionId: sessionId
    });

    console.log('conversationId:', res1.data.conversationId || '✗ MISSING');
    console.log('sessionId:', res1.data.sessionId || '✗ MISSING');

    if (!res1.data.conversationId) {
      console.log('\n✗ FAIL: conversationId not returned');
      return;
    }

    const conversationId1 = res1.data.conversationId;

    // Request 2 - same session
    console.log('\n--- REQUEST 2 (same session) ---');
    const res2 = await axios.post('http://localhost:3001/api/chat/widget', {
      assistantId: assistantId,
      message: 'Nasılsın?',
      sessionId: sessionId
    });

    console.log('conversationId:', res2.data.conversationId || '✗ MISSING');

    if (res2.data.conversationId === conversationId1) {
      console.log('✓ PASS: conversationId persisted across requests');
    } else {
      console.log('✗ FAIL: conversationId changed:', conversationId1, '->', res2.data.conversationId);
    }

  } catch (error) {
    console.error('ERROR:', error.response?.status, error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConversationId();

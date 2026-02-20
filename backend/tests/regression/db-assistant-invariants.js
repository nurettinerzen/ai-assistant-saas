import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function printResult(status, id, detail) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${status} ${id} - ${detail}`);
}

async function main() {
  const failures = [];

  const textWithElevenLabs = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'text',
      elevenLabsAgentId: { not: null }
    },
    select: { id: true, businessId: true, name: true, elevenLabsAgentId: true },
    take: 20
  });

  if (textWithElevenLabs.length === 0) {
    printResult('PASS', 'TEXT_NO_11LABS', 'Active text assistants have null elevenLabsAgentId');
  } else {
    printResult('FAIL', 'TEXT_NO_11LABS', `${textWithElevenLabs.length} active text assistant has elevenLabsAgentId`);
    failures.push({ id: 'TEXT_NO_11LABS', sample: textWithElevenLabs });
  }

  const textWithVoice = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'text',
      voiceId: { not: null }
    },
    select: { id: true, businessId: true, name: true, voiceId: true },
    take: 20
  });

  if (textWithVoice.length === 0) {
    printResult('PASS', 'TEXT_NO_VOICE', 'Active text assistants have null voiceId');
  } else {
    printResult('FAIL', 'TEXT_NO_VOICE', `${textWithVoice.length} active text assistant has voiceId`);
    failures.push({ id: 'TEXT_NO_VOICE', sample: textWithVoice });
  }

  const phoneActiveNoVoice = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'phone',
      voiceId: null
    },
    select: { id: true, businessId: true, name: true, callDirection: true, voiceId: true },
    take: 20
  });

  if (phoneActiveNoVoice.length === 0) {
    printResult('PASS', 'PHONE_ACTIVE_HAS_VOICE', 'Active phone assistants have voiceId');
  } else {
    printResult('FAIL', 'PHONE_ACTIVE_HAS_VOICE', `${phoneActiveNoVoice.length} active phone assistant has null voiceId`);
    failures.push({ id: 'PHONE_ACTIVE_HAS_VOICE', sample: phoneActiveNoVoice });
  }

  const textWithoutChatCapability = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'text',
      NOT: {
        channelCapabilities: { has: 'chat' }
      }
    },
    select: { id: true, businessId: true, name: true, channelCapabilities: true },
    take: 20
  });

  if (textWithoutChatCapability.length === 0) {
    printResult('PASS', 'TEXT_HAS_CHAT_CAPABILITY', 'Active text assistants include chat capability');
  } else {
    printResult('FAIL', 'TEXT_HAS_CHAT_CAPABILITY', `${textWithoutChatCapability.length} active text assistant lacks chat capability`);
    failures.push({ id: 'TEXT_HAS_CHAT_CAPABILITY', sample: textWithoutChatCapability });
  }

  const outboundPhoneWithoutOutboundCapability = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'phone',
      callDirection: { startsWith: 'outbound' },
      NOT: {
        channelCapabilities: { has: 'phone_outbound' }
      }
    },
    select: { id: true, businessId: true, name: true, callDirection: true, channelCapabilities: true },
    take: 20
  });

  if (outboundPhoneWithoutOutboundCapability.length === 0) {
    printResult('PASS', 'PHONE_OUTBOUND_CAPABILITY', 'Outbound phone assistants include phone_outbound capability');
  } else {
    printResult('FAIL', 'PHONE_OUTBOUND_CAPABILITY', `${outboundPhoneWithoutOutboundCapability.length} outbound phone assistant lacks phone_outbound`);
    failures.push({ id: 'PHONE_OUTBOUND_CAPABILITY', sample: outboundPhoneWithoutOutboundCapability });
  }

  const phoneWithChatCapability = await prisma.assistant.findMany({
    where: {
      isActive: true,
      assistantType: 'phone',
      channelCapabilities: { has: 'chat' }
    },
    select: { id: true, businessId: true, name: true, callDirection: true, channelCapabilities: true },
    take: 20
  });

  if (phoneWithChatCapability.length === 0) {
    printResult('PASS', 'PHONE_CHAT_MIX', 'No active phone assistant has chat capability');
  } else {
    printResult('FAIL', 'PHONE_CHAT_MIX', `${phoneWithChatCapability.length} active phone assistant has chat capability (selection risk)`);
    failures.push({ id: 'PHONE_CHAT_MIX', sample: phoneWithChatCapability });
  }

  if (failures.length > 0) {
    console.log('\n--- FAIL SAMPLES ---');
    for (const fail of failures) {
      console.log(`${fail.id}:`);
      console.log(JSON.stringify(fail.sample, null, 2));
    }
    process.exitCode = 1;
  } else {
    console.log('\nAll assistant/channel invariants passed.');
  }
}

main()
  .catch((error) => {
    console.error('Invariant check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

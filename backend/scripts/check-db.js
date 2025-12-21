import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('=== Database Phone Numbers ===\n');

  const phones = await prisma.phoneNumber.findMany({
    include: {
      assistant: {
        select: { id: true, name: true, elevenLabsAgentId: true, vapiAssistantId: true }
      }
    }
  });

  if (phones.length === 0) {
    console.log('No phone numbers found in database.');
  } else {
    phones.forEach(p => {
      console.log(`Phone: ${p.phoneNumber}`);
      console.log(`  DB ID: ${p.id}`);
      console.log(`  Provider: ${p.provider}`);
      console.log(`  elevenLabsPhoneId: ${p.elevenLabsPhoneId || 'NULL'}`);
      console.log(`  vapiPhoneId: ${p.vapiPhoneId || 'NULL'}`);
      console.log(`  Assistant: ${p.assistant?.name || 'None'}`);
      console.log(`    - elevenLabsAgentId: ${p.assistant?.elevenLabsAgentId || 'NULL'}`);
      console.log(`    - vapiAssistantId: ${p.assistant?.vapiAssistantId || 'NULL'}`);
      console.log('');
    });
  }

  console.log('\n=== Assistants with 11Labs ===\n');

  const assistants = await prisma.assistant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, elevenLabsAgentId: true, vapiAssistantId: true, voiceProvider: true }
  });

  assistants.forEach(a => {
    console.log(`${a.name}`);
    console.log(`  DB ID: ${a.id}`);
    console.log(`  voiceProvider: ${a.voiceProvider}`);
    console.log(`  elevenLabsAgentId: ${a.elevenLabsAgentId || 'NULL'}`);
    console.log(`  vapiAssistantId: ${a.vapiAssistantId || 'NULL'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

check();

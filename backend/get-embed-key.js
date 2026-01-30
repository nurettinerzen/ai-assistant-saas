import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getEmbedKeys() {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      chatEmbedKey: true
    }
  });

  console.log('\n📋 Business Embed Keys:\n');
  businesses.forEach(b => {
    console.log(`Business: ${b.name} (ID: ${b.id})`);
    console.log(`Chat Embed Key: ${b.chatEmbedKey}\n`);
  });

  await prisma.$disconnect();
}

getEmbedKeys();

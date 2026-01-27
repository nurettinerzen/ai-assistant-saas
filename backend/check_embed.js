import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEmbedKeys() {
  const embedKeys = [
    'emb_7c19b280dc26ef65274c35cccb5a050b',
    'emb_e8e0f9cd48b9a5cd37d83b66c4dbe273'
  ];

  for (const key of embedKeys) {
    const business = await prisma.business.findUnique({
      where: { embedKey: key },
      select: { id: true, name: true, email: true, businessType: true }
    });

    console.log(`\n📍 Embed Key: ${key}`);
    if (business) {
      console.log(`   ✅ Business: ${business.name}`);
      console.log(`   📧 Email: ${business.email}`);
      console.log(`   🏢 Type: ${business.businessType}`);
    } else {
      console.log(`   ❌ Not found in database`);
    }
  }

  await prisma.$disconnect();
}

checkEmbedKeys();

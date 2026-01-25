import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findFirst({
    include: {
      assistants: { where: { isActive: true }, take: 1 }
    }
  });

  console.log('Business:', business?.name);
  console.log('Type:', business?.businessType);
  console.log('ID:', business?.id);
  console.log('Assistant ID:', business?.assistants[0]?.id);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });

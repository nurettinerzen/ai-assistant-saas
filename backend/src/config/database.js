/**
 * Database Configuration
 *
 * Centralized Prisma client export
 * Use this instead of creating new PrismaClient() instances
 */

import { PrismaClient } from '@prisma/client';

// Single Prisma instance (connection pooling)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
export { prisma };

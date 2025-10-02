import { PrismaClient } from '../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Connection pool configuration for serverless environments
  // Prevents connection exhaustion in Vercel/serverless functions
  transactionOptions: {
    maxWait: 5000, // 5 seconds
    timeout: 10000, // 10 seconds
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 
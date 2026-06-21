import { PrismaClient } from "@prisma/client";
import { getPrismaLogLevels } from "@/lib/db-config";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  // Runtime uses DATABASE_URL (pooler in production).
  // For Prisma Accelerate: set PRISMA_ACCELERATE_URL, install
  // @prisma/extension-accelerate, and extend the client — see .env.example.
  return new PrismaClient({
    log: getPrismaLogLevels(),
  });
}

function getOrCreatePrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Shared Prisma client for the entire application.
 * Cached on globalThis so each serverless instance reuses one pool.
 * Do not call $disconnect() in API routes or page handlers.
 */
export const db = getOrCreatePrismaClient();

export type { PrismaClient };

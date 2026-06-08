import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: ["error", "warn"],
  });
}

function isStalePrismaClient(client: PrismaClient | undefined): client is undefined {
  return (
    !client ||
    !("customerGroup" in client) ||
    !("warehouse" in client) ||
    !("warehouseStock" in client) ||
    !("warehouseTransfer" in client)
  );
}

const cached = globalForPrisma.prisma;
export const db: PrismaClient = isStalePrismaClient(cached)
  ? createPrismaClient()
  : cached;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type { PrismaClient };

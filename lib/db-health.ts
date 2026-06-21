import { db } from "@/lib/prisma";

export type DbHealthResult = {
  success: boolean;
  latencyMs: number;
  poolerConfigured: boolean;
  accelerateConfigured: boolean;
};

export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  const startedAt = Date.now();

  await db.$queryRaw`SELECT 1`;

  return {
    success: true,
    latencyMs: Date.now() - startedAt,
    poolerConfigured: isPoolerConfigured(),
    accelerateConfigured: Boolean(process.env.PRISMA_ACCELERATE_URL?.trim()),
  };
}

function isPoolerConfigured() {
  const url = (process.env.DATABASE_URL ?? "").toLowerCase();
  return (
    url.includes("pooler") ||
    url.includes("pgbouncer=true") ||
    url.includes(":6543/") ||
    url.includes("prisma://")
  );
}

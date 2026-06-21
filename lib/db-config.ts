/**
 * Database connection configuration helpers.
 *
 * Runtime (serverless): DATABASE_URL should point to a pooler (Supabase Supavisor,
 * pgBouncer, or Prisma Accelerate) with a low connection_limit (typically 1).
 *
 * Migrations / Prisma CLI: DIRECT_URL should point to direct Postgres (port 5432).
 */

export const DB_UNAVAILABLE_MESSAGE =
  "Sunucu yoğunluğu nedeniyle işlem tamamlanamadı. Lütfen tekrar deneyin.";

const CONNECTION_ERROR_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server closed the connection
  "P2024", // Connection pool timeout
]);

export function isPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;

  if (code && CONNECTION_ERROR_CODES.has(code)) {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    message.includes("connection pool") ||
    message.includes("timed out") ||
    message.includes("too many connections") ||
    message.includes("econnrefused") ||
    message.includes("can't reach database")
  );
}

export function mapDbErrorToApiResponse(error: unknown) {
  if (!isPrismaConnectionError(error)) {
    return null;
  }

  return {
    success: false as const,
    message: DB_UNAVAILABLE_MESSAGE,
    status: 503 as const,
  };
}

export function isAccelerateEnabled() {
  return Boolean(process.env.PRISMA_ACCELERATE_URL?.trim());
}

export function isPoolerDatabaseUrl(url?: string) {
  const value = (url ?? process.env.DATABASE_URL ?? "").toLowerCase();

  return (
    value.includes("pooler") ||
    value.includes("pgbouncer=true") ||
    value.includes(":6543/") ||
    value.includes("prisma://") ||
    value.includes("prisma+postgres://")
  );
}

export function getPrismaLogLevels(): Array<"query" | "error" | "warn"> {
  if (process.env.NODE_ENV === "development") {
    return ["error", "warn"];
  }

  return ["error"];
}

export function resolveHealthCheckSecret() {
  return (
    process.env.DB_HEALTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

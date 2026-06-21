import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { db } from "@/lib/prisma";

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 25;

export function isRetryableTransactionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String(error.code) : "";
  if (code === "P2034" || code === "P2028") {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    message.includes("deadlock") ||
    message.includes("could not serialize") ||
    message.includes("serialization failure")
  );
}

export function isPrismaUniqueConstraintError(
  error: unknown,
  target?: string
) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  if (!target) {
    return true;
  }

  const meta =
    "meta" in error && error.meta && typeof error.meta === "object"
      ? error.meta
      : null;

  const targetValue =
    meta && "target" in meta
      ? Array.isArray(meta.target)
        ? meta.target.join("_")
        : String(meta.target)
      : "";

  return targetValue.includes(target);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TransactionCallback<T> = (
  tx: Prisma.TransactionClient
) => Promise<T>;

type RunTransactionOptions = {
  maxAttempts?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

export async function runTransactionWithRetry<T>(
  callback: TransactionCallback<T>,
  options: RunTransactionOptions = {}
) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const isolationLevel =
    options.isolationLevel ??
    PrismaNamespace.TransactionIsolationLevel.Serializable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction(callback, {
        isolationLevel,
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableTransactionError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(BASE_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

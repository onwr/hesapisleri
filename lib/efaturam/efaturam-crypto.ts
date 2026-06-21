import {
  decryptMarketplaceCredentials,
  encryptMarketplaceCredentials,
} from "@/lib/marketplace/marketplace-crypto";
import type { EfaturamStoredCredentials } from "@/lib/efaturam/efaturam-types";

export function encryptEfaturamCredentials(data: EfaturamStoredCredentials) {
  return encryptMarketplaceCredentials(data);
}

export function decryptEfaturamCredentials(
  value: string | null | undefined
): EfaturamStoredCredentials | null {
  if (!value) return null;
  return decryptMarketplaceCredentials<EfaturamStoredCredentials>(value);
}

export function isEfaturamTokenExpired(expiresAt?: Date | string | null) {
  if (!expiresAt) return false;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now() + 60_000;
}

export function resolveTokenExpiry(expiresInSeconds?: number) {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) {
    return new Date(Date.now() + 55 * 60_000);
  }
  return new Date(Date.now() + Math.max(60, expiresInSeconds - 60) * 1000);
}

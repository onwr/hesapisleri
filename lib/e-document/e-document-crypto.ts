import {
  decryptMarketplaceCredentials,
  encryptMarketplaceCredentials,
} from "@/lib/marketplace/marketplace-crypto";

export function encryptEDocumentCredentials(data: unknown) {
  return encryptMarketplaceCredentials(data);
}

export function decryptEDocumentCredentials<T>(value: string | null | undefined) {
  if (!value) return null;
  return decryptMarketplaceCredentials<T>(value);
}

export function maskSecretUsername(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const username = value.trim();
  const atIndex = username.indexOf("@");
  if (atIndex > 0) {
    const local = username.slice(0, atIndex);
    const domain = username.slice(atIndex + 1);
    const maskedLocal =
      local.length <= 1 ? "*" : `${local.slice(0, 1)}${"*".repeat(Math.min(3, local.length - 1))}`;
    return `${maskedLocal}@${domain}`;
  }
  return username.length <= 2
    ? "**"
    : `${username.slice(0, 1)}${"*".repeat(Math.min(3, username.length - 1))}`;
}

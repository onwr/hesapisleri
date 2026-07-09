import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getIntegrationKey() {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY ?? "";
  const keyBuffer = Buffer.from(key, "utf8");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY 32 byte uzunluğunda olmalıdır."
    );
  }
  return keyBuffer;
}

export function encryptMarketplaceCredentials(data: unknown): string {
  const key = getIntegrationKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const payload = JSON.stringify(data ?? {});
  const encrypted = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptMarketplaceCredentials<T>(value: string): T {
  const key = getIntegrationKey();
  const [ivEncoded, authTagEncoded, encryptedEncoded] = value.split(":");
  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Şifreli entegrasyon verisi biçimi geçersiz.");
  }

  const iv = Buffer.from(ivEncoded, "base64");
  const authTag = Buffer.from(authTagEncoded, "base64");
  const encrypted = Buffer.from(encryptedEncoded, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function assertIntegrationEncryptionConfigured() {
  try {
    getIntegrationKey();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      throw error;
    }
    throw new Error("Entegrasyon şifreleme anahtarı yapılandırılmamış.");
  }
}

export function isIntegrationEncryptionConfigured() {
  try {
    getIntegrationKey();
    return true;
  } catch {
    return false;
  }
}

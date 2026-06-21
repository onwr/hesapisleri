import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getPaymentTokenKey() {
  const key = process.env.PAYMENT_TOKEN_ENCRYPTION_KEY ?? "";
  const keyBuffer = Buffer.from(key, "utf8");

  if (keyBuffer.length !== 32) {
    throw new Error("PAYMENT_TOKEN_ENCRYPTION_KEY 32 byte uzunluğunda olmalıdır.");
  }

  return keyBuffer;
}

export function assertPaymentTokenEncryptionConfigured() {
  getPaymentTokenKey();
}

export function encryptPaymentToken(token: string) {
  if (!token) {
    throw new Error("Boş ödeme tokenı şifrelenemez.");
  }

  const key = getPaymentTokenKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptPaymentToken(value: string) {
  const key = getPaymentTokenKey();
  const [ivEncoded, authTagEncoded, encryptedEncoded] = value.split(":");

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Şifreli ödeme tokenı biçimi geçersiz.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivEncoded, "base64"));
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function fingerprintPaymentToken(token: string) {
  if (!token) {
    throw new Error("Boş token fingerprint üretilemez.");
  }

  return createHash("sha256").update(token).digest("hex");
}

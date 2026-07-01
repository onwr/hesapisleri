import crypto from "node:crypto";
import { SipayHashError } from "./sipay-errors";

const IV_BYTES = 16;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export type HashEntropy = {
  iv: Buffer;
  salt: Buffer;
};

const TEST_ENTROPY: HashEntropy = {
  iv: Buffer.alloc(IV_BYTES, 0x11),
  salt: Buffer.alloc(SALT_BYTES, 0x22),
};

function buildAesKey(appSecret: string): Buffer {
  const keyBuf = Buffer.alloc(KEY_BYTES, 0);
  Buffer.from(appSecret, "utf8").copy(keyBuf, 0, 0, KEY_BYTES);
  return keyBuf;
}

function parseHashComponents(hashKey: string): { iv: Buffer; salt: Buffer; ciphertext: Buffer } {
  const normalized = hashKey.replace(/__/g, "/");
  const parts = normalized.split(":");
  if (parts.length !== 3) {
    throw new SipayHashError("Malformed hash component count");
  }

  const [ivPart, saltPart, cipherPart] = parts;
  if (!ivPart || !saltPart || !cipherPart) {
    throw new SipayHashError("Malformed hash components");
  }

  let iv: Buffer;
  let salt: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivPart, "base64");
    salt = Buffer.from(saltPart, "base64");
    ciphertext = Buffer.from(cipherPart, "base64");
  } catch {
    throw new SipayHashError("Invalid base64 in hash");
  }

  if (iv.length !== IV_BYTES) {
    throw new SipayHashError("Invalid IV length");
  }
  if (salt.length !== SALT_BYTES) {
    throw new SipayHashError("Invalid salt length");
  }
  if (ciphertext.length === 0) {
    throw new SipayHashError("Truncated ciphertext");
  }

  return { iv, salt, ciphertext };
}

function toUrlSafeHash(hash: string): string {
  return hash.replace(/\//g, "__");
}

export function encryptAES256CBC(
  data: string,
  appSecret: string,
  entropy?: HashEntropy,
): string {
  const iv = entropy?.iv ?? crypto.randomBytes(IV_BYTES);
  const salt = entropy?.salt ?? crypto.randomBytes(SALT_BYTES);
  const key = buildAesKey(appSecret);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const raw = [iv.toString("base64"), salt.toString("base64"), encrypted.toString("base64")].join(
    ":",
  );
  return toUrlSafeHash(raw);
}

export function decryptAES256CBC(hashKey: string, appSecret: string): string {
  const { iv, ciphertext } = parseHashComponents(hashKey);
  const key = buildAesKey(appSecret);
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new SipayHashError("Invalid padding or ciphertext");
  }
}

// Purchase/link: app_id + invoice_id + total + currency_code + cancel_url + return_url
export function buildPurchaseHashPlaintext(params: {
  appId: string;
  invoiceId: string;
  total: string;
  currencyCode: string;
  cancelUrl: string;
  returnUrl: string;
}): string {
  return [
    params.appId,
    params.invoiceId,
    params.total,
    params.currencyCode,
    params.cancelUrl,
    params.returnUrl,
  ].join("");
}

export function generatePurchaseHash(params: {
  appId: string;
  invoiceId: string;
  total: string;
  currencyCode: string;
  cancelUrl: string;
  returnUrl: string;
  appSecret: string;
  entropy?: HashEntropy;
}): string {
  const data = buildPurchaseHashPlaintext(params);
  return encryptAES256CBC(data, params.appSecret, params.entropy);
}

// Checkstatus: invoice_id + merchant_key + app_secret
export function buildCheckStatusHashPlaintext(params: {
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
}): string {
  return [params.invoiceId, params.merchantKey, params.appSecret].join("");
}

export function generateCheckStatusHash(params: {
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
  entropy?: HashEntropy;
}): string {
  const data = buildCheckStatusHashPlaintext(params);
  return encryptAES256CBC(data, params.appSecret, params.entropy);
}

// Refund: amount + invoice_id + merchant_key + app_secret
export function buildRefundHashPlaintext(params: {
  amount: string;
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
}): string {
  return [params.amount, params.invoiceId, params.merchantKey, params.appSecret].join("");
}

export function generateRefundHash(params: {
  amount: string;
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
  entropy?: HashEntropy;
}): string {
  const data = buildRefundHashPlaintext(params);
  return encryptAES256CBC(data, params.appSecret, params.entropy);
}

// Return callback: invoice_id + merchant_key (Sipay imzalar)
export function buildReturnHashPlaintext(params: {
  invoiceId: string;
  merchantKey: string;
}): string {
  return [params.invoiceId, params.merchantKey].join("");
}

export function validateReturnHash(params: {
  hashKey: string;
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
}): boolean {
  try {
    const decrypted = decryptAES256CBC(params.hashKey, params.appSecret);
    const expected = buildReturnHashPlaintext({
      invoiceId: params.invoiceId,
      merchantKey: params.merchantKey,
    });
    const dec = Buffer.from(decrypted, "utf8");
    const exp = Buffer.from(expected, "utf8");
    if (dec.length !== exp.length) return false;
    return crypto.timingSafeEqual(dec, exp);
  } catch {
    return false;
  }
}

// Webhook: invoice_id + order_no + status (sale_web_hook_key ile)
export function buildWebhookHashPlaintext(params: {
  invoiceId: string;
  orderNo: string;
  status: string;
}): string {
  return [params.invoiceId, params.orderNo, params.status].join("");
}

export function validateWebhookHash(params: {
  hashKey: string;
  invoiceId: string;
  orderNo: string;
  status: string;
  webhookKey: string;
}): boolean {
  try {
    const decrypted = decryptAES256CBC(params.hashKey, params.webhookKey);
    const expected = buildWebhookHashPlaintext({
      invoiceId: params.invoiceId,
      orderNo: params.orderNo,
      status: params.status,
    });
    const dec = Buffer.from(decrypted, "utf8");
    const exp = Buffer.from(expected, "utf8");
    if (dec.length !== exp.length) return false;
    return crypto.timingSafeEqual(dec, exp);
  } catch {
    return false;
  }
}

export function assertValidReturnHash(params: {
  hashKey: string | undefined;
  invoiceId: string;
  merchantKey: string;
  appSecret: string;
}): void {
  if (!params.hashKey) throw new SipayHashError("Missing hash_key in return params");
  if (
    !validateReturnHash(
      params as { hashKey: string; invoiceId: string; merchantKey: string; appSecret: string },
    )
  ) {
    throw new SipayHashError("Return hash validation failed");
  }
}

export function assertValidWebhookHash(params: {
  hashKey: string;
  invoiceId: string;
  orderNo: string;
  status: string;
  webhookKey: string;
}): void {
  if (!validateWebhookHash(params)) {
    throw new SipayHashError("Webhook hash validation failed");
  }
}

/** Test-only deterministic entropy injection */
export function _testEncrypt(data: string, secret: string): string {
  return encryptAES256CBC(data, secret, TEST_ENTROPY);
}

export function _testDecrypt(hash: string, secret: string): string {
  return decryptAES256CBC(hash, secret);
}

export function _testEncryptWithEntropy(
  data: string,
  secret: string,
  entropy: HashEntropy,
): string {
  return encryptAES256CBC(data, secret, entropy);
}

export function _getTestEntropy(): HashEntropy {
  return { iv: Buffer.from(TEST_ENTROPY.iv), salt: Buffer.from(TEST_ENTROPY.salt) };
}

export function _parseHashComponentsForTest(hashKey: string) {
  return parseHashComponents(hashKey);
}

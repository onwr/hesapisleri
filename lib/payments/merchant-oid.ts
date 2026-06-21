import "server-only";

import { randomBytes } from "node:crypto";

const OID_PREFIX = "HI";
const MAX_PAYTR_MERCHANT_OID_LENGTH = 64;

function compactDate(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generatePaytrMerchantOid(date = new Date()) {
  const random = randomBytes(9).toString("hex").toUpperCase();
  const value = `${OID_PREFIX}${compactDate(date)}${random}`;

  if (!/^[A-Z0-9]+$/.test(value)) {
    throw new Error("merchant_oid yalnız alfanümerik olmalıdır.");
  }

  if (value.length > MAX_PAYTR_MERCHANT_OID_LENGTH) {
    throw new Error("merchant_oid PayTR limitini aşıyor.");
  }

  return value;
}

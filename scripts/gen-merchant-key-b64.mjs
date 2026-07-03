import { readFileSync } from "node:fs";
import { encodeMerchantKeyToBase64 } from "../lib/payments/sipay/sipay-env.ts";

const argKey = process.argv[2];
let key = argKey ?? "";

if (!key) {
  try {
    const env = readFileSync(".env", "utf8");
    const quoted = env.match(/SIPAY_MERCHANT_KEY="([^"]+)"/);
    const b64Line = env.match(/^SIPAY_MERCHANT_KEY_B64=(.+)$/m);
    if (b64Line?.[1]?.trim()) {
      key = Buffer.from(b64Line[1].trim(), "base64").toString("utf8");
    } else if (quoted?.[1]) {
      key = quoted[1];
    }
  } catch {
    // ignore
  }
}

if (!key) {
  console.error("Kullanım: node scripts/gen-merchant-key-b64.mjs \"$2y$10$...\"");
  console.error("veya .env içinde SIPAY_MERCHANT_KEY tanımlı olmalı.");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      length: key.length,
      bcryptPrefix: key.startsWith("$2y$10$"),
      SIPAY_MERCHANT_KEY_B64: encodeMerchantKeyToBase64(key),
    },
    null,
    2,
  ),
);

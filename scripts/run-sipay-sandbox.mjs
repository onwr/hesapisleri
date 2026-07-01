/**
 * Sipay Sandbox Smoke Scripti
 *
 * Gerçek Sipay test ortamına bağlanarak temel API akışını doğrular:
 *   1. Token alma
 *   2. is_3d yetkinlik kontrolü
 *   3. Purchase/link oluşturma
 *   4. checkstatus çağrısı (yeni invoice → NOT_PAID beklenir)
 *   5. Hash doğrulama fixture'ları
 *
 * Çalıştır:
 *   npm run test:sipay-sandbox
 *   veya:
 *   node --import tsx scripts/run-sipay-sandbox.mjs
 *
 * Gerekli ortam değişkenleri (SIPAY_ENV=test için):
 *   SIPAY_ENABLED=true
 *   SIPAY_ENV=test
 *   SIPAY_APP_ID=...
 *   SIPAY_APP_SECRET=...
 *   SIPAY_MERCHANT_KEY=...
 *   SIPAY_MERCHANT_ID=...
 *   SIPAY_SALE_WEBHOOK_KEY=...
 *   SIPAY_RETURN_URL=https://hesapisleri.com/api/billing/sipay/return
 *   SIPAY_CANCEL_URL=https://hesapisleri.com/api/billing/sipay/cancel
 *
 * DİKKAT: Gerçek kart işlemi yapmaz. Yalnızca link oluşturur ve status sorgular.
 * Live ortama KESİNLİKLE bağlanmaz.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

// tsx loader — TypeScript desteği
try {
  register("tsx/esm", import.meta.url);
} catch {
  // tsx zaten yüklü
}

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Ortam doğrulama ─────────────────────────────────────────────────────────
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    return null;
  }
  return v;
}

if (process.env.SIPAY_SANDBOX_TEST !== "1") {
  console.log("[SIPAY-SMOKE] SKIP: yalnızca SIPAY_SANDBOX_TEST=1 ile çalışır.");
  process.exit(0);
}

const sipayEnv = process.env.SIPAY_ENV ?? "test";
if (sipayEnv === "live") {
  console.error("[SIPAY-SMOKE] HATA: Bu script live ortamda çalıştırılamaz (SIPAY_ENV=live).");
  process.exit(1);
}

if (process.env.SIPAY_ENABLED !== "true") {
  console.warn("[SIPAY-SMOKE] SIPAY_ENABLED=true değil — atlanıyor.");
  process.exit(0);
}

const appId = requireEnv("SIPAY_APP_ID");
const appSecret = requireEnv("SIPAY_APP_SECRET");
const merchantKey = requireEnv("SIPAY_MERCHANT_KEY");
const merchantId = requireEnv("SIPAY_MERCHANT_ID");
const webhookKey = requireEnv("SIPAY_SALE_WEBHOOK_KEY") ?? "";

if (!appId || !appSecret || !merchantKey || !merchantId) {
  console.log("[SIPAY-SMOKE] SKIP: sandbox credential eksik.");
  process.exit(0);
}

const merchantMeta = {
  present: merchantKey.length > 0,
  length: merchantKey.length,
  bcryptPrefix: merchantKey.startsWith("$2y$10$"),
};
console.log("[SIPAY-SMOKE] Merchant key metadata:", merchantMeta);

const baseUrl = process.env.SIPAY_BASE_URL || "https://provisioning.sipay.com.tr";
const returnUrl =
  process.env.SIPAY_RETURN_URL || "http://localhost:3000/api/billing/sipay/return";
const cancelUrl =
  process.env.SIPAY_CANCEL_URL || "http://localhost:3000/api/billing/sipay/cancel";

console.log("[SIPAY-SMOKE] Ortam:", sipayEnv);
console.log("[SIPAY-SMOKE] Base URL:", baseUrl);

// ─── Çalışma zamanı içe aktarma ──────────────────────────────────────────────
// tsx ile dinamik import — TypeScript dosyaları doğrudan okunur

let sipayPostToken, sipayPost;
let generatePurchaseHash, generateCheckStatusHash, _testEncrypt, _testDecrypt;
let generateRefundHash;
let buildSipayPurchaseLinkBody;

async function loadModules() {
  const clientMod = await import(join(webRoot, "lib/payments/sipay/sipay-client.ts"));
  sipayPostToken = clientMod.sipayPostToken;
  sipayPost = clientMod.sipayPost;

  const hashMod = await import(join(webRoot, "lib/payments/sipay/sipay-hash.ts"));
  generatePurchaseHash = hashMod.generatePurchaseHash;
  generateCheckStatusHash = hashMod.generateCheckStatusHash;
  generateRefundHash = hashMod.generateRefundHash;
  _testEncrypt = hashMod._testEncrypt;
  _testDecrypt = hashMod._testDecrypt;

  const payloadMod = await import(join(webRoot, "lib/payments/sipay/sipay-purchase-payload.ts"));
  buildSipayPurchaseLinkBody = payloadMod.buildSipayPurchaseLinkBody;
}

// ─── Test yardımcısı ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log("✓");
    passed++;
  } catch (err) {
    console.log("✗");
    console.error(`    → ${err.message}`);
    failed++;
  }
}

await loadModules();

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--check" && cliArgs[1]) {
  const invoiceId = cliArgs[1];
  const hashKey = generateCheckStatusHash({ invoiceId, merchantKey, appSecret });
  const tokenRes = await sipayPostToken(baseUrl, "/ccpayment/api/token", {
    app_id: appId,
    app_secret: appSecret,
  });
  if (tokenRes.status_code !== 100 || !tokenRes.data?.token) {
    console.error("[SIPAY-SMOKE] Token alınamadı");
    process.exit(1);
  }
  const res = await sipayPost(
    baseUrl,
    "/ccpayment/api/checkstatus",
    { invoice_id: invoiceId, merchant_key: merchantKey, hashKey },
    tokenRes.data.token,
  );
  console.log("[SIPAY-SMOKE] checkstatus sonucu:");
  console.log(`  invoice_id=${invoiceId}`);
  console.log(`  status_code=${res.status_code}`);
  console.log(`  payment_status=${res.data?.payment_status ?? "n/a"}`);
  console.log(`  transaction_status=${res.data?.transaction_status ?? "n/a"}`);
  console.log(`  amount=${res.data?.transaction_amount ?? res.data?.product_price ?? "n/a"}`);
  console.log(`  order_id=${res.data?.order_id ?? res.data?.order_no ?? "n/a"}`);
  process.exit(0);
}

if (cliArgs[0] === "--refund" && cliArgs[1] && cliArgs[2]) {
  if (process.env.SIPAY_SANDBOX_REFUND !== "1") {
    console.log("[SIPAY-SMOKE] SKIP: SIPAY_SANDBOX_REFUND=1 gerekli");
    process.exit(0);
  }
  const invoiceId = cliArgs[1];
  const amount = Number(cliArgs[2]).toFixed(2);
  const tokenRes = await sipayPostToken(baseUrl, "/ccpayment/api/token", {
    app_id: appId,
    app_secret: appSecret,
  });
  const hashKey = generateRefundHash({
    amount,
    invoiceId,
    merchantKey,
    appSecret,
  });
  const res = await sipayPost(
    baseUrl,
    "/ccpayment/api/refund",
    {
      invoice_id: invoiceId,
      amount,
      reference_no: `SMOKE-REF-${Date.now()}`,
      hashKey,
    },
    tokenRes.data.token,
  );
  console.log(`[SIPAY-SMOKE] refund status_code=${res.status_code}`);
  process.exit(res.status_code === 100 ? 0 : 1);
}

// ─── Ana akış ────────────────────────────────────────────────────────────────

console.log("\n[SIPAY-SMOKE] Hash fixture doğrulaması (ağ gerektirmez)\n");

await test("AES-256-CBC round-trip", () => {
  const encrypted = _testEncrypt("test_data", appSecret);
  const decrypted = _testDecrypt(encrypted, appSecret);
  if (decrypted !== "test_data") throw new Error(`Beklenen 'test_data', alınan '${decrypted}'`);
});

await test("checkstatus hash data sırası: invoice_id + merchant_key + app_secret", () => {
  const hash = generateCheckStatusHash({ invoiceId: "SI-SMOKE-001", merchantKey, appSecret });
  const decrypted = _testDecrypt(hash, appSecret);
  const expected = `SI-SMOKE-001${merchantKey}${appSecret}`;
  if (decrypted !== expected) throw new Error(`Hash içeriği yanlış: '${decrypted}'`);
});

await test("purchase hash data sırası: app_id+invoice_id+total+currency+cancel+return", () => {
  const hash = generatePurchaseHash({
    appId,
    invoiceId: "SI-SMOKE-001",
    total: "99.90",
    currencyCode: "TRY",
    cancelUrl,
    returnUrl,
    appSecret,
  });
  const decrypted = _testDecrypt(hash, appSecret);
  const expected = `${appId}SI-SMOKE-001${"99.90"}TRY${cancelUrl}${returnUrl}`;
  if (decrypted !== expected) throw new Error(`Purchase hash içeriği yanlış: '${decrypted}'`);
});

await test("URL-safe base64 (__ → /) normalizasyon", () => {
  const data = "test__slash";
  const encrypted = _testEncrypt(data, appSecret);
  const urlSafe = encrypted.replace(/\//g, "__");
  const decrypted = _testDecrypt(urlSafe, appSecret);
  if (decrypted !== data) throw new Error(`URL-safe decode başarısız: '${decrypted}'`);
});

console.log("\n[SIPAY-SMOKE] Sipay sandbox API bağlantı testleri\n");

// 1. Token alma
let token;
let is3d;
await test("POST /ccpayment/api/token → status_code=100", async () => {
  const res = await sipayPostToken(baseUrl, "/ccpayment/api/token", {
    app_id: appId,
    app_secret: appSecret,
  });
  if (res.status_code !== 100) throw new Error(`Token hatası: ${res.status_code} — ${res.status_description}`);
  if (!res.data?.token) throw new Error("Token değeri boş");
  token = res.data.token;
  is3d = res.data.is_3d;
  console.log(`      is_3d=${is3d}, expires_at=${res.data.expires_at}`);
});

if (!token) {
  console.error("\n[SIPAY-SMOKE] Token alınamadı — kalan testler atlanıyor.");
  console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız`);
  process.exit(failed > 0 ? 1 : 0);
}

// 2. is_3d yetkinlik kontrolü
await test("is_3d ≥ 2 (BRANDED veya 3D_ONLY destekli)", () => {
  if (is3d < 2) throw new Error(`is_3d=${is3d} — BRANDED checkout desteklenmiyor`);
});

// 3. Purchase link oluşturma
const smokeInvoiceId = `SI-SMOKE-${Date.now()}`;
let checkoutLink;

await test(`POST /ccpayment/purchase/link (invoice: ${smokeInvoiceId})`, async () => {
  const body = buildSipayPurchaseLinkBody({
    env: {
      SIPAY_APP_ID: appId,
      SIPAY_APP_SECRET: appSecret,
      SIPAY_MERCHANT_KEY: merchantKey,
      SIPAY_SALE_WEBHOOK_KEY: webhookKey,
    },
    invoiceId: smokeInvoiceId,
    amountMinor: 9990,
    currency: "TRY",
    payerEmail: "smoke@sipay-test.internal",
    payerName: "Smoke Test",
    items: [{ name: "Smoke Test Plan", priceMinor: 9990, quantity: 1 }],
    returnUrl,
    cancelUrl,
  });

  if (body.hashKey || body.body || body.payload || body.invoicePayload) {
    throw new Error("purchase/link body yalnızca merchant_key, name, surname, currency_code, invoice içermeli");
  }

  const res = await sipayPost(
    baseUrl,
    "/ccpayment/purchase/link",
    body,
    token,
  );

  if (res.status !== true || res.status_code !== 100) {
    const message = res.status_description ?? res.success_message ?? "unknown";
    throw new Error(`purchase/link hatası: ${res.status_code} — ${message}`);
  }
  if (!res.link) throw new Error("Checkout link boş");
  checkoutLink = res.link;
  const masked = checkoutLink.replace(/^(https:\/\/[^/]+).*/, "$1/***/***");
  console.log(`      link=${masked}`);
});

console.log("\n[SIPAY-SMOKE] MANUAL_ACTION_REQUIRED");
console.log(`  invoice_id=${smokeInvoiceId}`);
console.log("  Test kartı ile ödeme yapın, ardından:");
console.log(`  SIPAY_SANDBOX_TEST=1 npm run test:sipay-sandbox -- --check ${smokeInvoiceId}`);

// 4. checkstatus — yeni invoice, ödeme yapılmadı → NOT_PAID beklenir
await test(`POST /ccpayment/api/checkstatus → ödeme yapılmadı (NOT_PAID beklenir)`, async () => {
  const hashKey = generateCheckStatusHash({ invoiceId: smokeInvoiceId, merchantKey, appSecret });

  const res = await sipayPost(
    baseUrl,
    "/ccpayment/api/checkstatus",
    { invoice_id: smokeInvoiceId, merchant_key: merchantKey, hashKey },
    token,
  );

  // Yeni invoice için status_code != 100 veya payment_status=0 beklenir
  const paymentStatus = res.data?.payment_status;
  const statusCode = res.status_code;
  console.log(`      status_code=${statusCode}, payment_status=${paymentStatus}`);

  // Beklenen: 0 (ödenmedi) veya "işlem bulunamadı" hatası — her ikisi de doğru
  if (paymentStatus === 1) throw new Error("Henüz ödenmemiş invoice'de PAID döndü!");
});

// ─── Sonuç ───────────────────────────────────────────────────────────────────
console.log(`\n[SIPAY-SMOKE] Sonuç: ${passed} geçti, ${failed} başarısız\n`);

if (failed > 0) {
  process.exit(1);
}

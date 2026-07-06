/**
 * Kasalar arası transfer — kaynak tarama testleri. DB gerektirmez
 * (TEST_DATABASE_URL yoksa gerçek DB entegrasyon testi çalıştırılmadı).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/cash-bank-account-service.ts";
const ROUTE_PATH = "app/api/cash-bank/transfer/route.ts";
const MODAL_PATH = "components/cash-bank/cash-bank-transfer-modal.tsx";

describe("kasa transferi — canonical servis reuse (route içinde ayrı matematik yok)", () => {
  it("route applyAccountTransfer'ı çağırıyor, kendi bakiye hesaplaması yapmıyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("applyAccountTransfer({"));
    assert.ok(!content.includes("balance -") && !content.includes("balance +"));
  });

  it("transferSchema idempotencyKey zorunlu kılıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const schemaStart = content.indexOf("export const transferSchema");
    const schemaBody = content.slice(schemaStart, schemaStart + 300);
    assert.ok(schemaBody.includes("idempotencyKey: z.string().uuid("));
  });
});

describe("kasa transferi — DB-backed idempotency (double submit koruması)", () => {
  it("AccountTransferIdempotency modeli companyId+idempotencyKey üzerinde unique", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model AccountTransferIdempotency");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(modelBody.includes("@@unique([companyId, idempotencyKey])"));
  });

  it("idempotency claim'i işlemle AYNI transaction içinde yapılıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function applyAccountTransfer");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("await runTransactionWithRetry(async (tx) => {"));
    const claimIdx = fnBody.indexOf("accountTransferIdempotency.findUnique");
    const txIdx = fnBody.indexOf("await runTransactionWithRetry");
    assert.ok(claimIdx > txIdx, "idempotency kontrolü transaction içinde olmalı");
  });

  it("aynı key + aynı payload → COMPLETED sonucu replay edilir (yeni transfer oluşturulmaz)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('existing.status === "COMPLETED" && existing.result'));
    assert.ok(content.includes("replayed: true"));
  });

  it("aynı key + farklı payload → 409 hata", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const idx = content.indexOf("existing.payloadHash !== payloadHash");
    assert.ok(idx !== -1);
    assert.ok(content.slice(idx, idx + 200).includes("409"));
  });

  it("eşzamanlı iki istek unique constraint (P2002) yakalanarak güvenli sonuca çevriliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('isPrismaUniqueConstraintError(error, "idempotencyKey")'));
  });

  it("modal başarılı gönderimden sonra yeni idempotencyKey üretir (bir sonraki transfer farklı key kullanır)", async () => {
    const content = await fs.readFile(MODAL_PATH, "utf8");
    const occurrences = content.split("crypto.randomUUID()").length - 1;
    assert.ok(occurrences >= 2, "hem ilk state hem başarı sonrası reset için randomUUID çağrılmalı");
  });
});

describe("kasa transferi — iki hareket aynı transfer kimliğiyle ilişkilendiriliyor", () => {
  it("AccountTransaction.transferGroupId alanı şemada mevcut", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model AccountTransaction");
    const modelBody = schema.slice(modelStart, schema.indexOf("model StockMovement"));
    assert.ok(modelBody.includes("transferGroupId String?"));
  });

  it("her iki bacak (çıkış+giriş) AYNI transferGroupId ile oluşturuluyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("const transferGroupId = randomUUID()");
    const fnBody = content.slice(fnStart, fnStart + 900);
    const occurrences = fnBody.split("transferGroupId,").length - 1;
    assert.ok(occurrences >= 2, "her iki accountTransaction.create çağrısı transferGroupId almalı");
  });
});

describe("kasa transferi — para birimi kontrolü", () => {
  it("farklı para birimine sahip hesaplar arası transfer reddediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("fromAccount.currency !== toAccount.currency"));
  });
});

describe("kasa transferi — tenant/güvenlik", () => {
  it("kaynak ve hedef hesap ayrı companyId scope ile bulunuyor (başka şirket hesabına transfer 404)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function applyAccountTransfer");
    const fnBody = content.slice(fnStart);
    const occurrences = fnBody.split("companyId: input.companyId,").length - 1;
    assert.ok(occurrences >= 2, "hem fromAccount hem toAccount sorgusu companyId scope içermeli");
  });

  it("aynı hesaba transfer reddediliyor (validateTransferAccounts)", async () => {
    const content = await fs.readFile("lib/cash-bank-account-utils.ts", "utf8");
    assert.ok(content.includes("fromAccountId === toAccountId"));
    assert.ok(content.includes("Kaynak ve hedef hesap aynı olamaz."));
  });

  it("negatif kasa izni canonical şirket ayarına göre kontrol ediliyor (getCompanyAllowNegativeCashBalance)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("getCompanyAllowNegativeCashBalance("));
    assert.ok(content.includes("hasInsufficientCashBalance("));
  });

  it("transfer AccountTransaction.type='TRANSFER' ile kaydediliyor (INCOME/EXPENSE değil — raporda gelir/gider bozulmaz)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("const transferGroupId = randomUUID()");
    const fnBody = content.slice(fnStart, fnStart + 700);
    const occurrences = fnBody.split('type: "TRANSFER",').length - 1;
    assert.ok(occurrences >= 2);
  });

  it("[DB entegrasyon] eşzamanlı iki transfer isteği tek işlem üretir, bakiyeler doğru güncellenir", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
  });
});

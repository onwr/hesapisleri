/**
 * Faz 8 — Kasa/Banka Hareket Detay Testleri
 * Unit testler — DB gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Servis dosyası varlığı ────────────────────────────────────────────────

describe("cash-bank transaction detail — servis", () => {
  it("getAccountTransactionDetail fonksiyonu export edilmiş", async () => {
    const mod = await import("@/lib/cash-bank/get-account-transaction-detail");
    assert.equal(typeof mod.getAccountTransactionDetail, "function");
  });

  it("AccountTransactionDetail tipi doğru alanları içeriyor", async () => {
    // Tip kontrolü: tip uyumlu örnek oluşturulabilmeli
    type AT = import("@/lib/cash-bank/get-account-transaction-detail").AccountTransactionDetail;
    const sample: AT = {
      id: "tx-1",
      title: "Satış Tahsilatı",
      amount: 1000,
      currency: "TRY",
      type: "COLLECTION",
      typeLabel: "Tahsilat",
      direction: "in",
      directionLabel: "Giriş",
      sourceLabel: "Tahsilat",
      statusLabel: "Tamamlandı",
      paymentMethodLabel: "Tahsilat",
      reference: "SAT-001",
      date: new Date(),
      createdAt: new Date(),
      note: null,
      account: { id: "acc-1", name: "Kasa", type: "CASH" },
      counterAccount: null,
      pairedTransaction: null,
      reversal: null,
      createdBy: null,
      customer: null,
      sale: null,
      invoice: null,
      expense: null,
      supplier: null,
      employee: null,
    };
    assert.equal(sample.direction, "in");
    assert.equal(sample.amount, 1000);
  });
});

// ─── 2. Sayfa dosyası varlığı ─────────────────────────────────────────────────

describe("cash-bank transaction detail — sayfa", () => {
  it("detay sayfası dosyası mevcut", async () => {
    const fs = await import("node:fs/promises");
    await assert.doesNotReject(
      fs.access("app/cash-bank/transactions/[id]/page.tsx"),
    );
  });

  it("detay sayfası getCachedAccountTransactionDetailData kullanıyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("getCachedAccountTransactionDetailData"));
  });

  it("TRANSFER_IN/OUT etiketleri tanımlı", async () => {
    const content = await import("node:fs/promises").then((fs) =>
      fs.readFile("lib/cash-bank/account-transaction-labels.ts", "utf8"),
    );
    assert.ok(content.includes("Transfer Girişi"));
    assert.ok(content.includes("Transfer Çıkışı"));
  });

  it("karşı transfer linki /cash-bank/transactions/ formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("pairedTransaction"));
    assert.ok(content.includes("/cash-bank/transactions/"));
  });

  it("detay sayfası TenantPageSync içeriyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("TenantPageSync"), "TenantPageSync kullanılmalı");
  });

  it("detay sayfası guardPageModule kullanıyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("guardPageModule"), "guardPageModule çağrılmalı");
  });

  it("detay sayfası notFound kullanıyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("notFound()"), "notFound() çağrılmalı");
  });

  it("detay sayfası router.refresh() içermiyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(!content.includes("router.refresh()"), "router.refresh() kullanılmamalı");
  });

  it("detay sayfası window.location.reload içermiyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(!content.includes("window.location.reload"), "reload kullanılmamalı");
  });
});

// ─── 3. İşlem türü etiketleri ────────────────────────────────────────────────

describe("cash-bank transaction detail — işlem türü etiketleri", () => {
  it("INCOME → Para Girişi etiketi tanımlı", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("lib/cash-bank/account-transaction-labels.ts", "utf8");
    assert.ok(content.includes("Para Girişi"), "INCOME etiketi tanımlı olmalı");
  });

  it("EXPENSE → Para Çıkışı etiketi tanımlı", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("lib/cash-bank/account-transaction-labels.ts", "utf8");
    assert.ok(content.includes("Para Çıkışı"), "EXPENSE etiketi tanımlı olmalı");
  });

  it("COLLECTION → Tahsilat etiketi tanımlı", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("lib/cash-bank/account-transaction-labels.ts", "utf8");
    assert.ok(content.includes("Tahsilat"), "COLLECTION etiketi tanımlı olmalı");
  });

  it("PAYMENT → Ödeme etiketi tanımlı", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("lib/cash-bank/account-transaction-labels.ts", "utf8");
    assert.ok(content.includes("Ödeme"), "PAYMENT etiketi tanımlı olmalı");
  });
});

// ─── 4. İlişkili kayıt linkleri ──────────────────────────────────────────────

describe("cash-bank transaction detail — ilişkili kayıt linkleri", () => {
  it("fatura linki /invoices/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/invoices/"), "fatura linki /invoices/ ile başlamalı");
  });

  it("gider linki /expenses/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/expenses/"), "gider linki /expenses/ ile başlamalı");
  });

  it("tedarikçi linki /suppliers/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/suppliers/"), "tedarikçi linki /suppliers/ ile başlamalı");
  });

  it("çalışan linki /team/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/team/"), "çalışan linki /team/ ile başlamalı");
  });

  it("hesap linki /cash-bank/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/cash-bank/"), "hesap linki /cash-bank/ ile başlamalı");
  });

  it("satış linki /sales/[id] formatında", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("/sales/"), "satış linki /sales/ ile başlamalı");
  });
});

// ─── 5. Liste satırından detay URL ───────────────────────────────────────────

describe("cash-bank — liste satırından detay URL", () => {
  it("hesap detay sayfasında hareket satırında Eye (detay) linki var", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/[id]/page.tsx", "utf8");
    assert.ok(
      content.includes("/cash-bank/transactions/"),
      "Hesap detay sayfasında /cash-bank/transactions/ linki olmalı",
    );
  });

  it("ana kasa/banka sayfasında hareket satırında detay linki var", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/page.tsx", "utf8");
    assert.ok(
      content.includes("/cash-bank/transactions/"),
      "Ana sayfada /cash-bank/transactions/ linki olmalı",
    );
    assert.ok(
      !content.includes("/cash-bank/transactions/${transaction.id}/edit"),
      "Finans hareketi düzenleme linki olmamalı",
    );
  });

  it("sidebar son hareketler detay rotasına gider", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/cash-bank/cash-bank-sidebar-widgets.tsx",
      "utf8",
    );
    assert.ok(content.includes("/cash-bank/transactions/"));
  });

  it("müşteri cari tahsilat hareketi detay rotasına gider", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("lib/customer-detail-data.ts", "utf8");
    assert.ok(content.includes("/cash-bank/transactions/${tx.id}"));
  });

  it("tedarikçi cari hesap sütunu hareket detayına gider", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("components/suppliers/supplier-ledger-table.tsx", "utf8");
    assert.ok(content.includes("/cash-bank/transactions/"));
  });
});

// ─── 6. companyId scope zorunluluğu ──────────────────────────────────────────

describe("cash-bank transaction detail — tenant scope", () => {
  it("servis account.companyId üzerinden filtre yapıyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "lib/cash-bank/get-account-transaction-detail.ts",
      "utf8",
    );
    assert.ok(content.includes("account: { companyId }"), "companyId scope zorunlu");
  });

  it("servis findFirst kullanıyor (foreign tenant 404 güvencesi)", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "lib/cash-bank/get-account-transaction-detail.ts",
      "utf8",
    );
    assert.ok(content.includes("findFirst"), "findFirst kullanılmalı");
    assert.ok(content.includes("FOR UPDATE") === false);
  });

  it("cached loader cash-bank transaction detail için tanımlı", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "lib/tenant-cache/cached-tenant-page-data.ts",
      "utf8",
    );
    assert.ok(content.includes("getCachedAccountTransactionDetailData"));
    assert.ok(content.includes("cash-bank-transaction-detail"));
  });

  it("servis null döndüğünde sayfa notFound çağırır", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(content.includes("if (!tx) notFound()"), "null → notFound() çağrılmalı");
  });
});

// ─── 7. Sipay izolasyonu ─────────────────────────────────────────────────────

describe("cash-bank transaction detail — Sipay izolasyonu", () => {
  it("detay sayfası Sipay içermiyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/cash-bank/transactions/[id]/page.tsx", "utf8");
    assert.ok(!content.toLowerCase().includes("sipay"), "Sipay referansı olmamalı");
  });

  it("servis dosyası Sipay içermiyor", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "lib/cash-bank/get-account-transaction-detail.ts",
      "utf8",
    );
    assert.ok(!content.toLowerCase().includes("sipay"), "Sipay referansı olmamalı");
  });
});

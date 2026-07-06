/**
 * Mobil tedarikçiler (liste/detay/ödeme) — kaynak tarama testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const SERVICE_PATH = "lib/mobile/mobile-suppliers-service.ts";
const LIST_ROUTE_PATH = "app/api/mobile/suppliers/route.ts";
const DETAIL_ROUTE_PATH = "app/api/mobile/suppliers/[id]/route.ts";
const PAYMENT_ROUTE_PATH = "app/api/mobile/suppliers/[id]/payment/route.ts";
const PRODUCTS_ROUTE_PATH = "app/api/mobile/suppliers/[id]/products/route.ts";
const PERMISSION_POLICY_PATH = "lib/mobile/mobile-permission-policy.ts";

describe("mobile suppliers — tenant izolasyonu (IDOR)", () => {
  it("getMobileSupplierDetail db.supplier.findFirst companyId ile filtreliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("where: { id: input.supplierId, companyId: input.companyId }"),
      "detay sorgusu companyId ile scoped olmalı"
    );
  });

  it("payMobileSupplier ödeme hesabını companyId ile bulur", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function payMobileSupplier");
    const fnBody = content.slice(fnStart);
    assert.ok(
      fnBody.includes("where: { id: parsed.data.accountId, companyId: input.companyId }"),
      "ödeme hesabı tenant scoped bulunmalı — başka firma hesabıyla ödeme yapılamamalı"
    );
  });

  it("createSupplierPayment canonical servisi de kendi içinde tenant/account doğrulaması yapar", async () => {
    const content = await fs.readFile("lib/supplier-finance-service.ts", "utf8");
    assert.ok(content.includes("assertSupplierInCompany"));
    assert.ok(content.includes("validateSupplierFinanceAccount"));
  });

  it("mobil route'lar companyId'yi yalnız session'dan alır", async () => {
    for (const routePath of [LIST_ROUTE_PATH, DETAIL_ROUTE_PATH, PAYMENT_ROUTE_PATH]) {
      const content = await fs.readFile(routePath, "utf8");
      assert.ok(content.includes("requireMobileCompanySession"));
      assert.ok(
        !content.includes("body.companyId") && !content.includes('params.get("companyId")')
      );
    }
  });
});

describe("mobile suppliers — canonical servis reuse", () => {
  it("liste getSuppliers, detay getSupplierDetailLedgerData, ödeme createSupplierPayment kullanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/supplier-service"'));
    assert.ok(content.includes('from "@/lib/supplier-detail-ledger-data"'));
    assert.ok(content.includes('from "@/lib/supplier-finance-service"'));
    assert.ok(
      !content.includes("db.supplier.update(") && !content.includes("db.account.update("),
      "mobil servis bakiye/hesap güncellemesini doğrudan yapmamalı, canonical servisi kullanmalı"
    );
  });

  it("bakiye matematiği yalnız supplier-balance-utils / getSupplierDetailLedgerData üzerinden geliyor, tekrar hesaplanmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("resolveSupplierBalanceView("), "servis kendi başına balance view hesaplamamalı, hazır summary'yi kullanmalı");
    assert.ok(content.includes("detail.summary."));
  });

  it("ödeme yetkisi web'deki canManageSuppliers ile birebir aynı fonksiyonu kullanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/permission-utils"'));
    assert.ok(content.includes("canManageSuppliers("));
  });
});

describe("mobile suppliers — running balance pagination", () => {
  it("sayfalama, tam kronolojik running-balance dizisi hesaplandıktan SONRA dilimleniyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierDetail");
    const fnBody = content.slice(fnStart);
    const detailCallIdx = fnBody.indexOf("getSupplierDetailLedgerData(");
    const sliceIdx = fnBody.indexOf(".slice(start, start + pageSize)");
    assert.ok(detailCallIdx !== -1 && sliceIdx !== -1 && detailCallIdx < sliceIdx,
      "önce tam defter hesaplanmalı, sayfalama sonradan uygulanmalı"
    );
  });

  it("dilimlenen satırların balance alanı zaten canonical running balance'tan geliyor, yeniden hesaplanmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("balanceMinor: toMinor(row.balance)"));
  });
});

describe("mobile suppliers — permission", () => {
  it("suppliers modülü mobile-permission-policy.ts'e eklendi", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    assert.ok(content.includes('"suppliers"'));
    assert.ok(content.includes("suppliers: ["));
  });

  it("yalnız OWNER/ADMIN write yetkisine sahip, STAFF/ACCOUNTANT/POS_STAFF write alamıyor", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    const ownerStart = content.indexOf("OWNER: {");
    const ownerBlock = content.slice(ownerStart, content.indexOf("ADMIN: {", ownerStart));
    assert.ok(ownerBlock.includes('suppliers: ["read", "write"]'));

    const staffStart = content.indexOf("STAFF: {");
    const staffBlock = content.slice(staffStart, content.indexOf("POS_STAFF: {", staffStart));
    assert.ok(staffBlock.includes("suppliers: [\"read\"]"));

    const posStaffStart = content.indexOf("POS_STAFF: {");
    const posStaffBlock = content.slice(posStaffStart, content.indexOf("};", posStaffStart));
    assert.ok(posStaffBlock.includes("suppliers: [],"));
  });

  it("ödeme route'u ekstra canManageSuppliers kontrolü yapıyor (yalnız mobileRoleAllows'a güvenmiyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    // supplierWriteAllowed() ortak helper'ı canManageSuppliers'ı sarmalıyor —
    // payMobileSupplier/createMobileSupplier/updateMobileSupplier hepsi bunu kullanıyor.
    const helperStart = content.indexOf("function supplierWriteAllowed");
    const helperBody = content.slice(helperStart, helperStart + 300);
    assert.ok(helperBody.includes("canManageSuppliers(role as UserRole, isOwner)"));

    const fnStart = content.indexOf("export async function payMobileSupplier");
    const fnBody = content.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("supplierWriteAllowed(input.role, input.isOwner)"));
  });
});

describe("mobile suppliers — para birimi ve idempotency", () => {
  it("tutarlar integer minor amount olarak dönüyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("function toMinor(amount: number)"));
    assert.ok(content.includes("balanceMinor: toMinor("));
    assert.ok(content.includes("payableAmountMinor: toMinor("));
  });

  it("ödeme idempotencyKey zorunlu (uuid) ve doğrudan canonical createSupplierPayment'e geçiliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("idempotencyKey: z.string().uuid("));
    assert.ok(content.includes("idempotencyKey: parsed.data.idempotencyKey"));
  });

  it("createSupplierPayment aynı idempotencyKey ile ikinci çağrıda replay davranışı sağlıyor (double submit koruması)", async () => {
    const content = await fs.readFile("lib/supplier-finance-service.ts", "utf8");
    assert.ok(content.includes("loadIdempotentLedgerEntry"));
    assert.ok(content.includes("replay: true as const"));
    assert.ok(content.includes("assertIdempotentPaymentMatch"));
  });
});

describe("mobile suppliers — tam liste (view=full): pagination ve summary", () => {
  it("route view=full parametresine göre listMobileSuppliersFull'a yönlendiriyor, eski picker bozulmuyor", async () => {
    const content = await fs.readFile(LIST_ROUTE_PATH, "utf8");
    assert.ok(content.includes('url.searchParams.get("view") === "full"'));
    assert.ok(content.includes("listMobileSuppliersFull("));
    assert.ok(
      content.includes("listMobileSuppliers({") && content.includes("cursor: url.searchParams.get"),
      "view=full verilmediğinde eski cursor-tabanlı picker davranışı korunmalı"
    );
  });

  it("listMobileSuppliersFull sayfalamayı filtrelenmiş TÜM satırlar üzerinden yapıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileSuppliersFull");
    const fnBody = content.slice(fnStart, content.indexOf("export async function getMobileSupplierDetail"));
    assert.ok(fnBody.includes("allRows.slice(start, start + pageSize)"));
    assert.ok(fnBody.includes("const total = allRows.length;"));
  });

  it("summary aktif filtrelerle tutarlı — sayfalama öncesi tam (filtrelenmiş) veriden hesaplanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileSuppliersFull");
    const fnBody = content.slice(fnStart, content.indexOf("export async function getMobileSupplierDetail"));
    const summaryLoopIdx = fnBody.indexOf("for (const row of allRows)");
    const sliceIdx = fnBody.indexOf("allRows.slice(start, start + pageSize)");
    assert.ok(
      summaryLoopIdx !== -1 && summaryLoopIdx < sliceIdx,
      "summary hesaplaması sayfalamadan önce, tüm filtrelenmiş satırlar üzerinde yapılmalı"
    );
  });

  it("balance filtreleri (balanceStatus, hasDebt, favorite, hasProducts) canonical getSuppliers'a geçiliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileSuppliersFull");
    const fnBody = content.slice(fnStart, content.indexOf("export async function getMobileSupplierDetail"));
    assert.ok(fnBody.includes("balanceStatus,"));
    assert.ok(fnBody.includes("isFavorite: filters.favorite"));
    assert.ok(fnBody.includes("hasProducts: filters.hasProducts"));
    assert.ok(
      fnBody.includes("filters.hasDebt") && fnBody.includes('"payable"'),
      "hasDebt aynı canonical balanceStatus='payable' filtresine eşlenmeli, ayrı bir hesap icat edilmemeli"
    );
  });

  it("para alanları minor integer, tarih ISO string", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileSuppliersFull");
    const fnBody = content.slice(fnStart, content.indexOf("export async function getMobileSupplierDetail"));
    assert.ok(fnBody.includes("balanceMinor: toMinor(row.currentBalance)"));
    assert.ok(fnBody.includes("totalPayableMinor"));
    assert.ok(fnBody.includes("row.lastActivityAt.toISOString()"));
  });
});

describe("mobile suppliers — picker geriye dönük uyumluluk", () => {
  it("listMobileSuppliers (picker) fonksiyonu değiştirilmedi — cursor/items/nextCursor şekli korunuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileSuppliers(");
    const fnEnd = content.indexOf("export type MobileSuppliersListFullFilters");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null"));
    assert.ok(fnBody.includes("name: s.name || s.companyName"));
  });

  it("GET route view param verilmediğinde picker fonksiyonunu çağırır (varsayılan davranış)", async () => {
    const content = await fs.readFile(LIST_ROUTE_PATH, "utf8");
    const viewFullIdx = content.indexOf('"view") === "full"');
    const pickerCallIdx = content.indexOf("await listMobileSuppliers({");
    assert.ok(viewFullIdx !== -1 && pickerCallIdx !== -1 && viewFullIdx < pickerCallIdx);
  });
});

describe("mobile suppliers — tedarikçi ürünleri", () => {
  it("GET /api/mobile/suppliers/[id]/products route'u mevcut ve permission kontrolü yapıyor", async () => {
    const content = await fs.readFile(PRODUCTS_ROUTE_PATH, "utf8");
    assert.ok(content.includes("requireMobileCompanySession"));
    assert.ok(content.includes("getMobileSupplierProducts("));
  });

  it("getMobileSupplierProducts tenant scoped — önce supplier companyId ile doğrulanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierProducts");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("where: { id: input.supplierId, companyId: input.companyId }"));
    assert.ok(fnBody.includes("SUPPLIER_NOT_FOUND"));
  });

  it("canonical getSupplierProductsForSupplier kullanılıyor, yeni bir ürün-tedarikçi sorgusu icat edilmiyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/supplier-product-service"'));
    assert.ok(content.includes("getSupplierProductsForSupplier(input.companyId, input.supplierId)"));
  });

  it("lastPurchaseAt yalnız mevcut StockMovement (type IN + supplierId) ilişkisinden türetiliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierProducts");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes('type: "IN",'));
    assert.ok(fnBody.includes("supplierId: input.supplierId"));
  });

  it("fiyat alanı minor integer, raw Prisma model/credential dönmüyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierProducts");
    const fnEnd = content.indexOf("export const mobileSupplierPaymentSchema");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("purchasePriceMinor: r.purchasePrice != null ? toMinor("));
    for (const forbidden of ["credentialsEncrypted", "apiKey", "apiSecret"]) {
      assert.ok(!fnBody.includes(forbidden));
    }
  });

  it("ürün ilişkisi yoksa boş liste döner (throw etmez)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierProducts");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("productIds.length"));
    assert.ok(fnBody.includes(": [];"));
  });
});

describe("mobile suppliers — giderler ve stok hareketleri (detay içinde)", () => {
  it("recentExpenses ve recentStockMovements companyId+supplierId ile scoped", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileSupplierDetail");
    const fnEnd = content.indexOf("const PRODUCTS_PAGE_SIZE");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes(
        "db.expense.findMany({\n        where: { companyId: input.companyId, supplierId: input.supplierId }"
      )
    );
    assert.ok(
      fnBody.includes(
        "db.stockMovement.findMany({\n        where: { companyId: input.companyId, supplierId: input.supplierId }"
      )
    );
  });

  it("yalnız mevcut Expense.supplierId / StockMovement.supplierId ilişkileri kullanılıyor — yeni model icat edilmedi", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("MarketplaceOrder"));
    assert.ok(content.includes("db.expense.count(") && content.includes("db.stockMovement.count("));
  });

  it("stats alanı productCount/expenseCount/stockMovementCount/paymentCount/lastTransactionAt içeriyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("stats: {"));
    assert.ok(content.includes("productCount,"));
    assert.ok(content.includes("stockMovementCount,"));
    assert.ok(content.includes("paymentCount,"));
  });

  it("amountMinor minor integer, occurredAt ISO string", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("amountMinor: toMinor(Number(e.amount))"));
    assert.ok(content.includes("occurredAt: e.date.toISOString()"));
    assert.ok(content.includes("occurredAt: m.createdAt.toISOString()"));
  });
});

describe("mobile suppliers — oluşturma/düzenleme (canonical reuse)", () => {
  it("createMobileSupplier canonical createSupplier() servisini kullanıyor, yeni doğrulama mantığı yazmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/supplier-service"'));
    assert.ok(content.includes("createSupplier({"));
    assert.ok(content.includes("updateSupplier({"));
  });

  it("create/update yalnız supplierWriteAllowed (canManageSuppliers — OWNER/ADMIN) ile korunuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const createStart = content.indexOf("export async function createMobileSupplier");
    const createBody = content.slice(createStart, content.indexOf("export async function updateMobileSupplier"));
    assert.ok(createBody.includes("supplierWriteAllowed(input.role, input.isOwner)"));

    const updateStart = content.indexOf("export async function updateMobileSupplier");
    const updateBody = content.slice(updateStart);
    assert.ok(updateBody.includes("supplierWriteAllowed(input.role, input.isOwner)"));
  });

  it("update tenant izolasyonunu canonical updateSupplier() içindeki companyId scoped findFirst ile alır", async () => {
    const content = await fs.readFile("lib/supplier-service.ts", "utf8");
    const fnStart = content.indexOf("export async function updateSupplier");
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("where: { id: input.supplierId, companyId: input.companyId }"));
  });

  it("POST/PATCH route'ları eklendi", async () => {
    const listRoute = await fs.readFile(LIST_ROUTE_PATH, "utf8");
    const detailRoute = await fs.readFile(DETAIL_ROUTE_PATH, "utf8");
    assert.ok(listRoute.includes("export async function POST"));
    assert.ok(detailRoute.includes("export async function PATCH"));
  });
});

describe("mobile suppliers — route/response uyumu (ödeme)", () => {
  it("yalnız tekil /payment route'u var, çift /payments route'u yok", async () => {
    assert.ok(existsSync(PAYMENT_ROUTE_PATH));
    assert.ok(!existsSync(PAYMENT_ROUTE_PATH.replace("/payment/", "/payments/")));
  });
});

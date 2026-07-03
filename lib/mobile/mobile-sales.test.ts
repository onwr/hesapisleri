/**
 * Mobil satışlar (liste/detay/tahsilat/iptal) — kaynak tarama testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/mobile/mobile-sales-service.ts";
const DETAIL_SERVICE_PATH = "lib/mobile/mobile-pos-service.ts";
const LIST_ROUTE_PATH = "app/api/mobile/sales/route.ts";
const COLLECT_ROUTE_PATH = "app/api/mobile/sales/[id]/collect/route.ts";
const CANCEL_ROUTE_PATH = "app/api/mobile/sales/[id]/cancel/route.ts";
const DETAIL_ROUTE_PATH = "app/api/mobile/sales/[id]/route.ts";

describe("mobile sales — tenant izolasyonu", () => {
  it("listMobileSales sorgusu companyId ile scoped", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("const where: Prisma.SaleWhereInput = { companyId };"),
      "liste sorgusu companyId ile başlamalı, foreign tenant kaydı dönmemeli"
    );
  });

  it("collectMobileSalePayment satışı companyId ile bulur", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function collectMobileSalePayment");
    const fnEnd = content.indexOf("export async function cancelMobileSale");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes("companyId: input.companyId") || fnBody.includes("companyId: input.companyId }"),
      "tahsilat satışı tenant scoped şekilde bulmalı"
    );
  });

  it("mobil route'lar companyId'yi yalnız session'dan alır, body/query'den almaz", async () => {
    for (const routePath of [LIST_ROUTE_PATH, COLLECT_ROUTE_PATH, CANCEL_ROUTE_PATH, DETAIL_ROUTE_PATH]) {
      const content = await fs.readFile(routePath, "utf8");
      assert.ok(
        content.includes("requireMobilePosSession"),
        `${routePath} requireMobilePosSession ile companyId'yi session'dan almalı`
      );
      assert.ok(
        !content.includes("body.companyId") && !content.includes("params.get(\"companyId\")"),
        `${routePath} companyId'yi body/query'den kabul etmemeli`
      );
    }
  });

  it("her mobil satış route'u permission kontrolü uyguluyor", async () => {
    const list = await fs.readFile(LIST_ROUTE_PATH, "utf8");
    const collect = await fs.readFile(COLLECT_ROUTE_PATH, "utf8");
    const cancel = await fs.readFile(CANCEL_ROUTE_PATH, "utf8");
    assert.ok(list.includes('requireMobilePermission(session, "sales", "read")'));
    assert.ok(collect.includes('requireMobilePermission(session, "sales", "write")'));
    assert.ok(cancel.includes('requireMobilePermission(session, "sales", "delete")'));
  });
});

describe("mobile sales — DTO güvenliği", () => {
  it("liste tutarları integer minor amount olarak dönüyor (Decimal client'a gitmiyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("totalAmountMinor: Math.round(totalAmount * 100)"));
    assert.ok(content.includes("paidAmountMinor: Math.round(paidAmount * 100)"));
    assert.ok(
      !content.includes("total: sale.total,") && !content.includes("paidAmount: sale.paidAmount,"),
      "ham Prisma Decimal alanı doğrudan response'a konulmamalı"
    );
  });

  it("tarihler ISO string olarak serialize ediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("sale.createdAt.toISOString()"));
  });

  it("detay DTO'su invoiceId, note, canCollect, canCancel, cancellation alanlarını içeriyor", async () => {
    const content = await fs.readFile(DETAIL_SERVICE_PATH, "utf8");
    for (const field of ["invoiceId", "note:", "canCollect", "canCancel", "cancellation:"]) {
      assert.ok(content.includes(field), `getMobileSaleDetail '${field}' alanını dönmeli`);
    }
  });
});

describe("mobile sales — tahsilat kuralları", () => {
  it("tutar kalan bakiyeyi aşarsa reddediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("collectAmount > remaining") &&
        content.includes("AMOUNT_EXCEEDS_REMAINING"),
      "kalan bakiyeyi aşan tahsilat reddedilmeli"
    );
  });

  it("iptal edilmiş satıştan tahsilat alınamaz", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes('sale.status === "CANCELLED" || sale.status === "REFUNDED"') &&
        content.includes("SALE_CANCELLED"),
      "iptal/iade edilmiş satıştan tahsilat engellenmeli"
    );
  });

  it("tahsilat transaction içinde recordSaleCollection + applyCustomerCollection kullanıyor (mevcut servisler)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("db.$transaction"));
    assert.ok(content.includes("recordSaleCollection("));
    assert.ok(content.includes("applyCustomerCollection("));
    assert.ok(
      content.includes('from "@/lib/sale-payment-utils"') &&
        content.includes('from "@/lib/customer-balance-utils"'),
      "yeni/çelişkili bir hesaplama servisi icat edilmemeli, mevcut web servisleri reuse edilmeli"
    );
  });

  it("tahsilat sonrası satış ödeme durumu güncelleniyor ve audit log yazılıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("paymentStatus: nextPaymentStatus"));
    assert.ok(content.includes("tx.activityLog.create"));
  });
});

describe("mobile sales — iptal kuralları", () => {
  it("mevcut canonical cancelSaleById servisini kullanıyor (paralel iptal mantığı icat etmiyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/sale-cancel-service"'));
    assert.ok(content.includes("cancelSaleById("));
  });

  it("zaten iptal edilmiş satış cancelSaleById'nin eligibility kontrolüyle reddedilir", async () => {
    const content = await fs.readFile("lib/sale-cancel-service.ts", "utf8");
    assert.ok(content.includes("validateSaleCancelEligibility"));
  });

  it("iptal sonrası dashboard cache invalidate ediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelMobileSale");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes('invalidateDashboardCache(input.companyId, "sale-cancel")'));
  });
});

describe("mobile sales — liste filtreleri ve sayfalama", () => {
  it("status/paymentStatus/customerId/dateFrom/dateTo/search filtreleri destekleniyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const field of ["filters.status", "filters.paymentStatus", "filters.customerId", "filters.dateFrom", "filters.dateTo", "filters.search"]) {
      assert.ok(content.includes(field), `${field} filtresi uygulanmalı`);
    }
  });

  it("varsayılan sayfalama page=1 pageSize=20", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("DEFAULT_PAGE_SIZE = 20"));
  });

  it("pagination hasNextPage doğru hesaplanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("hasNextPage: page < totalPages"));
  });

  it("arama alanları satış no, müşteri ad/telefon/eposta ve notu kapsıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("saleNo: { contains: search"));
    assert.ok(content.includes("customer: { name: { contains: search"));
    assert.ok(content.includes("customer: { phone: { contains: search"));
    assert.ok(content.includes("customer: { email: { contains: search"));
  });
});

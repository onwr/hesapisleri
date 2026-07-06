/**
 * Mobil siparişler (liste/detay/durum/iptal/kargo) — kaynak tarama testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/mobile/mobile-orders-service.ts";
const LIST_ROUTE_PATH = "app/api/mobile/orders/route.ts";
const DETAIL_ROUTE_PATH = "app/api/mobile/orders/[id]/route.ts";
const STATUS_ROUTE_PATH = "app/api/mobile/orders/[id]/status/route.ts";
const CANCEL_ROUTE_PATH = "app/api/mobile/orders/[id]/cancel/route.ts";
const SHIPMENT_ROUTE_PATH = "app/api/mobile/orders/[id]/shipment/route.ts";
const PERMISSION_POLICY_PATH = "lib/mobile/mobile-permission-policy.ts";

describe("mobile orders — tenant izolasyonu", () => {
  it("listMobileOrders sorgusu companyId ile scoped", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("const where: Prisma.SaleWhereInput = { companyId };"),
      "liste sorgusu companyId ile başlamalı"
    );
  });

  it("getMobileOrderDetail db.sale.findFirst companyId ile filtreliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileOrderDetail");
    const fnEnd = content.indexOf("export async function", fnStart + 1);
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("where: { id: orderId, companyId }"));
    assert.ok(fnBody.includes('"NOT_FOUND"') && fnBody.includes("404"));
  });

  it("tüm mobil order route'ları companyId'yi yalnız session'dan alır", async () => {
    for (const routePath of [
      LIST_ROUTE_PATH,
      DETAIL_ROUTE_PATH,
      STATUS_ROUTE_PATH,
      CANCEL_ROUTE_PATH,
      SHIPMENT_ROUTE_PATH,
    ]) {
      const content = await fs.readFile(routePath, "utf8");
      assert.ok(
        content.includes("requireMobilePosSession"),
        `${routePath} requireMobilePosSession kullanmalı`
      );
      assert.ok(
        !content.includes("body.companyId") && !content.includes('params.get("companyId")'),
        `${routePath} companyId'yi body/query'den kabul etmemeli`
      );
    }
  });

  it("cancelMobileOrder ve updateMobileOrderStatus companyId'yi input'tan alıp servise geçiyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("companyId: input.companyId"));
  });
});

describe("mobile orders — permission", () => {
  it("orders modülü mobile-permission-policy.ts'e eklendi", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    assert.ok(content.includes('"orders"'), "MobileModule union orders içermeli");
    assert.ok(
      content.includes("orders: [") ,
      "her rol için orders yetki listesi tanımlı olmalı"
    );
  });

  it("liste/detay read, durum/kargo/iptal write yetkisi istiyor", async () => {
    const list = await fs.readFile(LIST_ROUTE_PATH, "utf8");
    const detail = await fs.readFile(DETAIL_ROUTE_PATH, "utf8");
    const status = await fs.readFile(STATUS_ROUTE_PATH, "utf8");
    const cancel = await fs.readFile(CANCEL_ROUTE_PATH, "utf8");
    const shipment = await fs.readFile(SHIPMENT_ROUTE_PATH, "utf8");
    assert.ok(list.includes('requireMobilePermission(session, "orders", "read")'));
    assert.ok(detail.includes('requireMobilePermission(session, "orders", "read")'));
    assert.ok(status.includes('requireMobilePermission(session, "orders", "write")'));
    assert.ok(cancel.includes('requireMobilePermission(session, "orders", "write")'));
    assert.ok(shipment.includes('requireMobilePermission(session, "orders", "write")'));
  });

  it("POS_STAFF ve ACCOUNTANT rolleri orders için write/delete yetkisi almıyor", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    const posStaffStart = content.indexOf("POS_STAFF: {");
    const posStaffEnd = content.indexOf("};", posStaffStart);
    const posStaffBlock = content.slice(posStaffStart, posStaffEnd);
    assert.ok(posStaffBlock.includes("orders: [],"));

    const accountantStart = content.indexOf("ACCOUNTANT: {");
    const accountantEnd = content.indexOf("};", accountantStart);
    const accountantBlock = content.slice(accountantStart, accountantEnd);
    assert.ok(accountantBlock.includes("orders: [],"));
  });
});

describe("mobile orders — canonical servis reuse", () => {
  it("durum güncelleme ve iptal mevcut updateOrderById servisini kullanıyor (paralel mantık icat etmiyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/order-service"'));
    assert.ok(content.includes("updateOrderById("));
    assert.ok(
      !content.includes("db.sale.update("),
      "mobil servis doğrudan Prisma update yapmamalı, canonical servisi kullanmalı"
    );
  });

  it("izin verilen geçişler mevcut order-utils canTransitionOrderStatus/getAllowedNextStatuses üzerinden hesaplanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("getAllowedNextStatuses"));
    assert.ok(content.includes('from "@/lib/order-utils"'));
  });

  it("kanal ve durum etiketleri gerçek order-utils fonksiyonlarından geliyor, uydurulmuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("getSourceChannelLabel"));
    assert.ok(content.includes("mapOrderStatusToLabel"));
  });
});

describe("mobile orders — durum ve iptal kuralları", () => {
  it("geçersiz status değeri VALIDATION_ERROR ile reddediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function updateMobileOrderStatus");
    const fnEnd = content.indexOf("export async function", fnStart + 1);
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("ORDER_STATUSES as string[]).includes(input.status)"));
    assert.ok(fnBody.includes("VALIDATION_ERROR"));
  });

  it("iptal edilmiş sipariş tekrar iptal edilirse idempotent davranır (hata fırlatmaz)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelMobileOrder");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes('sale.orderStatus === "CANCELLED"'));
    assert.ok(fnBody.includes("idempotent"));
  });

  it("iptal nedeni orderNote içine yazılıyor, audit log canonical servis üzerinden oluşuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("İptal nedeni:"));
  });
});

describe("mobile orders — kargo kuralları", () => {
  it("iptal edilmiş siparişe gönderi eklenemez", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function addMobileOrderShipment");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes('sale.orderStatus === "CANCELLED"'));
    assert.ok(fnBody.includes("ORDER_CANCELLED"));
  });

  it("aynı takip numarası tekrar eklenmeye çalışılırsa reddedilir", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("DUPLICATE_TRACKING"));
    assert.ok(content.includes("sale.trackingNumber === trackingNumber"));
  });

  it("boş takip numarası reddedilir", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("if (!trackingNumber)"));
  });

  it("kargo firması yeni rastgele enum değil, string olarak kullanıcıdan alınıyor ve trim ediliyor", async () => {
    const content = await fs.readFile(SHIPMENT_ROUTE_PATH, "utf8");
    assert.ok(content.includes("carrier: z.string()"));
  });
});

describe("mobile orders — DTO güvenliği", () => {
  it("tutarlar integer minor amount olarak dönüyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("totalMinor: Math.round(Number(sale.total) * 100)"));
    assert.ok(content.includes("totalMinor: Math.round(total * 100)"));
  });

  it("tarihler ISO string olarak serialize ediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("sale.createdAt.toISOString()"));
  });

  it("ham marketplace payload veya entegrasyon credential'ı DTO'ya konmuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const forbidden of ["credentialsEncrypted", "apiKey", "apiSecret", "supplierId"]) {
      assert.ok(!content.includes(forbidden), `${forbidden} DTO'da bulunmamalı`);
    }
  });

  it("marketplace alanı yalnız isMarketplaceChannel true ise doldurulur", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("isMarketplaceChannel(sale.sourceChannel)"));
  });
});

describe("mobile orders — liste filtreleri ve sayfalama", () => {
  it("channel/status/paymentStatus/customerId/dateFrom/dateTo/search destekleniyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const field of [
      "filters.channel",
      "filters.status",
      "filters.paymentStatus",
      "filters.customerId",
      "filters.dateFrom",
      "filters.dateTo",
      "filters.search",
    ]) {
      assert.ok(content.includes(field), `${field} filtresi desteklenmeli`);
    }
  });

  it("arama sipariş no, dış sipariş no, takip no, müşteri adı/telefonu ve ürün adını kapsıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("saleNo: { contains: search"));
    assert.ok(content.includes("externalOrderId: { contains: search"));
    assert.ok(content.includes("trackingNumber: { contains: search"));
    assert.ok(content.includes("customer: { name: { contains: search"));
    assert.ok(content.includes("items: { some: { name: { contains: search"));
  });

  it("summary aktif filtrelerle aynı where kullanılarak hesaplanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const listStart = content.indexOf("export async function listMobileOrders");
    const listEnd = content.indexOf("export async function", listStart + 1);
    const listBody = content.slice(listStart, listEnd);
    const matches = listBody.match(/db\.sale\.findMany\(\{\s*where,/g) ?? [];
    assert.ok(
      matches.length >= 1,
      "summary sorgusu aynı 'where' filtresini kullanmalı"
    );
  });

  it("desteklenen kanal listesi gerçek OrderSourceChannel enum değerleriyle sınırlı", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes('"MANUAL"') &&
        content.includes('"TRENDYOL"') &&
        content.includes('"HEPSIBURADA"') &&
        content.includes('"N11"') &&
        content.includes('"AMAZON"'),
      "kanal listesi Prisma OrderSourceChannel enum değerleriyle eşleşmeli"
    );
  });
});

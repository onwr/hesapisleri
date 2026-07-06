/**
 * Ürün detay sayfası — cache sonrası tarih serileştirme regresyon testi.
 * Kök neden: getCachedProductDetailData, Next.js unstable_cache ile
 * sarmalanıyor; cache'e yazılıp okunan değerlerde Date nesneleri ISO string'e
 * dönüşebilir. Sayfa kodu ham `.toISOString()` çağırırsa (Date bekleyip
 * string alırsa) TypeError fırlatır — bu da "ürün düzenledikten/geri
 * tuşuna basıldıktan sonra sayfa hataya düşüyor" bulgusunun kök nedenidir.
 * Kaynak tarama, DB gerektirmez.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";
import { toIsoString } from "./format-utils";

const PAGE_PATH = "app/products/[id]/page.tsx";

describe("toIsoString — gerçek unit test (Date VE string güvenli)", () => {
  it("Date nesnesi için ISO string döner", () => {
    const date = new Date("2026-01-15T10:00:00.000Z");
    assert.equal(toIsoString(date), "2026-01-15T10:00:00.000Z");
  });

  it("zaten ISO string olan değeri de doğru işler (cache-hit senaryosu)", () => {
    const iso = "2026-01-15T10:00:00.000Z";
    assert.equal(toIsoString(iso), iso);
  });

  it("null/undefined için null döner (throw etmez)", () => {
    assert.equal(toIsoString(null), null);
    assert.equal(toIsoString(undefined), null);
  });
});

describe("app/products/[id]/page.tsx — artık ham .toISOString() çağırmıyor (regresyon kilidi)", () => {
  it("product.createdAt/updatedAt toIsoString() ile güvenli dönüştürülüyor", async () => {
    const content = await fs.readFile(PAGE_PATH, "utf8");
    assert.ok(content.includes("toIsoString(product.createdAt)"));
    assert.ok(content.includes("toIsoString(product.updatedAt)"));
    assert.ok(
      !content.includes("product.createdAt.toISOString()"),
      "cache'ten string dönerse bu satır throw eder"
    );
    assert.ok(!content.includes("product.updatedAt.toISOString()"));
  });

  it("stockMovements/recentSales tarihleri de toIsoString() kullanıyor", async () => {
    const content = await fs.readFile(PAGE_PATH, "utf8");
    assert.ok(content.includes("toIsoString(movement.movementDate)"));
    assert.ok(content.includes("toIsoString(movement.createdAt)"));
    assert.ok(content.includes("toIsoString(sale.createdAt)"));
    assert.ok(!content.includes("movement.createdAt.toISOString()"));
    assert.ok(!content.includes("sale.createdAt.toISOString()"));
  });

  it("getCachedProductDetailData gerçekten unstable_cache sarmalayıcısından geçiyor (bu yüzden defensive dönüşüm gerekli)", async () => {
    const content = await fs.readFile("lib/tenant-cache/tenant-page-cache.ts", "utf8");
    assert.ok(content.includes("unstable_cache("));
  });
});

describe("diğer önbelleklenen detay sayfaları — aynı deseni zaten kullanıyor (referans/tutarlılık)", () => {
  it("customer-detail-data.ts toIsoString kullanıyor", async () => {
    const content = await fs.readFile("lib/customer-detail-data.ts", "utf8");
    assert.ok(content.includes("toIsoString"));
  });
});

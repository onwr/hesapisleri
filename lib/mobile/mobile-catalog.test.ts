import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isLowStock, resolveProductMinStock } from "@/lib/stocks-page-utils";
import { validatePosCheckoutPayments } from "@/lib/pos-checkout-utils";

const webRoot = join(__dirname, "../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Mobile catalog bootstrap", () => {
  it("mobile-products-service canonical servisleri kullanır", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("productFormSchema"));
    assert.ok(src.includes("assertUniqueProductIdentifiers"));
    assert.ok(!src.includes("allowNegativeStock: false"));
  });

  it("mobile-stocks-service applyProductStockMovement kullanır", () => {
    const src = readSrc("lib/mobile/mobile-stocks-service.ts");
    assert.ok(src.includes("applyProductStockMovement"));
    assert.ok(src.includes("moveStockBetweenWarehouses"));
  });

  it("low-stock canonical isLowStock", () => {
    const min = resolveProductMinStock(10);
    assert.equal(isLowStock(10, min), true);
    assert.equal(isLowStock(11, min), false);
  });
});

describe("Mobile catalog API routes", () => {
  it("products route tenant guard kullanır", () => {
    const src = readSrc("app/api/mobile/products/route.ts");
    assert.ok(src.includes("requireMobileCompanySession"));
    assert.ok(!src.includes("body.companyId"));
  });

  it("stocks adjust canonical schema", () => {
    const src = readSrc("app/api/mobile/stocks/adjust/route.ts");
    assert.ok(src.includes("IN"));
    assert.ok(src.includes("SET"));
  });

  it("customers route company scoped", () => {
    const src = readSrc("app/api/mobile/customers/route.ts");
    assert.ok(src.includes("requireMobileCompanySession"));
  });
});

describe("Mobile catalog response strip", () => {
  it("product list buyPrice permission-aware", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("viewCostPrice"));
    assert.ok(src.includes("permissions.products.viewCostPrice"));
  });

  it("customer balance permission strip", () => {
    const src = readSrc("lib/mobile/mobile-customers-service.ts");
    assert.ok(src.includes("viewBalance"));
  });
});

describe("Mobile catalog detail & archive", () => {
  it("product detail warehouse stocks response", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("warehouseStocks"));
    assert.ok(src.includes("warehouseName"));
    assert.ok(src.includes("unitType"));
  });

  it("product stock movement sensitive strip", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("recentMovements"));
    assert.ok(!src.includes("previousStock"));
    assert.ok(!src.includes("ipAddress"));
  });

  it("customer ledger permission strip", () => {
    const src = readSrc("lib/mobile/mobile-customers-service.ts");
    assert.ok(src.includes("permissions.customers.viewBalance"));
    assert.ok(src.includes("recentCollections"));
  });

  it("archive product toggles via canonical toggleProductStatus", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("archiveMobileProduct"));
    assert.ok(src.includes("toggleProductStatus"));
  });

  it("archive customer permission guarded", () => {
    const src = readSrc("lib/mobile/mobile-customers-service.ts");
    assert.ok(src.includes("archiveMobileCustomer"));
    assert.ok(src.includes("permissions.customers.update"));
  });

  it("canonical productFormSchema contract", () => {
    const src = readSrc("lib/mobile/mobile-products-service.ts");
    assert.ok(src.includes("productFormSchema.safeParse"));
  });

  it("canonical customerFormSchema contract", () => {
    const src = readSrc("lib/mobile/mobile-customers-service.ts");
    assert.ok(src.includes("customerFormSchema.safeParse"));
  });
});

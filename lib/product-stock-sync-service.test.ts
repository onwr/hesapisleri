import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("product stock sync service", () => {
  it("depo toplamından product.stock senkron fonksiyonları export eder", () => {
    const source = read("lib/product-stock-sync-service.ts");
    assert.match(source, /calculateProductStockFromWarehouses/);
    assert.match(source, /syncProductStockFromWarehouses/);
    assert.match(source, /syncManyProductStocks/);
    assert.match(source, /syncAllProductStocksForCompany/);
  });

  it("GET endpointlerinde reconcile kaldırılmış", () => {
    const pageData = read("lib/products-page-data.ts");
    const detailData = read("lib/product-detail-data.ts");
    assert.doesNotMatch(pageData, /reconcileCompanyProductStocks/);
    assert.doesNotMatch(detailData, /reconcileCompanyProductStocks/);
  });

  it("stok hareketi sonrası warehouse-service sync çağırır", () => {
    const warehouse = read("lib/warehouse-service.ts");
    assert.match(warehouse, /syncProductStockFromWarehouses/);
    assert.match(warehouse, /syncProductTotalStock/);
  });

  it("sale-stock-utils hizmet kalemlerini atlar", () => {
    const saleStock = read("lib/sale-stock-utils.ts");
    assert.match(saleStock, /isServiceProductType/);
  });

  it("POS satış sonrası stok sync çağrılır", () => {
    const saleStock = read("lib/sale-stock-utils.ts");
    assert.match(saleStock, /syncProductTotalStock/);
  });

  it("sync-stock API route OWNER/ADMIN yetkisi ister", () => {
    const route = read("app/api/products/sync-stock/route.ts");
    assert.match(route, /syncAllProductStocksForCompany/);
    assert.match(route, /OWNER/);
    assert.match(route, /ADMIN/);
    assert.match(route, /updated/);
    assert.match(route, /unchanged/);
  });

  it("SERVICE ürünler sync dışında tutulur", () => {
    const source = read("lib/product-stock-sync-service.ts");
    assert.match(source, /isServiceProductType/);
    assert.match(source, /productType: "STOCK"/);
  });

  it("ürün oluşturmada hizmet için stok hareketi oluşturulmaz", () => {
    const createRoute = read("app/api/products/create/route.ts");
    assert.match(createRoute, /productType === "SERVICE"/);
    assert.match(createRoute, /applyWarehouseStockMovement/);
  });

  it("ürün oluşturmada başlangıç stoku hareket ile yazılır", () => {
    const createRoute = read("app/api/products/create/route.ts");
    assert.match(createRoute, /applyWarehouseStockMovement/);
    assert.match(createRoute, /başlangıç stoğu/);
  });
});

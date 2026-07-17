import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getSidebarMenuItems } from "./sidebar-menu";
import {
  PRODUCTS_STOCKS_PATH,
  PRODUCTS_STOCKS_WAREHOUSES_PATH,
  buildProductsStocksWarehouseHref,
  buildStocksQuery,
} from "./stocks-page-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("products stocks merge", () => {
  it("sidebar Stoklar ana menüsünü göstermez", () => {
    const titles = getSidebarMenuItems("STAFF").map((item) => item.title);
    assert.ok(titles.includes("Ürünler / Stok"));
    assert.ok(!titles.includes("Stoklar"));
  });

  it("buildStocksQuery /products/stocks kullanır", () => {
    assert.equal(buildStocksQuery({}), PRODUCTS_STOCKS_PATH);
    assert.match(buildStocksQuery({ tab: "movements" }), /^\/products\/stocks\?/);
  });

  it("depo linkleri /products/stocks/warehouses altında", () => {
    assert.equal(
      buildProductsStocksWarehouseHref("wh-1"),
      `${PRODUCTS_STOCKS_WAREHOUSES_PATH}/wh-1`
    );
  });

  it("/stocks sayfası /products/stocks redirect eder", () => {
    const page = read("app/stocks/page.tsx");
    assert.match(page, /redirect\(/);
    assert.match(page, /\/products\/stocks/);
  });

  it("products/stocks sayfası render edilir", () => {
    const page = read("app/products/stocks/page.tsx");
    assert.match(page, /StocksPageShell/);
    assert.match(page, /getStocksPageData/);
  });

  it("ürün detay Stok Merkezi linki /products/stocks", () => {
    const view = read("components/products/product-detail-view.tsx");
    assert.match(view, /\/products\/stocks\?productId=\$\{product\.id\}/);
    assert.doesNotMatch(view, /href="\/stocks"/);
  });

  it("dashboard stok kısayolu /products/stocks", () => {
    const shortcuts = read("lib/dashboard-shortcuts.ts");
    assert.match(shortcuts, /href: "\/products\/stocks"/);
  });

  it("products-shell alt navigasyon içerir", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.match(shell, /ProductsSubNav/);
    assert.match(shell, /ProductsQuickActions/);
    const actions = read("lib/products-page-ui-utils.ts");
    assert.match(actions, /\/products\/stocks/);
    assert.match(actions, /Stok Hareketi/);
  });

  it("products alt nav Depolar linkini içerir", () => {
    const nav = read("components/products/products-sub-nav.tsx");
    assert.match(nav, /Depolar/);
    assert.match(nav, /PRODUCTS_STOCKS_WAREHOUSES_PATH/);
  });
});

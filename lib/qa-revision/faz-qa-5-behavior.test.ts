/**
 * QA Faz 5 — mutation sonrası cache tutarlılığı ve reload kaldırma
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDomainsForMutation, TENANT_MUTATION_INVALIDATION } from "@/lib/tenant-cache/tenant-mutation-matrix";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5 — merkezi cache sistemi", () => {
  it("tenant-cache-domains tüm modülleri listeler", () => {
    const src = readSrc("lib/tenant-cache/tenant-cache-domains.ts");
    for (const domain of [
      "dashboard",
      "sales",
      "products",
      "customers",
      "suppliers",
      "cash-bank",
      "employees",
      "reports",
      "notifications",
    ]) {
      assert.match(src, new RegExp(`"${domain}"`));
    }
  });
});

describe("Faz 5 — mutation invalidation matrisi", () => {
  it("satış sonrası liste + dashboard + stok", () => {
    const domains = getDomainsForMutation("sale-cancel");
    assert.ok(domains.includes("sales"));
    assert.ok(domains.includes("sale-detail"));
    assert.ok(domains.includes("dashboard"));
    assert.ok(domains.includes("warehouse-stock"));
  });

  it("tahsilat sonrası müşteri cari + kasa", () => {
    const domains = getDomainsForMutation("customer-collect");
    assert.ok(domains.includes("customer-ledger"));
    assert.ok(domains.includes("cash-bank"));
  });

  it("stok hareketi sonrası ürün ve depo", () => {
    const domains = getDomainsForMutation("stock-movement");
    assert.ok(domains.includes("product-detail"));
    assert.ok(domains.includes("warehouse-stock"));
  });
});

describe("Faz 5 — reload/refresh politikası", () => {
  it("tenant mutation kontrollü router.refresh", () => {
    const src = readSrc("hooks/use-tenant-mutation.ts");
    assert.match(src, /router\.refresh/);
    assert.match(src, /startTransition/);
  });

  it("optimistic toggle finans dışı", () => {
    const src = readSrc("hooks/use-tenant-mutation.ts");
    assert.match(src, /useOptimisticTenantToggle/);
    assert.deepEqual(TENANT_MUTATION_INVALIDATION["metadata-toggle"], []);
    assert.deepEqual(getDomainsForMutation("metadata-toggle"), []);
  });
});

describe("Faz 5 — mutation response standardı", () => {
  it("stock movement affectedIds döner", () => {
    const src = readSrc("app/api/stocks/movement/route.ts");
    assert.match(src, /affectedIds/);
    assert.match(src, /newStock/);
  });

  it("employee payment data wrapper", () => {
    const src = readSrc("app/api/employees/[id]/payments/route.ts");
    assert.match(src, /affectedIds/);
    assert.match(src, /success: true/);
  });
});

describe("Faz 5.1 — sayfa cache bağlantıları", () => {
  it("liste sayfaları cached loader kullanır", () => {
    for (const [page, loader] of [
      ["app/sales/page.tsx", "getCachedSalesPageData"],
      ["app/customers/page.tsx", "getCachedCustomersPageData"],
      ["app/products/page.tsx", "getCachedProductsPageData"],
      ["app/suppliers/page.tsx", "getCachedSuppliersPageData"],
      ["app/cash-bank/page.tsx", "getCachedCashBankPageData"],
      ["app/expenses/page.tsx", "getCachedExpensesPageData"],
      ["app/reports/page.tsx", "getCachedReportsPageData"],
    ]) {
      const src = readSrc(page);
      assert.match(src, new RegExp(loader));
    }
  });

  it("TenantPageSync liste sayfalarında bağlı", () => {
    for (const page of [
      "app/sales/page.tsx",
      "app/dashboard/page.tsx",
      "app/customers/page.tsx",
    ]) {
      assert.match(readSrc(page), /TenantPageSync/);
    }
  });

  it("mutation response buildTenantMutationSuccess kullanır", () => {
    for (const route of [
      "app/api/customers/create/route.ts",
      "app/api/expenses/create/route.ts",
      "app/api/cash-bank/transfer/route.ts",
    ]) {
      assert.match(readSrc(route), /buildTenantMutationSuccess/);
    }
  });
});

describe("Faz 5 — duplicate submit koruması", () => {
  it("useTenantMutation in-flight guard", () => {
    const src = readSrc("hooks/use-tenant-mutation.ts");
    assert.match(src, /inFlightRef\.current/);
    assert.match(src, /isSubmitting/);
  });
});

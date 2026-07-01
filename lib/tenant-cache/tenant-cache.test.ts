import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildTenantCacheTagsForDomains,
  getDashboardCacheTag,
  getTenantCacheTag,
} from "./tenant-cache-tags";
import { getDomainsForMutation, TENANT_MUTATION_INVALIDATION } from "./tenant-mutation-matrix";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("tenant-cache tags", () => {
  it("dashboard tag geriye dönük uyumlu", () => {
    assert.equal(getDashboardCacheTag("co-1"), "dashboard:co-1");
  });

  it("domain tag company scoped", () => {
    assert.equal(getTenantCacheTag("co-1", "sales"), "tenant:sales:co-1");
    assert.equal(
      getTenantCacheTag("co-1", "sale-detail", "sale-9"),
      "tenant:sale-detail:co-1:sale-9",
    );
  });

  it("entity id varsa liste tag'i de üretilir", () => {
    const tags = buildTenantCacheTagsForDomains(
      "co-1",
      ["sale-detail"],
      { saleId: "sale-9" },
    );
    assert.ok(tags.includes("tenant:sale-detail:co-1:sale-9"));
    assert.ok(tags.includes("tenant:sale-detail:co-1"));
  });
});

describe("tenant mutation invalidation matrix", () => {
  it("sale-create geniş domain seti", () => {
    const domains = getDomainsForMutation("sale-create");
    assert.ok(domains.includes("sales"));
    assert.ok(domains.includes("dashboard"));
    assert.ok(domains.includes("warehouse-stock"));
    assert.ok(domains.includes("cash-bank"));
  });

  it("stock-movement stok ve dashboard", () => {
    const domains = getDomainsForMutation("stock-movement");
    assert.ok(domains.includes("products"));
    assert.ok(domains.includes("warehouse-stock"));
    assert.ok(domains.includes("dashboard"));
    assert.ok(!domains.includes("cash-bank"));
  });

  it("supplier-payment cari ve kasa", () => {
    const domains = getDomainsForMutation("supplier-payment");
    assert.ok(domains.includes("supplier-ledger"));
    assert.ok(domains.includes("cash-bank"));
  });

  it("employee-payment çalışan ve kasa", () => {
    const domains = getDomainsForMutation("employee-payment");
    assert.ok(domains.includes("employee-detail"));
    assert.ok(domains.includes("cash-bank"));
  });

  it("metadata-toggle boş domain", () => {
    assert.deepEqual(TENANT_MUTATION_INVALIDATION["metadata-toggle"], []);
  });
});

describe("tenant-cache server wiring", () => {
  it("dashboard invalidation tenant sistemine delegasyon", () => {
    const src = readSrc("lib/dashboard-cache-invalidation.ts");
    assert.match(src, /invalidateTenantCachesByLegacyReason/);
    assert.match(src, /tenant-cache-invalidation/);
  });

  it("stock movement route invalidateTenantCaches kullanır", () => {
    const src = readSrc("app/api/stocks/movement/route.ts");
    assert.match(src, /invalidateTenantCaches/);
    assert.match(src, /stock-movement/);
  });

  it("supplier payment route invalidateTenantCaches kullanır", () => {
    const src = readSrc("app/api/suppliers/[id]/payments/route.ts");
    assert.match(src, /invalidateTenantCaches/);
    assert.match(src, /supplier-payment/);
  });
});

describe("tenant-cache client wiring", () => {
  it("useTenantMutation duplicate submit engeller", () => {
    const src = readSrc("hooks/use-tenant-mutation.ts");
    assert.match(src, /duplicate_submit/);
    assert.match(src, /inFlightRef/);
    assert.match(src, /notifyTenantCacheSync/);
  });

  it("finance accounts mutation sonrası refetch", () => {
    const src = readSrc("hooks/use-finance-accounts.ts");
    assert.match(src, /subscribeTenantCacheSync/);
    assert.match(src, /refetch/);
  });

  it("stock movement modal useTenantMutation kullanır", () => {
    const src = readSrc("components/stocks/stock-movement-modal.tsx");
    assert.match(src, /useTenantMutation/);
    assert.doesNotMatch(src, /window\.location\.reload/);
  });

  it("window.location.reload kaldırıldı (admin refund)", () => {
    const src = readSrc("components/admin/payments/admin-payment-tab-panels.tsx");
    assert.doesNotMatch(src, /window\.location\.reload/);
    assert.match(src, /onReload/);
  });

  it("employee detail sync tenant cache", () => {
    const src = readSrc("components/employees/employee-detail-client.tsx");
    assert.match(src, /useTenantCacheSync/);
    assert.doesNotMatch(src, /window\.location\.reload/);
  });
});

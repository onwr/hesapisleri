/**
 * QA Faz 5.2 — detay cache, mutation formları, bulk route, pub/sub
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getTenantCacheTag } from "@/lib/tenant-cache/tenant-cache-tags";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5.2 — detay cache bağlantıları", () => {
  const detailPages: Array<[string, string]> = [
    ["app/sales/[id]/page.tsx", "getCachedSaleDetailData"],
    ["app/products/[id]/page.tsx", "getCachedProductDetailData"],
    ["app/expenses/[id]/page.tsx", "getCachedExpenseDetailData"],
    ["app/cash-bank/[id]/page.tsx", "getCachedCashBankAccountDetailData"],
    ["app/customers/[id]/page.tsx", "getCachedCustomerDetailData"],
  ];

  for (const [page, loader] of detailPages) {
    it(`${page} → ${loader}`, () => {
      const src = readSrc(page);
      assert.match(src, new RegExp(loader));
      assert.match(src, /TenantPageSync/);
    });
  }

  it("detail tag companyId + entityId içerir", () => {
    const companyA = "company-a-uuid";
    const saleId = "sale-1";
    const tag = getTenantCacheTag(companyA, "sale-detail", saleId);
    assert.match(tag, new RegExp(companyA));
    assert.match(tag, new RegExp(saleId));
    const other = getTenantCacheTag("company-b-uuid", "sale-detail", saleId);
    assert.notEqual(tag, other);
  });
});

describe("Faz 5.2 — mutation formları", () => {
  const migrated = [
    "components/sales/sale-collect-modal.tsx",
    "components/expenses/expense-pay-modal.tsx",
    "app/pos/page.tsx",
    "components/cash-bank/cash-bank-list-actions.tsx",
    "components/products/products-row-actions.tsx",
    "components/suppliers/suppliers-row-actions.tsx",
    "components/invoices/invoice-collect-modal.tsx",
    "components/products/products-selectable-table.tsx",
  ];

  for (const file of migrated) {
    it(`${file} useTenantMutation veya notifyTenantCacheSync`, () => {
      const src = readSrc(file);
      assert.ok(
        /useTenantMutation/.test(src) || /notifyTenantCacheSync/.test(src),
        `${file} migration eksik`,
      );
      assert.doesNotMatch(src, /window\.location\.reload/);
    });
  }
});

describe("Faz 5.2 — bulk mutation route standardı", () => {
  const routes = [
    "app/api/expenses/bulk/pay/route.ts",
    "app/api/expenses/bulk/cancel/route.ts",
    "app/api/products/bulk/route.ts",
  ];

  for (const route of routes) {
    it(`${route} buildTenantMutationSuccess`, () => {
      const src = readSrc(route);
      assert.match(src, /buildTenantMutationSuccess/);
      assert.match(src, /affectedIds/);
    });
  }
});

describe("Faz 5.2 — pub/sub cleanup", () => {
  it("useTenantCacheSync unmount unsubscribe", () => {
    const src = readSrc("hooks/use-tenant-cache-sync.ts");
    assert.match(src, /return unsubscribe/);
    assert.match(src, /useEffect/);
  });
});

/**
 * Faz 7 — Sipariş, Teklif ve Metadata Mutation Testleri
 * Unit testler — DB gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Sipariş mutation invalidation ────────────────────────────────────────

describe("Faz 7 — sipariş mutation invalidation", () => {
  it("order-status-update → orders ve order-detail ve dashboard invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-status-update");
    assert.ok(domains.includes("orders"), "orders invalidate edilmeli");
    assert.ok(domains.includes("order-detail"), "order-detail invalidate edilmeli");
    assert.ok(domains.includes("dashboard"), "dashboard invalidate edilmeli");
  });

  it("order-approve → products ve warehouse-stock da invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-approve");
    assert.ok(domains.includes("orders"), "orders invalidate edilmeli");
    assert.ok(domains.includes("products"), "products invalidate edilmeli");
    assert.ok(domains.includes("warehouse-stock"), "warehouse-stock invalidate edilmeli");
    assert.ok(domains.includes("stock-movements"), "stock-movements invalidate edilmeli");
  });

  it("order-cancel → orders ve order-detail ve dashboard invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-cancel");
    assert.ok(domains.includes("orders"));
    assert.ok(domains.includes("order-detail"));
    assert.ok(domains.includes("dashboard"));
  });

  it("order-bulk-status → orders ve order-detail invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-bulk-status");
    assert.ok(domains.includes("orders"));
    assert.ok(domains.includes("order-detail"));
  });

  it("order-bulk-shipping → orders invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-bulk-shipping");
    assert.ok(domains.includes("orders"));
  });

  it("order-import → orders ve products ve warehouse-stock invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("order-import");
    assert.ok(domains.includes("orders"));
    assert.ok(domains.includes("products"));
    assert.ok(domains.includes("warehouse-stock"));
  });
});

// ─── 2. Sipariş detay tenant scope ───────────────────────────────────────────

describe("Faz 7 — order-detail domain tanımı", () => {
  it("order-detail domain TenantCacheDomain listesinde var", async () => {
    const mod = await import("@/lib/tenant-cache/tenant-cache-domains");
    const domains: string[] = mod.TENANT_CACHE_DOMAINS as unknown as string[];
    assert.ok(domains.includes("order-detail"), "order-detail domain listede olmalı");
  });

  it("orders domain TenantCacheDomain listesinde var", async () => {
    const mod = await import("@/lib/tenant-cache/tenant-cache-domains");
    const domains: string[] = mod.TENANT_CACHE_DOMAINS as unknown as string[];
    assert.ok(domains.includes("orders"), "orders domain listede olmalı");
  });
});

// ─── 3. Teklif quote-convert invalidation ────────────────────────────────────

describe("Faz 7 — teklif dönüşüm invalidation", () => {
  it("quote-convert → quotes, sales, sale-detail, products, customers, dashboard, reports invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("quote-convert");
    const expected = [
      "quotes",
      "sales",
      "sale-detail",
      "products",
      "customers",
      "dashboard",
      "reports",
    ] as const;
    for (const domain of expected) {
      assert.ok(domains.includes(domain), `${domain} invalidate edilmeli`);
    }
  });

  it("quote-cancel → quotes ve sales ve sale-detail invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("quote-cancel");
    assert.ok(domains.includes("quotes"));
    assert.ok(domains.includes("sales"));
    assert.ok(domains.includes("sale-detail"));
  });
});

// ─── 4. Metadata invalidation ────────────────────────────────────────────────

describe("Faz 7 — metadata category/group invalidation", () => {
  it("product-category-change → products ve product-detail invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("product-category-change");
    assert.ok(domains.includes("products"));
    assert.ok(domains.includes("product-detail"));
  });

  it("expense-category-change → expenses invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("expense-category-change");
    assert.ok(domains.includes("expenses"));
  });

  it("customer-group-change → customers ve customer-detail ve customer-ledger invalidate eder", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation("customer-group-change");
    assert.ok(domains.includes("customers"));
    assert.ok(domains.includes("customer-detail"));
    assert.ok(domains.includes("customer-ledger"));
  });
});

// ─── 5. Bulk action affectedIds ──────────────────────────────────────────────

describe("Faz 7 — bulk action affectedIds", () => {
  it("order-bulk-status mutation reason listede tanımlı", async () => {
    const { TENANT_MUTATION_REASONS } = await import(
      "@/lib/tenant-cache/tenant-mutation-reasons"
    );
    assert.ok(
      (TENANT_MUTATION_REASONS as readonly string[]).includes("order-bulk-status"),
    );
  });

  it("order-bulk-shipping mutation reason listede tanımlı", async () => {
    const { TENANT_MUTATION_REASONS } = await import(
      "@/lib/tenant-cache/tenant-mutation-reasons"
    );
    assert.ok(
      (TENANT_MUTATION_REASONS as readonly string[]).includes("order-bulk-shipping"),
    );
  });
});

// ─── 6. window.reload kullanılmıyor ──────────────────────────────────────────

describe("Faz 7 — reload kullanılmıyor", () => {
  it("orders-bulk-actions-center router.refresh() içermez", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/orders/orders-bulk-actions-center.tsx",
      "utf8",
    );
    assert.ok(!content.includes("router.refresh()"), "router.refresh() bulunmamalı");
    assert.ok(!content.includes("window.location.reload"), "window.location.reload bulunmamalı");
  });

  it("product-categories-manager router.refresh() içermez", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/products/product-categories-manager.tsx",
      "utf8",
    );
    assert.ok(!content.includes("router.refresh()"), "router.refresh() bulunmamalı");
  });

  it("expense-categories-manager router.refresh() içermez", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/expenses/expense-categories-manager.tsx",
      "utf8",
    );
    assert.ok(!content.includes("router.refresh()"), "router.refresh() bulunmamalı");
  });

  it("customer-groups-manager router.refresh() içermez", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/customers/customer-groups-manager.tsx",
      "utf8",
    );
    assert.ok(!content.includes("router.refresh()"), "router.refresh() bulunmamalı");
  });
});

// ─── 7. Foreign tenant reddi — matrix yalıtımı ───────────────────────────────

describe("Faz 7 — tenant mutation reason izolasyonu", () => {
  it("getDomainsForMutation bilinmeyen reason için undefined döner", async () => {
    const { getDomainsForMutation } = await import(
      "@/lib/tenant-cache/tenant-mutation-matrix"
    );
    const domains = getDomainsForMutation(
      "non-existent-reason" as Parameters<typeof getDomainsForMutation>[0],
    );
    assert.equal(domains, undefined);
  });

  it("quotes domain TenantCacheDomain listesinde var", async () => {
    const mod = await import("@/lib/tenant-cache/tenant-cache-domains");
    const domains: string[] = mod.TENANT_CACHE_DOMAINS as unknown as string[];
    assert.ok(domains.includes("quotes"), "quotes domain listede olmalı");
  });
});

// ─── 8. Mutation reason eksiksizliği ─────────────────────────────────────────

describe("Faz 7 — tüm yeni mutation reason'lar tanımlı", () => {
  const expectedReasons = [
    "order-status-update",
    "order-approve",
    "order-cancel",
    "order-bulk-status",
    "order-bulk-shipping",
    "order-import",
    "quote-cancel",
    "quote-convert",
    "product-category-change",
    "expense-category-change",
    "customer-group-change",
  ] as const;

  for (const reason of expectedReasons) {
    it(`${reason} mutation reason tanımlı`, async () => {
      const { TENANT_MUTATION_REASONS } = await import(
        "@/lib/tenant-cache/tenant-mutation-reasons"
      );
      assert.ok(
        (TENANT_MUTATION_REASONS as readonly string[]).includes(reason),
        `${reason} TENANT_MUTATION_REASONS içinde olmalı`,
      );
    });
  }
});

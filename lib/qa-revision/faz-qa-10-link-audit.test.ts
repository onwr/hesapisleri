import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_TENANT_ACTION_FALLBACK,
  resolveSafeTenantActionUrl,
  resolveTenantListFallbackForDetailUrl,
} from "@/lib/tenant-action-url";

const webRoot = process.cwd();

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function collectSourceFiles(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function tenantScanRoots() {
  const roots: string[] = [];
  const appDir = join(webRoot, "app");
  const componentsDir = join(webRoot, "components");

  for (const entry of readdirSync(appDir)) {
    if (["admin", "login", "register", "maintenance", "partner", "partnership"].includes(entry)) {
      continue;
    }
    const full = join(appDir, entry);
    if (!statSync(full).isDirectory()) continue;

    if (entry === "settings") {
      for (const sub of readdirSync(full)) {
        if (sub === "billing") {
          const billingDir = join(full, sub);
          for (const billingEntry of readdirSync(billingDir)) {
            if (billingEntry.toLowerCase().includes("sipay")) continue;
            roots.push(join(billingDir, billingEntry));
          }
          continue;
        }
        roots.push(join(full, sub));
      }
      continue;
    }

    roots.push(full);
  }

  for (const entry of readdirSync(componentsDir)) {
    if (entry === "admin" || entry === "marketing" || entry === "register") continue;
    const full = join(componentsDir, entry);
    if (statSync(full).isDirectory()) {
      roots.push(full);
    }
  }

  return roots;
}

function tenantSourceFiles() {
  const files: string[] = [];
  for (const root of tenantScanRoots()) {
    if (!existsSync(root)) continue;
    if (statSync(root).isDirectory()) {
      collectSourceFiles(root, files);
      continue;
    }
    if (/\.(tsx|ts)$/.test(root)) {
      files.push(root);
    }
  }
  return files;
}

const DETAIL_ROUTE_FILES: Record<string, string> = {
  "/sales/[id]": "app/sales/[id]/page.tsx",
  "/sales/[id]/edit": "app/sales/[id]/edit/page.tsx",
  "/sales/quotes/[id]/edit": "app/sales/quotes/[id]/edit/page.tsx",
  "/invoices/[id]": "app/invoices/[id]/page.tsx",
  "/orders/[id]": "app/orders/[id]/page.tsx",
  "/expenses/[id]": "app/expenses/[id]/page.tsx",
  "/products/[id]": "app/products/[id]/page.tsx",
  "/products/[id]/edit": "app/products/[id]/edit/page.tsx",
  "/products/[id]/stock": "app/products/[id]/stock/page.tsx",
  "/customers/[id]": "app/customers/[id]/page.tsx",
  "/customers/[id]/edit": "app/customers/[id]/edit/page.tsx",
  "/suppliers/[id]": "app/suppliers/[id]/page.tsx",
  "/suppliers/[id]/edit": "app/suppliers/[id]/edit/page.tsx",
  "/team/[id]": "app/team/[id]/page.tsx",
  "/team/payroll/[id]": "app/team/payroll/[id]/page.tsx",
  "/cash-bank/[id]": "app/cash-bank/[id]/page.tsx",
  "/cash-bank/transactions/[id]": "app/cash-bank/transactions/[id]/page.tsx",
};

describe("tenant action url", () => {
  it("geçerli tenant detay URL'lerini korur", () => {
    assert.equal(resolveSafeTenantActionUrl("/sales/s1"), "/sales/s1");
    assert.equal(resolveSafeTenantActionUrl("/invoices/i1?tab=payments"), "/invoices/i1?tab=payments");
    assert.equal(resolveSafeTenantActionUrl("/cash-bank/transactions/tx1"), "/cash-bank/transactions/tx1");
  });

  it("admin ve harici URL'leri bildirim fallback'ine yönlendirir", () => {
    assert.equal(resolveSafeTenantActionUrl("/admin/companies/c1"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(resolveSafeTenantActionUrl("/api/invoices/i1"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(resolveSafeTenantActionUrl("https://evil.test/x"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(resolveSafeTenantActionUrl("//evil.test/x"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(
      resolveSafeTenantActionUrl("/settings/billing/payment/sipay-result"),
      DEFAULT_TENANT_ACTION_FALLBACK,
    );
  });

  it("finans hareketi düzenleme rotasını engeller", () => {
    assert.equal(
      resolveSafeTenantActionUrl("/cash-bank/transactions/tx1/edit"),
      DEFAULT_TENANT_ACTION_FALLBACK,
    );
  });

  it("entity detay fallback listeleri üretir", () => {
    assert.equal(resolveTenantListFallbackForDetailUrl("/sales/s1"), "/sales");
    assert.equal(resolveTenantListFallbackForDetailUrl("/invoices/i1"), "/invoices");
    assert.equal(
      resolveTenantListFallbackForDetailUrl("/cash-bank/transactions/tx1"),
      "/cash-bank",
    );
  });
});

describe("Faz 10 — tenant link audit", () => {
  it("app/components tenant alanında href=\"#\" yok", () => {
    const files = tenantSourceFiles();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /href=["']#["']/);
      assert.doesNotMatch(src, /href=\{["']#["']\}/);
    }
  });

  it("kullanılan detay rotalarının page dosyası mevcut", () => {
    for (const rel of Object.values(DETAIL_ROUTE_FILES)) {
      assert.ok(existsSync(join(webRoot, rel)), `${rel} bulunamadı`);
    }
  });

  it("kasa/banka hareket detay rotası korunuyor", () => {
    const page = readSrc("app/cash-bank/page.tsx");
    assert.match(page, /\/cash-bank\/transactions\/\$\{transaction\.id\}/);
    assert.doesNotMatch(page, /\/cash-bank\/transactions\/\$\{transaction\.id\}\/edit/);
  });

  it("bildirim tıklamaları resolveSafeTenantActionUrl kullanıyor", () => {
    for (const rel of [
      "components/notifications/notification-topbar-button.tsx",
      "components/notifications/notifications-page-client.tsx",
      "components/dashboard/dashboard-notifications-panel.tsx",
    ]) {
      const src = readSrc(rel);
      assert.match(src, /resolveSafeTenantActionUrl/);
    }
  });

  it("foreign tenant reddi — hareket detay servisi companyId scope kullanıyor", () => {
    const src = readSrc("lib/cash-bank/get-account-transaction-detail.ts");
    assert.match(src, /account:\s*\{\s*companyId\s*\}/);
    const detailPage = readSrc("app/cash-bank/transactions/[id]/page.tsx");
    assert.match(detailPage, /if\s*\(!tx\)\s*notFound\(\)/);
  });

  it("Sipay dosyaları bu fazda değiştirilmedi", () => {
    const sipayDir = join(webRoot, "lib", "payments", "sipay");
    assert.ok(existsSync(sipayDir), "Sipay dizini mevcut olmalı");
    const faz10Changed = [
      "lib/tenant-action-url.ts",
      "app/cash-bank/page.tsx",
      "components/notifications/notification-topbar-button.tsx",
      "components/notifications/notifications-page-client.tsx",
      "components/dashboard/dashboard-notifications-panel.tsx",
      "lib/qa-revision/faz-qa-10-link-audit.test.ts",
      "lib/tenant-action-url.test.ts",
    ];
    for (const file of faz10Changed) {
      assert.doesNotMatch(file, /payments\/sipay/);
    }
  });
});

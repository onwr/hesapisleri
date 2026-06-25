import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  canManageProducts,
  canManageWarehouses,
} from "@/lib/permission-utils";
import {
  checkCompanyFeature,
  checkCompanyLimit,
} from "./entitlement-enforcement-service";
import { isOperationalLimitEnforcementEnabled } from "./entitlement-operational-policy";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("entitlement operational unlimited — API routes", () => {
  const enforcementPaths = [
    "lib/warehouse-api-handlers.ts",
    "app/api/products/create/route.ts",
    "lib/company-users-service.ts",
    "lib/marketplace/marketplace-integration-service.ts",
    "lib/efaturam/efaturam-document-service.ts",
  ];

  for (const path of enforcementPaths) {
    it(`${path} uses central requireCompany* layer`, () => {
      const source = read(path);
      assert.match(
        source,
        /requireCompany(?:Feature|Limit)/
      );
    });
  }

  it("auth companies route no longer inline-checks MAX_COMPANIES", () => {
    const source = read("app/api/auth/companies/route.ts");
    assert.doesNotMatch(source, /MAX_COMPANIES/);
    assert.doesNotMatch(source, /requireCompanyLimit/);
  });

  it("e-document preview does not block sendable on entitlement", () => {
    const source = read("lib/e-document/e-document-preview-service.ts");
    assert.match(source, /buildNonBlockingEntitlementStatus/);
    assert.doesNotMatch(source, /entitlement\.featureEnabled/);
    assert.doesNotMatch(source, /entitlement\.limitReached/);
  });
});

describe("entitlement operational unlimited — enforcement behavior", () => {
  it("all operational limit codes are non-blocking", async () => {
    const codes = [
      "MAX_WAREHOUSES",
      "MAX_PRODUCTS",
      "MAX_USERS",
      "MAX_MARKETPLACES",
      "MAX_COMPANIES",
      "MAX_EMPLOYEES",
      "MONTHLY_E_DOCUMENTS",
      "MONTHLY_OCR_SCANS",
      "MONTHLY_EXPORTS",
      "MONTHLY_API_REQUESTS",
      "MONTHLY_AUTOMATIONS",
      "STORAGE_MB",
    ] as const;

    for (const code of codes) {
      assert.equal(isOperationalLimitEnforcementEnabled(code), false);
      const result = await checkCompanyLimit("company-x", code, { incrementBy: 1000 });
      assert.equal(result.allowed, true);
      assert.equal(result.limit, null);
      assert.equal(result.canCreate, true);
    }
  });

  it("all operational feature codes are allowed", async () => {
    const codes = [
      "MULTI_WAREHOUSE",
      "E_DOCUMENT",
      "MARKETPLACE",
      "MULTI_COMPANY",
      "POS",
      "SALES",
      "INVOICES",
      "REPORTS",
      "PAYROLL",
      "ADVANCED_REPORTS",
      "OCR",
      "EXPORT",
      "API_ACCESS",
    ] as const;

    for (const code of codes) {
      assert.equal(await checkCompanyFeature("company-x", code), true);
    }
  });

  it("second warehouse path does not throw at enforcement layer", async () => {
    await assert.doesNotReject(async () => {
      await checkCompanyFeature("c1", "MULTI_WAREHOUSE");
      await checkCompanyLimit("c1", "MAX_WAREHOUSES", { incrementBy: 1 });
    });
  });
});

describe("entitlement operational unlimited — preserved business rules", () => {
  it("role permission still blocks warehouse management for STAFF", () => {
    assert.equal(canManageWarehouses("STAFF"), false);
    assert.equal(canManageWarehouses("ADMIN"), true);
  });

  it("role permission still blocks product management for POS_STAFF", () => {
    assert.equal(canManageProducts("POS_STAFF"), false);
    assert.equal(canManageProducts("ADMIN"), true);
  });

  it("tenant isolation guards remain in e-document preview", () => {
    const source = read("lib/e-document/e-document-preview-service.ts");
    assert.match(source, /companyId:\s*input\.companyId/);
  });

  it("coupon usage limit check preserved in discount reservation", () => {
    const source = read("lib/billing/discount-reservation-service.ts");
    assert.match(source, /maxUsage/);
    assert.match(source, /Kupon kullanım limiti doldu/);
  });

  it("stock insufficiency checks remain in sale flows", () => {
    const source = read("lib/sale-update-stock-utils.ts");
    assert.match(source, /yetersiz|insufficient|stock/i);
  });
});

describe("entitlement operational unlimited — user-facing UI", () => {
  it("invoice e-document panel does not render entitlement warnings", () => {
    const source = read("components/invoices/invoice-e-document-panel.tsx");
    assert.doesNotMatch(source, /entitlement\.message/);
    assert.doesNotMatch(source, /entitlement\.limitReached/);
    assert.doesNotMatch(source, /entitlement\.featureEnabled/);
    assert.doesNotMatch(source, /planınız/i);
    assert.doesNotMatch(source, /yükselt/i);
    assert.doesNotMatch(source, /Limit doldu/i);
  });

  it("warehouses UI has no plan limit messaging", () => {
    const client = read("components/stocks/warehouses-page-client.tsx");
    const shell = read("components/warehouses/warehouses-shell.tsx");
    assert.doesNotMatch(client, /limit/i);
    assert.doesNotMatch(shell, /planınız|yükselt|limitine/i);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkCompanyFeature,
  checkCompanyLimit,
  requireCompanyFeature,
  requireCompanyLimit,
} from "./entitlement-enforcement-service";

describe("entitlement-enforcement-service operational unlimited", () => {
  it("checkCompanyFeature always allows operational features", async () => {
    assert.equal(await checkCompanyFeature("any-company", "E_DOCUMENT"), true);
    assert.equal(await checkCompanyFeature("any-company", "MULTI_WAREHOUSE"), true);
    assert.equal(await checkCompanyFeature("any-company", "UNKNOWN_FEATURE"), true);
  });

  it("requireCompanyFeature never throws", async () => {
    await assert.doesNotReject(() =>
      requireCompanyFeature("any-company", "MARKETPLACE")
    );
  });

  it("checkCompanyLimit always allows operational limits", async () => {
    const result = await checkCompanyLimit("any-company", "MAX_WAREHOUSES", {
      incrementBy: 1,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.limit, null);
    assert.equal(result.remaining, null);
    assert.equal(result.canCreate, true);
    assert.equal(result.isOverLimit, false);
    assert.equal(typeof result.usage, "number");
  });

  it("requireCompanyLimit never throws for listed limits", async () => {
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
      await assert.doesNotReject(() =>
        requireCompanyLimit("any-company", code, { incrementBy: 999 })
      );
    }
  });
});

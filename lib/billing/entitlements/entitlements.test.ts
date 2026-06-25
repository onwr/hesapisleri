import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  ENTITLEMENT_REGISTRY,
  getEntitlementMeta,
  isKnownEntitlementCode,
} from "./entitlement-registry";
import {
  clearEntitlementCache,
  getCachedEntitlements,
  setCachedEntitlements,
} from "./entitlement-cache";
import {
  FeatureDisabledError,
  LimitReachedError,
} from "./entitlement-errors";

describe("entitlement-registry", () => {
  it("includes required feature and limit codes", () => {
    assert.equal(isKnownEntitlementCode("MAX_USERS"), true);
    assert.equal(isKnownEntitlementCode("MULTI_WAREHOUSE"), true);
    assert.equal(isKnownEntitlementCode("MONTHLY_OCR_SCANS"), true);
    assert.equal(getEntitlementMeta("MAX_USERS")?.kind, "LIMIT");
    assert.equal(getEntitlementMeta("OCR")?.kind, "FEATURE");
  });

  it("has metadata for every registry entry", () => {
    for (const code of Object.keys(ENTITLEMENT_REGISTRY)) {
      const meta = getEntitlementMeta(code);
      assert.equal(meta?.code, code);
      assert.ok((meta?.label.length ?? 0) > 0);
    }
  });
});

describe("entitlement-cache", () => {
  beforeEach(() => clearEntitlementCache());

  it("stores and retrieves by company and version key", () => {
    const value = {
      companyId: "c1",
      resolvedAt: new Date().toISOString(),
      entitlements: {},
    };
    setCachedEntitlements("c1", "v1", value);
    assert.deepEqual(getCachedEntitlements("c1", "v1"), value);
    assert.equal(getCachedEntitlements("c1", "v2"), null);
  });
});

describe("entitlement-errors", () => {
  it("FeatureDisabledError has 403 status", () => {
    const err = new FeatureDisabledError("OCR");
    assert.equal(err.status, 403);
    assert.equal(err.featureCode, "OCR");
  });

  it("LimitReachedError has 409 status", () => {
    const err = new LimitReachedError({
      limitCode: "MAX_USERS",
      usage: 5,
      limit: 5,
    });
    assert.equal(err.status, 409);
    assert.equal(err.limitCode, "MAX_USERS");
  });
});

describe("entitlement operational unlimited policy", () => {
  it("operational enforcement is disabled for plan limits and features", async () => {
    const { isOperationalLimitEnforcementEnabled } = await import(
      "./entitlement-operational-policy"
    );
    const { checkCompanyLimit, checkCompanyFeature } = await import(
      "./entitlement-enforcement-service"
    );

    assert.equal(isOperationalLimitEnforcementEnabled("MAX_WAREHOUSES"), false);
    assert.equal(await checkCompanyFeature("c1", "E_DOCUMENT"), true);

    const limit = await checkCompanyLimit("c1", "MAX_WAREHOUSES", {
      incrementBy: 5,
    });
    assert.equal(limit.allowed, true);
    assert.equal(limit.canCreate, true);
  });
});

describe("entitlement-resolution registry metadata", () => {
  it("metered limits use MONTHLY reset", () => {
    assert.equal(getEntitlementMeta("MONTHLY_OCR_SCANS")?.metered, true);
    assert.equal(getEntitlementMeta("MONTHLY_OCR_SCANS")?.resetPeriod, "MONTHLY");
  });
});

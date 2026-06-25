import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNonBlockingEntitlementStatus,
  buildUnlimitedLimitCheckResult,
  isOperationalFeatureEnforcementEnabled,
  isOperationalLimitEnforcementEnabled,
  isUnlimitedOperationalFeatureCode,
  isUnlimitedOperationalLimitCode,
  UNLIMITED_OPERATIONAL_FEATURE_CODES,
  UNLIMITED_OPERATIONAL_LIMIT_CODES,
} from "./entitlement-operational-policy";

describe("entitlement-operational-policy", () => {
  it("lists all operational limit codes", () => {
    for (const code of [
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
    ]) {
      assert.equal(isUnlimitedOperationalLimitCode(code), true);
    }

    assert.equal(UNLIMITED_OPERATIONAL_LIMIT_CODES.length, 12);
  });

  it("lists operational feature codes", () => {
    for (const code of [
      "MULTI_WAREHOUSE",
      "E_DOCUMENT",
      "MARKETPLACE",
      "MULTI_COMPANY",
      "POS",
      "SALES",
      "INVOICES",
    ]) {
      assert.equal(isUnlimitedOperationalFeatureCode(code), true);
    }

    assert.equal(UNLIMITED_OPERATIONAL_FEATURE_CODES.length, 13);
  });

  it("disables operational enforcement gates", () => {
    assert.equal(isOperationalLimitEnforcementEnabled("MAX_WAREHOUSES"), false);
    assert.equal(isOperationalFeatureEnforcementEnabled("E_DOCUMENT"), false);
  });

  it("builds non-blocking entitlement status for UI", () => {
    assert.deepEqual(buildNonBlockingEntitlementStatus(), {
      featureEnabled: true,
      limitReached: false,
      message: null,
    });
  });

  it("builds unlimited limit check result with usage only", () => {
    assert.deepEqual(buildUnlimitedLimitCheckResult(7), {
      allowed: true,
      limit: null,
      usage: 7,
      remaining: null,
      isOverLimit: false,
      canCreate: true,
    });
  });
});

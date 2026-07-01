import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_TENANT_ACTION_FALLBACK,
  hasSafeTenantActionUrl,
  resolveSafeTenantActionUrl,
  resolveTenantListFallbackForDetailUrl,
} from "./tenant-action-url";

describe("tenant-action-url", () => {
  it("boş actionUrl null döner", () => {
    assert.equal(resolveSafeTenantActionUrl(null), null);
    assert.equal(resolveSafeTenantActionUrl(""), null);
    assert.equal(resolveSafeTenantActionUrl("   "), null);
    assert.equal(hasSafeTenantActionUrl(null), false);
  });

  it("tenant içi rotaları kabul eder", () => {
    assert.equal(resolveSafeTenantActionUrl("/dashboard"), "/dashboard");
    assert.equal(resolveSafeTenantActionUrl("/team/emp1?tab=payments"), "/team/emp1?tab=payments");
  });

  it("admin/api/sipay rotalarını reddeder", () => {
    assert.equal(resolveSafeTenantActionUrl("/admin/users/u1"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(resolveSafeTenantActionUrl("/api/invoices/i1"), DEFAULT_TENANT_ACTION_FALLBACK);
    assert.equal(resolveSafeTenantActionUrl("/login"), DEFAULT_TENANT_ACTION_FALLBACK);
  });

  it("hareket düzenleme rotası yok", () => {
    assert.equal(
      resolveSafeTenantActionUrl("/cash-bank/transactions/abc/edit"),
      DEFAULT_TENANT_ACTION_FALLBACK,
    );
  });

  it("detay URL için modül listesi fallback", () => {
    assert.equal(resolveTenantListFallbackForDetailUrl("/suppliers/s1"), "/suppliers");
    assert.equal(resolveTenantListFallbackForDetailUrl("/team/payroll/pr1"), "/team/payroll");
    assert.equal(resolveTenantListFallbackForDetailUrl("/unknown/x"), DEFAULT_TENANT_ACTION_FALLBACK);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTenantResource,
  rejectMismatchedBodyCompanyId,
} from "./tenant-guards";
import { TenantForbiddenError, TenantNotFoundError } from "./tenant-errors";

describe("tenant context helpers", () => {
  it("assertTenantResource rejects mismatched company", () => {
    assert.throws(
      () => assertTenantResource("company-b", "company-a"),
      TenantNotFoundError
    );
  });

  it("rejectMismatchedBodyCompanyId allows matching ids", () => {
    assert.doesNotThrow(() =>
      rejectMismatchedBodyCompanyId("company-a", "company-a")
    );
    assert.doesNotThrow(() =>
      rejectMismatchedBodyCompanyId(undefined, "company-a")
    );
  });

  it("rejectMismatchedBodyCompanyId rejects foreign company id", () => {
    assert.throws(
      () => rejectMismatchedBodyCompanyId("company-b", "company-a"),
      TenantForbiddenError
    );
  });
});

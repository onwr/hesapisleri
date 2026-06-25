import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPartnershipAccessState,
  resolvePartnershipHref,
} from "./partnership-access";

describe("partnership access routing", () => {
  it("resolvePartnershipHref onaylı partneri dashboard'a yönlendirir", () => {
    assert.equal(resolvePartnershipHref({ kind: "APPROVED" }), "/partnership/dashboard");
  });

  it("resolvePartnershipHref bekleyen başvuruyu status sayfasına yönlendirir", () => {
    assert.equal(
      resolvePartnershipHref({
        kind: "PENDING",
        application: {
          id: "a1",
          fullName: "Test",
          email: "test@test.com",
          status: "PENDING",
          rejectionReason: null,
          createdAt: new Date().toISOString(),
          reviewedAt: null,
        },
      }),
      "/partnership/status"
    );
  });

  it("resolvePartnershipHref başvurusu olmayanı apply sayfasına yönlendirir", () => {
    assert.equal(resolvePartnershipHref({ kind: "NONE" }), "/partnership/apply");
  });

  it("getPartnershipAccessState export edilir", () => {
    assert.equal(typeof getPartnershipAccessState, "function");
  });
});
